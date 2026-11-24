# 《燈谷行 Lantern Vale》20 張野外地圖 · 100% 實查版「不合理體檢與合理資產替換總表」

> 本報告 **零臆測**，每一條結論皆直接驗證自：
> 1. `src/field_blueprints.js` 實機地形網格（`DEEP / SHALLOW / LOWLAND / PLATEAU / CLIFF / WALL`）
> 2. `src/frontier.js` L175–533 現行所有 20 張地圖實裝的 3D 模型
> 3. `Low Poly Locations Ultimate Pack 1.0.0.unitypackage` 逐一解包核對每個預製件內部實際包含的建築 FBX 與違合現代物件

---

## 一、全地圖共通 4 大「必須先修」的不合理根源

1. **🔴 `world.js` `buildScenicLandmarks()` 不分生態系亂灑沙灘遮陽傘、假方塊瀑布與八角石池**
   - 現行程式碼會在雪原、火山、哥德墓園甚至星際太空站隨機塞進彩色沙灘傘與草地假瀑布。
   - **修正**：改為**嚴格生態系白名單制（Biome-Gated）**，只生成屬於該生態系的自然裝飾。
2. **🔴 4 處真實地形／重疊 Bug（已由程式實測確認）**
   - `#02 低語森林` `(0.80, 0.70)` 古墓守護獸 → 座標落在 **`[WALL]` 實心岩壁**。
   - `#09 沉沒電光都` `(0.66, 0.54)` 彩柱天台守護獸 → 座標落在 **`[WALL]` 實心岩壁**。
   - `#12 紅楓工坊谷` `(0.76, 0.74)` 熔渠遺產碑 → 座標淹沒在 **`[DEEP]` 深海**。
   - `#17 深淵哥德古堡` Boss `(0.50, 0.22)` 與副本 `(0.50, 0.16)` → 同在北崖僅距 18m 互撞。
3. **🔴 解包實查揪出的 4 個「Palmov 預製件隱藏陷阱」（必須在匯出時自動剔除或改選正確檔名）**
   - `Low Poly Autumn/abandoned house` 內藏一輛現代廢棄藍色轎車 **`rotten sedan car blue`** → 匯出時必須剔除！
   - `Low Poly Autumn/autumn harvest` 內藏一輛現代綠色皮卡車 **`car SUVs pickups lights green`** → 匯出時必須剔除！
   - `Low Poly Japanese/sacred islands` 其實是**雪地冬景**（含 `ice floe`、`japanese temple winter`），真正的海上紅塔孤島檔名是 **`Low Poly Japanese/japanes island`**（作者拼字少了 e）！
   - `Low poly Island/three level island` **沒有燈塔**（只有木屋與瀑布），真正的「三層飛瀑燈塔巨崖」檔名是 **`Low poly Island/waterfall island`**（內含 `lighthouse 2`＋`waterfall 9/10`）！
4. **🟢 保留既有優秀實模，絕不為換而換**
   - 經逐行檢查 `frontier.js` L403–532：`#01` 動態旋轉風車農莊、`#11` 卡比斜嵌碧藍巨環、`#13–14` 埃及金字塔與獅身人面像（4351）、`#15` 叢林石像古牆（4352）、`#18` 深海飄浮烏賊與海殿（4123）、`#19` 星艦登陸平台與飛艇（4123）、`#20` 紫紅異星母巢塔（4123/4384）**原本就已經有專屬實模**，不應盲目覆蓋，只需清除 `world.js` 違合雜物並僅針對真正簡陋／不搭嘎的 POI 做精準替換！

---

## 二、20 張野外地圖 · 逐張 100% 實查「現行模型 → 合理替換資產」清單

