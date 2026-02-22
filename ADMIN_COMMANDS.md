# 示例：管理员命令扩展

如果你想添加管理员命令来管理机器人，可以在 `telegram.js` 中添加以下代码：

```javascript
async function handleGroupMessage(message, bot, db) {
  const user = message.from;
  const text = message.text?.trim();
  const chatId = message.chat.id;

  // 检查管理员权限
  const chatMember = await bot.getChatMember(chatId, user.id);
  const isAdmin = ['creator', 'administrator'].includes(chatMember.status);

  // 管理员命令
  if (isAdmin && text?.startsWith('/')) {
    await handleAdminCommand(message, bot, db);
    return;
  }

  // 原有的验证检查逻辑...
  const verification = await getUserVerification(db, user.id);
  if (verification && verification.status === 'pending') {
    await bot.deleteMessage(message.chat.id, message.message_id);
  }
}

async function handleAdminCommand(message, bot, db) {
  const text = message.text.trim();
  const chatId = message.chat.id;

  // /verify_config - 配置验证方式
  if (text.startsWith('/verify_config')) {
    const args = text.split(' ');
    const type = args[1]; // math, button, captcha

    if (['math', 'button', 'captcha'].includes(type)) {
      await db.prepare(`
        INSERT OR REPLACE INTO group_configs (chat_id, verification_type, updated_at)
        VALUES (?, ?, ?)
      `).bind(chatId, type, Date.now()).run();

      await bot.sendMessage(chatId, `✅ 验证方式已设置为: ${type}`);
    } else {
      await bot.sendMessage(
        chatId,
        '用法: /verify_config <math|button|captcha>'
      );
    }
    return;
  }

  // /verify_timeout - 设置超时时间
  if (text.startsWith('/verify_timeout')) {
    const args = text.split(' ');
    const seconds = parseInt(args[1]);

    if (seconds && seconds > 0) {
      await db.prepare(`
        INSERT OR REPLACE INTO group_configs (chat_id, timeout_seconds, updated_at)
        VALUES (?, ?, ?)
      `).bind(chatId, seconds, Date.now()).run();

      await bot.sendMessage(chatId, `✅ 验证超时时间已设置为: ${seconds}秒`);
    } else {
      await bot.sendMessage(chatId, '用法: /verify_timeout <秒数>');
    }
    return;
  }

  // /autoban - 开关自动封禁
  if (text.startsWith('/autoban')) {
    const args = text.split(' ');
    const enabled = args[1] === 'on' ? 1 : 0;

    await db.prepare(`
      INSERT OR REPLACE INTO group_configs (chat_id, auto_ban_bots, updated_at)
      VALUES (?, ?, ?)
    `).bind(chatId, enabled, Date.now()).run();

    await bot.sendMessage(
      chatId,
      `✅ 自动封禁已${enabled ? '开启' : '关闭'}`
    );
    return;
  }

  // /blacklist - 查看黑名单
  if (text === '/blacklist') {
    const blacklist = await db.prepare(`
      SELECT user_id, reason, banned_at 
      FROM blacklist 
      ORDER BY banned_at DESC 
      LIMIT 20
    `).all();

    if (blacklist.results.length === 0) {
      await bot.sendMessage(chatId, '黑名单为空');
      return;
    }

    const list = blacklist.results.map((item, i) => 
      `${i+1}. ID: ${item.user_id}\n   原因: ${item.reason}\n   时间: ${new Date(item.banned_at).toLocaleString()}`
    ).join('\n\n');

    await bot.sendMessage(chatId, `📋 黑名单:\n\n${list}`);
    return;
  }

  // /unban - 解除封禁
  if (text.startsWith('/unban')) {
    const args = text.split(' ');
    const userId = parseInt(args[1]);

    if (userId) {
      await db.prepare('DELETE FROM blacklist WHERE user_id = ?')
        .bind(userId)
        .run();
      
      await bot.sendMessage(chatId, `✅ 已将用户 ${userId} 从黑名单移除`);
    } else {
      await bot.sendMessage(chatId, '用法: /unban <用户ID>');
    }
    return;
  }

  // /stats - 统计信息
  if (text === '/stats') {
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM verifications
      WHERE chat_id = ?
    `).bind(chatId).first();

    const botCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM bot_detection_log
      WHERE chat_id = ? AND action = 'banned'
    `).bind(chatId).first();

    await bot.sendMessage(chatId, `
📊 群组统计:

👥 总验证数: ${stats.total}
✅ 通过: ${stats.verified}
❌ 失败: ${stats.failed}
⏳ 待验证: ${stats.pending}
🤖 封禁机器人: ${botCount.count}
    `.trim());
    return;
  }
}
```

## 使用示例

### 配置验证方式
```
/verify_config math      # 数学题
/verify_config button    # 按钮
/verify_config captcha   # 验证码
```

### 设置超时时间
```
/verify_timeout 600      # 10分钟
/verify_timeout 180      # 3分钟
```

### 自动封禁开关
```
/autoban on              # 开启
/autoban off             # 关闭
```

### 黑名单管理
```
/blacklist               # 查看黑名单
/unban 123456789         # 解除封禁
```

### 查看统计
```
/stats                   # 查看群组统计
```

## 添加白名单功能

```javascript
// 在 database.js 中添加
export async function isWhitelisted(db, userId) {
  const result = await db
    .prepare('SELECT 1 FROM whitelist WHERE user_id = ?')
    .bind(userId)
    .first();
  return !!result;
}

export async function addToWhitelist(db, userId, addedBy) {
  await db
    .prepare('INSERT OR REPLACE INTO whitelist (user_id, added_at, added_by) VALUES (?, ?, ?)')
    .bind(userId, Date.now(), addedBy)
    .run();
}

// 在 schema.sql 中添加表
CREATE TABLE IF NOT EXISTS whitelist (
    user_id INTEGER PRIMARY KEY,
    added_at INTEGER,
    added_by INTEGER
);

// 在 processNewMember 开头添加检查
if (await isWhitelisted(db, user.id)) {
  return; // 白名单用户跳过验证
}
```

## 添加欢迎消息

```javascript
// 在验证成功后发送自定义欢迎消息
const config = await getGroupConfig(db, verification.chat_id);

if (config.welcome_message) {
  await bot.sendMessage(
    verification.chat_id,
    config.welcome_message.replace('{name}', user.first_name)
  );
}
```

把这些代码整合到项目中即可获得完整的管理功能！
