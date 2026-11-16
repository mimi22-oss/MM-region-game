# 05 — Phase 2 Asset Pipeline Prototype Report

Date: 2026-11-16
Phase: **Phase 2 (Completed — Stop Gate Before Phase 3)**
Pinned Blender Toolchain: **Blender 5.2.3 LTS** (`--factory-startup`) + `ffmpeg`/`ffprobe` (`libwebp`) + Three.js `0.180.0` `GLTFLoader` + `SkeletonAnalyzer`

---

## 1. Findings & Architecture Choices

1. **Texture-Bound vs. Mesh-Bound Assets (`girl.glb` vs. `canolia-character.glb`)**:
   - `src/assets/girl.glb` (`8,502,652` B) held `3,173` triangles and `8.15 MB` of raw textures (including a `4.82 MB` opaque `2048x2048` `rgb24` PNG + `4096x4096` JPEG). Category-bounded WebP resizing (`<= 1024px`) cut size by **89.85%** (`863,432` B) and cut SwiftShader WebGL load+render time from `621.9 ms` (`1102.2 ms` cold) down to `259.4 ms` (`146.5 ms`) with `0.122/255` mean pixel delta.
   - `src/assets/boy.glb` (`3,801,836` B, `10,962` tris) held a `4096x4096` JPEG (`2.33 MB`) plus `FB_ngon_encoding`. Optimizing to `<= 1024px` WebP + pruning `FB_ngon_encoding` reduced size by **58.46%** (`1,579,244` B) and WebGL load+render time from `2,077.6 ms` to `130.7 ms` with `0.084/255` mean pixel delta.
   - `public/models/ghost-woman.glb` (`3,745,464` B, `19,097` tris) retained `2.47 MB` of uncompressed mesh/skin accessors alongside `1024px` JPEGs; WebP texture conversion trimmed size by **14.84%** (`3,189,452` B, `0.161/255` pixel delta).
2. **Blender `.blend` Hygiene & Orphan Stripping (`export_blend.py`)**:
   - Inspecting `artifacts/blender-character/reference_model*.blend` showed `160` objects (`320,767+` tris) because viewport-disabled sculpt backup collections (`.002`, `.003`, `.005`), studio lights, cameras, `Studio floor`, curves, and `18` duplicate `.001` actions persisted inside the `.blend` scenes. Also local Blender add-ons (`tripo_addon`, `DEMoCap`) launched background sockets unless `--factory-startup` was passed.
   - Preserving only visible character meshes + their `ARMATURE` modifier target + referenced actions with recursive orphan purge brought `reference_model_animated.blend` from `383.59 s` (`9.16 MB`, `320,847` tris) down to **`2,150,972` B (`65,720` tris, `19` meshes, `1` armature, `9` animations)** and produced **`reference-model-animated.lod1.glb`** (`941,940` B, **`23,362` tris**, **-64.4% tris / -56.2% bytes**, `0.23/255` WebGL pixel diff).
3. **Skeleton-Only Shared Motion Library Extraction (`24` + prototype `14` clips)**:
   - Reusing `optimizeKeyframes.mjs` (unit scale strip, RDP curve decimation, `INT16` quaternion quantization, skeleton-only nodes) cut raw motion pack extracts (`3.11–4.79 MB`) down by **94.29%–99.17%** (`38–274 KB`) and accelerated Node `GLTFLoader` parse times from `11–42 ms` down to **`1.8–4.2 ms`**.
4. **Compression Boundary Note (Draco / Meshopt / KTX2)**:
   - Currently kept Web/Android runtime decoders zero-WASM (`new GLTFLoader()` plain with WebP/JPEG + skeleton/keyframe quantization) to guarantee offline Capacitor reliability. Dense geometry compression (`Meshopt`/`Draco`/BasisU `KTX2`) can be enabled per-asset inside `pipelines/asset-optimize/` once runtime decoders are shipped locally in Phase 3/4.

---

## 2. Prototype Benchmark Summary (`21` Published, `0` Quarantined)

Source manifest: `content/manifests/assets.v2.json` (`21` validated `AssetDefinitionV2` entries).

### Disk Size & Node `GLTFLoader` Parse Cost (`npm run pipeline:assets:prototype`)

