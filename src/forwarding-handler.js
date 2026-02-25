// ==================== Forwarding System Commands ====================

const ForwardingDB = require('./forwarding-db');

class ForwardingHandler {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
    
    // 用户当前选择的存储库（临时状态）
    this.userCurrentRepo = new Map(); // userId -> repoName
  }

  async handleCommand(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text;
    const args = text.split(' ').slice(1);

    try {
      // 存储库管理
      if (text.startsWith('/repo_create')) {
        return await this.handleRepoCreate(chatId, userId, args);
      }
      if (text.startsWith('/repo_list')) {
        return await this.handleRepoList(chatId, userId);
      }
      if (text.startsWith('/repo_delete')) {
        return await this.handleRepoDelete(chatId, userId, args);
      }
      if (text.startsWith('/repo_info')) {
        return await this.handleRepoInfo(chatId, userId, args);
      }

      // 目标管理
      if (text.startsWith('/target_add')) {
        return await this.handleTargetAdd(chatId, userId, args);
      }
      if (text.startsWith('/target_remove')) {
        return await this.handleTargetRemove(chatId, userId, args);
      }
      if (text.startsWith('/target_list')) {
        return await this.handleTargetList(chatId, userId, args);
      }
      if (text.startsWith('/target_toggle')) {
        return await this.handleTargetToggle(chatId, userId, args);
      }

      // 权限管理
      if (text.startsWith('/perm_grant')) {
        return await this.handlePermGrant(chatId, userId, args);
      }
      if (text.startsWith('/perm_revoke')) {
        return await this.handlePermRevoke(chatId, userId, args);
      }
      if (text.startsWith('/perm_list')) {
        return await this.handlePermList(chatId, userId, args);
      }

      // 转发功能
      if (text.startsWith('/use')) {
        return await this.handleUseRepo(chatId, userId, args);
      }
      if (text.startsWith('/forward')) {
        return await this.handleForwardCommand(chatId, userId, args);
      }

      // 统计
      if (text.startsWith('/forwarded_stats')) {
        return await this.handleStats(chatId, userId, args);
      }
      if (text.startsWith('/forwarded_recent')) {
        return await this.handleRecent(chatId, userId, args);
      }

      return false; // 不是转发系统命令
    } catch (error) {
      console.error('Forwarding command error:', error);
      await this.bot.sendMessage(chatId, `❌ 命令执行失败: ${error.message}`);
      return true;
    }
  }

  // 处理用户发送的普通消息（可能需要转发）
  async handleMessage(message) {
    const userId = message.from.id;
    const currentRepo = this.userCurrentRepo.get(userId);

    if (!currentRepo) {
      return false; // 没有设置当前存储库
    }

    // 转发消息到当前存储库
    return await this.forwardToRepository(message, currentRepo);
  }

  // ==================== Repository Commands ====================

  async handleRepoCreate(chatId, userId, args) {
    if (args.length < 2) {
      await this.bot.sendMessage(chatId, '用法: /repo_create <名称> <描述>');
      return true;
    }

    const name = args[0];
    const description = args.slice(1).join(' ');

    const result = await ForwardingDB.createRepository(this.db, {
      name,
      description,
      created_by: userId
    });

    if (result.success) {
      await this.bot.sendMessage(
        chatId,
        `✅ 存储库创建成功！

📦 名称: ${name}
📝 描述: ${description}

💡 下一步:
1. 添加转发目标: /target_add ${name} <chat_id>
2. 开始转发: /use ${name}`
      );
    } else if (result.error === 'repository_exists') {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${name}" 已存在`);
    } else {
      await this.bot.sendMessage(chatId, `❌ 创建失败: ${result.error}`);
    }

    return true;
  }

  async handleRepoList(chatId, userId) {
    const repos = await ForwardingDB.listRepositories(this.db, userId);

    if (!repos.results || repos.results.length === 0) {
      await this.bot.sendMessage(chatId, '📦 暂无存储库');
      return true;
    }

    let message = '📦 <b>存储库列表</b>\n\n';

    for (const repo of repos.results) {
      const targets = await ForwardingDB.listForwardTargets(this.db, repo.id);
      const targetCount = targets.length;
      
      message += `📌 <b>${repo.name}</b>\n`;
      message += `   📝 ${repo.description || '无描述'}\n`;
      message += `   🎯 转发目标: ${targetCount} 个\n`;
      message += `   👤 创建者: ${repo.created_by}\n\n`;
    }

    message += `\n💡 查看详情: /repo_info <名称>`;

    await this.bot.sendMessage(chatId, message);
    return true;
  }

  async handleRepoDelete(chatId, userId, args) {
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /repo_delete <名称>');
      return true;
    }

    const name = args[0];
    const repo = await ForwardingDB.getRepository(this.db, name);

    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${name}" 不存在`);
      return true;
    }

    if (repo.created_by !== userId) {
      await this.bot.sendMessage(chatId, '❌ 只有创建者可以删除存储库');
      return true;
    }

    await ForwardingDB.deleteRepository(this.db, name);
    await this.bot.sendMessage(chatId, `✅ 存储库 "${name}" 已删除`);
    return true;
  }

  async handleRepoInfo(chatId, userId, args) {
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /repo_info <名称>');
      return true;
    }

    const name = args[0];
    const repo = await ForwardingDB.getRepository(this.db, name);

    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${name}" 不存在`);
      return true;
    }

    const targets = await ForwardingDB.listForwardTargets(this.db, repo.id);
    const permissions = await ForwardingDB.listPermissions(this.db, repo.id);
    const stats = await ForwardingDB.getForwardedStats(this.db, repo.id);

    let message = `📦 <b>存储库: ${repo.name}</b>\n\n`;
    message += `📝 描述: ${repo.description || '无'}\n`;
    message += `👤 创建者: ${repo.created_by}\n`;
    message += `📅 创建时间: ${new Date(repo.created_at).toLocaleString()}\n\n`;

    message += `🎯 <b>转发目标 (${targets.length})</b>\n`;
    if (targets.length > 0) {
      for (const target of targets) {
        const status = target.enabled ? '✅' : '❌';
        message += `${status} ${target.target_chat_id} (${target.target_type})\n`;
      }
    } else {
      message += '   暂无目标\n';
    }

    message += `\n👥 <b>授权用户 (${permissions.length})</b>\n`;
    if (permissions.length > 0) {
      for (const perm of permissions) {
        message += `   • ${perm.user_id} (${perm.role})\n`;
      }
    } else {
      message += '   暂无授权用户\n';
    }

    message += `\n📊 <b>统计</b>\n`;
    message += `   总转发: ${stats.total} 条\n`;

    await this.bot.sendMessage(chatId, message);
    return true;
  }

  // ==================== Target Commands ====================

  async handleTargetAdd(chatId, userId, args) {
    if (args.length < 2) {
      await this.bot.sendMessage(chatId, '用法: /target_add <存储库> <目标chat_id>');
      return true;
    }

    const repoName = args[0];
    const targetChatId = parseInt(args[1]);

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const hasPermission = await ForwardingDB.checkPermission(this.db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 只有管理员可以添加转发目标');
      return true;
    }

    // 尝试发送测试消息到目标
    try {
      await this.bot.sendMessage(
        targetChatId,
        `✅ 转发目标已添加！\n\n📦 存储库: ${repoName}\n\n现在此频道/群组会收到转发到该存储库的内容。`
      );
    } catch (error) {
      await this.bot.sendMessage(
        chatId,
        `❌ 无法发送消息到目标 ${targetChatId}\n\n请确保:\n1. Bot 已加入目标群组/频道\n2. Bot 有发送消息权限\n3. Chat ID 正确`
      );
      return true;
    }

    // 检测目标类型
    let targetType = 'group';
    if (targetChatId > 0) {
      targetType = 'private';
    } else if (String(targetChatId).startsWith('-100')) {
      targetType = 'channel';
    }

    await ForwardingDB.addForwardTarget(this.db, repo.id, targetChatId, targetType);

    await this.bot.sendMessage(
      chatId,
      `✅ 转发目标已添加！\n\n📦 存储库: ${repoName}\n🎯 目标: ${targetChatId} (${targetType})`
    );

    return true;
  }

  async handleTargetRemove(chatId, userId, args) {
    if (args.length < 2) {
      await this.bot.sendMessage(chatId, '用法: /target_remove <存储库> <目标chat_id>');
      return true;
    }

    const repoName = args[0];
    const targetChatId = parseInt(args[1]);

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const hasPermission = await ForwardingDB.checkPermission(this.db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 只有管理员可以移除转发目标');
      return true;
    }

    await ForwardingDB.removeForwardTarget(this.db, repo.id, targetChatId);
    await this.bot.sendMessage(chatId, `✅ 转发目标 ${targetChatId} 已移除`);

    return true;
  }

  async handleTargetList(chatId, userId, args) {
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /target_list <存储库>');
      return true;
    }

    const repoName = args[0];
    const repo = await ForwardingDB.getRepository(this.db, repoName);

    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const targets = await ForwardingDB.listForwardTargets(this.db, repo.id);

    if (targets.length === 0) {
      await this.bot.sendMessage(chatId, `📦 存储库 "${repoName}" 暂无转发目标`);
      return true;
    }

    let message = `🎯 <b>存储库 "${repoName}" 的转发目标</b>\n\n`;
    for (const target of targets) {
      const status = target.enabled ? '✅ 启用' : '❌ 禁用';
      message += `${status}\n`;
      message += `   ID: ${target.target_chat_id}\n`;
      message += `   类型: ${target.target_type}\n\n`;
    }

    await this.bot.sendMessage(chatId, message);
    return true;
  }

  async handleTargetToggle(chatId, userId, args) {
    if (args.length < 2) {
      await this.bot.sendMessage(chatId, '用法: /target_toggle <存储库> <目标chat_id>');
      return true;
    }

    const repoName = args[0];
    const targetChatId = parseInt(args[1]);

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const hasPermission = await ForwardingDB.checkPermission(this.db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 只有管理员可以切换目标状态');
      return true;
    }

    await ForwardingDB.toggleForwardTarget(this.db, repo.id, targetChatId);
    await this.bot.sendMessage(chatId, `✅ 转发目标 ${targetChatId} 状态已切换`);

    return true;
  }

  // ==================== Permission Commands ====================

  async handlePermGrant(chatId, userId, args) {
    if (args.length < 3) {
      await this.bot.sendMessage(chatId, '用法: /perm_grant <存储库> <user_id> <role>\n角色: admin, contributor, viewer');
      return true;
    }

    const repoName = args[0];
    const targetUserId = parseInt(args[1]);
    const role = args[2];

    if (!['admin', 'contributor', 'viewer'].includes(role)) {
      await this.bot.sendMessage(chatId, '❌ 角色必须是: admin, contributor, viewer');
      return true;
    }

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const hasPermission = await ForwardingDB.checkPermission(this.db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 只有管理员可以授予权限');
      return true;
    }

    await ForwardingDB.grantPermission(this.db, repo.id, targetUserId, role, userId);
    await this.bot.sendMessage(chatId, `✅ 已授予用户 ${targetUserId} "${role}" 权限`);

    return true;
  }

  async handlePermRevoke(chatId, userId, args) {
    if (args.length < 2) {
      await this.bot.sendMessage(chatId, '用法: /perm_revoke <存储库> <user_id>');
      return true;
    }

    const repoName = args[0];
    const targetUserId = parseInt(args[1]);

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const hasPermission = await ForwardingDB.checkPermission(this.db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 只有管理员可以撤销权限');
      return true;
    }

    await ForwardingDB.revokePermission(this.db, repo.id, targetUserId);
    await this.bot.sendMessage(chatId, `✅ 已撤销用户 ${targetUserId} 的权限`);

    return true;
  }

  async handlePermList(chatId, userId, args) {
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /perm_list <存储库>');
      return true;
    }

    const repoName = args[0];
    const repo = await ForwardingDB.getRepository(this.db, repoName);

    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const permissions = await ForwardingDB.listPermissions(this.db, repo.id);

    let message = `👥 <b>存储库 "${repoName}" 的授权用户</b>\n\n`;
    message += `👤 创建者: ${repo.created_by} (admin)\n\n`;

    if (permissions.length > 0) {
      for (const perm of permissions) {
        message += `• ${perm.user_id} - ${perm.role}\n`;
        message += `  授予者: ${perm.granted_by}\n`;
        message += `  时间: ${new Date(perm.granted_at).toLocaleString()}\n\n`;
      }
    } else {
      message += '暂无其他授权用户\n';
    }

    await this.bot.sendMessage(chatId, message);
    return true;
  }

  // ==================== Forwarding Commands ====================

  async handleUseRepo(chatId, userId, args) {
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /use <存储库名称> 或 /use off');
      return true;
    }

    const repoName = args[0];

    if (repoName === 'off') {
      this.userCurrentRepo.delete(userId);
      await this.bot.sendMessage(chatId, '✅ 已关闭自动转发');
      return true;
    }

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const hasPermission = await ForwardingDB.checkPermission(this.db, repo.id, userId, 'contributor');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 你没有向此存储库发送内容的权限');
      return true;
    }

    this.userCurrentRepo.set(userId, repoName);
    
    const targets = await ForwardingDB.listForwardTargets(this.db, repo.id);
    const enabledTargets = targets.filter(t => t.enabled);

    await this.bot.sendMessage(
      chatId,
      `✅ <b>当前存储库: ${repoName}</b>\n\n现在发送的所有消息都会转发到此存储库的 ${enabledTargets.length} 个目标\n\n发送 /use off 关闭自动转发`
    );

    return true;
  }

  async handleForwardCommand(chatId, userId, args) {
    // 这个命令需要等待用户后续发送内容
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /forward <存储库名称>');
      return true;
    }

    const repoName = args[0];
    // 临时设置当前存储库
    await this.handleUseRepo(chatId, userId, [repoName]);
    return true;
  }

  async handleStats(chatId, userId, args) {
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /forwarded_stats <存储库> [period]\nperiod: today, week, all');
      return true;
    }

    const repoName = args[0];
    const period = args[1] || 'all';

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const stats = await ForwardingDB.getForwardedStats(this.db, repo.id, period);

    let message = `📊 <b>${repoName} 转发统计</b>\n\n`;
    message += `📅 周期: ${period === 'today' ? '今天' : period === 'week' ? '本周' : '总计'}\n`;
    message += `📝 总计: ${stats.total} 条\n\n`;

    if (stats.byType.length > 0) {
      message += `📝 <b>内容类型</b>\n`;
      for (const type of stats.byType) {
        message += `   ${type.message_type}: ${type.count} 条\n`;
      }
      message += '\n';
    }

    if (stats.byUser.length > 0) {
      message += `👥 <b>贡献者排名</b>\n`;
      for (let i = 0; i < Math.min(5, stats.byUser.length); i++) {
        const user = stats.byUser[i];
        message += `   ${i + 1}. ${user.source_user_id}: ${user.count} 条\n`;
      }
    }

    await this.bot.sendMessage(chatId, message);
    return true;
  }

  async handleRecent(chatId, userId, args) {
    if (args.length < 1) {
      await this.bot.sendMessage(chatId, '用法: /forwarded_recent <存储库> [limit]');
      return true;
    }

    const repoName = args[0];
    const limit = parseInt(args[1]) || 10;

    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return true;
    }

    const recent = await ForwardingDB.getRecentForwarded(this.db, repo.id, limit);

    if (recent.length === 0) {
      await this.bot.sendMessage(chatId, `📜 存储库 "${repoName}" 暂无转发记录`);
      return true;
    }

    let message = `📜 <b>${repoName} 最近转发 (${recent.length}条)</b>\n\n`;

    for (let i = 0; i < recent.length; i++) {
      const record = recent[i];
      const timeAgo = this.getTimeAgo(record.forwarded_at);
      message += `${i + 1}. ${timeAgo}\n`;
      message += `   用户: ${record.source_user_id}\n`;
      message += `   类型: ${record.message_type}\n\n`;
    }

    await this.bot.sendMessage(chatId, message);
    return true;
  }

  // ==================== Helper Methods ====================

  async forwardToRepository(message, repoName) {
    const repo = await ForwardingDB.getRepository(this.db, repoName);
    if (!repo) {
      return false;
    }

    const userId = message.from.id;
    const hasPermission = await ForwardingDB.checkPermission(this.db, repo.id, userId, 'contributor');
    
    if (!hasPermission) {
      await this.bot.sendMessage(message.chat.id, '❌ 你没有向此存储库发送内容的权限');
      return false;
    }

    const targets = await ForwardingDB.listForwardTargets(this.db, repo.id);
    const enabledTargets = targets.filter(t => t.enabled);

    if (enabledTargets.length === 0) {
      await this.bot.sendMessage(message.chat.id, '❌ 此存储库没有启用的转发目标');
      return false;
    }

    // 并发转发到所有目标
    const results = await Promise.allSettled(
      enabledTargets.map(target => 
        this.bot.forwardMessage(target.target_chat_id, message.chat.id, message.message_id)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // 记录转发日志
    await ForwardingDB.logForwardedMessage(this.db, {
      repository_id: repo.id,
      source_user_id: userId,
      source_message_id: message.message_id,
      message_type: this.getMessageType(message),
      forwarded_to: enabledTargets.map(t => t.target_chat_id),
      metadata: { successful, failed }
    });

    // 发送确认消息
    let confirmMsg = `✅ 已转发到 ${repoName}\n\n`;
    confirmMsg += `成功: ${successful} 个目标\n`;
    if (failed > 0) {
      confirmMsg += `失败: ${failed} 个目标\n`;
    }

    await this.bot.sendMessage(message.chat.id, confirmMsg);
    return true;
  }

  getMessageType(message) {
    if (message.photo) return 'photo';
    if (message.video) return 'video';
    if (message.document) return 'document';
    if (message.audio) return 'audio';
    if (message.voice) return 'voice';
    if (message.sticker) return 'sticker';
    if (message.animation) return 'animation';
    if (message.poll) return 'poll';
    return 'text';
  }

  getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }
}

module.exports = ForwardingHandler;
