# V68 — PROGRESSIVE DRIFT REGRIP

Isolated draft [Outrun Taipei PR #44](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/44), original code `c096cebf01c73f80e3cf05887b39eb2da055e137`.

## Player-facing behavior
When a driver **exits** a drift by countersteering or releasing the steering, a sliding chassis should not visually look straight while still carrying so much uncorrected sideways inertia. V68 progressively re-establishes tire authority **toward the actual driver-commanded lateral trajectory** as the existing slip angle becomes small.

- Retains V66 inward control and V67 active-drift countersteer catch.
- Extra response only during the established `recover` state, on road with adequate grip and forward motion.
- No hard snap to the road centre or a preselected race line. Off-road recovery remains slippery.
- Does not change acceleration, braking, Nitro charging, stage transitions, competition scoring, camera or assets.
- Since the physical trajectory is revised, competition namespace becomes **60.0**.

## Compare
- [V60 approved checkpoint](../outrun-taipei-v60-corner-preview/)
- [V67 previous handling](../outrun-taipei-v67-grip-catch-preview/)
- [V68 regrip preview](./index.html)

Try right/left bends at 160–220 km/h, hold one turn, countersteer for recovery, then straighten input. Watch whether the vehicle naturally finishes its sideways motion without teleporting to the middle lane.

Older previews and production game untouched. Test suite and public visual QA are separate release gates.
