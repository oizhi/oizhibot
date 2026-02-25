#!/bin/bash

export CLOUDFLARE_API_TOKEN="5Ticc0IkPHvTN7PPgLQtfosDPzmyCHAlIEpOpRpB"

echo "🔧 修复 forwarded_messages 表字段名"
echo ""
echo "问题：表用 repository_id，代码用 repo_id"
echo "解决：重建表并迁移数据"
echo ""

echo "1️⃣ 创建新表..."
npx wrangler d1 execute telegram_verification --remote --command="
CREATE TABLE forwarded_messages_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  source_user_id INTEGER NOT NULL,
  source_message_id INTEGER,
  message_type TEXT,
  forwarded_to TEXT,
  forwarded_at INTEGER NOT NULL,
  metadata TEXT,
  media_file_id TEXT,
  media_file_unique_id TEXT,
  media_mime_type TEXT,
  media_file_size INTEGER,
  caption TEXT,
  backup_message_id INTEGER,
  FOREIGN KEY (repo_id) REFERENCES forward_repositories(id) ON DELETE CASCADE
)" 2>&1 | grep -E "success|ERROR"

echo ""
echo "2️⃣ 复制数据..."
npx wrangler d1 execute telegram_verification --remote --command="
INSERT INTO forwarded_messages_new 
  (id, repo_id, source_user_id, source_message_id, message_type, forwarded_to, forwarded_at, metadata, 
   media_file_id, media_file_unique_id, media_mime_type, media_file_size, caption, backup_message_id)
SELECT 
  id, repository_id, source_user_id, source_message_id, message_type, forwarded_to, forwarded_at, metadata,
  media_file_id, media_file_unique_id, media_mime_type, media_file_size, caption, backup_message_id
FROM forwarded_messages" 2>&1 | grep -E "success|ERROR|changes"

echo ""
echo "3️⃣ 删除旧表..."
npx wrangler d1 execute telegram_verification --remote --command="DROP TABLE forwarded_messages" 2>&1 | grep -E "success|ERROR"

echo ""
echo "4️⃣ 重命名新表..."
npx wrangler d1 execute telegram_verification --remote --command="ALTER TABLE forwarded_messages_new RENAME TO forwarded_messages" 2>&1 | grep -E "success|ERROR"

echo ""
echo "5️⃣ 创建索引..."
npx wrangler d1 execute telegram_verification --remote --command="CREATE INDEX IF NOT EXISTS idx_forwarded_messages_repo ON forwarded_messages(repo_id)" 2>&1 | grep -E "success|ERROR"

echo ""
echo "✅ 修复完成！"
echo ""
echo "验证结果："
npx wrangler d1 execute telegram_verification --remote --command="SELECT sql FROM sqlite_master WHERE name='forwarded_messages'" 2>&1 | grep "repo_id"
