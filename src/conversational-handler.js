/**
 * 对话式转发系统 - 状态管理和交互处理
 * 
 * 核心理念：通过自然对话和按钮交互，而不是复杂命令
 */

// ==================== 用户状态管理 ====================

async function getUserState(db, userId) {
  try {
    return await db
      .prepare('SELECT * FROM user_states WHERE user_id = ?')
      .bind(userId)
      .first();
  } catch (error) {
    console.error('getUserState error:', error);
    return null;
  }
}

async function setUserState(db, userId, state) {
  try {
    const now = Date.now();
    const existingState = await getUserState(db, userId);
    
    if (existingState) {
      await db
        .prepare(`
          UPDATE user_states 
          SET mode = ?, current_repo = ?, setup_step = ?, setup_data = ?, 
              message_count = ?, updated_at = ?
          WHERE user_id = ?
        `)
        .bind(
          state.mode || 'idle',
          state.current_repo || null,
          state.setup_step || null,
          state.setup_data ? JSON.stringify(state.setup_data) : null,
          state.message_count || 0,
          now,
          userId
        )
        .run();
    } else {
      await db
        .prepare(`
          INSERT INTO user_states (user_id, mode, current_repo, setup_step, setup_data, message_count, updated_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          userId,
          state.mode || 'idle',
          state.current_repo || null,
          state.setup_step || null,
          state.setup_data ? JSON.stringify(state.setup_data) : null,
          state.message_count || 0,
          now,
          now
        )
        .run();
    }
  } catch (error) {
    console.error('setUserState error:', error);
  }
}

async function clearUserState(db, userId) {
  try {
    await setUserState(db, userId, { mode: 'idle', current_repo: null, setup_step: null, setup_data: null });
  } catch (error) {
    console.error('clearUserState error:', error);
  }
}

// ==================== 主菜单 ====================

async function showMainMenu(bot, chatId, userId, db) {
  const repos = await listForwardRepositories(db, userId);
  
  let text = '👋 欢迎使用内容转发助手！\n\n';
  
  if (repos.length > 0) {
    // 显示用户的视频库
    text += `📦 <b>你的视频库 (${repos.length})</b>\n`;
    
    const state = await getUserState(db, userId);
    const currentRepo = state?.current_repo;
    
    for (const repo of repos.slice(0, 3)) {
      const status = (currentRepo === repo.name) ? ' ✅ 进行中' : '';
      const targets = await listForwardTargets(db, repo.id);
      const enabledCount = targets.filter(t => t.enabled).length;
      
      text += `   • ${repo.name}${status}\n`;
      text += `     🎯 ${enabledCount} 个目标`;
      
      // 今日统计
      const stats = await getForwardedStats(db, repo.id, 'today');
      if (stats.total > 0) {
        text += ` | 📊 今日 ${stats.total} 条`;
      }
      text += '\n';
    }
    
    if (repos.length > 3) {
      text += `   ... 还有 ${repos.length - 3} 个\n`;
    }
  } else {
    text += '📦 你还没有视频库\n\n';
    text += '视频库可以帮你:\n';
    text += '✅ 自动转发内容到多个频道\n';
    text += '✅ 多人协作管理\n';
    text += '✅ 统计分析\n';
  }
  
  // 按钮
  const buttons = [
    [
      { text: '📦 管理视频库', callback_data: 'menu:repos' },
      { text: '➕ 创建新库', callback_data: 'repo:create_start' }
    ]
  ];
  
  if (repos.length > 0) {
    buttons.push([
      { text: '📊 查看统计', callback_data: 'menu:stats' },
      { text: '❓ 帮助', callback_data: 'menu:help' }
    ]);
  } else {
    buttons.push([
      { text: '❓ 如何使用', callback_data: 'menu:help' }
    ]);
  }
  
  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

// ==================== 视频库列表 ====================

async function showRepoList(bot, chatId, userId, db) {
  const repos = await listForwardRepositories(db, userId);
  
  if (repos.length === 0) {
    await bot.sendMessage(chatId, '📦 你还没有视频库\n\n点击下方按钮创建第一个吧！', {
      reply_markup: {
        inline_keyboard: [[
          { text: '➕ 创建视频库', callback_data: 'repo:create_start' },
          { text: '🔙 返回', callback_data: 'menu:main' }
        ]]
      }
    });
    return;
  }
  
  const state = await getUserState(db, userId);
  const currentRepo = state?.current_repo;
  
  let text = '📦 <b>你的视频库</b>\n\n';
  
  const buttons = [];
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const status = (currentRepo === repo.name) ? ' ✅' : '';
    const targets = await listForwardTargets(db, repo.id);
    const enabledCount = targets.filter(t => t.enabled).length;
    const stats = await getForwardedStats(db, repo.id, 'today');
    
    text += `${i + 1}️⃣ <b>${repo.name}</b>${status}\n`;
    text += `   🎯 ${enabledCount} 个目标`;
    if (stats.total > 0) {
      text += ` | 📊 今日 ${stats.total} 条`;
    }
    if (enabledCount === 0) {
      text += ' ⚠️ 未设置';
    }
    text += '\n\n';
    
    buttons.push([
      { text: `${i + 1}️⃣ ${repo.name}${status}`, callback_data: `repo:select:${repo.name}` }
    ]);
  }
  
  text += '━━━━━━━━━━━━━━━\n';
  text += '点击视频库查看详情';
  
  buttons.push([
    { text: '➕ 创建新库', callback_data: 'repo:create_start' },
    { text: '🔙 返回', callback_data: 'menu:main' }
  ]);
  
  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

// ==================== 视频库详情 ====================

async function showRepoDetails(bot, chatId, userId, db, repoName) {
  const repo = await getForwardRepository(db, repoName);
  
  if (!repo) {
    await bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在`);
    return;
  }
  
  const targets = await listForwardTargets(db, repo.id);
  const permissions = await listForwardPermissions(db, repo.id);
  const stats = await getForwardedStats(db, repo.id);
  const todayStats = await getForwardedStats(db, repo.id, 'today');
  const weekStats = await getForwardedStats(db, repo.id, 'week');
  
  let text = `📦 <b>${repo.name}</b>\n\n`;
  
  if (repo.description) {
    text += `📝 ${repo.description}\n`;
  }
  text += `👤 创建者: ${repo.created_by === userId ? '你' : repo.created_by}\n`;
  text += `📅 创建于: ${new Date(repo.created_at).toLocaleDateString('zh-CN')}\n\n`;
  
  // 转发目标
  text += `🎯 <b>转发目标 (${targets.length})</b>\n`;
  if (targets.length > 0) {
    const enabled = targets.filter(t => t.enabled);
    text += `   ✅ ${enabled.length} 个启用`;
    if (enabled.length < targets.length) {
      text += ` | ❌ ${targets.length - enabled.length} 个禁用`;
    }
    text += '\n';
    
    for (const target of targets.slice(0, 3)) {
      const status = target.enabled ? '✅' : '❌';
      text += `   ${status} ${target.target_chat_id}\n`;
    }
    if (targets.length > 3) {
      text += `   ... 还有 ${targets.length - 3} 个\n`;
    }
  } else {
    text += `   ⚠️ 还没有转发目标\n`;
  }
  text += '\n';
  
  // 授权用户
  if (permissions.length > 0) {
    text += `👥 <b>授权用户 (${permissions.length})</b>\n`;
    for (const perm of permissions.slice(0, 3)) {
      const roleEmoji = { admin: '👑', contributor: '✏️', viewer: '👀' };
      text += `   ${roleEmoji[perm.role] || '•'} ${perm.user_id} (${perm.role})\n`;
    }
    if (permissions.length > 3) {
      text += `   ... 还有 ${permissions.length - 3} 个\n`;
    }
    text += '\n';
  }
  
  // 统计
  text += `📊 <b>统计</b>\n`;
  text += `   总计: ${stats.total} 条\n`;
  text += `   本周: ${weekStats.total} 条\n`;
  text += `   今日: ${todayStats.total} 条\n`;
  
  // 按钮
  const hasTargets = targets.filter(t => t.enabled).length > 0;
  const buttons = [];
  
  if (hasTargets) {
    buttons.push([
      { text: '🚀 开始使用', callback_data: `repo:use:${repo.name}` },
      { text: '🎯 管理目标', callback_data: `repo:targets:${repo.name}` }
    ]);
  } else {
    buttons.push([
      { text: '🎯 添加转发目标', callback_data: `target:add_start:${repo.name}` }
    ]);
  }
  
  buttons.push([
    { text: '👥 授权用户', callback_data: `perm:manage:${repo.name}` },
    { text: '📊 查看统计', callback_data: `stats:show:${repo.name}` }
  ]);
  
  if (repo.created_by === userId) {
    buttons.push([
      { text: '✏️ 编辑', callback_data: `repo:edit:${repo.name}` },
      { text: '🗑 删除', callback_data: `repo:delete_confirm:${repo.name}` }
    ]);
  }
  
  buttons.push([
    { text: '🔙 返回列表', callback_data: 'menu:repos' }
  ]);
  
  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

// ==================== 创建视频库流程 ====================

async function startCreateRepo(bot, chatId, userId, db) {
  await setUserState(db, userId, {
    mode: 'setup',
    setup_step: 'creating_repo_name',
    setup_data: {}
  });
  
  await bot.sendMessage(
    chatId,
    `📦 <b>创建新视频库</b>\n\n请给视频库起个名字\n\n💡 比如：每日科技、搞笑视频、学习资料`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ 取消', callback_data: 'setup:cancel' }
        ]]
      }
    }
  );
}

