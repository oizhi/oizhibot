/**
 * Telegram Update 处理主逻辑
 */

import { TelegramBot, createInlineKeyboard } from './telegram-api';
import { detectBot, generateVerificationChallenge } from './bot-detection';
import {
  getUserVerification,
  createVerification,
  updateVerificationStatus,
  incrementAttempts,
  isBlacklisted,
  addToBlacklist,
  getGroupConfig,
  logBotDetection,
  getBotDetectionScore
} from './database';

export async function handleTelegramUpdate(update, env) {
  const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN);
  const db = env.DB;

  // 处理新成员加入群组
  if (update.chat_member && update.chat_member.new_chat_member) {
    await handleNewChatMember(update.chat_member, bot, db);
    return;
  }

  // 处理新成员消息（另一种加群通知）
  if (update.message && update.message.new_chat_members) {
    for (const member of update.message.new_chat_members) {
      await handleNewMember(update.message, member, bot, db);
    }
    return;
  }

  // 处理回调按钮点击
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, bot, db);
    return;
  }

  // 处理私聊消息（验证码回答）
  if (update.message && update.message.chat.type === 'private') {
    await handlePrivateMessage(update.message, bot, db);
    return;
  }

  // 处理群组消息（来自待验证用户）
  if (update.message && ['group', 'supergroup'].includes(update.message.chat.type)) {
    await handleGroupMessage(update.message, bot, db);
    return;
  }
}

async function handleNewChatMember(chatMember, bot, db) {
  const user = chatMember.new_chat_member.user;
  const chatId = chatMember.chat.id;

  if (user.is_bot && user.id === chatMember.from.id) {
    // 机器人自己被添加，忽略
    return;
  }

  await processNewMember(chatId, user, bot, db);
}

async function handleNewMember(message, member, bot, db) {
  const chatId = message.chat.id;
  await processNewMember(chatId, member, bot, db);
}

async function processNewMember(chatId, user, bot, db) {
  // 检查是否在黑名单
  if (await isBlacklisted(db, user.id)) {
    await bot.kickChatMember(chatId, user.id);
    await logBotDetection(db, {
      user_id: user.id,
      chat_id: chatId,
      detection_type: 'blacklist',
      score: 100,
      action: 'banned'
    });
    return;
  }

  // 获取群组配置
  const config = await getGroupConfig(db, chatId);

  // 机器人检测
  const detection = detectBot(user, {
    joinTime: Date.now()
  });

  // 记录检测日志
  if (detection.score > 0) {
    await logBotDetection(db, {
      user_id: user.id,
      chat_id: chatId,
      detection_type: 'join_detection',
      score: detection.score,
      action: detection.isBot ? 'auto_ban' : 'verify',
      metadata: detection.detections
    });
  }

  // 如果是高可疑度且开启自动封禁
  if (detection.isBot && config.auto_ban_bots) {
    await bot.kickChatMember(chatId, user.id);
    await addToBlacklist(db, user.id, 'Auto-detected as bot', null);
    
    await bot.sendMessage(
      chatId,
      `🤖 检测到机器人账号并已自动封禁\n用户: ${user.first_name || 'N/A'}\nID: ${user.id}\n可疑分数: ${detection.score}/100`
    );
    return;
  }

  // 限制新成员权限
  await bot.restrictChatMember(chatId, user.id, {
    can_send_messages: false
  });

  // 生成验证挑战
  const challenge = generateVerificationChallenge(config.verification_type);

  // 保存验证记录
  await createVerification(db, {
    user_id: user.id,
    username: user.username,
    first_name: user.first_name,
    chat_id: chatId,
    verification_code: challenge.answer,
    metadata: { challenge, detection }
  });

  // 发送验证消息
  let keyboard;
  if (challenge.options) {
    keyboard = createInlineKeyboard([
      challenge.options.map(option => ({
        text: option,
        callback_data: `verify:${user.id}:${option}`
      }))
    ]);
  }

  const userName = user.username ? `@${user.username}` : user.first_name;
  const warningText = detection.isSuspicious 
    ? `\n\n⚠️ 检测到可疑行为，请完成验证` 
    : '';

  const message = await bot.sendMessage(
    chatId,
    `👋 欢迎 ${userName}!\n\n${challenge.question}\n\n⏱ 请在 ${config.timeout_seconds} 秒内完成验证${warningText}`,
    keyboard ? { reply_markup: keyboard } : {}
  );

  // 设置超时自动踢出（使用 Durable Objects 或外部定时器）
  // 这里简化处理，实际应该用 Cloudflare 的 Durable Objects 或 Queue
}

