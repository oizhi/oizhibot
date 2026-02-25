# ✅ V3 部署验证清单

## 📋 部署前检查

### 环境准备
- [ ] Node.js 已安装（18+）
- [ ] Wrangler 已安装或可通过 npx 使用
- [ ] 已登录 Cloudflare 账号 (`npx wrangler login`)
- [ ] 已创建 D1 数据库（`telegram_verification`）
- [ ] 已获取 Telegram Bot Token
- [ ] Bot Token 已配置到 Workers Secret

### 文件确认
- [ ] `src/index.enhanced.js` 存在
- [ ] `schema/migration_v3.sql` 存在
- [ ] `deploy_v3.sh` 存在且可执行
- [ ] `test_v3.sh` 存在且可执行

---

## 🔧 部署步骤

### Step 1: 备份现有系统
- [ ] 数据库已备份 (`npx wrangler d1 export`)
- [ ] 代码已备份 (`cp src/index.js src/index.backup.js`)
- [ ] 备份文件已确认存在

### Step 2: 数据库迁移
- [ ] 执行迁移脚本
  ```bash
  npx wrangler d1 execute telegram_verification --file=schema/migration_v3.sql
  ```
- [ ] 验证新字段存在
  ```bash
  npx wrangler d1 execute telegram_verification \
    --command="SELECT backup_channel_id FROM forward_repositories LIMIT 1"
  ```
- [ ] 验证索引创建
  ```bash
  npx wrangler d1 execute telegram_verification \
    --command="SELECT name FROM sqlite_master WHERE type='index' AND name='idx_forwarded_messages_file_id'"
  ```

### Step 3: 代码部署
- [ ] 替换代码文件
  ```bash
  cp src/index.enhanced.js src/index.js
  ```
- [ ] 部署到 Workers
  ```bash
  npx wrangler deploy
  ```
- [ ] 记录 Worker URL: `_______________________________`

### Step 4: Webhook 设置
- [ ] 设置 Webhook
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://your-worker.workers.dev/webhook"}'
  ```
- [ ] 验证 Webhook
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
  ```

---

## 🧪 功能测试

### 基础功能
- [ ] Bot 响应 `/start` 命令
- [ ] 显示欢迎消息和按钮
- [ ] 可以点击「➕ 创建新视频库」
- [ ] 可以输入视频库名称
- [ ] 创建成功后显示确认消息

### Bot 邀请链接
- [ ] 视频库菜单显示「🔗 邀请链接」按钮
- [ ] 点击后显示邀请链接
- [ ] 链接格式正确: `https://t.me/bot_username?startgroup=<repo_id>`
- [ ] 点击链接可以选择群组
- [ ] Bot 加入群组后发送欢迎消息

### 群组快捷绑定
- [ ] Bot 加入群组时自动发送提示
- [ ] 提示中包含 `/bind` 命令说明
- [ ] 在群组中发送 `/bind test_repo`
- [ ] Bot 验证视频库是否存在
- [ ] Bot 验证用户权限
- [ ] 绑定成功后显示确认消息
- [ ] 群组名称正确保存到数据库

### 备份频道
- [ ] 视频库菜单显示「💾 备份设置」按钮
- [ ] 点击后显示备份设置界面
- [ ] 可以使用邀请链接添加备份频道
- [ ] 可以在备份频道中使用 `/bind`
- [ ] 备份频道 ID 正确保存
- [ ] 备份状态显示正确（✅ 已启用）

### 转发功能
- [ ] 点击「🚀 开始转发」
- [ ] Bot 提示转发模式已启动
- [ ] 发送文字消息，成功转发
- [ ] 发送图片，成功转发
- [ ] 发送视频，成功转发
- [ ] 发送文档，成功转发
- [ ] 消息同时转发到目标和备份频道

### 元数据记录
- [ ] 查询数据库，确认 `media_file_id` 已记录
  ```bash
  npx wrangler d1 execute telegram_verification \
    --command="SELECT media_file_id, media_file_size, message_type FROM forwarded_messages LIMIT 5"
  ```
- [ ] 确认 `media_mime_type` 正确（如 `image/jpeg`）
- [ ] 确认 `media_file_size` 正确（字节数）
- [ ] 确认 `backup_message_id` 已记录

---

## 📊 数据验证

### 表结构验证
```bash
# 查看 forward_repositories 表结构
npx wrangler d1 execute telegram_verification \
  --command="PRAGMA table_info(forward_repositories)"

# 应该看到 backup_channel_id 和 backup_enabled 字段

# 查看 forwarded_messages 表结构
npx wrangler d1 execute telegram_verification \
  --command="PRAGMA table_info(forwarded_messages)"

# 应该看到 media_file_id, media_file_unique_id, media_mime_type 等字段

# 查看索引
npx wrangler d1 execute telegram_verification \
  --command="SELECT name FROM sqlite_master WHERE type='index'"
```

