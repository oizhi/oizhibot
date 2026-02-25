# 内容转发系统设计文档

## 概述
Bot 可以作为内容中转站，用户将内容发送给 Bot，Bot 自动转发到预设的频道或群组。

---

## 核心概念

### 1. 存储库（Repository）
- **定义**: 内容的逻辑分类容器
- **命名**: 唯一标识符，如 `tech_news`, `daily_updates`
- **功能**: 将不同类型的内容归类

### 2. 转发目标（Target）
- **定义**: 存储库内容要发送到的频道/群组
- **类型**: Channel（频道）、Group（群组）、Private（私聊）
- **多目标**: 一个存储库可以转发到多个目标

### 3. 权限管理
- **Admin**: 管理存储库、添加目标、授权用户
- **Contributor**: 可以发送内容到存储库
- **Viewer**: 只能查看存储库配置

---

## 数据流程

```
用户 → 发送消息给 Bot（选择存储库）
     ↓
Bot  → 识别存储库
     ↓
     → 转发到该存储库的所有目标
     ↓
     → 记录转发日志（不存储实际内容）
```

---

## 命令设计

### 存储库管理

#### `/repo_create <name> <description>`
创建新存储库
```
示例: /repo_create tech_news 科技新闻收集
```

#### `/repo_list`
列出所有存储库
```
输出:
📦 存储库列表:
1. tech_news - 科技新闻收集
   目标: @tech_channel
   
2. funny_memes - 搞笑图片
   目标: @memes_group, @backup_group
```

#### `/repo_delete <name>`
删除存储库（需确认）

#### `/repo_info <name>`
查看存储库详情
```
输出:
📦 存储库: tech_news
📝 描述: 科技新闻收集
👤 创建者: @admin
📅 创建时间: 2024-01-01

🎯 转发目标 (2):
1. @tech_channel (频道, 启用)
2. @backup_group (群组, 启用)

👥 授权用户 (3):
- @admin (管理员)
- @editor1 (贡献者)
- @viewer1 (查看者)

📊 统计:
- 总转发: 125 条
- 最近转发: 2 分钟前
```

---

### 目标管理

#### `/target_add <repo_name> <chat_id>`
为存储库添加转发目标
```
示例: /target_add tech_news @tech_channel
示例: /target_add tech_news -1001234567890
```

#### `/target_remove <repo_name> <chat_id>`
移除转发目标

#### `/target_list <repo_name>`
列出存储库的所有目标

#### `/target_toggle <repo_name> <chat_id>`
启用/禁用某个转发目标

---

### 权限管理

#### `/perm_grant <repo_name> <user_id> <role>`
授予用户权限
```
示例: /perm_grant tech_news @username contributor
示例: /perm_grant tech_news 123456789 admin
```

#### `/perm_revoke <repo_name> <user_id>`
撤销用户权限

#### `/perm_list <repo_name>`
列出存储库的授权用户

---

### 内容发送

#### 方式 1: 回复消息（推荐）
```
用户: 转发这个到 tech_news
      ↑ 回复某条消息

Bot: ✅ 已转发到 tech_news (2个目标)
```

#### 方式 2: 使用命令
```
/forward tech_news
<发送内容>

Bot: ✅ 已转发
```

#### 方式 3: 设置当前存储库
```
/use tech_news

Bot: ✅ 当前存储库: tech_news
     现在发送的所有消息都会转发到此存储库

<发送内容>
Bot: ✅ 已转发

/use off
Bot: ✅ 已关闭自动转发
```

---

### 查询和统计

#### `/forwarded_stats <repo_name>`
查看转发统计
```
输出:
📊 tech_news 转发统计

📅 今天: 15 条
📅 本周: 89 条
📅 总计: 1,234 条

📝 内容类型:
- 文本: 45%
- 图片: 30%
- 文档: 20%
- 视频链接: 5%

👥 贡献者排名:
1. @editor1: 567 条
2. @editor2: 345 条
3. @editor3: 234 条
```

#### `/forwarded_recent <repo_name> [limit]`
查看最近转发记录
```
输出:
📜 tech_news 最近转发 (10条)

1. 2分钟前 - @editor1
   类型: 图片
   
2. 15分钟前 - @editor2
   类型: 文本
   
...
```

---

## 内容类型支持

### ✅ 支持的类型
- **文本消息** - 直接转发
- **图片** - 转发（含 caption）
- **文档/文件** - 转发（含 caption）
- **音频** - 转发（含 caption）
- **视频** - 只转发消息中的视频链接（不转发大视频文件）
- **链接** - 转发
- **投票** - 不支持（Telegram API 限制）
- **贴纸** - 转发

