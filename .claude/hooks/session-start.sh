#!/bin/bash
# Installs the GitNexus CLI in Claude Code cloud sessions and refreshes the
# code-intelligence index (.gitnexus/, gitignored) in the background.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

if ! command -v gitnexus >/dev/null 2>&1; then
  npm install -g gitnexus@latest >/dev/null 2>&1
fi

# Indexing takes about a minute; run it detached so the session is not blocked.
if ! gitnexus status 2>/dev/null | grep -q 'up-to-date'; then
  nohup gitnexus analyze >/tmp/gitnexus-analyze-"$(basename "$PWD")".log 2>&1 &
fi
