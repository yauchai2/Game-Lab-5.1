# 《燈谷行 Lantern Vale》技能特效、職業機制與戰鬥系統全面重製總規劃

> **規劃日期**：2026-11-24  
> **核心資產包（4 套 Piloto Studio Roguelike VFX 套件）**：
> 1. `Roguelike Arcanist VFX Pack`（`Arcanist VFX Pack1.0.1.unitypackage`，34.1 MB — 31 Prefabs / 6 Meshes / 72 Textures）
> 2. `Roguelike Blue Fire VFX Kit`（`Blue Fire1.0.1.unitypackage`，121.7 MB — 23 Prefabs / 43 Meshes / 179 Textures）
> 3. `Roguelike Magic VFX Kit`（`Roguelike Magic VFX Kit2.0.unitypackage`，53.7 MB — 20 Prefabs / 35 Meshes / 88 Textures）
> 4. `Roguelike Magic 3 VFX Kit`（`Roguelike Magic 3 VFX Kit1.1.unitypackage`，81.9 MB — 21 Prefabs / 30 Meshes / 115 Textures）
> **視覺準則**：全遊戲維持 **A Short Hike 溫馨像素風 UI＋暖木卡通 3D 世界**，透過精選 3D 特效模型＋自訂 Piloto 風格像素化著色器（對齊原包 `UberFXSG Pixelated`），讓每一招普攻、技能、二轉覺醒與大絕都擁有電影級手繪張力，同時嚴控 WebGL 資源體積與零記憶體洩漏。

---

## 一、四套技能包實機盤點與技術轉檔管線

我們已以 Python 直接解包檢驗四套最新 `.unitypackage`（共 **95 組 Prefab、114 個 3D VFX 網格、454 張手繪貼圖／序列幀／法陣／雜訊圖**），並完成去重與核心精華歸納：

### 1. 四套套件核心可用精華矩陣

| 套件名稱 | 核心 3D 模型（`.fbx`） | 核心手繪貼圖／序列幀／法陣 | 最適合《燈谷行》的系統歸屬 |
| :--- | :--- | :--- | :--- |
| **Arcanist 1.0.1** | `BlackHole_Base_Smooth`、`RingWind_Angled`、`vfxm_Petal`、`LiquidMeshes` | `T_Arcanist_Cards`（星牌）、`T_Electricity_Flipbook_4x2`、`T_Hit_Punch_Outlined`、`Energy_Circle` | 5 系護體光環（奧術/星域/蓮華/幽冥/雷鳴）、黑洞吸引、蓮華治癒領域、連續幻影斬、汲血回飛球 |
| **Blue Fire 1.0.1** | `Tornado_05`、`Slash_Thick`、`SM_Necro_GroundCrack`、`M_Fire_Tower`、`SM_Candle_Gradient_A/B`、`SM_Props_Torch`、`MZ_Projectile` | `Fire_dissolve_05`、`FlameGradient`、`T_Smoke_Flipbook_8x8`、`Gradient_maker_Nova_fire_spiral` | 《燈谷行》招牌「幽藍魂火／暖金燈火」雙色火焰！含燭火聖陣、旋轉魂火球、藍焰龍捲、裂地召喚、火柱衝擊 |
| **Magic 2.0** | `vfxm_FireWhale_001`（火鯨）、`vfxm_ThunderPheonix`（雷鳳）、`vfxm_HealingTree_001`（聖樹）、`vfxm_MonsterWolf_Head_Chomp`（巨狼）、`vfxm_IcePuffleFish`（冰河豚）、`SM_HeavyHeroSword_A`（聖劍）、`SM_KnightSpear_ColorC`（聖槍）、`SM_GiantShuriken_ColorA`（手裏劍）、`SM_Arrow_02`（箭矢）、3 款圖騰、4 款 3D 魔法陣 | `MagicRunicCircle`、`LightningBeam_1x8_Rough`、`GroundCrack_RadialPostExplody`、`Ring_ShockwaveLiquidy`、`Flowers_Rough`、`LeafClump` | **全職業招牌 3D 召喚大招與武器實物投射物！** 徹底淘汰原本平面的 `RingGeometry` 與 `CylinderGeometry` |
| **Magic 3 1.1** | `Dragon_Head_Animation`（動態 3D 龍頭！）、`SlashMesh_Clean`、`SM_Rock_03~10`、`SM_Spear_Head`、`SM_TowerDefense_Arcane_ManaCrystal`、`SM_SacredPeaceEmblem_B` | `FireFlipbook_1`、`Eletric_Flipbook_V1`、`Holy_DecalRing`、`Mana_Runes_Aura`、`Mana_Runes_Impact_decal_bright`、`Anime_Shock1`、`IconWarningOutline0` | 3D 巨龍吐息大絕、附魔劍氣、極冰晶壁、旋轉岩柱光束、敵人出生警示法陣、打擊爆花、稀有掉寶光柱 |

