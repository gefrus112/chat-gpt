# ChatUltra — real backend

The folder that turns the ChatUltra web app into a **fully live AI studio**:
real text generation, real video generation, Stripe credits, Supabase
accounts and Cloudflare-protected signups — all driven by your own API keys.

## Quick start

```bash
cd backend
cp .env.example .env      # fill in the keys you have (all optional)
npm install               # or: bun install
npm start                 # -> http://localhost:8787
```

Then open the ChatUltra web app → **Settings → Connections → ChatUltra
Backend** and set the URL (`http://localhost:8787`) plus the backend key you
put in `CHATULTRA_BACKEND_KEY`.

## What each key does

| Key | Powers |
| --- | --- |
| `OPENAI_API_KEY` | GPT-5.2 / GPT-5.2 Codex (paid, 5 credits/request) |
| `ANTHROPIC_API_KEY` | Claude Opus 5.1, Claude Opus 5, Claude Sonnet 4.5 |
| `GOOGLE_API_KEY` | Gemini 3 Pro / 2.5 Flash |
| `FAL_KEY` | **Dreamina 4 + Seedance 1 Pro** real video renders |
| `KLING_API_ID` + `KLING_API_KEY` | **Kling Omni** real video renders |
| `STRIPE_SECRET_KEY` | Credits → real Stripe Checkout sessions |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Account cloud sync |
| `CLOUDFLARE_TURNSTILE_SECRET` | Server-side signup verification |

**No keys at all? The server still works** — the four public models
(**Luna 1** for text, **Dreamina 4**, **Seedance 1 Pro**, **Kling Omni** for
video) are **free**: text and video generation cost 0 credits and always
answer through the built-in free engine / demo renderer.

## Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status + which providers are configured |
| GET | `/api/models` | Public model list (free text + video) |
| POST | `/api/chat` | Text generation with automatic provider routing |
| POST | `/api/video` | Video generation (Kling Omni / Dreamina 4 / Seedance 1 Pro) |
| POST | `/api/credits/checkout` | Stripe Checkout session for a credit plan |
| POST | `/api/account/sync` | Supabase profile upsert + Turnstile verify |

Auth: send `Authorization: Bearer $CHATULTRA_BACKEND_KEY` (omit entirely when
no key is configured — open mode).

## Supabase schema

Create the tables once with the SQL editor (or `psql`):

```bash
# Supabase dashboard → SQL editor → paste backend/supabase/schema.sql → Run
```

## Deploying

Any Node 18+ host works (Fly.io, Render, Railway, a VPS, Cloudflare
Workers via nodejs_compat...). The web app talks to it over plain HTTPS, so
point **Settings → Connections → ChatUltra Backend** at your deployed URL and
everything — chat, video, credits, accounts — goes live.
