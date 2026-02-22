#!/bin/bash

# Telegram Verification Bot - 数据库初始化脚本

echo "🔧 开始初始化 Telegram Verification Bot 数据库..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否在项目目录
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 从 wrangler.toml 读取数据库配置
DATABASE_NAME=$(grep 'database_name' wrangler.toml | sed 's/.*= *"\([^"]*\)".*/\1/')
DATABASE_ID=$(grep 'database_id' wrangler.toml | sed 's/.*= *"\([^"]*\)".*/\1/')

if [ -z "$DATABASE_NAME" ]; then
    echo -e "${YELLOW}⚠️  wrangler.toml 中未找到 database_name${NC}"
    echo "请输入数据库名称 (默认: telegram_verification):"
    read -r input_name
    DATABASE_NAME=${input_name:-telegram_verification}
fi

if [ -z "$DATABASE_ID" ]; then
    echo -e "${YELLOW}📦 数据库不存在，正在创建...${NC}"
    
    # 创建数据库
    CREATE_OUTPUT=$(wrangler d1 create "$DATABASE_NAME" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库创建成功${NC}"
        echo "$CREATE_OUTPUT"
        
        # 提取 database_id
        DATABASE_ID=$(echo "$CREATE_OUTPUT" | grep 'database_id' | sed 's/.*= *"\([^"]*\)".*/\1/')
        
        if [ -n "$DATABASE_ID" ]; then
            echo -e "${YELLOW}📝 请将以下配置添加到 wrangler.toml:${NC}"
            echo ""
            echo "[[d1_databases]]"
            echo "binding = \"DB\""
            echo "database_name = \"$DATABASE_NAME\""
            echo "database_id = \"$DATABASE_ID\""
            echo ""
            echo -e "${YELLOW}是否自动更新 wrangler.toml? (y/n)${NC}"
            read -r auto_update
            
            if [ "$auto_update" = "y" ] || [ "$auto_update" = "Y" ]; then
                # 备份原文件
                cp wrangler.toml wrangler.toml.backup
                
                # 更新 database_id
                sed -i "s/database_id = \".*\"/database_id = \"$DATABASE_ID\"/" wrangler.toml
                
                echo -e "${GREEN}✅ wrangler.toml 已更新 (备份: wrangler.toml.backup)${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ 数据库创建失败${NC}"
        echo "$CREATE_OUTPUT"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 找到数据库: $DATABASE_NAME (ID: $DATABASE_ID)${NC}"
fi

# 执行 schema
echo ""
echo -e "${YELLOW}📊 初始化数据库表结构...${NC}"

if [ ! -f "schema/schema.sql" ]; then
    echo -e "${RED}❌ 找不到 schema/schema.sql${NC}"
    exit 1
fi

SCHEMA_OUTPUT=$(wrangler d1 execute "$DATABASE_NAME" --file=schema/schema.sql 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库表初始化成功${NC}"
    echo "$SCHEMA_OUTPUT"
else
    echo -e "${RED}❌ 数据库表初始化失败${NC}"
    echo "$SCHEMA_OUTPUT"
    exit 1
fi

# 验证表是否创建成功
echo ""
echo -e "${YELLOW}🔍 验证表结构...${NC}"

VERIFY_OUTPUT=$(wrangler d1 execute "$DATABASE_NAME" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库表验证成功${NC}"
    echo "$VERIFY_OUTPUT"
else
    echo -e "${RED}❌ 数据库表验证失败${NC}"
    echo "$VERIFY_OUTPUT"
fi

# 完成
echo ""
echo -e "${GREEN}🎉 数据库初始化完成！${NC}"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 配置 Bot Token:"
echo "   wrangler secret put TELEGRAM_BOT_TOKEN"
echo ""
echo "2. 部署 Worker:"
echo "   wrangler deploy"
echo ""
echo "3. 设置 Webhook:"
echo "   curl https://telegram-verification-bot.tdws.workers.dev/setup"
echo ""
echo "4. 测试健康检查:"
echo "   curl https://telegram-verification-bot.tdws.workers.dev/health"
