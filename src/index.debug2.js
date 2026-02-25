/**
 * Telegram 对话式转发机器人 - Enhanced V3
 * 
 * 新功能增强：
 * 1. Bot 邀请链接 + 群组快捷绑定（完全实现）
 * 2. 备份频道功能（自动双重转发）
 * 3. 媒体文件元数据记录（file_id 保存）
 */

// ==================== Telegram API 类 ====================

class TelegramAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = `https://api.telegram.org/bot${token}`;
    this.botUsername = null;
  }

  async getMe() {
    const result = await this.callAPI('getMe');
    if (result.ok) {
      this.botUsername = result.result.username;
    }
    return result;
  }

  async callAPI(method, params = {}) {
    try {
      const response = await fetch(`${this.baseURL}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      
      const result = await response.json();
      if (!result.ok) {
        console.error(`API call failed: ${method}`, result);
      }
      return result;
    } catch (error) {
      console.error(`API error: ${method}`, error);
      return { ok: false, error: error.message };
    }
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

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return this.callAPI('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    });
  }

  async forwardMessage(fromChatId, toChatId, messageId) {
    return this.callAPI('forwardMessage', {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId
    });
  }

  async copyMessage(fromChatId, toChatId, messageId, options = {}) {
    return this.callAPI('copyMessage', {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...options
    });
  }

  async deleteMessage(chatId, messageId) {
    return this.callAPI('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  async getChatMember(chatId, userId) {
    return this.callAPI('getChatMember', {
      chat_id: chatId,
      user_id: userId
    });
  }

  async getChat(chatId) {
    return this.callAPI('getChat', {
      chat_id: chatId
    });
  }

  async getChatAdministrators(chatId) {
    return this.callAPI('getChatAdministrators', {
      chat_id: chatId
    });
  }

  // 生成 Bot 邀请链接（可选指定 repo_id）
  generateInviteLink(repoId = null) {
    if (!this.botUsername) {
      return null;
    }
    
    if (repoId) {
      // 带参数的邀请链接：用户点击后会传递 start 参数
      return `https://t.me/${this.botUsername}?startgroup=${repoId}`;
    }
    
    // 通用邀请链接
    return `https://t.me/${this.botUsername}?startgroup=general`;
  }
}

// ==================== 数据库管理类 ====================

class Database {
  constructor(db) {
    this.db = db;
  }

  async initTables() {
    try {
      // 用户状态表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS user_states (
          user_id INTEGER PRIMARY KEY,
          mode TEXT DEFAULT 'idle',
          current_repo TEXT,
          setup_step TEXT,
          setup_data TEXT,
          message_count INTEGER DEFAULT 0,
          updated_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )
      `).run();

      // 视频库表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forward_repositories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_by INTEGER NOT NULL,
          backup_channel_id INTEGER,           -- 新增：备份频道 ID
          backup_enabled INTEGER DEFAULT 1,    -- 新增：备份功能开关
          created_at INTEGER NOT NULL,
          updated_at INTEGER
        )
      `).run();

