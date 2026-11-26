#!/usr/bin/env python3
"""把「一張圖多件裝備」的合圖切成單件透明 PNG。
用法：python3 tools/item_sheet_slice.py sheet.png id1,id2,id3,... [--out game/assets/items] [--rows N]
- 合圖背景需為深栗色 #1A0C0C（與 item_cutout.py 相同），件與件之間要留空白。
- 以連通區塊自動分件（不依賴固定格線），再依「由上到下、由左到右」對應 id；件數不符會中止並列出偵測結果。
- 輸出 {out}/256/{id}.png 與 {out}/128/{id}.png。"""
import sys, os, argparse, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from item_cutout import cut, BG

def sheet_bg(a):
    b = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    return np.median(b, axis=0)

def find_items(a, bg, min_area_frac=0.004, gap=22):
    d = np.sqrt(((a - bg) ** 2).sum(2)); fg = d >= 10
    merged = ndi.binary_dilation(fg, iterations=gap)
    lab, n = ndi.label(merged)
    boxes = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        m = (lab[sl] == i) & fg[sl]
        if m.sum() < a.shape[0] * a.shape[1] * min_area_frac: continue
        boxes.append((sl, lab == i))
    return boxes

def order(boxes, rows=None):
    cy = [(b[0][0].start + b[0][0].stop) / 2 for b in boxes]
    h = np.median([b[0][0].stop - b[0][0].start for b in boxes])
    idx = sorted(range(len(boxes)), key=lambda i: cy[i]); out = []; row = []
    for i in idx:
        if row and cy[i] - cy[row[-1]] > h * 0.6: out.append(row); row = []
        row.append(i)
    if row: out.append(row)
    return [boxes[i] for r in out for i in sorted(r, key=lambda j: boxes[j][0][1].start)]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('ids'); ap.add_argument('--out', default='game/assets/items')
    ap.add_argument('--tmp', default='/tmp/item_slice'); ap.add_argument('--fill-holes', default='', help='逗號分隔的 id：封閉的暗色區域（兜帽內部、背心袖孔）保留為暗色，而不是挖空；環、鑰匙串等要挖空的不要列')
    ap.add_argument('--auto-gap', action='store_true', help='件數不符時自動加大 gap 重試'); ap.add_argument('--gap', type=int, default=22, help='相鄰多少像素內視為同一件（成對的雙刃等用較大值）')
    A = ap.parse_args(); ids = A.ids.split(',')
    a = np.asarray(Image.open(A.sheet).convert('RGB')).astype(float)
    bg = sheet_bg(a)
    boxes = order(find_items(a, bg, gap=A.gap))
    if len(boxes) != len(ids) and A.auto_gap:  # 逐步加大合併距離（成對物件如手套／靴子）
        for g in range(A.gap + 6, 121, 6):
            b = order(find_items(a, bg, gap=g))
            if len(b) == len(ids): boxes = b; print('auto gap', g); break
    if len(boxes) != len(ids):
        for k, b in enumerate(boxes): print(k, b[0][1].start, b[0][0].start, b[0][1].stop - b[0][1].start, b[0][0].stop - b[0][0].start)
        sys.exit(f'偵測到 {len(boxes)} 件，但給了 {len(ids)} 個 id')
    os.makedirs(A.tmp, exist_ok=True)
    for (sl, mask), id in zip(boxes, ids):
        pad = 12
        y0, y1 = max(0, sl[0].start - pad), min(a.shape[0], sl[0].stop + pad); x0, x1 = max(0, sl[1].start - pad), min(a.shape[1], sl[1].stop + pad)
        c = np.where(mask[y0:y1, x0:x1, None], a[y0:y1, x0:x1], bg).astype(np.uint8)
        t = os.path.join(A.tmp, id + '.png'); Image.fromarray(c).save(t)
        for s in (256, 128): os.makedirs(os.path.join(A.out, str(s)), exist_ok=True)
        cut(t, os.path.join(A.out, '{s}', id + '.png'), bg=bg, tol=9, soft_lo=5, soft_w=14, fill_holes=id in A.fill_holes.split(','))
        print('ok', id)
if __name__ == '__main__': main()