### 数据完整性验证
- [ ] 视频库数据存在
  ```bash
  npx wrangler d1 execute telegram_verification \
    --command="SELECT * FROM forward_repositories"
  ```
- [ ] 转发目标数据存在
  ```bash
  npx wrangler d1 execute telegram_verification \
    --command="SELECT * FROM forward_targets"
  ```
- [ ] 转发记录数据存在
  ```bash
  npx wrangler d1 execute telegram_verification \
    --command="SELECT COUNT(*) as total FROM forwarded_messages"
  ```

---

## 🔍 问题排查

### 问题 1: Bot 无响应
**检查：**
- [ ] Worker 是否部署成功
  ```bash
  curl https://your-worker.workers.dev/webhook
  ```
- [ ] Webhook 是否设置正确
  ```bash
  curl -X POST "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
  ```
- [ ] Worker 日志是否有错误
  ```bash
  npx wrangler tail --format=pretty
  ```

### 问题 2: /bind 命令失败
**检查：**
- [ ] 视频库是否存在
- [ ] 用户是否有权限（创建者或管理员）
- [ ] Chat ID 是否正确
- [ ] Bot 是否是群组成员

### 问题 3: 转发失败
**检查：**
- [ ] Bot 是否是目标频道/群组的管理员（频道必须）
- [ ] 目标 Chat ID 是否正确
- [ ] 是否启用了转发目标
- [ ] 查看 Worker 日志中的错误信息

### 问题 4: 备份未生效
**检查：**
- [ ] `backup_enabled = 1`
- [ ] Bot 是否是备份频道的管理员
- [ ] 备份频道 ID 是否正确（负数）
- [ ] 查看日志中的备份错误

---

## 📈 性能验证

### 响应时间
- [ ] `/start` 命令响应时间 < 1s
- [ ] 创建视频库响应时间 < 1s
- [ ] 转发单条消息响应时间 < 2s
- [ ] 转发到 10 个目标响应时间 < 5s

### 并发测试
- [ ] 同时发送 5 条消息，全部成功转发
- [ ] 多用户同时使用，无冲突

### 数据库性能
- [ ] 查询视频库列表 < 100ms
- [ ] 查询转发记录 < 200ms
- [ ] 查询统计信息 < 300ms

---

## 🔐 安全验证

### 权限验证
- [ ] 非创建者无法绑定群组
- [ ] 非管理员无法修改备份设置
- [ ] 视频库名称格式验证生效

### 数据保护
- [ ] Bot Token 使用 Secret 存储
- [ ] 备份频道 ID 不对外显示
- [ ] file_id 无法直接下载（需要 Token）

---

## 📝 文档验证

### 文档完整性
- [ ] `DEPLOYMENT_V3.md` 存在且清晰
- [ ] `FEATURE_COMPARISON.md` 存在且详细
- [ ] `QUICK_START_V3.md` 存在且易懂
- [ ] `README_V3.md` 存在且全面
- [ ] `FILE_LIST_V3.md` 存在且准确

### 文档准确性
- [ ] 部署步骤可执行
- [ ] 命令示例可运行
- [ ] 截图/示例与实际一致
- [ ] 故障排查有效

---

## ✅ 最终确认

### 功能完整性
- [ ] ✅ Bot 邀请链接功能正常
- [ ] ✅ 群组快捷绑定功能正常
- [ ] ✅ 备份频道功能正常
- [ ] ✅ 媒体元数据记录正常
- [ ] ✅ 所有 UI 界面显示正常
- [ ] ✅ 所有命令响应正常

### 数据完整性
- [ ] ✅ 数据库迁移成功
- [ ] ✅ 所有新字段存在
- [ ] ✅ 索引创建成功
- [ ] ✅ 数据查询正常

### 部署质量
- [ ] ✅ 代码部署成功
- [ ] ✅ Webhook 设置成功
- [ ] ✅ 日志无错误
- [ ] ✅ 性能符合预期

### 文档质量
- [ ] ✅ 部署指南完整
- [ ] ✅ 使用指南清晰
- [ ] ✅ 故障排查有效
- [ ] ✅ 代码注释充分

---

## 🎉 部署完成

**签名确认：**

- 部署人员: `___________________`
- 部署时间: `___________________`
- Worker URL: `___________________`
- Bot Username: `@___________________`

**备注：**
```
[在此记录任何特殊配置或注意事项]



```

---

**✅ 所有检查项完成后，V3 部署正式完成！**

---

*检查清单版本: V3.0*  
*最后更新: 2026-02-25*
