# Quaternius Roadside V56.1A — independent playable integration (P15)

## Public test entry (experimental only)

[Open experimental driving + Quaternius](https://kevin781130-netizen.github.io/GAME-TEST-LAB/outrun-taipei-quaternius/)

Original preserved production playtest:
[Outrun Taipei V56.1A](https://kevin781130-netizen.github.io/GAME-TEST-LAB/outrun-taipei/)

Art-only orbit inspector:
[Quaternius streetblock inspector](https://kevin781130-netizen.github.io/GAME-TEST-LAB/outrun-taipei/previews/quaternius-downtown/streetblock.html)

## What the experimental version does

The experimental `outrun-taipei-quaternius/` directory contains a **copy** of the existing deployed V56.1A HTML and full Three.js renderer with one visual-only extension hook. Its rendering adapter adds **genuine Quaternius CC0 glTF** modules and P7/P14 Traditional Chinese shopfront detail to the **actual V56 roadway perspective**. Every frame, art placement is derived from the original `previewPoints` output and the existing lane corridor's **outside edge**: no map or world coordinates or new collision volumes are generated.

- **Default OFF:** new art is not loaded until the user clicks the dedicated `新街屋` toggle. This allows A/B comparison.
- **Six maximum visual placements**, alternating three per side; **two near original full glTF facades** plus up to four far instanced-box proxies. Near shops use CC0 source geometry/PBR maps, P7 details and shared P9 Chinese sign atlas.
- Place frontage **8m farther laterally than the outside edge of the existing V56 driveable lane**; projecting awnings and signs remain more than ~5m outside the road boundary by model design. This is **visual clearance math**, not a proven collision test.
- Automatically hide new art in **LOW graphics quality**, or mountain/coastal archetypes.
- If loading fails, status reports the error, toggle resets to OFF, old V56 road/car/traffic rendering remains active.
- Return to V56.1A in one click using the visible `回原版` link. The original V56.1A deployment has not been replaced.
- No route list edits, landmark ID edits, physics, scoring, drive inputs, player drift/nitro, traffic mechanics or collision changes. Sidecar script receives read-only visual state.

## Protected original

This directory is a **separate copy**, not a new build of the main game. The original `outrun-taipei/index.html`, `outrun-taipei/assets/hybrid-renderer.js` and `outrun-taipei/build-info.json` retain their exact pre-change Git object SHA. The original V56.1A source was deployed from `fix/v56-1a-whitebox-drift-camera`; its production behaviour is not overwritten by merging Quaternius P14 to `Outrun-Taipei/main`.

The Quaternius P1–P14 assets are now present in `Outrun-Taipei/main` SHA `f5d33732d0161eb961823ff2521830a0097f61ed`; the source asset objects are copied byte-for-byte by SHA into this experimental directory.

## Controls

Use the original game menu to start driving; W/↑ accelerate, S/↓ brake, left/right steer, Shift drift, N nitro. Turn on `新街屋` after the 3D scene loads. On low GPU performance, use OFF or LOW mode. The performance ceiling (6 models, 2 near) is a safety budget, **not a verified FPS improvement**.

## QA and limits

```sh
node outrun-taipei-quaternius/qa-check.cjs
```

This checks deterministic placement clearance for straight and split roads, scene injection strings, OFF default, LOW automatic disable, and source isolation. It **does not** prove that the actual deployed website currently renders, that the texture/font looks good, or that real-world phone GPU performance is acceptable.

**Visual verification pending:** inspect actual public website screenshots, browser developer console and FPS on a normal device. The assistant environment currently cannot execute a reliable live Chromium/WebGL session. If Pages is still publishing, the website may temporarily return 404. Neither a GitHub commit nor static test constitutes browser acceptance.

## Rollback

- **Immediately:** click `新街屋：開啟` to turn OFF and keep driving, or open the original unchanged [V56.1A](/GAME-TEST-LAB/outrun-taipei/).
- **Repository rollback:** remove only `outrun-taipei-quaternius/` from the GAME-TEST-LAB static site in a new commit; do not modify `outrun-taipei/`.
- Art changes in `Outrun-Taipei/main` are **additions of preview sources/CC0 assets**; original gameplay code remains intact. The source art branch still exists for further experiments.

License: Quaternius Downtown City MegaKit Standard CC0 1.0; Three.js r149 MIT.

**No claim of verified deployed pixels, native mobile GPU FPS or production-ready collision separation.**
