# 自動試玩與除錯

雙擊專案裡的 `啟動自動試玩.command`。它會重建遊戲並在 Chrome 開啟獨立觀戰視窗，直接跑普通洞窟「岔道伏擊」A／B。關閉觀戰視窗或在 Terminal 按 Ctrl+C 即可結束。觀戰面板可暫停和恢復單場模擬，並顯示當前策略、動作、FPS、瀏覽器警告與每輪審查結果。

## 遊玩與審查循環

1. 電腦讀取本機戰鬥狀態，經過遊戲的移動、攻擊、翻滾和藥瓶入口操作。每場使用 Lv.3 試玩角色，可敗北。開打後最多運行 44 秒模擬時間，暫停和分頁隱藏不計入這個限制。戰報 `durationMs` 是實際經過時間，與遊戲模擬時間可不同。
2. 每策略以 AB 和 BA 各跑一輪。候選包含先打狂豬、先打射手及提早閃避。同一建置兩種順序均有完整資料，且兩版的通關次數均未下降時，審查會採用通關次數增加的策略，或至少兩版均有通關且各版扣血沒有增加、合計減傷超過一成的策略。若兩版均全數通關且各版實扣生命相同，兩版的模擬用時都沒有增加且總用時縮短超過 15%，也可採用候選。
3. 有 JavaScript 錯誤、未出手、超時、結果不完整，或 P95 幀間隔超過 50 ms 的輪次保留作除錯資料。採用策略後，下一個循環會用它當基準再測。換建置會重取基準。自動採用的項目是試玩策略，遊戲改動需按戰報定位和回歸。電腦的通關結果適合驗證流程、除錯及做對照，真人研究另有流程。
4. 為避免污染帳號和進度，觀戰使用獨立瀏覽器資料與灰盒暫存角色。現有燈谷行伺服器可直接重用。若沒啟動，腳本會用不同的本機暫用埠啟動測試用伺服器。

## 紀錄位置

| 資料 | 位置 |
| --- | --- |
| 最新輪次、策略決策與問題清單 | `review/output/live/latest.json`。無視窗結果另存 `latest-headless.json` |
| 各輪原始事件、P95 幀間隔及瀏覽器錯誤 | `review/output/live/<時間>-<程序>-<輪次>.json` |
| 發生錯誤時的畫面 | `review/output/live/<同一輪次>.png` |
| 即時流程輸出 | `review/output/live/live-console.log` |
| Dev Mode 狀態、動作、慢幀、未處理例外及資源錯誤 | `server/data/dev-diagnostics.sqlite`。讀取用 `node scripts/review_dev_diagnostics.cjs` |

下次 AI 接手按 `AGENTS.md` 先讀待審紀錄。已讀游標由審查者按已查閱的事件範圍確認。

## 驗證

macOS 預設使用已安裝的 Chrome。其他平台先執行 `npx playwright install chromium`。從專案資料夾運行：

```bash
npm run build
npm run playtest:live
npm run playtest:live -- --headless --rounds=1
node tests/playtest_review.cjs
```

有限輪次的無視窗模式以退出碼回報是否通過審查門檻。桌機可用 `LV_CHROMIUM_CHANNEL=chrome` 指定 Chrome。macOS 預設使用硬體繪圖。其他平台的無視窗模式預設用軟體繪圖，可用 `LV_SOFTWARE_GL=0` 切回硬體，或用 `LV_SOFTWARE_GL=1` 強制軟體模式。現有場景回歸可用 `node tests/ambush_trial.cjs`，需要本機遊戲伺服器運行。


## 跨裝置試玩

把兩台電腦連到同一個區網。用另一台的瀏覽器開 `http://主機區網IP:8081/`。主機要保持開機。若連不上，先確認兩台使用同一個非訪客網路，主機 IP 仍相同，並檢查主機防火牆是否允許 Node 接入。

整體遊戲用根網址。只試打岔道伏擊時，在網址後加 `?playtest=ambush&order=AB`。要測真人同場，兩台使用相同的小隊連結，例如 `/?join=LANQA`，進城後從選單的組隊分類查看區域分流，確認在同一線。觀戰視窗在啟動自動試玩的電腦上。

角色和帳號存檔在各自瀏覽器，網址變更也會用另一份存檔。需要沿用角色時，在原電腦的帳號面板匯出備份碼，再到目的電腦匯入還原。匯入會覆蓋備份所含的角色欄位。

要手動重開區網測試場，從專案資料夾執行以下指令。將主機 IP 換成網路設定顯示的有線或 Wi-Fi IPv4 位址，並選一個空閒的埠：

```bash
HOST=192.168.31.89 PORT=8081 LV_DATABASE=:memory: LV_DEV_LOGS=0 node server/server.js
```

現行背景測試服務使用標籤 `local.lantern-vale.lan-playtest`，可用 `launchctl remove local.lantern-vale.lan-playtest` 停止。由 Terminal 手動開的服務用 Ctrl+C 停止。測試場的公會與交易資料在服務結束時清空。跨網路測試需要兩台都可連到的私人網路，或另外部署支援 WebSocket 的測試站。

## 跨網路邀請

短期外網試玩使用 Cloudflare Quick Tunnel，朋友用瀏覽器開 HTTPS 網址及輸入試玩密碼。主持人的 Mac 和兩項背景服務需保持運作。重開 Tunnel 會得到新網址。

本機外網版本使用 `127.0.0.1:8082` 的獨立遊戲服務、記憶體公會資料庫及 `LV_PLAYTEST_PASS_FILE`。啟動時用權限 0600 的本機檔案提供至少 22 字元的隨機 URL-safe 密碼。先啟動遊戲服務，再用 `cloudflared tunnel --url http://127.0.0.1:8082` 建立 HTTPS 入口。玩家登入後才可載入遊戲與素材，以及連上多人 WebSocket。受保護的測試服務關閉 Dev Mode 上傳。

目前 macOS 背景服務可用以下指令停止：

```bash
launchctl remove local.lantern-vale.remote-tunnel
launchctl remove local.lantern-vale.remote-origin
```

多人請用當次 HTTPS 網址加上 `?join=FRENDQA`。只打一場灰盒可用 `?playtest=ambush&order=AB`。角色仍可在原本瀏覽器用備份碼移轉。試玩密碼與服務日誌留在 gitignore 管理的 `server/data/remote-playtest/`。