async function handleCreatingRepoName(bot, chatId, userId, db, text) {
  const name = text.trim();
  
  // 验证名称
  if (name.length < 2 || name.length > 50) {
    await bot.sendMessage(chatId, '❌ 名称长度应在 2-50 个字符之间\n\n请重新输入：');
    return;
  }
  
  // 检查是否已存在
  const existing = await getForwardRepository(db, name);
  if (existing) {
    await bot.sendMessage(chatId, `❌ 视频库 "${name}" 已存在\n\n请换个名字：`);
    return;
  }
  
  // 保存名称，进入下一步
  await setUserState(db, userId, {
    mode: 'setup',
    setup_step: 'creating_repo_desc',
    setup_data: { name }
  });
  
  await bot.sendMessage(
    chatId,
    `✅ 名称：<b>${name}</b>\n\n现在，写一句简短的描述吧\n\n💡 比如：每天分享最新的科技新闻和产品测评`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '跳过', callback_data: 'repo:create_skip_desc' }],
          [{ text: '❌ 取消', callback_data: 'setup:cancel' }]
        ]
      }
    }
  );
}

async function handleCreatingRepoDesc(bot, chatId, userId, db, text) {
  const state = await getUserState(db, userId);
  const setupData = state.setup_data ? JSON.parse(state.setup_data) : {};
  const name = setupData.name;
  const description = text.trim();
  
  if (!name) {
    await bot.sendMessage(chatId, '❌ 会话超时，请重新开始');
    await clearUserState(db, userId);
    return;
  }
  
  // 创建视频库
  const result = await createForwardRepository(db, {
    name,
    description: description || '无描述',
    created_by: userId
  });
  
  if (!result.success) {
    await bot.sendMessage(chatId, `❌ 创建失败: ${result.error}`);
    await clearUserState(db, userId);
    return;
  }
  
  // 清除状态
  await clearUserState(db, userId);
  
  // 显示成功消息
  await bot.sendMessage(
    chatId,
    `🎉 <b>视频库创建成功！</b>\n\n📦 ${name}\n📝 ${description || '无描述'}\n\n下一步要做什么？`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 添加转发目标', callback_data: `target:add_start:${name}` }],
          [{ text: '🚀 开始使用', callback_data: `repo:select:${name}` }],
          [{ text: '🔙 返回主菜单', callback_data: 'menu:main' }]
        ]
      }
    }
  );
}

