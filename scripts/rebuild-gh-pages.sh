#!/usr/bin/env bash
# Rebuild the orphan gh-pages branch from ./out (static export) via a temp repo,
# keeping the previous gh-pages commit as parent.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DEPLOY_MSG:=Deploy static site}"

if [ ! -f out/index.html ]; then
  echo "error: out/index.html missing — run scripts/static-export.sh first" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp -r out/. "$TMP"/
git -C "$TMP" init -q
git -C "$TMP" add -A
git -C "$TMP" -c user.email=deploy@chatultra.local -c user.name=ChatUltra commit -qm "site"

TREE=$(git -C "$TMP" rev-parse HEAD^{tree})
PARENT=$(git rev-parse --verify --quiet gh-pages^{commit} 2>/dev/null || true)
if [ -n "$PARENT" ]; then
  COMMIT=$(git -C "$TMP" commit-tree "$TREE" -p "$PARENT" -m "$DEPLOY_MSG")
else
  COMMIT=$(git -C "$TMP" commit-tree "$TREE" -m "$DEPLOY_MSG")
fi
# the commit/tree objects live in the temp repo — transfer them over
git -C "$TMP" update-ref refs/heads/deploy "$COMMIT"
git fetch -q "$TMP" deploy
git update-ref refs/heads/gh-pages FETCH_HEAD

echo "gh-pages rebuilt: $(git log --oneline -1 gh-pages)"
echo "files: $(git ls-tree -r --name-only gh-pages | wc -l)"
echo "nojekyll: $(git ls-tree --name-only gh-pages | grep -c nojekyll || true)"
