# 🚀 V3 快速使用指南

## 🎯 三大核心功能

### 1️⃣ Bot 邀请链接 + 群组快捷绑定

**使用流程：**
```
1. Bot 私聊 → /start
2. 选择视频库 → 点击「🔗 邀请链接」
3. 复制链接 → 在浏览器打开
4. 选择要添加的群组 → 确认
5. 在群组中发送 → /bind 视频库名称
6. ✅ 完成绑定！
```

**优势：**
- ✨ 无需手动获取 Chat ID
- ✨ 一键添加 Bot 到群组
- ✨ 自动验证权限
- ✨ 群组名称自动记录

---

### 2️⃣ 备份频道

**设置步骤：**
```
1. 创建一个私有频道（推荐）
2. 将 Bot 添加为频道管理员
3. Bot 私聊 → 选择视频库 → 「💾 备份设置」
4. 使用邀请链接或 /bind 绑定备份频道
5. ✅ 所有消息自动备份！
```

**工作原理：**
```
你发送消息
    ↓
  Bot 接收
    ↓
├─→ 备份频道（优先）  ✅
├─→ 目标频道 1        ✅
├─→ 目标频道 2        ✅
└─→ 目标频道 3        ✅
```

**备份数据包含：**
- 📝 原始消息内容
- 📷 所有媒体文件
- 🆔 文件 ID（可重复使用）
- 📊 完整元数据

---

### 3️⃣ 媒体文件元数据

**自动记录的信息：**
- `file_id`: Telegram 文件 ID（可重复使用，无需重新上传）
- `file_unique_id`: 永久唯一标识符
- `mime_type`: 文件类型（如 `video/mp4`, `image/jpeg`）
- `file_size`: 文件大小（字节）
- `caption`: 媒体标题/描述

**应用场景：**
```sql
-- 查找某个文件的所有转发记录
SELECT * FROM forwarded_messages 
WHERE media_file_id = 'AgACAgIAAxkBAAI...';

-- 统计视频库的存储使用
SELECT 
  SUM(media_file_size) / 1024 / 1024 as total_mb
FROM forwarded_messages
WHERE repo_id = 1;

-- 按文件类型分组统计
SELECT message_type, COUNT(*) as count
FROM forwarded_messages
GROUP BY message_type;
```

---

## 🎬 完整使用示例

### 场景：创建旅行视频库并自动转发

#### Step 1: 创建视频库
```
👤 你: /start
🤖 Bot: 欢迎使用！[➕ 创建新视频库]

👤 你: travel_videos
🤖 Bot: ✅ 名称已保存，现在输入描述

👤 你: 旅行视频自动同步
🤖 Bot: ✅ 视频库创建成功！
```

#### Step 2: 设置备份频道
```
1. 在 Telegram 创建私有频道「旅行视频备份」
2. Bot 私聊 → 选择 travel_videos → 「💾 备份设置」
3. 点击「➕ 设置备份频道」→「🔗 邀请链接」
4. 在备份频道中 → /bind travel_videos
5. ✅ 备份频道已设置！
```

#### Step 3: 添加转发目标
```
方式一：使用邀请链接
1. Bot 私聊 → travel_videos → 「🔗 邀请链接」
2. 复制链接 → 浏览器打开
3. 选择「YouTube 发布频道」
4. 在频道中 → /bind travel_videos

方式二：直接绑定
1. 在「YouTube 发布频道」添加 Bot 为管理员
2. 发送 → /bind travel_videos
```

#### Step 4: 开始转发
```
👤 你: [选择 travel_videos] → 🚀 开始转发
🤖 Bot: ✅ 转发模式已启动
       📦 当前视频库：travel_videos
       🎯 转发目标：2 个
       💾 备份：已启用

👤 你: [发送视频]
🤖 Bot: ✅ 转发成功
       📤 目标：2/2
       💾 已备份
```

---

## 🔧 常用命令速查

| 命令 | 说明 | 位置 |
|------|------|------|
| `/start` | 启动 Bot，显示主菜单 | 私聊 |
| `/bind 视频库名称` | 绑定当前群组到视频库 | 群组/频道 |
| `/help` | 查看帮助信息 | 任意 |

---

## 💡 最佳实践

### ✅ 推荐做法

1. **备份频道设为私有**
   - 保护内容安全
   - 作为数据仓库使用

2. **使用邀请链接添加 Bot**
   - 比手动添加更便捷
   - 避免 Chat ID 错误

3. **转发前测试**
   - 先添加一个测试频道
   - 验证 Bot 权限正常

4. **定期导出数据库**
   ```bash
   npx wrangler d1 export telegram_verification --output=backup.sql
   ```

### ❌ 避免的问题

1. **备份频道设为公开**
   - 任何人可见备份内容
   - 存在隐私风险

2. **Bot 没有管理员权限**
   - 频道：无法发送消息
   - 群组：某些功能受限

3. **转发目标过多**
   - 超过 50 个可能有延迟
   - 建议分批设置

---

## 📊 数据查询示例

### 查看所有视频库
```bash
npx wrangler d1 execute telegram_verification \
  --command="SELECT * FROM forward_repositories"
```

### 查看转发统计
```bash
npx wrangler d1 execute telegram_verification \
  --command="SELECT 
    r.name,
    COUNT(*) as total_messages,
    COUNT(f.backup_message_id) as backed_up
  FROM forwarded_messages f
  JOIN forward_repositories r ON f.repo_id = r.id
  GROUP BY r.name"
```

### 查看待绑定的群组
```bash
npx wrangler d1 execute telegram_verification \
  --command="SELECT * FROM pending_group_bindings"
```

---

## 🐛 故障排查

### 问题 1: Bot 无响应

**检查：**
```bash
# 查看 Worker 日志
npx wrangler tail

# 验证 Webhook
curl https://your-worker.workers.dev/webhook
```

**解决：**
- 重新设置 Webhook
- 检查 Bot Token 是否正确

---

### 问题 2: 转发失败

**可能原因：**
- Bot 不是目标频道管理员
- 目标 Chat ID 错误
- API 限流（20 req/s）

**检查：**
```bash
# 查看错误日志
npx wrangler tail --format=pretty

# 验证 Bot 在目标频道的状态
# （在 Telegram 中手动检查）
```

---

### 问题 3: 备份未生效

**检查：**
```sql
-- 查看备份设置
SELECT name, backup_channel_id, backup_enabled 
FROM forward_repositories;

-- 查看备份记录
SELECT COUNT(*) as with_backup
FROM forwarded_messages
WHERE backup_message_id IS NOT NULL;
```

**解决：**
- 确认 `backup_enabled = 1`
- 确认 Bot 是备份频道管理员
- 检查日志中的备份错误

---

## 📞 获取帮助

**实时日志：**
```bash
npx wrangler tail --format=pretty
```

**数据库查询：**
```bash
npx wrangler d1 execute telegram_verification --command="<SQL>"
```

**文档：**
- 📖 DEPLOYMENT_V3.md（完整部署指南）
- 📊 FEATURE_COMPARISON.md（功能详细说明）
- 🔧 schema/migration_v3.sql（数据库结构）

---

**🎉 开始使用吧！发送 `/start` 给 Bot！**
