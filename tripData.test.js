import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TripData } from '../src/tripData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tripData = new TripData(path.join(__dirname, '..', 'data', 'trip.json'));

test('loads all 15 trip days', () => {
  assert.equal(tripData.raw.days.length, 15);
});

test('identifies both Shabbat days correctly', () => {
  assert.equal(tripData.isShabbat('2026-08-22'), true);
  assert.equal(tripData.isShabbat('2026-08-29'), true);
});

test('does not flag a regular day as Shabbat', () => {
  assert.equal(tripData.isShabbat('2026-08-23'), false);
  assert.equal(tripData.isShabbat('2026-08-19'), false);
});

test('flags both Shabbat-eve Fridays', () => {
  assert.equal(tripData.isShabbatEve('2026-08-21'), true);
  assert.equal(tripData.isShabbatEve('2026-08-28'), true);
});

test('getNextDay walks the itinerary in order', () => {
  const next = tripData.getNextDay('2026-08-19');
  assert.equal(next.date, '2026-08-20');
});

test('getNextDay returns null past the last day', () => {
  assert.equal(tripData.getNextDay('2026-08-31'), null);
});

test('getPlanForDate resolves options to full attraction objects', () => {
  const plan = tripData.getPlanForDate('2026-08-20');
  assert.equal(plan.base, 'kaprun');
  assert.ok(plan.resolvedOptions.some((a) => a.id === 'kitzsteinhorn'));
  assert.equal(plan.resolvedOptions.find((a) => a.id === 'kitzsteinhorn').needs_clear_sky, true);
});

test('searchAttractions matches by name substring, case-insensitive', () => {
  const results = tripData.searchAttractions('kitzstein');
  assert.ok(results.some((a) => a.id === 'kitzsteinhorn'));
});

test('unknown date returns null plan', () => {
  assert.equal(tripData.getPlanForDate('2026-01-01'), null);
});
