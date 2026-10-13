# Quaternius Downtown City MegaKit — CC0 building modules (P1 staging)

This folder stages **four genuine architectural mesh modules** from the **free Standard** tier of Quaternius' **Downtown City MegaKit** (May 2026). They are **not** enabled in the running game.

## Scope and protected behavior

- Asset staging only. No changes to `index.html`, `src/rendering/`, road geometry, 15 Taipei routes, landmark identities, map data, checkpoints, gameplay, driving physics, collisions, timing, controls, scores, or deployment.
- The present Three.js V56 game remains unchanged. These geometry resources are available for a **separate, later, user-approved** rendering step, or for a parallel Unity-primary WebGL project.
- No full buildings or changes to the existing Taipei streets are claimed in this stage. A building facade/entry can later be constructed from these **modular building pieces**, preserving existing object anchors.

## Included meshes (original Quaternius geometry)

| Module | glTF | External geometry buffer | Intended visual usage |
| --- | --- | --- | --- |
| Brick_Plain_1 | `Brick_Plain_1.gltf` | `Brick_Plain_1.bin` | Brick wall / facade |
| Brick_RedWhite_DoubleWindow | `Brick_RedWhite_DoubleWindow.gltf` | `Brick_RedWhite_DoubleWindow.bin` | Brick window facade |
| Metal_Window | `Metal_Window.gltf` | `Metal_Window.bin` | Metal/concrete window facade |
| DoorFrame_Trim | `DoorFrame_Trim.gltf` | `DoorFrame_Trim.bin` | Entry doorway trim |

Four referenced texture maps ship with the models: `T_RedBrick_BaseColor.png`, `T_RedBrick_ORM.png`, `T_MetalConcrete_BaseColor.png`, `T_MetalConcrete_ORM.png`.

To keep a small browser-friendly **staging** subset (rather than the 223 MB download), glTF material documents were adapted: unavailable source-size normal/trim textures were detached, and untextured trim material surfaces use neutral color factors. **Vertex geometry and binary buffer contents are unchanged** from the credited mirror. Appearance has **not** been checked in a browser or Unity; no visual parity is claimed. Do not publish any asset replacement before a real deployed-Web visual acceptance test.

## Source, license, chain of custody

- **Original author:** Quaternius (Quaternius / `@Quaternius`).
- **Pack:** Downtown City MegaKit, **Standard (free)** tier.
- **Official pack and CC0 declaration:** https://quaternius.com/packs/downtowncitymegakit.html
- **Official free-tier download:** https://quaternius.itch.io/downtown-city-megakit
- **File source used for this selected subset:** https://github.com/AetherRadar/operation-steel-tide/tree/main/assets/models/quaternius_downtown_city
- **Source mirror notice:** `QUATERNIUS_LICENSE.txt` (copied verbatim from that repo).
- **License:** CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution:** Not legally required for CC0; retained voluntarily for provenance. This repo did not download or bundle the paid Source edition.

## Next step (NOT part of this branch step)

With explicit user approval, validate the staged models in a **separate preview**, measure glTF loading, draw calls and mobile GPU impact, then consider attaching **visual-only** facades to the existing roadside placement logic. Never alter Taipei routes or gameplay to fit art.