| # 地圖 | 現行不合理／簡陋處（真實程式碼） | 🟢 保留不動 | ✅ 實查確認之合理替換資產（精準檔名＋內部主建築核對） |
| :--- | :--- | :--- | :--- |
| **01 晨光草原** | • `teapot_hill (0.84,0.27)` 用原始球體＋甜甜圈硬拼茶壺<br>• `waterfall_chest (0.16,0.31)` `[CLIFF]` 無瀑布崖景觀 | 西南動態旋轉風車農莊、開闊草地 | • `teapot_hill` → **`Low Poly Autumn/tea house autumn forest`**（實查含 `teapot house`＋紅白蘑菇）<br>• `waterfall_chest` → **`Low Poly Nature/forest waterfall`**（瀑布岩壁＋松林） |
| **02 低語森林** | • `forest_tomb (0.80,0.70)` 埋在 **`[WALL]`**<br>• `canopy_vault (0.86,0.23)` 竟放**農莊風車 (`windmill`)**<br>• `birch_cabin (0.15,0.80)` 僅普通小屋 | 起點巨菇、迷宮林道 | • `forest_tomb` → **鑿平空地**＋取 **`Low Poly Autumn/cemetery haunted house`** 之 `halloween church`＋鐵柵<br>• `canopy_vault` → 移除風車，改 **`Low Poly Nature/forest waterfall`**<br>• `birch_cabin` → **`Low Poly Autumn/abandoned house`**（**剔除 `rotten sedan car blue`**！） |
| **03 霧潮沼澤** | • `kraken_wreck (0.50,0.54)` 用 4 根原始圓環硬拼章魚腳<br>• `stilt_village (0.84,0.34)` 僅單棟海灘屋無吊橋村 | 7 座繩橋、北礁螢光巨菇群 | • `kraken_wreck` → **`Low Poly Sea/sea monster attack`**（實查含斷船＋吸盤巨觸手）<br>• `stilt_village` → **`Low poly Island/fishing Island`**（實查含 `fishing house red/yellow`＋`suspension bridge`＋漁船） |
| **04 霜冬雪原** | • `cable_summit (0.21,0.22)` 用 3 根紅棒拼假旗門<br>• `ice_spires (0.85,0.20)` 4 根零散小晶柱<br>• `snow_cabin (0.15,0.52)` 單棟孤屋 | 南坡雪營起點、冰湖滑道 | • `cable_summit` → **`Low Poly Winter/ski resort`**（實查含 `chairlift×7`＋`ski house`）<br>• `ice_spires` → **`Low Poly Winter/crystal mountain`**（實查含大量 `crystal stones group`）<br>• `snow_cabin` → **`Low Poly Winter/river winter house`**（河畔雪屋與雪松） |
| **05 燼煙火岩區** | • `mine_trestle (0.18,0.32)` 僅 2 台孤礦車停平地（無礦洞棧橋）<br>• `redrock_oasis (0.84,0.78)` 僅 3 棵椰樹（無紅岩瀑布） | 中央熔岩演武島火晶、東北燼岩熔爐 | • `mine_trestle` → **`Low Poly Western/coal mine`**（實查含 `canyon mountain 5`＋`coal tower`＋高架木軌道＋礦車）<br>• `redrock_oasis` → **`Low Poly Western/waterfall desert`**（實查含 `canyon mountain 6`＋`waterfall 14/15`） |
| **06 古樹林** | • `ancient_pagoda (0.18,0.28)` 竟用**農莊風車 (`windmill`)** 充當五重塔！<br>• `spirit_terrace (0.86,0.50)` 僅 2 朵蘑菇充溫泉<br>• `world_tree_core (0.52,0.52)` 圓柱＋3 顆球拼假大樹 | 環形靈泉道、東南林營 | • `ancient_pagoda` → **`Low Poly Japanese/japanese sanctuary park`**（實查含 `japanes temple 2` 五重古塔＋`japanese gate`）<br>• `spirit_terrace` → **`Low Poly Autumn/autumn hot springs`**（實查含三疊石造熱泉＋白粉睡蓮）<br>• `world_tree_core` → **`Low Poly Nature/mountain forest`** 巨木群圍繞古石環 |
| **07 浮空遺跡群** | • `cliff_lighthouse (0.74,0.56)` 僅孤立燈塔無飛瀑懸崖<br>• `star_aqueduct (0.54,0.17)` 僅 2 塊石陣 | 南島碼頭、雲海跳島孤柱 | • `cliff_lighthouse` → **`Low poly Island/waterfall island`**（實查含 `lighthouse 2`＋`waterfall 9/10` 飛瀑燈塔巨崖！）<br>• `star_aqueduct` → **`Low Poly Desert/roman ruins`**（石階柱廊古殿） |
| **08 珊瑚潮汐灣** | • `pirate_fort (0.24,0.43)` 僅獨立燈塔與船並排<br>• 北岸雙瀑海蝕洞口較單調 | 淺海瀉湖王區、東南椰林金沙灘 | • `pirate_fort` → **`Low poly Island/mountain ship`**（實查含 `destroyed ship 5`＋`mountain 4`＋`observation tower`）<br>• 北岸洞口 → **`Low Poly Sea/mountain arch`**（天然海蝕石拱門） |
| **09 沉沒電光都** | • `stilt_plaza (0.66,0.54)` 埋在 **`[WALL]`** 且用熱帶海灘屋<br>• `market_pier (0.84,0.72)` 亦用海灘草屋 | 電光藍晶柱、淹水運河動線 | • `stilt_plaza` → **鑿平高台**＋**`Low Poly Sea/trade port`**（**剔除微小物食物雜點**，保留彩頂港屋＋木碼頭）<br>• `market_pier` → **`Low Poly Sea/pirate seaport`**（**剔除食物酒杯雜點**，保留木棧市集）<br>• `tesla_tower` 塔體 → **`Low Poly Sea/lighthouse pier`** |
| **10 櫻花水都** | • 4 處 POI 全部錯用熱帶 **`island_house`** 草屋充當日式建築！ | 東南起點朱紅鳥居與櫻花樹、S 型錦鯉溪 | • `sakura_shrine (0.19,0.22)` → **`Low Poly Japanese/imperial palace`**（實查含 `imperial palace 1/2`＋`imperia gate`）<br>• `sakura_bridge (0.50,0.53)` → **`Low Poly Japanese/autumn japan`**（實查含 `japanese bridge 2` 大弧朱紅橋＋`torii gate 2`）<br>• `sea_torii_island (0.18,0.74)` → **`Low Poly Japanese/japanes island`**（實查含 `japanes temple` 紅塔＋`torii gate 5`＋`japanese boat`！）<br>• `tea_house (0.75,0.26)` → **`Low Poly Japanese/japanese hot spring`**（實查含 `japanese gazebo 1/2`＋`japanese bridge`＋`japanese gate 2`） |
| **11 蒼穹巨環谷** | • `canyon_train (0.28,0.42)` 僅 3 台礦車放草地（無火車無橋）<br>• `alpine_camp (0.82,0.72)` 僅普通單屋 | 標誌性卡比斜嵌碧藍巨環 (`mega_sky_ring`)、東北雪塔 | • `canyon_train` → **`Low Poly Western/bridge over water gorge`**（實查含藍色蒸汽火車頭＋峽谷高架橋）<br>• `alpine_camp` → **`Low Poly Autumn/autumn mountain camping`**（湖畔露營＋雪峰背景） |
| **12 紅楓工坊谷** | • `lava_channel (0.76,0.74)` 淹進 **`[DEEP]`** 深海<br>• `maple_onsen (0.24,0.25)` 沒水池只放木屋＋樹 | 旋轉風車、東北紅楓鍛造爐與鍛造廣場 | • `lava_channel` → **移至陸緣 `(0.74,0.66)`**<br>• `maple_onsen` → **`Low Poly Autumn/autumn hot springs`**（三疊石造溫泉池）<br>• `sheep_barn` 旁小屋 → **`Low Poly Autumn/autumn harvest`**（**剔除現代綠皮卡車**，保留紅穀倉與南瓜田） |
| **13 黃金風沙原** | 已有 4351 埃及民居／方尖碑／獅身人面像，僅綠洲缺水景、東北略空 | 全套 4351 埃及實模與滑沙開闊感 | • `(0.28,0.34)` 綠洲補 **`Low Poly Desert/desert islands`**（棕櫚沙洲）<br>• 東北 `(0.78,0.30)` 補 **`Low Poly Desert/arab castle`**（紫頂古城，豐富遠景剪影） |
| **14 太陽金字塔** | 已有 4351 巨型金字塔／獅身人面像／方尖碑／石棺，**已經非常完整** | **全數保留 4351 埃及奇觀** | • 僅清除 `world.js` 跨生態系違合雜物（G1），必要時於西環空位補 1 座 **`Low Poly Desert/temple deserts`**（胡狼神像柱廊） |
| **15 失落藤蔓神廟** | 已有 4352 叢林古牆／石像／石柱，但中央缺乏「神廟主體」感 | 4352 叢林石像／石柱／石棧道 | • `(0.50,0.52)` 中央神廟主體補強 **`Low Poly Desert/tropical ruins`**（瀑布石階古廟） |
| **16 幽霧哥德墓園** | 現行直接拿燈谷鎮的 **`bell_tower` 染紫** 充當哥德教堂，重複感強且受海灘傘污染 | 紫晶柱、燃燒火炬、提燈機制 | • 清除 `world.js` 違合雜物（G1）<br>• `(0.50,0.50)` 移除染紫鎮鐘樓，換 **`Low Poly Autumn/cemetery haunted house`**（實查含 `halloween church`＋`halloween house`＋鐵柵＋南瓜蝙蝠） |
| **17 深淵哥德古堡** | **🔴 Boss `(0.50,0.22)` 與副本 `(0.50,0.16)` 過近重疊**；亦用染紫 `bell_tower` 充古堡 | 骷髏祭壇、紫晶柱、火炬 | • **合併北崖為單一古堡群**，用 `cemetery haunted house` 主樓取代染紫鎮鐘樓；中段峽谷補石木橋（不放火車） |
| **18 深海螢光沉淵** | 已有 4123 深海飄浮巨型烏賊、發光海菇、亞特蘭提斯海殿與深海塔，**極度契合！** | **全數保留 4123 深海異域實模** | • **不硬換海盜船！** 僅清除 `world.js` 違合草木雜物（G1），確保深海螢光氛圍純粹 |
| **19 星際白銀前哨** | 已有 4123 星艦登陸平台、飄浮太空飛艇、量子反應爐，**極度契合！** | **全數保留 4123 科幻實模** | • 嚴格清除 `world.js` 違合草木雜物（G1）；僅於空曠西北角 `(0.22,0.34)` 選配 **`Low Poly Space/space shuttle launch`**（火箭發射台）強化基地感 |
| **20 異星蜂巢裂谷** | 已有 4123/4384 巨型紫紅異星母巢塔、共鳴紫晶、墜落飛艇，**極度契合！** | **全數保留 4123/4384 異星實模** | • 嚴格清除 `world.js` 違合草木雜物（G1）；僅於西環空位 `(0.18,0.44)` 選配 **`Low Poly Space/fantastic planet`** 的外星巨蛋／異星菌群點綴 |

