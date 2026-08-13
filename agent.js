import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { getForecastForTown } from './tools/weather.js';
import { getRemindersForDate, getDynamicNudgesForDate } from './tools/reminders.js';

const TOOLS = [
  {
    name: 'get_weather_forecast',
    description: "Get the weather forecast for a trip town (e.g. 'kaprun', 'wagrain', 'salzburg') for the next N days, including a classification into clear_or_partly_cloudy / hot / rain_or_cold.",
    input_schema: {
      type: 'object',
      properties: {
        town: { type: 'string', description: 'Town key from the trip locations list' },
        days: { type: 'integer', description: 'Number of days to forecast, default 2', default: 2 },
      },
      required: ['town'],
    },
  },
  {
    name: 'get_day_plan',
    description: 'Get the full plan for a specific date (YYYY-MM-DD): base town, title, and candidate attractions with all their details (booking/cash/indoor/weather requirements).',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD' } },
      required: ['date'],
    },
  },
  {
    name: 'get_reminders',
    description: 'Get reminders (explicit + dynamic booking/cash nudges) due on a specific date.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD' } },
      required: ['date'],
    },
  },
  {
    name: 'search_attractions',
    description: 'Search attractions by name/town/id keyword.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_trip_overview',
    description: 'Get family info, lodging bases/dates, and the two regional cards (how to get them, what they cover).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_kosher_food',
    description: "Search the Vienna kashrus supervision list (Hamadrich) for a brand or product name (e.g. 'Nutella', 'Red Bull', 'Aspirin'). Returns matching entries with their exact status ('Ok' = approved, 'Nicht Für Pessach' = kosher year-round but not for Passover, 'Nicht Koscher' = not kosher), any required certification/hechsher, and notes. Covers food, drinks, and over-the-counter medications.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Brand or product name to search for' } },
      required: ['query'],
    },
  },
];

