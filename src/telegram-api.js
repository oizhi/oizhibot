/**
 * Telegram Bot API 封装
 */

export class TelegramBot {
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

export function createInlineKeyboard(buttons) {
  return {
    inline_keyboard: buttons
  };
}
