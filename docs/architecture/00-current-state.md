# 00 — Current Repository State & Baseline Audit

Date: 2026-11-16
Phase: **Phase 0 (Audit Only — No Production Edits)**
Repository: `c:\Users\EBPMyanmar\Desktop\Myanmar-Town-Prototype`

## 1. Root Config & Archive Discrepancy Inventory

| Item | Prompt ZIP Assumption | Actual Local Workspace Status | Evidence / Exact Observation |
|---|---|---|---|
| `package.json`, `package-lock.json` | Reported absent in ZIP | **Present** | React 19, R3F `^9.0.0`, Three `^0.180.0`, Vite `^6.3.0`, TS `~5.8.3`, Colyseus `0.17.56`/`0.17.43`, `@colyseus/schema` `4.0.31`, Express `5.3.0`, Capacitor 8 (`^8.6.2`), `@capgo/capacitor-updater` `^8.54.2`. |
| `vite.config.ts` | Reported absent in ZIP | **Present** | Entrypoints `index.html` + `candle-preview.html`; SPA `/map` rewrite + `/ota/*.json` local serve plugins; `esbuild` minify, `sourcemap: false`. |
| `capacitor.config.ts` | Reported absent in ZIP | **Present** | App ID `com.mmregion.town3d`, `webDir: 'dist'`, `androidScheme: 'https'`, `cleartext: false`, `CapacitorUpdater.autoUpdate: 'off'`. |
| `tsconfig.json`, `server/tsconfig.json` | Unverified in ZIP | **Present** | Client `strict: true`, `allowImportingTsExtensions: true`; server checks `server/`, `shared/`, `tests/multiplayer.test.ts`, `src/multiplayer/session.ts` with `NodeNext`. |
| `.github/workflows/release-ota.yml`, `vercel.json`, `.env.example`, `.gitignore` | Unverified | **Present** | OTA CI runs `npm test`, `npm run map:audit`, `npm run build`, OTA packaging, Vercel deploy. **Gap:** omits `npm run server:check`, browser E2E, and physical Android instrumentation. |
| **Still Absent / Unconfigured** | N/A | **Missing in Actual Repo** | `.gitattributes` (Git LFS), `blender` binary in PATH, GLB optimization deps (`@gltf-transform/*`, Draco, Meshopt, KTX2), PostgreSQL/DB migrations, auth/session identity backend, `services/api`, `infra/`, and monorepo workspaces (`apps/`, `packages/`). |

## 2. Measured Codebase & Asset Inventory

### Bundle & Asset Byte Sizes (Verified via `Get-ChildItem` & `npm run build`)
- `src/data/`: `4,327,908` B (~4.13 MiB) TypeScript/JSON region datasets.
- `src/assets/`: `13,063,305` B (~12.46 MiB; includes `boy.glb` 3,801,836 B & `girl.glb` 8,502,652 B).
- `public/models/`: `5,896,956` B (`canolia-character.glb` 2,151,492 B & `ghost-woman.glb` 3,745,464 B).
- `public/motions/`: `2,451,788` B (~2.34 MiB) across 31 extracted skeleton-only animation GLBs (`dance/`, `ghost/`, `interactions/`, `movement/`, `reactions/`, `training/`).
- **Duplicate/Source Raw 3D Assets in Repo**: Root contains `boy hit fight dive.glb` (4,739,852 B), `boy t post.glb` (3,801,836 B), `boy wait.glb` (3,114,384 B), `dance group.glb` (4,788,464 B), `girl (1).glb` (8,502,580 B); `characters/boy/boy.glb` (3,801,836 B); `artifacts/blender-character/` contains `reference_model.blend` (4,965,826 B), `reference_model_animated.blend` (6,846,599 B), `rig_material_source.blend` (4,965,826 B), `reference_model.glb` (1,244,908 B), `reference_model_animated.glb` (2,151,492 B). Neither `*.glb` nor `*.blend` is managed by `.gitattributes` Git LFS.
- `dist/` (production build): `28,828,799` B (~27.49 MiB). Largest chunks: `girl-noGDDOat.glb` (8,502.65 kB), `boy-BXkAcNd8.glb` (3,801.84 kB), `main-BkGfGtMr.js` (2,659.05 kB / 587.72 kB gzip), `Candle-BpLMVlmn.js` (1,141.08 kB / 317.03 kB gzip).
- `android/app/src/main/assets/public/`: `28,875,067` B (~27.54 MiB).

