/**
 * Telegram Verification Bot - Complete Bundle
 * All modules merged into a single file for Cloudflare Workers
 */

// ==================== Telegram API ====================
class TelegramBot {
  constructor(token) {
    this.token = token;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId, text, options = {}) {
    return this.apiCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options
    });
  }

  async restrictChatMember(chatId, userId, permissions = {}) {
    return this.apiCall('restrictChatMember', {
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        ...permissions
      }
    });
  }

  async unrestrictChatMember(chatId, userId) {
    return this.apiCall('restrictChatMember', {
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true
      }
    });
  }

  async kickChatMember(chatId, userId) {
    return this.apiCall('banChatMember', {
      chat_id: chatId,
      user_id: userId
    });
  }

  async deleteMessage(chatId, messageId) {
    return this.apiCall('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return this.apiCall('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    });
  }

  async getChatMember(chatId, userId) {
    return this.apiCall('getChatMember', {
      chat_id: chatId,
      user_id: userId
    });
  }

  async forwardMessage(chatId, fromChatId, messageId) {
    return this.apiCall('forwardMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId
    });
  }

  async apiCall(method, params) {
    const response = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }
    return result.result;
  }
}

function createInlineKeyboard(buttons) {
  return {
    inline_keyboard: buttons
  };
}

// ==================== Bot Detection ====================
function detectBot(user, context = {}) {
  let score = 0;
  const detections = [];

  if (user.username) {
    const botPatterns = [
      /bot$/i,
      /^[a-z]+\d{4,}$/,
      /^[a-z]{20,}$/,
      /_spam/i,
      /casino|betting|crypto|forex/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(user.username)) {
        score += 30;
        detections.push({ type: 'username_pattern', pattern: pattern.toString() });
        break;
      }
    }
  } else {
    score += 10;
    detections.push({ type: 'no_username' });
  }

  if (!user.first_name || user.first_name.length < 2) {
    score += 15;
    detections.push({ type: 'invalid_first_name' });
  }

  if (user.first_name && /^[\d\s]+$/.test(user.first_name)) {
    score += 20;
    detections.push({ type: 'numeric_name' });
  }

  if (context.joinTime && context.previousJoinTime) {
    const timeDiff = context.joinTime - context.previousJoinTime;
    if (timeDiff < 5000) {
      score += 25;
      detections.push({ type: 'fast_join', timeDiff });
    }
  }

  if (!user.has_photo) {
    score += 10;
    detections.push({ type: 'no_profile_photo' });
  }

  if (user.id > 5000000000) {
    score += 5;
    detections.push({ type: 'new_account_id' });
  }

  if (user.is_bot) {
    score += 100;
    detections.push({ type: 'official_bot_flag' });
  }

  const spamKeywords = [
    'casino', 'betting', 'porn', 'xxx', 'dating', 
    '赚钱', '兼职', '博彩', '色情', '约炮',
    'crypto signal', 'forex', 'investment opportunity'
  ];

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
  for (const keyword of spamKeywords) {
    if (fullName.includes(keyword.toLowerCase())) {
      score += 40;
      detections.push({ type: 'spam_keyword', keyword });
      break;
    }
  }

  return {
    score,
    isBot: score >= 50,
    isSuspicious: score >= 30,
    detections,
    level: score >= 70 ? 'high' : score >= 50 ? 'medium' : score >= 30 ? 'low' : 'none'
  };
}

function generateVerificationChallenge(type = 'math') {
  switch (type) {
    case 'math':
      return generateMathChallenge();
    case 'button':
      return generateButtonChallenge();
    case 'captcha':
      return generateCaptchaChallenge();
    default:
      return generateMathChallenge();
  }
}

function generateMathChallenge() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operators = ['+', '-', '×'];
  const operator = operators[Math.floor(Math.random() * operators.length)];

  let answer;
  let question;

  switch (operator) {
    case '+':
      answer = num1 + num2;
      question = `${num1} + ${num2}`;
      break;
    case '-':
      answer = Math.max(num1, num2) - Math.min(num1, num2);
      question = `${Math.max(num1, num2)} - ${Math.min(num1, num2)}`;
      break;
    case '×':
      answer = num1 * num2;
      question = `${num1} × ${num2}`;
      break;
  }

  return {
    type: 'math',
    question: `请计算：${question} = ?`,
    answer: answer.toString(),
    options: generateMathOptions(answer)
  };
}

function generateMathOptions(correctAnswer) {
  const options = [correctAnswer];
  
  while (options.length < 4) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const option = correctAnswer + offset;
    if (option > 0 && !options.includes(option)) {
      options.push(option);
    }
  }

  return options.sort(() => Math.random() - 0.5).map(String);
}

function generateButtonChallenge() {
  const emojis = ['🍎', '🍌', '🍇', '🍊', '🍓', '🍉', '🥝', '🍑'];
  const correctEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  const options = [correctEmoji];
  while (options.length < 4) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    if (!options.includes(emoji)) {
      options.push(emoji);
    }
  }

  return {
    type: 'button',
    question: `请点击 ${correctEmoji}`,
    answer: correctEmoji,
    options: options.sort(() => Math.random() - 0.5)
  };
}

function generateCaptchaChallenge() {
  const words = ['apple', 'book', 'cat', 'dog', 'fish', 'tree', 'sun', 'moon'];
  const correctWord = words[Math.floor(Math.random() * words.length)];
  
  return {
    type: 'captcha',
    question: `请输入单词：${correctWord.toUpperCase()}`,
    answer: correctWord,
    options: null
  };
}

// ==================== Database ====================

// 自动初始化数据库表
async function initializeDatabaseTables(db) {
  try {
    // 创建所有必需的表
    const tables = [
      // 验证记录表
      `CREATE TABLE IF NOT EXISTS verifications (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        chat_id INTEGER,
        status TEXT CHECK(status IN ('pending', 'verified', 'failed', 'banned')),
        verification_code TEXT,
        attempts INTEGER DEFAULT 0,
        created_at INTEGER,
        verified_at INTEGER,
        metadata TEXT
      )`,
      
      // 黑名单表
      `CREATE TABLE IF NOT EXISTS blacklist (
        user_id INTEGER PRIMARY KEY,
        reason TEXT,
        banned_at INTEGER,
        banned_by INTEGER,
        metadata TEXT
      )`,
      
      // 群组配置表
      `CREATE TABLE IF NOT EXISTS group_configs (
        chat_id INTEGER PRIMARY KEY,
        verification_type TEXT CHECK(verification_type IN ('math', 'button', 'captcha', 'custom')),
        timeout_seconds INTEGER DEFAULT 300,
        auto_ban_bots INTEGER DEFAULT 1,
        welcome_message TEXT,
        bot_detection_level TEXT CHECK(bot_detection_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
        created_at INTEGER,
        updated_at INTEGER
      )`,
      
      // 机器人检测日志表
      `CREATE TABLE IF NOT EXISTS bot_detection_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        chat_id INTEGER,
        detection_type TEXT,
        score INTEGER,
        action TEXT,
        detected_at INTEGER,
        metadata TEXT
      )`,
      
      // ======== 转发系统表 ========
      
      // 存储库表
      `CREATE TABLE IF NOT EXISTS forward_repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_by INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )`,
      
      // 转发目标表
      `CREATE TABLE IF NOT EXISTS forward_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER NOT NULL,
        target_chat_id INTEGER NOT NULL,
        target_type TEXT CHECK(target_type IN ('channel', 'group', 'private')),
        enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (repository_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
      )`,
      
      // 消息记录表
      `CREATE TABLE IF NOT EXISTS forwarded_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER NOT NULL,
        source_user_id INTEGER NOT NULL,
        source_message_id INTEGER,
        message_type TEXT,
        forwarded_to TEXT,
        forwarded_at INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (repository_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
      )`,
      
      // 权限表
      `CREATE TABLE IF NOT EXISTS forward_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT CHECK(role IN ('admin', 'contributor', 'viewer')) DEFAULT 'contributor',
        granted_by INTEGER NOT NULL,
        granted_at INTEGER NOT NULL,
        UNIQUE(repository_id, user_id),
        FOREIGN KEY (repository_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
      )`,
      
      // 索引 - 验证系统
      `CREATE INDEX IF NOT EXISTS idx_verifications_chat ON verifications(chat_id)`,
      `CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status)`,
      `CREATE INDEX IF NOT EXISTS idx_detection_user ON bot_detection_log(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_detection_chat ON bot_detection_log(chat_id)`,
      
      // 索引 - 转发系统
      `CREATE INDEX IF NOT EXISTS idx_forward_targets_repo ON forward_targets(repository_id)`,
      `CREATE INDEX IF NOT EXISTS idx_forwarded_messages_repo ON forwarded_messages(repository_id)`,
      `CREATE INDEX IF NOT EXISTS idx_forwarded_messages_user ON forwarded_messages(source_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_forward_permissions_repo ON forward_permissions(repository_id)`,
      `CREATE INDEX IF NOT EXISTS idx_forward_permissions_user ON forward_permissions(user_id)`
    ];

    // 执行所有建表语句
    for (const sql of tables) {
      await db.prepare(sql).run();
    }
    
    console.log('✅ Database tables initialized successfully (verification + forwarding)');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error);
    return false;
  }
}

