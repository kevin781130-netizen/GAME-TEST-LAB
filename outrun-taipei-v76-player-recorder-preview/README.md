# V76 — 玩家自願駕駛錄影：獨立前端試玩

Original feature: [Outrun-Taipei Draft PR #52](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/52).
This is an **isolated experimental preview**, not the official game or a release.

## 操作
1. 選擇 **自由巡航** 並開始遊戲（鍵盤 W、左右方向鍵、Shift 甩尾）。
2. 按 **K** 或點 **🔬 DRIFT LAB K**。
3. 按 **● 開始錄製**，自行開車；畫面顯示錄製秒數、甩尾及反打事件。
4. 按 **■ 停止錄製**，再按 **下載 JSON** 由瀏覽器儲存到自己的電腦。若不需要資料，按 **刪除錄影**。
5. 可按 **B** 切換 V68 / V69，但切換會結束當前錄製以防混合兩組物理。請先下載檔案再開始下一段錄製。

每段最多 90 秒 / 5,400 個遊戲更新影格（標稱 60 Hz）。只在使用者主動按下開始後錄製；資料僅存當前分頁記憶體，不會自動上傳、保存在伺服器或寫入 localStorage。頁面重置/重新整理會清除尚未下載的資料。下載後由使用者自行決定是否分享。

## Scope
- 保留原始遊戲物理、計分、氮氣、路線、競技規則 namespace `61.0`。
- 輸出的 JSON 是實際遊玩中的操作/動態紀錄，不是人類操駕舒適度的客觀評分，也不等於已驗證的視覺品質。
- 與來源分支唯一差異為 HTML title 與可見 build badge。3D 資源沿用上一版相同內容的 Git blob。
- [正式版](../outrun-taipei/) | [核准 V60](../outrun-taipei-v60-corner-preview/) | [V71 DRIFT LAB](../outrun-taipei-v71-drift-exit-preview/)
- 新目錄 `outrun-taipei-v76-player-recorder-preview/`，舊目錄全部保留。
