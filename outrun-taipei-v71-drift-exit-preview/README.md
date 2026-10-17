# V71 — Drift Exit Lab (independent web preview)

Source: [Outrun-Taipei PR #47](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/47) at commit `f31b4bed2da5c4a792faf0ffedb2a9ec62025c19`. CI `39053115353`: full `npm test` and Chromium browser automation successful.

## How to try
1. Select **自由巡航** (cruise) and start driving.
2. Press **K** (or click **DRIFT LAB**) to show the A/B diagnostics panel.
3. Press **B** to compare **V68 SETTLE OFF** with **V69 SETTLE ON** on comparable corners at similar speeds.
4. New **有效 0.42s 出彎** reports only fully completed forward, on-road, neutral-steer exit windows. Mid-window steering, new drift, pause, crash, offroad or switching modes discard that partial sample.
5. The older **全程** statistic remains, explicitly labeled. Neither measure is a controlled identical-input comparison; do not interpret it as proof of superiority.

Statistics are only kept in memory. Closing panel restores V69. Timed and arcade modes use V69 exclusively; competition record namespace stays 61.0.

## Protected versions
- [Official playable game](../outrun-taipei/)
- [Approved V60 checkpoint](../outrun-taipei-v60-corner-preview/)
- [Previous V70 A/B lab](../outrun-taipei-v70-drift-lab-preview/)

Only this new directory was created; old files were not edited. The index is byte-for-byte equal to the source branch except for its HTML title and visible build banner. Assets are reused from the V70 preview under a new folder path using an identical Git tree.

### Acceptance
GitHub CI was green for the source commit. Published CDN health and actual rendered WebGL visuals / playfeel need separate confirmation; browser automation cannot establish visual quality.