async function getUserVerification(db, userId) {
  const result = await db
    .prepare('SELECT * FROM verifications WHERE user_id = ?')
    .bind(userId)
    .first();
  return result;
}

async function createVerification(db, data) {
  const {
    user_id,
    username,
    first_name,
    chat_id,
    verification_code,
    metadata = {}
  } = data;

  await db
    .prepare(
      `INSERT INTO verifications (user_id, username, first_name, chat_id, status, verification_code, attempts, created_at, metadata)
       VALUES (?, ?, ?, ?, 'pending', ?, 0, ?, ?)`
    )
    .bind(
      user_id,
      username,
      first_name,
      chat_id,
      verification_code,
      Date.now(),
      JSON.stringify(metadata)
    )
    .run();
}

async function updateVerificationStatus(db, userId, status) {
  await db
    .prepare('UPDATE verifications SET status = ?, verified_at = ? WHERE user_id = ?')
    .bind(status, Date.now(), userId)
    .run();
}

async function incrementAttempts(db, userId) {
  await db
    .prepare('UPDATE verifications SET attempts = attempts + 1 WHERE user_id = ?')
    .bind(userId)
    .run();
}

async function isBlacklisted(db, userId) {
  const result = await db
    .prepare('SELECT 1 FROM blacklist WHERE user_id = ?')
    .bind(userId)
    .first();
  return !!result;
}

async function addToBlacklist(db, userId, reason, bannedBy = null) {
  await db
    .prepare(
      `INSERT OR REPLACE INTO blacklist (user_id, reason, banned_at, banned_by, metadata)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(userId, reason, Date.now(), bannedBy, JSON.stringify({}))
    .run();
}

async function getGroupConfig(db, chatId) {
  try {
    const result = await db
      .prepare('SELECT * FROM group_configs WHERE chat_id = ?')
      .bind(chatId)
      .first();

    // 如果配置存在，直接返回
    if (result) {
      return result;
    }

    // 如果不存在，创建默认配置
    const defaultConfig = {
      chat_id: chatId,
      verification_type: 'math',
      timeout_seconds: 300,
      auto_ban_bots: 1,
      bot_detection_level: 'medium'
    };

    // 尝试插入默认配置到数据库
    try {
      await db
        .prepare(
          `INSERT INTO group_configs (chat_id, verification_type, timeout_seconds, auto_ban_bots, bot_detection_level, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          chatId,
          defaultConfig.verification_type,
          defaultConfig.timeout_seconds,
          defaultConfig.auto_ban_bots,
          defaultConfig.bot_detection_level,
          Date.now(),
          Date.now()
        )
        .run();
      
      console.log(`✅ Auto-created config for chat ${chatId}`);
    } catch (insertError) {
      // 如果插入失败（例如表不存在），记录错误但继续使用默认配置
      console.error('Failed to auto-create group config:', insertError);
    }

    return defaultConfig;
  } catch (error) {
    // 如果查询失败（例如表不存在），返回默认配置
    console.error('Error getting group config:', error);
    return {
      chat_id: chatId,
      verification_type: 'math',
      timeout_seconds: 300,
      auto_ban_bots: 1,
      bot_detection_level: 'medium'
    };
  }
}

async function logBotDetection(db, data) {
  const { user_id, chat_id, detection_type, score, action, metadata = {} } = data;

  await db
    .prepare(
      `INSERT INTO bot_detection_log (user_id, chat_id, detection_type, score, action, detected_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      user_id,
      chat_id,
      detection_type,
      score,
      action,
      Date.now(),
      JSON.stringify(metadata)
    )
    .run();
}

// ==================== Forwarding System Database ====================

// 存储库管理
async function createForwardRepository(db, data) {
  const { name, description, created_by } = data;
  const now = Date.now();

  try {
    await db
      .prepare(
        `INSERT INTO forward_repositories (name, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(name, description, created_by, now, now)
      .run();
    return { success: true };
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE')) {
      return { success: false, error: 'repository_exists' };
    }
    console.error('createForwardRepository error:', error);
    return { success: false, error: error.message };
  }
}

async function getForwardRepository(db, name) {
  try {
    return await db
      .prepare('SELECT * FROM forward_repositories WHERE name = ?')
      .bind(name)
      .first();
  } catch (error) {
    console.error('getForwardRepository error:', error);
    return null;
  }
}

async function listForwardRepositories(db, userId = null) {
  try {
    if (userId) {
      // 返回用户有权限的存储库
      const result = await db
        .prepare(`
          SELECT DISTINCT r.* FROM forward_repositories r
          LEFT JOIN forward_permissions p ON r.id = p.repository_id
          WHERE r.created_by = ? OR p.user_id = ?
          ORDER BY r.created_at DESC
        `)
        .bind(userId, userId)
        .all();
      return result.results || [];
    }
    
    // 返回所有存储库
    const result = await db
      .prepare('SELECT * FROM forward_repositories ORDER BY created_at DESC')
      .all();
    return result.results || [];
  } catch (error) {
    console.error('listForwardRepositories error:', error);
    return [];
  }
}

async function deleteForwardRepository(db, name) {
  try {
    await db
      .prepare('DELETE FROM forward_repositories WHERE name = ?')
      .bind(name)
      .run();
    return { success: true };
  } catch (error) {
    console.error('deleteForwardRepository error:', error);
    return { success: false, error: error.message };
  }
}

async function updateForwardRepository(db, name, data) {
  try {
    const { description } = data;
    await db
      .prepare(`
        UPDATE forward_repositories 
        SET description = ?, updated_at = ?
        WHERE name = ?
      `)
      .bind(description, Date.now(), name)
      .run();
    return { success: true };
  } catch (error) {
    console.error('updateForwardRepository error:', error);
    return { success: false, error: error.message };
  }
}

// 转发目标管理
async function addForwardTarget(db, repoId, targetChatId, targetType) {
  try {
    const now = Date.now();
    await db
      .prepare(`
        INSERT INTO forward_targets (repository_id, target_chat_id, target_type, enabled, created_at)
        VALUES (?, ?, ?, 1, ?)
      `)
      .bind(repoId, targetChatId, targetType, now)
      .run();
    return { success: true };
  } catch (error) {
    console.error('addForwardTarget error:', error);
    return { success: false, error: error.message };
  }
}

async function removeForwardTarget(db, repoId, targetChatId) {
  try {
    await db
      .prepare('DELETE FROM forward_targets WHERE repository_id = ? AND target_chat_id = ?')
      .bind(repoId, targetChatId)
      .run();
    return { success: true };
  } catch (error) {
    console.error('removeForwardTarget error:', error);
    return { success: false, error: error.message };
  }
}

