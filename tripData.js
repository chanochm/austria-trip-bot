import { readFileSync } from 'node:fs';

/**
 * Loads and provides typed access to the trip knowledge base JSON.
 * All lookups are pure/synchronous — this file has no side effects besides
 * the initial disk read, so it's easy to unit test.
 */
export class TripData {
  constructor(filePath) {
    const raw = readFileSync(filePath, 'utf-8');
    this.raw = JSON.parse(raw);
  }

  get meta() {
    return this.raw._meta;
  }

  get agentRules() {
    return this.raw.agent_rules;
  }

  get weatherRules() {
    return this.raw.weather_rules;
  }

  getDay(dateStr) {
    return this.raw.days.find((d) => d.date === dateStr) || null;
  }

  getNextDay(dateStr) {
    const idx = this.raw.days.findIndex((d) => d.date === dateStr);
    if (idx === -1 || idx === this.raw.days.length - 1) return null;
    return this.raw.days[idx + 1];
  }

  isShabbat(dateStr) {
    const day = this.getDay(dateStr);
    return Boolean(day && (day.is_shabbat || day.type === 'shabbat'));
  }

  isShabbatEve(dateStr) {
    const day = this.getDay(dateStr);
    return Boolean(day && day.is_shabbat_eve);
  }

  getAttraction(id) {
    return this.raw.attractions[id] || null;
  }

  getAttractions(ids) {
    return ids.map((id) => ({ id, ...this.getAttraction(id) })).filter((a) => a.name);
  }

  getLocation(town) {
    return this.raw.locations[town] || null;
  }

  getRemindersDueOn(dateStr) {
    return this.raw.reminders.filter((r) => r.due === dateStr);
  }

  getRecurringReminders() {
    return this.raw.reminders.filter((r) => r.due === 'recurring');
  }

  searchAttractions(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.entries(this.raw.attractions)
      .filter(([id, a]) =>
        id.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.town.toLowerCase().includes(q)
      )
      .map(([id, a]) => ({ id, ...a }));
  }

  /** Full plan for a date: the day entry plus its options resolved to full attraction objects. */
  getPlanForDate(dateStr) {
    const day = this.getDay(dateStr);
    if (!day) return null;
    const options = day.options ? this.getAttractions(day.options) : [];
    return { ...day, resolvedOptions: options };
  }
}
