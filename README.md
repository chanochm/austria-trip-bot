# Austria Trip Bot

Family trip companion for the Marmorstein family Austria trip (17–31 Aug
2026), reachable as a Telegram bot in a family group. Talks in Hebrew,
answers questions, and proactively sends an evening briefing for
"tomorrow" (weather-aware recommendation + booking/cash reminders) plus an
optional short morning nudge.

## Stack

- **Chat bridge**: [Telegram Bot API](https://core.telegram.org/bots/api)
  via `node-telegram-bot-api`, long-polling (no public HTTPS endpoint
  needed — works fine behind a home NAS with no port forwarding). This is
  the official, sanctioned way to run a bot — unlike the original
  WhatsApp/Baileys idea, there's no unofficial-client ToS risk and no
  24-hour proactive-messaging restriction to work around.
- **Brain**: Claude (`@anthropic-ai/sdk`), tool-use loop for interactive
  chat; a deterministic (non-tool-loop) path for the scheduled briefing so
  it can't fail to call a tool unattended.
- **Weather**: [Open-Meteo](https://open-meteo.com) — free, no API key.
- **Scheduler**: `node-cron`, timezone-aware (`TRIP_TZ`).
- **Trip data**: `data/trip.json` — 15 days, attractions, reminders,
  weather-recommendation rules. Edit this file directly to adjust the plan.
- **Kosher list**: `data/kosher.json` — the Vienna Kashrus Committee's
  Hamadrich supervision list (~2000 searchable entries: food, drinks, and
  OTC medications with their exact status, required hechsher, and notes).
  The agent has a `search_kosher_food` tool over it — ask things like "is
  Nutella kosher" or "can I take Aspirin on Pessach" in the group.

## Setup

```bash
npm install
cp .env.example .env
```

### Create the bot

1. Open Telegram, message [@BotFather](https://t.me/BotFather), send
   `/newbot`, follow the prompts (pick a name and a `_bot`-suffixed
   username). BotFather gives you a token like
   `123456789:AAF...` — put it in `.env` as `TELEGRAM_BOT_TOKEN`.
2. Fill in `ANTHROPIC_API_KEY` in `.env` too.

### Get the family group's chat id

```bash
npm start
```

Create a Telegram group with the family, add the bot to it (search its
username), and send any message in the group. The bot logs that group's
chat id to the console. Copy it into `.env` as `TELEGRAM_CHAT_ID` and
restart — without it, proactive briefings have nowhere to send to
(interactive replies still work in any chat the bot is in).

No pairing, no QR code, no session file — the bot token is all it needs,
so restarts and redeploys don't require re-authenticating anything.

## Running tests

```bash
npm test
```

Covers weather classification, trip-data lookups (including both Shabbat
dates), reminder resolution (explicit + dynamic booking/cash nudges), and
kosher-list search (including that a brand-level warning note doesn't bury
the specific flagged product it's warning about). No network or Telegram
connection required.

## Deploying alongside Cooking-Assistant on TrueNAS

The Cooking-Assistant repo builds via a GitHub Action that pushes to GHCR
and (presumably) a TrueNAS SCALE Custom App / Portainer stack pulls that
image — there's no compose file in that repo to mirror directly. Two ways
to add this bot next to it:

1. **Match the existing pattern**: copy `.github/workflows/docker.yml`'s
   approach into this repo (build + push to
   `ghcr.io/<owner>/austria-trip-bot`), then add a Custom App in TrueNAS
   pointing at that image, same as Cooking-Assistant.
2. **docker-compose.yml** (included) if you'd rather run it directly via
   Compose on the NAS — adjust the `build`/`image` line and the `data`
   volume path to wherever you keep persistent app data.

Because the Telegram bot is stateless (just a token, no session to lose),
the `/app/data` volume isn't critical the way a WhatsApp auth folder would
have been — it's kept for a possible future feature (hourly weather-watch
state), not required for day-to-day operation.

## Notes / known limitations (v1 scope)

- Drive-time reasoning uses the guide's own notes baked into `trip.json`,
  not live routing (no Google Directions integration yet).
- The "hourly weather-watch, only ping on change" idea from the original
  spec isn't implemented — `MORNING_HOUR` gives one lightweight daily
  reminder pass instead. Add a `data/state.json`-backed change-detector
  cron job if you want the hourly watch.
- Candle-lighting times in `trip.json` are marked "VERIFY" — they're
  estimates, not pulled from a halachic times API.
- Shabbat dates in the plan (22.8, 29.8) already correct a mislabeling in
  the original written itinerary (which called the Salzburg day "29.8" —
  that's actually a Saturday; the real Salzburg day is Sunday 30.8).
- The kosher list is a transcription of one dated PDF (Hamadrich, issue
  Juni 26) from one specific supervising body. It's not a live feed and it
  doesn't cover every product in the world — the agent is instructed to
  say so when nothing matches, rather than guess. Treat it as a lookup aid
  for what's already in the list, not a substitute for checking directly
  with a rabbi/hechsher for anything not covered or safety-critical.

## Security

Don't commit `.env` (already in `.gitignore`) — it holds both API keys.
If either the Anthropic key or the Telegram bot token ever leaks, rotate
it (Anthropic: console.anthropic.com; Telegram: `/revoke` via BotFather).
