/**
 * 数据库操作封装
 */

export async function initDatabase(env) {
  // 数据库初始化逻辑（如果需要）
  return env.DB;
}

export async function getUserVerification(db, userId) {
  const result = await db
    .prepare('SELECT * FROM verifications WHERE user_id = ?')
    .bind(userId)
    .first();
  return result;
}

export async function createVerification(db, data) {
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

export async function updateVerificationStatus(db, userId, status) {
  await db
    .prepare('UPDATE verifications SET status = ?, verified_at = ? WHERE user_id = ?')
    .bind(status, Date.now(), userId)
    .run();
}

export async function incrementAttempts(db, userId) {
  await db
    .prepare('UPDATE verifications SET attempts = attempts + 1 WHERE user_id = ?')
    .bind(userId)
    .run();
}

export async function isBlacklisted(db, userId) {
  const result = await db
    .prepare('SELECT 1 FROM blacklist WHERE user_id = ?')
    .bind(userId)
    .first();
  return !!result;
}

export async function addToBlacklist(db, userId, reason, bannedBy = null) {
  await db
    .prepare(
      `INSERT OR REPLACE INTO blacklist (user_id, reason, banned_at, banned_by, metadata)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(userId, reason, Date.now(), bannedBy, JSON.stringify({}))
    .run();
}

export async function getGroupConfig(db, chatId) {
  const result = await db
    .prepare('SELECT * FROM group_configs WHERE chat_id = ?')
    .bind(chatId)
    .first();

  // 返回默认配置如果不存在
  return result || {
    chat_id: chatId,
    verification_type: 'math',
    timeout_seconds: 300,
    auto_ban_bots: 1,
    bot_detection_level: 'medium'
  };
}

export async function logBotDetection(db, data) {
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

export async function getBotDetectionScore(db, userId) {
  const result = await db
    .prepare('SELECT SUM(score) as total_score FROM bot_detection_log WHERE user_id = ? AND detected_at > ?')
    .bind(userId, Date.now() - 86400000) // 最近24小时
    .first();

  return result?.total_score || 0;
}
