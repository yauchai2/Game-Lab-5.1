# tools/

- `item_cutout.py`：把 Figma 生成的物品圖（1024 方圖、深栗色 #1A0C0C 背景）去背並輸出 256／128 透明 PNG。
  用法：`python3 tools/item_cutout.py raw.png out_{s}.png`（`{s}` 會被換成 256 與 128；需要 Pillow、numpy、scipy）。
  做法：從四邊 flood fill 背景色（容差 26）→ 保留主體 → 只在 2px 邊緣依與背景色的距離做柔化 → 裁到主體並補 5% 邊距。

- `item_sheet_slice.py`：把「一張圖多件」的合圖（深栗色 #1A0C0C 背景，件與件之間留寬空白）自動分件、去背，輸出成單件 256／128 PNG。
  用法：`python3 tools/item_sheet_slice.py sheet.png id1,id2,id3 [--out game/assets/items] [--gap 22]`，id 依「由上到下、由左到右」對應。
  建議合圖排成**單排 5 件、每件獨立一欄**（實測 `--gap` 12–30 都穩定）；成對武器（雙刃）要畫成交叉連成一件。偵測件數與 id 數不符會中止並列出偵測框。
  每張合圖用 1536×1024；提示詞前綴沿用物品企劃 §1.8，加「ONE horizontal row, wide empty gaps」。
