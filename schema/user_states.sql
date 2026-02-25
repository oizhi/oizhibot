-- 用户状态表（对话式交互）
CREATE TABLE IF NOT EXISTS user_states (
    user_id INTEGER PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'idle', -- idle, forwarding, setup
    current_repo TEXT, -- 当前使用的存储库名称
    setup_step TEXT, -- 当前设置步骤：creating_repo_name, creating_repo_desc, adding_target, granting_perm_user, granting_perm_role
    setup_data TEXT, -- JSON 格式的临时数据
    message_count INTEGER DEFAULT 0, -- 转发模式下的消息计数
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_states_mode ON user_states(mode);
CREATE INDEX IF NOT EXISTS idx_user_states_repo ON user_states(current_repo);
