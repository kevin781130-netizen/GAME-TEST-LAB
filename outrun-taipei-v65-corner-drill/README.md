# V65 CORNER DRILL — isolated test build

Source: [Outrun Taipei PR #41](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/41),
commit `5ca3ed121867cb06cd956119a1d1e5fd774ed0e4`.

### New player practice
- The right corner HUD identifies an active bend; on your first valid exit,
  it records a baseline. On the next attempt at the same bend, it displays
  `CORNER DRILL · 目標出彎 ≥ 175 KM/H` before the exit.
- Complete the same bend cleanly at or above the remembered prior best:
  `目標達成`. Otherwise: `再練一次`, with an attempts/hits counter.
- The previous best is frozen until after the attempt, so no moving-goalpost
  bug. Only truly awarded V61 APEX exits can count.
- State in memory only, bounded 64 distinct bend buckets, no network
  tracking, no new scoring, no nitro or driving changes.
- Competition namespace **57.0 unchanged** from V63/V64.

### Comparison
- [V60 Checkpoint](../outrun-taipei-v60-corner-preview/)
- [V64 Corner Coach](../outrun-taipei-v64-corner-coach/)
- [V65 Corner Drill](./index.html)

Original production entry and all previous isolated preview folders remain
untouched. The single bundled HTML differs from PR #41 source only in title
and visible build banner. CI must pass both `npm test` and Chromium browser
tests before release acceptance; deployed visual layout QA is separate.
