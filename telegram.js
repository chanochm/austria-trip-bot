import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';

let bot = null;
let messageHandler = null; // (text, senderName, chatId, isGroup) => Promise<string|null>

export function onMessage(handler) {
  messageHandler = handler;
}

export async function connectTelegram() {
  bot = new TelegramBot(config.telegramBotToken, { polling: true });

  // Fail fast on a bad token instead of polling silently forever.
  const me = await bot.getMe();
  console.log(`[Telegram] מחובר כבוט: @${me.username}`);

  bot.on('polling_error', (err) => {
    console.error('[Telegram] polling error', err?.message || err);
  });

  bot.on('message', async (msg) => {
    const chatId = String(msg.chat.id);
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    const text = msg.text || '';
    if (!text.trim()) return;

    // First-run helper: log the chat id so it can be copied into .env once.
    if (!config.telegramChatId) {
      console.log(
        `[Telegram] הודעה מ-chat id ${chatId} (${msg.chat.title || msg.chat.first_name || 'private'}) — ` +
          `אם זו קבוצת המשפחה, הוסיפו אותו ל-TELEGRAM_CHAT_ID ב-.env.`
      );
    }
    if (config.telegramChatId && chatId !== config.telegramChatId) return;

    if (!messageHandler) return;
    const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ');
    try {
      const reply = await messageHandler(text, senderName, chatId, isGroup);
      if (reply) await bot.sendMessage(chatId, reply);
    } catch (err) {
      console.error('[Telegram] handler error', err);
    }
  });

  return bot;
}

export async function sendToGroup(text) {
  if (!bot) throw new Error('Telegram bot not connected yet');
  if (!config.telegramChatId) {
    console.warn(
      '[Telegram] TELEGRAM_CHAT_ID not set — skipping proactive send. Message was:\n' + text
    );
    return;
  }
  await bot.sendMessage(config.telegramChatId, text);
}