### 2. WebGL 輕量化轉檔與著色器架構（嚴控 < 2.8 MB）
原始四包總計近 `300 MB`（含大量 `2K–4K` 重複雜訊圖與示範場景），絕不可直接塞進網頁。我們將建立與角色管線同規格的 **`scripts/build_vfx_assets.py`**（Python + Blender 5.0 Headless）：
1. **單一合併網格庫 `game/assets/vfx/vfx_meshes.glb`**（目標 **`1.0–1.5 MB`**）：
   - 僅抽取精選 **~32 個核心 3D VFX 網格**（如火鯨、雷鳳、巨狼、聖樹、龍頭、聖劍、冰河豚、黑洞、龍捲風、兩款斬擊弧、地裂、法陣、箭矢、手裏劍、長槍、蠟燭、圖騰、花瓣等），統一歸零原點與縮放比例，移除無用材質與動畫冗餘。
2. **精選去重貼圖庫 `game/assets/vfx/tex/`**（目標 **`1.0–1.3 MB`**）：
   - 嚴選 **~24 張核心貼圖**（序列幀 `FireFlipbook` / `Electricity_4x2` / `Smoke_4x4`、法陣 `MagicRunicCircle` / `Holy_DecalRing` / `Mana_Runes_Impact`、地面裂紋 `GroundCrack`、光束 `LightningBeam`、溶解雜訊 `Fire_dissolve` / `LiquidNoise`、漫畫打擊 `Hit_Punch_Outlined`、花瓣／葉片），全部以 Pillow 壓縮為 `256×256`～`512×512` 最佳化 WebP/PNG。
   - **灰階＋漸層著色策略**：沿用 Piloto 原設計，保留灰階遮罩貼圖，在著色器以雙色漸層（`uColorA` 亮核 → `uColorB` 邊緣）動態上色——同一把斬擊弧或龍捲風即可依職業／輔助寶石無縫變換為金焰、幽藍火、極光冰、雷紫或櫻粉！
3. **自訂 Three.js 特效著色器 `src/vfx_shader.js`**（對齊原包 `UberFXSG Pixelated`）：
   - 單一輕量 `ShaderMaterial` 同時支援：**UV 捲動（流動火焰／光束）**、**噪點溶解＋亮邊（火焰消散／傳送裂縫）**、**Flipbook 序列幀步進**、**Fresnel 邊緣發光（黑洞／護盾／圖騰光柱）**，以及可選的 **像素對齊取樣**，完美融合 270p 暖木世界。
4. **零洩漏物件池引擎 `src/vfx_engine.js`（`VfxEngine`）**：
   - 幾何體與貼圖全域單例快取，所有進場特效皆有明確 `life` 與自動回收／`dispose()`；高頻普攻斬擊與命中爆花採**物件池複用**，即使在餘燼狂潮 34 隻怪海同屏時也能維持穩定 60 FPS 且 VRAM 零增長。

---

## 二、五大職業、角色普攻連招與核心資源機制重製

