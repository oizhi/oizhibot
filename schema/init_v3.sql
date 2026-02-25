-- V3 完整数据库初始化脚本
-- 包含所有必要的表结构

-- 1. 用户状态表
CREATE TABLE IF NOT EXISTS user_states (
  user_id INTEGER PRIMARY KEY,
  mode TEXT DEFAULT 'idle',
  current_repo TEXT,
  setup_step TEXT,
  setup_data TEXT,
  message_count INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 2. 视频库表（包含备份频道字段）
CREATE TABLE IF NOT EXISTS forward_repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by INTEGER NOT NULL,
  backup_channel_id INTEGER,           -- 备份频道 ID
  backup_enabled INTEGER DEFAULT 1,    -- 备份功能开关
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- 3. 转发目标表（包含群组标题）
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
);

-- 4. 权限表
CREATE TABLE IF NOT EXISTS forward_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT CHECK(role IN ('admin', 'contributor', 'viewer')) DEFAULT 'contributor',
  granted_by INTEGER NOT NULL,
  granted_at INTEGER NOT NULL,
  UNIQUE(repo_id, user_id),
  FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
);

-- 5. 转发消息记录表（包含媒体元数据）
CREATE TABLE IF NOT EXISTS forwarded_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  source_user_id INTEGER NOT NULL,
  source_message_id INTEGER,
  message_type TEXT,
  media_file_id TEXT,                  -- Telegram file_id
  media_file_unique_id TEXT,           -- Telegram file_unique_id
  media_mime_type TEXT,                -- MIME 类型
  media_file_size INTEGER,             -- 文件大小
  caption TEXT,                        -- 媒体标题
  forwarded_to TEXT,                   -- JSON 数组
  backup_message_id INTEGER,           -- 备份频道中的消息 ID
  forwarded_at INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
);

-- 6. 待绑定群组表
CREATE TABLE IF NOT EXISTS pending_group_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  chat_type TEXT NOT NULL,
  chat_title TEXT,
  repo_id INTEGER,
  added_by INTEGER NOT NULL,
  start_param TEXT,                    -- /start 参数
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(chat_id)
);

-- 7. 创建所有索引
CREATE INDEX IF NOT EXISTS idx_forward_targets_repo ON forward_targets(repo_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_messages_repo ON forwarded_messages(repo_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_messages_user ON forwarded_messages(source_user_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_messages_file_id ON forwarded_messages(media_file_id);
CREATE INDEX IF NOT EXISTS idx_forward_permissions_repo ON forward_permissions(repo_id);
CREATE INDEX IF NOT EXISTS idx_forward_permissions_user ON forward_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_bindings_expires ON pending_group_bindings(expires_at);