async function executeTool(tripData, name, input, kosherData) {
  switch (name) {
    case 'get_weather_forecast': {
      const days = input.days ?? 2;
      const forecast = await getForecastForTown(tripData, input.town, days, config.tripTz);
      return forecast;
    }
    case 'get_day_plan': {
      const plan = tripData.getPlanForDate(input.date);
      return plan ?? { error: `No day found for ${input.date}` };
    }
    case 'get_reminders': {
      const explicit = getRemindersForDate(tripData, input.date);
      const dynamic = getDynamicNudgesForDate(tripData, input.date);
      return { explicit, dynamic };
    }
    case 'search_attractions': {
      return tripData.searchAttractions(input.query);
    }
    case 'get_trip_overview': {
      return {
        family: tripData.meta.family,
        lodging: tripData.raw.lodging,
        cards: tripData.raw.cards,
      };
    }
    case 'search_kosher_food': {
      if (!kosherData) return { error: 'Kosher list not loaded' };
      const results = kosherData.search(input.query);
      return results.length
        ? results
        : { note: `No match for "${input.query}" in the Hamadrich list. Absence from the list does not by itself mean not kosher — it just means this specific list has no entry for it.` };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function systemPrompt(tripData, todayStr, kosherData) {
  const lines = [
    tripData.meta.bot_persona,
    '',
    `היום הוא ${todayStr} (אזור זמן ${config.tripTz}).`,
    '',
    'כללי יסוד:',
    ...tripData.agentRules.map((r) => `- ${r}`),
    '',
    'יש לך כלים (tools) לשליפת מזג אוויר, תוכנית יומית, תזכורות וחיפוש אטרקציות — השתמש בהם במקום לנחש.',
  ];

  if (kosherData) {
    lines.push(
      '',
      `יש לך גם כלי search_kosher_food לחיפוש ברשימת הכשרות של ${kosherData.meta.publisher} (${kosherData.meta.supervising_rabbi}), מהדורת ${kosherData.meta.issue_label}.`,
      'כללים לשימוש בכלי הכשרות:',
      '- תמיד תשתמש בכלי הזה במקום לנחש אם משהו כשר — אל תסתמך על ידע כללי.',
      '- דווח את השדה status בדיוק כפי שהוא: "Ok" = מאושר, "Nicht Für Pessach" = כשר כל השנה חוץ מפסח, "Nicht Koscher" = לא כשר.',
      '- אם דרוש הכשר מסוים (certification_required), ציין זאת במפורש — המוצר כשר רק עם הסימון הזה.',
      '- שים לב: הערה (note) ברמת המותג יכולה להתייחס לחריגים בטעמים/גרסאות ספציפיות אחרות, לא בהכרח למוצר שנשאל עליו — קרא בעיון.',
      '- אם אין תוצאה ברשימה, אמור בבירור שהמוצר לא מופיע ברשימה הזו (זה לא אומר בהכרח שהוא לא כשר) ושכדאי לבדוק ישירות מול רב/הכשר מקומי.'
    );
  }

  lines.push('', 'תמיד תענה בעברית, חם ותכליתי.');
  return lines.join('\n');
}

/**
 * Interactive chat: full tool-use loop, for arbitrary questions from the
 * family in the Telegram group.
 */
export async function answerMessage(tripData, userText, { senderName = '', todayStr, kosherData } = {}) {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const today = todayStr || new Date().toISOString().slice(0, 10);

  const messages = [
    {
      role: 'user',
      content: senderName ? `[${senderName}]: ${userText}` : userText,
    },
  ];

  for (let turn = 0; turn < 6; turn += 1) {
    const response = await anthropic.messages.create({
      model: config.claudeModel,
      max_tokens: 1024,
      system: systemPrompt(tripData, today, kosherData),
      tools: TOOLS,
      messages,
    });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) {
      return response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = await Promise.all(
      toolUses.map(async (tu) => {
        let result;
        try {
          result = await executeTool(tripData, tu.name, tu.input, kosherData);
        } catch (err) {
          result = { error: String(err?.message || err) };
        }
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        };
      })
    );
    messages.push({ role: 'user', content: toolResults });
  }

  return 'סליחה, נתקלתי בבעיה בעיבוד הבקשה — נסו לשאול שוב בניסוח אחר.';
}

/**
 * Deterministic evening briefing: gather tomorrow's data in code (no tool
 * loop needed — more robust for an unattended cron job), then ask Claude for
 * a single pass of natural Hebrew phrasing.
 */
export async function buildEveningBriefing(tripData, forDateStr) {
  if (tripData.isShabbat(forDateStr)) {
    return 'שבת שלום למשפחה! מחר שבת — בלי נסיעות ובלי פעילויות. מנוחה טובה 🕯️';
  }

  const plan = tripData.getPlanForDate(forDateStr);
  if (!plan) {
    return null; // outside trip range, nothing to send
  }

  let forecast = null;
  let forecastError = null;
  try {
    forecast = await getForecastForTown(tripData, plan.base, 1, config.tripTz);
  } catch (err) {
    forecastError = String(err?.message || err);
  }

  const explicitReminders = getRemindersForDate(tripData, forDateStr);
  const dynamicNudges = getDynamicNudgesForDate(tripData, forDateStr);

  const dataForClaude = {
    date: forDateStr,
    day: plan,
    forecast,
    forecastError,
    reminders: [...explicitReminders, ...dynamicNudges],
    weatherRules: tripData.weatherRules,
  };

  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const response = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 700,
    system: systemPrompt(tripData, forDateStr),
    messages: [
      {
        role: 'user',
        content: [
          'כתוב תדריך ערב קצר וחם למשפחה על מחר, בעברית, לשליחה בטלגרם.',
          'כלול: המלצה אחת ברורה + עד 2 חלופות (לפי מזג האוויר אם קיים), ותזכורות רלוונטיות (הזמנות/מזומן) אם יש.',
          'אל תמציא נתונים שלא נמסרו לך. אם אין תחזית, פשוט דלג על החלק הזה.',
          '',
          'נתונים:',
          JSON.stringify(dataForClaude, null, 2),
        ].join('\n'),
      },
    ],
  });

  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

export { TOOLS, executeTool, systemPrompt };
