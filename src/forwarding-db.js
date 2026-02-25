// ==================== Forwarding System Database ====================

// 存储库管理
async function createRepository(db, data) {
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
    if (error.message.includes('UNIQUE')) {
      return { success: false, error: 'repository_exists' };
    }
    throw error;
  }
}

async function getRepository(db, name) {
  return await db
    .prepare('SELECT * FROM forward_repositories WHERE name = ?')
    .bind(name)
    .first();
}

async function listRepositories(db, userId = null) {
  if (userId) {
    // 只返回用户有权限的存储库
    return await db
      .prepare(`
        SELECT DISTINCT r.* FROM forward_repositories r
        LEFT JOIN forward_permissions p ON r.id = p.repository_id
        WHERE r.created_by = ? OR p.user_id = ?
        ORDER BY r.created_at DESC
      `)
      .bind(userId, userId)
      .all();
  }
  
  // 返回所有存储库
  return await db
    .prepare('SELECT * FROM forward_repositories ORDER BY created_at DESC')
    .all();
}

async function deleteRepository(db, name) {
  await db
    .prepare('DELETE FROM forward_repositories WHERE name = ?')
    .bind(name)
    .run();
}

async function updateRepository(db, name, data) {
  const { description } = data;
  await db
    .prepare(`
      UPDATE forward_repositories 
      SET description = ?, updated_at = ?
      WHERE name = ?
    `)
    .bind(description, Date.now(), name)
    .run();
}

// 转发目标管理
async function addForwardTarget(db, repoId, targetChatId, targetType) {
  const now = Date.now();
  await db
    .prepare(`
      INSERT INTO forward_targets (repository_id, target_chat_id, target_type, enabled, created_at)
      VALUES (?, ?, ?, 1, ?)
    `)
    .bind(repoId, targetChatId, targetType, now)
    .run();
}

async function removeForwardTarget(db, repoId, targetChatId) {
  await db
    .prepare('DELETE FROM forward_targets WHERE repository_id = ? AND target_chat_id = ?')
    .bind(repoId, targetChatId)
    .run();
}

async function listForwardTargets(db, repoId) {
  const result = await db
    .prepare('SELECT * FROM forward_targets WHERE repository_id = ? ORDER BY created_at')
    .bind(repoId)
    .all();
  return result.results || [];
}

async function toggleForwardTarget(db, repoId, targetChatId) {
  await db
    .prepare(`
      UPDATE forward_targets 
      SET enabled = 1 - enabled 
      WHERE repository_id = ? AND target_chat_id = ?
    `)
    .bind(repoId, targetChatId)
    .run();
}

// 权限管理
async function grantPermission(db, repoId, userId, role, grantedBy) {
  const now = Date.now();
  
  try {
    await db
      .prepare(`
        INSERT INTO forward_permissions (repository_id, user_id, role, granted_by, granted_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(repository_id, user_id) 
        DO UPDATE SET role = ?, granted_by = ?, granted_at = ?
      `)
      .bind(repoId, userId, role, grantedBy, now, role, grantedBy, now)
      .run();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function revokePermission(db, repoId, userId) {
  await db
    .prepare('DELETE FROM forward_permissions WHERE repository_id = ? AND user_id = ?')
    .bind(repoId, userId)
    .run();
}

async function checkPermission(db, repoId, userId, requiredRole = 'contributor') {
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
}

async function listPermissions(db, repoId) {
  const result = await db
    .prepare('SELECT * FROM forward_permissions WHERE repository_id = ? ORDER BY granted_at')
    .bind(repoId)
    .all();
  return result.results || [];
}

// 消息记录
async function logForwardedMessage(db, data) {
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
}

async function getForwardedStats(db, repoId, period = 'all') {
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
}

async function getRecentForwarded(db, repoId, limit = 10) {
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
}

module.exports = {
  // 存储库
  createRepository,
  getRepository,
  listRepositories,
  deleteRepository,
  updateRepository,
  
  // 目标
  addForwardTarget,
  removeForwardTarget,
  listForwardTargets,
  toggleForwardTarget,
  
  // 权限
  grantPermission,
  revokePermission,
  checkPermission,
  listPermissions,
  
  // 消息记录
  logForwardedMessage,
  getForwardedStats,
  getRecentForwarded
};
