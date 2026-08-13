import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TripData } from '../src/tripData.js';
import { getRemindersForDate, getDynamicNudgesForDate } from '../src/tools/reminders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tripData = new TripData(path.join(__dirname, '..', 'data', 'trip.json'));

test('explicit reminders due on the border-crossing day', () => {
  const ids = getRemindersForDate(tripData, '2026-08-18').map((r) => r.id);
  assert.ok(ids.includes('vignette_x2'));
  assert.ok(ids.includes('notify_rental_border'));
  assert.ok(ids.includes('collect_zell_card'));
  assert.ok(ids.includes('get_meat_into_freezer'));
});

test('recurring coins reminder appears on a normal activity day', () => {
  const ids = getRemindersForDate(tripData, '2026-08-25').map((r) => r.id);
  assert.ok(ids.includes('coins_daily'));
});

test('recurring reminder is suppressed on Shabbat', () => {
  const ids = getRemindersForDate(tripData, '2026-08-22').map((r) => r.id);
  assert.ok(!ids.includes('coins_daily'));
});

test('dynamic nudge fires for a needs_booking attraction without an explicit reminder', () => {
  // 2026-08-30 includes anif_ropes_park (needs_booking + cash_only) with no
  // matching explicit "book_anif_ropes_park" id in the curated list.
  const nudges = getDynamicNudgesForDate(tripData, '2026-08-30');
  const ids = nudges.map((n) => n.id);
  assert.ok(ids.includes('auto_book_anif_ropes_park'));
  assert.ok(ids.includes('auto_cash_anif_ropes_park'));
});

test('no dynamic nudges on a day with no needs_booking/cash_only options', () => {
  const nudges = getDynamicNudgesForDate(tripData, '2026-08-19');
  assert.equal(nudges.length, 0);
});
