# 转发系统集成说明

## 当前状态

✅ **已完成:**
1. 数据库表已添加到初始化函数（4个转发表 + 索引）
2. /help 命令已更新，包含所有转发命令说明
3. 转发系统核心模块已实现：
   - `src/forwarding-db.js` - 24个数据库函数
   - `src/forwarding-handler.js` - 完整命令处理器

## 集成方式选择

由于 Cloudflare Workers 不支持 CommonJS `require()`，有两种集成方案：

### 方案 A：简化版（推荐，快速上线）
**只添加核心转发功能**，暂时不包含权限和统计：

核心命令（6个）：
- `/repo_create` - 创建存储库
- `/repo_list` - 列出存储库
- `/target_add` - 添加转发目标
- `/use` - 开启/关闭自动转发
- `/forward` - 手动转发
- 自动转发功能

优点：
- ✅ 代码量小（~300行）
- ✅ 快速部署
- ✅ 核心功能完整
- ✅ 后续可扩展

### 方案 B：完整版（功能完整）
**添加所有 15 个命令**，包含权限、统计等：

所有命令：
- 存储库管理（4个）
- 目标管理（4个）
- 权限管理（3个）
- 转发操作（2个）
- 统计查询（2个）

优点：
- ✅ 功能完整
- ✅ 权限控制
- ✅ 详细统计

缺点：
- ⚠️ 代码量大（~1500行）
- ⚠️ 需要更多测试

---

## 推荐：方案 A（简化版）

### 实现步骤

#### 1. 数据库函数（内联到 worker.bundle.js）

```javascript
// ==================== Forwarding Database Functions ====================

async function getForwardRepository(db, name) {
  try {
    return await db
      .prepare('SELECT * FROM forward_repositories WHERE name = ?')
      .bind(name)
      .first();
  } catch (error) {
    console.error('getForwardRepository error:', error);
    return null;
  }
}

async function createForwardRepository(db, name, description, userId) {
  try {
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO forward_repositories (name, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(name, description, userId, now, now)
      .run();
    return { success: true };
  } catch (error) {
    console.error('createForwardRepository error:', error);
    return { success: false, error: error.message };
  }
}

async function listForwardRepositories(db, userId) {
  try {
    const result = await db
      .prepare('SELECT * FROM forward_repositories WHERE created_by = ? ORDER BY created_at DESC')
      .bind(userId)
      .all();
    return result.results || [];
  } catch (error) {
    console.error('listForwardRepositories error:', error);
    return [];
  }
}

async function listForwardTargets(db, repoId) {
  try {
    const result = await db
      .prepare('SELECT * FROM forward_targets WHERE repository_id = ? AND enabled = 1')
      .bind(repoId)
      .all();
    return result.results || [];
  } catch (error) {
    console.error('listForwardTargets error:', error);
    return [];
  }
}

async function addForwardTarget(db, repoId, targetChatId, targetType) {
  try {
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO forward_targets (repository_id, target_chat_id, target_type, enabled, created_at)
         VALUES (?, ?, ?, 1, ?)`
      )
      .bind(repoId, targetChatId, targetType, now)
      .run();
    return { success: true };
  } catch (error) {
    console.error('addForwardTarget error:', error);
    return { success: false, error: error.message };
  }
}