目前五大職業僅差在初始 4 顆拼圖寶石與被動數值，手感辨識度不足。結合我們已完成的 **Modular Cute Fantasy 5 套角色與獨立骨骼動畫**，搭配 **4 套 Piloto 技能包**，全面重塑五大職業的「普攻三段連招」、「專屬核心資源條（統一 A Short Hike 像素風格整合至 `#pcard`）」與「二轉覺醒／專屬大絕」：

| 職業（角色＋武器） | 普攻三段連招（含 3D VFX） | 職業專屬資源與被動機制 | 專屬初始技能（實機 3D VFX） | 二轉雙覺醒（10 大分支＋專屬腳底法陣） | 職業專屬大絕 `[V]` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0. 🛡️ 守燈衛士 Fighter**<br>輕甲＋雙刃戰斧 | 1–2 段：`Slash_Thick` 金焰重斬<br>第 3 段：`vfx_Ground Slam` 撼地裂紋（附小暈眩） | **【堅壁戰意】**（0–100）<br>攻擊與受擊累積戰意，滿 100 自動展開 `Mystic_Protection` 聖光護盾（吸收 25% 傷害＋反傷）並強化下一次技能範圍 +30%。 | • **聖劍天降** (`PaladinSword`)<br>• **裂地重擊** (`Ground Slam` + `GroundCrack`)<br>• **狂戰圖騰** (`RageTotem`) | **⚜ 聖光堡壘**：解鎖「**雷槍聖牢** (`ThunderSpearCage`)」＋金光聖徽光環<br>**⛰ 大地行者**：解鎖「**旋轉岩柱光束** (`Rotating Rock Beams`)」＋翡翠地脈光環 | **🐉 蒼炎神龍吐息**<br>(`vfx_Dragon Breath Attack` — 召喚動態 3D 龍頭朝準星噴吐高能烈焰扇形橫掃 2.6 秒!) |
| **1. 🏹 林風遊俠 Archer**<br>獵裝＋箭袋＋樺木弓 | 1–2 段：`SM_Arrow_02` 3D 疾風箭<br>第 3 段：`ArrowsVolley` 三叉貫穿星風箭 | **【順風連羽】**（0–5 層）<br>移動與普攻疊加風羽，達 5 層時自身展開 `RingWind_Angled` 氣流環（移速 +25%），下次技能必暴且冷卻 -25%。 | • **星羽箭雨** (`ArrowsRain` 3D 箭雨)<br>• **旋風手裏劍扇** (`ShurikenFan`)<br>• **冰晶河豚錐** (`PufferFish_IceCone`) | **🪽 蒼穹馭風者**：解鎖「**雷霆鳳凰** (`ThunderPheonix`)」＋青空疾風光環<br>**🌠 星痕獵手**：解鎖「**星矛陷阱陣** (`Spear Trap`)」＋星軌光環 | **🦅 雷霆鳳凰降臨**<br>(`ThunderPheonix` — 3D 巨型雷鳳展翅掠過戰場，留下感電雷徑並引爆全場標記!) |
| **2. 🔥 餘燼秘術師 Mage**<br>巫師帽＋星袍＋晶杖 | 1–2 段：`MagicMissile`／`BlueFire` 追蹤秘彈<br>第 3 段：`Arcanist_Hit_Arcane` 符文範圍爆裂 | **【雙焰共鳴：熾金 ↔ 幽藍】**<br>每次施法在「熾金餘燼（增傷 +20%）」與「幽藍魂火（省魔 35%＋減冷卻）」切換；交替觸發產生 `BlueFire_Explosion` 雙焰共鳴爆破！ | • **幽藍魂火彈** (`BlueFire_Projectile`)<br>• **幽藍龍捲風** (`BlueFire_Tornado`)<br>• **秘法星光束** (`Arcanist_Mystic_Beam`) | **☄ 焚星賢者**：解鎖「**熾炎巨鯨** (`FireWhale`)」＋熾炎火環<br>**❄ 霜燈織夢師**：解鎖「**星域黑洞** (`Mystic_BlackHole`)」＋寒霜符文環 | **🐋 熾炎巨鯨·破浪滅潮**<br>(`FireWhale` — 3D 巨型火焰鯨魚自地底躍起拱身重砸，捲起雙層火浪清場!) |
| **3. 🗡️ 影刃行者 Necro/Assassin**<br>暗影兜帽＋幽霧秘刃 | 1–2 段：`SlashMesh_Clean` 雙刃紫影交叉斬<br>第 3 段：`Sequencial_Cuts` 瞬間三連斬影 | **【暗影印記】**（敵身 0–3 層）<br>普攻與背刺疊加印記，滿 3 層引爆 `Death_Circular_Drain` 暗影爆裂並飛出 `Death_Return_Drain` 汲血光球回血回魔。 | • **迴旋暗影斬** (`Cut_and_Return`)<br>• **影霧煙幕彈** (`SmokeBomb` + `Warp Explosion`)<br>• **幽冥汲血扇** (`Death_ConeShot`) | **🌙 緋月劍舞者**：解鎖「**附魔劍氣** (`Enchanted Sword Beams`)」＋緋月刀環<br>**🌫 夜霧幻影師**：解鎖「**暗影巨狼** (`DarkSummon` 巨狼撲咬!)」＋冥紫暗環 | **🐺 冥界巨狼·虛空吞噬**<br>(`DarkSummon` + `PurpleLightPillar` — 3D 巨型暗影狼首破界撲咬，重創並令敵人易傷 +45%!) |
| **4. 🪷 禪燈武僧 Monk/Cleric**<br>聖燈法冠＋聖燈法杖 | 1–2 段：`BlueFire_Slash` 金藍光弧棍擊<br>第 3 段：`Hit_Punch_Outlined` 漫畫感氣勁震拳 | **【蓮華禪韻】**（0–3 蓮印）<br>普攻與施法凝聚 3 枚環身金蓮；滿 3 印自動於腳下綻放 `Lotus_Healing_Area`，治療全隊並強化隊友攻速 +15%。 | • **蓮華旋斬** (`Lotus_Circular_Attack`)<br>• **繁花聖樹** (`HealingTree` 3D 花樹)<br>• **雷鳴方陣** (`Thunder_Square`) | **🪷 蓮華禪師**：解鎖「**幽藍燭火聖陣** (`BlueFire_Candle_Heal` + `BlossomingHeal`)」＋翠蓮光環<br>**⚡ 雷鳴拳聖**：解鎖「**天穹雷槍轟擊** (`Lightning Sky Attack` + `Thunder_Line`)」＋雷金光環 | **☀️ 聖燈破曉·靈陽普照**<br>(`SpiritSun` + `BlossomingHeal` — 升起燃燒靈陽淨化異常、回復全隊 60% 生命並釋放三波聖光震波!) |