// ==================== 添加转发目标流程 ====================

async function startAddTarget(bot, chatId, userId, db, repoName) {
  const repo = await getForwardRepository(db, repoName);
  if (!repo) {
    await bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在`);
    return;
  }
  
  // 检查权限
  const hasPermission = await checkForwardPermission(db, repo.id, userId, 'admin');
  if (!hasPermission) {
    await bot.sendMessage(chatId, '❌ 只有管理员可以添加转发目标');
    return;
  }
  
  await setUserState(db, userId, {
    mode: 'setup',
    setup_step: 'adding_target',
    setup_data: { repo_name: repoName, repo_id: repo.id }
  });
  
  await bot.sendMessage(
    chatId,
    `🎯 <b>添加转发目标</b>\n\n请执行以下步骤：\n\n1️⃣ 将我添加到你的频道/群组\n2️⃣ 确保我有"发送消息"权限\n3️⃣ <b>转发该频道的任意一条消息给我</b>\n\n或者，直接发送频道 ID\n格式：@channel_name 或 -100xxx`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ 取消', callback_data: 'setup:cancel' }
        ]]
      }
    }
  );
}

async function handleAddingTarget(bot, chatId, userId, db, message) {
  const state = await getUserState(db, userId);
  const setupData = state.setup_data ? JSON.parse(state.setup_data) : {};
  const repoId = setupData.repo_id;
  const repoName = setupData.repo_name;
  
  if (!repoId) {
    await bot.sendMessage(chatId, '❌ 会话超时，请重新开始');
    await clearUserState(db, userId);
    return;
  }
  
  let targetChatId = null;
  let targetType = 'group';
  let targetInfo = '';
  
  // 检测是转发消息还是文本ID
  if (message.forward_from_chat) {
    // 转发的消息
    const forwardedChat = message.forward_from_chat;
    targetChatId = forwardedChat.id;
    targetType = forwardedChat.type === 'channel' ? 'channel' : 'group';
    targetInfo = forwardedChat.title || forwardedChat.username || String(targetChatId);
    
    await bot.sendMessage(chatId, `🔍 检测到${targetType === 'channel' ? '频道' : '群组'}：<b>${targetInfo}</b>\n\n正在测试发送权限...`);
  } else if (message.text) {
    // 文本ID
    const text = message.text.trim();
    
    // @username 格式
    if (text.startsWith('@')) {
      targetInfo = text;
      // 需要通过 API 获取 chat ID
      await bot.sendMessage(chatId, '⚠️ 暂不支持 @username 格式\n\n请转发频道消息给我，或使用数字 ID（-100xxx）');
      return;
    }
    
    // 数字 ID
    targetChatId = parseInt(text);
    if (isNaN(targetChatId)) {
      await bot.sendMessage(chatId, '❌ 无效的 ID 格式\n\n请转发频道消息，或发送数字 ID（-100xxx）');
      return;
    }
    
    targetType = targetChatId > 0 ? 'private' : (String(targetChatId).startsWith('-100') ? 'channel' : 'group');
    targetInfo = String(targetChatId);
    
    await bot.sendMessage(chatId, `正在测试发送到 ${targetInfo}...`);
  } else {
    await bot.sendMessage(chatId, '❌ 请转发频道消息，或发送频道 ID');
    return;
  }
  
  // 测试发送消息
  try {
    await bot.sendMessage(
      targetChatId,
      `✅ <b>转发目标已添加！</b>\n\n📦 视频库: ${repoName}\n\n现在此${targetType === 'channel' ? '频道' : '群组'}会收到转发到该视频库的内容。`
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `❌ 无法发送消息到目标\n\n可能的原因：\n• Bot 未被添加到${targetType === 'channel' ? '频道' : '群组'}\n• Bot 没有发送消息权限\n• Chat ID 不正确\n\n错误: ${error.message}\n\n请重新尝试或取消`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ 取消', callback_data: 'setup:cancel' }
          ]]
        }
      }
    );
    return;
  }
  
  // 添加到数据库
  await addForwardTarget(db, repoId, targetChatId, targetType);
  
  // 清除状态
  await clearUserState(db, userId);
  
  // 显示成功消息
  await bot.sendMessage(
    chatId,
    `✅ <b>转发目标已添加！</b>\n\n📦 视频库: ${repoName}\n🎯 目标: ${targetInfo} (${targetType})\n\n下一步？`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ 再添加一个', callback_data: `target:add_start:${repoName}` }],
          [{ text: '🚀 开始使用', callback_data: `repo:use:${repoName}` }],
          [{ text: '🔙 返回详情', callback_data: `repo:select:${repoName}` }]
        ]
      }
    }
  );
}

// ==================== 导出供主处理器使用 ====================

// 这些函数会被集成到主 worker 中
