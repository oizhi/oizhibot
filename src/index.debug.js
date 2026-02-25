// 极简测试版本 - 逐步测试每个功能
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/debug') {
      const logs = [];
      try {
        logs.push('Step 1: Testing DB connection...');
        const testQuery = await env.DB.prepare('SELECT 1 as test').first();
        logs.push(`DB test: ${JSON.stringify(testQuery)}`);

        logs.push('Step 2: Listing tables...');
        const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        logs.push(`Tables: ${tables.results.map(t => t.name).join(', ')}`);

        logs.push('Step 3: Testing forward_repositories...');
        const repos = await env.DB.prepare('SELECT * FROM forward_repositories LIMIT 3').all();
        logs.push(`Repos count: ${repos.results.length}`);

        logs.push('Step 4: Testing user_states...');
        const states = await env.DB.prepare('SELECT * FROM user_states LIMIT 1').all();
        logs.push(`States: ${states.results.length}`);

        return new Response(logs.join('\n'), { 
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (error) {
        return new Response([
          'ERROR:',
          error.message,
          'Stack:',
          error.stack,
          'Logs so far:',
          ...logs
        ].join('\n'), {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      const logs = [];
      try {
        logs.push('Webhook received');
        const update = await request.json();
        logs.push(`Update ID: ${update.update_id}`);

        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text || '';
          logs.push(`Message from ${chatId}: ${text}`);

          // 直接发送回复，不使用任何类
          const botToken = env.TELEGRAM_BOT_TOKEN;
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ 收到消息: ${text}\n\n调试日志:\n${logs.join('\n')}`
            })
          });

          const result = await response.json();
          logs.push(`Send result: ${result.ok}`);
        }

        return new Response(logs.join('\n'), { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (error) {
        const errorMsg = [
          'WEBHOOK ERROR:',
          error.message,
          'Stack:',
          error.stack,
          'Logs so far:',
          ...logs
        ].join('\n');

        // 尝试发送错误到 Telegram
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: 6938405510,
              text: `❌ Webhook Error:\n\n${errorMsg.substring(0, 1000)}`
            })
          });
        } catch (e) {
          console.error('Failed to send error:', e);
        }

        return new Response(errorMsg, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    return new Response('Debug bot - visit /debug', { status: 200 });
  }
};
