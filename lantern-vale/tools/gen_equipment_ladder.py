#!/usr/bin/env python3
"""產生「完整裝備階梯」清單 data/equipment_ladder.{json,csv}（Lv1→終局，每 2–3 級一件）。
用法：python3 tools/gen_equipment_ladder.py   （從 lantern-vale/ 目錄執行）"""
import json, csv, os
R = [  # rank, tag, 名稱, reqLv, 倍率, 材質語言, 來源, 舊 T 階
 (1,'旅人',1,1.00,'素木・麻布・粗鐵','晨光草原 一般怪／寶箱','T1'),
 (2,'青藤',3,1.12,'青藤纏木・染麻・軟皮','晨光草原 精英／低語森林 前段',None),
 (3,'精鋼',5,1.25,'精鋼・鞣皮・粗毛呢','低語森林／霧潮沼澤 前段','T2'),
 (4,'銅燈',8,1.40,'黃銅燈芯・鉚釘皮・厚呢','霧潮沼澤／浮空遺跡',None),
 (5,'星銀',10,1.55,'星銀・月蛾絲・銀線布','霧潮沼澤 後段／雪原／櫻花','T3'),
 (6,'琉璃',13,1.72,'琉璃片・冰藍織物・霜皮',  '雪原／櫻花水都／叢林',None),
 (7,'秘光',16,1.90,'秘光晶・符紋皮・星砂布','火山前／珊瑚／藤蔓神廟','T4'),
 (8,'赤焰',19,2.10,'赤銅・熔紋甲・焰羽布','火山／風沙原／珊瑚',None),
 (9,'傳世',22,2.30,'傳世金・龍鱗皮・燈焰絲','蒼穹巨環谷／墓園／古樹林','T5'),
 (10,'月華',25,2.52,'月華銀・夜蛾絨・潮汐珠','電光都／金字塔／螢光沉淵',None),
 (11,'穹頂',27,2.75,'穹頂星鋼・極光皮・星環絲','星際前哨／紅楓／古堡','T6'),
 (12,'極光',30,3.10,'極光晶・星穹合金・虹彩織物','異星蜂巢／所有 Lv28+ 首領',None),
 (13,'星燈Ⅰ',30,3.50,'星燈金屬・淡金光暈','終局異界 Atlas T1–4／星穹塔 1–20 層',None),
 (14,'星燈Ⅱ',30,4.00,'星燈金屬・雙層光暈','Atlas T5–8／星穹塔 21–50 層',None),
 (15,'星燈Ⅲ',30,4.60,'星燈金屬・流光紋','Atlas T9–12／星穹塔 51–100 層／雙王',None),
 (16,'星燈Ⅳ',30,5.30,'星燈金屬・全息星紋','Atlas T13+／星穹塔 100+ 層／賽季首領',None),
]
W = [('sword','warden','劍',['短劍','長劍','騎士劍','聖劍']),('bow','ranger','弓',['獵弓','長弓','複合弓','星羽弓']),
     ('staff','mystic','杖',['短杖','手杖','長杖','法杖']),('blades','strider','雙刃',['短刃','雙匕','雙刃','影刃']),
     ('bo','monk','棍',['竹節棍','鐵箍棍','錫杖','禪杖'])]
O = [('shield','warden','盾',['圓盾','六角盾','紋章盾','塔盾']),('quiver','ranger','箭袋',['箭袋','箭筒','風羽箭筒','流星箭筒']),
     ('tome','mystic','咒冊',['咒冊','咒典','星圖冊','水晶球']),('beads','monk','念珠',['念珠','珠串','金念珠','天珠串'])]
ARM = [('heavy','warden','重甲',{'head':'重盔','body':'重鎧','hands':'護手','feet':'脛甲'}),
       ('light','ranger,strider','輕裝',{'head':'兜帽','body':'獵裝','hands':'皮手套','feet':'獵靴'}),
       ('robe','mystic,monk','法袍',{'head':'髮冠','body':'長袍','hands':'護腕','feet':'軟履'})]
SLOT_ZH = {'head':'頭','body':'身','hands':'手','feet':'腳'}
CZ = {'warden':'守燈','ranger':'林風','mystic':'餘燼','strider':'影行','monk':'禪燈'}
OLD = {1:1,3:2,5:3,7:4,9:5,11:6}
out = []
def add(id, name, slot, cls, rank, kind, note=''):
    r = R[rank-1]
    out.append(dict(id=id, name=name, slot=slot, cls=cls, rank=rank, tier_name=r[1], reqLv=r[2], mult=r[3], kind=kind,
                    source=r[5], art='existing' if (rank in OLD and kind=='ladder') else ('recolor' if kind=='ladder' else 'new'), note=note))
