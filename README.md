# ChatUltra ⚡

A dark, Codex-style AI studio you can run anywhere — chat with GPT-5.2, Claude Sonnet 4.5, Gemini 3 Pro & Luna, dial reasoning effort from **Low → Ultra**, preview HTML live, build games in the Playground and push projects straight to GitHub.

![ChatUltra](public/logo.png)

## Features

- **Codex-grade dark UI** — dark-first design with accent colors, neon glow and font-size settings
- **Model picker with real brand icons** — ChatGPT (GPT-5.2, GPT-5.2 Codex, o4 Mini), Claude (Sonnet 4.5, Opus 4.1), Gemini (3 Pro, 2.5 Flash) and Luna 1, ChatUltra's in-house model
- **Reasoning effort dial** — Low / Medium / High / Extra / Max / Ultra with signal bars
- **Live HTML preview (Canvas)** — every code card gets *Run*, an editable Canvas panel and a pop-out window
- **Game Playground** — 7 ready-to-run templates, an AI game builder and an **external editor window** that syncs back via postMessage
- **chatultra-shell terminal** — a Linux-style project terminal (`help`, `ls`, `git status`, `git push`, `neofetch` …)
- **GitHub integration** — paste a fine-grained personal access token (default repo `gefrus112/chat-gpt`) and push Playground projects in one click — even from the static site, straight from your browser
- **Your own AI models** — create custom models with avatar upload, persona system prompt and accent color; they appear in the picker
- **Agent mode & AI Video studio** — autonomous step-by-step agent and a keyframe video generator (require the full server)

## Run the full studio (with real AI)

```bash
bun install
bun run db:push     # init the SQLite database
bun run dev         # http://localhost:3000
```

Chat, Agent and Video stream through the bundled AI SDK server routes (`/api/chat`, `/api/agent`, `/api/video`).

## Run as a static website (demo mode)

```bash
bash scripts/static-export.sh   # → ./out
```

The export has **no backend**: the chat falls back to a built-in demo brain (with playable sample games), custom models are stored in `localStorage`, and GitHub pushes go directly from the browser to `api.github.com`. Playground, templates, Canvas preview, terminal and settings work fully.

## Deploy to GitHub Pages

1. Push this repo to GitHub (default: `github.com/gefrus112/chat-gpt`).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) builds and deploys on every push to `main`.

The site lands at `https://<user>.github.io/chat-gpt/` (base path configurable via `PAGES_BASE_PATH`).

## GitHub token

Create a fine-grained token at [github.com/settings/tokens](https://github.com/settings/tokens?type=beta) with **Contents: Read & write** on your target repo, then paste it in **Settings → GitHub**. It is stored only in your browser.
