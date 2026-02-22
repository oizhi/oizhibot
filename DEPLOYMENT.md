# 快速部署指南

## 前置要求

1. Cloudflare 账号
2. Node.js 18+ 
3. Telegram Bot Token

## 一键部署

```bash
# 1. 安装依赖
npm install

# 2. 登录 Cloudflare
npx wrangler login

# 3. 创建 D1 数据库
npx wrangler d1 create telegram_verification

# 记下输出的 database_id，更新 wrangler.toml 中的 database_id

# 4. 初始化数据库
npm run setup-db

# 5. 设置 Bot Token（二选一）

# 方式 A: 使用加密 secrets（推荐）
npx wrangler secret put TELEGRAM_BOT_TOKEN
# 输入你的 Bot Token

# 方式 B: 直接在 wrangler.toml 中配置（不推荐生产环境）
# 编辑 wrangler.toml 的 [vars] 部分

# 6. 部署
npm run deploy

# 7. 设置 Webhook
# 访问: https://your-worker.your-subdomain.workers.dev/setup

# 8. 将机器人添加到群组并授予管理员权限
```

## 验证部署

1. 访问 Worker URL 应该看到 "Telegram Verification Bot"
2. 访问 `/health` 应该返回 "OK"
3. 访问 `/setup` 应该显示 webhook 设置成功
4. 邀请测试用户加入群组，观察机器人是否发送验证消息

## 常见问题

### Q: database_id 在哪里？
A: 运行 `wrangler d1 create` 后会输出，格式类似：
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Q: 如何查看日志？
A: 运行 `npx wrangler tail` 实时查看 Worker 日志

### Q: 机器人没反应？
A: 
1. 确认 webhook 设置成功（访问 /setup）
2. 确认机器人有管理员权限
3. 查看日志排查错误

### Q: 如何测试本地？
A: 运行 `npm run dev`，但注意 Telegram webhook 需要公网可访问的 HTTPS URL

## 下一步

- 阅读 `ADMIN_COMMANDS.md` 添加管理员命令
- 根据需求调整 `bot-detection.js` 中的检测规则
- 配置群组的验证方式和超时时间