---

## 三、20 張野外地圖專屬「巨型 Boss（2.2–2.8× 體型）× 大型地標」實查配對表

> 已實查 `/Users/alanchan/Desktop/Game-Lab/temporary/assets/monster/` 全部 8 套怪物資源包＋現行 `game/assets/monsters/` 13 隻實模，為每一張地圖的 Boss 競技場配對 **100% 貼合生態系、零重複感、體型具壓迫感** 的專屬巨型 Boss，並確保座落於開闊可走平地／廣場（絕不卡牆）：

| # 地圖 | Boss 座標與地形 | 專屬巨型 Boss 稱號 | 實查對應資產來源（精準檔名） | 搭配周邊大型地標 |
| :--- | :---: | :--- | :--- | :--- |
| **01 晨光草原** | `(0.54,0.58)` `[LOWLAND]` | 🌻 晨光花靈王 | `4338 / Sunflora Pixie.FBX` *(新匯出)* | 東北 `tea house autumn forest` 巨型茶壺丘＋西南旋轉風車農莊 |
| **02 低語森林** | `(0.80,0.70)` *(鑿平林地)* | 🐺 幽林巨狼王 | 既有 `werewolf.glb`（放大 2.4×＋暗綠毒氣環） | 古墓石堂＋西南 `abandoned house`（去汽車） |
| **03 霧潮沼澤** | `(0.50,0.54)` `[LOWLAND]` | 🦀 沉船巨蟹王 | 既有 `crab_monster.glb`（放大 2.5×） | 中央 `Sea/sea monster attack` 海怪沉船＋東側 `fishing Island` 吊橋村 |
| **04 霜冬雪原** | `(0.76,0.74)` `[LOWLAND]` | ❄️ 寒霜巨像王 | 既有 `golem_ice.glb`（放大 2.6×＋冰霜光環） | 東北 `crystal mountain` 藍冰峰＋西北 `ski resort` 滑雪纜車 |
| **05 燼煙火岩區** | `(0.51,0.53)` `[PLATEAU]` | 🐉 熾炎熔岩巨龍 | `4338 / Dragon Inferno.FBX` *(新匯出，2.6×)* | 西崖 `coal mine` 礦坑棧橋＋東南 `waterfall desert` 紅岩瀑布 |
| **06 古樹林** | `(0.52,0.52)` `[LOWLAND]` | 🌳 磐岩古樹巨像 | 既有 `golem_earth.glb`（放大 2.6×＋古苔光環） | 西北 `japanese sanctuary park` 五重古塔＋東坡 `autumn hot springs` |
| **07 浮空遺跡群** | `(0.36,0.48)` `[PLATEAU]` | 👼 星穹大天使 | `4301 / Archangel.FBX` *(新匯出，2.4×)* | 東崖 `waterfall island` 飛瀑燈塔巨崖＋北端 `roman ruins` |
| **08 珊瑚潮汐灣** | `(0.60,0.52)` `[SHALLOW]` | 🐚 潮汐寄居蟹王 | `4338 / Hermit King.FBX` *(新匯出，2.5×)* | 西灣 `mountain ship` 沉船崖堡＋北岸 `mountain arch` 石拱門 |
| **09 沉沒電光都** | `(0.66,0.54)` *(鑿平高台)* | 👁️ 雷鳴獨眼巨魔 | 既有 `beholder.glb`（放大 2.5×＋電弧光環） | 彩頂 `trade port` 水上商港＋西北 `lighthouse pier` 變電燈塔 |
| **10 櫻花水都** | `(0.50,0.53)` `[LOWLAND]` | 👹 緋櫻惡鬼法師 | `4303 / EvilMageMesh.fbx` *(新匯出，2.3×)* | 西北 `imperial palace` 天守水宮＋中央 `autumn japan` 大弧朱紅橋 |
| **11 蒼穹巨環谷** | `(0.56,0.34)` `[PLATEAU]` | 🌪️ 蒼穹疾風魔導 | `4301 / Wind Mage.FBX` *(新匯出，2.4×)* | 標誌性卡比碧藍巨環＋西側 `bridge over water gorge` 火車峽谷橋 |
| **12 紅楓工坊谷** | `(0.66,0.48)` `[PLATEAU]` | 🔥 鍛爐炎岩巨像 | 既有 `golem_fire.glb`（放大 2.6×） | 西北 `autumn hot springs` 溫泉＋西南風車紅穀倉牧場 |
| **13 黃金風沙原** | `(0.62,0.52)` `[LOWLAND]` | 🪱 沙暴巨蟲母皇 | `4356 / Queen Worm.FBX` *(新匯出，2.6×)* | 4351 埃及遺跡＋西北 `desert islands` 綠洲＋東北 `arab castle` |
| **14 太陽金字塔** | `(0.50,0.48)` `[CLIFF]` | 🦂 黃金聖蠍王 | 既有 `scorpion_king.glb`（放大 2.6×） | 既有 4351 太陽雙金字塔＋獅身人面像＋西環 `temple deserts` |
| **15 失落藤蔓神廟** | `(0.50,0.52)` `[PLATEAU]` | 🐍 叢林娜迦女王 | `4338 / Snake Naga.FBX` *(新匯出，2.5×)* | 4352 叢林石像古牆＋中央 `tropical ruins` 瀑布古廟 |
| **16 幽霧哥德墓園** | `(0.50,0.50)` `[PLATEAU]` | 💀 冥霧死神王 | `4356 / Grim Reaper.FBX` *(新匯出，2.5×)* | 中央 `cemetery haunted house` 哥德教堂鬼屋墓園 |
| **17 深淵哥德古堡** | `(0.50,0.22)` `[CLIFF]` | ⚔️ 血月黑騎士長 | 既有 `black_knight.glb`（放大 2.6×） | 北崖合一哥德古堡群（整合副本入口，零重疊） |
| **18 深海螢光沉淵** | `(0.54,0.62)` `[LOWLAND]` | 🐙 深淵暗影魔龍 | `4284 / Dragon Darkness.FBX` *(新匯出，2.6×)* | 既有 4123 飄浮巨烏賊＋亞特蘭提斯海殿＋深海光菇 |
| **19 星際白銀前哨** | `(0.50,0.50)` `[SHALLOW]` | 😈 軌道熾焰魔將 | 既有 `flying_demon.glb`（放大 2.5×＋星藍光環） | 既有 4123 星艦登陸平台＋飛艇＋西北 `space shuttle launch` |
| **20 異星蜂巢裂谷** | `(0.50,0.50)` `[CLIFF]` | 🐉 異星暮光龍皇 | `4284 / Dragon Nightfall.FBX` *(新匯出，2.8×)* | 既有 4123/4384 異星母巢塔＋西環 `fantastic planet` 異星菌蛋 |

