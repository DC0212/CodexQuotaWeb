#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Codex Meter needs Node.js 18 or newer."
  echo "Download it from: https://nodejs.org/"
  echo ""
  printf "Press Enter to close..."
  read -r _
  exit 1
fi

node "./src/server.js"