      // 转发目标表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forward_targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id INTEGER NOT NULL,
          target_chat_id INTEGER NOT NULL,
          target_type TEXT CHECK(target_type IN ('channel', 'group', 'private')),
          target_title TEXT,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL,
          UNIQUE(repo_id, target_chat_id),
          FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
        )
      `).run();

      // 权限表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forward_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT CHECK(role IN ('admin', 'contributor', 'viewer')) DEFAULT 'contributor',
          granted_by INTEGER NOT NULL,
          granted_at INTEGER NOT NULL,
          UNIQUE(repo_id, user_id),
          FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
        )
      `).run();

      // 转发消息记录表（增强版，记录 file_id）
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forwarded_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id INTEGER NOT NULL,
          source_user_id INTEGER NOT NULL,
          source_message_id INTEGER,
          message_type TEXT,
          media_file_id TEXT,                  -- 新增：Telegram file_id
          media_file_unique_id TEXT,           -- 新增：Telegram file_unique_id
          media_mime_type TEXT,                -- 新增：MIME 类型
          media_file_size INTEGER,             -- 新增：文件大小
          caption TEXT,                        -- 新增：媒体标题
          forwarded_to TEXT,                   -- JSON 数组
          backup_message_id INTEGER,           -- 新增：备份频道中的消息 ID
          forwarded_at INTEGER NOT NULL,
          metadata TEXT,
          FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
        )
      `).run();

      // 待绑定群组表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS pending_group_bindings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id INTEGER NOT NULL,
          chat_type TEXT NOT NULL,
          chat_title TEXT,
          repo_id INTEGER,
          added_by INTEGER NOT NULL,
          start_param TEXT,                    -- 新增：/start 参数
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          UNIQUE(chat_id)
        )
      `).run();

      // 创建索引
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_user_states_mode ON user_states(mode)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_forward_targets_repo ON forward_targets(repo_id)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_forward_permissions_repo ON forward_permissions(repo_id)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_forwarded_messages_repo ON forwarded_messages(repo_id)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_forwarded_messages_file_id ON forwarded_messages(media_file_id)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_pending_bindings_expires ON pending_group_bindings(expires_at)').run();

      console.log('✅ Database tables initialized');
    } catch (error) {
      console.error('❌ Database init error:', error);
    }
  }

  // ========== 用户状态管理 ==========

  async getUserState(userId) {
    try {
      const result = await this.db
        .prepare('SELECT * FROM user_states WHERE user_id = ?')
        .bind(userId)
        .first();
      
      if (result && result.setup_data) {
        result.setup_data = JSON.parse(result.setup_data);
      }
      
      return result;
    } catch (error) {
      console.error('getUserState error:', error);
      return null;
    }
  }

  async setUserState(userId, state) {
    try {
      const now = Date.now();
      const existing = await this.getUserState(userId);
      
      const setupData = state.setup_data ? JSON.stringify(state.setup_data) : null;
      
      if (existing) {
        await this.db
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
            setupData,
            state.message_count || 0,
            now,
            userId
          )
          .run();
      } else {
        await this.db
          .prepare(`
            INSERT INTO user_states (user_id, mode, current_repo, setup_step, setup_data, message_count, updated_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            userId,
            state.mode || 'idle',
            state.current_repo || null,
            state.setup_step || null,
            setupData,
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

  async clearUserState(userId) {
    await this.db
      .prepare('DELETE FROM user_states WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  // ========== 视频库管理 ==========

  async createRepository(name, description, createdBy) {
    const now = Date.now();
    try {
      const result = await this.db
        .prepare(`
          INSERT INTO forward_repositories (name, description, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(name, description, createdBy, now, now)
        .run();
      
      return { success: true, id: result.meta.last_row_id };
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE')) {
        return { success: false, error: 'repository_exists' };
      }
      throw error;
    }
  }

  async getRepository(name) {
    return await this.db
      .prepare('SELECT * FROM forward_repositories WHERE name = ?')
      .bind(name)
      .first();
  }

  async getRepositoryById(id) {
    return await this.db
      .prepare('SELECT * FROM forward_repositories WHERE id = ?')
      .bind(id)
      .first();
  }

  async listRepositories(userId = null) {
    if (userId) {
      const result = await this.db
        .prepare(`
          SELECT DISTINCT r.* FROM forward_repositories r
          LEFT JOIN forward_permissions p ON r.id = p.repo_id
          WHERE r.created_by = ? OR p.user_id = ?
          ORDER BY r.created_at DESC
        `)
        .bind(userId, userId)
        .all();
      return result.results || [];
    }
    
    const result = await this.db
      .prepare('SELECT * FROM forward_repositories ORDER BY created_at DESC')
      .all();
    return result.results || [];
  }

  async deleteRepository(name) {
    await this.db
      .prepare('DELETE FROM forward_repositories WHERE name = ?')
      .bind(name)
      .run();
  }

  async updateRepository(id, data) {
    const updates = [];
    const bindings = [];
    
    if (data.description !== undefined) {
      updates.push('description = ?');
      bindings.push(data.description);
    }
    
    if (data.backup_channel_id !== undefined) {
      updates.push('backup_channel_id = ?');
      bindings.push(data.backup_channel_id);
    }
    
    if (data.backup_enabled !== undefined) {
      updates.push('backup_enabled = ?');
      bindings.push(data.backup_enabled ? 1 : 0);
    }
    
    if (updates.length === 0) return;
    
    updates.push('updated_at = ?');
    bindings.push(Date.now());
    bindings.push(id);
    
    await this.db
      .prepare(`UPDATE forward_repositories SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  // ========== 转发目标管理 ==========

  async addForwardTarget(repoId, targetChatId, targetType, targetTitle = null) {
    const now = Date.now();
    try {
      await this.db
        .prepare(`
          INSERT INTO forward_targets (repo_id, target_chat_id, target_type, target_title, enabled, created_at)
          VALUES (?, ?, ?, ?, 1, ?)
        `)
        .bind(repoId, targetChatId, targetType, targetTitle, now)
        .run();
      return { success: true };
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE')) {
        return { success: false, error: 'target_exists' };
      }
      throw error;
    }
  }

  async removeForwardTarget(repoId, targetChatId) {
    await this.db
      .prepare('DELETE FROM forward_targets WHERE repo_id = ? AND target_chat_id = ?')
      .bind(repoId, targetChatId)
      .run();
  }

  async listForwardTargets(repoId) {
    const result = await this.db
      .prepare('SELECT * FROM forward_targets WHERE repo_id = ? ORDER BY created_at')
      .bind(repoId)
      .all();
    return result.results || [];
  }

  async toggleForwardTarget(repoId, targetChatId) {
    await this.db
      .prepare(`
        UPDATE forward_targets 
        SET enabled = 1 - enabled 
        WHERE repo_id = ? AND target_chat_id = ?
      `)
      .bind(repoId, targetChatId)
      .run();
  }

  // ========== 权限管理 ==========

  async checkPermission(repoId, userId, requiredRole = 'contributor') {
    const repo = await this.getRepositoryById(repoId);
    if (!repo) return false;
    
    // 创建者默认是 admin
    if (repo.created_by === userId) return true;
    
    const perm = await this.db
      .prepare('SELECT role FROM forward_permissions WHERE repo_id = ? AND user_id = ?')
      .bind(repoId, userId)
      .first();
    
    if (!perm) return false;
    
    const roleLevel = { viewer: 1, contributor: 2, admin: 3 };
    const userLevel = roleLevel[perm.role] || 0;
    const requiredLevel = roleLevel[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  }

  async grantPermission(repoId, userId, role, grantedBy) {
    const now = Date.now();
    
    try {
      await this.db
        .prepare(`
          INSERT INTO forward_permissions (repo_id, user_id, role, granted_by, granted_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(repo_id, user_id) 
          DO UPDATE SET role = ?, granted_by = ?, granted_at = ?
        `)
        .bind(repoId, userId, role, grantedBy, now, role, grantedBy, now)
        .run();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== 消息记录 ==========

  async logForwardedMessage(data) {
    const {
      repo_id,
      source_user_id,
      source_message_id,
      message_type,
      media_file_id,
      media_file_unique_id,
      media_mime_type,
      media_file_size,
      caption,
      forwarded_to,
      backup_message_id,
      metadata
    } = data;
    
    const now = Date.now();
    
    await this.db
      .prepare(`
        INSERT INTO forwarded_messages 
        (repo_id, source_user_id, source_message_id, message_type, 
         media_file_id, media_file_unique_id, media_mime_type, media_file_size, caption,
         forwarded_to, backup_message_id, forwarded_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        repo_id,
        source_user_id,
        source_message_id,
        message_type,
        media_file_id || null,
        media_file_unique_id || null,
        media_mime_type || null,
        media_file_size || null,
        caption || null,
        JSON.stringify(forwarded_to),
        backup_message_id || null,
        now,
        JSON.stringify(metadata || {})
      )
      .run();
  }

  async getForwardedStats(repoId, period = 'all') {
    let dateFilter = '';
    const now = Date.now();
    
    if (period === 'today') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      dateFilter = `AND forwarded_at >= ${todayStart}`;
    } else if (period === 'week') {
      const weekStart = now - 7 * 24 * 60 * 60 * 1000;
      dateFilter = `AND forwarded_at >= ${weekStart}`;
    }

    const total = await this.db
      .prepare(`SELECT COUNT(*) as count FROM forwarded_messages WHERE repo_id = ? ${dateFilter}`)
      .bind(repoId)
      .first();

    const byType = await this.db
      .prepare(`
        SELECT message_type, COUNT(*) as count 
        FROM forwarded_messages 
        WHERE repo_id = ? ${dateFilter}
        GROUP BY message_type
      `)
      .bind(repoId)
      .all();

    return {
      total: total?.count || 0,
      byType: byType.results || []
    };
  }

  // ========== 待绑定群组管理 ==========

  async createPendingBinding(chatId, chatType, chatTitle, addedBy, startParam = null) {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24小时后过期
    
    try {
      await this.db
        .prepare(`
          INSERT INTO pending_group_bindings 
          (chat_id, chat_type, chat_title, added_by, start_param, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(chat_id) 
          DO UPDATE SET chat_title = ?, added_by = ?, start_param = ?, created_at = ?, expires_at = ?
        `)
        .bind(chatId, chatType, chatTitle, addedBy, startParam, now, expiresAt,
              chatTitle, addedBy, startParam, now, expiresAt)
        .run();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPendingBinding(chatId) {
    return await this.db
      .prepare('SELECT * FROM pending_group_bindings WHERE chat_id = ?')
      .bind(chatId)
      .first();
  }

  async bindPendingGroup(chatId, repoId) {
    await this.db
      .prepare('UPDATE pending_group_bindings SET repo_id = ? WHERE chat_id = ?')
      .bind(repoId, chatId)
      .run();
  }

  async deletePendingBinding(chatId) {
    await this.db
      .prepare('DELETE FROM pending_group_bindings WHERE chat_id = ?')
      .bind(chatId)
      .run();
  }

  async cleanupExpiredBindings() {
    const now = Date.now();
    await this.db
      .prepare('DELETE FROM pending_group_bindings WHERE expires_at < ?')
      .bind(now)
      .run();
  }
}

// ==================== 转发处理器 ====================

class ForwardingHandler {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
  }

  /**
   * 处理转发消息（包含备份逻辑）
   */
  async forwardMessage(message, repo) {
    const userId = message.from.id;
    const messageId = message.message_id;
    const chatId = userId; // 来自私聊
    
    // 获取转发目标
    const targets = await this.db.listForwardTargets(repo.id);
    const enabledTargets = targets.filter(t => t.enabled);
    
    if (enabledTargets.length === 0 && !repo.backup_channel_id) {
      await this.bot.sendMessage(chatId, '❌ 没有可用的转发目标或备份频道');
      return { success: false };
    }

    const results = [];
    const forwardedTo = [];
    let backupMessageId = null;

    // 1. 先转发到备份频道（如果启用）
    if (repo.backup_channel_id && repo.backup_enabled) {
      try {
        const backupResult = await this.bot.copyMessage(chatId, repo.backup_channel_id, messageId);
        if (backupResult.ok) {
          backupMessageId = backupResult.result.message_id;
          console.log(`✅ Backed up to ${repo.backup_channel_id}: message ${backupMessageId}`);
        }
      } catch (error) {
        console.error('Backup failed:', error);
      }
    }

    // 2. 转发到所有目标
    for (const target of enabledTargets) {
      try {
        const result = await this.bot.copyMessage(chatId, target.target_chat_id, messageId);
        
        if (result.ok) {
          results.push({ target: target.target_chat_id, success: true, messageId: result.result.message_id });
          forwardedTo.push(target.target_chat_id);
        } else {
          results.push({ target: target.target_chat_id, success: false, error: result.description });
        }
      } catch (error) {
        console.error(`Forward to ${target.target_chat_id} failed:`, error);
        results.push({ target: target.target_chat_id, success: false, error: error.message });
      }
    }

    // 3. 提取媒体元数据
    const mediaData = this.extractMediaMetadata(message);

    // 4. 记录到数据库
    await this.db.logForwardedMessage({
      repo_id: repo.id,
      source_user_id: userId,
      source_message_id: messageId,
      message_type: mediaData.type,
      media_file_id: mediaData.file_id,
      media_file_unique_id: mediaData.file_unique_id,
      media_mime_type: mediaData.mime_type,
      media_file_size: mediaData.file_size,
      caption: message.caption || null,
      forwarded_to: forwardedTo,
      backup_message_id: backupMessageId,
      metadata: { results }
    });

    return { success: true, results, backupMessageId };
  }

  /**
   * 提取消息中的媒体元数据
   */
  extractMediaMetadata(message) {
    const types = ['photo', 'video', 'document', 'audio', 'voice', 'video_note', 'animation'];
    
    for (const type of types) {
      if (message[type]) {
        const media = Array.isArray(message[type]) ? message[type][message[type].length - 1] : message[type];
        
        return {
          type,
          file_id: media.file_id,
          file_unique_id: media.file_unique_id,
          mime_type: media.mime_type || null,
          file_size: media.file_size || null
        };
      }
    }
    
    return { type: 'text', file_id: null, file_unique_id: null, mime_type: null, file_size: null };
  }
}

// ==================== 主 Worker 类 ====================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Setup endpoint
    if (url.pathname === '/setup') {
      return new Response('Setup your webhook at /webhook', { status: 200 });
    }

    // Webhook endpoint
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        console.log('[DEBUG] 1. Webhook received');
        const update = await request.json();
        console.log('[DEBUG] 2. Update parsed:', update.update_id);
        
        console.log('[DEBUG] 3. Creating TelegramAPI...');
        const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
        console.log('[DEBUG] 4. Creating Database...');
        const db = new Database(env.DB);
        console.log('[DEBUG] 5. Creating ForwardingHandler...');
        const handler = new ForwardingHandler(bot, db);
        console.log('[DEBUG] 6. All instances created');
        
        // 初始化数据库
        console.log('[DEBUG] 7. Initializing tables...');
        await db.initTables();
        console.log('[DEBUG] 8. Tables initialized');
        
        // 获取 Bot 信息
        console.log('[DEBUG] 9. Getting bot info...');
        await bot.getMe();
        console.log('[DEBUG] 10. Bot info retrieved');
        
        // 清理过期的待绑定记录
        console.log('[DEBUG] 11. Cleaning up bindings...');
        await db.cleanupExpiredBindings();
        console.log('[DEBUG] 12. Cleanup done');
        
        // 处理更新
        console.log('[DEBUG] 13. Handling update...');
        await handleUpdate(update, bot, db, handler);
        console.log('[DEBUG] 14. Update handled');
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('[DEBUG] ERROR caught:', error);
        // 返回详细错误信息（仅用于调试）
        const errorDetails = {
          error: error.message,
          stack: error.stack.substring(0, 500),
          name: error.name
        };
        // 发送错误到 Telegram（调试用）
        try {
          const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
          const logMsg = `❌ Bot Error:\n\nError: ${errorDetails.error}\n\nName: ${errorDetails.name}\n\nStack:\n${errorDetails.stack}`;
          await bot.sendMessage(6938405510, logMsg);
        } catch (e) {
          console.error('[DEBUG] Failed to send error message:', e);
        }
        return new Response(JSON.stringify(errorDetails), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ==================== 更新处理 ====================

async function handleUpdate(update, bot, db, handler) {
  // 处理消息
  if (update.message) {
    await handleMessage(update.message, bot, db, handler);
  }
  
  // 处理回调查询
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, bot, db, handler);
  }
  
  // 处理 Bot 被添加到群组
  if (update.my_chat_member) {
    await handleMyChatMember(update.my_chat_member, bot, db);
  }
}

// ==================== 消息处理 ====================

async function handleMessage(message, bot, db, handler) {
  const userId = message.from?.id;
  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const isPrivate = chatType === 'private';
  
  if (!userId) return;

  // 处理 /start 命令
  if (message.text && message.text.startsWith('/start')) {
    const parts = message.text.split(' ');
    const startParam = parts[1] || null; // 可能包含 repo_id
    
    if (isPrivate) {
      await handleStartCommand(userId, chatId, startParam, bot, db);
    } else {
      // 群组中的 /start（Bot 刚被添加）
      await handleGroupStart(message, startParam, bot, db);
    }
    return;
  }

  // 处理群组中的 /bind 命令
  if (!isPrivate && message.text && message.text.startsWith('/bind')) {
    await handleBindCommand(message, bot, db);
    return;
  }

  // 处理私聊中的普通消息（转发逻辑）
  if (isPrivate) {
    await handlePrivateMessage(message, bot, db, handler);
  }
}

// ==================== /start 命令处理 ====================

async function handleStartCommand(userId, chatId, startParam, bot, db) {
  // 清除用户状态
  await db.clearUserState(userId);
  
  // 获取用户的视频库列表
  const repos = await db.listRepositories(userId);
  
  let text = '👋 <b>欢迎使用内容转发助手！</b>\n\n';
  text += '🎯 <b>功能特性</b>\n';
  text += '• 一键转发到多个频道/群组\n';
  text += '• 自动备份到私有频道\n';
  text += '• 媒体文件元数据记录\n';
  text += '• 群组快捷绑定\n\n';
  
  if (repos.length > 0) {
    text += '📦 <b>你的视频库</b>\n';
    repos.forEach(repo => {
      text += `• ${repo.name}\n`;
    });
    text += '\n';
  }
  
  const keyboard = {
    inline_keyboard: []
  };
  
  if (repos.length > 0) {
    keyboard.inline_keyboard.push([
      { text: '📦 管理视频库', callback_data: 'manage_repos' }
    ]);
  }
  
  keyboard.inline_keyboard.push([
    { text: '➕ 创建新视频库', callback_data: 'create_repo' }
  ]);
  
  keyboard.inline_keyboard.push([
    { text: '❓ 帮助', callback_data: 'help' }
  ]);
  
  await bot.sendMessage(chatId, text, { reply_markup: keyboard });
}

// ==================== 群组 /start 处理 ====================

async function handleGroupStart(message, startParam, bot, db) {
  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const chatTitle = message.chat.title || 'Unknown';
  const userId = message.from.id;
  
  // 记录待绑定群组
  await db.createPendingBinding(chatId, chatType, chatTitle, userId, startParam);
  
  let text = `👋 你好！我已经加入了 <b>${chatTitle}</b>\n\n`;
  text += '🔗 <b>快速绑定</b>\n';
  text += '要将此群组添加为转发目标，请：\n\n';
  text += '1️⃣ 私聊我发送 /start\n';
  text += '2️⃣ 选择或创建视频库\n';
  text += '3️⃣ 返回这里发送：\n';
  text += '<code>/bind 视频库名称</code>\n\n';
  
  // 如果有 startParam，可能已经关联了某个 repo
  if (startParam && startParam !== 'general') {
    const repo = await db.getRepositoryById(parseInt(startParam));
    if (repo) {
      text += `💡 <b>提示</b>\n`;
      text += `此群组可绑定到：<b>${repo.name}</b>\n`;
      text += `使用命令：<code>/bind ${repo.name}</code>`;
    }
  }
  
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

// ==================== /bind 命令处理 ====================

async function handleBindCommand(message, bot, db) {
  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const chatTitle = message.chat.title || 'Unknown';
  const userId = message.from.id;
  const text = message.text;
  
  // 检查是否在群组/频道中
  if (chatType === 'private') {
    await bot.sendMessage(chatId, '❌ /bind 命令只能在群组或频道中使用');
    return;
  }
  
  // 解析命令参数
  const parts = text.split(' ');
  if (parts.length < 2) {
    await bot.sendMessage(chatId, '❌ 用法：<code>/bind 视频库名称</code>', { parse_mode: 'HTML' });
    return;
  }
  
  const repoName = parts.slice(1).join(' ');
  
  // 查找视频库
  const repo = await db.getRepository(repoName);
  if (!repo) {
    await bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在\n\n使用 /start 查看所有视频库`);
    return;
  }
  
  // 检查权限（只有创建者或管理员可以绑定）
  const hasPermission = await db.checkPermission(repo.id, userId, 'admin');
  if (!hasPermission) {
    await bot.sendMessage(chatId, `❌ 你没有权限绑定视频库 "${repoName}"`);
    return;
  }
  
  // 添加转发目标
  const targetType = chatType === 'channel' ? 'channel' : 'group';
  const result = await db.addForwardTarget(repo.id, chatId, targetType, chatTitle);
  
  if (!result.success) {
    if (result.error === 'target_exists') {
      await bot.sendMessage(chatId, `⚠️ 此${targetType === 'channel' ? '频道' : '群组'}已经绑定到 "${repoName}"`);
    } else {
      await bot.sendMessage(chatId, `❌ 绑定失败：${result.error}`);
    }
    return;
  }
  
  // 成功绑定
  let successText = `✅ <b>绑定成功！</b>\n\n`;
  successText += `📦 视频库：<b>${repo.name}</b>\n`;
  successText += `🎯 目标：<b>${chatTitle}</b>\n`;
  successText += `📝 类型：${targetType === 'channel' ? '频道' : '群组'}\n\n`;
  successText += `现在发送到 "${repo.name}" 的内容会自动转发到这里`;
  
  await bot.sendMessage(chatId, successText, { parse_mode: 'HTML' });
  
  // 删除待绑定记录
  await db.deletePendingBinding(chatId);
}

// ==================== 私聊消息处理 ====================

async function handlePrivateMessage(message, bot, db, handler) {
  const userId = message.from.id;
  const chatId = message.chat.id;
  
  // 获取用户状态
  const state = await db.getUserState(userId);
  
  if (!state || state.mode === 'idle') {
    await bot.sendMessage(chatId, '请先使用 /start 选择视频库');
    return;
  }
  
  // 创建视频库流程
  if (state.mode === 'creating_repo') {
    await handleCreatingRepo(message, state, bot, db);
    return;
  }
  
  // 转发模式
  if (state.mode === 'forwarding' && state.current_repo) {
    const repo = await db.getRepository(state.current_repo);
    if (!repo) {
      await bot.sendMessage(chatId, '❌ 视频库不存在');
      await db.clearUserState(userId);
      return;
    }
    
    // 执行转发
    const result = await handler.forwardMessage(message, repo);
    
    if (result.success) {
      const successCount = result.results.filter(r => r.success).length;
      const totalCount = result.results.length;
      
      let response = `✅ <b>转发成功</b>\n\n`;
      response += `📤 目标：${successCount}/${totalCount}\n`;
      
      if (result.backupMessageId) {
        response += `💾 已备份\n`;
      }
      
      response += `\n继续发送内容，或使用 /start 返回主菜单`;
      
      await bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    } else {
      await bot.sendMessage(chatId, '❌ 转发失败，请稍后重试');
    }
  }
}

// ==================== Bot 加入群组处理 ====================

async function handleMyChatMember(myChatMember, bot, db) {
  const chat = myChatMember.chat;
  const newStatus = myChatMember.new_chat_member.status;
  const oldStatus = myChatMember.old_chat_member.status;
  const userId = myChatMember.from.id;
  
  // Bot 被添加到群组/频道
  if ((oldStatus === 'left' || oldStatus === 'kicked') && 
      (newStatus === 'member' || newStatus === 'administrator')) {
    
    const chatId = chat.id;
    const chatType = chat.type;
    const chatTitle = chat.title || 'Unknown';
    
    console.log(`Bot added to ${chatType}: ${chatTitle} (${chatId})`);
    
    // 记录待绑定群组
    await db.createPendingBinding(chatId, chatType, chatTitle, userId);
    
    // 发送欢迎消息
    let text = `👋 你好！我已经加入了 <b>${chatTitle}</b>\n\n`;
    text += '🔗 <b>快速绑定</b>\n';
    text += `要将此${chatType === 'channel' ? '频道' : '群组'}添加为转发目标：\n\n`;
    text += '1️⃣ 私聊我发送 /start\n';
    text += '2️⃣ 创建或选择视频库\n';
    text += '3️⃣ 返回这里发送：\n';
    text += '<code>/bind 视频库名称</code>';
    
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }
}

// ==================== 回调查询处理 ====================

async function handleCallbackQuery(query, bot, db, handler) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.callback_data;
  
  await bot.answerCallbackQuery(query.id);
  
  if (data === 'manage_repos') {
    await showRepositoriesList(userId, chatId, messageId, bot, db);
  } else if (data === 'create_repo') {
    await startCreateRepo(userId, chatId, messageId, bot, db);
  } else if (data === 'help') {
    await showHelp(chatId, messageId, bot);
  } else if (data.startsWith('repo:')) {
    const repoName = data.substring(5);
    await showRepositoryMenu(repoName, userId, chatId, messageId, bot, db);
  } else if (data.startsWith('repo_forward:')) {
    const repoName = data.substring(13);
    await startForwarding(repoName, userId, chatId, messageId, bot, db);
  } else if (data.startsWith('repo_backup:')) {
    const repoName = data.substring(12);
    await showBackupSettings(repoName, userId, chatId, messageId, bot, db);
  } else if (data.startsWith('set_backup:')) {
    const repoName = data.substring(11);
    await promptBackupChannel(repoName, userId, chatId, messageId, bot, db);
  } else if (data.startsWith('repo_invite:')) {
    const repoName = data.substring(12);
    await showInviteLink(repoName, userId, chatId, messageId, bot, db);
  } else if (data === 'back_to_main') {
    await handleStartCommand(userId, chatId, null, bot, db);
  }
}

// ==================== 显示视频库列表 ====================

async function showRepositoriesList(userId, chatId, messageId, bot, db) {
  const repos = await db.listRepositories(userId);
  
  if (repos.length === 0) {
    await bot.editMessageText(chatId, messageId, 
      '📦 <b>你还没有视频库</b>\n\n点击下方按钮创建第一个视频库',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ 创建视频库', callback_data: 'create_repo' }],
            [{ text: '🔙 返回', callback_data: 'back_to_main' }]
          ]
        }
      }
    );
    return;
  }
  
  let text = '📦 <b>你的视频库</b>\n\n';
  text += '选择一个视频库进行管理：\n\n';
  
  const keyboard = {
    inline_keyboard: []
  };
  
  repos.forEach(repo => {
    keyboard.inline_keyboard.push([
      { text: `📁 ${repo.name}`, callback_data: `repo:${repo.name}` }
    ]);
  });
  
  keyboard.inline_keyboard.push([
    { text: '➕ 创建新视频库', callback_data: 'create_repo' }
  ]);
  
  keyboard.inline_keyboard.push([
    { text: '🔙 返回', callback_data: 'back_to_main' }
  ]);
  
  await bot.editMessageText(chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

// ==================== 显示视频库菜单 ====================

async function showRepositoryMenu(repoName, userId, chatId, messageId, bot, db) {
  const repo = await db.getRepository(repoName);
  if (!repo) {
    await bot.editMessageText(chatId, messageId, '❌ 视频库不存在');
    return;
  }
  
  const targets = await db.listForwardTargets(repo.id);
  const stats = await db.getForwardedStats(repo.id, 'all');
  
  let text = `📦 <b>${repo.name}</b>\n\n`;
  
  if (repo.description) {
    text += `📝 ${repo.description}\n\n`;
  }
  
  text += `🎯 转发目标：${targets.length} 个\n`;
  text += `📊 已转发：${stats.total} 条\n`;
  
  if (repo.backup_channel_id) {
    text += `💾 备份频道：已设置 ${repo.backup_enabled ? '✅' : '⏸'}\n`;
  } else {
    text += `💾 备份频道：未设置\n`;
  }
  
  text += `\n📍 <b>Chat ID:</b> <code>${repo.id}</code>`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🚀 开始转发', callback_data: `repo_forward:${repoName}` }
      ],
      [
        { text: '💾 备份设置', callback_data: `repo_backup:${repoName}` },
        { text: '🔗 邀请链接', callback_data: `repo_invite:${repoName}` }
      ],
      [
        { text: '🔙 返回列表', callback_data: 'manage_repos' }
      ]
    ]
  };
  
  await bot.editMessageText(chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

// ==================== 显示邀请链接 ====================

async function showInviteLink(repoName, userId, chatId, messageId, bot, db) {
  const repo = await db.getRepository(repoName);
  if (!repo) {
    await bot.editMessageText(chatId, messageId, '❌ 视频库不存在');
    return;
  }
  
  const inviteLink = bot.generateInviteLink(repo.id);
  
  let text = `🔗 <b>Bot 邀请链接</b>\n\n`;
  text += `📦 视频库：<b>${repo.name}</b>\n\n`;
  text += `📋 <b>使用方法</b>\n\n`;
  text += `<b>方式一：直接邀请</b>\n`;
  text += `1. 点击下方链接\n`;
  text += `2. 选择要添加 Bot 的群组\n`;
  text += `3. 在群组中发送：<code>/bind ${repoName}</code>\n\n`;
  text += `🔗 <b>邀请链接：</b>\n`;
  text += `<code>${inviteLink}</code>\n\n`;
  text += `<b>方式二：群组内绑定</b>\n`;
  text += `如果 Bot 已在群组中，直接发送：\n`;
  text += `<code>/bind ${repoName}</code>`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📋 复制链接', url: inviteLink }
      ],
      [
        { text: '🔙 返回', callback_data: `repo:${repoName}` }
      ]
    ]
  };
  
  await bot.editMessageText(chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
    disable_web_page_preview: true
  });
}

// ==================== 显示备份设置 ====================

async function showBackupSettings(repoName, userId, chatId, messageId, bot, db) {
  const repo = await db.getRepository(repoName);
  if (!repo) {
    await bot.editMessageText(chatId, messageId, '❌ 视频库不存在');
    return;
  }
  
  let text = `💾 <b>备份频道设置</b>\n\n`;
  text += `📦 视频库：<b>${repo.name}</b>\n\n`;
  
  if (repo.backup_channel_id) {
    text += `✅ 备份频道：<code>${repo.backup_channel_id}</code>\n`;
    text += `状态：${repo.backup_enabled ? '✅ 已启用' : '⏸ 已暂停'}\n\n`;
    text += `<b>功能说明</b>\n`;
    text += `• 所有消息自动备份到此频道\n`;
    text += `• 媒体文件 file_id 已记录\n`;
    text += `• 可用于数据恢复和导出`;
  } else {
    text += `❌ 未设置备份频道\n\n`;
    text += `<b>备份频道优势</b>\n`;
    text += `• 双重保险，数据不丢失\n`;
    text += `• 可设置私有频道\n`;
    text += `• 支持随时导出和迁移\n`;
    text += `• 记录完整媒体元数据\n\n`;
    text += `点击下方按钮设置备份频道`;
  }
  
  const keyboard = {
    inline_keyboard: []
  };
  
  if (repo.backup_channel_id) {
    keyboard.inline_keyboard.push([
      { text: repo.backup_enabled ? '⏸ 暂停备份' : '▶️ 启用备份', callback_data: `toggle_backup:${repoName}` }
    ]);
    keyboard.inline_keyboard.push([
      { text: '🔄 更换频道', callback_data: `set_backup:${repoName}` }
    ]);
  } else {
    keyboard.inline_keyboard.push([
      { text: '➕ 设置备份频道', callback_data: `set_backup:${repoName}` }
    ]);
  }
  
  keyboard.inline_keyboard.push([
    { text: '🔙 返回', callback_data: `repo:${repoName}` }
  ]);
  
  await bot.editMessageText(chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

// ==================== 开始转发 ====================

async function startForwarding(repoName, userId, chatId, messageId, bot, db) {
  const repo = await db.getRepository(repoName);
  if (!repo) {
    await bot.editMessageText(chatId, messageId, '❌ 视频库不存在');
    return;
  }
  
  const targets = await db.listForwardTargets(repo.id);
  const enabledTargets = targets.filter(t => t.enabled);
  
  if (enabledTargets.length === 0 && !repo.backup_channel_id) {
    await bot.editMessageText(chatId, messageId, 
      `❌ 视频库 "${repoName}" 还没有设置转发目标或备份频道\n\n请先添加目标`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 返回', callback_data: `repo:${repoName}` }]
          ]
        }
      }
    );
    return;
  }
  
  // 设置用户状态为转发模式
  await db.setUserState(userId, {
    mode: 'forwarding',
    current_repo: repoName
  });
  
  let text = `🚀 <b>转发模式已启动</b>\n\n`;
  text += `📦 当前视频库：<b>${repo.name}</b>\n\n`;
  text += `🎯 转发目标：${enabledTargets.length} 个\n`;
  
  if (repo.backup_channel_id && repo.backup_enabled) {
    text += `💾 备份：已启用\n`;
  }
  
  text += `\n现在发送任何内容，我会自动转发到目标频道/群组\n\n`;
  text += `使用 /start 返回主菜单`;
  
  await bot.editMessageText(chatId, messageId, text, { parse_mode: 'HTML' });
}

// ==================== 创建视频库流程 ====================

async function startCreateRepo(userId, chatId, messageId, bot, db) {
  await db.setUserState(userId, {
    mode: 'creating_repo',
    setup_step: 'name'
  });
  
  await bot.editMessageText(chatId, messageId,
    '➕ <b>创建新视频库</b>\n\n请输入视频库名称（例如：travel_videos）',
    { parse_mode: 'HTML' }
  );
}

async function handleCreatingRepo(message, state, bot, db) {
  const userId = message.from.id;
  const chatId = message.chat.id;
  const text = message.text;
  
  if (state.setup_step === 'name') {
    const repoName = text.trim();
    
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(repoName)) {
      await bot.sendMessage(chatId, '❌ 名称只能包含字母、数字和下划线，长度 3-30 个字符');
      return;
    }
    
    const existing = await db.getRepository(repoName);
    if (existing) {
      await bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 已存在，请使用其他名称`);
      return;
    }
    
    // 保存名称，进入描述步骤
    await db.setUserState(userId, {
      mode: 'creating_repo',
      setup_step: 'description',
      setup_data: { name: repoName }
    });
    
    await bot.sendMessage(chatId, 
      `✅ 名称：<b>${repoName}</b>\n\n现在输入视频库描述（或发送 /skip 跳过）`,
      { parse_mode: 'HTML' }
    );
  } else if (state.setup_step === 'description') {
    const description = text === '/skip' ? null : text.trim();
    const repoName = state.setup_data.name;
    
    // 创建视频库
    const result = await db.createRepository(repoName, description, userId);
    
    if (!result.success) {
      await bot.sendMessage(chatId, `❌ 创建失败：${result.error}`);
      await db.clearUserState(userId);
      return;
    }
    
    await db.clearUserState(userId);
    
    let successText = `✅ <b>视频库创建成功！</b>\n\n`;
    successText += `📦 名称：<b>${repoName}</b>\n`;
    if (description) {
      successText += `📝 描述：${description}\n`;
    }
    successText += `\n使用 /start 开始管理`;
    
    await bot.sendMessage(chatId, successText, { parse_mode: 'HTML' });
  }
}

