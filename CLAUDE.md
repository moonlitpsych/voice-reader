# Voice Reader

A mobile-first PWA for reading text aloud with sentence-level navigation. Built to solve the problem of Claude's iOS text-to-speech breaking mid-response.

## Stack
- Next.js 14 (App Router)
- React 18
- No CSS framework — inline styles, IBM Plex Sans/Mono fonts via Google Fonts
- Deployed on Vercel

## Architecture
- `app/page.js` — Single-page client component. The entire app lives here.
- `app/layout.js` — Root layout with PWA meta tags.
- `public/manifest.json` — PWA manifest (standalone mode, portrait orientation).
- `public/sw.js` — Service worker (network-first caching strategy).
- `public/icon-192.png`, `public/icon-512.png` — App icons.

## How It Works
- User pastes text, presses play.
- Text is split into sentences and spoken one-by-one via Web Speech API (`speechSynthesis`).
- Sentence-level skip forward/back, tap-to-jump, progress bar scrubbing.
- iOS Safari workaround: periodic pause/resume to prevent Safari from killing speechSynthesis after ~15 seconds.
- Speed control: 0.75× to 2×, adjustable mid-playback.

## Design
- Dark theme (#0a0a0b background), warm accent (#c45a3c).
- IBM Plex Sans for body, IBM Plex Mono for labels/controls.
- Max-width 480px, mobile-first. Safe area insets for standalone PWA mode.

## Known Limitations
- Web Speech API on iOS Safari still gets suspended when the phone locks. The pause/resume workaround helps but isn't bulletproof. A future improvement could use a server-side TTS API (e.g., ElevenLabs, OpenAI TTS) to generate actual audio files that play via <audio> element, which iOS respects in background.
- Clipboard API requires HTTPS and a user gesture on iOS.

## Commands
- `npm install` — Install dependencies
- `npm run dev` — Local dev server (http://localhost:3000)
- `npm run build` — Production build
- `npm run start` — Serve production build locally
