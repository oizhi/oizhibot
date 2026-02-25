#!/bin/bash

# 🚀 V3 一键部署脚本
# 使用方法: ./deploy_v3.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署 Telegram Bot V3..."
echo ""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: 检查环境
echo "📋 Step 1: 检查部署环境..."

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx 未安装，请先安装 Node.js${NC}"
    exit 1
fi

if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}⚠️  wrangler 未安装，正在安装...${NC}"
    npm install -g wrangler
fi

echo -e "${GREEN}✅ 环境检查完成${NC}"
echo ""

# Step 2: 备份现有文件
echo "💾 Step 2: 备份现有文件..."

if [ -f "src/index.js" ]; then
    BACKUP_FILE="src/index.backup.$(date +%Y%m%d_%H%M%S).js"
    cp src/index.js "$BACKUP_FILE"
    echo -e "${GREEN}✅ 已备份到: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  src/index.js 不存在，跳过备份${NC}"
fi

echo ""

# Step 3: 备份数据库（可选）
echo "💾 Step 3: 备份数据库（可选）..."
read -p "是否备份数据库？(y/n) [默认: y]: " backup_db
backup_db=${backup_db:-y}

if [ "$backup_db" = "y" ] || [ "$backup_db" = "Y" ]; then
    DB_BACKUP="backup.$(date +%Y%m%d_%H%M%S).sql"
    echo "正在导出数据库..."
    
    if npx wrangler d1 export telegram_verification --output="$DB_BACKUP" 2>/dev/null; then
        echo -e "${GREEN}✅ 数据库已备份到: $DB_BACKUP${NC}"
    else
        echo -e "${YELLOW}⚠️  数据库导出失败（可能是首次部署）${NC}"
    fi
else
    echo "⏭️  跳过数据库备份"
fi

echo ""

# Step 4: 应用数据库迁移
echo "🔧 Step 4: 应用数据库迁移..."

if [ -f "schema/migration_v3.sql" ]; then
    echo "正在应用 migration_v3.sql..."
    
    if npx wrangler d1 execute telegram_verification --file=schema/migration_v3.sql 2>/dev/null; then
        echo -e "${GREEN}✅ 数据库迁移完成${NC}"
    else
        echo -e "${YELLOW}⚠️  数据库迁移失败（可能已经应用过或数据库不存在）${NC}"
    fi
else
    echo -e "${RED}❌ migration_v3.sql 不存在${NC}"
    exit 1
fi

echo ""

# Step 5: 替换代码文件
echo "📝 Step 5: 替换代码文件..."

if [ -f "src/index.enhanced.js" ]; then
    cp src/index.enhanced.js src/index.js
    echo -e "${GREEN}✅ 已更新 src/index.js${NC}"
else
    echo -e "${RED}❌ src/index.enhanced.js 不存在${NC}"
    exit 1
fi

echo ""

# Step 6: 部署到 Cloudflare Workers
echo "🚀 Step 6: 部署到 Cloudflare Workers..."

read -p "确认部署到 Cloudflare Workers？(y/n) [默认: y]: " confirm_deploy
confirm_deploy=${confirm_deploy:-y}

if [ "$confirm_deploy" = "y" ] || [ "$confirm_deploy" = "Y" ]; then
    echo "正在部署..."
    
    if npx wrangler deploy; then
        echo -e "${GREEN}✅ 部署成功！${NC}"
    else
        echo -e "${RED}❌ 部署失败${NC}"
        exit 1
    fi
else
    echo "⏭️  跳过部署"
fi

echo ""

# Step 7: 设置 Webhook（可选）
echo "🔗 Step 7: 设置 Webhook（可选）..."

read -p "是否需要设置 Webhook？(y/n) [默认: n]: " setup_webhook
setup_webhook=${setup_webhook:-n}

if [ "$setup_webhook" = "y" ] || [ "$setup_webhook" = "Y" ]; then
    read -p "请输入 Worker URL（例如：https://your-worker.workers.dev）: " worker_url
    
    if [ -n "$worker_url" ]; then
        read -p "请输入 Bot Token: " bot_token
        
        WEBHOOK_URL="${worker_url}/webhook"
        echo "正在设置 Webhook: $WEBHOOK_URL"
        
        RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${bot_token}/setWebhook" \
          -H "Content-Type: application/json" \
          -d "{\"url\": \"${WEBHOOK_URL}\"}")
        
        if echo "$RESPONSE" | grep -q '"ok":true'; then
            echo -e "${GREEN}✅ Webhook 设置成功${NC}"
        else
            echo -e "${RED}❌ Webhook 设置失败: $RESPONSE${NC}"
        fi
    fi
else
    echo "⏭️  跳过 Webhook 设置"
fi

echo ""

# Step 8: 验证部署
echo "✅ Step 8: 验证部署..."

read -p "是否运行自动测试？(y/n) [默认: n]: " run_test
run_test=${run_test:-n}

if [ "$run_test" = "y" ] || [ "$run_test" = "Y" ]; then
    read -p "请输入 Worker URL: " worker_url
    read -p "请输入测试用 Chat ID: " test_chat_id
    
    if [ -n "$worker_url" ] && [ -n "$test_chat_id" ]; then
        if [ -f "./test_v3.sh" ]; then
            chmod +x ./test_v3.sh
            ./test_v3.sh "$worker_url" "$test_chat_id"
        else
            echo -e "${RED}❌ test_v3.sh 不存在${NC}"
        fi
    fi
else
    echo "⏭️  跳过自动测试"
fi

echo ""

# 部署总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 下一步操作："
echo "1️⃣  在 Telegram 中私聊 Bot 发送 /start"
echo "2️⃣  创建一个测试视频库"
echo "3️⃣  点击「🔗 邀请链接」获取邀请链接"
echo "4️⃣  使用邀请链接添加 Bot 到群组"
echo "5️⃣  在群组中发送 /bind 测试绑定"
echo "6️⃣  设置备份频道并测试转发"
echo ""
echo "📚 文档："
echo "• 部署指南: DEPLOYMENT_V3.md"
echo "• 功能对比: FEATURE_COMPARISON.md"
echo "• 迁移脚本: schema/migration_v3.sql"
echo ""
echo "🐛 调试命令："
echo "• 查看日志: npx wrangler tail"
echo "• 查询数据: npx wrangler d1 execute telegram_verification --command=\"SELECT * FROM forward_repositories\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
