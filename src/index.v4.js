/**
 * Telegram 转发机器人 V4 - 清晰重构版本
 * 功能：
 * 1. 视频库管理
 * 2. 备份频道
 * 3. 多目标转发
 * 4. Bot 邀请链接 + 群组快捷绑定
 */

// ==================== Telegram API 封装 ====================

class TelegramAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = `https://api.telegram.org/bot${token}`;
    this.botUsername = null;
  }

  async callAPI(method, params = {}) {
    try {
      const response = await fetch(`${this.baseURL}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return await response.json();
    } catch (error) {
      console.error(`API error [${method}]:`, error);
      return { ok: false, error: error.message };
    }
  }

  async getMe() {
    const result = await this.callAPI('getMe');
    if (result.ok) this.botUsername = result.result.username;
    return result;
  }

  async sendMessage(chatId, text, options = {}) {
    return this.callAPI('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options
    });
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    return this.callAPI('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      ...options
    });
  }

  async answerCallbackQuery(queryId, text = '') {
    return this.callAPI('answerCallbackQuery', {
      callback_query_id: queryId,
      text
    });
  }

  async copyMessage(fromChatId, toChatId, messageId) {
    return this.callAPI('copyMessage', {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId
    });
  }

  async exportChatInviteLink(chatId) {
    return this.callAPI('exportChatInviteLink', { chat_id: chatId });
  }
}

// ==================== 数据库操作 ====================

class Database {
  constructor(db) {
    this.db = db;
  }

  // 初始化表结构
  async initTables() {
    // forward_repositories 表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS forward_repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        backup_channel_id INTEGER,
        backup_channel_username TEXT,
        backup_enabled INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(user_id, name)
      )
    `);

    // forward_targets 表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS forward_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        chat_id INTEGER NOT NULL,
        chat_title TEXT,
        chat_username TEXT,
        enabled INTEGER DEFAULT 1,
        added_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE,
        UNIQUE(repo_id, chat_id)
      )
    `);

    // forwarded_messages 表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS forwarded_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        source_message_id INTEGER NOT NULL,
        target_chat_id INTEGER NOT NULL,
        target_message_id INTEGER NOT NULL,
        backup_message_id INTEGER,
        media_type TEXT,
        forwarded_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
      )
    `);

    // user_states 表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_states (
        user_id INTEGER PRIMARY KEY,
        mode TEXT NOT NULL,
        current_repo TEXT,
        data TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // pending_group_bindings 表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_group_bindings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        chat_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
      )
    `);
  }

  // 视频库操作
  async listRepositories(userId) {
    const result = await this.db.prepare(
      'SELECT * FROM forward_repositories WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
    return result.results || [];
  }

  async getRepository(name) {
    const result = await this.db.prepare(
      'SELECT * FROM forward_repositories WHERE name = ? LIMIT 1'
    ).bind(name).first();
    return result;
  }

  async createRepository(userId, name, description = null) {
    const result = await this.db.prepare(
      'INSERT INTO forward_repositories (user_id, name, description) VALUES (?, ?, ?)'
    ).bind(userId, name, description).run();
    return result.meta.last_row_id;
  }

  async setBackupChannel(repoId, channelId, channelUsername = null) {
    await this.db.prepare(
      'UPDATE forward_repositories SET backup_channel_id = ?, backup_channel_username = ?, backup_enabled = 1 WHERE id = ?'
    ).bind(channelId, channelUsername, repoId).run();
  }

  // 转发目标操作
  async listForwardTargets(repoId) {
    const result = await this.db.prepare(
      'SELECT * FROM forward_targets WHERE repo_id = ? ORDER BY added_at DESC'
    ).bind(repoId).all();
    return result.results || [];
  }

  async addForwardTarget(repoId, chatId, chatTitle, chatUsername = null) {
    await this.db.prepare(
      'INSERT OR REPLACE INTO forward_targets (repo_id, chat_id, chat_title, chat_username, enabled) VALUES (?, ?, ?, ?, 1)'
    ).bind(repoId, chatId, chatTitle, chatUsername).run();
  }

  // 用户状态操作
  async getUserState(userId) {
    const result = await this.db.prepare(
      'SELECT * FROM user_states WHERE user_id = ? LIMIT 1'
    ).bind(userId).first();
    
    if (!result) return null;
    
    return {
      mode: result.mode,
      current_repo: result.current_repo,
      data: result.data ? JSON.parse(result.data) : null
    };
  }

  async saveUserState(userId, mode, currentRepo = null, data = null) {
    await this.db.prepare(
      'INSERT OR REPLACE INTO user_states (user_id, mode, current_repo, data, updated_at) VALUES (?, ?, ?, ?, strftime("%s", "now"))'
    ).bind(userId, mode, currentRepo, data ? JSON.stringify(data) : null).run();
  }

  async clearUserState(userId) {
    await this.db.prepare('DELETE FROM user_states WHERE user_id = ?').bind(userId).run();
  }

  // 待绑定群组操作
  async createPendingBinding(repoId, chatId, expiresAt) {
    await this.db.prepare(
      'INSERT INTO pending_group_bindings (repo_id, chat_id, expires_at) VALUES (?, ?, ?)'
    ).bind(repoId, chatId, expiresAt).run();
  }

  async getPendingBinding(chatId) {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db.prepare(
      'SELECT * FROM pending_group_bindings WHERE chat_id = ? AND expires_at > ? LIMIT 1'
    ).bind(chatId, now).first();
    return result;
  }

  async cleanupExpiredBindings() {
    const now = Math.floor(Date.now() / 1000);
    await this.db.prepare('DELETE FROM pending_group_bindings WHERE expires_at <= ?').bind(now).run();
  }

  // 记录转发消息
  async recordForwardedMessage(repoId, sourceMessageId, targetChatId, targetMessageId, backupMessageId = null, mediaType = 'text') {
    await this.db.prepare(
      'INSERT INTO forwarded_messages (repo_id, source_message_id, target_chat_id, target_message_id, backup_message_id, media_type) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(repoId, sourceMessageId, targetChatId, targetMessageId, backupMessageId, mediaType).run();
  }
}

// ==================== 转发处理器 ====================

class ForwardingHandler {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
  }

  async forwardMessage(message, repo) {
    const userId = message.from.id;
    const messageId = message.message_id;
    const chatId = userId;
    
    // 获取启用的转发目标
    const targets = await this.db.listForwardTargets(repo.id);
    const enabledTargets = targets.filter(t => t.enabled);
    
    if (enabledTargets.length === 0 && !repo.backup_channel_id) {
      await this.bot.sendMessage(chatId, '❌ 没有可用的转发目标或备份频道');
      return { success: false };
    }

    const results = [];
    let backupMessageId = null;

    // 1. 先转发到备份频道
    if (repo.backup_channel_id && repo.backup_enabled) {
      try {
        const backupResult = await this.bot.copyMessage(chatId, repo.backup_channel_id, messageId);
        if (backupResult.ok) {
          backupMessageId = backupResult.result.message_id;
          console.log(`✅ Backup: ${backupMessageId}`);
        }
      } catch (error) {
        console.error('Backup failed:', error);
      }
    }

    // 2. 转发到所有目标
    for (const target of enabledTargets) {
      try {
        const result = await this.bot.copyMessage(chatId, target.chat_id, messageId);
        
        if (result.ok) {
          const targetMessageId = result.result.message_id;
          
          // 记录转发
          await this.db.recordForwardedMessage(
            repo.id,
            messageId,
            target.chat_id,
            targetMessageId,
            backupMessageId,
            message.photo ? 'photo' : message.video ? 'video' : 'text'
          );
          
          results.push({ target: target.chat_title, success: true });
        } else {
          results.push({ target: target.chat_title, success: false });
        }
      } catch (error) {
        console.error(`Forward to ${target.chat_id} failed:`, error);
        results.push({ target: target.chat_title, success: false });
      }
    }

    return {
      success: results.some(r => r.success),
      results,
      backupMessageId
    };
  }
}

// ==================== 主 Worker ====================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Webhook 端点
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
        const db = new Database(env.DB);
        const handler = new ForwardingHandler(bot, db);
        
        // 初始化
        await db.initTables();
        await bot.getMe();
        await db.cleanupExpiredBindings();
        
        // 路由处理
        if (update.message) {
          await handleMessage(update.message, bot, db, handler);
        } else if (update.callback_query) {
          await handleCallback(update.callback_query, bot, db, handler);
        } else if (update.my_chat_member) {
          await handleBotAddedToGroup(update.my_chat_member, bot, db);
        }
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        
        // 发送错误到 Telegram
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: 6938405510,
              text: `❌ Error:\n${error.message}\n\n${error.stack?.substring(0, 500)}`
            })
          });
        } catch (e) {}
        
        return new Response('Error', { status: 500 });
      }
    }

    return new Response('Telegram Bot is running', { status: 200 });
  }
};

// ==================== 消息处理 ====================

async function handleMessage(message, bot, db, handler) {
  const userId = message.from?.id;
  const chatId = message.chat.id;
  const isPrivate = message.chat.type === 'private';
  
  if (!userId) return;

  // /start 命令
  if (message.text?.startsWith('/start')) {
    if (isPrivate) {
      await showMainMenu(userId, chatId, bot, db);
    }
    return;
  }

  // 群组中的 /bind 命令
  if (!isPrivate && message.text?.startsWith('/bind')) {
    await handleBindCommand(message, bot, db);
    return;
  }

  // 私聊消息处理
  if (isPrivate) {
    await handlePrivateMessage(message, bot, db, handler);
  }
}

// 显示主菜单
async function showMainMenu(userId, chatId, bot, db) {
  await db.clearUserState(userId);
  
  const repos = await db.listRepositories(userId);
  
  let text = '👋 <b>欢迎使用转发助手！</b>\n\n';
  text += '🎯 功能：多目标转发 + 自动备份\n\n';
  
  if (repos.length > 0) {
    text += '📦 <b>你的视频库：</b>\n';
    repos.forEach(repo => text += `• ${repo.name}\n`);
  } else {
    text += '💡 还没有视频库，点击下方按钮创建';
  }
  
  const keyboard = {
    inline_keyboard: []
  };
  
  if (repos.length > 0) {
    keyboard.inline_keyboard.push([
      { text: '📦 管理视频库', callback_data: 'list_repos' }
    ]);
  }
  
  keyboard.inline_keyboard.push([
    { text: '➕ 创建视频库', callback_data: 'create_repo' }
  ]);
  
  await bot.sendMessage(chatId, text, { reply_markup: keyboard });
}

// 处理私聊消息
async function handlePrivateMessage(message, bot, db, handler) {
  const userId = message.from.id;
  const chatId = message.chat.id;
  
  const state = await db.getUserState(userId);
  
  if (!state || state.mode === 'idle') {
    await bot.sendMessage(chatId, '请使用 /start 开始');
    return;
  }
  
  // 创建视频库流程
  if (state.mode === 'creating_repo') {
    const name = message.text?.trim();
    
    if (!name || name.length < 2) {
      await bot.sendMessage(chatId, '❌ 视频库名称至少2个字符');
      return;
    }
    
    // 检查是否已存在
    const existing = await db.getRepository(name);
    if (existing) {
      await bot.sendMessage(chatId, '❌ 这个名称已被使用');
      return;
    }
    
    // 创建
    try {
      await db.createRepository(userId, name);
      await db.clearUserState(userId);
      
      let text = `✅ <b>视频库创建成功！</b>\n\n`;
      text += `📦 名称：<b>${name}</b>\n\n`;
      text += `使用 /start 开始管理`;
      
      await bot.sendMessage(chatId, text);
    } catch (error) {
      await bot.sendMessage(chatId, `❌ 创建失败：${error.message}`);
    }
    return;
  }
  
  // 设置备份频道流程
  if (state.mode === 'setting_backup') {
    const repoName = state.current_repo;
    const repo = await db.getRepository(repoName);
    
    if (!repo) {
      await bot.sendMessage(chatId, '❌ 视频库不存在');
      await db.clearUserState(userId);
      return;
    }
    
    let channelId = null;
    let channelUsername = null;
    
    // 处理转发的频道消息
    if (message.forward_from_chat?.type === 'channel') {
      channelId = message.forward_from_chat.id;
      channelUsername = message.forward_from_chat.username || null;
    }
    // 处理文本输入
    else if (message.text) {
      const text = message.text.trim();
      if (text.startsWith('@')) {
        channelUsername = text;
      } else if (/^-?\d+$/.test(text)) {
        channelId = parseInt(text);
      }
    }
    
    if (!channelId && !channelUsername) {
      await bot.sendMessage(chatId, '❌ 格式错误\n\n请转发频道消息或发送频道 ID/@username');
      return;
    }
    
    try {
      await db.setBackupChannel(repo.id, channelId, channelUsername);
      await db.clearUserState(userId);
      
      let text = `✅ <b>备份频道设置成功！</b>\n\n`;
      text += `📦 视频库：<b>${repoName}</b>\n`;
      text += `💾 备份频道：${channelUsername || channelId}\n\n`;
      text += `使用 /start 返回`;
      
      await bot.sendMessage(chatId, text);
    } catch (error) {
      await bot.sendMessage(chatId, `❌ 设置失败：${error.message}`);
    }
    return;
  }
  
  // 转发模式
  if (state.mode === 'forwarding') {
    const repoName = state.current_repo;
    const repo = await db.getRepository(repoName);
    
    if (!repo) {
      await bot.sendMessage(chatId, '❌ 视频库不存在');
      await db.clearUserState(userId);
      return;
    }
    
    // 执行转发
    const result = await handler.forwardMessage(message, repo);
    
    if (result.success) {
      const successCount = result.results.filter(r => r.success).length;
      let text = `✅ <b>转发成功</b>\n\n`;
      text += `📤 已转发：${successCount}/${result.results.length}\n`;
      if (result.backupMessageId) text += `💾 已备份\n`;
      text += `\n继续发送内容或 /start 返回`;
      
      await bot.sendMessage(chatId, text);
    } else {
      await bot.sendMessage(chatId, '❌ 转发失败');
    }
  }
}

// ==================== 回调处理 ====================

async function handleCallback(query, bot, db, handler) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.callback_data;
  
  await bot.answerCallbackQuery(query.id);
  
  // 列出视频库
  if (data === 'list_repos') {
    const repos = await db.listRepositories(userId);
    
    let text = '📦 <b>选择视频库：</b>\n\n';
    repos.forEach(repo => text += `• ${repo.name}\n`);
    
    const keyboard = { inline_keyboard: [] };
    
    repos.forEach(repo => {
      keyboard.inline_keyboard.push([
        { text: repo.name, callback_data: `repo:${repo.name}` }
      ]);
    });
    
    keyboard.inline_keyboard.push([
      { text: '🔙 返回', callback_data: 'back_main' }
    ]);
    
    await bot.editMessageText(chatId, messageId, text, { reply_markup: keyboard });
  }
  
  // 创建视频库
  else if (data === 'create_repo') {
    await db.saveUserState(userId, 'creating_repo');
    
    await bot.editMessageText(chatId, messageId, 
      '📝 <b>创建视频库</b>\n\n请发送视频库名称（2-30个字符）：'
    );
  }
  
  // 查看视频库详情
  else if (data.startsWith('repo:')) {
    const repoName = data.substring(5);
    const repo = await db.getRepository(repoName);
    
    if (!repo) {
      await bot.editMessageText(chatId, messageId, '❌ 视频库不存在');
      return;
    }
    
    const targets = await db.listForwardTargets(repo.id);
    const enabledTargets = targets.filter(t => t.enabled);
    
    let text = `📦 <b>${repo.name}</b>\n\n`;
    if (repo.description) text += `📝 ${repo.description}\n\n`;
    
    text += `📤 转发目标：${enabledTargets.length}\n`;
    
    if (repo.backup_channel_id) {
      text += `💾 备份频道：${repo.backup_channel_username || repo.backup_channel_id}\n`;
    } else {
      text += `💾 备份频道：未设置\n`;
    }
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🚀 开始转发', callback_data: `forward:${repoName}` }],
        [{ text: '💾 设置备份频道', callback_data: `backup:${repoName}` }],
        [{ text: '🔗 生成邀请链接', callback_data: `invite:${repoName}` }],
        [{ text: '🔙 返回', callback_data: 'list_repos' }]
      ]
    };
    
    await bot.editMessageText(chatId, messageId, text, { reply_markup: keyboard });
  }
  
  // 开始转发
  else if (data.startsWith('forward:')) {
    const repoName = data.substring(8);
    const repo = await db.getRepository(repoName);
    
    if (!repo) {
      await bot.editMessageText(chatId, messageId, '❌ 视频库不存在');
      return;
    }
    
    await db.saveUserState(userId, 'forwarding', repoName);
    
    let text = `🚀 <b>转发模式已激活</b>\n\n`;
    text += `📦 视频库：<b>${repoName}</b>\n\n`;
    text += `现在发送内容（文字/图片/视频），我会自动转发到所有目标\n\n`;
    text += `使用 /start 返回`;
    
    await bot.editMessageText(chatId, messageId, text);
  }
  
  // 设置备份频道
  else if (data.startsWith('backup:')) {
    const repoName = data.substring(7);
    await db.saveUserState(userId, 'setting_backup', repoName);
    
    let text = `💾 <b>设置备份频道</b>\n\n`;
    text += `📦 视频库：<b>${repoName}</b>\n\n`;
    text += `请转发备份频道的一条消息，或直接发送：\n`;
    text += `• 频道用户名：<code>@channelname</code>\n`;
    text += `• 频道 ID：<code>-1001234567890</code>\n\n`;
    text += `💡 私有频道需要将 Bot 添加为管理员`;
    
    const keyboard = {
      inline_keyboard: [[
        { text: '🔙 返回', callback_data: `repo:${repoName}` }
      ]]
    };
    
    await bot.editMessageText(chatId, messageId, text, { reply_markup: keyboard });
  }
  
  // 生成邀请链接
  else if (data.startsWith('invite:')) {
    const repoName = data.substring(7);
    const repo = await db.getRepository(repoName);
    
    if (!repo) {
      await bot.editMessageText(chatId, messageId, '❌ 视频库不存在');
      return;
    }
    
    const botInfo = await bot.getMe();
    const botUsername = botInfo.result?.username;
    
    if (!botUsername) {
      await bot.editMessageText(chatId, messageId, '❌ 无法获取 Bot 信息');
      return;
    }
    
    const inviteLink = `https://t.me/${botUsername}?startgroup=${repo.id}`;
    
    let text = `🔗 <b>Bot 邀请链接</b>\n\n`;
    text += `📦 视频库：<b>${repoName}</b>\n\n`;
    text += `<code>${inviteLink}</code>\n\n`;
    text += `💡 点击链接将 Bot 添加到群组，自动绑定为转发目标`;
    
    const keyboard = {
      inline_keyboard: [[
        { text: '🔙 返回', callback_data: `repo:${repoName}` }
      ]]
    };
    
    await bot.editMessageText(chatId, messageId, text, { reply_markup: keyboard });
  }
  
  // 返回主菜单
  else if (data === 'back_main') {
    await showMainMenu(userId, chatId, bot, db);
  }
}

