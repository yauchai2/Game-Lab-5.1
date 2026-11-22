# 交接說明（Claude → Codex，2026-11-22）

## 已完成
v1 基礎遊戲 → v2（音效、跳躍攀爬滑翔、城鎮、多人）→ A Short Hike 風 UI → 豐富城鎮 → 風吹草動與水波＋設定頁 → 跨局成長（星砂、金羽毛、貝殼、每日委託、傳家寶鐵匠、出發詞綴）→ 空白鍵新操作。詳細見 `docs/06_*.md`、`docs/07_計畫與待辦.md`。

## 方向轉變（重要）
Alan 想把 Roguelike 改成 **MMORPG 結構**：
- 常駐大區域（6 區，等級 1–30，怪物重生，普通/精英/傳奇怪，素材掉落）
- 現有逐層房間改為**副本**（鑰石＋詞綴，產出最高階裝備）
- 交易市場（先做離線拍賣行：NPC 商人、價格波動、稅、綁定）
- 角色等級（上限 30）、角色選擇頁、世界總圖與遊戲內 M 鍵地圖
- 決定：死亡掉 25% 素材（墓碑可撿回），**不掉裝備與星砂**，鎮上復活；PvP 僅標記區域與主動開啟；線上版先維持離線模擬；區域為獨立場景（大區 100×100、小區 60×60，先不做分塊載入）
完整設計：Claude Doc https://claude.ai/artifact/HPY3ip7hotmK3MFMLBFWxo ；世界總圖草圖 `screens/worldmap.png`（產生腳本在共用資料夾 `worldmap.py`）。

## 建議的下一步（依序）
1. 角色選擇頁（參考 `reference/character/`）：膚色/髮色/髮型/眉毛/臉＋隨機鍵、多角色存檔、職業；`models.js` 的 `buildPlayer` 需改成可替換外觀。
2. 遊戲內 M 鍵世界地圖（奶油色面板風格，參考 `reference/worldmap/`）。
3. 區域骨架：把 `loadRoom` 的「一次性房間」拆成「常駐區域」與「副本」兩種場景；加怪物重生、怪物等級、經驗值與角色等級、墓碑。
4. 素材掉落與鐵匠用素材鍛造；離線拍賣行。

## 已知問題 / 注意
- 真機 FPS 未量測（只在雲端 swiftshader 測過）。
- 多人伺服器需自架；Artifact CSP 擋 WebSocket。戰鬥非伺服器權威。
- Godot / Mixamo MCP 尚未接上（見 `AGENTS.md`）。
- `game.js` 已偏長，拆區域系統時建議順手拆出 `zones.js`、`combat.js`。
- 空出來的 Shift 鍵用途待定。
- 世界總圖腳本有輕微標籤重疊，只是草圖。

## 如何驗證
見 `AGENTS.md`「快速開始」：`node build.mjs` → `node tests/bot.cjs` → 截圖檢查。
