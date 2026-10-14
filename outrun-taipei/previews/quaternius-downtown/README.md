# Quaternius Downtown building module preview — P2

**This is an isolated art-only inspector.** It does not run (or alter) the game and does not import gameplay code.

## Run locally

From the repository root on the **`art/quaternius-downtown-buildings-p1` branch**:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/previews/quaternius-downtown/`.

Do **not** use `file://`; glTF files load external buffers and textures over HTTP. The preview is intentionally not wired to the public game deployment. If you see the game from `main`, that is unrelated to this preview.

- Select one of **four** Quaternius CC0 building modules.
- Rotate, pan and zoom with a mouse or touch, or enable auto-rotation.
- Compare day/night preview illumination (not the game's lighting).
- Check mesh, triangle, bounding-box, material and draw-call counts.
- Models are automatically scaled and centred **only for inspection**.

## Preservation / checks

- Existing `index.html`, `src/`, gameplay controls and 15 Taipei road/landmark definitions are untouched.
- The existing `assets/vendor/three-r149.min.js` is used, with a small ESM export shim; upstream `r149` GLTFLoader, OrbitControls and BufferGeometryUtils are copied unmodified into `assets/vendor/three-r149/jsm/`.
- WebGL visual acceptance, mobile GPU benchmarks, deployment verification and road placement are **not completed** by staging this preview.
- Run `node tests/quaternius-preview.cjs` for static asset/dependency checks. This is not a GPU render or gameplay test.

## Licensing

Source building meshes and material maps: **Quaternius Downtown City MegaKit Standard**, CC0 1.0:
https://quaternius.com/packs/downtowncitymegakit.html

Original building source / modifications:
`assets/third_party/quaternius-downtown/README.md`.

Loader and controls: **three.js r149**, MIT License.
Official immutable source tag:
https://github.com/mrdoob/three.js/tree/r149/examples/jsm

License notice:
`assets/vendor/THREE_LICENSE.txt`.