> **角色劇院與換裝連動**：
> - 在角色選擇頁浮空小島點選某位英雄聚焦時，該英雄腳下立即展開專屬 `Arcanist_Cards_Aura_*` 法陣並預演一次招牌迷你特效（如衛士金劍閃光、法師藍火環繞、武僧蓮瓣飄落），讓玩家選角瞬間就能直觀感受職業魅力！
> - 換裝間或城鎮切換武器（戰斧／弓／晶杖／秘刃／聖杖）時，普攻三段連招 VFX 會自動連動切換。

---

## 三、6×6 技能拼圖 2.0：24 顆 3D 主動寶石＋輔助視覺變異

保留《燈谷行》最受歡迎的 **6×6 多格形狀技能拼圖＋邏輯電路（命中觸發 `COH`／暴擊觸發 `COC`）＋小隊羈絆插座**，將所有寶石升級為實機 Piloto 3D 特效，並擴充至 **24 顆主動寶石（原 14 顆全面翻新＋新增 10 顆 3D 召喚／招牌技）＋ 16 顆輔助寶石**：

### 1. 現有 14 顆主動寶石全面升級對照
| 寶石 ID | 名稱 | 舊版視覺 | **新版 Piloto 3D VFX 實機呈現** |
| :--- | :--- | :--- | :--- |
| `bolt` | 餘燼／幽藍魂彈 | 小圓球 | `BlueFire_Projectile` / `MagicMissiles` 3D 拖尾飛彈＋`FireFlipbook` 命中爆焰 |
| `slam` | 裂地重擊 | 平面黃環 | `vfx_Ground Slam Attack` + `SM_Necro_GroundCrack` 3D 裂縫＋飛石震波 |
| `wisp` | 魂火護衛 | 八面體 | `BlueFire_Spinning_FireBalls` + `Arcanist_Cards_Aura` 環身流火光球 |
| `rain` | 星羽箭雨 | 平面藍圈 | `ArrowsRain`（實機 3D `SM_Arrow_02` 箭雨傾瀉＋`Arrows_Rain_Tex_Decal_Mist` 地面落箭霧環） |
| `trap` | 毒霧／星矛陷阱 | 綠圈 | `vfx_Spear Trap` / `BlueFire_Torch_Puddle` 3D 陷阱引爆＋毒焰煙霧 |
| `whirl` | 旋風燈舞 | 平面粉弧 | `vfx_Spinning Slash` / `Blue_Fire_Spinning Slash` 360° 雙層立體火焰旋斬 |
| `mark` | 幽冥印記 | 紫圈 | `MagicRunicCircle` + `Arcanist_Card_Death_Circular_Drain` 詛咒法陣 |
| `meteor` | 星隕天降 | 紅圈＋點 | `BlueFire_Pillar_Rocket` 隕石火柱墜地＋`BlueFire_Explosion`＋`vfx_Burning Ground` |
| `nova` | 極光冰爆 | 淺藍環 | `PufferFish_IceCone`（可愛 3D `vfxm_IcePuffleFish` 爆裂＋`IceShards` 環形冰刺） |
| `prism` | 折光圖騰 | 黃色八面體 | `ThunderTotem` / `HealingTotem` 3D 旋轉圖騰柱＋折射雷光束 |
| `phantom` | 影霧幻陣 | 紫圈＋煙 | `SmokeBomb` 瞬身煙霧＋`vfx_Warp Explosion Purple` 空間裂縫引爆 |
| `sakura` | 櫻蓮吹雪 | 粉圈 | `Arcanist_Cards_Lotus_Circular_Attack` + 3D `vfxm_Petal` 旋舞花海＋`BlossomingHeal` |
| `thunder` | 雷霆落雷 | 藍細柱 | `vfx_Lightning Sky Attack` + `LightningBeam_1x8_Rough` 鋸齒天雷＋地面焦痕 |
| `quakeg` | 星晶震盪 | 灰圈 | `vfx_Teleport Rock Impact` + `BlueFire_Crack_Rocks` 雙波星岩裂地震盪 |

