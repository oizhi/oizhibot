// 测试脚本：验证基本功能
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/test') {
      try {
        // 测试数据库连接
        const result = await env.DB.prepare('SELECT 1 as test').first();
        
        // 测试查询视频库
        const repos = await env.DB.prepare('SELECT * FROM forward_repositories LIMIT 1').all();
        
        return new Response(JSON.stringify({
          status: 'ok',
          db_test: result,
          repos: repos.results,
          tables: await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'error',
          error: error.message,
          stack: error.stack
        }, null, 2), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        // 简单响应测试
        const response = {
          received: true,
          update_id: update.update_id,
          has_message: !!update.message,
          message_text: update.message?.text
        };
        
        // 尝试回复
        if (update.message) {
          const chatId = update.message.chat.id;
          const botToken = env.TELEGRAM_BOT_TOKEN;
          
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '✅ Bot 收到消息了！测试成功！'
            })
          });
        }
        
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'error',
          error: error.message,
          stack: error.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Telegram Bot Test - visit /test', { status: 200 });
  }
};
