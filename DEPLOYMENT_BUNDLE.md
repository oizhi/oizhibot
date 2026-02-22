# Deployment Guide - Bundle Version

## 已完成修复

✅ **问题**: Worker 使用 ES6 模块导入，在 Cloudflare Workers 中需要特殊配置  
✅ **解决**: 创建了 `src/worker.bundle.js` - 所有代码合并到单文件

## 部署步骤

### 1. 配置已更新
`wrangler.toml` 已自动更新为使用 `src/worker.bundle.js`

### 2. 部署
```bash
cd /root/.openclaw/workspace/telegram-verification-bot
wrangler deploy
```

### 3. 验证
访问以下 URL 确认：
- https://telegram-verification-bot.tdws.workers.dev/health
- https://telegram-verification-bot.tdws.workers.dev/webhook-info

### 4. 设置 Webhook
访问：
- https://telegram-verification-bot.tdws.workers.dev/setup

或使用命令：
```bash
curl https://telegram-verification-bot.tdws.workers.dev/setup
```

## 完整功能说明

Bundle 版本包含所有功能：

### ✅ 新成员验证
- 自动限制新成员权限
- 发送验证挑战（数学题/按钮选择/验证码）
- 3次验证失败自动踢出

### ✅ 机器人检测
- 10维度检测算法
- 自动封禁高风险账号
- 可疑账号强制验证

### ✅ 黑名单管理
- 自动加入黑名单
- 黑名单用户无法再次加入

### ✅ 群组配置
- 支持多群组独立配置
- 可配置验证类型、超时时间、自动封禁等

## 测试 Bot

1. **添加 Bot 到群组**
   - 给予管理员权限（限制用户、删除消息、踢人）

2. **测试验证流程**
   - 邀请测试用户加入群组
   - Bot 会自动发送验证挑战
   - 点击正确答案完成验证

3. **测试机器人检测**
   - 测试账号名包含 "bot"、纯数字名等
   - 应该被自动检测并封禁

## 文件说明

- `src/worker.bundle.js` - **完整合并版本**（生产使用）
- `src/worker.js` - 原始模块化版本（需要构建工具）
- `src/worker.test.js` - 简化测试版本（仅基础框架）

## 下一步优化（可选）

1. **超时踢人功能**
   - 使用 Cloudflare Durable Objects 或 Queues
   - 当前版本依赖群组设置的自动超时

2. **管理员命令**
   - `/admin blacklist <user_id>` - 手动加黑名单
   - `/admin config` - 查看群组配置
   - `/admin stats` - 查看统计数据

3. **多语言支持**
   - 根据群组语言自动切换
   - 支持英文、中文、其他语言

## 需要帮助？

如果遇到问题，查看：
- `TROUBLESHOOTING.md` - 故障排查指南
- `README.md` - 完整文档
