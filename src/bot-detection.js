/**
 * 机器人检测逻辑
 */

export function detectBot(user, context = {}) {
  let score = 0;
  const detections = [];

  // 1. 检查用户名模式
  if (user.username) {
    // 常见机器人用户名模式
    const botPatterns = [
      /bot$/i,
      /^[a-z]+\d{4,}$/,  // 字母+4位以上数字
      /^[a-z]{20,}$/,     // 超长随机字母
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
    // 没有用户名（可疑）
    score += 10;
    detections.push({ type: 'no_username' });
  }

  // 2. 检查个人资料
  if (!user.first_name || user.first_name.length < 2) {
    score += 15;
    detections.push({ type: 'invalid_first_name' });
  }

  // 检查是否只有数字或随机字符
  if (user.first_name && /^[\d\s]+$/.test(user.first_name)) {
    score += 20;
    detections.push({ type: 'numeric_name' });
  }

  // 3. 检查加入速度（如果有上下文信息）
  if (context.joinTime && context.previousJoinTime) {
    const timeDiff = context.joinTime - context.previousJoinTime;
    if (timeDiff < 5000) {  // 5秒内连续加入
      score += 25;
      detections.push({ type: 'fast_join', timeDiff });
    }
  }

  // 4. 检查是否有头像
  if (!user.has_photo) {
    score += 10;
    detections.push({ type: 'no_profile_photo' });
  }

  // 5. 检查 user_id 范围（新账号ID通常较大）
  if (user.id > 5000000000) {  // 5B以上可能是新注册账号
    score += 5;
    detections.push({ type: 'new_account_id' });
  }

  // 6. 检查是否是官方 bot（is_bot 标记）
  if (user.is_bot) {
    score += 100;
    detections.push({ type: 'official_bot_flag' });
  }

  // 7. 检查名字中的垃圾内容
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
    isBot: score >= 50,  // 50分以上认为是机器人
    isSuspicious: score >= 30,  // 30-49分可疑
    detections,
    level: score >= 70 ? 'high' : score >= 50 ? 'medium' : score >= 30 ? 'low' : 'none'
  };
}

export function generateVerificationChallenge(type = 'math') {
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

  // 打乱选项
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
  // 简化版文字验证码
  const words = ['apple', 'book', 'cat', 'dog', 'fish', 'tree', 'sun', 'moon'];
  const correctWord = words[Math.floor(Math.random() * words.length)];
  
  return {
    type: 'captcha',
    question: `请输入单词：${correctWord.toUpperCase()}`,
    answer: correctWord,
    options: null  // 需要用户手动输入
  };
}
