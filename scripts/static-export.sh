#!/usr/bin/env bash
# Build a fully static ChatUltra export for GitHub Pages.
#
# API routes are excluded (GitHub Pages has no server); the UI automatically
# falls back to its built-in demo brain, localStorage custom models and
# browser-side GitHub push, so the site stays functional as a website.
#
# Env:
#   PAGES_BASE_PATH  base path of the project page (default /chat-gpt)
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP=".static-export-backup"
restore() {
  if [ -d "$BACKUP/api" ]; then
    mv "$BACKUP/api" src/app/api
  fi
  rm -rf "$BACKUP"
}
trap restore EXIT

rm -rf "$BACKUP" out
mkdir -p "$BACKUP"

echo "→ moving server API routes out of the static build…"
mv src/app/api "$BACKUP/api"

echo "→ building static export (base path: ${PAGES_BASE_PATH:-/chat-gpt})…"
BUILD_STATIC=1 PAGES_BASE_PATH="${PAGES_BASE_PATH:-/chat-gpt}" ./node_modules/.bin/next build

echo "→ restoring API routes…"
restore

# GitHub Pages: skip Jekyll processing so _next/ assets are served as-is
touch out/.nojekyll

echo "✓ static export ready in ./out"
