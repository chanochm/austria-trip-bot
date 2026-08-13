import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDay } from '../src/tools/weather.js';

test('clear sky, mild temp -> clear_or_partly_cloudy', () => {
  const result = classifyDay({ weatherCode: 1, tempMax: 22, precipProbability: 5 });
  assert.equal(result, 'clear_or_partly_cloudy');
});

test('partly cloudy, mild temp -> clear_or_partly_cloudy', () => {
  const result = classifyDay({ weatherCode: 2, tempMax: 20, precipProbability: 10 });
  assert.equal(result, 'clear_or_partly_cloudy');
});

test('hot day overrides clear sky classification -> hot', () => {
  const result = classifyDay({ weatherCode: 1, tempMax: 29, precipProbability: 0 });
  assert.equal(result, 'hot');
});

test('high rain probability -> rain_or_cold even if warm', () => {
  const result = classifyDay({ weatherCode: 3, tempMax: 27, precipProbability: 70 });
  assert.equal(result, 'rain_or_cold');
});

test('thunderstorm code -> rain_or_cold', () => {
  const result = classifyDay({ weatherCode: 95, tempMax: 24, precipProbability: 30 });
  assert.equal(result, 'rain_or_cold');
});

test('overcast, cool, low precip -> rain_or_cold (cautious default)', () => {
  const result = classifyDay({ weatherCode: 3, tempMax: 18, precipProbability: 20 });
  assert.equal(result, 'rain_or_cold');
});

test('custom hot threshold is respected', () => {
  const result = classifyDay({ weatherCode: 1, tempMax: 24, precipProbability: 0 }, { hotThresholdC: 23 });
  assert.equal(result, 'hot');
});