async function listForwardTargets(db, repoId) {
  try {
    const result = await db
      .prepare('SELECT * FROM forward_targets WHERE repository_id = ? ORDER BY created_at')
      .bind(repoId)
      .all();
    return result.results || [];
  } catch (error) {
    console.error('listForwardTargets error:', error);
    return [];
  }
}

async function toggleForwardTarget(db, repoId, targetChatId) {
  try {
    await db
      .prepare(`
        UPDATE forward_targets 
        SET enabled = 1 - enabled 
        WHERE repository_id = ? AND target_chat_id = ?
      `)
      .bind(repoId, targetChatId)
      .run();
    return { success: true };
  } catch (error) {
    console.error('toggleForwardTarget error:', error);
    return { success: false, error: error.message };
  }
}

// 权限管理
async function grantForwardPermission(db, repoId, userId, role, grantedBy) {
  try {
    const now = Date.now();
    
    // SQLite doesn't support INSERT ... ON CONFLICT ... DO UPDATE in D1 yet
    // So we delete first, then insert
    await db
      .prepare('DELETE FROM forward_permissions WHERE repository_id = ? AND user_id = ?')
      .bind(repoId, userId)
      .run();
    
    await db
      .prepare(`
        INSERT INTO forward_permissions (repository_id, user_id, role, granted_by, granted_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(repoId, userId, role, grantedBy, now)
      .run();
    
    return { success: true };
  } catch (error) {
    console.error('grantForwardPermission error:', error);
    return { success: false, error: error.message };
  }
}

async function revokeForwardPermission(db, repoId, userId) {
  try {
    await db
      .prepare('DELETE FROM forward_permissions WHERE repository_id = ? AND user_id = ?')
      .bind(repoId, userId)
      .run();
    return { success: true };
  } catch (error) {
    console.error('revokeForwardPermission error:', error);
    return { success: false, error: error.message };
  }
}

async function checkForwardPermission(db, repoId, userId, requiredRole = 'contributor') {
  try {
    const result = await db
      .prepare(`
        SELECT r.created_by, p.role 
        FROM forward_repositories r
        LEFT JOIN forward_permissions p ON r.id = p.repository_id AND p.user_id = ?
        WHERE r.id = ?
      `)
      .bind(userId, repoId)
      .first();

    if (!result) return false;
    
    // 创建者默认是 admin
    if (result.created_by === userId) return true;
    
    // 检查权限等级
    const roleLevel = { viewer: 1, contributor: 2, admin: 3 };
    const userLevel = roleLevel[result.role] || 0;
    const requiredLevel = roleLevel[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  } catch (error) {
    console.error('checkForwardPermission error:', error);
    return false;
  }
}

async function listForwardPermissions(db, repoId) {
  try {
    const result = await db
      .prepare('SELECT * FROM forward_permissions WHERE repository_id = ? ORDER BY granted_at')
      .bind(repoId)
      .all();
    return result.results || [];
  } catch (error) {
    console.error('listForwardPermissions error:', error);
    return [];
  }
}

// 消息记录
async function logForwardedMessage(db, data) {
  try {
    const { repository_id, source_user_id, source_message_id, message_type, forwarded_to, metadata } = data;
    const now = Date.now();
    
    await db
      .prepare(`
        INSERT INTO forwarded_messages 
        (repository_id, source_user_id, source_message_id, message_type, forwarded_to, forwarded_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        repository_id,
        source_user_id,
        source_message_id,
        message_type,
        JSON.stringify(forwarded_to),
        now,
        JSON.stringify(metadata || {})
      )
      .run();
  } catch (error) {
    console.error('logForwardedMessage error:', error);
  }
}

async function getForwardedStats(db, repoId, period = 'all') {
  try {
    let dateFilter = '';
    const now = Date.now();
    
    if (period === 'today') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      dateFilter = `AND forwarded_at >= ${todayStart}`;
    } else if (period === 'week') {
      const weekStart = now - 7 * 24 * 60 * 60 * 1000;
      dateFilter = `AND forwarded_at >= ${weekStart}`;
    }

    const total = await db
      .prepare(`SELECT COUNT(*) as count FROM forwarded_messages WHERE repository_id = ? ${dateFilter}`)
      .bind(repoId)
      .first();

    const byType = await db
      .prepare(`
        SELECT message_type, COUNT(*) as count 
        FROM forwarded_messages 
        WHERE repository_id = ? ${dateFilter}
        GROUP BY message_type
      `)
      .bind(repoId)
      .all();

    const byUser = await db
      .prepare(`
        SELECT source_user_id, COUNT(*) as count 
        FROM forwarded_messages 
        WHERE repository_id = ? ${dateFilter}
        GROUP BY source_user_id
        ORDER BY count DESC
        LIMIT 10
      `)
      .bind(repoId)
      .all();

    return {
      total: total?.count || 0,
      byType: byType.results || [],
      byUser: byUser.results || []
    };
  } catch (error) {
    console.error('getForwardedStats error:', error);
    return { total: 0, byType: [], byUser: [] };
  }
}

async function getRecentForwarded(db, repoId, limit = 10) {
  try {
    const result = await db
      .prepare(`
        SELECT * FROM forwarded_messages 
        WHERE repository_id = ? 
        ORDER BY forwarded_at DESC 
        LIMIT ?
      `)
      .bind(repoId, limit)
      .all();
    
    return result.results || [];
  } catch (error) {
    console.error('getRecentForwarded error:', error);
    return [];
  }
}

// Helper functions
function getMessageType(message) {
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

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

// ==================== Main Handler ====================
async function handleTelegramUpdate(update, env) {
  const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN);
  const db = env.DB;

  try {
    // 处理新成员加入群组
    if (update.chat_member && update.chat_member.new_chat_member) {
      await handleNewChatMember(update.chat_member, bot, db);
      return;
    }

    // 处理新成员消息
    if (update.message && update.message.new_chat_members) {
      for (const member of update.message.new_chat_members) {
        await handleNewMember(update.message, member, bot, db);
      }
      return;
    }

    // 处理回调按钮
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot, db);
      return;
    }

    // 处理私聊消息
    if (update.message && update.message.chat.type === 'private') {
      await handlePrivateMessage(update.message, bot, db);
      return;
    }

    // 处理群组消息
    if (update.message && ['group', 'supergroup'].includes(update.message.chat.type)) {
      await handleGroupMessage(update.message, bot, db);
      return;
    }
  } catch (error) {
    console.error('Error handling update:', error);
  }
}

async function handleNewChatMember(chatMember, bot, db) {
  const user = chatMember.new_chat_member.user;
  const chatId = chatMember.chat.id;
  const fromUser = chatMember.from;

  // 如果是 Bot 自己被添加到群组
  if (user.is_bot && user.id === fromUser.id) {
    // 自动初始化该群组的配置
    await getGroupConfig(db, chatId);
    
    // 发送欢迎消息
    await bot.sendMessage(
      chatId,
      `👋 <b>感谢添加 OizhiBot！</b>

🤖 我是智能群组验证机器人，可以帮助你:
✅ 自动验证新成员
✅ 检测并封禁机器人账号
✅ 管理黑名单
✅ 多种验证方式

⚙️ <b>请授予我以下管理员权限:</b>
• 限制用户
• 删除消息
• 封禁用户

📝 <b>快速开始:</b>
• /config - 查看当前配置
• /verify_config math - 设置验证方式
• /help - 查看所有命令

🔐 <b>当前默认配置:</b>
• 验证方式: 数学题
• 超时时间: 5分钟
• 自动封禁: 已开启

💡 我已经开始工作了，新成员加入时会自动验证！
      `.trim()
    );
    return;
  }

  await processNewMember(chatId, user, bot, db);
}

