import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../src/dateUtils.js';

test('addDays advances within a month', () => {
  assert.equal(addDays('2026-08-19', 1), '2026-08-20');
});

test('addDays rolls over a month boundary', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
});

test('addDays handles multi-day jumps', () => {
  assert.equal(addDays('2026-08-21', 3), '2026-08-24');
});
