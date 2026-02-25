#!/bin/bash

echo "🔄 远程数据库迁移到 V3"
echo ""
echo "⚠️  警告：此操作会修改远程数据库结构"
echo ""

# 检查旧表是否存在
echo "1️⃣ 检查现有表结构..."
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

echo ""
echo "2️⃣ 备份现有数据..."

# 导出现有的视频库数据
echo "  - 导出 forward_repositories..."
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT * FROM forward_repositories" > backup_repos.json 2>&1

# 导出转发目标数据
echo "  - 导出 forward_targets..."
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT * FROM forward_targets" > backup_targets.json 2>&1

echo ""
echo "✅ 备份完成（backup_*.json）"
echo ""

read -p "📋 是否继续迁移到 V3 结构？这会添加新字段但不会删除数据 (y/n): " confirm

if [ "$confirm" != "y" ]; then
  echo "❌ 取消迁移"
  exit 0
fi

echo ""
echo "3️⃣ 应用 V3 迁移脚本..."

# 方案 A：直接添加新字段（如果表已存在）
echo "  - 添加备份频道字段到 forward_repositories..."
npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forward_repositories ADD COLUMN backup_channel_id INTEGER" 2>&1 | grep -v "duplicate column name" || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forward_repositories ADD COLUMN backup_enabled INTEGER DEFAULT 1" 2>&1 | grep -v "duplicate column name" || true

echo "  - 添加标题字段到 forward_targets..."
npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forward_targets ADD COLUMN target_title TEXT" 2>&1 | grep -v "duplicate column name" || true

echo "  - 添加元数据字段到 forwarded_messages..."
npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_file_id TEXT" 2>&1 | grep -v "duplicate column name" || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_file_unique_id TEXT" 2>&1 | grep -v "duplicate column name" || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_mime_type TEXT" 2>&1 | grep -v "duplicate column name" || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN media_file_size INTEGER" 2>&1 | grep -v "duplicate column name" || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN caption TEXT" 2>&1 | grep -v "duplicate column name" || true

npx wrangler d1 execute telegram_verification --remote \
  --command="ALTER TABLE forwarded_messages ADD COLUMN backup_message_id INTEGER" 2>&1 | grep -v "duplicate column name" || true

echo ""
echo "4️⃣ 创建新表（如果不存在）..."

# 创建 V3 新增的表
npx wrangler d1 execute telegram_verification --remote --file=schema/migration_v3.sql 2>&1

echo ""
echo "5️⃣ 验证迁移结果..."

echo "  - 检查 forward_repositories 结构："
npx wrangler d1 execute telegram_verification --remote \
  --command="PRAGMA table_info(forward_repositories)" | grep -E "backup_channel_id|backup_enabled"

echo ""
echo "  - 检查 forwarded_messages 结构："
npx wrangler d1 execute telegram_verification --remote \
  --command="PRAGMA table_info(forwarded_messages)" | grep -E "media_file_id|backup_message_id"

echo ""
echo "✅ 迁移完成！"
echo ""
echo "📊 数据统计："
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT 
    (SELECT COUNT(*) FROM forward_repositories) as repos,
    (SELECT COUNT(*) FROM forward_targets) as targets,
    (SELECT COUNT(*) FROM forwarded_messages) as messages"

echo ""
echo "🚀 现在可以部署 V3 代码了："
echo "   npx wrangler deploy --env=\"\""
