# tools/

- `item_cutout.py`：把 Figma 生成的物品圖（1024 方圖、深栗色 #1A0C0C 背景）去背並輸出 256／128 透明 PNG。
  用法：`python3 tools/item_cutout.py raw.png out_{s}.png`（`{s}` 會被換成 256 與 128；需要 Pillow、numpy、scipy）。
  做法：從四邊 flood fill 背景色（容差 26）→ 保留主體 → 只在 2px 邊緣依與背景色的距離做柔化 → 裁到主體並補 5% 邊距。
