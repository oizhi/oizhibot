/**
 * Telegram 对话式转发机器人 - 完整集成版本
 * 
 * 功能：
 * - 对话式视频库管理
 * - 自动转发到多个目标
 * - 权限管理
 * - 统计分析
 */

// ==================== Telegram API 类 ====================

class TelegramAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = `https://api.telegram.org/bot${token}`;
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
}

// ==================== 数据库操作类 ====================

class Database {
  constructor(db) {
    this.db = db;
  }

  // 初始化数据库
  async initTables() {
    try {
      // 用户状态表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS user_states (
          user_id INTEGER PRIMARY KEY,
          mode TEXT NOT NULL DEFAULT 'idle',
          current_repo TEXT,
          setup_step TEXT,
          setup_data TEXT,
          message_count INTEGER DEFAULT 0,
          updated_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )
      `).run();

      // 转发存储库表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forward_repositories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_by INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `).run();

      // 转发目标表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forward_targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id INTEGER NOT NULL,
          target_chat_id INTEGER NOT NULL,
          target_type TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
        )
      `).run();

      // 转发权限表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forward_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          granted_by INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE,
          UNIQUE(repo_id, user_id)
        )
      `).run();

      // 转发记录表
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS forwarded_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id INTEGER NOT NULL,
          original_chat_id INTEGER NOT NULL,
          original_message_id INTEGER NOT NULL,
          target_chat_id INTEGER NOT NULL,
          target_message_id INTEGER,
          forwarded_by INTEGER NOT NULL,
          forwarded_at INTEGER NOT NULL,
          FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
        )
      `).run();

      // 创建索引
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_user_states_mode ON user_states(mode)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_forward_targets_repo ON forward_targets(repo_id)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_forward_permissions_repo ON forward_permissions(repo_id)').run();
      await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_forwarded_messages_repo ON forwarded_messages(repo_id)').run();

      console.log('Database tables initialized');
    } catch (error) {
      console.error('Database init error:', error);
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
    await this.setUserState(userId, {
      mode: 'idle',
      current_repo: null,
      setup_step: null,
      setup_data: null,
      message_count: 0
    });
  }

  // ========== 转发存储库管理 ==========

  async createRepository(name, description, createdBy) {
    try {
      const now = Date.now();
      const result = await this.db
        .prepare(`
          INSERT INTO forward_repositories (name, description, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(name, description, createdBy, now, now)
        .run();
      
      // 自动给创建者添加 admin 权限
      const repoId = result.meta.last_row_id;
      await this.grantPermission(repoId, createdBy, 'admin', createdBy);
      
      return { success: true, id: repoId };
    } catch (error) {
      console.error('createRepository error:', error);
      return { success: false, error: error.message };
    }
  }

  async getRepository(name) {
    try {
      return await this.db
        .prepare('SELECT * FROM forward_repositories WHERE name = ?')
        .bind(name)
        .first();
    } catch (error) {
      console.error('getRepository error:', error);
      return null;
    }
  }

  async listRepositories(userId) {
    try {
      // 获取用户有权限的所有存储库
      const results = await this.db
        .prepare(`
          SELECT DISTINCT r.* 
          FROM forward_repositories r
          LEFT JOIN forward_permissions p ON r.id = p.repo_id
          WHERE r.created_by = ? OR p.user_id = ?
          ORDER BY r.updated_at DESC
        `)
        .bind(userId, userId)
        .all();
      
      return results.results || [];
    } catch (error) {
      console.error('listRepositories error:', error);
      return [];
    }
  }

  async updateRepository(name, updates) {
    try {
      const now = Date.now();
      const sets = [];
      const bindings = [];
      
      if (updates.description !== undefined) {
        sets.push('description = ?');
        bindings.push(updates.description);
      }
      
      if (sets.length === 0) return { success: true };
      
      sets.push('updated_at = ?');
      bindings.push(now);
      bindings.push(name);
      
      await this.db
        .prepare(`UPDATE forward_repositories SET ${sets.join(', ')} WHERE name = ?`)
        .bind(...bindings)
        .run();
      
      return { success: true };
    } catch (error) {
      console.error('updateRepository error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteRepository(name) {
    try {
      await this.db
        .prepare('DELETE FROM forward_repositories WHERE name = ?')
        .bind(name)
        .run();
      
      return { success: true };
    } catch (error) {
      console.error('deleteRepository error:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== 转发目标管理 ==========

  async addTarget(repoId, targetChatId, targetType) {
    try {
      const now = Date.now();
      await this.db
        .prepare(`
          INSERT INTO forward_targets (repo_id, target_chat_id, target_type, created_at)
          VALUES (?, ?, ?, ?)
        `)
        .bind(repoId, targetChatId, targetType, now)
        .run();
      
      return { success: true };
    } catch (error) {
      console.error('addTarget error:', error);
      return { success: false, error: error.message };
    }
  }

  async listTargets(repoId) {
    try {
      const results = await this.db
        .prepare('SELECT * FROM forward_targets WHERE repo_id = ? ORDER BY created_at DESC')
        .bind(repoId)
        .all();
      
      return results.results || [];
    } catch (error) {
      console.error('listTargets error:', error);
      return [];
    }
  }

  async toggleTarget(targetId, enabled) {
    try {
      await this.db
        .prepare('UPDATE forward_targets SET enabled = ? WHERE id = ?')
        .bind(enabled ? 1 : 0, targetId)
        .run();
      
      return { success: true };
    } catch (error) {
      console.error('toggleTarget error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteTarget(targetId) {
    try {
      await this.db
        .prepare('DELETE FROM forward_targets WHERE id = ?')
        .bind(targetId)
        .run();
      
      return { success: true };
    } catch (error) {
      console.error('deleteTarget error:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== 权限管理 ==========

  async grantPermission(repoId, userId, role, grantedBy) {
    try {
      const now = Date.now();
      await this.db
        .prepare(`
          INSERT OR REPLACE INTO forward_permissions (repo_id, user_id, role, granted_by, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(repoId, userId, role, grantedBy, now)
        .run();
      
      return { success: true };
    } catch (error) {
      console.error('grantPermission error:', error);
      return { success: false, error: error.message };
    }
  }

  async checkPermission(repoId, userId, requiredRole) {
    try {
      // 检查是否是创建者
      const repo = await this.db
        .prepare('SELECT created_by FROM forward_repositories WHERE id = ?')
        .bind(repoId)
        .first();
      
      if (repo && repo.created_by === userId) {
        return true; // 创建者拥有所有权限
      }
      
      // 检查权限表
      const perm = await this.db
        .prepare('SELECT role FROM forward_permissions WHERE repo_id = ? AND user_id = ?')
        .bind(repoId, userId)
        .first();
      
      if (!perm) return false;
      
      // 权限等级：admin > contributor > viewer
      const roles = ['viewer', 'contributor', 'admin'];
      const userRoleLevel = roles.indexOf(perm.role);
      const requiredRoleLevel = roles.indexOf(requiredRole);
      
      return userRoleLevel >= requiredRoleLevel;
    } catch (error) {
      console.error('checkPermission error:', error);
      return false;
    }
  }

  async listPermissions(repoId) {
    try {
      const results = await this.db
        .prepare('SELECT * FROM forward_permissions WHERE repo_id = ? ORDER BY created_at DESC')
        .bind(repoId)
        .all();
      
      return results.results || [];
    } catch (error) {
      console.error('listPermissions error:', error);
      return [];
    }
  }

  async revokePermission(repoId, userId) {
    try {
      await this.db
        .prepare('DELETE FROM forward_permissions WHERE repo_id = ? AND user_id = ?')
        .bind(repoId, userId)
        .run();
      
      return { success: true };
    } catch (error) {
      console.error('revokePermission error:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== 转发记录 ==========

  async logForward(repoId, originalChatId, originalMessageId, targetChatId, targetMessageId, forwardedBy) {
    try {
      const now = Date.now();
      await this.db
        .prepare(`
          INSERT INTO forwarded_messages 
          (repo_id, original_chat_id, original_message_id, target_chat_id, target_message_id, forwarded_by, forwarded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(repoId, originalChatId, originalMessageId, targetChatId, targetMessageId, forwardedBy, now)
        .run();
    } catch (error) {
      console.error('logForward error:', error);
    }
  }

  async getStats(repoId, period = null) {
    try {
      let query = 'SELECT COUNT(*) as total FROM forwarded_messages WHERE repo_id = ?';
      const bindings = [repoId];
      
      if (period === 'today') {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        query += ' AND forwarded_at >= ?';
        bindings.push(todayStart);
      } else if (period === 'week') {
        const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
        query += ' AND forwarded_at >= ?';
        bindings.push(weekStart);
      }
      
      const result = await this.db
        .prepare(query)
        .bind(...bindings)
        .first();
      
      return { total: result?.total || 0 };
    } catch (error) {
      console.error('getStats error:', error);
      return { total: 0 };
    }
  }
}

// ==================== 对话式处理器 ====================

class ConversationalHandler {
  constructor(bot, db) {
    this.bot = bot;
    this.db = db;
  }

  // 主菜单
  async showMainMenu(chatId, userId) {
    const repos = await this.db.listRepositories(userId);
    
    let text = '👋 欢迎使用内容转发助手！\n\n';
    
    if (repos.length > 0) {
      text += `📦 <b>你的视频库 (${repos.length})</b>\n`;
      
      const state = await this.db.getUserState(userId);
      const currentRepo = state?.current_repo;
      
      for (const repo of repos.slice(0, 3)) {
        const status = (currentRepo === repo.name) ? ' ✅ 进行中' : '';
        const targets = await this.db.listTargets(repo.id);
        const enabledCount = targets.filter(t => t.enabled).length;
        
        text += `   • ${repo.name}${status}\n`;
        text += `     🎯 ${enabledCount} 个目标`;
        
        const stats = await this.db.getStats(repo.id, 'today');
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
    
    await this.bot.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // 视频库列表
  async showRepoList(chatId, userId) {
    const repos = await this.db.listRepositories(userId);
    
    if (repos.length === 0) {
      await this.bot.sendMessage(chatId, '📦 你还没有视频库\n\n点击下方按钮创建第一个吧！', {
        reply_markup: {
          inline_keyboard: [[
            { text: '➕ 创建视频库', callback_data: 'repo:create_start' },
            { text: '🔙 返回', callback_data: 'menu:main' }
          ]]
        }
      });
      return;
    }
    
    const state = await this.db.getUserState(userId);
    const currentRepo = state?.current_repo;
    
    let text = '📦 <b>你的视频库</b>\n\n';
    const buttons = [];
    
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const status = (currentRepo === repo.name) ? ' ✅' : '';
      const targets = await this.db.listTargets(repo.id);
      const enabledCount = targets.filter(t => t.enabled).length;
      const stats = await this.db.getStats(repo.id, 'today');
      
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
    
    text += '━━━━━━━━━━━━━━━\n点击视频库查看详情';
    
    buttons.push([
      { text: '➕ 创建新库', callback_data: 'repo:create_start' },
      { text: '🔙 返回', callback_data: 'menu:main' }
    ]);
    
    await this.bot.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // 视频库详情
  async showRepoDetails(chatId, userId, repoName) {
    const repo = await this.db.getRepository(repoName);
    
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在`);
      return;
    }
    
    const targets = await this.db.listTargets(repo.id);
    const permissions = await this.db.listPermissions(repo.id);
    const stats = await this.db.getStats(repo.id);
    const todayStats = await this.db.getStats(repo.id, 'today');
    const weekStats = await this.db.getStats(repo.id, 'week');
    
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
        text += `   ${status} ${target.target_chat_id} (${target.target_type})\n`;
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
    
    await this.bot.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // 开始创建存储库
  async startCreateRepo(chatId, userId) {
    await this.db.setUserState(userId, {
      mode: 'setup',
      setup_step: 'creating_repo_name',
      setup_data: {}
    });
    
    await this.bot.sendMessage(
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

  // 处理创建存储库 - 名称
  async handleCreatingRepoName(chatId, userId, text) {
    const name = text.trim();
    
    if (name.length < 2 || name.length > 50) {
      await this.bot.sendMessage(chatId, '❌ 名称长度应在 2-50 个字符之间\n\n请重新输入：');
      return;
    }
    
    const existing = await this.db.getRepository(name);
    if (existing) {
      await this.bot.sendMessage(chatId, `❌ 视频库 "${name}" 已存在\n\n请换个名字：`);
      return;
    }
    
    await this.db.setUserState(userId, {
      mode: 'setup',
      setup_step: 'creating_repo_desc',
      setup_data: { name }
    });
    
    await this.bot.sendMessage(
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

  // 处理创建存储库 - 描述
  async handleCreatingRepoDesc(chatId, userId, text) {
    const state = await this.db.getUserState(userId);
    const name = state?.setup_data?.name;
    const description = text.trim();
    
    if (!name) {
      await this.bot.sendMessage(chatId, '❌ 会话超时，请重新开始');
      await this.db.clearUserState(userId);
      return;
    }
    
    const result = await this.db.createRepository(name, description || '无描述', userId);
    
    if (!result.success) {
      await this.bot.sendMessage(chatId, `❌ 创建失败: ${result.error}`);
      await this.db.clearUserState(userId);
      return;
    }
    
    await this.db.clearUserState(userId);
    
    await this.bot.sendMessage(
      chatId,
      `🎉 <b>视频库创建成功！</b>\n\n📦 ${name}\n📝 ${description || '无描述'}\n\n下一步要做什么？`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 添加转发目标', callback_data: `target:add_start:${name}` }],
            [{ text: '🚀 查看详情', callback_data: `repo:select:${name}` }],
            [{ text: '🔙 返回主菜单', callback_data: 'menu:main' }]
          ]
        }
      }
    );
  }

  // 开始添加转发目标
  async startAddTarget(chatId, userId, repoName) {
    const repo = await this.db.getRepository(repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await this.db.checkPermission(repo.id, userId, 'admin');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 只有管理员可以添加转发目标');
      return;
    }
    
    await this.db.setUserState(userId, {
      mode: 'setup',
      setup_step: 'adding_target',
      setup_data: { repo_name: repoName, repo_id: repo.id }
    });
    
    await this.bot.sendMessage(
      chatId,
      `🎯 <b>添加转发目标</b>\n\n请执行以下步骤：\n\n1️⃣ 将我添加到你的频道/群组\n2️⃣ 确保我有"发送消息"权限\n3️⃣ <b>转发该频道的任意一条消息给我</b>\n\n或者，直接发送频道 ID\n格式：-100xxx (数字)`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ 取消', callback_data: 'setup:cancel' }
          ]]
        }
      }
    );
  }

  // 处理添加转发目标
  async handleAddingTarget(chatId, userId, message) {
    const state = await this.db.getUserState(userId);
    const repoId = state?.setup_data?.repo_id;
    const repoName = state?.setup_data?.repo_name;
    
    if (!repoId) {
      await this.bot.sendMessage(chatId, '❌ 会话超时，请重新开始');
      await this.db.clearUserState(userId);
      return;
    }
    
    let targetChatId = null;
    let targetType = 'group';
    let targetInfo = '';
    
    // 检测是转发消息还是文本ID
    if (message.forward_from_chat) {
      const forwardedChat = message.forward_from_chat;
      targetChatId = forwardedChat.id;
      targetType = forwardedChat.type === 'channel' ? 'channel' : 'group';
      targetInfo = forwardedChat.title || forwardedChat.username || String(targetChatId);
      
      await this.bot.sendMessage(chatId, `🔍 检测到${targetType === 'channel' ? '频道' : '群组'}：<b>${targetInfo}</b>\n\n正在测试发送权限...`);
    } else if (message.text) {
      const text = message.text.trim();
      targetChatId = parseInt(text);
      
      if (isNaN(targetChatId)) {
        await this.bot.sendMessage(chatId, '❌ 无效的 ID 格式\n\n请转发频道消息，或发送数字 ID（-100xxx）');
        return;
      }
      
      targetType = targetChatId > 0 ? 'private' : (String(targetChatId).startsWith('-100') ? 'channel' : 'group');
      targetInfo = String(targetChatId);
      
      await this.bot.sendMessage(chatId, `正在测试发送到 ${targetInfo}...`);
    } else {
      await this.bot.sendMessage(chatId, '❌ 请转发频道消息，或发送频道 ID');
      return;
    }
    
    // 测试发送消息
    try {
      await this.bot.sendMessage(
        targetChatId,
        `✅ <b>转发目标已添加！</b>\n\n📦 视频库: ${repoName}\n\n现在此${targetType === 'channel' ? '频道' : '群组'}会收到转发到该视频库的内容。`
      );
    } catch (error) {
      await this.bot.sendMessage(
        chatId,
        `❌ 无法发送消息到目标\n\n可能的原因：\n• Bot 未被添加到${targetType === 'channel' ? '频道' : '群组'}\n• Bot 没有发送消息权限\n• Chat ID 不正确\n\n请重新尝试或取消`,
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
    
    await this.db.addTarget(repoId, targetChatId, targetType);
    await this.db.clearUserState(userId);
    
    await this.bot.sendMessage(
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

  // 开始使用（进入转发模式）
  async startForwarding(chatId, userId, repoName) {
    const repo = await this.db.getRepository(repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await this.db.checkPermission(repo.id, userId, 'contributor');
    if (!hasPermission) {
      await this.bot.sendMessage(chatId, '❌ 你没有转发权限');
      return;
    }
    
    const targets = await this.db.listTargets(repo.id);
    const enabledTargets = targets.filter(t => t.enabled);
    
    if (enabledTargets.length === 0) {
      await this.bot.sendMessage(chatId, '❌ 该视频库还没有启用的转发目标');
      return;
    }
    
    await this.db.setUserState(userId, {
      mode: 'forwarding',
      current_repo: repoName,
      message_count: 0
    });
    
    await this.bot.sendMessage(
      chatId,
      `🚀 <b>已开启自动转发模式</b>\n\n📦 当前视频库：${repoName}\n🎯 转发到 ${enabledTargets.length} 个目标\n\n现在，直接发送任何内容给我，我会自动转发！\n\n━━━━━━━━━━━━━━━\n支持的内容：\n✅ 文字、图片、视频\n✅ 文档、音频、贴纸\n\n发送 /stop 暂停转发`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏸ 暂停', callback_data: 'forward:stop' },
              { text: '🔄 切换库', callback_data: 'menu:repos' }
            ],
            [
              { text: '📊 统计', callback_data: `stats:show:${repoName}` }
            ]
          ]
        }
      }
    );
  }

  // 处理转发模式下的消息
  async handleForwarding(chatId, userId, message) {
    const state = await this.db.getUserState(userId);
    const repoName = state?.current_repo;
    
    if (!repoName) {
      await this.bot.sendMessage(chatId, '❌ 会话状态异常，请重新开始');
      await this.db.clearUserState(userId);
      return;
    }
    
    const repo = await this.db.getRepository(repoName);
    if (!repo) {
      await this.bot.sendMessage(chatId, `❌ 视频库 "${repoName}" 不存在`);
      await this.db.clearUserState(userId);
      return;
    }
    
    const targets = await this.db.listTargets(repo.id);
    const enabledTargets = targets.filter(t => t.enabled);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const target of enabledTargets) {
      try {
        const result = await this.bot.copyMessage(chatId, target.target_chat_id, message.message_id);
        if (result.ok) {
          await this.db.logForward(repo.id, chatId, message.message_id, target.target_chat_id, result.result.message_id, userId);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Forward to ${target.target_chat_id} failed:`, error);
        failCount++;
      }
    }
    
    // 更新消息计数
    await this.db.setUserState(userId, {
      mode: 'forwarding',
      current_repo: repoName,
      message_count: (state.message_count || 0) + 1
    });
    
    const resultText = successCount > 0 
      ? `✅ 已转发到 ${successCount} 个目标${failCount > 0 ? `（${failCount} 个失败）` : ''}`
      : `❌ 转发失败`;
    
    await this.bot.sendMessage(
      chatId,
      `${resultText}\n\n📦 ${repoName}\n📊 本次共 ${state.message_count + 1} 条`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏸ 暂停', callback_data: 'forward:stop' },
              { text: '🔄 切换库', callback_data: 'menu:repos' }
            ]
          ]
        }
      }
    );
  }
}

// ==================== 主处理器 ====================

async function handleUpdate(update, env) {
  const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
  const db = new Database(env.DB);
  const handler = new ConversationalHandler(bot, db);
  
  // 初始化数据库
  await db.initTables();
  
  // 处理普通消息
  if (update.message) {
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const isPrivate = message.chat.type === 'private';
    
    // 只处理私聊
    if (!isPrivate) return;
    
    // 命令处理
    if (message.text && message.text.startsWith('/')) {
      const command = message.text.split(' ')[0].substring(1);
      
      if (command === 'start') {
        await handler.showMainMenu(chatId, userId);
        return;
      }
      
      if (command === 'stop') {
        await db.clearUserState(userId);
        await bot.sendMessage(chatId, '⏸ 已暂停转发\n\n使用 /start 返回主菜单');
        return;
      }
      
      if (command === 'help') {
        await bot.sendMessage(
          chatId,
          `❓ <b>帮助</b>\n\n📦 <b>视频库</b>\n视频库是内容的容器，可以设置多个转发目标\n\n🎯 <b>转发目标</b>\n频道或群组，接收转发的内容\n\n🚀 <b>使用方法</b>\n1. 创建视频库\n2. 添加转发目标\n3. 开始转发\n4. 发送内容自动转发\n\n━━━━━━━━━━━━━━━\n更多帮助请访问文档`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 返回主菜单', callback_data: 'menu:main' }
              ]]
            }
          }
        );
        return;
      }
    }
    
    // 获取用户状态
    const state = await db.getUserState(userId);
    
    // 转发模式
    if (state && state.mode === 'forwarding') {
      await handler.handleForwarding(chatId, userId, message);
      return;
    }
    
    // 设置模式
    if (state && state.mode === 'setup') {
      if (state.setup_step === 'creating_repo_name') {
        await handler.handleCreatingRepoName(chatId, userId, message.text);
        return;
      }
      
      if (state.setup_step === 'creating_repo_desc') {
        await handler.handleCreatingRepoDesc(chatId, userId, message.text);
        return;
      }
      
      if (state.setup_step === 'adding_target') {
        await handler.handleAddingTarget(chatId, userId, message);
        return;
      }
    }
    
    // 默认：显示主菜单
    await handler.showMainMenu(chatId, userId);
  }
  
  // 处理回调查询（按钮点击）
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    
    await bot.answerCallbackQuery(query.id);
    
    const [action, ...params] = data.split(':');
    
    // 菜单导航
    if (action === 'menu') {
      if (params[0] === 'main') {
        await handler.showMainMenu(chatId, userId);
      } else if (params[0] === 'repos') {
        await handler.showRepoList(chatId, userId);
      } else if (params[0] === 'help') {
        await bot.sendMessage(
          chatId,
          `❓ <b>帮助</b>\n\n📦 <b>视频库</b>\n视频库是内容的容器，可以设置多个转发目标\n\n🎯 <b>转发目标</b>\n频道或群组，接收转发的内容\n\n🚀 <b>使用方法</b>\n1. 创建视频库\n2. 添加转发目标\n3. 开始转发\n4. 发送内容自动转发`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 返回主菜单', callback_data: 'menu:main' }
              ]]
            }
          }
        );
      }
      return;
    }
    
    // 存储库操作
    if (action === 'repo') {
      if (params[0] === 'create_start') {
        await handler.startCreateRepo(chatId, userId);
      } else if (params[0] === 'create_skip_desc') {
        await handler.handleCreatingRepoDesc(chatId, userId, '');
      } else if (params[0] === 'select') {
        await handler.showRepoDetails(chatId, userId, params[1]);
      } else if (params[0] === 'use') {
        await handler.startForwarding(chatId, userId, params[1]);
      }
      return;
    }
    
    // 转发目标操作
    if (action === 'target') {
      if (params[0] === 'add_start') {
        await handler.startAddTarget(chatId, userId, params[1]);
      }
      return;
    }
    
    // 设置取消
    if (action === 'setup') {
      if (params[0] === 'cancel') {
        await db.clearUserState(userId);
        await bot.sendMessage(chatId, '❌ 已取消\n\n使用 /start 返回主菜单');
      }
      return;
    }
    
    // 转发控制
    if (action === 'forward') {
      if (params[0] === 'stop') {
        await db.clearUserState(userId);
        await bot.sendMessage(chatId, '⏸ 已暂停转发\n\n使用 /start 返回主菜单');
      }
      return;
    }
  }
}

// ==================== Worker 入口 ====================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('Telegram Forwarding Bot is running!', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Webhook 端点
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        await handleUpdate(update, env);
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error', { status: 500 });
      }
    }
    
    // 设置 webhook
    if (url.pathname === '/setup') {
      const webhookUrl = `${url.origin}/webhook`;
      const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
      const result = await bot.callAPI('setWebhook', {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      });
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Webhook 信息
    if (url.pathname === '/webhook-info') {
      const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
      const result = await bot.callAPI('getWebhookInfo');
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 删除 webhook
    if (url.pathname === '/delete-webhook') {
      const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
      const result = await bot.callAPI('deleteWebhook');
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