## 3. Subsystem Audit (Owner, State & Gaps)

### A. World, Regions & Rendering (`src/data/*`, `src/components/StreamedWorld.tsx`, `src/game/mapTileStore.ts`, `src/game/staticBatch.ts`)
- **Legacy Eager Architecture**: 11 regions totaling `5,862` unique features (`myothar` 1,403 bldgs, `kanbale` 669, `natmyaung` 445, `kyarinn` 394, `htaukkyant` 381, `tharsi` 320, `htomar` 235, `tharyargone` 205, `chinsai` 100, `zingalin` 100, `sithar` 91) are imported eagerly via `src/data/ward.ts`, `src/data/villages/index.ts`, `src/components/regionAssets.ts`, `src/game/collision.ts`, and `src/game/locationDetect.ts`.
- **Component-Level Streaming Only**: `RegionDownloadQueue` (`regionLoading.ts`) lazy-imports React 3D scene components (`StreamedWorld.tsx`), maintains an LRU cache (`MAX_CACHED_REGIONS = 2` mobile / `5` desktop, pinning `myothar`), compiles non-mobile staging via `warmRegion`, and batches static `BoxGeometry`/`PlaneGeometry` primitives per 128m tile (`batchStaticMeshes` in `staticBatch.ts`).
- **Bounded JSON Tile Prototype**: `src/game/mapTileStore.ts` + `src/components/MapDataset.tsx` + `scripts/mapTiles.mjs` implement `schemaVersion: 1`, `EPSG:4326` manifest validation, BVH (`MapTileIndex`), streaming byte limits (256 KiB/tile, 256 features, 8,192 coords), failure backoff, and disposal — **only consumed by `SeparationFieldTiles.tsx` (`sithar-fields`)** at present.
- **Coordinate System**: `src/game/mapProjection.ts` uses per-region anchors, rotation, and heterogeneous `metersPerDegree` scales; global scene space has **no floating-origin rebasing**.

### B. Asset Registry, Library & Map Editor (`src/game/assetRegistry.ts`, `src/components/AssetLibraryPage.tsx`, `src/components/Asset3DRenderer.tsx`)
- `ASSET_REGISTRY` maps string `assetId` keys (`building:myothar-house`, `building:tea-shop`, `cultural:candle-in-holder`, etc.) to `AssetDefinition` metadata, 2D SVG `AssetFootprint`, collision descriptors, and `sourceComponent` names rendered in `Asset3DRenderer.tsx`. Missing from schema: semantic asset `version`, content `sha256`, provenance/license, skeleton/clip links, LODs, and tri/VRAM budgets.
- `customAssets.ts` enforces 1..40 geometric parts and persists up to 200 items in `localStorage` (`myanmar-town-custom-assets-v1`), calling Gemini directly from client browsers.
- `editorRegions.ts` / `worldLayout.ts` / `worldEdits.ts` persist region edits in `localStorage` (`mm-editor-region-v1:<id>`). `mapPermissions.ts` (`getStoredMapRole`) **defaults to `'admin'` client-side**.