| Asset ID | Category / Source | Before Bytes | After Bytes | Size Saved | Tris (After) | Node Decode (Before -> After) |
|---|---|---:|---:|---:|---:|---:|
| `character:canolia-reference-static` | `reference_model.blend` (LOD0 / LOD1) | 1,240,700 | 1,240,700 (LOD1: 465,940) | LOD1 -62.4% vs LOD0 (stripped 6.11 MB -> 1.24 MB) | 65,720 | 4.57 ms -> 6.43 ms |
| `character:canolia-reference-animated` | `reference_model_animated.blend` (LOD0 / LOD1) | 2,150,972 | 2,150,944 (LOD1: 941,940) | LOD1 -56.2% vs LOD0 | 65,720 (LOD1: 23,362) | 14.77 ms -> 10.97 ms |
| `character:canolia-rig-source` | `rig_material_source.blend` | 1,240,700 | 1,240,700 | 0% | 65,720 | 3.49 ms -> 3.76 ms |
| `character:boy-base` | `src/assets/boy.glb` | 3,801,836 | 1,579,244 | **58.46%** | 10,962 | 6.87 ms -> 4.41 ms |
| `character:girl-base` | `src/assets/girl.glb` | 8,502,652 | 863,432 | **89.85%** | 3,173 | 10.95 ms -> 2.89 ms |
| `character:ghost-woman` | `public/models/ghost-woman.glb` | 3,745,464 | 3,189,452 | **14.84%** | 19,097 | 6.52 ms -> 4.81 ms |
| `character:canolia-animated` | `public/models/canolia-character.glb` | 2,151,492 | 2,151,464 | 0% | 65,720 | 10.01 ms -> 8.69 ms |
| `cultural:motion-dance-01..03` (3 clips) | `dance group.glb` (4.79 MB each) | 4,788,464 | 148,560–273,636 | **94.29%–96.90%** | 0 | 17.18–23.05 ms -> 2.96–4.15 ms |
| `character:motion-vehicle-wait` | `boy wait.glb` | 3,114,384 | 38,624 | **98.76%** | 0 | 5.79 ms -> 1.87 ms |
| `character:motion-box-01..dive` (7 clips) | `boy hit fight dive.glb` | 4,739,852 | 39,452–147,892 | **96.88%–99.17%** | 0 | 33.78–42.38 ms -> 1.80–2.43 ms |
| `character:motion-ghost-*` (3 clips) | `public/motions/ghost/*.glb` | 38,368–84,008 | 38,368–83,768 | 0%–0.29% | 0 | 1.60–1.99 ms -> 1.81–1.91 ms |

### Headless Chromium (SwiftShader WebGL) Visual Parity & GPU Decode (`verifyAssetPipelineBrowser.mjs`)

| Model | Before Load+Render | After Load+Render | Silhouette Pixels (Before / After) | Mean RGB Diff (0–255) |
|---|---:|---:|---:|---:|
| `boy` (`src/assets/boy.glb`) | 2,077.6 ms | **130.7 ms** | 8,159 / 8,159 | **0.084** |
| `girl` (`src/assets/girl.glb`) | 621.9 ms | **259.4 ms** | 9,503 / 9,503 | **0.122** |
| `ghost-woman` (`public/models/ghost-woman.glb`) | 240.8 ms | 338.6 ms | 10,985 / 10,985 | **0.161** |
| `canolia-character` (`public/models/canolia-character.glb`) | 118.4 ms | 151.4 ms | 8,539 / 8,539 | **0** |
| `canolia-blend-lod1` (LOD0 vs LOD1 65k->23k tris) | 96.1 ms | **79.1 ms** | 8,539 / 8,528 | **0.230** |

*Note: Physical Android hardware WebView FPS, thermal throttling, and real mobile GPU decode timings are `not measured` until Phase 4.*

---

## 3. Deliverables, Integration, Rollback & Gate

- **Added Files**:
  - `.gitattributes` (Git LFS rules for `*.blend` & root archival source `.glb`s)
  - `pipelines/blender-export/export_blend.py`, `pipelines/blender-export/runExport.mjs`
  - `pipelines/asset-optimize/optimizeGlb.mjs`, `pipelines/asset-optimize/runPipeline.mjs`
  - `content/manifests/assets.v2.json`
  - `scripts/verifyAssetPipelineBrowser.mjs`
  - `tests/assetPipeline.test.ts`
- **Modified Files**:
  - `src/game/assetRegistry.ts` (`registerPublishedAssetV2`, `registerPublishedManifestV2`, `getAssetDefinitionV2`, `clearPublishedAssetsV2`)
  - `.gitignore` (ignores `artifacts/phase2-pipeline/` & `pipelines/quarantine/`)
  - `package.json` (`pipeline:assets:prototype` script + `tests/assetPipeline.test.ts` in `test`)
- **Rollback**: Production game components still load their original paths (`src/assets/boy.glb`, `girl.glb`, `public/models/*`); Phase 2 artifacts live separately in `artifacts/phase2-pipeline/` and `content/manifests/assets.v2.json`, and removing `registerPublishedManifestV2` / `pipelines/` restores pre-Phase 2 state immediately with zero impact on existing IDs or footprints.
- **Open Risks**: Actual swap of `src/assets/girl.glb` / `boy.glb` to optimized WebP binaries should wait until verified on target Android WebView devices in Phase 4 (ensuring Capacitor offline compatibility & visual quality on physical phones).
- **Next Gate**: Stop after Phase 2 and await explicit user approval before starting **Phase 3 (Spatial Village Chunk Streaming & Floating Origin)**.
