# 🚀 V3 增强功能部署指南

## 📋 新增功能

### 1. ✅ Bot 邀请链接 + 群组快捷绑定
- 自动生成 Bot 邀请链接（带视频库参数）
- 支持在群组中直接使用 `/bind 视频库名称` 绑定
- Bot 加入群组时自动记录待绑定状态
- 24 小时自动清理过期绑定记录

### 2. ✅ 备份频道功能
- 每个视频库可设置一个备份频道
- 自动双重转发（目标 + 备份）
- 支持启用/暂停备份功能
- 备份频道可以是私有频道

### 3. ✅ 媒体文件元数据记录
- 自动记录 Telegram `file_id` 和 `file_unique_id`
- 记录文件大小、MIME 类型、标题
- 支持后续重新下载和导出
- 为未来 R2 上传做准备

---

## 🔧 部署步骤

### Step 1: 备份现有数据库（重要！）

```bash
# 使用 Wrangler 导出 D1 数据库
npx wrangler d1 export telegram_verification --output=backup.sql

# 或者通过 Cloudflare Dashboard 下载备份
```

### Step 2: 应用数据库迁移

```bash
# 应用迁移脚本
npx wrangler d1 execute telegram_verification --file=schema/migration_v3.sql

# 验证迁移成功
npx wrangler d1 execute telegram_verification --command="SELECT backup_channel_id FROM forward_repositories LIMIT 1"
```

### Step 3: 替换代码文件

```bash
# 备份现有代码
cp src/index.js src/index.backup.js

# 使用新版本
cp src/index.enhanced.js src/index.js
```

### Step 4: 部署到 Cloudflare Workers

```bash
# 部署
npm run deploy

# 或使用 wrangler
npx wrangler deploy
```

### Step 5: 验证部署

```bash
# 1. 访问 webhook endpoint
curl https://your-worker.workers.dev/webhook

# 2. 在 Telegram 中测试 /start 命令

# 3. 检查 Bot 是否能正确响应
```

---

## 📖 使用指南

### 1. 创建视频库

1. 私聊 Bot 发送 `/start`
2. 点击「➕ 创建新视频库」
3. 输入视频库名称（如：`travel_videos`）
4. 输入描述（可选）

### 2. 设置备份频道（推荐）

1. 在 Telegram 中创建一个**私有频道**
2. 将 Bot 添加为频道管理员
3. 在 Bot 中进入视频库管理
4. 点击「💾 备份设置」
5. 发送频道 ID（如：`-1001234567890`）

