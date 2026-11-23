#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"

INTERVAL_SEC="${INTERVAL_SEC:-5}"
KEEP_LATEST="${KEEP_LATEST:-6}"
ONLY_ON_CHANGE="${ONLY_ON_CHANGE:-1}"

echo "=========================================="
echo " 燈谷行 Lantern Vale 自動偵測截圖／錄影工具"
echo " 偵測頻率：每 ${INTERVAL_SEC} 秒檢查一次 game/index.html"
echo " 模式：僅在建置變動時自動開拍（ONLY_ON_CHANGE=${ONLY_ON_CHANGE}）"
echo " 拍攝清單：13 張畫面＋gameplay.mp4（保留最新 ${KEEP_LATEST} 份）"
echo " 按 Ctrl+C 即可隨時停止"
echo "=========================================="

mkdir -p review/output
LAST_MTIME=""

while true; do
  CUR_MTIME=""
  if [ -f "game/index.html" ]; then
    CUR_MTIME=$(stat -f "%m" game/index.html 2>/dev/null || echo "")
  fi

  if [ "$ONLY_ON_CHANGE" = "1" ] && [ -n "$LAST_MTIME" ] && [ "$CUR_MTIME" = "$LAST_MTIME" ]; then
    sleep "$INTERVAL_SEC"
    continue
  fi

  STAMP="auto-$(date '+%Y%m%d-%H%M%S')"
  cat > review/request.json <<EOF
{
  "id": "${STAMP}",
  "shots": ["title", "town", "ui:bag", "ui:puzzle", "ui:souls", "ui:atlas", "ui:forge", "ui:map", "field:1", "combat:elements", "combat:tide", "field:12", "boss"],
  "recordVideo": true
}
EOF
  echo ""
  echo "[$(date '+%H:%M:%S')] 偵測到建置更新，開始自動截圖與錄影：${STAMP}"
  node tests/review_watch.cjs --once
  LAST_MTIME="$CUR_MTIME"

  # 自動清理舊的 auto-* 快照，僅保留最新 KEEP_LATEST 份
  ls -1dt review/output/auto-* 2>/dev/null | tail -n +$((KEEP_LATEST + 1)) | while IFS= read -r dir; do rm -rf "$dir"; done

  echo "[$(date '+%H:%M:%S')] 完成！持續每 ${INTERVAL_SEC} 秒監聽建置變動..."
  sleep "$INTERVAL_SEC"
done
