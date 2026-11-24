# 《燈谷行 Lantern Vale》全地圖場景重製規劃書（Low Poly Locations Ultimate Pack 1.0.0）

## 一、資源包完整盤點與主題篩選

經完整掃描 `Low Poly Locations Ultimate Pack 1.0.0.unitypackage`（共 **4,142 筆資產**、**110 套已由美術排版完成的 `Locations with Env` 成品場景**），最大技術優勢在於：**全套 110 個場景共用同一張低多邊形調色盤貼圖 `texture main.png`**。這代表我們混搭不同主題的成品套裝與建築道具時，不僅色調與幾何語言 100% 和諧統一，在 WebGL 中更能大幅減少材質切換與 Draw Call，與《燈谷行》的 A Short Hike 3× 像素賽璐璐風格天生契合。

| 資源包主題系列 | 成品場景數 | 與《燈谷行》契合度 | 採用定位 |
| :--- | :---: | :---: | :--- |
| **Low Poly Autumn**（秋林村落／溫泉／鬼屋） | 10 | ★★★★★ | 燈谷鎮主聚落、紅楓工坊谷、哥德墓園與古堡 |
| **Low Poly Nature**（山谷河岸／森林露營／瀑布／熱氣球） | 10 | ★★★★★ | 晨光草原、低語森林、古樹林、蒼穹巨環谷 |
| **Low Poly Island**（沉船秘島／瀑布島／三層島／巫覡島） | 10 | ★★★★★ | 選角頁主島（已完成）、浮空遺跡、珊瑚灣、霧潮沼澤 |
| **Low Poly Sea**（商港／燈塔碼頭／海怪／秘境遺跡） | 10 | ★★★★★ | 燈谷鎮星燈渡輪碼頭、沉沒電光都、深海螢光沉淵 |
| **Low Poly Japanese**（櫻花湖畔／鳥居／溫泉／古宮林） | 10 | ★★★★★ | 櫻花水都、古樹林深處神殿 |
| **Low Poly Winter**（雪國村鎮／水晶雪山／河畔雪屋） | 10 | ★★★★★ | 霜冬雪原全域 |
| **Low Poly Desert**（金字塔／沙漠神殿／阿拉伯堡／熱帶遺跡） | 10 | ★★★★★ | 黃金風沙原、太陽金字塔聖殿、失落藤蔓神廟 |
| **Low Poly Western**（礦坑／峽谷木橋／荒野營地） | 10 | ★★★★☆ | 餘燼前哨站、燼煙火岩區（搭配熔岩與餘燼光源） |
| **Low Poly Space**（太空站／異星隕坑／奇幻星球／飛碟墜毀） | 10 | ★★★★★ | 星際白銀前哨站（#19）、異星蜂巢裂谷（#20） |
| **Low Poly City**（摩天大樓／醫院／汽車） | 10 | ☆☆☆☆☆ | **排除**（現代都市會破壞奇幻冒險氛圍） |
| **Low Poly Sports**（足球場／賽車場／泳池） | 10 | ☆☆☆☆☆ | **排除**（現代體育設施不符世界觀） |

---

## 二、核心改造架構：為何能「直接搬入成品場景」又不破壞玩法？

目前 `src/world.js` 中仍有 **102 處** 以 `BoxGeometry`／`ConeGeometry`／`CylinderGeometry` 手工堆疊的簡陋房屋、木橋、碼頭、路燈、圍欄、攤販與石塊，導致畫面顯得粗糙單調。為兼顧**美術成品構圖美感**與**既有 ARPG 探索／戰鬥／導航／AOI 系統穩定性**，採用「雙軌融合架構」：

