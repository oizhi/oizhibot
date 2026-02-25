#!/bin/bash

# 部署完整版转发系统

set -e

echo "🚀 开始部署转发系统..."

cd /root/.openclaw/workspace/telegram-verification-bot

# 1. 复制 bundle 到 worker.js
echo "📦 复制 worker bundle..."
cp src/worker.bundle.js src/worker.js

# 2. 检查数据库配置
echo "🗄️  数据库配置:"
echo "   Database ID: 281a317d-1ace-47b2-88f3-7853cb7398dd"
echo "   Database Name: telegram_verification"

# 3. 显示部署信息
echo ""
echo "📋 部署信息:"
echo "   Worker: telegram-verification-bot"
echo "   Main: src/worker.bundle.js"
echo "   Lines: $(wc -l < src/worker.bundle.js)"
echo "   Size: $(du -h src/worker.bundle.js | cut -f1)"

echo ""
echo "✅ 准备就绪！"
echo ""
echo "⚠️  注意: 需要 Cloudflare API Token 才能部署"
echo "   请在 Cloudflare Dashboard 手动部署，或者:"
echo "   1. 访问 https://dash.cloudflare.com"
echo "   2. 进入 Workers & Pages"
echo "   3. 找到 telegram-verification-bot"
echo "   4. 上传 src/worker.bundle.js"
echo ""
echo "📂 文件路径: $(pwd)/src/worker.bundle.js"
echo ""
echo "🔗 部署后访问: https://telegram-verification-bot.tdws.workers.dev"
