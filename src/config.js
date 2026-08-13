import 'dotenv/config';
import path from 'node:path';

function requireEnv(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  tripTz: process.env.TRIP_TZ || 'Europe/Vienna',
  briefingHour: Number(process.env.BRIEFING_HOUR ?? 20),
  morningHour: process.env.MORNING_HOUR ? Number(process.env.MORNING_HOUR) : null,
  tripDataPath: path.resolve(process.cwd(), process.env.TRIP_DATA_PATH || 'data/trip.json'),
  kosherDataPath: path.resolve(process.cwd(), process.env.KOSHER_DATA_PATH || 'data/kosher.json'),
  stateFilePath: path.resolve(process.cwd(), 'data/state.json'),
};

export function assertRuntimeConfig() {
  requireEnv('ANTHROPIC_API_KEY');
  requireEnv('TELEGRAM_BOT_TOKEN');
}
