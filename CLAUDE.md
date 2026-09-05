# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JukeStage is a real-time interactive jukebox web app for live events (`jukestage.live`). Two personas:
- **Voters**: scan a QR code → authenticate via OTP → request songs, vote, rate, send messages
- **Artists/DJs**: sign up or log in via email OTP → manage gigs, control song queue, view feedback

## Stack

- **Frontend**: Vanilla JS + HTML + CSS, no framework, no build step
- **Backend**: Supabase (PostgreSQL + Auth + Realtime WebSocket subscriptions)
- **Hosting**: Vercel (SPA — all routes rewrite to `index.html` via `vercel.json`)
- **Edge Functions**: Supabase Deno functions in `supabase/functions/` — see Edge Functions section below
- **PWA**: `manifest.json` + mobile meta tags for standalone mode

## File Structure

```
index.html              # 659 lines — HTML structure only, loads scripts at bottom
css/
  style.css             # 1111 lines — all active styles (loaded by index.html)
  main.css              # 1067 lines — not loaded, kept as reference/backup
js/
  app.js                # 2500 lines — all business logic
  translations.js       # 1022 lines — i18n object for 6 languages (nl/en/fr/de/es/mg)
  qr-generator.js       # QR code generation + PNG download utility
supabase/
  functions/fetch-genius-urls/index.ts  # Deno edge function
```

Scripts are loaded at the **bottom of `<body>`** in order: `translations.js` → `qr-generator.js` → `app.js`. All three run as classic (non-module) globals.

## Development

No build step. Serve the root folder statically:

```bash
npx serve .
# or
python -m http.server 8080
```

**Supabase Edge Function** (Deno):
```bash
supabase functions serve fetch-genius-urls --env-file .env.local
```

## Architecture

### Routing
`showView(viewName)` swaps `.view` div visibility. No router library — pure `display` toggling. URL hash reflects the current view.

### State
Top-level `let` variables in `app.js`: `currentUser`, `currentGig`, `currentArtist`, `voterSession`, `realtimeChannel`, `allSongs`, `arrivedViaQR`, `voterAuthUser`, `voterPendingEmail`.

### Auth
- **Artists**: Email OTP via `db.auth.signInWithOtp()` — login and signup share the same UI/flow. After OTP verification, existence of a `users` row determines login (existing) vs signup (new). New artists get an `artists` row created with `tier = 'free'`. Multi-screen flow managed by `showArtistScreen(name)` toggling `artist-screen-*` divs. State: `artistPendingEmail`, `artistPendingAuthUser`.
- **Voters**: Email OTP via `db.auth.signInWithOtp()` → `voter_profiles` + `voter_sessions` table entries. Multi-screen flow managed by `showVoterScreen(name)` toggling `voter-screen-*` divs.

### Realtime
`subscribeRealtime()` sets up per-gig Supabase WebSocket channels for live queue/vote/message updates. Active channel stored in `realtimeChannel`.

### Artist tier system
Artists have a `tier` field on the `artists` table: `'free'` (default) or `'pro'`. `subscription_valid_until` (nullable timestamp) controls pro access expiry. Tier-gating logic will be added later — do not add paid features without checking this field.

### Key Supabase tables
| Table | Purpose |
|---|---|
| `gigs` | Events with `qr_token`, `venue`, `gig_date`, `status` (live/finished) |
| `songs` | Repertoire with `karaoke_url`, `genius_url`, `is_active` |
| `gig_songs` | Per-gig song availability with `vote_count` |
| `requests` | Song requests with status: pending/approved/queued/playing/played/rejected |
| `votes` | Upvotes on requests |
| `voter_sessions` | Active voter per gig (links auth user → gig) |
| `voter_profiles` | Voter display name + preferences |
| `messages` | Voter → artist messages |
| `comments` | Ratings and reviews per gig/song |
| `artists` | Artist/band profile with `name`, `tier`, `subscription_valid_until` |
| `users` | App user record linking Supabase auth (`auth_id`) to app role/name |
| `user_artists` | Many-to-many: links `users` to `artists` |
| `analytics_events` | Visitor/usage logging: session journey, geo, language, QR arrival, logins, requests/votes/messages (see Analytics below) |

