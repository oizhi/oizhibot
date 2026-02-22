/**
 * Telegram Verification Bot - Complete Bundle
 * All modules merged into a single file for Cloudflare Workers
 */

// ==================== Telegram API ====================
class TelegramBot {
  constructor(token) {
    this.token = token;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId, text, options = {}) {
    return this.apiCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options
    });
  }

  async restrictChatMember(chatId, userId, permissions = {}) {
    return this.apiCall('restrictChatMember', {
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        ...permissions
      }
    });
  }

  async unrestrictChatMember(chatId, userId) {
    return this.apiCall('restrictChatMember', {
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true
      }
    });
  }

  async kickChatMember(chatId, userId) {
    return this.apiCall('banChatMember', {
      chat_id: chatId,
      user_id: userId
    });
  }

  async deleteMessage(chatId, messageId) {
    return this.apiCall('deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return this.apiCall('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    });
  }

  async getChatMember(chatId, userId) {
    return this.apiCall('getChatMember', {
      chat_id: chatId,
      user_id: userId
    });
  }

  async apiCall(method, params) {
    const response = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`);
    }
    return result.result;
  }
}

function createInlineKeyboard(buttons) {
  return {
    inline_keyboard: buttons
  };
}

// ==================== Bot Detection ====================
function detectBot(user, context = {}) {
  let score = 0;
  const detections = [];

  if (user.username) {
    const botPatterns = [
      /bot$/i,
      /^[a-z]+\d{4,}$/,
      /^[a-z]{20,}$/,
      /_spam/i,
      /casino|betting|crypto|forex/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(user.username)) {
        score += 30;
        detections.push({ type: 'username_pattern', pattern: pattern.toString() });
        break;
      }
    }
  } else {
    score += 10;
    detections.push({ type: 'no_username' });
  }

  if (!user.first_name || user.first_name.length < 2) {
    score += 15;
    detections.push({ type: 'invalid_first_name' });
  }

  if (user.first_name && /^[\d\s]+$/.test(user.first_name)) {
    score += 20;
    detections.push({ type: 'numeric_name' });
  }

  if (context.joinTime && context.previousJoinTime) {
    const timeDiff = context.joinTime - context.previousJoinTime;
    if (timeDiff < 5000) {
      score += 25;
      detections.push({ type: 'fast_join', timeDiff });
    }
  }

  if (!user.has_photo) {
    score += 10;
    detections.push({ type: 'no_profile_photo' });
  }

  if (user.id > 5000000000) {
    score += 5;
    detections.push({ type: 'new_account_id' });
  }

  if (user.is_bot) {
    score += 100;
    detections.push({ type: 'official_bot_flag' });
  }

  const spamKeywords = [
    'casino', 'betting', 'porn', 'xxx', 'dating', 
    '赚钱', '兼职', '博彩', '色情', '约炮',
    'crypto signal', 'forex', 'investment opportunity'
  ];

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
  for (const keyword of spamKeywords) {
    if (fullName.includes(keyword.toLowerCase())) {
      score += 40;
      detections.push({ type: 'spam_keyword', keyword });
      break;
    }
  }

  return {
    score,
    isBot: score >= 50,
    isSuspicious: score >= 30,
    detections,
    level: score >= 70 ? 'high' : score >= 50 ? 'medium' : score >= 30 ? 'low' : 'none'
  };
}

function generateVerificationChallenge(type = 'math') {
  switch (type) {
    case 'math':
      return generateMathChallenge();
    case 'button':
      return generateButtonChallenge();
    case 'captcha':
      return generateCaptchaChallenge();
    default:
      return generateMathChallenge();
  }
}

function generateMathChallenge() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operators = ['+', '-', '×'];
  const operator = operators[Math.floor(Math.random() * operators.length)];

  let answer;
  let question;

  switch (operator) {
    case '+':
      answer = num1 + num2;
      question = `${num1} + ${num2}`;
      break;
    case '-':
      answer = Math.max(num1, num2) - Math.min(num1, num2);
      question = `${Math.max(num1, num2)} - ${Math.min(num1, num2)}`;
      break;
    case '×':
      answer = num1 * num2;
      question = `${num1} × ${num2}`;
      break;
  }

  return {
    type: 'math',
    question: `请计算：${question} = ?`,
    answer: answer.toString(),
    options: generateMathOptions(answer)
  };
}

function generateMathOptions(correctAnswer) {
  const options = [correctAnswer];
  
  while (options.length < 4) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const option = correctAnswer + offset;
    if (option > 0 && !options.includes(option)) {
      options.push(option);
    }
  }

  return options.sort(() => Math.random() - 0.5).map(String);
}

function generateButtonChallenge() {
  const emojis = ['🍎', '🍌', '🍇', '🍊', '🍓', '🍉', '🥝', '🍑'];
  const correctEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  const options = [correctEmoji];
  while (options.length < 4) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    if (!options.includes(emoji)) {
      options.push(emoji);
    }
  }

  return {
    type: 'button',
    question: `请点击 ${correctEmoji}`,
    answer: correctEmoji,
    options: options.sort(() => Math.random() - 0.5)
  };
}

function generateCaptchaChallenge() {
  const words = ['apple', 'book', 'cat', 'dog', 'fish', 'tree', 'sun', 'moon'];
  const correctWord = words[Math.floor(Math.random() * words.length)];
  
  return {
    type: 'captcha',
    question: `请输入单词：${correctWord.toUpperCase()}`,
    answer: correctWord,
    options: null
  };
}

// ==================== Database ====================
async function getUserVerification(db, userId) {
  const result = await db
    .prepare('SELECT * FROM verifications WHERE user_id = ?')
    .bind(userId)
    .first();
  return result;
}

async function createVerification(db, data) {
  const {
    user_id,
    username,
    first_name,
    chat_id,
    verification_code,
    metadata = {}
  } = data;

  await db
    .prepare(
      `INSERT INTO verifications (user_id, username, first_name, chat_id, status, verification_code, attempts, created_at, metadata)
       VALUES (?, ?, ?, ?, 'pending', ?, 0, ?, ?)`
    )
    .bind(
      user_id,
      username,
      first_name,
      chat_id,
      verification_code,
      Date.now(),
      JSON.stringify(metadata)
    )
    .run();
}

async function updateVerificationStatus(db, userId, status) {
  await db
    .prepare('UPDATE verifications SET status = ?, verified_at = ? WHERE user_id = ?')
    .bind(status, Date.now(), userId)
    .run();
}

async function incrementAttempts(db, userId) {
  await db
    .prepare('UPDATE verifications SET attempts = attempts + 1 WHERE user_id = ?')
    .bind(userId)
    .run();
}

async function isBlacklisted(db, userId) {
  const result = await db
    .prepare('SELECT 1 FROM blacklist WHERE user_id = ?')
    .bind(userId)
    .first();
  return !!result;
}

async function addToBlacklist(db, userId, reason, bannedBy = null) {
  await db
    .prepare(
      `INSERT OR REPLACE INTO blacklist (user_id, reason, banned_at, banned_by, metadata)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(userId, reason, Date.now(), bannedBy, JSON.stringify({}))
    .run();
}

