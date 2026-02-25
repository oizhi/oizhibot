# 🎯 V3 新功能使用指南

## 功能 1：Bot 邀请链接 + 群组快捷绑定

### 📖 使用场景
你想创建一个「旅行视频库」，并将视频自动转发到你的 YouTube 频道、Instagram 群组和 Twitter 账号。

### 🎬 操作流程

#### 第 1 步：创建视频库
1. 私聊 Bot 发送 `/start`
2. 点击「➕ 创建新视频库」
3. 输入视频库名称：`travel_videos`
4. 输入描述：`我的旅行视频合集`

#### 第 2 步：获取邀请链接
1. 选择刚创建的「travel_videos」
2. 点击「🔗 邀请链接」按钮
3. Bot 会返回类似这样的链接：
   ```
   https://t.me/你的Bot?startgroup=travel_videos
   ```

#### 第 3 步：添加 Bot 到群组/频道
1. **方法 A：直接点击链接**
   - 点击邀请链接
   - 选择你要转发的目标（群组或频道）
   - Bot 自动加入

2. **方法 B：手动添加**
   - 打开目标群组/频道
   - 添加 Bot 为成员
   - Bot 会自动发送欢迎消息

#### 第 4 步：快捷绑定
在目标群组/频道中发送：
```
/bind travel_videos
```

Bot 会立即回复：
```
✅ 绑定成功！

📦 视频库：travel_videos
🎯 目标：YouTube 频道
📝 类型：频道

现在发送到 "travel_videos" 的内容会自动转发到这里
```

#### 第 5 步：开始使用
1. 返回私聊 Bot
2. 选择「travel_videos」
3. 点击「🚀 开始转发」
4. 发送你的视频/照片
5. Bot 自动转发到所有绑定的目标！

---

## 功能 2：备份频道功能

### 📖 使用场景
你担心目标频道可能被删除或封禁，想要一个私有的备份频道来永久保存所有内容。

### 🎬 操作流程

#### 第 1 步：创建私有备份频道
1. 在 Telegram 中创建一个新频道
2. 设置为「私有频道」
3. 添加你的 Bot 为管理员

#### 第 2 步：设置备份频道
1. 私聊 Bot，选择你的视频库（例如：`travel_videos`）
2. 点击「💾 备份设置」
3. 点击「🔗 获取邀请链接」
4. 在私有备份频道中发送：
   ```
   /bind travel_videos
   ```

#### 第 3 步：启用备份
1. 返回 Bot，刷新「💾 备份设置」
2. 确认备份频道已设置
3. 确保「备份状态」为「✅ 已启用」

#### 第 4 步：测试转发
1. 点击「🚀 开始转发」
2. 发送一张测试照片
3. 观察转发流程：

```
你的消息
    ↓
  Bot 接收
    ↓
    ├─→ 备份频道（私有）✅
    ├─→ YouTube 频道 ✅
    ├─→ Instagram 群组 ✅
    └─→ Twitter 账号 ✅
```

#### 第 5 步：验证备份
打开你的私有备份频道，应该看到：
- ✅ 所有转发的内容都已保存
- ✅ 保留完整的媒体文件
- ✅ 即使目标频道被删除，备份依然存在

---

## 功能 3：媒体元数据记录（自动）

### 📖 这是什么？
每次转发媒体文件时，Bot 会自动记录：
- **file_id**：Telegram 内部文件 ID（可重复使用）
- **file_unique_id**：永久唯一标识符
- **MIME 类型**：`video/mp4`, `image/jpeg`, `application/pdf` 等
- **文件大小**：字节数
- **标题/描述**：媒体的 caption

### 🔍 查看记录
```bash
# 查询最近转发的文件
npx wrangler d1 execute telegram_verification \
  --command="SELECT 
    media_file_id, 
    media_mime_type, 
    media_file_size, 
    caption 
  FROM forwarded_messages 
  WHERE media_file_id IS NOT NULL 
  ORDER BY forwarded_at DESC 
  LIMIT 10"
```

### 🎯 未来用途
- **重新下载**：使用 `file_id` 重新获取文件
- **去重**：通过 `file_unique_id` 检测重复上传
- **统计**：分析你转发了多少视频/图片/文档
- **R2 上传**：自动上传到 Cloudflare R2 存储

---

## 🎯 完整工作流示例

### 场景：YouTube 视频自动备份系统

#### 设置阶段
1. **创建视频库**
   ```
   /start → ➕ 创建新视频库 → youtube_archive
   ```

2. **设置备份频道**
   - 创建私有频道：「YouTube 备份仓库」
   - 添加 Bot，绑定为备份频道

3. **添加目标频道**
   - 使用邀请链接添加 Bot 到「YouTube 官方频道」
   - 在频道中：`/bind youtube_archive`

#### 日常使用
每次你发布新视频：
1. 私聊 Bot
2. 选择「youtube_archive」
3. 点击「🚀 开始转发」
4. 发送视频文件或 YouTube 链接
5. Bot 自动：
   - ✅ 备份到私有频道
   - ✅ 转发到 YouTube 官方频道
   - ✅ 记录所有元数据

#### 数据安全
- 即使 YouTube 频道被删除，备份依然存在
- 可以随时从 `file_id` 重新下载
- 完整的转发历史记录

---

## 🎨 UI 界面预览

### 视频库管理界面
```
📦 travel_videos
我的旅行视频合集

👤 创建者：@你的用户名
📅 创建于：2026-02-25

━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 转发目标 (3 个)：
  ✅ YouTube 频道
  ✅ Instagram 群组
  ✅ Twitter 账号

💾 备份频道：
  ✅ YouTube 备份仓库（私有）

━━━━━━━━━━━━━━━━━━━━━━━━━━

[ 🚀 开始转发 ] [ 💾 备份设置 ]
[ 🔗 邀请链接 ] [ ⚙️ 设置 ]
```

### 备份设置界面
```
💾 备份频道设置

当前状态：✅ 已启用
备份频道：YouTube 备份仓库

━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 备份统计：
  • 已备份消息：156 条
  • 占用空间：2.3 GB
  • 最后备份：2 分钟前

━━━━━━━━━━━━━━━━━━━━━━━━━━

[ 🔗 获取邀请链接 ]
[ ⏸️ 暂停备份 ]
[ 🗑️ 移除备份频道 ]
[ ⬅️ 返回 ]
```

---

## 🚨 常见问题

### Q1：邀请链接无法使用？
**A：** 确保 Bot 的用户名已设置。检查：
```bash
curl "https://api.telegram.org/bot你的TOKEN/getMe"
```

### Q2：/bind 命令没反应？
**A：** 检查：
1. Bot 是否已加入群组
2. 视频库名称是否正确
3. 你是否有管理员权限

### Q3：备份频道收不到消息？
**A：** 确认：
1. Bot 是否为频道管理员
2. 备份功能是否启用
3. 查看 Bot 日志：`npx wrangler tail`

### Q4：如何查看 file_id？
**A：** 查询数据库：
```bash
npx wrangler d1 execute telegram_verification \
  --command="SELECT media_file_id FROM forwarded_messages LIMIT 1"
```

---

## 📚 相关文档

- **部署指南**：`DEPLOYMENT_V3.md`
- **功能对比**：`FEATURE_COMPARISON.md`
- **技术文档**：`README_V3.md`
- **部署就绪**：`DEPLOYMENT_READY.md`

---

**🎉 开始使用 V3 新功能，让视频管理更轻松！**
