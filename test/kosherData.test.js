import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KosherData } from '../src/kosherData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kosherData = new KosherData(path.join(__dirname, '..', 'data', 'kosher.json'));

test('loads a large number of searchable records', () => {
  assert.ok(kosherData.records.length > 1000, `expected >1000 records, got ${kosherData.records.length}`);
});

test('exposes list metadata', () => {
  assert.equal(kosherData.meta.title, 'HAMADRICH');
  assert.equal(kosherData.meta.publisher, 'Komitee Kosher Wien e.U.');
});

test('finds a plain-object brand+products entry (Nutella)', () => {
  const results = kosherData.search('nutella');
  assert.ok(results.some((r) => r.brand === 'Ferrero Nutella' && r.product === 'Nutella Plant Based'));
});

test('finds medication entries with exact status and explanation', () => {
  const results = kosherData.search('aspirin');
  assert.ok(results.length > 0);
  const brausetabletten = results.find((r) => r.product === 'Aspirin + C Brausetabletten');
  assert.ok(brausetabletten);
  assert.equal(brausetabletten.status, 'Nicht Für Pessach');
  assert.equal(brausetabletten.type, 'medication');
});

test('finds a Nicht Koscher medication', () => {
  const results = kosherData.search('buscopan dragees');
  assert.ok(results.some((r) => r.status === 'Nicht Koscher'));
});

test('finds non-kosher E-numbers', () => {
  const results = kosherData.search('e470');
  assert.ok(results.some((r) => r.type === 'non_kosher_e_number' && r.code === 'E470'));
});

test('finds not_kosher-flagged drink variants', () => {
  const results = kosherData.search('cherry sakura', 10);
  assert.ok(results.some((r) => r.status === 'Nicht Koscher'));
});

test('case-insensitive and matches brand context via category path', () => {
  const lower = kosherData.search('coca-cola');
  const upper = kosherData.search('COCA-COLA');
  assert.equal(lower.length, upper.length);
  assert.ok(lower.length > 0);
});

test('search returns empty array for blank query', () => {
  assert.deepEqual(kosherData.search('   '), []);
});

test('search respects the limit parameter', () => {
  const results = kosherData.search('kotanyi', 3);
  assert.equal(results.length, 3);
});