for rk in range(1, 17):
    stage = min(3, (rk-1)*4//16)
    for key, cls, zh, names in W:
        add(f'wpn_{key}_r{rk:02d}', R[rk-1][1]+names[stage], 'weapon', cls, rk, 'ladder')
    for key, cls, zh, names in O:
        add(f'off_{key}_r{rk:02d}', R[rk-1][1]+names[stage], 'offhand', cls, rk, 'ladder')
    for wk, cls, wzh, slots in ARM:
        for s, n in slots.items():
            add(f'arm_{wk}_{s}_r{rk:02d}', R[rk-1][1]+n, s, cls, rk, 'ladder')
    for nm, slot, nouns in (('clk','cloak',['斗篷','披風','大氅','披風']),('chm','charm',['護符','墜飾','吊墜','護符']),('rlc','relic',['聖物','信物','遺物','聖物'])):
        add(f'{nm}_r{rk:02d}', R[rk-1][1]+nouns[stage], slot, 'all', rk, 'ladder')
# 島嶼套裝：20 島 × 8 欄（階級依島嶼等級）
ISL = [('晨光',1),('低語',5),('霧潮',10),('霜冬',15),('燼煙',20),('古樹',25),('浮空',12),('珊瑚',18),('電光',24),('櫻花',14),
       ('蒼穹',22),('紅楓',28),('風沙',18),('金字塔',26),('藤蔓',16),('墓園',22),('古堡',28),('螢光',24),('星艦',27),('蜂巢',30)]
SL = [('head','盔'),('body','衣'),('hands','手套'),('feet','靴'),('weapon','兵器'),('cloak','披風'),('charm','護符'),('relic','信物')]
def rank_of(lv): return max(i+1 for i,r in enumerate(R[:12]) if r[2] <= lv)
for i,(n,lv) in enumerate(ISL, 1):
    rk = rank_of(lv)
    for s, zh in SL:
        d = dict(id=f'set_i{i:02d}_{s}', name=f'{n}之{zh}', slot=s, cls='all(兵器依職業外觀)' if s=='weapon' else 'all', rank=rk,
                 tier_name=R[rk-1][1], reqLv=max(1,lv-1), mult=round(R[rk-1][3]*1.08,2), kind='island_set', source=f'第 {i:02d} 島 {n}（首領／精英）', art='new',
                 note='2/4/6 件套裝加成；兵器欄依職業各一款外觀')
        out.append(d)
# 職業傳奇／神話
for key, cls, zh, names in W:
    for k, (lv, rk, tag) in enumerate([(16,7,'傳奇'),(25,10,'傳奇'),(30,12,'傳奇'),(30,16,'神話')]):
        out.append(dict(id=f'leg_{key}_{k+1}', name=f'{CZ[cls]}{tag}{zh}#{k+1}', slot='weapon', cls=cls, rank=rk, tier_name=R[rk-1][1], reqLv=lv,
            mult=round(R[rk-1][3]*1.2,2), kind='legendary' if tag=='傳奇' else 'mythic', source='首領／世界王／賽季', art='new', note='名稱待命名；改變技能行為的專屬詞綴'))
for s,zh in SL:
    for k in range(2):
        out.append(dict(id=f'myth_{s}_{k+1}', name=f'神話{zh}#{k+1}', slot=s, cls='all', rank=16, tier_name='星燈Ⅳ', reqLv=30, mult=6.0, kind='mythic',
            source='星穹塔 100+ 層／賽季首領', art='new', note='名稱待命名'))
os.makedirs('data', exist_ok=True)
json.dump(dict(ranks=[dict(rank=r[0],tag=r[1],reqLv=r[2],mult=r[3],material=r[4],source=r[5],legacyTier=r[6]) for r in R], items=out), open('data/equipment_ladder.json','w'), ensure_ascii=False, indent=1)
with open('data/equipment_ladder.csv','w',newline='',encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
# 遊戲用的精簡檔：階級表（含數值等效階 power）與裝備目錄（只含階梯款）
POWER = [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.6,7.4,8.3,9.3,10.4]  # 舊 T1–T6 為 1..6，新階內插／外推；詞綴與基底數值沿用舊公式 f(power)
COLORS = ['#d8d2c5','#b5d98f','#8ad896','#6fd9c0','#7fc4ff','#8fb0ff','#c88cff','#ff8fa0','#ffd85a','#ffc070','#ff8a50','#ff6a8a','#ffe27a','#ffd04a','#ffb020','#fff2b0']
ranks = [dict(tier=r[0], tag=(('T%d' % ((r[0]+1)//2)) if r[0] % 2 else 'T%d+' % (r[0]//2)) if r[0] <= 12 else 'E%d' % (r[0]-12), name=r[1]+'階', reqLevel=r[2], color=COLORS[i], mult=r[3], power=POWER[i]) for i, r in enumerate(R)]
json.dump(ranks, open('data/equipment_ranks.json','w'), ensure_ascii=False, separators=(',',':'))
cat = [dict(id=o['id'], name=o['name'], slot=o['slot'], rank=o['rank'], cls=o['cls']) for o in out if o['kind']=='ladder' and o['slot']!='offhand']
json.dump(cat, open('data/equipment_catalog.json','w'), ensure_ascii=False, separators=(',',':'))
import collections
print(len(out), collections.Counter(o['kind'] for o in out))