async function logForwardedMessage(db, data) {
  try {
    const { repository_id, source_user_id, source_message_id, message_type, forwarded_to } = data;
    const now = Date.now();
    
    await db
      .prepare(
        `INSERT INTO forwarded_messages 
         (repository_id, source_user_id, source_message_id, message_type, forwarded_to, forwarded_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        repository_id,
        source_user_id,
        source_message_id,
        message_type,
        JSON.stringify(forwarded_to),
        now
      )
      .run();
  } catch (error) {
    console.error('logForwardedMessage error:', error);
  }
}
```

#### 2. 用户状态管理（在 fetch 函数外添加）

```javascript
// 全局状态：用户当前选择的存储库
const userCurrentRepo = new Map(); // userId -> repoName
```

#### 3. 转发命令处理（在 handlePrivateMessage 函数中添加）

```javascript
// 在私聊消息处理中添加转发命令
async function handlePrivateMessage(message, bot, db) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const user = message.from;
  const text = message.text || '';

  // ... 现有的 /start, /help, /check 命令 ...

  // ========== 转发系统命令 ==========
  
  // /repo_create
  if (text.startsWith('/repo_create')) {
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await bot.sendMessage(chatId, '用法: /repo_create <名称> <描述>');
      return;
    }
    
    const name = args[0];
    const description = args.slice(1).join(' ');
    
    const result = await createForwardRepository(db, name, description, userId);
    
    if (result.success) {
      await bot.sendMessage(
        chatId,
        `✅ 存储库创建成功！\n\n📦 名称: ${name}\n📝 描述: ${description}\n\n💡 下一步:\n1. 添加转发目标: /target_add ${name} <chat_id>\n2. 开始转发: /use ${name}`
      );
    } else {
      await bot.sendMessage(chatId, `❌ 创建失败: ${result.error}`);
    }
    return;
  }

  // /repo_list
  if (text === '/repo_list') {
    const repos = await listForwardRepositories(db, userId);
    
    if (repos.length === 0) {
      await bot.sendMessage(chatId, '📦 你还没有创建任何存储库\n\n使用 /repo_create 创建第一个');
      return;
    }
    
    let msg = '📦 <b>你的存储库</b>\n\n';
    for (const repo of repos) {
      const targets = await listForwardTargets(db, repo.id);
      msg += `• <b>${repo.name}</b> - ${repo.description}\n`;
      msg += `  🎯 转发目标: ${targets.length} 个\n\n`;
    }
    msg += '\n💡 使用 /use <名称> 开始转发';
    
    await bot.sendMessage(chatId, msg);
    return;
  }

  // /target_add
  if (text.startsWith('/target_add')) {
    const args = text.split(' ').slice(1);
    if (args.length < 2) {
      await bot.sendMessage(chatId, '用法: /target_add <存储库> <目标chat_id>');
      return;
    }
    
    const repoName = args[0];
    const targetChatId = parseInt(args[1]);
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    if (repo.created_by !== userId) {
      await bot.sendMessage(chatId, '❌ 只有创建者可以添加转发目标');
      return;
    }
    
    // 检测目标类型
    let targetType = 'group';
    if (targetChatId > 0) {
      targetType = 'private';
    } else if (String(targetChatId).startsWith('-100')) {
      targetType = 'channel';
    }
    
    // 尝试发送测试消息
    try {
      await bot.sendMessage(
        targetChatId,
        `✅ 转发目标已添加！\n\n📦 存储库: ${repoName}\n\n现在此${targetType === 'channel' ? '频道' : '群组'}会收到转发的内容。`
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ 无法发送消息到目标 ${targetChatId}\n\n请确保:\n1. Bot 已加入目标群组/频道\n2. Bot 有发送消息权限\n3. Chat ID 正确`
      );
      return;
    }
    
    await addForwardTarget(db, repo.id, targetChatId, targetType);
    await bot.sendMessage(chatId, `✅ 转发目标已添加！\n\n📦 存储库: ${repoName}\n🎯 目标: ${targetChatId} (${targetType})`);
    return;
  }

  // /use
  if (text.startsWith('/use')) {
    const args = text.split(' ').slice(1);
    if (args.length < 1) {
      await bot.sendMessage(chatId, '用法: /use <存储库名称> 或 /use off');
      return;
    }
    
    const repoName = args[0];
    
    if (repoName === 'off') {
      userCurrentRepo.delete(userId);
      await bot.sendMessage(chatId, '✅ 已关闭自动转发');
      return;
    }
    
    const repo = await getForwardRepository(db, repoName);
    if (!repo) {
      await bot.sendMessage(chatId, `❌ 存储库 "${repoName}" 不存在`);
      return;
    }
    
    if (repo.created_by !== userId) {
      await bot.sendMessage(chatId, '❌ 你没有权限使用此存储库');
      return;
    }
    
    userCurrentRepo.set(userId, repoName);
    
    const targets = await listForwardTargets(db, repo.id);
    await bot.sendMessage(
      chatId,
      `✅ <b>当前存储库: ${repoName}</b>\n\n现在发送的所有消息都会转发到 ${targets.length} 个目标\n\n发送 /use off 关闭自动转发`
    );
    return;
  }

  // 检查是否有当前存储库（自动转发）
  const currentRepo = userCurrentRepo.get(userId);
  if (currentRepo) {
    await forwardMessageToRepo(message, currentRepo, bot, db);
    return;
  }

  // ... 现有的其他私聊消息处理 ...
}

// 转发消息到存储库
async function forwardMessageToRepo(message, repoName, bot, db) {
  const repo = await getForwardRepository(db, repoName);
  if (!repo) {
    await bot.sendMessage(message.chat.id, `❌ 存储库 "${repoName}" 不存在`);
    return;
  }

  const targets = await listForwardTargets(db, repo.id);
  if (targets.length === 0) {
    await bot.sendMessage(message.chat.id, '❌ 此存储库没有转发目标');
    return;
  }

  // 并发转发到所有目标
  const results = await Promise.allSettled(
    targets.map(target => 
      bot.forwardMessage(target.target_chat_id, message.chat.id, message.message_id)
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  // 记录日志
  await logForwardedMessage(db, {
    repository_id: repo.id,
    source_user_id: message.from.id,
    source_message_id: message.message_id,
    message_type: getMessageType(message),
    forwarded_to: targets.map(t => t.target_chat_id)
  });

  // 发送确认
  await bot.sendMessage(
    message.chat.id,
    `✅ 已转发到 ${repoName}\n\n成功: ${successful} 个目标${failed > 0 ? `\n失败: ${failed} 个目标` : ''}`
  );
}

function getMessageType(message) {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.audio) return 'audio';
  if (message.voice) return 'voice';
  if (message.sticker) return 'sticker';
  return 'text';
}
```

---

## 快速部署清单

### 1. 添加到 worker.bundle.js
- [x] 数据库表定义（已完成）
- [ ] 转发数据库函数（6个）
- [ ] 用户状态管理（userCurrentRepo Map）
- [ ] 转发命令处理（4个命令）
- [ ] 自动转发逻辑

### 2. 测试
```bash
# 部署
npx wrangler deploy

# 测试命令
/repo_create test 测试存储库
/target_add test @your_channel
/use test
发送消息...
```

---

## 你希望：

### A. 我现在完成简化版集成 ⚡
添加核心 6 个命令，快速上线

### B. 先看看代码再决定 👀
我把完整代码发给你review

### C. 完整版一次性搞定 🚀
添加所有 15 个命令

**推荐选 A，30分钟内完成集成和部署！**