### 2. 新增 10 顆招牌 3D 召喚／特技主動寶石（高階掉落／二轉解鎖／寶石商人）
1. **`paladin_sword`（⚔️ 聖劍天降）**：`SM_HeavyHeroSword_A` 巨劍從天垂直插地，引發 `vfx_Sword AOE Impact` 聖光震波並嘲諷周圍敵人。
2. **`fire_whale`（🐋 熾炎巨鯨）**：`vfxm_FireWhale_001` 火焰巨鯨自地面躍起劃出弧線重砸目標區域，留下熔岩火海。
3. **`thunder_phoenix`（🦅 雷霆鳳凰）**：`vfxm_ThunderPheonix` 展翅向前貫穿衝刺，沿途劈落連鎖感電雷弧。
4. **`dark_wolf`（🐺 暗影巨狼）**：`vfxm_MonsterWolf_Head_Chomp` 巨型冥狼破影張口咬合，對高血量／已標記目標造成處決增傷。
5. **`healing_tree`（🌳 繁花聖樹）**：種下 `vfxm_HealingTree_001` 3D 綻放花樹 8 秒，持續治療範圍內所有隊友並驅散中毒／灼燒。
6. **`black_hole`（🕳️ 星域黑洞）**：`BlackHole_Base_Smooth` 召喚重力奇點持續牽引周圍怪物聚怪，結束時觸發 `vfx_Purple Bomb Explosion`！
7. **`blue_tornado`（🌪️ 幽藍龍捲）**：`Tornado_05` 召喚緩慢追蹤敵人的幽藍火焰龍捲，持續捲起怪物並擴散地表元素（與毒霧／水窪連攜超爽！）。
8. **`spear_cage`（🔱 雷槍聖牢）**：8 根 `SM_KnightSpear_ColorC` 3D 長槍環形插地困住敵人並持續電擊。
9. **`sword_beams`（🌙 附魔劍氣）**：連續發射 3 道 `vfx_Enchanted Sword Beams` 穿透月牙劍波，專精直線清怪。
10. **`candle_ward`（🕯️ 魂火燭陣）**：`BlueFire_Candle_Circle` + `ManaRegenArea` 召喚一圈幽藍蠟燭法陣，站於陣內大幅回魔並使技能冷卻加速 30%！

