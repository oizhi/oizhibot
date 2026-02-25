# 🚀 转发系统 - 快速开始

## ✅ 完成状态

**✨ 完整版转发系统已集成完毕！**

- ✅ 925 行新代码
- ✅ 15 个命令
- ✅ 完整功能
- ✅ 已推送到 GitHub

---

## 📦 5 分钟快速上手

### 1️⃣ 创建存储库
```
/repo_create my_channel 我的内容频道
```

### 2️⃣ 添加转发目标
```
/target_add my_channel @your_channel_name
```
或者使用 Chat ID:
```
/target_add my_channel -1001234567890
```

💡 **如何获取 Channel ID?**
- 将 Bot 添加到频道
- 在频道发送任意消息
- 转发该消息给 [@userinfobot](https://t.me/userinfobot)
- 它会显示 Chat ID

### 3️⃣ 开启自动转发
```
/use my_channel
```

### 4️⃣ 发送内容
现在发送给 Bot 的任何消息都会自动转发到你的频道！

支持的内容类型：
- ✅ 文本
- ✅ 图片（含 caption）
- ✅ 文档
- ✅ 音频
- ✅ 视频
- ✅ 贴纸

### 5️⃣ 关闭转发
```
/use off
```

---

## 🎯 使用场景

### 场景 1: 新闻频道
```
1. 创建: /repo_create daily_news 每日新闻
2. 添加: /target_add daily_news @news_channel
3. 授权: /perm_grant daily_news 123456 contributor
4. 团队成员开启: /use daily_news
5. 开始发送新闻！
```

### 场景 2: 内容备份
```
1. 创建: /repo_create backup 重要内容备份
2. 添加多个目标:
   /target_add backup @backup_channel_1
   /target_add backup @backup_channel_2
   /target_add backup @backup_channel_3
3. 发送内容，自动备份到 3 个频道！
```

### 场景 3: 内容分发
```
创建多个存储库:
/repo_create tech 科技内容
/repo_create marketing 营销内容
/repo_create general 综合内容

根据内容类型选择:
/use tech  → 发送科技内容
/use marketing  → 发送营销内容
/use general  → 发送综合内容
```

---

## 📋 所有命令速查

### 存储库管理
| 命令 | 说明 |
|------|------|
| `/repo_create <名称> <描述>` | 创建存储库 |
| `/repo_list` | 列出所有存储库 |
| `/repo_info <名称>` | 查看详情 |
| `/repo_delete <名称>` | 删除存储库 |

### 转发目标
| 命令 | 说明 |
|------|------|
| `/target_add <库> <chat_id>` | 添加目标 |
| `/target_remove <库> <chat_id>` | 移除目标 |
| `/target_list <库>` | 列出目标 |
| `/target_toggle <库> <chat_id>` | 启用/禁用 |

### 权限管理
| 命令 | 说明 |
|------|------|
| `/perm_grant <库> <user> <role>` | 授予权限 |
| `/perm_revoke <库> <user>` | 撤销权限 |
| `/perm_list <库>` | 列出授权 |

**角色说明:**
- `admin` - 完整管理权限
- `contributor` - 可以发送内容
- `viewer` - 只能查看

### 转发操作
| 命令 | 说明 |
|------|------|
| `/use <存储库>` | 开启自动转发 |
| `/use off` | 关闭自动转发 |

### 统计查询
| 命令 | 说明 |
|------|------|
| `/forwarded_stats <库> [period]` | 查看统计 |
| `/forwarded_recent <库> [limit]` | 最近记录 |

**Period 选项:**
- `today` - 今天
- `week` - 本周
- `all` - 总计（默认）

---

## 🔧 高级功能

### 多用户协作

1. **创建者（你）:**
```
/repo_create team_content 团队内容
/target_add team_content @team_channel
/perm_grant team_content 111111 admin
/perm_grant team_content 222222 contributor
/perm_grant team_content 333333 viewer
```

2. **管理员 (111111):**
- ✅ 可以添加/移除目标
- ✅ 可以授权/撤销权限
- ✅ 可以发送内容

3. **贡献者 (222222):**
- ✅ 可以发送内容
- ❌ 不能修改配置

4. **查看者 (333333):**
- ✅ 可以查看统计
- ❌ 不能发送内容

### 多目标转发

一个存储库可以有多个转发目标：

```
/target_add news @primary_channel
/target_add news @backup_channel
/target_add news @archive_channel
/target_add news -1001234567890
```

发送一条消息 → 同时转发到 4 个地方！

### 目标控制

暂时禁用某个目标（不删除）:
```
/target_toggle news @backup_channel
```

再次执行恢复:
```
/target_toggle news @backup_channel
```

---

## 💡 专业提示

### 1. 命名规范
使用清晰的存储库名称：
- ✅ `tech_daily`、`marketing_weekly`、`support_backup`
- ❌ `repo1`、`test`、`aaa`

### 2. 描述准确
写清楚存储库用途：
- ✅ "每日科技新闻汇总，8:00 发布"
- ❌ "新闻"

### 3. 权限最小化
只给必要的权限：
- 管理员：少数核心成员
- 贡献者：内容创作者
- 查看者：监控人员

### 4. 定期检查
每周查看统计：
```
/forwarded_stats my_repo week
```
了解活跃度和内容类型分布

### 5. 测试先行
正式使用前先测试：
```
/repo_create test_repo 测试用
/target_add test_repo @test_channel
/use test_repo
发送测试消息...
确认无误后再用于生产
```

---

## 📊 监控和维护

### 每日检查
```
/repo_list  # 查看所有存储库状态
/forwarded_stats <repo> today  # 今日转发量
```

### 每周回顾
```
/forwarded_stats <repo> week  # 本周统计
/forwarded_recent <repo> 20  # 最近 20 条记录
```

### 问题排查
转发失败？检查：
1. Bot 是否在目标频道/群组
2. Bot 权限是否足够
3. 目标是否被禁用
4. Chat ID 是否正确

查看目标状态：
```
/target_list <repo>
```

---

## 🎉 下一步

1. **现在部署**
   - 访问 Cloudflare Dashboard
   - 上传 `src/worker.bundle.js`
   - 保存并部署

2. **测试功能**
   - 发送 `/help` 查看完整帮助
   - 创建第一个存储库
   - 添加转发目标

3. **开始使用**
   - 开启自动转发
   - 享受高效内容分发！

---

**🚀 立即开始使用转发系统！**

有问题？查看 [完整测试指南](DEPLOYMENT_SUCCESS.md)
