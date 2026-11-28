# Beaconfall 音效與配樂

遊戲播放放在 `game/assets/audio` 的實錄音效及樂器演出。作者、授權及原始連結列於 [音檔來源](../../game/assets/audio/CREDITS.md)，`SOURCES.json` 記錄音效片段及配樂的原檔、剪輯起點和 SHA-256。每項錄音沿用其各自的授權。

- `effects.mp3` 為單聲道音效檔，`src/audio_clips.json` 記錄每個片段的起點與長度（秒）。加入新片段時保留片段間的靜音，並核對素材授權。若重新剪輯音檔，需同步更新所有受影響的片段時間。
- `src/action_audio.js` 定義事件音量、地面與裝備的取樣變化。頻繁事件會限速，避免戰鬥時大量聲音重疊。
- `src/music_themes.js` 定義區域的配樂路由，曲目儲存於 `assets/audio/music`。伺服器在切換區域時才載入需要的曲目，並在新曲準備好後淡入。港鎮、室內、草原、霧沼與洞窟各有配樂。部分地區共用曲目，Apex 會切至戰鬥配樂，Dimming 只改變配樂的低通濾波。
- 瀏覽器允許播放後才初始化音訊。主音量、配樂音量和音效音量分開控制。以 `file://` 開啟時，配樂使用瀏覽器音訊播放，區域換曲可用，淡入淡出和 Dimming 濾波需透過 HTTP 試玩。
- `npm run test:audio` 檢查音效索引、區域路由和 Flame 事件。先啟動本機伺服器，再執行 `npm run test:audio:browser`，驗證實際音檔解碼、可聞輸出、音量、區域及 Apex 換曲與 Dimming。
