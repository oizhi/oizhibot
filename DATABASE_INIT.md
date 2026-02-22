# 数据库初始化指南

## 问题
执行群组命令时报错：
```
❌ 命令执行失败: D1_ERROR: no such table: group_configs: SQLITE_ERROR
```

## 原因
数据库表还没有初始化创建。

## 解决方案

### 方法一：使用 Wrangler CLI（推荐）

#### 1. 登录 Cloudflare
```bash
cd /root/.openclaw/workspace/telegram-verification-bot
npx wrangler login
```

这会打开浏览器让你授权登录。

#### 2. 初始化远程数据库
```bash
npx wrangler d1 execute telegram_verification --remote --file=schema/schema.sql
```

#### 3. 验证表已创建
```bash
npx wrangler d1 execute telegram_verification --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

应该看到：
```
- verifications
- blacklist
- group_configs
- bot_detection_log
```

#### 4. 重新部署 Worker
```bash
npx wrangler deploy
```

---

### 方法二：使用 Cloudflare Dashboard

#### 1. 登录 Cloudflare Dashboard
访问：https://dash.cloudflare.com/

#### 2. 进入 D1 数据库
- 左侧菜单：Workers & Pages → D1 SQL Database
- 找到数据库：`telegram_verification`
- 点击进入

#### 3. 执行 SQL
点击 "Console" 标签，复制粘贴以下 SQL：

```sql
-- 用户验证记录表
CREATE TABLE IF NOT EXISTS verifications (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    chat_id INTEGER,
    status TEXT CHECK(status IN ('pending', 'verified', 'failed', 'banned')),
    verification_code TEXT,
    attempts INTEGER DEFAULT 0,
    created_at INTEGER,
    verified_at INTEGER,
    metadata TEXT
);

-- 黑名单表
CREATE TABLE IF NOT EXISTS blacklist (
    user_id INTEGER PRIMARY KEY,
    reason TEXT,
    banned_at INTEGER,
    banned_by INTEGER,
    metadata TEXT
);

-- 群组配置表
CREATE TABLE IF NOT EXISTS group_configs (
    chat_id INTEGER PRIMARY KEY,
    verification_type TEXT CHECK(verification_type IN ('math', 'button', 'captcha', 'custom')),
    timeout_seconds INTEGER DEFAULT 300,
    auto_ban_bots INTEGER DEFAULT 1,
    welcome_message TEXT,
    bot_detection_level TEXT CHECK(bot_detection_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
    created_at INTEGER,
    updated_at INTEGER
);

-- 机器人检测日志表
CREATE TABLE IF NOT EXISTS bot_detection_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    chat_id INTEGER,
    detection_type TEXT,
    score INTEGER,
    action TEXT,
    detected_at INTEGER,
    metadata TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_verifications_chat ON verifications(chat_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_detection_user ON bot_detection_log(user_id);
CREATE INDEX IF NOT EXISTS idx_detection_chat ON bot_detection_log(chat_id);
```

点击 "Execute" 执行。

#### 4. 验证
在 Console 中执行：
```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

应该看到 4 个表。

---

### 方法三：使用自动化脚本

#### 1. 运行初始化脚本
```bash
cd /root/.openclaw/workspace/telegram-verification-bot
./init-database.sh
```

这个脚本会：
- ✅ 检查数据库是否存在
- ✅ 自动创建表结构
- ✅ 验证表是否创建成功
- ✅ 显示下一步操作

---

## 完成后测试

### 1. 在群组中测试命令
```
/config        # 查看配置（应该显示默认配置）
/stats         # 查看统计（应该显示 0）
/help          # 查看帮助
```

### 2. 测试验证流程
- 邀请测试用户加入群组
- Bot 应该发送验证消息
- 点击正确答案完成验证

---

## 常见问题

### Q: 为什么本地执行不行？
A: 本地数据库和远程（生产）数据库是分开的。必须在远程数据库执行初始化。

### Q: 我没有 Cloudflare 账号怎么办？
A: 
1. 访问 https://dash.cloudflare.com/sign-up 注册
2. 免费账户就够用了

### Q: wrangler login 打不开浏览器怎么办？
A: 
1. 手动访问：https://dash.cloudflare.com/profile/api-tokens
2. 创建 API Token（模板选择 "Edit Cloudflare Workers"）
3. 设置环境变量：
   ```bash
   export CLOUDFLARE_API_TOKEN="你的token"
   ```

### Q: 还是报错怎么办？
A: 使用方法二（Dashboard），最简单直接。

---

## 验证成功的标志

执行 `/config` 命令后看到：
```
⚙️ 群组当前配置

🔐 验证方式: 数学题
⏱ 超时时间: 300秒 (5分钟)
🤖 自动封禁: 开启
📊 检测级别: medium
```

而不是：
```
❌ 命令执行失败: D1_ERROR: no such table: group_configs
```

---

## 需要帮助？

- 查看日志：`~/.config/.wrangler/logs/`
- GitHub Issues: https://github.com/ovws/oizhibot/issues
- 项目文档：https://github.com/ovws/oizhibot
