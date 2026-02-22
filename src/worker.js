/**
 * Cloudflare Workers Entry Point
 * Telegram Verification Bot
 */

import { handleTelegramUpdate } from './telegram';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // Health check endpoint
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

      // Webhook endpoint - receives Telegram updates
      if (url.pathname === '/webhook' && request.method === 'POST') {
        try {
          const update = await request.json();
          
          // Process update asynchronously
          ctx.waitUntil(handleTelegramUpdate(update, env));
          
          // Return immediately to Telegram
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

      // Setup webhook endpoint
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

      // Get webhook info endpoint
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

      // Delete webhook endpoint (for testing)
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

      // Root endpoint - API info
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

      // 404 for unknown routes
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
