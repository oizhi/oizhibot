# Telegram Verification Bot - 故障排查指南

## 当前问题
Worker 部署后无响应（超时）

## 可能原因

### 1. ES6 模块导入问题 ⚠️
Cloudflare Workers 对 ES6 模块支持需要特定配置。

**解决方案：使用简化的测试版本**

```bash
cd /root/.openclaw/workspace/telegram-verification-bot

# 备份原始 worker
cp src/worker.js src/worker.original.js

# 使用测试版本
cp src/worker.test.js src/worker.js

# 重新部署
wrangler deploy
```

### 2. 数据库 ID 未配置
检查 `wrangler.toml` 中的 `database_id` 是否还是 `"your-database-id"`

**解决方案：**
```bash
# 创建 D1 数据库
wrangler d1 create telegram_verification

# 会返回类似：
# database_id = "xxxx-xxxx-xxxx"

# 更新 wrangler.toml 中的 database_id
```

### 3. Bot Token 未设置
Worker 无法获取 `env.TELEGRAM_BOT_TOKEN`

**解决方案：**
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# 输入你的 bot token
```

### 4. 编译错误
Worker 代码有语法错误导致启动失败

**检查方法：**
```bash
# 本地测试
wrangler dev

# 查看部署日志
wrangler tail
```

## 诊断步骤

### 步骤 1: 使用简化版本测试
```bash
cd /root/.openclaw/workspace/telegram-verification-bot
cp src/worker.test.js src/worker.js
wrangler deploy
```

然后访问：
- https://telegram-verification-bot.tdws.workers.dev/
- https://telegram-verification-bot.tdws.workers.dev/health

### 步骤 2: 检查环境变量
如果步骤 1 正常，访问：
- https://telegram-verification-bot.tdws.workers.dev/setup

查看返回的 `env_check` 字段：
```json
{
  "env_check": {
    "has_bot_token": true,  // 应该是 true
    "has_db": true          // 应该是 true
  }
}
```

### 步骤 3: 初始化数据库
```bash
# 列出数据库
wrangler d1 list

# 执行初始化脚本
wrangler d1 execute telegram_verification --file=schema/schema.sql
```

### 步骤 4: 恢复完整版本
简化版本测试通过后，恢复完整功能：

```bash
# 方案 A: 修改 wrangler.toml，改为 bundle 模式
# 在 wrangler.toml 添加：
[build]
command = "npx esbuild src/worker.original.js --bundle --format=esm --outfile=dist/worker.js"

# 然后修改 main
main = "dist/worker.js"

# 方案 B: 将所有代码合并到单文件（推荐）
# 我可以帮你生成一个合并的版本
```

## 快速命令

```bash
# 查看 Worker 日志（实时）
wrangler tail

# 查看 Worker 状态
wrangler deployments list

# 本地测试
wrangler dev

# 删除并重新部署
wrangler delete telegram-verification-bot
wrangler deploy
```

## 联系信息
如果以上步骤都无法解决，可能需要：
1. 检查 Cloudflare 账号权限
2. 检查 Workers 套餐限制
3. 查看 Cloudflare Dashboard 的 Workers 日志