### 1. 成品套裝「分區景觀組」落地（Hybrid Setpiece Drop-In）
- 沿用已在選角頁驗證成功的 `Blender Python` 批次解析腳本（自動讀取 Unity `Locations with Env` 預製件的精準位置／旋轉／縮放），將每張地圖挑選的 1～2 套成品場景，**抽離原本的 45×45 方形水域底板**，保留作者精雕細琢的**主體建築群、橋梁、山崖、瀑布、碼頭、營地與周圍裝飾群組**，匯出為輕量專屬 `game/assets/scenes/setpiece_<id>.glb`。
- 落地至我方 240～400m 的無縫地圖時：
  - **主地標區（Center / Hub / Boss Arena）**：放置整套成品景觀組（例如村莊廣場、金字塔神殿、櫻花水宮），以平滑高度混合（Height Flatten + Blending）讓地形自然承接套裝底座，絕不懸空或穿模。
  - **外圍探索區（Checkpoints / Shrines / Dungeon Gates）**：以小型成品副組（如露營地、燈塔碼頭、古石門、木橋）形成「視線引導鏈（Sightline Breadcrumbs）」，讓玩家一進地圖就能遠望地標、自然展開探索。
  - **碰撞與導航自動烘焙**：匯出腳本同步產出每個套裝的輕量 JSON 碰撞盒（`footprint`）與可走區域遮罩，自動匯入 `world.obstacles` 與 BFS `computeFlow`，確保怪物尋路、玩家翻滾／滑翔／坐騎與檢查點傳送 **100% 無縫運作**。

### 2. 全域低多邊形道具與自然庫替換（Global Prop & Foliage Upgrade）
- 打包共用零件包 `palmov_props.glb`（木屋、攤位、木橋、碼頭、圍欄、路燈、營火、木桶、貨箱、長椅、神殿石柱、墓碑、水晶）與 `palmov_nature.glb`（各色季節樹、冷杉、棕櫚、竹林、仙人掌、蘑菇、灌木、瀑布、礁石）。
- **完全淘汰 `world.js` 內所有簡陋基本幾何體**，以 `THREE.InstancedMesh` 批次渲染，兼顧高幀率與 100% 統一美術風格。

---

## 三、全遊戲 2 座城鎮 ＋ 20 張野外地圖 1:1 場景重製總表

### A. 兩大主城（最優先改造，玩家最常停留的門面）

| 城鎮 | 選用成品套裝（主要＋副景） | 佈局與美感規劃 |
| :--- | :--- | :--- |
| **燈谷鎮（Lantern Vale Town）** | 主體：`Low Poly Autumn / Location village autumn`<br>港口：`Low Poly Sea / Location trade port` ＋ `Location lighthouse pier` | 中央廣場以溫馨斜頂木屋群環繞噴泉與公告板（酒館、鐵匠鋪、草藥鋪、造型工坊各自對應專屬木屋，告別方塊屋）；南側直通 `trade port` 木造商港與 `lighthouse pier` 星燈渡輪燈塔碼頭，點綴暖黃像素燈籠與圍欄花圃。 |
| **餘燼前哨站（Ember Outpost）** | 主體：`Low Poly Autumn / Location autumn mountain camping`<br>副景：`Low Poly Western / Location camp wild west` ＋ `Location tea house autumn forest` | 高地山脊冒險者營地，包含大型營火爐、木製瞭望哨、物資帳篷、茶屋休息站與前哨鐵匠台，展現前往高難度邊境前的溫暖避風港氣氛。 |

### B. 20 張野外地圖（依四大區域批次推進）

