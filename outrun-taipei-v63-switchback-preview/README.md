# Outrun Taipei V63 — SWITCHBACK MASTER

Independent [source PR #39](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/39),
commit `682bd9f669e0c390032a751aff6ce6f60eea835e`.

## New: direction matters
- **SWITCHBACK MASTER +300** on a consecutive pair of *earned* APEX corners
  in opposite road directions (left → right or right → left), within the
  existing 16-second FLOW chain window.
- V61 clean +240 or perfect +650, and V62 0/120/240/360 FLOW rewards all remain.
- Same-direction bends and the first bend in a new chain cannot receive
  a switchback bonus; an unearned short corner cannot change the prior
  turn direction.
- The existing STYLE popup itemizes APEX + FLOW + S-TURN points.
- Crashes, off-road excursions, stage boundaries and FLOW timeout reset
  the direction register.
- V60 handling, physics, drift, nitro, camera, models and route layout unchanged.
- Competition rules version `57.0` isolates previous leaderboard scores.

## Safety / compare
- [Approved V60 checkpoint](../outrun-taipei-v60-corner-preview/)
- [V61 Apex preview](../outrun-taipei-v61-apex-preview/)
- [V62 Flow preview](../outrun-taipei-v62-flow-preview/)
- [V63 Switchback preview](./index.html)

Static preview HTML differs from its source commit **only in title and
build banner**; renderer and Three.js files match original blob SHAs.
The preview's `build-info.json` records source commit and paths.

Source CI and live rendered browser evidence are different acceptance
gates. Test this route-specific mechanic on S-shaped mountain roads.
