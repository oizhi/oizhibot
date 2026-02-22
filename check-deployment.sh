#!/bin/bash

echo "🔍 Telegram Bot 部署诊断工具"
echo "================================"
echo ""

WORKER_URL="https://telegram-verification-bot.tdws.workers.dev"

# 1. 检查根路径
echo "1️⃣ 检查根路径 (/)..."
curl -s "$WORKER_URL/" | jq . 2>/dev/null || curl -s "$WORKER_URL/"
echo ""
echo ""

# 2. 检查健康检查
echo "2️⃣ 检查健康检查 (/health)..."
curl -s "$WORKER_URL/health" | jq . 2>/dev/null || curl -s "$WORKER_URL/health"
echo ""
echo ""

# 3. 检查 webhook 信息
echo "3️⃣ 检查 Webhook 信息 (/webhook-info)..."
curl -s "$WORKER_URL/webhook-info" | jq . 2>/dev/null || curl -s "$WORKER_URL/webhook-info"
echo ""
echo ""

# 4. 尝试设置 webhook
echo "4️⃣ 尝试设置 Webhook (/setup)..."
curl -s "$WORKER_URL/setup" | jq . 2>/dev/null || curl -s "$WORKER_URL/setup"
echo ""
echo ""

echo "================================"
echo "✅ 诊断完成"
echo ""
echo "📋 常见问题排查："
echo "1. 如果所有请求都超时 → Worker 未部署或 URL 错误"
echo "2. 如果返回 'TELEGRAM_BOT_TOKEN not configured' → 需要设置 secret"
echo "3. 如果返回 'your-database-id' → 需要配置 D1 数据库 ID"
echo "4. 如果 Telegram 机器人无响应 → webhook 可能未正确设置"
echo ""
echo "🔧 修复步骤："
echo "   wrangler secret put TELEGRAM_BOT_TOKEN"
echo "   wrangler d1 create telegram_verification"
echo "   # 更新 wrangler.toml 中的 database_id"
echo "   wrangler deploy"