async function getGroupConfig(db, chatId) {
  const result = await db
    .prepare('SELECT * FROM group_configs WHERE chat_id = ?')
    .bind(chatId)
    .first();

  return result || {
    chat_id: chatId,
    verification_type: 'math',
    timeout_seconds: 300,
    auto_ban_bots: 1,
    bot_detection_level: 'medium'
  };
}

async function logBotDetection(db, data) {
  const { user_id, chat_id, detection_type, score, action, metadata = {} } = data;

  await db
    .prepare(
      `INSERT INTO bot_detection_log (user_id, chat_id, detection_type, score, action, detected_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      user_id,
      chat_id,
      detection_type,
      score,
      action,
      Date.now(),
      JSON.stringify(metadata)
    )
    .run();
}

// ==================== Main Handler ====================
async function handleTelegramUpdate(update, env) {
  const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN);
  const db = env.DB;

  try {
    // 处理新成员加入群组
    if (update.chat_member && update.chat_member.new_chat_member) {
      await handleNewChatMember(update.chat_member, bot, db);
      return;
    }

    // 处理新成员消息
    if (update.message && update.message.new_chat_members) {
      for (const member of update.message.new_chat_members) {
        await handleNewMember(update.message, member, bot, db);
      }
      return;
    }

    // 处理回调按钮
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot, db);
      return;
    }

    // 处理私聊消息
    if (update.message && update.message.chat.type === 'private') {
      await handlePrivateMessage(update.message, bot, db);
      return;
    }

    // 处理群组消息
    if (update.message && ['group', 'supergroup'].includes(update.message.chat.type)) {
      await handleGroupMessage(update.message, bot, db);
      return;
    }
  } catch (error) {
    console.error('Error handling update:', error);
  }
}

async function handleNewChatMember(chatMember, bot, db) {
  const user = chatMember.new_chat_member.user;
  const chatId = chatMember.chat.id;

  if (user.is_bot && user.id === chatMember.from.id) {
    return;
  }

  await processNewMember(chatId, user, bot, db);
}

async function handleNewMember(message, member, bot, db) {
  const chatId = message.chat.id;
  await processNewMember(chatId, member, bot, db);
}

async function processNewMember(chatId, user, bot, db) {
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

  const config = await getGroupConfig(db, chatId);
  const detection = detectBot(user, { joinTime: Date.now() });

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

  if (detection.isBot && config.auto_ban_bots) {
    await bot.kickChatMember(chatId, user.id);
    await addToBlacklist(db, user.id, 'Auto-detected as bot', null);
    
    await bot.sendMessage(
      chatId,
      `🤖 检测到机器人账号并已自动封禁\n用户: ${user.first_name || 'N/A'}\nID: ${user.id}\n可疑分数: ${detection.score}/100`
    );
    return;
  }

  await bot.restrictChatMember(chatId, user.id, {
    can_send_messages: false
  });

  const challenge = generateVerificationChallenge(config.verification_type);

  await createVerification(db, {
    user_id: user.id,
    username: user.username,
    first_name: user.first_name,
    chat_id: chatId,
    verification_code: challenge.answer,
    metadata: { challenge, detection }
  });

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

  await bot.sendMessage(
    chatId,
    `👋 欢迎 ${userName}!\n\n${challenge.question}\n\n⏱ 请在 ${config.timeout_seconds} 秒内完成验证${warningText}`,
    keyboard ? { reply_markup: keyboard } : {}
  );
}

async function handleCallbackQuery(callbackQuery, bot, db) {
  const data = callbackQuery.data;
  const user = callbackQuery.from;
  const message = callbackQuery.message;

  if (!data.startsWith('verify:')) {
    return;
  }

  const [_, targetUserId, answer] = data.split(':');

  if (user.id.toString() !== targetUserId) {
    await bot.answerCallbackQuery(
      callbackQuery.id,
      '❌ 这不是你的验证消息',
      true
    );
    return;
  }

  const verification = await getUserVerification(db, user.id);

  if (!verification || verification.status !== 'pending') {
    await bot.answerCallbackQuery(
      callbackQuery.id,
      '验证已过期或已完成',
      true
    );
    return;
  }

  await incrementAttempts(db, user.id);

  if (answer === verification.verification_code) {
    await updateVerificationStatus(db, user.id, 'verified');
    await bot.unrestrictChatMember(verification.chat_id, user.id);

    await bot.answerCallbackQuery(callbackQuery.id, '✅ 验证成功！');
    
    await bot.sendMessage(
      verification.chat_id,
      `✅ ${user.first_name} 已通过验证，欢迎加入！`
    );

    await bot.deleteMessage(message.chat.id, message.message_id);

  } else {
    const verification_updated = await getUserVerification(db, user.id);
    
    if (verification_updated.attempts >= 3) {
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

  const verification = await getUserVerification(db, user.id);

  if (!verification || verification.status !== 'pending') {
    await bot.sendMessage(
      message.chat.id,
      '你当前没有待验证的请求。'
    );
    return;
  }

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

  if (verification && verification.status === 'pending') {
    await bot.deleteMessage(message.chat.id, message.message_id);
  }
}

// ==================== Worker Entry Point ====================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          worker: 'telegram-verification-bot',
          version: '1.0.0'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      if (url.pathname === '/webhook' && request.method === 'POST') {
        try {
          const update = await request.json();
          ctx.waitUntil(handleTelegramUpdate(update, env));
          
          return new Response('OK', { 
            status: 200,
            headers: corsHeaders
          });
        } catch (error) {
          console.error('Webhook processing error:', error);
          return new Response('Error processing update', { 
            status: 500,
            headers: corsHeaders
          });
        }
      }

      if (url.pathname === '/setup') {
        const webhookUrl = `${url.origin}/webhook`;
        const botToken = env.TELEGRAM_BOT_TOKEN;

        if (!botToken) {
          return new Response(JSON.stringify({
            success: false,
            error: 'TELEGRAM_BOT_TOKEN not configured'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
        
        try {
          const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: webhookUrl,
              allowed_updates: ['message', 'chat_member', 'callback_query'],
              drop_pending_updates: false
            })
          });

          const result = await response.json();
          
          return new Response(JSON.stringify({
            success: result.ok,
            webhook_url: webhookUrl,
            telegram_response: result
          }, null, 2), {
            status: result.ok ? 200 : 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      if (url.pathname === '/webhook-info') {
        const botToken = env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
          return new Response(JSON.stringify({
            error: 'TELEGRAM_BOT_TOKEN not configured'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const telegramUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
        
        try {
          const response = await fetch(telegramUrl);
          const result = await response.json();
          
          return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      if (url.pathname === '/delete-webhook') {
        const botToken = env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
          return new Response(JSON.stringify({
            error: 'TELEGRAM_BOT_TOKEN not configured'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        const telegramUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
        
        try {
          const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drop_pending_updates: true })
          });
          
          const result = await response.json();
          
          return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          service: 'Telegram Verification Bot',
          version: '1.0.0',
          endpoints: {
            '/': 'API information',
            '/health': 'Health check',
            '/webhook': 'Telegram webhook (POST only)',
            '/setup': 'Setup webhook',
            '/webhook-info': 'Get webhook information',
            '/delete-webhook': 'Delete webhook'
          },
          status: 'running',
          timestamp: new Date().toISOString()
        }, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        error: 'Not Found',
        path: url.pathname
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};
