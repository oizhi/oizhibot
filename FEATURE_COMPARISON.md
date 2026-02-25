# 📊 功能实现对比表

## V3 功能清单

| 功能 | 状态 | 优先级 | 实现说明 |
|------|------|--------|----------|
| **1. Bot 邀请链接 + 群组快捷绑定** | ✅ 完成 | 🔥 最实用 | - |
| ├─ Bot 邀请链接生成 | ✅ | 高 | `bot.generateInviteLink(repo.id)` |
| ├─ 链接带 repo_id 参数 | ✅ | 高 | `?startgroup=${repo_id}` |
| ├─ 群组中 /bind 命令 | ✅ | 高 | `handleBindCommand()` |
| ├─ Bot 加入群组自动记录 | ✅ | 高 | `handleMyChatMember()` |
| ├─ 待绑定记录（24h过期） | ✅ | 中 | `pending_group_bindings` 表 |
| └─ 权限验证 | ✅ | 高 | `checkPermission()` |
| **2. 备份频道功能** | ✅ 完成 | 🔥 最简单可靠 | - |
| ├─ 设置备份频道 | ✅ | 高 | `backup_channel_id` 字段 |
| ├─ 自动双重转发 | ✅ | 高 | 先备份，后转发目标 |
| ├─ 备份开关 | ✅ | 中 | `backup_enabled` 字段 |
| ├─ 私有频道支持 | ✅ | 高 | 支持负数 chat_id |
| ├─ 备份消息 ID 记录 | ✅ | 中 | `backup_message_id` 字段 |
| └─ 备份失败不影响转发 | ✅ | 高 | try-catch 包裹 |
| **3. 媒体文件元数据记录** | ✅ 完成 | 🔥 必需 | - |
| ├─ 记录 file_id | ✅ | 高 | `media_file_id` 字段 |
| ├─ 记录 file_unique_id | ✅ | 高 | `media_file_unique_id` 字段 |
| ├─ 记录 MIME 类型 | ✅ | 中 | `media_mime_type` 字段 |
| ├─ 记录文件大小 | ✅ | 中 | `media_file_size` 字段 |
| ├─ 记录标题/描述 | ✅ | 低 | `caption` 字段 |
| ├─ 支持多种媒体类型 | ✅ | 高 | photo, video, document, audio, voice, animation |
| └─ 自动提取元数据 | ✅ | 高 | `extractMediaMetadata()` |

---

## 技术实现详情

### 1. Bot 邀请链接

**实现方式：**
```javascript
generateInviteLink(repoId = null) {
  if (!this.botUsername) return null;
  
  if (repoId) {
    // 带参数的邀请链接
    return `https://t.me/${this.botUsername}?startgroup=${repoId}`;
  }
  
  // 通用邀请链接
  return `https://t.me/${this.botUsername}?startgroup=general`;
}
```

**用户体验：**
1. 用户点击邀请链接
2. Telegram 打开 Bot 聊天界面
3. 显示「选择群组」按钮
4. 用户选择群组后，Bot 被添加
5. Bot 自动发送绑定提示

**优势：**
- ✅ 无需手动添加 Bot
- ✅ 无需手动输入 Chat ID
- ✅ 一键完成（点击链接 → 选择群组 → /bind）

---

### 2. 群组快捷绑定

**实现逻辑：**
```javascript
// Bot 加入群组时
handleMyChatMember(myChatMember) {
  const chatId = chat.id;
  const chatType = chat.type;
  const chatTitle = chat.title;
  
  // 记录待绑定群组（24小时有效）
  await db.createPendingBinding(chatId, chatType, chatTitle, userId);
  
  // 发送绑定提示
  await bot.sendMessage(chatId, "使用 /bind 视频库名称 进行绑定");
}

