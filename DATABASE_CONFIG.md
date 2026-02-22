# 数据库配置说明

## Cloudflare D1 数据库设置

### 1. 创建数据库

```bash
# 使用 wrangler CLI 创建 D1 数据库
wrangler d1 create telegram_verification
```

执行后会输出类似内容：

```
✅ Successfully created DB 'telegram_verification'!

[[d1_databases]]
binding = "DB"
database_name = "telegram_verification"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**重要**: 复制 `database_id` 并更新 `wrangler.toml` 文件中的对应字段。

### 2. 初始化数据库表结构

```bash
# 执行 SQL 文件创建表
wrangler d1 execute telegram_verification --file=./schema/schema.sql
```

或者使用 npm 脚本：

```bash
npm run setup-db
```

### 3. 验证数据库

```bash
# 查看数据库列表
wrangler d1 list

# 执行查询验证表是否创建成功
wrangler d1 execute telegram_verification --command="SELECT name FROM sqlite_master WHERE type='table';"
```

应该看到以下表：
- `verifications`
- `blacklist`
- `group_configs`
- `bot_detection_log`

### 4. 本地开发数据库

```bash
# 创建本地开发数据库
wrangler d1 execute telegram_verification --local --file=./schema/schema.sql

# 本地运行 Worker
wrangler dev --local
```

## 数据库表结构

### verifications - 用户验证记录
```sql
user_id INTEGER PRIMARY KEY
username TEXT
first_name TEXT
chat_id INTEGER
status TEXT ('pending', 'verified', 'failed', 'banned')
verification_code TEXT
attempts INTEGER DEFAULT 0
created_at INTEGER
verified_at INTEGER
metadata TEXT (JSON)
```

### blacklist - 黑名单
```sql
user_id INTEGER PRIMARY KEY
reason TEXT
banned_at INTEGER
banned_by INTEGER
metadata TEXT (JSON)
```

### group_configs - 群组配置
```sql
chat_id INTEGER PRIMARY KEY
verification_type TEXT ('math', 'button', 'captcha', 'custom')
timeout_seconds INTEGER DEFAULT 300
auto_ban_bots INTEGER DEFAULT 1
welcome_message TEXT
bot_detection_level TEXT ('low', 'medium', 'high')
created_at INTEGER
updated_at INTEGER
```

### bot_detection_log - 检测日志
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
user_id INTEGER
chat_id INTEGER
detection_type TEXT
score INTEGER
action TEXT ('warned', 'kicked', 'banned')
detected_at INTEGER
metadata TEXT (JSON)
```

## 数据库操作示例

### 查询验证记录
```bash
wrangler d1 execute telegram_verification \
  --command="SELECT * FROM verifications WHERE status='pending' LIMIT 10;"
```

### 查看黑名单
```bash
wrangler d1 execute telegram_verification \
  --command="SELECT * FROM blacklist ORDER BY banned_at DESC LIMIT 20;"
```

### 统计数据
```bash
wrangler d1 execute telegram_verification \
  --command="SELECT status, COUNT(*) as count FROM verifications GROUP BY status;"
```

### 清理旧数据
```bash
# 删除30天前的验证记录
wrangler d1 execute telegram_verification \
  --command="DELETE FROM verifications WHERE created_at < strftime('%s', 'now', '-30 days') * 1000;"
```

## 环境变量配置

### Bot Token 配置

**生产环境（推荐）**：使用加密的 secrets
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# 然后输入你的 Bot Token
```

**开发/测试环境**：直接在 wrangler.toml 配置
```toml
[vars]
TELEGRAM_BOT_TOKEN = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
```

### 验证配置
```bash
# 查看已配置的 secrets
wrangler secret list

# 删除 secret
wrangler secret delete TELEGRAM_BOT_TOKEN
```

## 数据库备份

### 导出数据
```bash
# 导出所有表数据为 SQL
wrangler d1 export telegram_verification --output=backup.sql

# 或导出为 JSON
wrangler d1 execute telegram_verification \
  --command="SELECT * FROM verifications;" \
  --json > verifications_backup.json
```

### 恢复数据
```bash
# 从 SQL 文件恢复
wrangler d1 execute telegram_verification --file=backup.sql
```

## 性能优化

### 索引已自动创建
- `idx_verifications_chat` - 按群组查询
- `idx_verifications_status` - 按状态查询
- `idx_detection_user` - 按用户查询检测记录
- `idx_detection_chat` - 按群组查询检测记录

### 查询优化建议
1. 使用索引字段作为查询条件
2. 限制返回记录数（使用 LIMIT）
3. 定期清理旧数据
4. 对于大量数据的聚合查询，考虑使用 Workers KV 缓存结果

## 监控与调试

### 查看数据库大小
```bash
wrangler d1 info telegram_verification
```

### 实时日志
```bash
wrangler tail
```

### 常见问题

**Q: database_id 错误**
A: 确保 wrangler.toml 中的 database_id 与创建的数据库 ID 一致

**Q: 表不存在错误**
A: 运行 `npm run setup-db` 初始化数据库表

**Q: 权限错误**
A: 确保已登录 Cloudflare：`wrangler login`

**Q: 本地开发数据库问题**
A: 使用 `--local` 参数并确保已初始化本地数据库
