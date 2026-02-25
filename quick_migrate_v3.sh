#!/bin/bash

echo "🔧 快速修复：远程数据库迁移到 V3"
echo ""
echo "问题：远程数据库缺少 V3 新字段"
echo "解决：使用 ALTER TABLE 添加新字段"
echo ""

read -p "📋 确认开始迁移？(y/n): " confirm
if [ "$confirm" != "y" ]; then
  echo "❌ 取消"
  exit 0
fi

echo ""
echo "🚀 开始迁移..."

# 1. 修复 forward_repositories 表
echo ""
echo "1️⃣ 修复 forward_repositories 表..."
npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forward_repositories ADD COLUMN backup_channel_id INTEGER" 2>&1 || echo "  (字段可能已存在)"

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forward_repositories ADD COLUMN backup_enabled INTEGER DEFAULT 1" 2>&1 || echo "  (字段可能已存在)"

# 2. 修复 forward_targets 表（repository_id -> repo_id）
echo ""
echo "2️⃣ 修复 forward_targets 表..."

# 检查是否需要重命名字段
echo "  检查表结构..."
TABLE_INFO=$(npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT sql FROM sqlite_master WHERE name='forward_targets'" 2>&1)

if echo "$TABLE_INFO" | grep -q "repository_id"; then
  echo "  发现旧字段 repository_id，需要重建表..."
  
  # 创建新表
  npx wrangler d1 execute telegram_verification --remote \
    --command="CREATE TABLE forward_targets_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      target_chat_id INTEGER NOT NULL,
      target_type TEXT,
      target_title TEXT,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      UNIQUE(repo_id, target_chat_id)
    )" 2>&1
  
  # 复制数据
  npx wrangler d1 execute telegram_verification --remote \
    --command="INSERT INTO forward_targets_new (id, repo_id, target_chat_id, target_type, enabled, created_at)
               SELECT id, repository_id, target_chat_id, target_type, enabled, created_at 
               FROM forward_targets" 2>&1
  
  # 删除旧表
  npx wrangler d1 execute telegram_verification --remote \
    --command="DROP TABLE forward_targets" 2>&1
  
  # 重命名新表
  npx wrangler d1 execute telegram_verification --remote \
    --command="ALTER TABLE forward_targets_new RENAME TO forward_targets" 2>&1
  
  echo "  ✅ 表重建完成"
else
  echo "  表结构正确，添加缺失字段..."
  npx wrangler d1 execute telegram_verification --remote \
    --command="ALTER TABLE forward_targets ADD COLUMN target_title TEXT" 2>&1 || echo "  (字段可能已存在)"
fi

# 3. 修复 forwarded_messages 表
echo ""
echo "3️⃣ 添加媒体元数据字段..."
npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_file_id TEXT" 2>&1 || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_file_unique_id TEXT" 2>&1 || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_mime_type TEXT" 2>&1 || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_file_size INTEGER" 2>&1 || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN caption TEXT" 2>&1 || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN backup_message_id INTEGER" 2>&1 || true

# 4. 创建新表
echo ""
echo "4️⃣ 创建 V3 新增表..."
npx wrangler d1 execute telegram_verification --remote \
  --command="CREATE TABLE IF NOT EXISTS user_states (
    user_id INTEGER PRIMARY KEY,
    mode TEXT DEFAULT 'idle',
    current_repo TEXT,
    setup_step TEXT,
    setup_data TEXT,
    message_count INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )" 2>&1

npx wrangler d1 execute telegram_verification --remote \
  --command="CREATE TABLE IF NOT EXISTS pending_group_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    chat_type TEXT NOT NULL,
    chat_title TEXT,
    repo_id INTEGER,
    added_by INTEGER NOT NULL,
    start_param TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    UNIQUE(chat_id)
  )" 2>&1

# 5. 创建索引
echo ""
echo "5️⃣ 创建索引..."
npx wrangler d1 execute telegram_verification --remote \
  --command="CREATE INDEX IF NOT EXISTS idx_forwarded_messages_file_id ON forwarded_messages(media_file_id)" 2>&1

npx wrangler d1 execute telegram_verification --remote \
  --command="CREATE INDEX IF NOT EXISTS idx_pending_bindings_expires ON pending_group_bindings(expires_at)" 2>&1

echo ""
echo "✅ 迁移完成！"
echo ""
echo "🔍 验证结果..."
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

echo ""
echo "🚀 现在可以部署了："
echo "   npx wrangler deploy --env=\"\""
