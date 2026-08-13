/**
 * Open-Meteo client + classification into the trip's weather_rules buckets
 * (clear_or_partly_cloudy | hot | rain_or_cold). No API key required.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO weather codes: https://open-meteo.com/en/docs
const RAIN_OR_SNOW_CODES = new Set([
  51, 53, 55, 56, 57, // drizzle
  61, 63, 65, 66, 67, // rain
  71, 73, 75, 77,     // snow
  80, 81, 82,         // rain showers
  85, 86,             // snow showers
  95, 96, 99,         // thunderstorm
]);
const FOG_CODES = new Set([45, 48]);

export async function fetchDailyForecast(lat, lon, days = 3, timezone = 'Europe/Vienna') {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('daily', [
    'weathercode',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max',
  ].join(','));
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('forecast_days', String(days));

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_probability_max } = data.daily;

  return time.map((date, i) => ({
    date,
    weatherCode: weathercode[i],
    tempMax: temperature_2m_max[i],
    tempMin: temperature_2m_min[i],
    precipProbability: precipitation_probability_max[i] ?? 0,
  }));
}

/**
 * Classify a single day's forecast into one of the trip's weather_rules
 * buckets. Pure function — easy to unit test without hitting the network.
 */
export function classifyDay(dayForecast, { hotThresholdC = 26 } = {}) {
  const { weatherCode, tempMax, precipProbability } = dayForecast;

  if (precipProbability >= 50 || RAIN_OR_SNOW_CODES.has(weatherCode)) {
    return 'rain_or_cold';
  }
  if (tempMax >= hotThresholdC) {
    return 'hot';
  }
  if (weatherCode === 0 || weatherCode === 1 || weatherCode === 2) {
    return 'clear_or_partly_cloudy';
  }
  // Overcast, fog, or anything else ambiguous defaults to the cautious bucket.
  if (FOG_CODES.has(weatherCode) || weatherCode === 3) {
    return 'rain_or_cold';
  }
  return 'clear_or_partly_cloudy';
}

export async function getForecastForTown(tripData, town, days = 2, timezone = 'Europe/Vienna') {
  const loc = tripData.getLocation(town);
  if (!loc) throw new Error(`Unknown town: ${town}`);
  const forecast = await fetchDailyForecast(loc.lat, loc.lon, days, timezone);
  return forecast.map((f) => ({ ...f, classification: classifyDay(f) }));
}
