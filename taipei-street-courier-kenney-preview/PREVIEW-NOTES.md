# Kenney Street Courier Independent Playtest

URL query: `?externalart=on&artqa=1`.
This is a separate preview path, NOT a replacement of the existing public game.

Cosmetic source adapters: private `kevin781130-netizen/TAIPEI-STREET-COURIER@ad2b6ebac0061b6b966d7bb626217d390292de39`.
Base gameplay: original `taipei-street-courier/preview.html` V6.2 P2.6 split-source build.
Four pinned Kenney CC0 GLBs are verified with browser WebCrypto SHA-256 before GLTF parse.
Original street map, world chunks, NPC physics and existing gameplay are reused.
If the remote CDN is unreachable, models fail closed and original procedural meshes stay visible.
Use the QA panel for side-by-side PNG and JSON; a CANDIDATE is not a release approval.
Full esbuild build and real WebGL hardware verification have not been performed here.

## P8-27 original Taipei urban details

Open the exact preview URL with `?externalart=on&artqa=1&urban=on`. It adds visual-only arcade columns, glass shopfronts, generic original Chinese-language signs, balconies, air-conditioner boxes, rooftop water tanks/tin sheds and decorative parked scooter clusters along already-loaded NEAR-tier buildings. A separate `?urban=off` makes the identical street/gameplay reference view. Source version `4ba950ce39d7bcfbf27138d65624cbedc7a995f4` is intentionally pinned in `preview-source.json`.

All positions reuse streamed building reference records from the existing Taipei city; there is no imported Taipei Rush asset, change to road data, collision, NPC AI, delivery gameplay, or game save. Because this is an independent preview, P8-27 is opt-in even when `externalart=on`. Its draw calls/memory and full WebGL appearance still need user/browser verification.
