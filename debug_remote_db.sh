#!/bin/bash

# 远程数据库调试脚本

echo "🔍 检查远程数据库状态..."
echo ""

echo "1️⃣ 视频库列表："
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT id, name, backup_channel_id, backup_enabled FROM forward_repositories"

echo ""
echo "2️⃣ 转发目标列表（显示 enabled 状态）："
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT repo_id, target_chat_id, target_type, target_title, enabled, created_at FROM forward_targets"

echo ""
echo "3️⃣ 检查是否有 enabled=0 的目标："
npx wrangler d1 execute telegram_verification --remote \
  --command="SELECT COUNT(*) as disabled_count FROM forward_targets WHERE enabled = 0"

echo ""
echo "4️⃣ 如果有禁用的目标，启用它们："
read -p "是否启用所有禁用的转发目标？(y/n): " enable_all

if [ "$enable_all" = "y" ]; then
  npx wrangler d1 execute telegram_verification --remote \
    --command="UPDATE forward_targets SET enabled = 1 WHERE enabled = 0"
  echo "✅ 已启用所有转发目标"
fi

echo ""
echo "✅ 检查完成"
