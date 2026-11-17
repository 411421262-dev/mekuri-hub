# Pepper&Carrot 非官方來源插件

作者 David Revoy 的官方網站提供 [公開 API](https://www.peppercarrot.com/en/documentation/130_API.html)，供外部應用程式讀取漫畫。
作品、翻譯與繪圖依 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 授權；見 [官方授權與協作者署名](https://www.peppercarrot.com/en/about/index.html)。
本插件與原作者無隸屬或背書關係，插件程式碼依本目錄的 MIT LICENSE 提供。

## 行為與權限

- 只連線 `www.peppercarrot.com`：讀取 `0_sources/episodes-v1.json`，並交由 App 讀取同一網域的封面及漫畫頁。
- 只有 Pepper&Carrot 一部作品；搜尋空字串或 Pepper／Carrot 即可找到。
- 語言可選簡體中文（官方代碼 `cn`）、英文、法文、日文。官方目前沒有獨立的繁體中文版本。
- 不同語言使用不同作品與章節代碼，變更搜尋語言不會改變已加入書庫的版本。
- 只列出官方索引已提供該語言的章節，不靜默替換成其他語言。
- 預設使用 low-res，可切換 hi-res。依官方檔名保留 GIF 等格式，頁碼以數字排序。
- 包含標題頁及最後的作者、翻譯者、協作者署名頁；圖片未經修改。作品資訊附原作者、來源、授權與完整署名網址。
- 索引在每個插件的 storage 快取一小時；不快取漫畫圖片、不要求登入、不存取 Cookie、不收集使用者資料。

## 本機測試與打包

在 repo 根目錄執行：

```sh
npx mekuri-plugin test sdk/examples/peppercarrot-source
npx mekuri-plugin pack sdk/examples/peppercarrot-source
npx mekuri-plugin validate sdk/examples/peppercarrot-source/dist/0.1.0.mekuri-plugin
```

案例使用縮小的合成索引資料，沒有漫畫圖片，也不會連網。
`npm test` 會在 Windows、Android 的 SDK 模擬環境測試原始碼與插件包。

選擇性真實 API 檢查（需要網路）：

```sh
npm run check:peppercarrot
```

這會取得官方索引、檢查所有章節的頁面清單，並以 HEAD 抽查首章、GIF、十頁以上章節的封面、首末頁與 GIF URL，不下載漫畫圖片。
SDK 模擬環境通過仍需要在真正的 mekuri App 安裝插件包，驗證 UI、圖片顯示與離線下載。

## 發佈

打包檔位於本目錄的 `dist/0.1.0.mekuri-plugin`，可從 App 直接安裝。
公開上架須依 POLICY.md 由維護者審核。可以執行：

```sh
npx mekuri-plugin pack sdk/examples/peppercarrot-source --hub .
```

再依 PR 範本勾選來源合法聲明，提交 `plugins/io.github.mekuri.peppercarrot/`。
`index.json` 留待合併後由 CI 產生。
