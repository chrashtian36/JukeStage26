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
- **Edge Function**: Supabase Deno function (`supabase/functions/fetch-genius-urls/`) for Genius API lyrics backfill
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

All tables use Row-Level Security (RLS).

### i18n
`t('key')` resolves to the current language string from `translations.js`. Default is Dutch (`nl`).

### QR links
Voter QR links use `https://jukestage.live/?gig=<qr_token>`. When a voter arrives via QR, `arrivedViaQR = true` locks them to that gig.

## Deployment

Push to `main` → auto-deploys to Vercel. Edge function secrets (`GENIUS_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) are set in the Supabase project dashboard.