async function handleNewMember(message, member, bot, db) {
  const chatId = message.chat.id;
  
  // 检查是否是 Bot 自己
  if (member.is_bot) {
    // 获取 Bot 自己的信息来判断
    try {
      const botInfo = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`).then(r => r.json());
      if (botInfo.result && member.id === botInfo.result.id) {
        // Bot 自己被添加，自动初始化配置
        await getGroupConfig(db, chatId);
        
        await bot.sendMessage(
          chatId,
          `👋 <b>感谢添加 OizhiBot！</b>

🤖 我是智能群组验证机器人，可以帮助你:
✅ 自动验证新成员
✅ 检测并封禁机器人账号
✅ 管理黑名单
✅ 多种验证方式

⚙️ <b>请授予我以下管理员权限:</b>
• 限制用户
• 删除消息
• 封禁用户

📝 <b>快速开始:</b>
• /config - 查看当前配置
• /verify_config math - 设置验证方式
• /help - 查看所有命令

🔐 <b>当前默认配置:</b>
• 验证方式: 数学题
• 超时时间: 5分钟
• 自动封禁: 已开启

💡 我已经开始工作了，新成员加入时会自动验证！
          `.trim()
        );
        return;
      }
    } catch (error) {
      console.error('Error checking bot identity:', error);
    }
  }
  
  await processNewMember(chatId, member, bot, db);
}

async function processNewMember(chatId, user, bot, db) {
  if (await isBlacklisted(db, user.id)) {
    await bot.kickChatMember(chatId, user.id);
    await logBotDetection(db, {
      user_id: user.id,
      chat_id: chatId,
      detection_type: 'blacklist',
      score: 100,
      action: 'banned'
    });
    return;
  }

  const config = await getGroupConfig(db, chatId);
  const detection = detectBot(user, { joinTime: Date.now() });

  if (detection.score > 0) {
    await logBotDetection(db, {
      user_id: user.id,
      chat_id: chatId,
      detection_type: 'join_detection',
      score: detection.score,
      action: detection.isBot ? 'auto_ban' : 'verify',
      metadata: detection.detections
    });
  }

  if (detection.isBot && config.auto_ban_bots) {
    await bot.kickChatMember(chatId, user.id);
    await addToBlacklist(db, user.id, 'Auto-detected as bot', null);
    
    await bot.sendMessage(
      chatId,
      `🤖 检测到机器人账号并已自动封禁\n用户: ${user.first_name || 'N/A'}\nID: ${user.id}\n可疑分数: ${detection.score}/100`
    );
    return;
  }

  await bot.restrictChatMember(chatId, user.id, {
    can_send_messages: false
  });

  const challenge = generateVerificationChallenge(config.verification_type);

  await createVerification(db, {
    user_id: user.id,
    username: user.username,
    first_name: user.first_name,
    chat_id: chatId,
    verification_code: challenge.answer,
    metadata: { challenge, detection }
  });

  let keyboard;
  if (challenge.options) {
    keyboard = createInlineKeyboard([
      challenge.options.map(option => ({
        text: option,
        callback_data: `verify:${user.id}:${option}`
      }))
    ]);
  }

  const userName = user.username ? `@${user.username}` : user.first_name;
  const warningText = detection.isSuspicious 
    ? `\n\n⚠️ 检测到可疑行为，请完成验证` 
    : '';

  await bot.sendMessage(
    chatId,
    `👋 欢迎 ${userName}!\n\n${challenge.question}\n\n⏱ 请在 ${config.timeout_seconds} 秒内完成验证${warningText}`,
    keyboard ? { reply_markup: keyboard } : {}
  );
}

async function handleCallbackQuery(callbackQuery, bot, db) {
  const data = callbackQuery.data;
  const user = callbackQuery.from;
  const message = callbackQuery.message;

  if (!data.startsWith('verify:')) {
    return;
  }

  const [_, targetUserId, answer] = data.split(':');

  if (user.id.toString() !== targetUserId) {
    await bot.answerCallbackQuery(
      callbackQuery.id,
      '❌ 这不是你的验证消息',
      true
    );
    return;
  }

  const verification = await getUserVerification(db, user.id);

  if (!verification || verification.status !== 'pending') {
    await bot.answerCallbackQuery(
      callbackQuery.id,
      '验证已过期或已完成',
      true
    );
    return;
  }

  await incrementAttempts(db, user.id);

  if (answer === verification.verification_code) {
    await updateVerificationStatus(db, user.id, 'verified');
    await bot.unrestrictChatMember(verification.chat_id, user.id);

    await bot.answerCallbackQuery(callbackQuery.id, '✅ 验证成功！');
    
    await bot.sendMessage(
      verification.chat_id,
      `✅ ${user.first_name} 已通过验证，欢迎加入！`
    );

    await bot.deleteMessage(message.chat.id, message.message_id);

  } else {
    const verification_updated = await getUserVerification(db, user.id);
    
    if (verification_updated.attempts >= 3) {
      await updateVerificationStatus(db, user.id, 'failed');
      await bot.kickChatMember(verification.chat_id, user.id);
      await addToBlacklist(db, user.id, 'Failed verification', null);

      await bot.answerCallbackQuery(
        callbackQuery.id,
        '❌ 验证失败次数过多，已被移出群组',
        true
      );

      await bot.sendMessage(
        verification.chat_id,
        `❌ ${user.first_name} 验证失败，已被移出群组`
      );

      await bot.deleteMessage(message.chat.id, message.message_id);
    } else {
      await bot.answerCallbackQuery(
        callbackQuery.id,
        `❌ 答案错误，还剩 ${3 - verification_updated.attempts} 次机会`,
        true
      );
    }
  }
}

async function handlePrivateMessage(message, bot, db) {
  const user = message.from;
  const text = message.text?.trim();

  // 处理 /start 命令
  if (text === '/start') {
    await bot.sendMessage(
      message.chat.id,
      `👋 你好！我是 <b>OizhiBot</b> - 群组验证机器人

🔐 <b>主要功能:</b>
• 新成员智能验证（防止机器人入侵）
• 10维度机器人检测算法
• 自动封禁可疑账号
• 黑名单管理
• 多群组独立配置

📖 <b>使用方法:</b>
1️⃣ 将我添加到你的群组
2️⃣ 授予我管理员权限:
   • 限制用户
   • 删除消息
   • 封禁用户
3️⃣ 我会自动开始工作！

👥 <b>管理员命令:</b>
• /config - 查看配置
• /stats - 查看统计
• /help - 完整命令列表

🔍 <b>检测用户:</b>
直接转发用户消息给我，我会分析该用户是否可疑

💡 <b>提示:</b> 当你加入需要验证的群组时，我会在这里发送验证消息

📦 开源地址: https://github.com/ovws/oizhibot
      `.trim()
    );
    return;
  }

  // 处理 /help 命令
  if (text === '/help') {
    await bot.sendMessage(
      message.chat.id,
      `📚 <b>帮助文档</b>

<b>1. 群组管理员命令:</b>
• /config - 查看当前配置
• /verify_config &lt;类型&gt; - 设置验证方式
• /verify_timeout &lt;秒&gt; - 设置超时时间
• /autoban &lt;on|off&gt; - 自动封禁开关
• /blacklist - 查看黑名单
• /ban &lt;用户ID&gt; - 封禁用户
• /unban &lt;用户ID&gt; - 解除封禁
• /stats - 查看统计

<b>2. 私聊功能:</b>
• /start - 查看介绍
• /check - 检测自己账号
• 转发消息 - 检测其他用户

<b>3. 内容转发系统:</b>
<b>存储库管理</b>
• /repo_create &lt;名称&gt; &lt;描述&gt; - 创建存储库
• /repo_list - 列出所有存储库
• /repo_info &lt;名称&gt; - 查看详情
• /repo_delete &lt;名称&gt; - 删除存储库

<b>转发目标</b>
• /target_add &lt;库&gt; &lt;chat_id&gt; - 添加转发目标
• /target_remove &lt;库&gt; &lt;chat_id&gt; - 移除目标
• /target_list &lt;库&gt; - 列出目标
• /target_toggle &lt;库&gt; &lt;chat_id&gt; - 启用/禁用

<b>权限管理</b>
• /perm_grant &lt;库&gt; &lt;user&gt; &lt;role&gt; - 授权
• /perm_revoke &lt;库&gt; &lt;user&gt; - 撤销
• /perm_list &lt;库&gt; - 列出授权

<b>转发操作</b>
• /use &lt;库名&gt; - 开启自动转发
• /use off - 关闭自动转发
• /forwarded_stats &lt;库&gt; - 查看统计
• /forwarded_recent &lt;库&gt; - 最近记录

<b>4. 验证类型:</b>
• math - 数学题验证
• button - 按钮选择
• captcha - 验证码输入

<b>5. 机器人检测维度 (10项):</b>
• 官方 bot 标记
• 垃圾关键词
• 用户名模式
• 快速加入
• 数字/无效名称
• 无头像/用户名
• 新账号检测

💡 <b>转发系统使用示例:</b>
1. 创建存储库: /repo_create news 新闻频道
2. 添加目标: /target_add news @your_channel
3. 开启转发: /use news
4. 发送内容即可自动转发！

需要更多帮助？查看项目文档:
https://github.com/ovws/oizhibot
      `.trim()
    );
    return;
  }

  // 处理 /check 命令 - 检测自己
  if (text === '/check') {
    const detection = detectBot(user, { joinTime: Date.now() });
    
    const riskLevel = {
      'high': '🔴 高风险',
      'medium': '🟡 中风险',
      'low': '🟢 低风险',
      'none': '✅ 正常'
    };

    let detectionDetails = '';
    if (detection.detections && detection.detections.length > 0) {
      detectionDetails = '\n\n<b>检测到的问题:</b>\n' + 
        detection.detections.map(d => `• ${d.type}: ${JSON.stringify(d)}`).join('\n');
    }

    await bot.sendMessage(
      message.chat.id,
      `🔍 <b>账号检测结果</b>

👤 用户: ${user.first_name}${user.username ? ' (@' + user.username + ')' : ''}
🆔 ID: <code>${user.id}</code>

📊 可疑评分: <b>${detection.score}</b>/100
⚠️ 风险等级: ${riskLevel[detection.level]}

判定结果:
${detection.isBot ? '❌ 识别为机器人账号' : detection.isSuspicious ? '⚠️ 有可疑行为，需验证' : '✅ 账号正常'}
${detectionDetails}

💡 提示: 你可以转发其他用户的消息给我来检测他们的账号
      `.trim()
    );
    return;
  }

  // ==================== 转发系统命令 ====================
  
  // /repo_create
  if (text.startsWith('/repo_create')) {
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await bot.sendMessage(chatId, '用法: /repo_create <名称> <描述>');
      return;
    }
    
    const name = args[0];
    const description = args.slice(1).join(' ');
    
    const result = await createForwardRepository(db, { name, description, created_by: userId });
    
    if (result.success) {
      await bot.sendMessage(
        chatId,
        `✅ 存储库创建成功！

📦 名称: ${name}
📝 描述: ${description}

💡 下一步:
1. 添加转发目标: /target_add ${name} <chat_id>
2. 授权用户: /perm_grant ${name} <user_id> <role>
3. 开始转发: /use ${name}`
      );
    } else if (result.error === 'repository_exists') {
      await bot.sendMessage(chatId, `❌ 存储库 "${name}" 已存在`);
    } else {
      await bot.sendMessage(chatId, `❌ 创建失败: ${result.error}`);
    }
    return;
  }

  // /repo_list
  if (text === '/repo_list') {
    const repos = await listForwardRepositories(db, userId);
    
    if (repos.length === 0) {
      await bot.sendMessage(chatId, '📦 暂无存储库\n\n使用 /repo_create <名称> <描述> 创建第一个');
      return;
    }
    
    let msg = '📦 <b>存储库列表</b>\n\n';
    for (const repo of repos) {
      const targets = await listForwardTargets(db, repo.id);
      const enabledTargets = targets.filter(t => t.enabled);
      msg += `📌 <b>${repo.name}</b>\n`;
      msg += `   📝 ${repo.description || '无描述'}\n`;
      msg += `   🎯 转发目标: ${enabledTargets.length}/${targets.length} 个启用\n`;
      msg += `   👤 创建者: ${repo.created_by}\n\n`;
    }
    msg += '\n💡 查看详情: /repo_info <名称>';
    
    await bot.sendMessage(chatId, msg);
    return;
  }

  // /repo_delete
  if (text.startsWith('/repo_delete')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /repo_delete <名称>');
      return;
    }
    
    const name = args[0];
    const repo = await getForwardRepository(db, name);
    
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${name}" 不存在`);
      return;
    }
    
    if (repo.created_by !== userId) {
      await bot.sendMessage(chatId, '❌ 只有创建者可以删除存储库');
      return;
    }
    
    await deleteForwardRepository(db, name);
    await bot.sendMessage(chatId, `✅ 存储库 "${name}" 已删除`);
    return;
  }

  // /repo_info
  if (text.startsWith('/repo_info')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /repo_info <名称>');
      return;
    }
    
    const name = args[0];
    const repo = await getForwardRepository(db, name);
    
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${name}" 不存在`);
      return;
    }
    
    const targets = await listForwardTargets(db, repo.id);
    const permissions = await listForwardPermissions(db, repo.id);
    const stats = await getForwardedStats(db, repo.id);
    
    let msg = `📦 <b>存储库: ${repo.name}</b>\n\n`;
    msg += `📝 描述: ${repo.description || '无'}\n`;
    msg += `👤 创建者: ${repo.created_by}\n`;
    msg += `📅 创建: ${new Date(repo.created_at).toLocaleString('zh-CN')}\n\n`;
    
    msg += `🎯 <b>转发目标 (${targets.length})</b>\n`;
    if (targets.length > 0) {
      for (const target of targets) {
        const status = target.enabled ? '✅' : '❌';
        msg += `${status} ${target.target_chat_id} (${target.target_type})\n`;
      }
    } else {
      msg += '   暂无目标\n';
    }
    
    msg += `\n👥 <b>授权用户 (${permissions.length})</b>\n`;
    if (permissions.length > 0) {
      for (const perm of permissions) {
        msg += `   • ${perm.user_id} (${perm.role})\n`;
      }
    } else {
      msg += '   暂无授权用户\n';
    }
    
    msg += `\n📊 <b>统计</b>\n`;
    msg += `   总转发: ${stats.total} 条\n`;
    
    await bot.sendMessage(chatId, msg);
    return;
  }

  // /target_add
  if (text.startsWith('/target_add')) {
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await bot.sendMessage(chatId, '用法: /target_add <存储库> <目标chat_id>');
      return;
    }
    
    const repoName = args[0];
    const targetChatId = parseInt(args[1]);
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await checkForwardPermission(db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await bot.sendMessage(chatId, '❌ 只有管理员可以添加转发目标');
      return;
    }
    
    // 检测目标类型
    let targetType = 'group';
    if (targetChatId > 0) {
      targetType = 'private';
    } else if (String(targetChatId).startsWith('-100')) {
      targetType = 'channel';
    }
    
    // 尝试发送测试消息到目标
    try {
      await bot.sendMessage(
        targetChatId,
        `✅ 转发目标已添加！\n\n📦 存储库: ${repoName}\n\n现在此${targetType === 'channel' ? '频道' : '群组'}会收到转发到该存储库的内容。`
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ 无法发送消息到目标 ${targetChatId}\n\n请确保:\n1. Bot 已加入目标群组/频道\n2. Bot 有发送消息权限\n3. Chat ID 正确\n\n错误: ${error.message}`
      );
      return;
    }
    
    await addForwardTarget(db, repo.id, targetChatId, targetType);
    
    await bot.sendMessage(
      chatId,
      `✅ 转发目标已添加！\n\n📦 存储库: ${repoName}\n🎯 目标: ${targetChatId} (${targetType})`
    );
    return;
  }

  // /target_remove
  if (text.startsWith('/target_remove')) {
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await bot.sendMessage(chatId, '用法: /target_remove <存储库> <目标chat_id>');
      return;
    }
    
    const repoName = args[0];
    const targetChatId = parseInt(args[1]);
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await checkForwardPermission(db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await bot.sendMessage(chatId, '❌ 只有管理员可以移除转发目标');
      return;
    }
    
    await removeForwardTarget(db, repo.id, targetChatId);
    await bot.sendMessage(chatId, `✅ 转发目标 ${targetChatId} 已移除`);
    return;
  }

  // /target_list
  if (text.startsWith('/target_list')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /target_list <存储库>');
      return;
    }
    
    const repoName = args[0];
    const repo = await getForwardRepository(db, repoName);
    
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const targets = await listForwardTargets(db, repo.id);
    
    if (targets.length === 0) {
      await bot.sendMessage(chatId, `📦 存储库 "${repoName}" 暂无转发目标`);
      return;
    }
    
    let msg = `🎯 <b>存储库 "${repoName}" 的转发目标</b>\n\n`;
    for (const target of targets) {
      const status = target.enabled ? '✅ 启用' : '❌ 禁用';
      msg += `${status}\n`;
      msg += `   ID: ${target.target_chat_id}\n`;
      msg += `   类型: ${target.target_type}\n`;
      msg += `   创建: ${new Date(target.created_at).toLocaleString('zh-CN')}\n\n`;
    }
    
    await bot.sendMessage(chatId, msg);
    return;
  }

  // /target_toggle
  if (text.startsWith('/target_toggle')) {
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await bot.sendMessage(chatId, '用法: /target_toggle <存储库> <目标chat_id>');
      return;
    }
    
    const repoName = args[0];
    const targetChatId = parseInt(args[1]);
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await checkForwardPermission(db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await bot.sendMessage(chatId, '❌ 只有管理员可以切换目标状态');
      return;
    }
    
    await toggleForwardTarget(db, repo.id, targetChatId);
    await bot.sendMessage(chatId, `✅ 转发目标 ${targetChatId} 状态已切换`);
    return;
  }

  // /perm_grant
  if (text.startsWith('/perm_grant')) {
    const args = text.split(' ').slice(1);
    if (args.length < 3) {
      await bot.sendMessage(chatId, '用法: /perm_grant <存储库> <user_id> <role>\n角色: admin, contributor, viewer');
      return;
    }
    
    const repoName = args[0];
    const targetUserId = parseInt(args[1]);
    const role = args[2];
    
    if (!['admin', 'contributor', 'viewer'].includes(role)) {
      await bot.sendMessage(chatId, '❌ 角色必须是: admin, contributor, viewer');
      return;
    }
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await checkForwardPermission(db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await bot.sendMessage(chatId, '❌ 只有管理员可以授予权限');
      return;
    }
    
    await grantForwardPermission(db, repo.id, targetUserId, role, userId);
    await bot.sendMessage(chatId, `✅ 已授予用户 ${targetUserId} "${role}" 权限`);
    return;
  }

  // /perm_revoke
  if (text.startsWith('/perm_revoke')) {
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await bot.sendMessage(chatId, '用法: /perm_revoke <存储库> <user_id>');
      return;
    }
    
    const repoName = args[0];
    const targetUserId = parseInt(args[1]);
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await checkForwardPermission(db, repo.id, userId, 'admin');
    if (!hasPermission) {
      await bot.sendMessage(chatId, '❌ 只有管理员可以撤销权限');
      return;
    }
    
    await revokeForwardPermission(db, repo.id, targetUserId);
    await bot.sendMessage(chatId, `✅ 已撤销用户 ${targetUserId} 的权限`);
    return;
  }

  // /perm_list
  if (text.startsWith('/perm_list')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /perm_list <存储库>');
      return;
    }
    
    const repoName = args[0];
    const repo = await getForwardRepository(db, repoName);
    
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const permissions = await listForwardPermissions(db, repo.id);
    
    let msg = `👥 <b>存储库 "${repoName}" 的授权用户</b>\n\n`;
    msg += `👤 创建者: ${repo.created_by} (admin)\n\n`;
    
    if (permissions.length > 0) {
      for (const perm of permissions) {
        msg += `• ${perm.user_id} - ${perm.role}\n`;
        msg += `  授予者: ${perm.granted_by}\n`;
        msg += `  时间: ${new Date(perm.granted_at).toLocaleString('zh-CN')}\n\n`;
      }
    } else {
      msg += '暂无其他授权用户\n';
    }
    
    await bot.sendMessage(chatId, msg);
    return;
  }

  // /use
  if (text.startsWith('/use')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /use <存储库名称> 或 /use off');
      return;
    }
    
    const repoName = args[0];
    
    if (repoName === 'off') {
      userCurrentRepo.delete(userId);
      await bot.sendMessage(chatId, '✅ 已关闭自动转发');
      return;
    }
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const hasPermission = await checkForwardPermission(db, repo.id, userId, 'contributor');
    if (!hasPermission) {
      await bot.sendMessage(chatId, '❌ 你没有向此存储库发送内容的权限');
      return;
    }
    
    userCurrentRepo.set(userId, repoName);
    
    const targets = await listForwardTargets(db, repo.id);
    const enabledTargets = targets.filter(t => t.enabled);
    
    await bot.sendMessage(
      chatId,
      `✅ <b>当前存储库: ${repoName}</b>\n\n现在发送的所有消息都会转发到此存储库的 ${enabledTargets.length} 个目标\n\n发送 /use off 关闭自动转发`
    );
    return;
  }

  // /forwarded_stats
  if (text.startsWith('/forwarded_stats')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /forwarded_stats <存储库> [period]\nperiod: today, week, all');
      return;
    }
    
    const repoName = args[0];
    const period = args[1] || 'all';
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const stats = await getForwardedStats(db, repo.id, period);
    
    let msg = `📊 <b>${repoName} 转发统计</b>\n\n`;
    msg += `📅 周期: ${period === 'today' ? '今天' : period === 'week' ? '本周' : '总计'}\n`;
    msg += `📝 总计: ${stats.total} 条\n\n`;
    
    if (stats.byType.length > 0) {
      msg += `📝 <b>内容类型</b>\n`;
      for (const type of stats.byType) {
        const percentage = ((type.count / stats.total) * 100).toFixed(1);
        msg += `   ${type.message_type}: ${type.count} 条 (${percentage}%)\n`;
      }
      msg += '\n';
    }
    
    if (stats.byUser.length > 0) {
      msg += `👥 <b>贡献者排名</b>\n`;
      for (let i = 0; i < Math.min(5, stats.byUser.length); i++) {
        const userStat = stats.byUser[i];
        msg += `   ${i + 1}. ${userStat.source_user_id}: ${userStat.count} 条\n`;
      }
    }
    
    await bot.sendMessage(chatId, msg);
    return;
  }

  // /forwarded_recent
  if (text.startsWith('/forwarded_recent')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /forwarded_recent <存储库> [limit]');
      return;
    }
    
    const repoName = args[0];
    const limit = parseInt(args[1]) || 10;
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    const recent = await getRecentForwarded(db, repo.id, limit);
    
    if (recent.length === 0) {
      await bot.sendMessage(chatId, `📜 存储库 "${repoName}" 暂无转发记录`);
      return;
    }
    
    let msg = `📜 <b>${repoName} 最近转发 (${recent.length}条)</b>\n\n`;
    
    for (let i = 0; i < recent.length; i++) {
      const record = recent[i];
      const timeAgo = getTimeAgo(record.forwarded_at);
      msg += `${i + 1}. ${timeAgo}\n`;
      msg += `   用户: ${record.source_user_id}\n`;
      msg += `   类型: ${record.message_type}\n\n`;
    }
    
    await bot.sendMessage(chatId, msg);
    return;
  }

  // 检查是否有当前存储库（自动转发）
  const currentRepo = userCurrentRepo.get(userId);
  if (currentRepo && !text.startsWith('/')) {
    // 转发消息到存储库
    const repo = await getForwardRepository(db, currentRepo);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${currentRepo}" 不存在`);
      userCurrentRepo.delete(userId);
      return;
    }

    const targets = await listForwardTargets(db, repo.id);
    const enabledTargets = targets.filter(t => t.enabled);
    
    if (enabledTargets.length === 0) {
      await bot.sendMessage(chatId, '❌ 此存储库没有启用的转发目标');
      return;
    }

    // 并发转发到所有目标
    const results = await Promise.allSettled(
      enabledTargets.map(target => 
        bot.forwardMessage(target.target_chat_id, chatId, message.message_id)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // 记录转发日志
    await logForwardedMessage(db, {
      repository_id: repo.id,
      source_user_id: userId,
      source_message_id: message.message_id,
      message_type: getMessageType(message),
      forwarded_to: enabledTargets.map(t => t.target_chat_id),
      metadata: { successful, failed }
    });

    // 发送确认消息
    let confirmMsg = `✅ 已转发到 ${currentRepo}\n\n`;
    confirmMsg += `成功: ${successful} 个目标\n`;
    if (failed > 0) {
      confirmMsg += `失败: ${failed} 个目标\n`;
    }

    await bot.sendMessage(chatId, confirmMsg);
    return;
  }

  // ==================== 原有的私聊消息处理 ====================

  // 处理转发的消息 - 检测其他用户
  if (message.forward_from) {
    const targetUser = message.forward_from;
    const detection = detectBot(targetUser, { joinTime: Date.now() });
    
    const riskLevel = {
      'high': '🔴 高风险',
      'medium': '🟡 中风险', 
      'low': '🟢 低风险',
      'none': '✅ 正常'
    };

    let detectionDetails = '';
    if (detection.detections && detection.detections.length > 0) {
      detectionDetails = '\n\n<b>检测到的问题:</b>\n' + 
        detection.detections.map(d => {
          const typeNames = {
            'username_pattern': '用户名模式异常',
            'no_username': '无用户名',
            'invalid_first_name': '名称无效',
            'numeric_name': '纯数字名称',
            'fast_join': '快速加入',
            'no_profile_photo': '无头像',
            'new_account_id': '新账号',
            'official_bot_flag': '官方Bot标记',
            'spam_keyword': '垃圾关键词'
          };
          return `• ${typeNames[d.type] || d.type}`;
        }).join('\n');
    }

    // 检查是否在黑名单
    const isBlacklist = await isBlacklisted(db, targetUser.id);

    await bot.sendMessage(
      message.chat.id,
      `🔍 <b>用户检测结果</b>

👤 用户: ${targetUser.first_name}${targetUser.username ? ' (@' + targetUser.username + ')' : ''}
🆔 ID: <code>${targetUser.id}</code>
${isBlacklist ? '🚫 <b>该用户在黑名单中</b>\n' : ''}
📊 可疑评分: <b>${detection.score}</b>/100
⚠️ 风险等级: ${riskLevel[detection.level]}

判定结果:
${detection.isBot ? '❌ 识别为机器人账号' : detection.isSuspicious ? '⚠️ 有可疑行为，建议验证' : '✅ 账号正常'}
${detectionDetails}

💡 <b>建议操作:</b>
${detection.isBot ? '立即封禁此用户' : detection.isSuspicious ? '加入群组时需要验证' : '可以正常加入群组'}
      `.trim()
    );
    return;
  }

  // 处理待验证状态的回复
  const verification = await getUserVerification(db, user.id);

  if (!verification || verification.status !== 'pending') {
    await bot.sendMessage(
      message.chat.id,
      `💬 你当前没有待验证的请求

🔍 你可以:
• /check - 检测自己的账号
• 转发消息给我 - 检测其他用户
• /help - 查看帮助文档
      `.trim()
    );
    return;
  }

  // 验证答案
  if (text.toLowerCase() === verification.verification_code.toLowerCase()) {
    await updateVerificationStatus(db, user.id, 'verified');
    await bot.unrestrictChatMember(verification.chat_id, user.id);

    await bot.sendMessage(message.chat.id, '✅ 验证成功！你现在可以在群组中发言了。');
    await bot.sendMessage(
      verification.chat_id,
      `✅ ${user.first_name} 已通过验证，欢迎加入！`
    );
  } else {
    await incrementAttempts(db, user.id);
    const verification_updated = await getUserVerification(db, user.id);

    if (verification_updated.attempts >= 3) {
      await updateVerificationStatus(db, user.id, 'failed');
      await bot.kickChatMember(verification.chat_id, user.id);
      await addToBlacklist(db, user.id, 'Failed verification', null);

      await bot.sendMessage(
        message.chat.id,
        '❌ 验证失败次数过多，你已被移出群组。'
      );
    } else {
      await bot.sendMessage(
        message.chat.id,
        `❌ 答案错误，还剩 ${3 - verification_updated.attempts} 次机会`
      );
    }
  }
}

