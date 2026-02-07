# Voice Reader

A mobile-first PWA for reading text aloud with sentence-level navigation. Built to solve the problem of Claude's iOS text-to-speech breaking mid-response.

## Stack
- Next.js 14 (App Router)
- React 18
- OpenAI TTS API (model: `tts-1`) for audio generation
- No CSS framework — inline styles, IBM Plex Sans/Mono fonts via Google Fonts
- Deployed on Vercel

## Architecture
- `app/page.js` — Single-page client component. The entire app lives here.
- `app/api/tts/route.js` — API route that proxies requests to OpenAI's TTS API. Accepts POST `{ text, voice, speed }`, returns mp3 audio stream.
- `app/layout.js` — Root layout with PWA meta tags.
- `public/manifest.json` — PWA manifest (standalone mode, portrait orientation).
- `public/sw.js` — Service worker (network-first caching strategy).
- `public/icon-192.png`, `public/icon-512.png` — App icons.

## How It Works
- User pastes text, presses play.
- Text is split into sentences. Each sentence is sent to `/api/tts` which calls OpenAI's TTS API.
- Audio is returned as mp3 and played via an `<audio>` element — this enables lock-screen playback on iOS.
- Next 3 sentences are prefetched while the current one plays (no gaps between sentences).
- Media Session API (`navigator.mediaSession`) provides play/pause/skip controls on the iOS lock screen.
- Sentence-level skip forward/back, tap-to-jump, progress bar scrubbing.
- Speed control: 0.75× to 2×, adjustable mid-playback.
- Voice selection: 6 OpenAI voices (nova, alloy, echo, fable, onyx, shimmer). Default: nova.
- Falls back to Web Speech API (`speechSynthesis`) if the TTS API call fails.

## Environment Variables
- `OPENAI_API_KEY` — Required. Your OpenAI API key for TTS generation.

## Design
- Dark theme (#0a0a0b background), warm accent (#c45a3c).
- IBM Plex Sans for body, IBM Plex Mono for labels/controls.
- Max-width 480px, mobile-first. Safe area insets for standalone PWA mode.

## Known Limitations
- Each sentence is a separate TTS API call. Very long texts with many sentences will make many API calls. Prefetching mitigates perceived latency.
- Clipboard API requires HTTPS and a user gesture on iOS.
- When falling back to speechSynthesis (API unavailable), iOS Safari may still suspend audio on lock.

## Commands
- `npm install` — Install dependencies
- `npm run dev` — Local dev server (http://localhost:3000)
- `npm run build` — Production build
- `npm run start` — Serve production build locally
