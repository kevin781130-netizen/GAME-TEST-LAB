# V62 FLOW CHAIN — independent preview

Source [PR #38](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/38), commit `ebb7552be528cd0e15ef99a88d331dcb0f84f49f`.

**Try:** [V62](./index.html) vs [V61](../outrun-taipei-v61-apex-preview/) vs [V60 Checkpoint](../outrun-taipei-v60-corner-preview/).

- A valid V61 corner awards CLEAN +240 or PERFECT +650.
- V62 chains consecutive V61 awards in a **16 s** window and gives +0/+120/+240/+360 extra points at FLOW ×1–4.
- FLOW ×N timer appears bottom-right and freezes on pause.
- Crash, off-road, stage transition or expiration breaks the chain.
- V60's vehicle handling, nitro, camera and routes remain unchanged.
- Scoring rules version 56.0 isolates previous local records.
- A separate source/preview checkpoint branch preserves user-approved V60 exactly.

CI gates: `npm test`, `npm run test:browser` on source commit. This deployment's actual GPU view/play feel requires player feedback, regardless of CI.