// 用户发送 /bind 命令
handleBindCommand(message) {
  const repoName = parseCommandArgs(message.text);
  const repo = await db.getRepository(repoName);
  
  // 验证权限
  if (!await db.checkPermission(repo.id, userId, 'admin')) {
    return sendError("没有权限");
  }
  
  // 添加转发目标
  await db.addForwardTarget(repo.id, chatId, chatType, chatTitle);
  
  // 删除待绑定记录
  await db.deletePendingBinding(chatId);
}
```

**数据库设计：**
```sql
CREATE TABLE pending_group_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  chat_type TEXT NOT NULL,
  chat_title TEXT,
  repo_id INTEGER,                    -- 可能预关联
  added_by INTEGER NOT NULL,
  start_param TEXT,                   -- /start 参数
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,        -- 24小时后过期
  UNIQUE(chat_id)
);
```

**自动清理：**
```javascript
// 每次请求时清理过期记录
async cleanupExpiredBindings() {
  const now = Date.now();
  await db.prepare('DELETE FROM pending_group_bindings WHERE expires_at < ?')
    .bind(now)
    .run();
}
```

---

### 3. 备份频道

**核心转发逻辑：**
```javascript
async forwardMessage(message, repo) {
  const results = [];
  const forwardedTo = [];
  let backupMessageId = null;

  // 1️⃣ 先转发到备份频道（优先级最高）
  if (repo.backup_channel_id && repo.backup_enabled) {
    const backupResult = await bot.copyMessage(
      chatId, 
      repo.backup_channel_id, 
      messageId
    );
    
    if (backupResult.ok) {
      backupMessageId = backupResult.result.message_id;
      console.log(`✅ Backed up to ${repo.backup_channel_id}`);
    }
  }

  // 2️⃣ 并发转发到所有目标
  for (const target of enabledTargets) {
    const result = await bot.copyMessage(chatId, target.target_chat_id, messageId);
    
    if (result.ok) {
      forwardedTo.push(target.target_chat_id);
    }
  }

  // 3️⃣ 记录到数据库（包含备份消息ID）
  await db.logForwardedMessage({
    repo_id: repo.id,
    backup_message_id: backupMessageId,
    forwarded_to: forwardedTo,
    ...mediaData
  });
}
```

**数据库字段：**
```sql
ALTER TABLE forward_repositories 
  ADD COLUMN backup_channel_id INTEGER;     -- 备份频道 ID
  
ALTER TABLE forward_repositories 
  ADD COLUMN backup_enabled INTEGER DEFAULT 1;  -- 备份开关

ALTER TABLE forwarded_messages 
  ADD COLUMN backup_message_id INTEGER;     -- 备份消息 ID
```

**优势：**
- ✅ 双重保险，数据不丢失
- ✅ 备份频道可私有（推荐）
- ✅ 支持随时启用/暂停
- ✅ 记录备份消息 ID，可追溯

---

### 4. 媒体元数据记录

**提取逻辑：**
```javascript
extractMediaMetadata(message) {
  const types = ['photo', 'video', 'document', 'audio', 'voice', 'video_note', 'animation'];
  
  for (const type of types) {
    if (message[type]) {
      // photo 是数组，取最大尺寸
      const media = Array.isArray(message[type]) 
        ? message[type][message[type].length - 1] 
        : message[type];
      
      return {
        type,
        file_id: media.file_id,                    // Telegram file_id
        file_unique_id: media.file_unique_id,      // 永久唯一标识符
        mime_type: media.mime_type || null,        // MIME 类型
        file_size: media.file_size || null         // 文件大小（字节）
      };
    }
  }
  
  // 纯文本消息
  return { type: 'text', file_id: null, ... };
}
```

**数据库字段：**
```sql
ALTER TABLE forwarded_messages 
  ADD COLUMN media_file_id TEXT;              -- Telegram file_id
  
ALTER TABLE forwarded_messages 
  ADD COLUMN media_file_unique_id TEXT;       -- 唯一标识符
  
ALTER TABLE forwarded_messages 
  ADD COLUMN media_mime_type TEXT;            -- MIME 类型
  
ALTER TABLE forwarded_messages 
  ADD COLUMN media_file_size INTEGER;         -- 文件大小
  
ALTER TABLE forwarded_messages 
  ADD COLUMN caption TEXT;                    -- 标题/描述

-- 创建索引（用于查询）
CREATE INDEX idx_forwarded_messages_file_id ON forwarded_messages(media_file_id);
```

**应用场景：**

1. **重新下载文件**
   ```javascript
   const fileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${file_id}`;
   ```

2. **导出到其他平台**
   ```javascript
   // 使用 file_id 重新获取文件
   const file = await bot.getFile(file_id);
   const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
   
   // 下载并上传到 R2
   const response = await fetch(downloadUrl);
   await R2.put(file_unique_id, response.body);
   ```

3. **查找重复内容**
   ```sql
   SELECT COUNT(*), media_file_unique_id 
   FROM forwarded_messages 
   WHERE media_file_unique_id IS NOT NULL
   GROUP BY media_file_unique_id
   HAVING COUNT(*) > 1;
   ```

