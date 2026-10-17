# V69 — NEUTRAL DRIFT EXIT SETTLE

Source [Outrun Taipei PR #45](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/45) at commit `0f34c78380703ea4024db473f669f811a241da00`.

## Driver experience
V68 progressively rebuilds lateral grip while a drift is recovering. V69 adds a **0.42-second neutral-input transition** to settle residual side momentum and body yaw **after the drift FSM genuinely returns to normal grip**.

- The automatic transition is activated only after a properly completed recover → grip state transition; no boost or score reward.
- When steering is near centre, side velocity gradually approaches the *current driver/road-defined* lateral target and yaw-rate fades.
- If the player immediately turns into another S-bend, the stabilizer **does not intervene**.
- Off-road, reversing, active drifting and low-speed driving receive no extra effect.
- Does not snap to centre, change traffic/track layout, speed, boost, score formulas or route switching.
- Physics has changed intentionally; competitive rule namespace **61.0** separates records from V68 60.0.

## Compare side by side
- [V60, approved](../outrun-taipei-v60-corner-preview/)
- [V68, previous drift recovery](../outrun-taipei-v68-regrip-preview/)
- [V69, new exit settle](./index.html)

Test a quick **right drift → left S bend**, and the mirror pattern. Let go of steering at corner exit and watch if the residual sideways wobble resolves naturally. Then steer into another bend quickly to ensure there is no artificial delay. Original public game and V60–V68 paths are unchanged.

Automated tests do not certify a real 3D/GPU playtest. Acceptance requires player feedback and deployed-page visual inspection.
