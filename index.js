import { config, assertRuntimeConfig } from './config.js';
import { TripData } from './tripData.js';
import { KosherData } from './kosherData.js';
import { connectTelegram, onMessage } from './telegram.js';
import { answerMessage } from './agent.js';
import { startScheduler } from './scheduler.js';
import { todayInTz } from './dateUtils.js';

async function main() {
  assertRuntimeConfig();

  const tripData = new TripData(config.tripDataPath);
  console.log(`[Trip] loaded ${tripData.raw.days.length} days, ${Object.keys(tripData.raw.attractions).length} attractions.`);

  let kosherData = null;
  try {
    kosherData = new KosherData(config.kosherDataPath);
    console.log(`[Kosher] loaded ${kosherData.records.length} searchable entries from ${kosherData.meta.title} (${kosherData.meta.issue_label}).`);
  } catch (err) {
    console.warn('[Kosher] no kosher list loaded — search_kosher_food will be unavailable.', err.message);
  }

  onMessage(async (text, senderName, chatId, isGroup) => {
    const today = todayInTz(config.tripTz);
    return answerMessage(tripData, text, { senderName, todayStr: today, kosherData });
  });

  await connectTelegram();

  startScheduler(tripData);

  console.log('[Bot] מוכן. שולח תדריכים יזומים וזמין לשאלות בקבוצה.');
}

main().catch((err) => {
  console.error('[Bot] fatal error during startup', err);
  process.exit(1);
});