4. **统计媒体类型分布**
   ```sql
   SELECT message_type, COUNT(*) as count, SUM(media_file_size) as total_size
   FROM forwarded_messages
   WHERE repo_id = ?
   GROUP BY message_type;
   ```

---

## 性能考量

### 转发性能

**顺序执行 vs 并发执行：**
```javascript
// ❌ 慢（顺序执行）
for (const target of targets) {
  await bot.copyMessage(...);  // 等待每个请求完成
}

// ✅ 快（并发执行）
const promises = targets.map(target => 
  bot.copyMessage(...)
);
await Promise.all(promises);
```

**当前实现：** 半并发
- 备份频道：先执行（优先保证备份成功）
- 转发目标：顺序执行（避免 API 限制）

**Telegram API 限制：**
- 普通 Bot: 30 req/s
- 验证 Bot: 无限制（需申请）

**Cloudflare Workers 限制：**
- 免费版: 10ms CPU 时间
- 付费版: 50ms CPU 时间

### 数据库性能

**优化措施：**
1. 添加索引（`file_id`, `repo_id`, `user_id`）
2. JSON 字段（`forwarded_to`, `metadata`）减少查询
3. 定期清理过期记录（`expires_at`）

**查询示例：**
```sql
-- 快速查找某个文件的所有转发记录
SELECT * FROM forwarded_messages 
WHERE media_file_id = 'AgACAgIAAxkBAAI...'
LIMIT 100;

-- 统计某视频库的转发情况
SELECT 
  COUNT(*) as total,
  COUNT(backup_message_id) as backed_up,
  SUM(media_file_size) as total_size
FROM forwarded_messages
WHERE repo_id = ?;
```

---

## 安全考虑

### 1. 权限验证

```javascript
async checkPermission(repoId, userId, requiredRole = 'contributor') {
  const repo = await getRepositoryById(repoId);
  
  // 创建者默认是 admin
  if (repo.created_by === userId) return true;
  
  // 检查权限表
  const perm = await db.query('SELECT role FROM forward_permissions WHERE ...');
  
  const roleLevel = { viewer: 1, contributor: 2, admin: 3 };
  return roleLevel[perm.role] >= roleLevel[requiredRole];
}
```

### 2. 输入验证

```javascript
// 视频库名称：只允许字母、数字、下划线
if (!/^[a-zA-Z0-9_]{3,30}$/.test(repoName)) {
  return sendError("名称格式错误");
}

// Chat ID：必须是数字
if (isNaN(parseInt(chatId))) {
  return sendError("Chat ID 格式错误");
}
```

### 3. 敏感数据保护

- ✅ Bot Token 使用 `wrangler secret`
- ✅ 备份频道 ID 不对外暴露
- ✅ file_id 不能直接下载（需要 Bot Token）

---

## 测试清单

### 单元测试

- [ ] Bot 邀请链接生成
- [ ] `/bind` 命令解析
- [ ] 媒体元数据提取
- [ ] 权限验证逻辑

### 集成测试

- [ ] 创建视频库
- [ ] 添加转发目标
- [ ] 设置备份频道
- [ ] 转发消息（文字）
- [ ] 转发消息（图片）
- [ ] 转发消息（视频）
- [ ] 转发消息（文档）

### 边界测试

- [ ] 无转发目标时转发
- [ ] 无权限时绑定
- [ ] 备份频道不存在
- [ ] Bot 不是管理员
- [ ] Chat ID 格式错误
- [ ] 重复绑定同一群组

---

## 部署检查清单

- [ ] 数据库迁移已执行 (`migration_v3.sql`)
- [ ] 新代码已部署到 Workers
- [ ] Webhook 已设置
- [ ] Bot Token 已配置
- [ ] 测试 `/start` 命令响应
- [ ] 测试创建视频库
- [ ] 测试邀请链接生成
- [ ] 测试群组绑定
- [ ] 测试备份频道设置
- [ ] 测试实际转发功能
- [ ] 验证数据库记录正确
- [ ] 检查日志无错误

---

## 文档清单

- [x] DEPLOYMENT_V3.md（部署指南）
- [x] migration_v3.sql（数据库迁移）
- [x] test_v3.sh（测试脚本）
- [x] FEATURE_COMPARISON.md（本文档）
- [ ] API_REFERENCE.md（API 文档）
- [ ] USER_GUIDE.md（用户手册）

---

**✅ 所有核心功能已实现！准备部署！**