**获取频道 ID 的方法：**
- 转发频道中的任意消息到 [@userinfobot](https://t.me/userinfobot)
- 或使用 Bot 的「添加目标」功能后查看

### 3. 添加转发目标（两种方式）

#### 方式一：使用 Bot 邀请链接

1. 在 Bot 中选择视频库
2. 点击「🔗 邀请链接」
3. 复制链接并在浏览器中打开
4. 选择要添加 Bot 的群组
5. 在群组中发送：`/bind travel_videos`

#### 方式二：直接在群组中绑定

1. 将 Bot 添加到目标群组/频道
2. 确保 Bot 是管理员（频道必须）
3. 在群组中发送：`/bind travel_videos`

### 4. 开始转发内容

1. 在 Bot 私聊中选择视频库
2. 点击「🚀 开始转发」
3. 发送任何内容（文字、图片、视频等）
4. Bot 自动转发到所有目标 + 备份频道

---

## 🎯 功能特性

### 自动双重保存

```
用户消息 → Bot
  ├─→ 转发目标 1 ✅
  ├─→ 转发目标 2 ✅
  ├─→ 转发目标 3 ✅
  └─→ 备份频道   ✅ (私有，永久保存)
```

### 媒体元数据记录

Bot 会自动记录：
- `file_id`: Telegram 内部文件 ID（可重复使用）
- `file_unique_id`: 永久唯一标识符
- `mime_type`: 文件类型（如 `video/mp4`）
- `file_size`: 文件大小（字节）
- `caption`: 媒体标题/描述

这些数据存储在数据库中，支持：
- 🔄 重新下载原文件
- 📤 导出到其他平台
- 🚀 未来上传到 Cloudflare R2

### 群组快捷绑定

Bot 加入群组时会自动：
1. 检测群组 Chat ID
2. 记录群组信息（名称、类型）
3. 创建待绑定记录（24小时有效）
4. 发送绑定提示消息

用户只需在群组中发送：
```
/bind 视频库名称
```

Bot 会自动：
- 验证视频库是否存在
- 检查用户权限
- 添加群组为转发目标
- 发送成功确认消息

---

## 🛠️ 常见问题

### Q: 如何获取频道/群组的 Chat ID？

**方法 1：使用 Bot 功能**
- 将 Bot 添加到群组
- 发送 `/bind test` (随便一个名字)
- Bot 会显示当前 Chat ID

**方法 2：使用第三方 Bot**
- 转发消息到 [@userinfobot](https://t.me/userinfobot)
- 或使用 [@getidsbot](https://t.me/getidsbot)

**方法 3：查看数据库**
```sql
SELECT chat_id, chat_title FROM pending_group_bindings;
```

### Q: 备份频道必须是私有的吗？

不是必须，但**强烈推荐**：
- ✅ 私有频道：只有你能访问，数据安全
- ⚠️ 公开频道：任何人可见，可能泄露内容

### Q: 备份功能会影响转发速度吗？

几乎不会：
- 备份是**先执行**的（优先级高）
- 转发是并发执行的
- Telegram API 限制：20 req/s，足够使用

### Q: 媒体文件会被上传到 Cloudflare 吗？

**当前版本：不会**
- 只记录 `file_id`（引用）
- 文件仍存储在 Telegram 服务器上

**未来版本（计划中）：**
- 可选上传到 Cloudflare R2
- 永久存储，不受 Telegram 限制

### Q: 如果 Bot 没有管理员权限会怎样？

- **频道**：必须是管理员才能发送消息
- **群组**：普通成员身份即可（但建议给管理员）

如果权限不足，Bot 会：
- ❌ 转发失败
- 📝 记录错误到数据库
- 💬 通知用户失败原因

### Q: 可以同时转发到多少个目标？

**理论上限：**
- 无限制（数据库支持）

**实际限制：**
- Telegram API: 20 请求/秒
- Cloudflare Workers: 50ms CPU 时间

**建议数量：**
- 1-10 个目标：最佳体验
- 10-50 个：可能有延迟
- 50+ 个：建议分批处理

---

## 📊 数据库结构变化

### 新增字段

**`forward_repositories` 表：**
```sql
backup_channel_id INTEGER      -- 备份频道 ID
backup_enabled INTEGER          -- 备份开关 (0/1)
```

**`forward_targets` 表：**
```sql
target_title TEXT               -- 群组/频道名称
```

**`forwarded_messages` 表：**
```sql
media_file_id TEXT              -- Telegram file_id
media_file_unique_id TEXT       -- 唯一标识符
media_mime_type TEXT            -- MIME 类型
media_file_size INTEGER         -- 文件大小
caption TEXT                    -- 媒体标题
backup_message_id INTEGER       -- 备份消息 ID
```

**`pending_group_bindings` 表：**
```sql
start_param TEXT                -- /start 参数
```

### 新增索引

```sql
CREATE INDEX idx_forwarded_messages_file_id ON forwarded_messages(media_file_id);
```

---

## 🔐 安全建议

1. **备份频道务必设置为私有**
   ```
   频道设置 → 频道类型 → 私有频道
   ```

2. **定期导出数据库备份**
   ```bash
   npx wrangler d1 export telegram_verification --output=backup-$(date +%Y%m%d).sql
   ```

3. **限制 Bot Token 访问**
   - 使用 `wrangler secret` 管理 Token
   - 不要在代码中硬编码

4. **监控转发日志**
   ```bash
   npx wrangler tail
   ```

---

## 🚀 未来计划

### 阶段一（当前）✅
- ✅ Bot 邀请链接
- ✅ 群组快捷绑定
- ✅ 备份频道
- ✅ 媒体元数据记录

### 阶段二（规划中）
- 📤 Cloudflare R2 自动上传
- 📊 转发统计仪表板
- 🔍 内容搜索功能
- 🎨 自定义转发模板

### 阶段三（未来）
- 🤖 AI 内容分类
- 🔄 跨平台同步（Twitter, Discord 等）
- 📱 Web 管理界面
- 🎯 智能内容推荐

---

## 📞 支持与反馈

如果遇到问题：
1. 查看 Cloudflare Workers 日志：`npx wrangler tail`
2. 检查数据库状态：`npx wrangler d1 execute telegram_verification --command="SELECT * FROM forward_repositories"`
3. 联系开发者（填写你的联系方式）

---

## 📝 变更日志

### V3.0 (2026-02-25)
- ➕ 新增 Bot 邀请链接功能
- ➕ 新增群组快捷绑定 (`/bind`)
- ➕ 新增备份频道支持
- ➕ 新增媒体文件元数据记录
- 🔧 优化数据库结构
- 📚 完善文档和部署指南

### V2.0 (之前)
- 基础转发功能
- 视频库管理
- 权限系统

---

**🎉 部署完成后，发送 `/start` 给 Bot 体验新功能！**