| # | 地圖名稱 | 層級 | 選用成品場景套裝（主地標 ＋ 探索副景） | 空間構圖與主題亮點 |
| :-: | :--- | :---: | :--- | :--- |
| 1 | **晨光草原** | 表層 | `Nature / Location mountain river planes` ＋ `Location bridge over the river` | 清澈溪流木橋橫跨草原，山坡點綴暖色農舍與風車式地標，開局即呈現明快治癒的 A Short Hike 冒險感。 |
| 2 | **低語森林** | 表層 | `Nature / Location camping birch forest` ＋ `Location forest waterfall` | 樺樹與松林交錯的林間營地，北側接入林間飛瀑與古木樹洞入口。 |
| 3 | **霧潮沼澤** | 表層 | `Island / Location shamanic island` ＋ `Autumn / Location abandoned house` | 迷霧淺灘上矗立巫覡圖騰島與傾頹木屋，搭配蘑菇叢與斷裂木棧道。 |
| 4 | **霜冬雪原** | 表層 | `Winter / Location winter town` ＋ `Location crystal mountain` ＋ `Location river winter house` | 雪國木屋聚落沿冰河展開，遠方聳立發光水晶雪山，襯托冰湖滑行機制。 |
| 5 | **燼煙火岩區** | 表層 | `Western / Location coal mine` ＋ `Location bridge over water gorge` | 火山裂谷上橫跨焦黑木橋，結合熔岩礦坑支架與餘燼鍛爐入口。 |
| 6 | **古樹林** | 表層 | `Nature / Location mountain forest` ＋ `Japanese / Location old palace forest` | 深邃巨木山林間隱現青苔古殿遺跡，營造鹿王樹心秘境的莊嚴感。 |
| 7 | **浮空遺跡群** | 天穹 | `Island / Location three level island` ＋ `Sea / Location ancient artifacts` | 層疊三層浮島與古代石環陣列，搭配斷橋跳台與星穹古塔。 |
| 8 | **珊瑚潮汐灣** | 深淵/海 | `Island / Location adventure island` ＋ `Location fishing Island` ＋ `Nature / Location beach` | 金黃沙灘、漁村棧橋、棕櫚小島與海蝕洞口，洋溢熱帶航海氛圍。 |
| 9 | **沉沒電光都** | 深淵 | `Sea / Location lighthouse pier` ＋ `Location mountain arch` ＋ `Location mysterious place` | 半沉於淺海的石拱門、殘破燈塔與秘境石柱，搭配雷電水面反應。 |
| 10 | **櫻花水都** | 天穹 | `Japanese / Location japanese lake` ＋ `Location japanese sanctuary park` ＋ `Location japanese traditional gate` | 朱紅鳥居、日式拱橋、湖畔亭閣與櫻花溫泉，重塑最具辨識度的東方水鄉。 |
| 11 | **蒼穹巨環谷** | 天穹 | `Nature / Location air balloons` ＋ `Island / Location waterfall island` | 繽紛熱氣球漂浮於瀑布環谷之上，成為滑翔與高空跳躍的絕佳舞台。 |
| 12 | **紅楓工坊谷** | 表層 | `Autumn / Location autumn hot springs` ＋ `Location tea house autumn forest` ＋ `Location autumn harvest` | 滿山紅葉環繞露天溫泉、木造工坊茶屋與秋收穀倉，視覺暖度滿分。 |
| 13 | **黃金風沙原** | 表層 | `Desert / Location arab castle` ＋ `Location settlement desert` ＋ `Location lighthouse desert` | 沙漠綠洲聚落、穹頂古城與沙海燈塔，呼應流沙滑行（`sand_surf`）。 |
| 14 | **太陽金字塔聖殿** | 表層 | `Desert / Location desert pyramids` ＋ `Location temple deserts` ＋ `Location roman ruins` | 宏偉階梯金字塔居中聳立，周圍環繞柱廊神殿與法老秘陵入口。 |
| 15 | **失落藤蔓神廟** | 表層 | `Desert / Location tropical ruins` ＋ `Island / Location stone island` ＋ `Location treasure Island` | 叢林藤蔓纏繞的石造古廟與寶藏遺跡，結合藤蔓飛躍（`vine_leap`）。 |
| 16 | **幽霧哥德墓園** | 深淵 | `Autumn / Location cemetery haunted house` ＋ `Env halloween` | 鐵藝墓園大門、歪斜墓碑群、枯樹與陰森鬼屋，搭配提燈照明機制（`lantern_glow`）。 |
| 17 | **深淵哥德古堡** | 深淵 | `Autumn / Location abandoned house` ＋ `Location cemetery haunted house` ＋ `Sea / Location secret Island` | 峭壁孤島上的高聳古堡建築群與斷崖鐵橋，營造壓迫感十足的血月古堡。 |
| 18 | **深海螢光沉淵** | 深淵 | `Sea / Location sea monster attack` ＋ `Location mysterious place` ＋ `Crystal stones` | 巨型海怪殘骸、沉沒神殿與發光水晶礁群，呼應深海低重力（`low_gravity`）。 |
| 19 | **星際白銀前哨站** | 天穹 | `Space / Location space station` ＋ `Location futuristics station` ＋ `Location space shuttle launch` | 科幻白色太空基地、發射台與能量核心，呼應超載回魔（`overcharge`）。 |
| 20 | **異星蜂巢裂谷** | 天穹 | `Space / Location fantastic planet` ＋ `Location planet craters` ＋ `Location ufo crash` | 異星奇幻地貌、巨型隕石坑與墜毀飛碟殘骸，作為 Lv.30 終局秘境。 |

