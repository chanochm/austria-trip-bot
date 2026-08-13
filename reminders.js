/**
 * Reminder resolution for a given date: explicit due-date reminders from the
 * trip JSON, plus dynamic "needs_booking"/"cash_only" nudges for whatever is
 * on tomorrow's options list (a safety net on top of the curated list).
 */

export function getRemindersForDate(tripData, dateStr) {
  const day = tripData.getDay(dateStr);
  const explicit = tripData.getRemindersDueOn(dateStr);

  const recurring =
    day && !tripData.isShabbat(dateStr) && day.type !== 'shabbat'
      ? tripData.getRecurringReminders()
      : [];

  return [...explicit, ...recurring];
}

/**
 * Dynamic safety-net nudges for needs_booking / cash_only attractions on a
 * given date's options, so nothing falls through the cracks even if the
 * curated `reminders` list didn't cover it explicitly.
 */
export function getDynamicNudgesForDate(tripData, dateStr) {
  const day = tripData.getDay(dateStr);
  if (!day || !day.options) return [];

  const explicitIds = new Set(tripData.getRemindersDueOn(dateStr).map((r) => r.id));
  const nudges = [];

  for (const attractionId of day.options) {
    const a = tripData.getAttraction(attractionId);
    if (!a) continue;
    if (a.needs_booking && !explicitIds.has(`book_${attractionId}`)) {
      nudges.push({
        id: `auto_book_${attractionId}`,
        text: `${a.name}: דורש הזמנה מראש — כדאי לוודא/להזמין הערב.`,
        category: 'booking',
        auto: true,
      });
    }
    if (a.cash_only) {
      nudges.push({
        id: `auto_cash_${attractionId}`,
        text: `${a.name}: תשלום במזומן בלבד — קחו מטבעות/שטרות קטנים.`,
        category: 'money',
        auto: true,
      });
    }
  }
  return nudges;
}
