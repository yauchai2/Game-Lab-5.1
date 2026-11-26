# 背包與物品系統重做（2026-11-26）

## 重點
- **物理背包保留**：`src/physbag.js` 的重力掉落、碰撞、拖曳、搖一搖、碰撞合成與多形狀（長格／方格／菱形／瓶／圓）都不變；只是每個物件改畫成「格子＋物品圖」，稀有度用邊框色表示，可堆疊物件右下角顯示數量（`qty`）。世界掉落（`Game.dropItem` 的彈跳落地）也保留，並在寶石上方多一張物品圖看板。
- **8 個裝備欄**（`loot.js` 的 `SLOTS`）：頭、武器（鍵仍是 `staff`，存檔相容）、身、斗篷、手、腳、護符、聖物。新欄位有各自的隱含詞綴與可出現詞綴；新欄位目前沒有傳奇範本，指定這些欄位出傳奇時會降成稀有。
- **物品資料庫**：`data/items.json`（339 項，來自「裝備物品系統企劃」item_master）＋ `src/itemdb.js`。裝備掉落時從企劃清單依欄位與品階挑一件（優先挑有圖的）決定名稱與圖示，存檔欄位 `art`。
- **圖示**：`game/assets/items/{128,256}/{id}.png`，以企劃 id 命名；對照表 `data/item_art_map.json`。目前 84 張（P0 83 件＋1 張圓盾），其餘 256 件沒有圖，改畫欄位剪影，清單在 `data/item_art_missing.txt`。
- **介面**：沿用遊戲的 CrispPixel 木框／黃銅風，英雄裝備面板（左頭身手腳、右武器斗篷護符聖物、中間職業徽章與攻擊／減傷／移速／戰力），格子邊框＝稀有度色；提示框改成 POE2 式（大圖示＋稀有度色標題帶＋分隔線＋藍色詞綴＋與目前裝備比較）。

## 加新圖的流程
1. 在 Figma 生成，匯出 1024 PNG。
2. `python3 tools/item_cutout.py raw.png out_{s}.png` 去背。
3. 檔案放 `game/assets/items/128|256/{item id}.png`，在 `data/item_art_map.json` 加 `"id": "節點名"`（值只是備註），重新 `node build.mjs`。

## 測試
- `node tests/logic_verify.cjs`（已更新：合成裝備測試要所有欄位都有舊裝）
- `node tests/inventory_test.cjs`：穿滿 8 欄、背包丟入物品、搖一搖、世界掉落，截圖在 `shots/`（需先 `node build.mjs`，並用 HTTP 服務 `game/`，例如 `cd game && python3 -m http.server 8099`；用 `CHROME_PATH` 指定瀏覽器）。截圖樣本放在 `screens/inventory/`。

## 已知限制
- 遊戲的資產（含物品圖）是外部檔案；Claude Artifact 單檔版不含圖，會退回欄位剪影。
- 材料、貨幣、任務物品（`mat_*`、`cur_*`、`quest_*`）已有圖，但目前遊戲內這些仍是計數值，沒有背包格子；之後做材料入包時直接用 `art` id 即可。
- 武器種類（劍／弓／杖…）目前只影響名稱與圖示，數值仍走 `staff` 欄位的詞綴。
