# Outrun Taipei — V60 高速彎道測試版

這是 **獨立的 V60 試玩路徑**，不取代 `outrun-taipei/` 正式測試入口，也不合併遊戲主線。

- 原始碼：[Outrun-Taipei PR #36](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/36)，commit `7dd64411e08143c355218dd57b5b01bf8b32db8a`
- 疊加修正：[PR #35](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/35)：切換路線時不中斷甩尾
- 物理規則 `54.0`，實際調整：中急彎更需要減速／甩尾，高速循跡有較明顯的外推與速度損失；HUD 顯示超速差
- 預覽版 `index.html` 僅更換頁面標題及明示 V60 的 build banner。渲染器、Three.js 為原始遊戲相同 blob SHA，完整放置在此資料夾中。
- 已通過原始碼分支 GitHub Actions `npm test` 與 `npm run test:browser`；公開 Pages 版本的實際 GPU/視覺手感尚需驗證。

## 試玩

在桌面瀏覽器開啟 [V60 Corner Preview](./index.html)。

1. 先在 1A 直線踩油門至 230–260 km/h，觀察是否仍能流暢加速。
2. 經過中急彎，分別試「直接轉向」與「減速＋Shift 甩尾」，注意道路外推、掉速和氮氣收益。
3. 在分岔處持續甩尾，看切換街區是否中斷側向慣性。
4. 與 [V58 參考版](../outrun-taipei-v58/) 對比手感，回報特定路線、速度與方向。

若顯示 `V60.0 / CORNER CHALLENGE` 才是這次預覽。沒有 GPU 實機量測前不得宣稱正式驗收通過。
