import cron from 'node-cron';
import { config } from './config.js';
import { buildEveningBriefing } from './agent.js';
import { getRemindersForDate, getDynamicNudgesForDate } from './tools/reminders.js';
import { sendToGroup } from './telegram.js';
import { todayInTz, addDays } from './dateUtils.js';

export function startScheduler(tripData) {
  const jobs = [];

  // Evening briefing for tomorrow.
  jobs.push(
    cron.schedule(
      `0 ${config.briefingHour} * * *`,
      async () => {
        try {
          const today = todayInTz(config.tripTz);
          const tomorrow = addDays(today, 1);
          const text = await buildEveningBriefing(tripData, tomorrow);
          if (text) {
            await sendToGroup(text);
            console.log(`[Scheduler] evening briefing sent for ${tomorrow}`);
          }
        } catch (err) {
          console.error('[Scheduler] evening briefing failed', err);
        }
      },
      { timezone: config.tripTz }
    )
  );

  // Optional short morning nudge with today's reminders (no Claude call —
  // deterministic, so it can't hallucinate and costs nothing).
  if (config.morningHour !== null) {
    jobs.push(
      cron.schedule(
        `0 ${config.morningHour} * * *`,
        async () => {
          try {
            const today = todayInTz(config.tripTz);
            if (tripData.isShabbat(today)) return;
            const reminders = [
              ...getRemindersForDate(tripData, today),
              ...getDynamicNudgesForDate(tripData, today),
            ];
            if (reminders.length === 0) return;
            const lines = reminders.map((r) => `• ${r.text}`);
            await sendToGroup(`בוקר טוב! תזכורות להיום:\n${lines.join('\n')}`);
            console.log(`[Scheduler] morning nudge sent for ${today}`);
          } catch (err) {
            console.error('[Scheduler] morning nudge failed', err);
          }
        },
        { timezone: config.tripTz }
      )
    );
  }

  console.log(
    `[Scheduler] started — evening briefing @${config.briefingHour}:00, ` +
      (config.morningHour !== null ? `morning nudge @${config.morningHour}:00 ` : 'morning nudge disabled ') +
      `(${config.tripTz})`
  );

  return jobs;
}
