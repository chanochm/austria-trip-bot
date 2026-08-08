import { config, assertRuntimeConfig } from './config.js';
import { TripData } from './tripData.js';
import { connectTelegram, onMessage } from './telegram.js';
import { answerMessage } from './agent.js';
import { startScheduler } from './scheduler.js';
import { todayInTz } from './dateUtils.js';

async function main() {
  assertRuntimeConfig();

  const tripData = new TripData(config.tripDataPath);
  console.log(`[Trip] loaded ${tripData.raw.days.length} days, ${Object.keys(tripData.raw.attractions).length} attractions.`);

  onMessage(async (text, senderName, chatId, isGroup) => {
    const today = todayInTz(config.tripTz);
    return answerMessage(tripData, text, { senderName, todayStr: today });
  });

  await connectTelegram();

  startScheduler(tripData);

  console.log('[Bot] מוכן. שולח תדריכים יזומים וזמין לשאלות בקבוצה.');
}

main().catch((err) => {
  console.error('[Bot] fatal error during startup', err);
  process.exit(1);
});
