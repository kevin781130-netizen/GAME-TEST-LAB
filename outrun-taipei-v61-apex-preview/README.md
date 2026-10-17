# V61 APEX CHALLENGE — isolated playable preview

This is an **additive preview** of [V61 PR #37](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/37) built from `0bc28b32ca79b630d07d1a530b05c8dfda76d263`.

## What's new
- **CLEAN CORNER:** exit a sustained medium/tight corner without going off-road; +240 points.
- **PERFECT APEX:** the same clean exit, with ≥0.38s of active drift; +650 points.
- Automatically rejects too-short turns, collisions, offroad excursions, reversing and stage/route changes.
- No physics changes from the approved V60. High-speed corner difficulty and continuous stage drift remain exactly the same.
- Competition namespace 55.0, separate from approved V60 records.

## Saved checkpoint
- V60 source branch `checkpoint/v60-user-approved-20261017`.
- V60 preview branch `checkpoint/outrun-v60-user-approved-20261017`.
- Original [V60 preview](../outrun-taipei-v60-corner-preview/) untouched.

## Playtest
Play [V61](./index.html), try **grip vs drift** through 2A, 3B, 4B, 4D, or another medium/tight bend and look for the STYLE popup on exit. Compare [V60](../outrun-taipei-v60-corner-preview/) side-by-side. Both pages use the same renderer/Three.js.

`npm test` and Playwright browser CI on the source PR are separate from **actual GitHub Pages visual verification**, which remains to be completed. Your subjective driving impressions decide whether V61 ships.
