# ChatUltra

<p align="center"><img src="public/logo.png" width="96" alt="ChatUltra logo" /></p>

**ChatUltra** is a dark, Codex-style AI studio that runs anywhere — chat with GPT-5.2, **Claude Opus 5**, Claude Sonnet 4.5, Gemini 3 Pro, Luna and local models, dial reasoning effort from **Low to Ultra**, **run shell commands** right in the chat, preview HTML live, build games in the Playground, create a profile, and push projects straight to GitHub.

Live site: **https://gefrus112.github.io/chat-gpt/** &middot; Repo: `gefrus112/chat-gpt`

![ChatUltra live on GitHub Pages](docs/screenshots/live-site.png)

---

## How it looks

### Codex-style interface

Slim icon rail on the left, model chip + effort dial + toolbar (effort, web access, terminal, attach, more) and a voice-input mic in the composer — the full Codex/Jan-style layout in dark mode.

![ChatUltra welcome](docs/screenshots/chat.png)

### Searchable model picker — Claude Opus 5 included

Type-to-search across grouped providers (OpenAI, Anthropic, Google, ChatUltra, Local AI), hover any row for provider options, and **Add New Models Provider...** to create your own.

![Model picker with Claude Opus 5](docs/screenshots/models.png)

### Run commands from the chat

Type `/` for slash commands (`/run`, `/models`, `/effort`, `/terminal`, `/git push`...), press **Run** on any bash code card, or open the built-in terminal drawer (Ctrl + `). Commands execute in the sandboxed `chatultra-shell` with real exit codes.

![Running commands](docs/screenshots/commands.png)

### Chat that builds playable things

Ask for a game and ChatUltra streams back a complete single-file HTML build with **Run**, **Canvas** and **Copy** actions — press Run to play it instantly.

![Chat building a snake game](docs/screenshots/chat-demo.png)

### Welcome screen

![ChatUltra welcome screen](docs/screenshots/chat-demo.png)

### Game Playground

Seven ready-made templates (Neon Pong, Neon Snake, Breakout, Space Blaster, Flappy Orb, Orb Tycoon, Blank) — run them live, edit the code, pop the editor out into a **separate window**, push the project to GitHub.

![Playground with Neon Pong](docs/screenshots/playground.png)

### Built-in Linux-style terminal

The `chatultra-shell` drawer docks under the chat (also available in the Playground) with `help`, `ls`, `cat`, `run`, `build`, `git status`, `git push`, `models`, `npm`, `neofetch` and more — complete with history, colors and exit codes.

![Terminal](docs/screenshots/terminal.png)

### Accounts & profiles

Create a local account, upload a profile picture, edit your bio and website link — stored in your browser, nothing sent to a server.

![Account creation](docs/screenshots/account.png)

### Connect real Claude (Opus 5)

Paste an Anthropic API key under **Settings > Connections** and Claude Opus 5 / Sonnet 4.5 answer for real, straight from the browser. Connection failures are handled gracefully — no cryptic HTTPS errors, the app always falls back to the built-in demo engine.

![Claude connection](docs/screenshots/connections.png)

---

## Features

- **11 built-in models** — GPT-5.2, GPT-5.2 Codex, o4 Mini, Claude Opus 5, Claude Sonnet 4.5, Gemini 3 Pro, Gemini 2.5 Flash, Luna 1, plus Local AI (Gemma 2B, Llama 3.1, Mistral Small) — each with its own icon
- **Searchable model picker** — grouped providers, hover actions, Add New Models Provider...
- **Run commands** — slash commands (`/run`, `/models`, `/effort ultra`, `/git push`, `/export`...), **Run** buttons on every bash code card, and a dockable terminal drawer (Ctrl + `)
- **Reasoning effort dial** — Low, Medium, High, Extra, Max, Ultra with signal-bar indicator
- **Voice input** — click the blue mic and speak (Web Speech API)
- **File attachments** — attach text/code files to any message
- **Custom AI models** — create your own agents with a picture avatar, system prompt and accent color; they appear in the picker
- **Real Claude** — add an Anthropic key in Settings > Connections; ChatUltra calls the Messages API directly from the browser (with the direct-browser-access header) and maps every failure to a friendly message
- **HTML live preview** — every code card has Run / Canvas actions with a sandboxed live preview you can edit
- **Game Playground** — 7 game templates, AI game builder, external editor window (popout syncs back), one-click **Push to GitHub** via your access token
- **chatultra-shell terminal** — Linux-style shell with build logs, git push and neofetch, in-chat and in the Playground
- **Agent & AI Video studios** — multi-step agent plans and multi-frame AI video renders
- **Local accounts** — sign up, upload a profile picture, edit bio and website link
- **GitHub integration** — paste a personal access token, test the connection, push Playground projects to `gefrus112/chat-gpt`
- **Dark by design** — Codex-grade dark UI, six accent colors, glow effects, monospace mode

## Run locally

```bash
bun install            # or npm install
bun run dev            # http://localhost:3000
```

Full server mode uses the bundled AI backend and SQLite (Prisma). Without a backend (static hosting) ChatUltra automatically switches to its demo brain, localStorage persistence and browser-side GitHub push.

## Static export for GitHub Pages

```bash
bash scripts/static-export.sh   # builds the site into ./out
```

Deployed from the `gh-pages` branch to: https://gefrus112.github.io/chat-gpt/

## GitHub integration

1. Create a personal access token at [github.com/settings/tokens](https://github.com/settings/tokens) (fine-grained, with **Contents: Read & write** on your target repo)
2. Open **Settings > GitHub**, paste the token, confirm the repo (`gefrus112/chat-gpt`) and press **Test connection**
3. In the Playground, press **Push to GitHub** — your project lands in the repo; the terminal's `git push` does the same

The token is stored only in your browser's localStorage and is never sent anywhere except `api.github.com`.

## License

MIT
