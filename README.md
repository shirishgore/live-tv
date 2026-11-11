# Kage TV

A free directory and player for publicly available live TV channels — a
MeowTV-style site built on the public [iptv-org](https://github.com/iptv-org/iptv)
catalog. No video is hosted here: streams play directly from their
broadcasters' servers.

## Features

- Browse and search thousands of public live TV channels by country, category, and language
- HLS player with multi-server failover, playback speed, subtitles, picture-in-picture, and fullscreen
- Watchlist (Watchlist / Planned / Completed), Continue Watching, and watch history — stored locally under an anonymous device id, no accounts
- Country auto-detect (IP → language → timezone, India fallback) with a searchable picker; preference remembered in a cookie
- Channel catalog refreshed daily from iptv-org
- Google AdSense monetisation (`public/ads.txt`, `components/AdSense.tsx`, `components/AdSlot.tsx`)

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- Drizzle ORM + Turso (libSQL) for the channel catalog and anonymous watchlists
- HLS.js for stream playback
- Vercel hosting, Vercel Cron for the daily catalog refresh, GitHub Actions for deploys

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy the values into a local `.env.local` file. **Never commit real values.**

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Optional | Turso database URL for the catalog and watchlists |
| `TURSO_AUTH_TOKEN` | Optional | Turso auth token (pair with the URL above) |
| `CRON_SECRET` | Optional | Shared secret authorising the `/api/refresh-catalog` cron endpoint |

Without Turso configured, the app runs with its bundled/seeded catalog data where available.

## Deploy on Vercel

1. Create a Vercel project from this repository (import it in the Vercel dashboard).
2. Set the environment variables in the project settings: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CRON_SECRET`.
3. Add the following secrets to the GitHub repository (Settings → Secrets and variables → Actions) so the deploy workflow can run:
   - `VERCEL_TOKEN` — a Vercel personal token with access to the project
   - `VERCEL_PROJECT_ID` — the Vercel project ID
4. Push to `main` (or trigger the workflow manually) — `.github/workflows/deploy.yml` builds and deploys to production.

The daily catalog refresh is scheduled in `vercel.json` as a Vercel Cron hitting `/api/refresh-catalog` at `0 0 * * *` (00:00 UTC, 05:30 IST).

## AdSense

- `public/ads.txt` declares the publisher id (`google.com, pub-5164539936748224, DIRECT, f08c47fec0942fa0`).
- `components/AdSense.tsx` loads the official `adsbygoogle.js` script and the `google-adsense-account` meta tag; it is imported once in `app/layout.tsx`.
- `components/AdSlot.tsx` renders a labelled ad container. It only requests an ad when given a `slot` prop — no ad-unit slot ids exist yet, so slots render as empty labelled boxes until real slot ids are added.

**Important:** add the live domain in the AdSense account (Sites → Add site) and wait for approval before ads will serve. A `*.vercel.app` URL is unlikely to be approved — a custom domain is needed for ad earnings.

## Legal pages

- `/about` — what Kage TV is, no hosting, AdSense-funded
- `/privacy` — no accounts, anonymous device id, cookie and AdSense disclosure
- `/contact` — how to report a dead channel or request a removal (via the site owner's GitHub; no email, no form backend)
