-- 用户验证记录表
CREATE TABLE IF NOT EXISTS verifications (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    chat_id INTEGER,
    status TEXT CHECK(status IN ('pending', 'verified', 'failed', 'banned')),
    verification_code TEXT,
    attempts INTEGER DEFAULT 0,
    created_at INTEGER,
    verified_at INTEGER,
    metadata TEXT  -- JSON 格式存储额外信息
);

-- 黑名单表
CREATE TABLE IF NOT EXISTS blacklist (
    user_id INTEGER PRIMARY KEY,
    reason TEXT,
    banned_at INTEGER,
    banned_by INTEGER,
    metadata TEXT
);

-- 群组配置表
CREATE TABLE IF NOT EXISTS group_configs (
    chat_id INTEGER PRIMARY KEY,
    verification_type TEXT CHECK(verification_type IN ('math', 'button', 'captcha', 'custom')),
    timeout_seconds INTEGER DEFAULT 300,
    auto_ban_bots INTEGER DEFAULT 1,
    welcome_message TEXT,
    bot_detection_level TEXT CHECK(bot_detection_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
    created_at INTEGER,
    updated_at INTEGER
);

-- 机器人检测日志表
CREATE TABLE IF NOT EXISTS bot_detection_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    chat_id INTEGER,
    detection_type TEXT,  -- 'fast_join', 'no_profile', 'pattern_match', etc.
    score INTEGER,  -- 可疑分数
    action TEXT,  -- 'warned', 'kicked', 'banned'
    detected_at INTEGER,
    metadata TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_verifications_chat ON verifications(chat_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_detection_user ON bot_detection_log(user_id);
CREATE INDEX IF NOT EXISTS idx_detection_chat ON bot_detection_log(chat_id);