### 3. 輔助寶石「視覺即時變異」＋ 2 顆新輔助寶石
在 6×6 棋盤上將輔助寶石與主動技能相鄰連結時，**除了數值加成外，3D VFX 顏色與粒子會即時演化**：
- 連結 `ember`（熾炎）→ 著色器自動切換金紅烈焰漸層＋附帶 `FireFlipbook` 灼燒火星。
- 連結 `frost`（霜緩）→ 切換冰晶藍白漸層＋命中爆出 `IceShards` 3D 冰屑。
- 連結 `storm`（雷鳴）→ 疊加 `T_Electricity_Flipbook_4x2` 電弧閃爍。
- 連結 `vamp` / `leech`（血月／汲血）→ 命中時飛出 `Death_Return_Drain` 魂光弧線飛回玩家。
- 連結 `orbit`（軌道）→ 投射物改採 `BlueFire_Spinning_FireBalls` 環身旋轉姿態。
- **新增 2 顆輔助寶石**：
  - **`bluefire`（🔵 幽藍魂火轉化）**：將相鄰主動技能轉化為「幽藍魂火」型態（著色器切換招牌深藍青焰，魔力消耗 -25%、對灼燒／潮濕目標造成額外靈魂真傷）。
  - **`vortex`（🌀 聚能引力核）**：相鄰範圍技能命中時產生短暫向心吸力（搭配 `Ring_ShockwaveLiquidy` 內縮波紋），把散落怪海拉成一團爽快連招！

---

## 四、戰鬥回饋、元素反應與世界視覺全面升級

利用 `Magic 3` 與 `Arcanist` 提供的系統級特效，一次升級全遊戲的戰鬥「打擊感」與「戰場可讀性」：
1. **元素化受擊爆花（Hit Impact）**：依傷害屬性切換 `vfx_Hit Impact Burning`（火）、`Arcanist_Card_Hit_Thunder`（雷）、`Arcanist_Card_Hit_Arcane`（奧術）、`vfx_Hit Impact DarkRed`（暴擊／流血）、`vfx_Hit Impact Healing`（治療）與 `Hit_Punch_Outlined`（漫畫暴擊特寫）。
2. **敵人生成與預警法陣**：餘燼狂潮／副本刷怪前先於地面浮現 `vfx_Enemy Spawn Circle`（0.7 秒法陣展開再跳出怪物），Boss 範圍重擊改用 `IconWarningOutline0`＋`Elemental_Pilar_Decal_Indicator_Light` 清晰貼地預警。
3. **裝備掉寶光柱（Loot Beam）**：稀有／史詩／傳說／腐化掉落物掛載 `vfx_Loot Effect` 與 `vfx_Magic Relic Aura` 對應色系光柱與環形光點，刷寶爽感翻倍！
4. **地表元素反應貼圖升級**：將 `src/elements.js` 的積水／冰面／蒸汽／感電水窪／熔岩／毒池改為真實手繪貼花（`LS_decal_dark_new`、`GroundCrack_RadialPostExplody`、`Caustics_stylized_1`、`T_Smoke_Flipbook_8x8`），元素連鎖爆發時伴隨立體衝擊波！

