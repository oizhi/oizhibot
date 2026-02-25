#!/bin/bash

BOT_TOKEN="8131509226:AAHBgtGDouwJ6-9FfyLfiA7qFm-2mQ-759s"

echo "🔍 Telegram Bot 诊断工具"
echo ""

echo "1️⃣ 检查 Bot 基本信息..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | jq '.'

echo ""
echo "2️⃣ 检查 Webhook 状态..."
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
echo "$WEBHOOK_INFO" | jq '.'

echo ""
echo "3️⃣ 分析 Webhook 状态..."
WEBHOOK_URL=$(echo "$WEBHOOK_INFO" | jq -r '.result.url')
PENDING_COUNT=$(echo "$WEBHOOK_INFO" | jq -r '.result.pending_update_count')
LAST_ERROR=$(echo "$WEBHOOK_INFO" | jq -r '.result.last_error_message')

if [ "$WEBHOOK_URL" == "" ] || [ "$WEBHOOK_URL" == "null" ]; then
  echo "❌ 问题：Webhook 未设置！"
  echo ""
  echo "解决方案："
  echo "  1. 先部署 Worker：npx wrangler deploy --env=\"\""
  echo "  2. 获取 Worker URL（例如：https://telegram-verification-bot.xxx.workers.dev）"
  echo "  3. 设置 Webhook："
  echo "     curl \"https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=YOUR_WORKER_URL\""
else
  echo "✅ Webhook 已设置：$WEBHOOK_URL"
  
  if [ "$PENDING_COUNT" != "0" ]; then
    echo "⚠️  有 $PENDING_COUNT 条待处理的更新"
  fi
  
  if [ "$LAST_ERROR" != "null" ] && [ "$LAST_ERROR" != "" ]; then
    echo "❌ 最后一次错误：$LAST_ERROR"
  fi
fi

echo ""
echo "4️⃣ 检查最近的更新..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=5" | jq '.result | length' | while read count; do
  if [ "$count" == "0" ]; then
    echo "ℹ️  没有待处理的更新（正常，因为 Webhook 会自动处理）"
  else
    echo "⚠️  有 $count 条未处理的更新"
    echo "    如果使用 Webhook，这些应该为 0"
  fi
done

echo ""
echo "5️⃣ 测试发送消息能力..."
# 尝试获取 bot 的 username
BOT_USERNAME=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | jq -r '.result.username')
echo "Bot 用户名：@${BOT_USERNAME}"
echo ""
echo "💡 测试方法："
echo "  1. 在 Telegram 搜索 @${BOT_USERNAME}"
echo "  2. 发送 /start"
echo "  3. 如果没有回复，查看上面的 Webhook 错误信息"