---

## 四、總結：真正需要動刀的精準範圍（克制、合理、不亂疊）

- **全圖必做基礎清掃（Phase R0）**：修好 `world.js` 生態系白名單（根治 20 張圖的跨生態系雜物）＋ 修好 `#02 / #09 / #12 / #17` 的 4 處真實地形 Bug ＋ 實作 `flattenPad()` 平整底座。
- **真正需要替換的 12 張高優先級地圖（其餘 `#14 / #18 / #19 / #20` 原本已有專屬 3D 實模，只需清掃雜物＋極少量點綴）**：
  - **第一批樣板（先做 2 張並多角度截圖驗收）**：`#01 晨光草原`（換真茶壺丘＋西北瀑布崖）＋ `#03 霧潮沼澤`（換真海怪觸手沉船＋真高腳吊橋漁村）。
  - **第二批**：`#04 霜冬雪原`（滑雪纜車＋藍冰晶山＋河畔雪屋）＋ `#06 古樹林`（拔除離譜風車→真五重古塔＋三疊溫泉）。
  - **第三批**：`#08 珊瑚潮汐灣`（沉船崖堡＋海蝕石門）＋ `#10 櫻花水都`（拔除熱帶草屋→天守水宮＋朱紅大拱橋＋海上紅塔孤島＋竹林茶亭）。
  - **第四批**：`#02 / #05 / #07 / #09 / #11 / #12 / #16 / #17`（逐張精準替換確認清單上的不合理項目，並自動剔除現代汽車與微小物雜點）。