All tables use Row-Level Security (RLS).

### i18n
`t('key')` resolves to the current language string from `translations.js`. Default is Dutch (`nl`).

### QR links
Voter QR links use `https://jukestage.live/?gig=<qr_token>`. When a voter arrives via QR, `arrivedViaQR = true` locks them to that gig.

### Analytics
`logEvent(eventType, extraData, overrides)` in `app.js` fires-and-forgets a call to the `log-event` edge function, which writes a row to `analytics_events` using the service-role key (clients never read/write that table directly — RLS is on with no policies). Every event carries a `session_id` (random UUID cached in `sessionStorage`, so it groups everything one visitor does in one browser tab), plus `gig_id` / `voter_session_id` / `artist_id` when known, and geo (`country`/`region`/`city`) resolved server-side from the request IP via ipapi.co.

Logged event types: `session_start` (on app boot, includes referrer + active language), `view_screen` (every `showView`/`showVoterScreen`/`showArtistScreen` call — this is how you reconstruct someone's route through the app), `qr_arrival`, `language_selected` (fired from `setLang` in `translations.js`), `voter_login_success`, `artist_login_success`, `artist_signup`, `song_request`, `vote`, `message_sent`, `rating_submitted`. The edge function rejects any other `event_type`.

Query examples live as SQL comments/views in `supabase/migrations/20260905000000_add_analytics_events.sql` (`analytics_geo_summary`, `analytics_language_summary`). To see one visitor's full journey: `select created_at, event_type, event_data from analytics_events where session_id = '...' order by created_at`.

No new secrets needed — `log-event` reuses `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, already set for `fetch-genius-urls`. Deploy with `supabase functions deploy log-event` and apply the migration.

**In-app dashboard**: an "Analytics" tab in the artist panel (`atab-analytics` in `index.html`, only shown when `currentUser.role === 'admin'`) calls the `get-analytics-summary` edge function, which checks the caller is an admin (via their JWT + the `users` table) before returning aggregated totals/geo/language/event-type breakdowns and a recent-activity feed. `loadAnalyticsSummary()` in `app.js` renders it.

## Deployment

Push to `main` → auto-deploys to Vercel. Edge function secrets (`GENIUS_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) are set in the Supabase project dashboard.

## Edge Functions

| Function | Trigger | Doel |
|---|---|---|
| `fetch-genius-urls` | Handmatig | Genius lyrics-URLs backfillen voor songs |
| `notify-artist-signup` | Aangeroepen vanuit `saveArtistProfile()` in `app.js` | E-mailnotificatie bij nieuwe artiest-signup |
| `log-event` | Aangeroepen vanuit `logEvent()` in `app.js` (op vrijwel elke user-actie) | Bezoekers-/gedragslogging wegschrijven naar `analytics_events`, inclusief geo-lookup |
| `get-analytics-summary` | Aangeroepen vanuit `loadAnalyticsSummary()` bij het openen van het Analytics-tabblad | Geaggregeerde bezoekersstatistieken teruggeven (admin-only, checkt `users.role`) |

### notify-artist-signup — eenmalige setup

1. **Resend-account**: maak aan op [resend.com](https://resend.com)
2. **Domein verifiëren**: voeg DNS-records toe voor `jukestage.live` (Resend → Domains)
3. **API-key genereren**: Resend → API Keys → Create API Key
4. **Secrets instellen** in Supabase dashboard → Settings → Edge Functions → Secrets:
   - `RESEND_API_KEY` = jouw Resend API-key
   - `NOTIFY_EMAIL` = het e-mailadres waarop je notificaties wil ontvangen
5. **Deployen**:
   ```bash
   supabase functions deploy notify-artist-signup
   ```

> De aanroep in `saveArtistProfile()` is fire-and-forget: als Resend faalt, logt de browser een waarschuwing maar wordt de signup-flow nooit geblokkeerd.
