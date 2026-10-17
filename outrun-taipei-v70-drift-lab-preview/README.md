# V70 DRIFT LAB — optional isolated A/B playtest
Source: [PR #46](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/46) at `6d822cd86b7862ef9813a88ec42d2674c11934a6`.

## How to compare
1. Select **自由巡航** at startup and begin driving.
2. Click **🔬 DRIFT LAB K** below the game or press **K** to open a compact telemetry HUD in the top-left.
3. It displays actual chassis yaw, tire slip, **signed lateral speed**, road grip and drift state. Sampling frequency: around **20 Hz** while driving.
4. Press **B** or click **切換 V68 / V69** to switch just the optional neutral post-drift exit stabilizer. Other physics unchanged.
5. Re-run the same curve with comparable input/speed; compare in-memory per-mode average and peak absolute lateral velocity. This is descriptive **not** scientifically controlled because driving inputs differ.
6. Closing the panel **restores V69**. Competition and timed run modes always use the unchanged V69 physics; rules stay 61.0.

Buttons on-screen work with pointer/touch. Stats can be cleared, never saved or sent to a server.

## Safety
- [Original stable game](../outrun-taipei/)
- [User-approved V60 checkpoint](../outrun-taipei-v60-corner-preview/)
- [Previous V69 drift handling](../outrun-taipei-v69-exit-settle-preview/)
- [New V70 drift lab](./index.html)

Official production + V60–V69 previews untouched. CI `npm test`, Chromium Playwright and actual rendered 3D visual acceptance are distinct gates. The source matches the PR except document title and visible build banner.
