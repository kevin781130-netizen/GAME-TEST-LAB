# V67 — COUNTERSTEER GRIP CATCH (isolated preview)

Source [PR #43](https://github.com/kevin781130-netizen/Outrun-Taipei/pull/43) at `3cae5f1213abaf7659eca0fd6d482147711d283d`.

### Try this mechanic
When the car is actively sliding sideways, **steer against the slip** to deliberately catch the lateral momentum (while retaining grip). Hold the correct direction briefly to see `SLIDE CAUGHT!`. The car remains physically in control of the driver; neutral steering or opposite input cannot auto-correct.

- Continuous, bounded actual **lateral-velocity** damping, not fake car-art translation.
- Mirrored for right/left drifting. No score points, nitro, new collision geometry or route layout.
- Competition rules bumped to **59.0** since vehicle physics have changed.
- Player-approved V60 checkpoint, V61–V66 previews, public production game untouched.

### Reference/provenance limits
Reviewed the racing category in [open-source-games](https://github.com/bobeff/open-source-games) and source modules from SuperTuxKart, VDrift and Dust Racing 2D. These are conceptual references, not copied GPL code.
Also inspected the uploaded Stage36 ZIP, which explicitly does not contain true MAME dynamic drift/collision trace confirmation. See source PR's `docs/V67_Grip_Catch_Source_Audit.md`.

### Side-by-side evaluation
- [V60 approved](../outrun-taipei-v60-corner-preview/)
- [V66 previous physics](../outrun-taipei-v66-drift-line-preview/)
- [V67 current](./index.html)

Try 160–220 KM/H in mirrored turns, countersteer and then release, road shoulder, road transitions, keyboard/gamepad. Source CI is not actual visual/GPU confirmation.
