# ONLINE KITIBWA

Forex, gold and Bitcoin alert bot with a live dashboard. It scans CRT, CISD and MSNR+LIT setups, confirms them with the US Dollar Index (DXY), and sends alerts to Telegram, WhatsApp or a webhook. It never places orders itself.

Built with Next.js 15 and deployed to Cloudflare Workers through OpenNext.

## Project layout

```
app/                    Next.js routes only
  layout.tsx, page.tsx
  api/
    scan/               every timeframe for one pair (dashboard, every 15 s)
    price/              live price (every 3 s)
    predict/            prediction + news calendar
    alerts/             the bot run: scans and sends alerts (needs BOT_SECRET)
    assistant/          AI assistant (needs BOT_SECRET and GROQ_API_KEY)
components/
  dashboard/            Dashboard, DxyCard, TradeCards
  settings/             floating settings button + drawer
  prediction/           prediction tab
  assistant/            AI assistant chat
  chart/                TradingView chart
  ui/                   shared form controls
lib/
  trading/              engine (strategies), predict, config (pairs, timeframes), dxy, dxy-context
  market/               feed (Yahoo Finance), data (candle bundles + DXY), news (calendar)
  alerts/               notify (Telegram, WhatsApp, webhook), settings (types, defaults, validation)
  ai/                   assistant context and prompt
  client/               browser only: sound, voice, ambient music, themes, formatting
styles/                 theme, base, dashboard, settings, assistant
public/                 logo and static headers
```

## DXY alignment

Gold, EUR/USD, GBP/USD and AUD/USD normally move against the dollar. USD/JPY and USD/CAD move with it. Bitcoin is not filtered.
A setup is only sent when the dollar index agrees on the higher timeframe and does not contradict it on the setup timeframe.

- Switch it on or off in Settings, Strategy, DXY alignment (on by default).
- If the DXY feed is unreachable, setups are not held back and the dashboard shows NO FEED.
- Running trades are never hidden by DXY. They stay visible until the target or stop is hit.
- Setups held back show a HELD: DXY tag, stay silent and are not sent.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars     # set BOT_SECRET (and GROQ_API_KEY if you want the assistant)
npm run dev
```

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler secret put BOT_SECRET
npx wrangler secret put GROQ_API_KEY     # optional
npm run deploy
```

`npm run preview` builds and runs the Worker locally first.

Workers Paid is recommended: a full scan makes many outbound requests and uses more CPU than the free plan allows.
