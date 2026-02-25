#!/bin/bash

# V3 功能测试脚本
# 使用方法: ./test_v3.sh <worker_url> <test_chat_id>

WORKER_URL=$1
TEST_CHAT_ID=$2

if [ -z "$WORKER_URL" ] || [ -z "$TEST_CHAT_ID" ]; then
  echo "用法: ./test_v3.sh <worker_url> <test_chat_id>"
  echo "示例: ./test_v3.sh https://your-worker.workers.dev 123456789"
  exit 1
fi

echo "🧪 开始测试 V3 功能..."
echo "📍 Worker URL: $WORKER_URL"
echo "👤 Test Chat ID: $TEST_CHAT_ID"
echo ""

# 测试 1: Webhook 健康检查
echo "✅ 测试 1: Webhook 健康检查"
curl -s "$WORKER_URL/webhook" | grep -q "OK" && echo "   ✓ Webhook 可访问" || echo "   ✗ Webhook 不可访问"
echo ""

# 测试 2: 模拟 /start 命令
echo "✅ 测试 2: 模拟 /start 命令"
curl -X POST "$WORKER_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": {"id": '${TEST_CHAT_ID}', "first_name": "Test"},
      "chat": {"id": '${TEST_CHAT_ID}', "type": "private"},
      "date": '$(date +%s)',
      "text": "/start"
    }
  }' && echo "   ✓ /start 命令已发送" || echo "   ✗ /start 命令发送失败"
echo ""

# 测试 3: 模拟 Bot 加入群组
echo "✅ 测试 3: 模拟 Bot 加入群组"
curl -X POST "$WORKER_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 2,
    "my_chat_member": {
      "chat": {"id": -1001234567890, "type": "supergroup", "title": "Test Group"},
      "from": {"id": '${TEST_CHAT_ID}', "first_name": "Test"},
      "date": '$(date +%s)',
      "old_chat_member": {"status": "left", "user": {"id": 987654321}},
      "new_chat_member": {"status": "member", "user": {"id": 987654321}}
    }
  }' && echo "   ✓ Bot 加入群组事件已发送" || echo "   ✗ Bot 加入群组事件发送失败"
echo ""

# 测试 4: 模拟 /bind 命令
echo "✅ 测试 4: 模拟 /bind 命令"
curl -X POST "$WORKER_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 3,
    "message": {
      "message_id": 2,
      "from": {"id": '${TEST_CHAT_ID}', "first_name": "Test"},
      "chat": {"id": -1001234567890, "type": "supergroup", "title": "Test Group"},
      "date": '$(date +%s)',
      "text": "/bind test_repo"
    }
  }' && echo "   ✓ /bind 命令已发送" || echo "   ✗ /bind 命令发送失败"
echo ""

# 测试 5: 检查数据库表是否存在
echo "✅ 测试 5: 验证数据库结构"
echo "   ℹ️  请手动运行以下命令验证："
echo "   npx wrangler d1 execute telegram_verification --command=\"SELECT backup_channel_id FROM forward_repositories LIMIT 1\""
echo ""

echo "🎉 测试完成！"
echo ""
echo "📝 下一步："
echo "1. 在 Telegram 中私聊 Bot 发送 /start"
echo "2. 创建一个测试视频库"
echo "3. 点击「🔗 邀请链接」获取邀请链接"
echo "4. 创建一个测试群组并使用邀请链接添加 Bot"
echo "5. 在群组中发送 /bind 测试绑定功能"
echo "6. 设置备份频道并测试转发功能"