async function handleCallbackQuery(callbackQuery, bot, db) {
  const data = callbackQuery.data;
  const user = callbackQuery.from;
  const message = callbackQuery.message;

  if (!data.startsWith('verify:')) {
    return;
  }

  const [_, targetUserId, answer] = data.split(':');

  // 只允许目标用户点击
  if (user.id.toString() !== targetUserId) {
    await bot.answerCallbackQuery(
      callbackQuery.id,
      '❌ 这不是你的验证消息',
      true
    );
    return;
  }

  // 获取验证记录
  const verification = await getUserVerification(db, user.id);

  if (!verification || verification.status !== 'pending') {
    await bot.answerCallbackQuery(
      callbackQuery.id,
      '验证已过期或已完成',
      true
    );
    return;
  }

  // 增加尝试次数
  await incrementAttempts(db, user.id);

  // 检查答案
  if (answer === verification.verification_code) {
    // 验证成功
    await updateVerificationStatus(db, user.id, 'verified');
    await bot.unrestrictChatMember(verification.chat_id, user.id);

    await bot.answerCallbackQuery(callbackQuery.id, '✅ 验证成功！');
    
    await bot.sendMessage(
      verification.chat_id,
      `✅ ${user.first_name} 已通过验证，欢迎加入！`
    );

    // 删除验证消息
    await bot.deleteMessage(message.chat.id, message.message_id);

  } else {
    // 验证失败
    const verification_updated = await getUserVerification(db, user.id);
    
    if (verification_updated.attempts >= 3) {
      // 超过最大尝试次数
      await updateVerificationStatus(db, user.id, 'failed');
      await bot.kickChatMember(verification.chat_id, user.id);
      await addToBlacklist(db, user.id, 'Failed verification', null);

      await bot.answerCallbackQuery(
        callbackQuery.id,
        '❌ 验证失败次数过多，已被移出群组',
        true
      );

      await bot.sendMessage(
        verification.chat_id,
        `❌ ${user.first_name} 验证失败，已被移出群组`
      );

      await bot.deleteMessage(message.chat.id, message.message_id);
    } else {
      await bot.answerCallbackQuery(
        callbackQuery.id,
        `❌ 答案错误，还剩 ${3 - verification_updated.attempts} 次机会`,
        true
      );
    }
  }
}

async function handlePrivateMessage(message, bot, db) {
  const user = message.from;
  const text = message.text?.trim();

  // 获取待验证记录
  const verification = await getUserVerification(db, user.id);

  if (!verification || verification.status !== 'pending') {
    await bot.sendMessage(
      message.chat.id,
      '你当前没有待验证的请求。'
    );
    return;
  }

  // 检查答案（用于文字验证码）
  if (text.toLowerCase() === verification.verification_code.toLowerCase()) {
    await updateVerificationStatus(db, user.id, 'verified');
    await bot.unrestrictChatMember(verification.chat_id, user.id);

    await bot.sendMessage(message.chat.id, '✅ 验证成功！你现在可以在群组中发言了。');
    await bot.sendMessage(
      verification.chat_id,
      `✅ ${user.first_name} 已通过验证，欢迎加入！`
    );
  } else {
    await incrementAttempts(db, user.id);
    const verification_updated = await getUserVerification(db, user.id);

    if (verification_updated.attempts >= 3) {
      await updateVerificationStatus(db, user.id, 'failed');
      await bot.kickChatMember(verification.chat_id, user.id);
      await addToBlacklist(db, user.id, 'Failed verification', null);

      await bot.sendMessage(
        message.chat.id,
        '❌ 验证失败次数过多，你已被移出群组。'
      );
    } else {
      await bot.sendMessage(
        message.chat.id,
        `❌ 答案错误，还剩 ${3 - verification_updated.attempts} 次机会`
      );
    }
  }
}

async function handleGroupMessage(message, bot, db) {
  const user = message.from;
  const verification = await getUserVerification(db, user.id);

  // 如果用户还在验证状态，删除其消息
  if (verification && verification.status === 'pending') {
    await bot.deleteMessage(message.chat.id, message.message_id);
    
    // 可选：提醒用户先完成验证
    const reminder = await bot.sendMessage(
      message.chat.id,
      `@${user.username || user.first_name} 请先完成验证再发言`
    );

    // 5秒后删除提醒消息
    setTimeout(async () => {
      try {
        await bot.deleteMessage(message.chat.id, reminder.message_id);
      } catch (e) {}
    }, 5000);
  }
}
