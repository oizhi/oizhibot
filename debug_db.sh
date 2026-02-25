#!/bin/bash

# 数据库调试脚本

echo "🔍 检查数据库状态..."
echo ""

echo "1️⃣ 视频库列表："
npx wrangler d1 execute telegram_verification \
  --command="SELECT id, name, backup_channel_id, backup_enabled FROM forward_repositories"

echo ""
echo "2️⃣ 转发目标列表："
npx wrangler d1 execute telegram_verification \
  --command="SELECT repo_id, target_chat_id, target_type, target_title, enabled FROM forward_targets"

echo ""
echo "3️⃣ 用户状态："
npx wrangler d1 execute telegram_verification \
  --command="SELECT user_id, mode, current_repo FROM user_states"

echo ""
echo "4️⃣ 转发记录统计："
npx wrangler d1 execute telegram_verification \
  --command="SELECT COUNT(*) as total FROM forwarded_messages"

echo ""
echo "✅ 检查完成"