---

## 四、美感、比例與效能統一規範

1. **角色與場景黃金比例校準**：
   - 玩家模組化英雄縮放為 `0.88`（身高約 `1.15m`），因此所有成品場景匯入時統一校準建築門高至 `2.1–2.4m`（場景縮放係數約 `0.24–0.28`），確保角色穿梭木橋、進入村莊與站立於神殿台階時比例自然可愛，不會顯得像巨人或螞蟻。
2. **斜角像素鏡頭的「前低後高」層次原則**：
   - 因遊戲採固定斜角鏡頭（`camYaw = 0.62`），所有套裝擺放皆遵循**北側／西北側放置高大地標（山崖、主屋、高塔、金字塔），南側／東南側保持開闊廣場、溪流與低矮柵欄**，避免高屋頂長時間遮住玩家視線（仍保留 X-Ray 透視剪影作為雙重保險）。
3. **色彩與光影和諧**：
   - 所有匯入場景套用統一的 `MeshToonMaterial`（3 階賽璐璐漸層）＋ `NearestFilter` 清晰調色盤採樣，並隨遊戲晝夜系統（白晝暖陽／黃昏琥珀／夜晚提燈微光）自然變色，杜絕塑膠感。
4. **檔案大小與載入效能控制**：
   - 善用「單一調色盤＋網格共享」，單個套裝 GLB 僅約 `0.4–1.2 MB`，且採**按地圖動態延遲載入（Lazy Load + Cache）**，不增加首頁啟動負擔；共用樹石圍欄透過 `InstancedMesh` 壓低 Draw Call。

---

## 五、分階段實作路線圖（每階段皆自主實機截圖驗收）

| 階段 | 內容與交付成果 | 驗收方式 |
| :--- | :--- | :--- |
| **Phase W1** | 建立通用批次匯出腳本 `scripts/build_palmov_world.py`（支援抽離水板、自動輸出碰撞 footprint JSON）、產出共用道具庫 `palmov_props.glb` 與自然庫 `palmov_nature.glb`，並在 `world.js` 建立 `loadMapSetpiece()` 動態掛載與碰撞整合框架。 | 41+ 自動化測試全數通過 |
| **Phase W2** | **兩大主城全面翻新**（燈谷鎮＋餘燼前哨站）：導入 `village autumn`、`trade port`、`lighthouse pier`、`autumn mountain camping`，完全移除城內簡陋方塊屋、路燈與碼頭。 | 實機截圖檢視燈谷鎮廣場、渡輪碼頭與前哨站，調整構圖與 NPC 貼地位置 |
| **Phase W3** | **表層六區翻新（Fields #1–#6）**：晨光草原、低語森林、霧潮沼澤、霜冬雪原、燼煙火岩區、古樹林套裝落地。 | 逐張抽樣實機截圖檢視與尋路碰撞驗證 |
| **Phase W4** | **天穹／水都／秋楓六區翻新（Fields #7–#12）**：浮空遺跡、珊瑚灣、電光都、櫻花水都、蒼穹巨環谷、紅楓工坊谷。 | 實機截圖檢視櫻花鳥居、熱氣球谷與溫泉工坊 |
| **Phase W5** | **沙漠／哥德／深海／星際八區翻新（Fields #13–#20）**：金字塔、藤蔓神廟、哥德墓園古堡、海怪深淵、太空站與異星隕坑。 | 實機截圖檢視金字塔、哥德墓園與太空站 |
| **Phase W6** | **全面清掃舊幾何體與效能打磨**：徹底清除 `world.js` 剩餘簡陋幾何體、全地圖碰撞與傳送點自動化測試（Test #42）、效能 Instancing 檢查與總覽圖集交付。 | 全量邏輯與 Fuzz 測試通過＋最終實機預覽圖集 |
