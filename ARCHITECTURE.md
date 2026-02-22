# 项目结构说明

```
telegram-verification-bot/
├── src/                          # 源代码目录
│   ├── index.js                  # Worker 入口，处理 HTTP 请求
│   ├── telegram.js               # Telegram 更新处理主逻辑
│   ├── telegram-api.js           # Telegram Bot API 封装
│   ├── bot-detection.js          # 机器人检测算法
│   └── database.js               # D1 数据库操作封装
├── schema/
│   └── schema.sql                # 数据库表结构定义
├── wrangler.toml                 # Cloudflare Workers 配置
├── package.json                  # Node.js 项目配置
├── README.md                     # 项目说明文档
├── DEPLOYMENT.md                 # 部署指南
├── ADMIN_COMMANDS.md             # 管理员命令扩展示例
└── .gitignore                    # Git 忽略规则
```

## 核心模块说明

### 1. index.js - HTTP 入口
- 处理 `/webhook` - Telegram 更新接收
- 处理 `/setup` - 设置 webhook
- 处理 `/health` - 健康检查

### 2. telegram.js - 业务逻辑核心
- `handleTelegramUpdate()` - 分发不同类型的更新
- `processNewMember()` - 新成员加入处理
- `handleCallbackQuery()` - 按钮点击处理
- `handlePrivateMessage()` - 私聊消息处理
- `handleGroupMessage()` - 群组消息处理

### 3. bot-detection.js - 反机器人引擎
- `detectBot()` - 多维度检测算法
- `generateVerificationChallenge()` - 生成验证挑战
- 支持数学题、按钮、验证码三种验证方式

### 4. telegram-api.js - API 客户端
- `TelegramBot` 类封装常用 API
- 发送消息、限制权限、踢人、删除消息等
- 统一错误处理

### 5. database.js - 数据访问层
- 用户验证记录 CRUD
- 黑名单管理
- 群组配置
- 检测日志记录

## 数据流程

### 新成员加入流程
```
新成员加入
    ↓
检查黑名单
    ↓
机器人检测（评分）
    ↓
高可疑度？ → 是 → 自动封禁
    ↓ 否
限制发言权限
    ↓
生成验证挑战
    ↓
发送验证消息
    ↓
等待用户响应
    ↓
验证成功？ → 是 → 解除限制
    ↓ 否
记录失败次数
    ↓
超过3次？ → 是 → 封禁+加入黑名单
```

### 验证流程
```
用户点击按钮/发送答案
    ↓
检查是否为目标用户
    ↓
检查验证状态
    ↓
增加尝试次数
    ↓
检查答案正确性
    ↓
正确 → 更新状态、解除限制、发送欢迎
    ↓
错误 → 检查尝试次数
    ↓
≥3次 → 封禁+黑名单
    ↓
<3次 → 提示重试
```

## 机器人检测规则

| 检测维度 | 权重 | 说明 |
|---------|------|------|
| 官方bot标记 | 100 | is_bot = true |
| 垃圾关键词 | 40 | 色情、博彩等 |
| 用户名模式 | 30 | bot后缀、纯数字 |
| 快速加入 | 25 | <5秒连续加入 |
| 数字名称 | 20 | 名字只有数字 |
| 无效名称 | 15 | 过短或空名称 |
| 无用户名 | 10 | 没有@username |
| 无头像 | 10 | 没有设置头像 |
| 新账号 | 5 | ID > 5B |

**阈值设定：**
- ≥70分：高度可疑（自动封禁）
- ≥50分：中度可疑（机器人）
- ≥30分：低度可疑（需验证）
- <30分：正常用户

## 扩展点

### 1. 自定义验证方式
在 `bot-detection.js` 中添加新的 challenge 生成器：

```javascript
function generateCustomChallenge() {
  return {
    type: 'custom',
    question: '你的问题',
    answer: '正确答案',
    options: ['选项1', '选项2', '选项3', '正确答案']
  };
}
```

### 2. 添加新的检测规则
在 `detectBot()` 函数中添加检测逻辑：

```javascript
// 检查账号创建时间（需要额外 API）
if (user.created_date && Date.now() - user.created_date < 86400000) {
  score += 20;
  detections.push({ type: 'new_account' });
}
```

### 3. 实现超时自动踢出
使用 Cloudflare Durable Objects 或 Queue：

```javascript
// 在 processNewMember 中
await env.VERIFICATION_QUEUE.send({
  user_id: user.id,
  chat_id: chatId,
  expires_at: Date.now() + config.timeout_seconds * 1000
});
```

### 4. 多语言支持
创建语言配置文件，根据群组或用户语言发送对应消息。

## 性能优化建议

1. **缓存群组配置**：使用 KV 存储减少 D1 查询
2. **批量操作**：积累一段时间的检测日志后批量写入
3. **异步处理**：使用 Queue 处理非实时任务
4. **限流保护**：防止恶意用户频繁触发验证

## 安全建议

1. **使用 Secrets** 存储敏感信息（Bot Token）
2. **验证 Webhook** 来源（使用 secret token）
3. **限制管理命令** 只对管理员开放
4. **记录操作日志** 便于审计
5. **定期清理** 过期的验证记录

## 监控指标

建议监控以下指标：
- 每日新成员数量
- 验证通过率
- 机器人检测准确率
- 平均验证时间
- API 调用错误率

可以通过 Cloudflare Analytics Dashboard 或自定义日志分析实现。
