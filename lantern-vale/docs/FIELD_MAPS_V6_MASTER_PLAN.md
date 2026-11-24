# 《燈谷行 Lantern Vale》20 張野外地圖 · v6 精細美術平面圖與場景構築企劃書

> **全新互動式 20 圖工程平面圖集（獨立新檔，不覆蓋受保護之 v5 平面圖）**：[field_maps_v6_master_floorplan.html](file:///Users/alanchan/Desktop/Game-Lab/Game-Lab-5.1/development/lantern-vale/docs/field_maps_v6_master_floorplan.html)

---

## 一、深度反省：為何前次嘗試顯得突兀凌亂？

前次急於一次掛上 20 張地圖時，犯了三個致命的關卡設計錯誤：
1. **無視既有平面圖與 POI 座標**：把整組套裝硬塞在出生點附近 `(-7.8, -6.8)`，既打斷出生區的開闊視野，又與地圖原本規劃的河流、山崖、檢查點、王區脫節。
2. **沒有區分「水域套裝／崖壁套裝／平原套裝」的地形條件**：例如把帶有溪流橋梁、海怪沉船或山崖的套裝直接蓋在普通平地上，造成空間邏輯違和。
3. **重複堆疊舊地標＋新套裝**：原地圖的 `buildBlueprintLandmarks` 與 `buildScenicLandmarks` 未與新套裝整合分工，導致兩種美術風格打架、畫面擁擠。

---

## 二、v6 精細場景設計六大鐵則（致敬卡比開闊遠景 × Palmov 精雕微縮景觀）

1. **只改野外地圖，完全不動兩大主城**：燈谷鎮與海風港鎮保持現有溫馨版本。
2. **嚴格對齊既有 v5 拓撲平面圖的每個 POI 座標 `(u, v)`**：
   - 不再在出生點附近亂塞任何大型套裝；**出生點半徑 18m 強制設為「禁建淨空視線區」**，只留清朗草地、石板路與柔和遠景。
   - 每個 Palmov 成品套裝都是**取代並升級該地圖平面圖上原本就規劃好的指定 POI**（例如 `#01 晨光草原` 東北 `(0.84, 0.27)` 的「巨型茶壺丘」就是對應 `Autumn / tea house autumn forest`；`#03 霧潮沼澤` 中央海灣 `(0.50, 0.54)` 的「海怪觸手沉船」就是對應 `Sea / sea monster attack`；`#08 珊瑚潮汐灣` 西灣 `(0.24, 0.43)` 的「帆船瞭望崖堡」就是對應 `Island / mountain ship`！）。
3. **地形原生契合原則（Terrain-First Placement）**：
   - **水域套裝**（海怪沉船、高腳漁村、海上鳥居、燈塔碼頭、沉船崖堡）**只擺在海灣／淺灘／湖心座標**，底座與水面高度精準切齊。
   - **高崖套裝**（茶壺丘、纜車雪山、藍冰尖塔、五重古塔、三層飛瀑燈塔、天守水宮）**只擺在平面圖的高台山丘座標**，並於該座標自動將地形平滑墊平（Flatten Pad）承接底座，絕不半邊懸空。
   - **跨溪橋梁套裝**（溪畔木橋、朱紅大拱橋、峽谷火車橋）**精準旋轉對齊該張地圖溪流軸線**，讓玩家真正能從橋上走過去！
4. **卡比式三層空間景深（Foreground → Midground → Vista Silhouette）**：
   - **前景**（南／東南）：開闊平坦的戰鬥與騎乘平原，僅點綴低矮草花與稀疏樹木，絕不擋住斜角鏡頭視線。
   - **中景**（中央主軸）：橋梁、淺溪、營火檢查點與王區競技場，形成清晰探索動線。
   - **遠景剪影**（北／西北／東北高地）：巨型地標（茶壺丘、藍冰山、金字塔、五重塔、天守宮、熱氣球谷、太空站）作為遠方地平線錨點，讓玩家一進圖就產生「我想過去看看！」的探索慾。
5. **主題純淨度審查（Zero Out-of-Place Props）**：
   - 嚴格過濾每個 Palmov 預製件內的雜物：日式水都絕不出現電線桿／現代火車；哥德墓園與星際前哨站絕不混入普通鄉村紅帳篷或綠草樹；沙漠地圖絕不出現溫帶木屋。
6. **一張一張精雕＋實機多角度截圖驗收（Pilot-First Workflow）**：
   - **絕不再一次盲推 20 張！** 先以 **#01 晨光草原** 作為「黃金樣板圖（Gold Standard Pilot）」，完成地形底座平整、4 個指定 POI 精準落地、出生點與各 POI 實機多角度截圖確認達到 10/10 美感後，再依相同高標準逐張推進其餘地圖。

---

## 三、20 張野外地圖 · 全 80 處 POI 精準配對總表

> 下表所有 `(u, v)` 座標皆可直接於互動平面圖 [field_maps_v6_master_floorplan.html](file:///Users/alanchan/Desktop/Game-Lab/Game-Lab-5.1/development/lantern-vale/docs/field_maps_v6_master_floorplan.html) 視覺化對照，並與 `src/field_blueprints.js` 1:1 對應。

| # 地圖 | 拓撲類型 | POI 1（主奇觀／王區） | POI 2（高地／秘境） | POI 3（水域／中段特色） | POI 4（副本入口 ⛩） |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **01 晨光草原** | 大空曠 | `(0.84,0.27)` 🫖 巨型茶壺丘<br>`Autumn / tea house autumn forest` | `(0.16,0.31)` 💎 西北瀑布崖<br>`Nature / forest waterfall` | `(0.46,0.54)` 🌉 溪畔木橋農舍<br>`Nature / bridge over river` | `(0.50,0.16)` ⛩ 草原洞窟<br>`Nature / mountain forest` |
| **02 低語森林** | 立體迷宮 | `(0.80,0.70)` 👑 古墓守護獸<br>`Autumn / houses autumn forest` | `(0.15,0.80)` 🏚 白樺封板廢屋<br>`Autumn / abandoned house` | `(0.30,0.46)` ⛺ 白樺林營地<br>`Nature / camping birch forest` | `(0.86,0.23)` 💎 樹冠瀑布秘庫<br>`Nature / forest waterfall` |
| **03 霧潮沼澤** | 立體迷宮 | `(0.50,0.54)` 🐙 海怪觸手沉船<br>`Sea / sea monster attack`（海域） | `(0.84,0.34)` 🏘 高腳吊橋村<br>`Island / fishing Island`（淺灘） | `(0.24,0.46)` 🗿 巫覡迷霧島<br>`Island / shamanic island` | `(0.70,0.19)` ⛩ 沼澤岩洞遺跡<br>`Sea / secret Island` |
| **04 霜冬雪原** | 狹長線性 | `(0.85,0.20)` ⛩ 藍冰水晶巨山<br>`Winter / crystal mountain` | `(0.21,0.22)` 🚡 纜車滑雪山頂<br>`Winter / ski resort` | `(0.15,0.52)` 🏔 裂谷雪屋橋<br>`Winter / river winter house` | `(0.56,0.68)` 🏘 雪國冬村廣場<br>`Winter / winter town` |
| **05 燼煙火岩區** | 大環形 | `(0.51,0.53)` ⚔ 中央熔岩演武島<br>`Western / indian reservation canyon` | `(0.18,0.32)` ⛏ 西崖礦車棧橋<br>`Western / coal mine` | `(0.84,0.78)` 🌴 紅岩瀑布綠洲<br>`Western / waterfall desert` | `(0.82,0.18)` ⛩ 燼岩熔爐峽橋<br>`Western / bridge over water gorge` |
| **06 古樹林** | 大環形 | `(0.52,0.52)` 👑 世界樹核廣場<br>`Nature / mountain forest` | `(0.18,0.28)` 🏯 五重古塔峰<br>`Japanese / old palace forest` | `(0.86,0.50)` ♨ 三疊靈泉梯田<br>`Autumn / autumn hot springs` | `(0.78,0.84)` ⛺ 古林探索營地<br>`Western / indian reservation forest` |
| **07 浮空遺跡群** | 開闊跳島 | `(0.74,0.56)` 🗼 飛瀑燈塔巨崖<br>`Island / three level island` | `(0.30,0.42)` 🪨 古代巨石環<br>`Sea / ancient artifacts` | `(0.90,0.33)` 💎 東方飛瀑孤柱<br>`Island / waterfall island` | `(0.54,0.17)` ⛩ 斷柱水道星穹塔<br>`Desert / roman ruins` |
| **08 珊瑚潮汐灣** | 大空曠 | `(0.24,0.43)` 🏴‍☠️ 帆船瞭望崖堡<br>`Island / mountain ship`（西灣） | `(0.16,0.19)` 💎 骷髏秘寶礁<br>`Island / treasure Island` | `(0.78,0.68)` ⛱ 椰林釣魚灘<br>`Nature / beach` | `(0.50,0.20)` ⛩ 潮汐海蝕石門<br>`Sea / mountain arch` |
| **09 沉沒電光都** | 開闊跳島 | `(0.66,0.54)` 👑 海港天台廣場<br>`Sea / pirate seaport` | `(0.84,0.72)` ⛺ 水上商港市集<br>`Sea / trade port` | `(0.56,0.28)` 💎 瀑拱秘境島<br>`Sea / mysterious place` | `(0.17,0.18)` ⛩ 紅白燈塔變電港<br>`Sea / lighthouse pier` |
| **10 櫻花水都** | 狹長線性 | `(0.50,0.53)` 🌉 大弧朱紅橋<br>`Japanese / autumn japan`（跨溪） | `(0.18,0.74)` 🏯 海上鳥居孤島<br>`Japanese / sacred islands`（海域） | `(0.75,0.26)` 🎋 九曲竹林茶屋<br>`Japanese / japanese sanctuary park` | `(0.19,0.22)` ⛩ 櫻花天守水宮<br>`Japanese / imperial palace` |
| **11 蒼穹巨環谷** | 狹長線性 | `(0.56,0.34)` 🌀 巨環熱氣球谷<br>`Nature / air balloons` | `(0.28,0.42)` 🚂 峽谷蒸汽火車橋<br>`Western / bridge over water gorge` | `(0.82,0.72)` ⛺ 雪峰湖畔露營<br>`Autumn / autumn mountain camping` | `(0.85,0.19)` ⛩ 雪峰瀑布聖殿<br>`Island / waterfall island` |
| **12 紅楓工坊谷** | 大空曠 | `(0.66,0.48)` 👑 楓林湖畔廣場<br>`Autumn / houses autumn forest` | `(0.16,0.74)` 🐑 風車穀倉牧場<br>`Autumn / autumn harvest` | `(0.24,0.25)` ♨ 三疊秋楓溫泉<br>`Autumn / autumn hot springs` | `(0.84,0.20)` ⛩ 紅楓鍛造爐<br>`Autumn / autumn atmosphere forest` |
| **13 黃金風沙原** | 大空曠 | `(0.78,0.32)` 🕌 紫頂風沙古堡<br>`Desert / arab castle` | `(0.28,0.34)` 🌴 翡翠棕櫚綠洲<br>`Desert / city desert` | `(0.16,0.68)` 🗼 沙海指引燈塔<br>`Desert / lighthouse desert` | `(0.50,0.16)` ⛩ 風沙綠洲神龕<br>`Desert / farming desert` |
| **14 太陽金字塔** | 大環形 | `(0.50,0.48)` 👑 太陽雙金字塔<br>`Desert / desert pyramids` | `(0.20,0.36)` 🏛 太陽神廟祭台<br>`Desert / temple deserts` | `(0.80,0.36)` 🏛 紅頂羅馬神殿<br>`Desert / roman ruins` | `(0.50,0.16)` ⛩ 法老岩山秘陵<br>`Desert / settlement desert` |
| **15 失落藤蔓神廟** | 立體迷宮 | `(0.50,0.52)` 👑 叢林瀑布神廟<br>`Desert / tropical ruins` | `(0.82,0.32)` 🗿 秘林巨石島<br>`Island / stone island` | `(0.20,0.36)` 💎 棕櫚沙洲群<br>`Desert / desert islands` | `(0.50,0.16)` ⛩ 古藤高崖地宮<br>`Island / adventure island` |
| **16 幽霧哥德墓園** | 立體迷宮 | `(0.50,0.50)` 👑 哥德教堂鬼屋<br>`Autumn / cemetery haunted house` | `(0.20,0.34)` 🏚 枯林荒廢木屋<br>`Autumn / abandoned house` | `(0.80,0.68)` ⛲ 幽霧秋園石池<br>`Autumn / autumn park` | `(0.50,0.16)` ⛩ 亡靈地下墓穴<br>`Sea / secret Island` |
| **17 深淵哥德古堡** | 狹長線性 | `(0.50,0.22)` 👑 血月古堡王座<br>`Autumn / cemetery haunted house` | `(0.50,0.54)` 🌉 深淵峽谷斷橋<br>`Western / bridge over water gorge` | `(0.24,0.68)` 🏚 守墓人廢屋<br>`Autumn / abandoned house` | `(0.78,0.34)` 🗿 血月石崖洞<br>`Sea / secret Island` |
| **18 深海螢光沉淵** | 開闊跳島 | `(0.54,0.62)` 👑 深淵螢光巨蛸<br>`Sea / sea monster attack`（深海） | `(0.80,0.34)` ⚓ 沉沒船骸礁<br>`Sea / ship Island` | `(0.78,0.76)` 🪨 海蝕石拱門<br>`Sea / mountain arch` | `(0.24,0.22)` ⛩ 亞特蘭提斯晶殿<br>`Winter / crystal mountain` |
| **19 星際白銀前哨** | 大空曠 | `(0.50,0.50)` 👑 軌道太空核心站<br>`Space / space station` | `(0.20,0.34)` 🚀 太空梭發射台<br>`Space / space shuttle launch` | `(0.80,0.34)` 🛸 星艦停機坪<br>`Space / spaceships station` | `(0.50,0.16)` ⛩ 星艦反應爐<br>`Space / futuristics station` |
| **20 異星蜂巢裂谷** | 大環形 | `(0.50,0.50)` 👑 異星奇幻母巢<br>`Space / fantastic planet` | `(0.18,0.38)` 🛸 墜毀飛碟殘骸<br>`Space / ufo crash` | `(0.82,0.38)` ☄️ 外星巨隕石坑<br>`Space / planet craters` | `(0.50,0.16)` ⛩ 火星母巢前哨<br>`Space / colonization mars` |

---

## 四、單張精雕施工流程（Pilot-First，絕不盲目批次堆疊）

1. **Step 1（黃金樣板圖 `#01 晨光草原`）**：
   - 在 `world.js` 加入 **POI 地形平整墊台（`flattenPad(u, v, radius)`）**，讓大型套裝底座 100% 貼合地形、絕不半邊懸空。
   - 僅匯出 `#01 晨光草原` 所需的 3 組精準套裝（`teapot_hill`、`forest_waterfall`、`river_bridge_cottage`），並替換掉 `#01` 內原本重複的舊地標與雜亂方塊。
   - **從 4 個實機機位截圖驗收**（出生點遠景、溪橋中段、茶壺丘近景、瀑布崖近景），確認美感、比例、動線與淨空感全部達標後才進入下一張！
2. **Step 2–5（依生態系每次精雕 2–3 張）**：
   - 批次 A：`#03 霧潮沼澤`（海怪沉船＋高腳漁村）＋ `#08 珊瑚潮汐灣`（沉船崖堡＋海蝕拱門）
   - 批次 B：`#04 霜冬雪原`（藍冰山＋滑雪纜車）＋ `#10 櫻花水都`（朱紅拱橋＋天守水宮＋海上鳥居）
   - 批次 C：`#12 紅楓工坊谷` ＋ `#13–14 沙漠金字塔雙圖` ＋ `#16 哥德墓園`
   - 批次 D：其餘高階秘境（`#02 / #05 / #06 / #07 / #09 / #11 / #15 / #17 / #18 / #19 / #20`）