---

## 五、分階段實作路線圖（Phase V1 ～ V6）

| 階段 | 核心工作內容 | 交付產出與驗收標準 |
| :---: | :--- | :--- |
| **Phase V1** | **4 包 VFX 資產抽取與壓縮管線** | 撰寫 `scripts/build_vfx_assets.py`，自 4 套 `.unitypackage` 自動抽出並轉換為 `game/assets/vfx/vfx_meshes.glb`（~32 個 3D VFX 網格）＋ `game/assets/vfx/tex/`（~24 張精選貼圖／序列幀），總體積 `< 2.8 MB`，附清單驗證。 |
| **Phase V2** | **Piloto 風格 WebGL 著色器與物件池引擎** | 建立 `src/vfx_shader.js`（UV 捲動／噪點溶解／Flipbook／Fresnel／像素化）與 `src/vfx_engine.js`（`VfxEngine` 物件池、斬擊、法陣、3D 召喚、光束、受擊爆花、掉寶光柱、刷怪法陣），確保 0 GPU 洩漏。 |
| **Phase V3** | **5 大職業普攻三段連招、專屬資源條與 5 大職業大絕** | 實作 5 職業專屬普攻三段連招與 VFX、5 種職業核心資源機制（整合 A Short Hike 風格像素資源槽於 `#pcard`），以及 5 大職業專屬 `[V]` 大絕（3D 龍頭吐息／雷霆鳳凰／熾炎巨鯨／冥界巨狼／破曉靈陽）。 |
| **Phase V4** | **技能拼圖 2.0（24 主動＋16 輔助＋視覺變異＋二轉法陣）** | 全面翻新舊 14 顆主動寶石為實機 3D VFX、實裝 10 顆全新 3D 召喚／招牌寶石與 2 顆新輔助寶石、接通輔助寶石染色／元素變異視覺與 10 大二轉覺醒專屬腳底法陣。 |
| **Phase V5** | **角色選擇頁現場試演、元素反應貼花與世界回饋** | 浮空島選角聚焦時即時預演英雄專屬法陣＋招牌技能微特效；升級地表元素反應貼圖、敵人出生法陣與稀有掉寶光柱；同步更新百科（Codex）與角色手帳技能說明。 |
| **Phase V6** | **自動化驗證與自主截圖視覺 QA** | 擴充 `tests/logic_verify.cjs`（驗證 VFX 資產、24 主動／16 輔助寶石、5 職業資源與大絕、物件池零洩漏）；直接以 Headless Chrome 實機截圖檢視 5 職業實戰 VFX、大絕召喚與 A Short Hike UI 資源條，完成最後打磨並提交。 |

---

## 六、開工前請您確認的 2 個設計方向

1. **職業大絕 `[V]` 與既有 3 大潮汐大絕的整合方式**：
   - **選項 A（推薦）**：每位職業預設配備 **1 招專屬 3D 職業大絕**（如衛士 3D 龍頭吐息、法師熾炎巨鯨、遊俠雷霆鳳凰、影刃冥界巨狼、武僧破曉靈陽），同時仍可用 `Shift+V` 輪切共用的潮汐大絕（燈犬衝鋒等），兼顧職業歸屬感與趣味！
   - **選項 B**：將 `[V]` 完全改為各職業專屬單一大絕，移除舊版共用輪切。
2. **技能 3D 特效的視覺銳利度（配合 270p 暖木世界）**：
   - **選項 A（推薦）**：VFX 渲染進入主 270p 像素卡通管線並開啟適度像素感與鮮明暖色光暈，讓巨龍／火鯨／箭雨與《燈谷行》A Short Hike 風格融為一體。
   - **選項 B**：保留較高解析度的平滑手繪質感（類似角色選擇頁的柔光清透感）。
