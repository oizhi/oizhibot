// 分步测试 - Step 1: 测试基础类定义
class TelegramAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId, text) {
    const response = await fetch(`${this.baseURL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    return response.json();
  }
}

class Database {
  constructor(db) {
    this.db = db;
  }

  async listRepositories(userId) {
    const result = await this.db.prepare(
      'SELECT * FROM forward_repositories WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
    return result.results || [];
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/test') {
      try {
        const bot = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
        const db = new Database(env.DB);
        
        const repos = await db.listRepositories(6938405510);
        
        await bot.sendMessage(6938405510, `✅ Step 1 成功！\n\n找到 ${repos.length} 个视频库`);
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: 6938405510,
            text: `❌ Step 1 失败:\n\n${error.message}\n\n${error.stack?.substring(0, 500)}`
          })
        });
        return new Response('Error', { status: 500 });
      }
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        const chatId = update.message?.chat?.id;
        const text = update.message?.text || '';

        if (chatId) {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ Webhook OK\n收到: ${text}\n\n访问 /test 进行完整测试`
            })
          });
        }

        return new Response('OK', { status: 200 });
      } catch (error) {
        return new Response('Error', { status: 500 });
      }
    }

    return new Response('Visit /test or send message to bot', { status: 200 });
  }
};
