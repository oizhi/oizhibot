-- Migration V3: 添加备份频道和媒体元数据支持
-- 运行时间: 2026-02-25

-- 1. 为 forward_repositories 添加备份频道相关字段
ALTER TABLE forward_repositories ADD COLUMN backup_channel_id INTEGER;
ALTER TABLE forward_repositories ADD COLUMN backup_enabled INTEGER DEFAULT 1;

-- 2. 为 forward_targets 添加 target_title 字段（记录群组/频道名称）
ALTER TABLE forward_targets ADD COLUMN target_title TEXT;

-- 3. 为 forwarded_messages 添加媒体元数据字段
ALTER TABLE forwarded_messages ADD COLUMN media_file_id TEXT;
ALTER TABLE forwarded_messages ADD COLUMN media_file_unique_id TEXT;
ALTER TABLE forwarded_messages ADD COLUMN media_mime_type TEXT;
ALTER TABLE forwarded_messages ADD COLUMN media_file_size INTEGER;
ALTER TABLE forwarded_messages ADD COLUMN caption TEXT;
ALTER TABLE forwarded_messages ADD COLUMN backup_message_id INTEGER;

-- 4. 为 pending_group_bindings 添加 start_param 字段
ALTER TABLE pending_group_bindings ADD COLUMN start_param TEXT;

-- 5. 创建新索引
CREATE INDEX IF NOT EXISTS idx_forwarded_messages_file_id ON forwarded_messages(media_file_id);

-- 6. 更新表结构完成标记
-- 这个迁移脚本添加了以下功能：
-- - 备份频道支持（backup_channel_id, backup_enabled）
-- - 媒体文件元数据记录（file_id, file_unique_id, mime_type, file_size）
-- - 群组快捷绑定优化（start_param）
-- - 备份消息 ID 跟踪（backup_message_id）
