# 燈谷行 Lantern Vale — 專案總覽

A Short Hike 風格（像素化低多邊形 3D）× Roguelike / POE2 式 ARPG 的原創遊戲原型。

- **直接玩**：打開 `game/index.html`（任何現代瀏覽器，鍵盤＋滑鼠）。
- **原始碼**：`src/`，建置方式見 `02_技術規劃與實作.md`。
- **截圖**：`screens/`

## 文件
1. `01_A_Short_Hike_美術與技術研究.md` — 參考圖/影片逐項拆解、技術推測
2. `02_技術規劃與實作.md` — 渲染管線、世界生成、Godot 移植對照、檔案結構
3. `03_遊戲設計.md` — 操作、流程、敵人、裝備詞綴、天賦
4. `04_素材評估與工具檢查.md` — Godot MCP / Mixamo MCP 檢查結果、temporary/ 素材與授權
5. `05_決策與截圖檢討.md` — 重要決策、每輪截圖檢討與修正

## v2（2026-11-22）
6. `06_v2_城鎮_多人_垂直移動_音效.md` — 本輪新增：鍵盤修正、寬通道、跳躍/攀爬/滑翔、音效、燈谷鎮、多人伺服器
- 多人：`npm i ws && node server/server.js` → 開 `http://localhost:8080`
- 存檔快照：`releases/v1`、`releases/v2`
