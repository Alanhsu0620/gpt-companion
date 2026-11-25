# GPT Companion V1.1（GPS 診斷修正版）

這是一個可部署到 HTTPS 網址、再加入 iPhone 主畫面的 PWA 原型。它不需要 Mac 或 Apple Developer Program。

## V1.1 已包含
- 新增「測試 GPS 定位」按鈕：由使用者點擊直接觸發定位權限請求
- 顯示 HTTPS、安全環境、定位成功座標／精度及具體錯誤原因
- Leaflet 地圖 CDN 載入失敗時不再令整份 app.js 中止，GPS 與語音控制仍可運作
- 更新 Service Worker 快取版本，避免沿用舊 V1.0 程式

## V1.0 已包含
- 目的地搜尋（OpenStreetMap Nominatim）
- GPS 定位（瀏覽器 Geolocation）
- 路線及轉彎步驟（OSRM 公開 demo routing service）
- iPhone 系統語音播報（Web Speech API；實際聲線依 iOS 提供的語音而定）
- 一鍵開啟 Google Maps 導航
- PWA manifest、service worker、主畫面圖示
- 音量、語速、語音選擇及螢幕喚醒偏好

## 重要限制
1. **這不是 Google Maps 語音替換器。** iOS 不提供公開介面讓第三方 App 讀取 Google Maps App 內部的即時轉彎事件。本原型獨立計算路線，再另外開啟 Google Maps；兩邊路線可能不同。
2. **不保證背景導航。** iPhone Safari/PWA 在背景或鎖定螢幕後可能暫停 GPS、JavaScript 或語音。V1.0 請保持頁面在前景，並先在安全環境測試。
3. Web Speech API 的聲線由 iOS/Safari 決定；程式會優先選擇 zh-TW，無法保證每台 iPhone 都有女性聲線，也不是 ChatGPT 語音。
4. 路線使用 OSRM 公開示範服務及 Nominatim 公開地理編碼服務，沒有 SLA，不適合商業或安全關鍵導航。遵守服務使用政策，勿大量請求。
5. V1.0 顯示的即時剩餘距離為 GPS 到目的地的直線距離近似值，不是重新計算後的道路剩餘里程。請勿把它當成精準車載導航。
6. 不要在駕駛中操作手機。請由乘客設定目的地，並遵守道路交通規則。

## 用 Windows 免費部署到 GitHub Pages

### 1. 建立 GitHub repository
1. 登入 GitHub，建立新的 Public repository，名稱例如 `gpt-companion`。
2. 將本資料夾內所有檔案及 `icons` 資料夾上傳到 repository 根目錄。
3. 確認 `index.html` 位於根目錄，不要多包一層資料夾。

### 2. 開啟 GitHub Pages
1. 進入 repository 的 **Settings → Pages**。
2. 在 **Build and deployment** 選擇 **Deploy from a branch**。
3. Branch 選 `main`，資料夾選 `/(root)`，按 Save。
4. 等待 GitHub Pages 部署完成，網址通常為 `https://你的帳號.github.io/gpt-companion/`。

### 3. iPhone 安裝
1. 在 iPhone 使用 Safari 開啟 GitHub Pages 網址（必須是 HTTPS）。
2. 允許定位權限，建議選「使用 App 期間允許」及精確位置。
3. 點 Safari 分享按鈕 → **加入主畫面**。
4. 從主畫面開啟 GPT 伴駕。
5. 點「試聽」確認系統語音，再輸入目的地測試路線。

## 測試建議
- 先在室內或靜止狀態試聽語音、測試搜尋。
- 再由乘客操作，於熟悉的短路線驗證轉彎提示。
- 比較本 App 與 Google Maps 的路線；若不一致，以 Google Maps/道路現場標誌為準，V1.0 只作輔助提醒。
- 若語音清單沒有台灣中文聲線，可到 iPhone「設定 → 輔助使用 → 朗讀內容 → 聲音」檢查/下載中文聲音，再回到 Safari 重試。

## 檔案
- `index.html`：介面
- `styles.css`：樣式
- `app.js`：定位、路線、播報邏輯
- `manifest.webmanifest`：PWA 設定
- `sw.js`：靜態檔案快取
- `icons/`：主畫面圖示

## 未來 V1.1 / V2.0
- 加入可靠的路線重算及沿路距離計算
- 使用自有後端代理路線 API，避免公開 demo 服務限制
- 原生 iOS App / 背景定位需 Apple 開發者簽署與實機測試
- 如要真正同步 Google Maps 即時轉彎，需改用自有導航畫面與正式導航 SDK；無法靠插件讀取 Google Maps App 內部事件


## V1.1 GPS 除錯步驟
1. 將 ZIP 內 `GPT-Companion` 資料夾的**內容**上傳到 GitHub repository 根目錄，覆蓋同名檔案；不要把整個資料夾再包一層。
2. 等待 GitHub Pages 部署完成，確認網址以 `https://` 開頭。
3. iPhone Safari 先開啟網站，重新整理一次，再按「測試 GPS 定位」。
4. 首次詢問時按允許；若之前拒絕，請到 iPhone「設定 → 隱私權與安全性 → 定位服務 → Safari 網站」調整權限。
5. 若仍失敗，將頁面上 `定位失敗：` 後面的完整訊息回傳，以便判斷是權限、裝置定位或逾時問題。
6. 主畫面舊 PWA 若仍載入舊版，先從 Safari 網站重新載入；必要時刪除主畫面捷徑後，重新由 Safari「加入主畫面」。

注意：GPS 成功不代表可作為唯一導航工具。此版本仍是實驗性輔助提醒，路線服務及背景定位均有既有限制。