async function handleGroupMessage(message, bot, db) {
  const user = message.from;
  const text = message.text?.trim();
  const chatId = message.chat.id;

  // 检查是否是管理员命令
  if (text && text.startsWith('/')) {
    try {
      const chatMember = await bot.getChatMember(chatId, user.id);
      const isAdmin = ['creator', 'administrator'].includes(chatMember.status);
      
      if (isAdmin) {
        await handleAdminCommand(message, bot, db);
        return;
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  }

  // 原有的验证检查逻辑
  const verification = await getUserVerification(db, user.id);

  if (verification && verification.status === 'pending') {
    await bot.deleteMessage(message.chat.id, message.message_id);
  }
}

async function handleAdminCommand(message, bot, db) {
  const text = message.text.trim();
  const chatId = message.chat.id;
  const args = text.split(' ');
  const command = args[0];

  try {
    // /verify_config - 配置验证方式
    if (command === '/verify_config') {
      const type = args[1];

      if (['math', 'button', 'captcha'].includes(type)) {
        await db.prepare(`
          INSERT INTO group_configs (chat_id, verification_type, timeout_seconds, auto_ban_bots, bot_detection_level, updated_at)
          VALUES (?, ?, 300, 1, 'medium', ?)
          ON CONFLICT(chat_id) DO UPDATE SET 
            verification_type = excluded.verification_type,
            updated_at = excluded.updated_at
        `).bind(chatId, type, Date.now()).run();

        await bot.sendMessage(chatId, `✅ 验证方式已设置为: ${type}\n\n可选类型:\n• math - 数学题\n• button - 按钮选择\n• captcha - 验证码输入`);
      } else {
        await bot.sendMessage(
          chatId,
          '❌ 用法: /verify_config <类型>\n\n可选类型:\n• math - 数学题\n• button - 按钮选择\n• captcha - 验证码输入'
        );
      }
      return;
    }

    // /verify_timeout - 设置超时时间
    if (command === '/verify_timeout') {
      const seconds = parseInt(args[1]);

      if (seconds && seconds >= 60 && seconds <= 600) {
        await db.prepare(`
          INSERT INTO group_configs (chat_id, verification_type, timeout_seconds, auto_ban_bots, bot_detection_level, updated_at)
          VALUES (?, 'math', ?, 1, 'medium', ?)
          ON CONFLICT(chat_id) DO UPDATE SET 
            timeout_seconds = excluded.timeout_seconds,
            updated_at = excluded.updated_at
        `).bind(chatId, seconds, Date.now()).run();

        await bot.sendMessage(chatId, `✅ 验证超时时间已设置为: ${seconds}秒 (${Math.floor(seconds/60)}分钟)`);
      } else {
        await bot.sendMessage(chatId, '❌ 用法: /verify_timeout <秒数>\n\n范围: 60-600 秒 (1-10分钟)');
      }
      return;
    }

    // /autoban - 开关自动封禁
    if (command === '/autoban') {
      const enabled = args[1] === 'on' ? 1 : 0;

      await db.prepare(`
        INSERT INTO group_configs (chat_id, verification_type, timeout_seconds, auto_ban_bots, bot_detection_level, updated_at)
        VALUES (?, 'math', 300, ?, 'medium', ?)
        ON CONFLICT(chat_id) DO UPDATE SET 
          auto_ban_bots = excluded.auto_ban_bots,
          updated_at = excluded.updated_at
      `).bind(chatId, enabled, Date.now()).run();

      await bot.sendMessage(
        chatId,
        `✅ 自动封禁机器人已${enabled ? '开启' : '关闭'}\n\n${enabled ? '⚠️ 高可疑度账号将被自动踢出' : '📝 所有新成员都需要完成验证'}`
      );
      return;
    }

    // /blacklist - 查看黑名单
    if (command === '/blacklist') {
      const blacklist = await db.prepare(`
        SELECT user_id, reason, banned_at 
        FROM blacklist 
        ORDER BY banned_at DESC 
        LIMIT 20
      `).all();

      if (!blacklist.results || blacklist.results.length === 0) {
        await bot.sendMessage(chatId, '📋 黑名单为空');
        return;
      }

      const list = blacklist.results.map((item, i) => 
        `${i+1}. ID: <code>${item.user_id}</code>\n   原因: ${item.reason}\n   时间: ${new Date(item.banned_at).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`
      ).join('\n\n');

      await bot.sendMessage(chatId, `📋 黑名单 (最近20条):\n\n${list}`);
      return;
    }

    // /unban - 解除封禁
    if (command === '/unban') {
      const userId = parseInt(args[1]);

      if (userId) {
        const result = await db.prepare('DELETE FROM blacklist WHERE user_id = ?')
          .bind(userId)
          .run();
        
        if (result.changes > 0) {
          await bot.sendMessage(chatId, `✅ 已将用户 <code>${userId}</code> 从黑名单移除`);
        } else {
          await bot.sendMessage(chatId, `❌ 用户 <code>${userId}</code> 不在黑名单中`);
        }
      } else {
        await bot.sendMessage(chatId, '❌ 用法: /unban <用户ID>');
      }
      return;
    }

    // /ban - 手动加入黑名单
    if (command === '/ban') {
      const userId = parseInt(args[1]);
      const reason = args.slice(2).join(' ') || '管理员手动封禁';

      if (userId) {
        await addToBlacklist(db, userId, reason, message.from.id);
        
        // 尝试踢出该用户（如果在群里）
        try {
          await bot.kickChatMember(chatId, userId);
          await bot.sendMessage(chatId, `✅ 已封禁用户 <code>${userId}</code> 并移出群组\n原因: ${reason}`);
        } catch (error) {
          await bot.sendMessage(chatId, `✅ 已将用户 <code>${userId}</code> 加入黑名单\n原因: ${reason}\n\n⚠️ 该用户当前不在群组中`);
        }
      } else {
        await bot.sendMessage(chatId, '❌ 用法: /ban <用户ID> [原因]');
      }
      return;
    }

    // /stats - 统计信息
    if (command === '/stats') {
      const stats = await db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
        FROM verifications
        WHERE chat_id = ?
      `).bind(chatId).first();

      const botCount = await db.prepare(`
        SELECT COUNT(*) as count
        FROM bot_detection_log
        WHERE chat_id = ? AND action = 'auto_ban'
      `).bind(chatId).first();

      const blacklistCount = await db.prepare(`
        SELECT COUNT(*) as count FROM blacklist
      `).first();

      await bot.sendMessage(chatId, `
📊 群组统计信息

👥 验证记录:
• 总数: ${stats?.total || 0}
• ✅ 通过: ${stats?.verified || 0}
• ❌ 失败: ${stats?.failed || 0}
• ⏳ 待验证: ${stats?.pending || 0}

🤖 机器人检测:
• 自动封禁: ${botCount?.count || 0}

🚫 黑名单:
• 总数: ${blacklistCount?.count || 0}
      `.trim());
      return;
    }

    // /config - 查看当前配置
    if (command === '/config') {
      const config = await getGroupConfig(db, chatId);
      
      const typeNames = {
        'math': '数学题',
        'button': '按钮选择',
        'captcha': '验证码输入'
      };

      await bot.sendMessage(chatId, `
⚙️ 群组当前配置

🔐 验证方式: ${typeNames[config.verification_type] || config.verification_type}
⏱ 超时时间: ${config.timeout_seconds}秒 (${Math.floor(config.timeout_seconds/60)}分钟)
🤖 自动封禁: ${config.auto_ban_bots ? '开启' : '关闭'}
📊 检测级别: ${config.bot_detection_level}

修改配置:
• /verify_config <math|button|captcha>
• /verify_timeout <秒数>
• /autoban <on|off>
      `.trim());
      return;
    }

    // /help - 帮助信息
    if (command === '/help' || command === '/admin') {
      await bot.sendMessage(chatId, `
🤖 管理员命令列表

📝 配置命令:
• /config - 查看当前配置
• /verify_config <类型> - 设置验证方式
• /verify_timeout <秒> - 设置超时时间
• /autoban <on|off> - 自动封禁开关

🚫 黑名单管理:
• /blacklist - 查看黑名单
• /ban <用户ID> [原因] - 封禁用户
• /unban <用户ID> - 解除封禁

📊 统计信息:
• /stats - 查看群组统计

💡 提示:
• 所有命令仅管理员可用
• 修改配置后立即生效
• 黑名单全局生效
      `.trim());
      return;
    }

  } catch (error) {
    console.error('Error handling admin command:', error);
    await bot.sendMessage(chatId, `❌ 命令执行失败: ${error.message}`);
  }
}

// ==================== Forwarding State Management ====================
// 全局状态：用户当前选择的存储库
const userCurrentRepo = new Map(); // userId -> repoName

// ==================== Worker Entry Point ====================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // 首次请求时尝试初始化数据库（幂等操作）
      if (env.DB && url.pathname === '/webhook') {
        ctx.waitUntil(initializeDatabaseTables(env.DB));
      }

      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          worker: 'telegram-verification-bot',
          version: '1.0.0'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      if (url.pathname === '/webhook' && request.method === 'POST') {
        try {
          const update = await request.json();
          ctx.waitUntil(handleTelegramUpdate(update, env));
          
          return new Response('OK', { 
            status: 200,
            headers: corsHeaders
          });
        } catch (error) {
          console.error('Webhook processing error:', error);
          return new Response('Error processing update', { 
            status: 500,
            headers: corsHeaders
          });
        }
      }

      if (url.pathname === '/setup') {
        const webhookUrl = `${url.origin}/webhook`;
        const botToken = env.TELEGRAM_BOT_TOKEN;

        if (!botToken) {
          return new Response(JSON.stringify({
            success: false,
            error: 'TELEGRAM_BOT_TOKEN not configured'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
        
        try {
          const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: webhookUrl,
              allowed_updates: ['message', 'chat_member', 'callback_query'],
              drop_pending_updates: false
            })
          });

          const result = await response.json();
          
          return new Response(JSON.stringify({
            success: result.ok,
            webhook_url: webhookUrl,
            telegram_response: result
          }, null, 2), {
            status: result.ok ? 200 : 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      if (url.pathname === '/webhook-info') {
        const botToken = env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
          return new Response(JSON.stringify({
            error: 'TELEGRAM_BOT_TOKEN not configured'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const telegramUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
        
        try {
          const response = await fetch(telegramUrl);
          const result = await response.json();
          
          return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      if (url.pathname === '/delete-webhook') {
        const botToken = env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
          return new Response(JSON.stringify({
            error: 'TELEGRAM_BOT_TOKEN not configured'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const telegramUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
        
        try {
          const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drop_pending_updates: true })
          });
          
          const result = await response.json();
          
          return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          service: 'Telegram Verification Bot',
          version: '1.0.0',
          endpoints: {
            '/': 'API information',
            '/health': 'Health check',
            '/webhook': 'Telegram webhook (POST only)',
            '/setup': 'Setup webhook',
            '/webhook-info': 'Get webhook information',
            '/delete-webhook': 'Delete webhook'
          },
          status: 'running',
          timestamp: new Date().toISOString()
        }, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        error: 'Not Found',
        path: url.pathname
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};
