#!/usr/bin/env bash
# Push ChatUltra to https://github.com/gefrus112/chat-gpt
#
# Usage:
#   GITHUB_TOKEN=github_pat_xxxx bash scripts/push-to-github.sh
#
# Token needs: fine-grained PAT on gefrus112/chat-gpt with
#   Contents: Read and write  (+ Workflows: Read and write, optional)
set -euo pipefail
: "${GITHUB_TOKEN:?Set GITHUB_TOKEN to a GitHub personal access token first}"
cd "$(dirname "$0")/.."

git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/gefrus112/chat-gpt.git" 2>/dev/null \
  || git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/gefrus112/chat-gpt.git"

echo "→ pushing source (main)…"
git push origin main

echo "→ pushing static website (gh-pages)…"
git push origin gh-pages

echo ""
echo "✓ Done — https://github.com/gefrus112/chat-gpt"
echo "  Website: enable ONE of the following in Settings → Pages:"
echo "   A) Source: Deploy from a branch → gh-pages / root  (instant, uses the prebuilt site)"
echo "   B) Source: GitHub Actions  (rebuilds automatically on every push)"
echo "  Then open: https://gefrus112.github.io/chat-gpt/"
