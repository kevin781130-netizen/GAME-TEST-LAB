# V64 CORNER COACH — isolated playtest

Source: [Outrun Taipei PR #40](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/40),
commit `fbf123b161a7e8b0c33c732233c2035951329e43`.

## What changed
After a qualifying V61 corner (clean or drift), the existing corner HUD
shows a brief **CORNER COACH** report for 4.5 in-game seconds:
`入 190 → 出 182 KM/H · 較上次 +12 · 最佳 182`.

- Uses actual speed when the bend started vs. successful exit.
- Compares only the **same route + similar bend-start position + turn
  direction**, to avoid misleading unrelated comparisons.
- Stores at most 64 corner observations **in this open browser page only**;
  restarting a run retains comparison history, refreshing the page clears it.
- Pausing freezes the report timer. The FLOW timer is repositioned to avoid
  covering the lower-right corner HUD.
- No extra scoring, no physical engine changes, no network calls or player
  identity tracking.
- Competition score version remains **57.0**, unchanged from V63.

## Compare / rollback
- [V60, player-approved checkpoint](../outrun-taipei-v60-corner-preview/)
- [V61 APEX](../outrun-taipei-v61-apex-preview/)
- [V62 FLOW](../outrun-taipei-v62-flow-preview/)
- [V63 SWITCHBACK](../outrun-taipei-v63-switchback-preview/)
- [V64 CORNER COACH](./index.html)

All older preview directories remain unchanged. Test in Desktop Chromium and
mobile/narrow layouts. CI regression pass is not a substitute for inspecting
this actual Pages view or testing whether the corner-report is readable.
