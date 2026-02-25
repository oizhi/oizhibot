-- 转发系统数据库设计

-- 存储库表
CREATE TABLE IF NOT EXISTS forward_repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,           -- 存储库名称（唯一标识）
    description TEXT,                     -- 描述
    created_by INTEGER NOT NULL,          -- 创建者 user_id
    created_at INTEGER NOT NULL,
    updated_at INTEGER
);

-- 存储库目标映射表（一个存储库可以转发到多个目标）
CREATE TABLE IF NOT EXISTS forward_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_id INTEGER NOT NULL,       -- 关联的存储库
    target_chat_id INTEGER NOT NULL,      -- 目标频道/群组 ID
    target_type TEXT CHECK(target_type IN ('channel', 'group', 'private')),
    enabled INTEGER DEFAULT 1,            -- 是否启用
    created_at INTEGER NOT NULL,
    FOREIGN KEY (repository_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
);

-- 消息记录表（记录转发的消息，不存储实际内容）
CREATE TABLE IF NOT EXISTS forwarded_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_id INTEGER NOT NULL,       -- 所属存储库
    source_user_id INTEGER NOT NULL,      -- 发送者
    source_message_id INTEGER,            -- 原消息 ID
    message_type TEXT,                    -- 消息类型: text, photo, document, video_link, etc.
    forwarded_to TEXT,                    -- JSON 数组：已转发到的目标 chat_id
    forwarded_at INTEGER NOT NULL,
    metadata TEXT,                        -- JSON: 额外信息（标题、标签等）
    FOREIGN KEY (repository_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
);

-- 用户权限表（谁可以向哪个存储库发送内容）
CREATE TABLE IF NOT EXISTS forward_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT CHECK(role IN ('admin', 'contributor', 'viewer')) DEFAULT 'contributor',
    granted_by INTEGER NOT NULL,
    granted_at INTEGER NOT NULL,
    UNIQUE(repository_id, user_id),
    FOREIGN KEY (repository_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_forward_targets_repo ON forward_targets(repository_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_messages_repo ON forwarded_messages(repository_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_messages_user ON forwarded_messages(source_user_id);
CREATE INDEX IF NOT EXISTS idx_forward_permissions_repo ON forward_permissions(repository_id);
CREATE INDEX IF NOT EXISTS idx_forward_permissions_user ON forward_permissions(user_id);