// ==================== 帮助信息 ====================

async function showHelp(chatId, messageId, bot) {
  let text = `❓ <b>使用帮助</b>\n\n`;
  text += `<b>📦 视频库</b>\n`;
  text += `视频库是内容的容器，可以设置多个转发目标和备份频道\n\n`;
  text += `<b>🎯 转发目标</b>\n`;
  text += `群组或频道，用于接收转发的内容\n\n`;
  text += `<b>💾 备份频道</b>\n`;
  text += `私有频道，自动保存所有内容副本，支持数据恢复\n\n`;
  text += `<b>🚀 快速开始</b>\n`;
  text += `1. 创建视频库\n`;
  text += `2. 设置备份频道（推荐）\n`;
  text += `3. 添加转发目标（使用邀请链接或 /bind）\n`;
  text += `4. 开始转发内容\n\n`;
  text += `<b>🔗 群组绑定</b>\n`;
  text += `• 方式一：使用 Bot 邀请链接\n`;
  text += `• 方式二：在群组中发送 <code>/bind 视频库名称</code>\n\n`;
  text += `<b>💡 提示</b>\n`;
  text += `• 备份频道可以是私有频道\n`;
  text += `• 所有媒体文件的 file_id 都会被记录\n`;
  text += `• 支持随时查看转发统计`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔙 返回', callback_data: 'back_to_main' }]
    ]
  };
  
  await bot.editMessageText(chatId, messageId, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}