// 群组 /bind 命令处理
async function handleBindCommand(message, bot, db) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const parts = message.text.split(' ');
  
  if (parts.length < 2) {
    await bot.sendMessage(chatId, '❌ 用法：/bind 视频库名称');
    return;
  }
  
  const repoName = parts.slice(1).join(' ');
  const repo = await db.getRepository(repoName);
  
  if (!repo) {
    await bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在`);
    return;
  }
  
  if (repo.user_id !== userId) {
    await bot.sendMessage(chatId, '❌ 只有视频库创建者可以绑定');
    return;
  }
  
  // 添加转发目标
  try {
    await db.addForwardTarget(
      repo.id,
      chatId,
      message.chat.title || 'Unknown',
      message.chat.username || null
    );
    
    await bot.sendMessage(chatId, 
      `✅ <b>绑定成功！</b>\n\n📦 视频库：<b>${repoName}</b>\n📤 本群组已添加为转发目标`
    );
  } catch (error) {
    await bot.sendMessage(chatId, `❌ 绑定失败：${error.message}`);
  }
}

// Bot 被添加到群组处理
async function handleBotAddedToGroup(myChatMember, bot, db) {
  const chat = myChatMember.chat;
  const newStatus = myChatMember.new_chat_member.status;
  
  // 只处理 Bot 被添加或成为管理员的情况
  if (newStatus !== 'member' && newStatus !== 'administrator') return;
  
  const chatId = chat.id;
  
  // 检查是否有待绑定记录
  const binding = await db.getPendingBinding(chatId);
  
  if (binding) {
    const repo = await db.getRepository(binding.repo_id);
    
    if (repo) {
      // 自动绑定
      await db.addForwardTarget(
        repo.id,
        chatId,
        chat.title || 'Unknown',
        chat.username || null
      );
      
      await bot.sendMessage(chatId, 
        `✅ <b>自动绑定成功！</b>\n\n📦 视频库：<b>${repo.name}</b>\n📤 本群组已添加为转发目标`
      );
    }
  }
}
