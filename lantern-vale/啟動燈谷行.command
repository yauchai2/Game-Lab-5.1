#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PORT="${PORT:-8080}"
URL="http://localhost:$PORT"
LOG="${TMPDIR:-/tmp}/lantern-vale-$PORT.log"

lantern_alive() {
  curl -fsSI --max-time 2 "$URL/health" 2>/dev/null | tr -d '\r' | grep -qi '^X-Lantern-Vale-Server: zone-shards$'
}

if ! lantern_alive; then
  if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT 已被其他服務使用。請先停止該服務，或用 PORT=8090 啟動另一個本機網址。"
    exit 1
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "請先安裝專案所需的 Node.js，再啟動遊戲。"
    exit 1
  fi
  echo "正在啟動《燈谷行》多人伺服器（Port $PORT）…"
  PORT="$PORT" HOST="${HOST:-127.0.0.1}" nohup node "$DIR/server/server.js" >"$LOG" 2>&1 </dev/null &
  for _ in {1..20}; do
    if lantern_alive; then break; fi
    sleep 0.25
  done
  if ! lantern_alive; then
    echo "伺服器啟動失敗。請查看 $LOG"
    exit 1
  fi
fi

open "$URL/"
echo "多人伺服器已啟動。進入遊戲後，可從「選單 → 區域分流」查看與切換分流。"
