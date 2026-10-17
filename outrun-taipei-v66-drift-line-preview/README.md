# V66 CONTROLLED DRIFT LINE — isolated experiment

Source: [Outrun Taipei PR #42](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/42),
commit `64f7bc701e664f3cc7a0f793479bfed216a4d833`.

## Driving changes
- Reduces visual yaw over-rotation by separating actual body heading from decorative extra slip; maximum 46° with bend-dependent cap.
- Reduces whole-car "thrown to the outside" presentation (body 28% and shadow 35% of former visual translation). Rear swing remains visible.
- Small input-based inward steering authority only on active, sufficiently grippy drifts in curved roads; no auto-rail inward movement under neutral input or countersteer.
- Supports either left or right curves symmetrically and retains V60's core physics/boost/drift input mechanics.
- Competitive rules **58.0** because lateral physics has changed. Old leaderboard records are not mixed.

## Attribution and limits
The user's past Stage36 reverse-engineering package is not available in this session. Its previously described input-event and replay methodology inspired the tests. No original arcade handling coefficients were measured or reproduced. See `docs/V66_Stage36_Inspired_Drift_Line_Audit.md` in the PR.

## Test side by side
- [User-approved V60](../outrun-taipei-v60-corner-preview/)
- [Previous V65](../outrun-taipei-v65-corner-drill/)
- [New V66](./index.html)

Try 170–210 KM/H: right bend with right input, left bend with left input, turn-in then countersteer; repeat at over-speed to ensure off-road risk remains. Test smooth road transitions and mobile controls. No earlier Pages preview or production route is overwritten.
