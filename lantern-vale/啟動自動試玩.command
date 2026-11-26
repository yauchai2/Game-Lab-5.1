#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p review/output/live
if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  npm ci
fi
npm run build
set -o pipefail
npm run playtest:live -- "$@" 2>&1 | tee -a review/output/live/live-console.log
