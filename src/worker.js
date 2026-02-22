/**
 * Simplified Worker for Testing
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    try {
      // Root endpoint
      if (url.pathname === '/' || url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          service: 'Telegram Verification Bot',
          version: '1.0.0-test',
          timestamp: new Date().toISOString(),
          env_check: {
            has_bot_token: !!env.TELEGRAM_BOT_TOKEN,
            has_db: !!env.DB
          }
        }, null, 2), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Setup webhook
      if (url.pathname === '/setup') {
        if (!env.TELEGRAM_BOT_TOKEN) {
          return new Response(JSON.stringify({
            success: false,
            error: 'TELEGRAM_BOT_TOKEN not configured',
            help: 'Run: wrangler secret put TELEGRAM_BOT_TOKEN'
          }, null, 2), {
            status: 500,
            headers: corsHeaders
          });
        }

        const webhookUrl = `${url.origin}/webhook`;
        const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
        
        const response = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ['message', 'chat_member', 'callback_query']
          })
        });

        const result = await response.json();
        
        return new Response(JSON.stringify({
          success: result.ok,
          webhook_url: webhookUrl,
          result: result
        }, null, 2), {
          status: result.ok ? 200 : 500,
          headers: corsHeaders
        });
      }

      // Webhook info
      if (url.pathname === '/webhook-info') {
        if (!env.TELEGRAM_BOT_TOKEN) {
          return new Response(JSON.stringify({
            error: 'TELEGRAM_BOT_TOKEN not configured'
          }, null, 2), {
            status: 500,
            headers: corsHeaders
          });
        }

        const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
        const response = await fetch(telegramUrl);
        const result = await response.json();
        
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Webhook endpoint
      if (url.pathname === '/webhook' && request.method === 'POST') {
        const update = await request.json();
        
        // Simple echo for testing
        console.log('Received update:', JSON.stringify(update));
        
        return new Response('OK', { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // 404
      return new Response(JSON.stringify({
        error: 'Not Found',
        path: url.pathname
      }, null, 2), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      }, null, 2), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