### ⚠️ 特殊处理
- **视频**: 只提取和转发视频 URL，不转发大文件
- **相册**: 分别转发每张图片/视频
- **转发消息**: 保留原始转发信息

---

## 权限设计

### Admin（管理员）
- ✅ 创建/删除存储库
- ✅ 添加/移除转发目标
- ✅ 授权/撤销用户权限
- ✅ 发送内容到存储库
- ✅ 查看所有统计

### Contributor（贡献者）
- ✅ 发送内容到存储库
- ✅ 查看存储库配置
- ✅ 查看转发统计
- ❌ 不能修改配置
- ❌ 不能管理权限

### Viewer（查看者）
- ✅ 查看存储库配置
- ✅ 查看转发统计
- ❌ 不能发送内容
- ❌ 不能修改任何配置

---

## 安全和限制

### 1. 频率限制
- 每个用户每分钟最多转发 10 条消息
- 防止刷屏和滥用

### 2. 文件大小限制
- 文档: 最大 50MB
- 图片: 最大 10MB
- 视频: 不转发文件，只转发链接

### 3. 权限验证
- 每次转发前验证用户权限
- 目标频道必须允许 Bot 发送消息
- Bot 必须是目标群组/频道的管理员

### 4. 错误处理
- 转发失败时记录日志
- 部分目标失败不影响其他目标
- 返回详细的成功/失败报告

---

## 使用场景示例

### 场景 1: 新闻聚合
```
1. 创建存储库: /repo_create daily_news 每日新闻汇总
2. 添加目标: /target_add daily_news @news_channel
3. 授权编辑: /perm_grant daily_news @editor1 contributor
4. 编辑发送新闻给 Bot
5. Bot 自动转发到 @news_channel
```

### 场景 2: 内容备份
```
1. 创建存储库: /repo_create important_docs 重要文档备份
2. 添加多个目标:
   /target_add important_docs @backup_channel_1
   /target_add important_docs @backup_channel_2
3. 发送文档给 Bot
4. Bot 同时转发到两个备份频道
```

### 场景 3: 内容分发
```
1. 创建多个存储库:
   - tech_news → @tech_channel
   - marketing_news → @marketing_channel
   - general_news → @general_channel

2. 团队成员根据内容类型选择存储库发送
3. Bot 自动分发到对应频道
```

---

## 实现优先级

### Phase 1: 核心功能（MVP）
- [x] 数据库设计
- [ ] 存储库 CRUD
- [ ] 目标管理
- [ ] 基本转发功能（文本、图片）
- [ ] 权限验证

### Phase 2: 增强功能
- [ ] 权限管理命令
- [ ] 统计和日志
- [ ] 更多内容类型支持
- [ ] 频率限制

### Phase 3: 高级功能
- [ ] 定时转发
- [ ] 内容过滤（关键词）
- [ ] 自动标签
- [ ] Web 管理界面

---

## 技术考虑

### 1. 不存储实际内容
- 只记录元数据（消息 ID、类型、时间）
- 依赖 Telegram 的消息转发 API
- 节省存储空间

### 2. 异步转发
- 使用 `Promise.all()` 并发转发到多个目标
- 提高转发速度
- 独立处理每个目标的成功/失败

### 3. 错误恢复
- 转发失败时记录错误日志
- 可选的重试机制
- 管理员可以查看失败记录

---

## 命令总结

| 命令 | 功能 | 权限 |
|------|------|------|
| `/repo_create` | 创建存储库 | Admin |
| `/repo_list` | 列出存储库 | All |
| `/repo_delete` | 删除存储库 | Admin |
| `/repo_info` | 查看存储库详情 | All |
| `/target_add` | 添加转发目标 | Admin |
| `/target_remove` | 移除转发目标 | Admin |
| `/target_list` | 列出转发目标 | All |
| `/target_toggle` | 启用/禁用目标 | Admin |
| `/perm_grant` | 授予权限 | Admin |
| `/perm_revoke` | 撤销权限 | Admin |
| `/perm_list` | 列出授权用户 | Admin |
| `/forward` | 转发内容 | Contributor+ |
| `/use` | 设置当前存储库 | Contributor+ |
| `/forwarded_stats` | 查看统计 | Viewer+ |
| `/forwarded_recent` | 查看最近记录 | Viewer+ |

---

这个设计文档会随着开发进展持续更新。