### C. Characters & Animation (`src/animation/*`, `src/components/GlbHuman.tsx`, `src/components/BlenderCharacter.tsx`)
- `src/animation/core/` (`MotionLoader`, `MotionRegistry`, `MotionCache`, `AnimationController`, `AnimationStateMachine`) + `src/animation/retargeting/` (`BoneMapping`, `SkeletonAnalyzer`, `SkeletonRetargeter`) support 24 shared Mixamo motion clips loaded cleanly on demand as skeleton-only GLBs without duplicating meshes/textures.
- `GlbHuman.tsx` + `glbHuman.ts` synthesize 52-bone locomotion procedurally onto cloned skeletons and clamp textures at runtime (`clampGltfTextures`) using Canvas downscaling; `BlenderCharacter.tsx` loads `canolia-character.glb`. **Gap:** no GPU instancing or LOD switching for crowds; `scripts/extractGhostAssets.mjs` embeds an external local Windows Downloads path.

### D. Single-Player Horror AI, Safe Zone & Audio (`src/game/ghostAi.ts`, `playerHomeProtection.ts`, `src/game/audio/*`)
- Three independent ghosts (`hunter`, `ambusher`, `stalker`) traverse obstacle-clear waypoint graphs across 8 Myothar zones (guaranteeing `warehouse-row`), enforcing collision/traffic checks and `playerHomeProtection.ts` safe-zone retreat invariants.
- Procedural Web Audio horror synthesis runs cleanly with zero external `.mp3`/`.wav`/`.ogg` network requests.

### E. Multiplayer & Economy / Social / Delivery (`server/`, `shared/network.ts`, `src/multiplayer/*`, `src/game/subscriptionShop.ts`)
- **Multiplayer (`TownPresenceRoom.ts`)**: Presence-only Colyseus `0.17` prototype (`MAX_PLAYERS = 8`, `PROTOCOL_VERSION = 1`), guest profile sanitization (`parseJoinPresence`), server-assigned spawn slots, and strict rejection (`PROTOCOL_ERROR`) of all incoming gameplay messages. Zero authentication, zero server movement/combat/state authority.
- **Combat / War / Social / Economy / Delivery**: **Absent**. Only `SubscriptionBillboard` / `SubscriptionShopDialog` / `onlineServices.ts` exist to open an external HTTPS shop URL in Chrome Custom Tabs or a new browser tab.

### F. Android Capacitor & OTA (`android/`, `capacitor.config.ts`, `src/services/assetCacheManager.ts`, `offlineAssetResolver.ts`, `otaUpdater.ts`)
- Signed release build config (`android/app/build.gradle`) with `keystore.properties` present, `versionCode 1`, `versionName "1.0"`, `minifyEnabled false`, cleartext HTTP disabled (`usesCleartextTraffic="false"`).
- `AssetCacheManager` supports SHA-256 verification, atomic generation swap (`active`/`previous`/`staging`), delta diffing, and `128 MiB` storage limit; `OfflineAssetResolver` intercepts same-origin `GET` requests for offline/cached paths. **Gap:** 128 MiB web Cache quota and full-bundle asset embedding will not hold multi-region GLB packs across Myanmar.

## 4. Baseline Checks Observed (Phase 0 Run)

| Check Command | Status | Observed Result |
|---|---|---|
| `npm run server:check` | **PASS** (exit 0) | `tsc -p server/tsconfig.json` compiled cleanly with zero errors. |
| `npm run map:audit` | **PASS** (exit 0) | `"architecture": "legacy eager data; lazy 3D components"`, `totalFeatures: 5862` across 11 regions. |
| `npm test` | **PASS** (exit 0) | `284` tests passed, `0` failed, `0` skipped (`duration_ms: 35843.40`). |
| `npm run build` | **PASS** (exit 0) | `tsc -b && vite build` succeeded in `10.65s` (418 modules; chunk size warnings on `main` 2.66 MB, `Candle` 1.14 MB, `boy.glb` 3.80 MB, `girl.glb` 8.50 MB). |
| Physical Android device FPS, GPU VRAM, thermal throttle, Playwright soak, server load test | **`not measured`** | Hardware profiling, server concurrency saturation, and DB benchmarks require execution in Phases 4–7. |
