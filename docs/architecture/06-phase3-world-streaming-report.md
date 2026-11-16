# 06 — Phase 3 World Streaming Report (`kanbale` Versioned Chunks Slice)

Date: 2026-11-16
Phase: **Phase 3 (Completed — Stop Gate Before Phase 4)**
Migrated Real Village Slice: **`kanbale` (`ကံပုလဲရွာ`) — 669 buildings, 45 road polylines, 50 patrol road-plots, 170 trees (`934` GeoJSON features across `8` versioned v2 tiles)**

---

## 1. Findings & Architecture Choices

1. **Root Cause of `main-*.js` Bundle Bloat**:
   - Before Phase 3, `src/data/villages/kanbale/index.ts` evaluated `kanbaleBuildings.ts` (`894,700` B, 52,638 lines) and `kanbaleRoads.ts` (`72,681` B, 4,621 lines) eagerly through `src/data/villages/index.ts` -> `src/data/ward.ts` and `src/game/editorRegions.ts` -> `src/game/regionObjectsMigration.ts` (triggered when `src/main.tsx` called `syncAllWorldEdits()`).
   - Extracting lightweight `kanbaleMeta.ts` (`kanbaleVillage.streamed = true`, `houses: []`, `roads: []`, `trees: []`, `largeTrees: []`, keeping `kanbaleDrain` and boundary points) + extracting `syncAllWorldEdits()` into `src/game/worldEditsSync.ts` completely eliminated eager bundling of Kanbale's 967 KB TypeScript tables and static editor migration maps from initial entry bundles.
2. **Versioned Spatial Chunks (`schemaVersion: 2`) & SHA-256 Verification**:
   - Extended `scripts/mapTiles.mjs` & `src/game/mapTileStore.ts` to emit and validate `schemaVersion: 2` manifests (`authority: "publisher-manifest"`, optional `regionId`, per-tile full SHA-256 content hashes, and asset dependencies) while preserving `schemaVersion: 1` compatibility for `sithar-fields`.
   - Created `scripts/buildKanbaleTiles.mjs`, projecting Kanbale buildings (`Polygon` rings + `anchorGeo`), roads (`LineString`), patrol segments (`road-plot` `Point`s preserving AH1 cross-border connectors `kanbale-rp-47..51`), and trees (`Point`) via `KANBALE_GEO_ORIGIN` (`94.064442, 23.163868`), `KANBALE_LOCAL_ANCHOR`, and `angle = Math.PI / 4` into `public/map/kanbale/68bfa30f429b9d52b602/manifest.json` (`8` tiles, max tile `71,868` B).
3. **Unified Streamed Chunk Lifecycle (`streamedChunkRegistry.ts`), Floating Origin & Pooled Assets**:
   - `KanbaleChunkTiles.tsx` streams at most `2` mobile / `4` desktop nearby tiles via `MapDataset` (prioritizing both camera focus and `destination` teleport target, plus pending corridor collision blocking while an active tile is mid-download).
   - Each chunk computes a Float64 `computeChunkOrigin(...)` (`floatingOrigin.ts`) and builds local `InstancedMesh` transforms relative to chunk origin before populating GPU Float32 buffers, reusing shared unit geometries (`BoxGeometry`, `PlaneGeometry`, `CylinderGeometry`, `SphereGeometry`) and materials via `StreamedAssetPool`.
   - Bespoke detailed TSX landmarks (`KanbaleFarmhouse` [`way/403027623`] & `KanbaleSchool` [`way/403030614`]) mount exclusively with their owning chunk (`!sourceIsEdited(id)`), preserving interior walkable floors and collision.
   - `KanbaleTileView` atomically calls `registerStreamedChunk(...)` & `registerGroundRegion(...)` on mount and calls `unregisterStreamedChunk(...)` + `releaseGroundRegion(...)` + pool `release()` on eviction/unmount, keeping `collision.ts`, `RobotBots.tsx`, `CarBots.tsx`, and `MapLabels.tsx` synchronized.
4. **Editor Round-Trips Without Eager Bundles (`kanbaleTiledEditor.ts`)**:
   - `WardVillageEditor.tsx` (`loadRegionLayoutAsync('kanbale')` / `getRegionAuthoredFeaturesAsync`), `KanbalePlan.tsx`, and `MapSelectionMap.tsx` hydrate Kanbale's 884 editable features and SVG footprints on demand from the checked-in versioned tiles, preserving `sourceId`, `sourceSnapshot`, `deletedSourceIds`, `mm-editor-region-v1:kanbale` persistence, and `sourceIsEdited` filtering in 3D chunks.

---

## 2. Measured Before vs. After Results

### Production Bundle & Audit Delta (`tsc -b && vite build` & `npm run map:audit`)
- **`dist/assets/main-*.js`**: `2,659.22 kB` (`gzip: 587.77 kB`) -> **`2,158.52 kB` (`gzip: 479.44 kB`)** (**-500.70 kB / -18.8% raw**, **-108.33 kB gzip**).
- **`dist/assets/KanbaleVillage-*.js`**: `12.55 kB` -> **`2.82 kB`** (**-9.73 kB**); `kanbaleTiledEditor-*.js`: **`2.61 kB`** (`gzip: 1.20 kB`).
- **Kanbale bulk ID check in `dist/assets/*.js`**: `0` occurrences (`way/403043712`, `way/1118505959`, `kanbale-rp-44` absent from every compiled JS chunk).
- **`npm run map:audit` Eager Features**: `5,862` -> **`4,973`** (`kanbale` eager features reduced from `889` to `0`, moved to `streamedDatasets`: `kanbale` v2 `8` tiles / `934` features, `maxTileBytes: 71868`).

### Verification Checks & Headless Chromium WebGL E2E (`npm test`, `verifyKanbaleStreamingBrowser.mjs`, `verifyWorldStreaming.mjs`)
- **`npm run server:check` & `npm run map:audit`**: passed (`exit 0`).
- **`npm test`**: **`297 / 297` passed** (`0` failed, `0` cancelled, `0` skipped; `39,198.60 ms`), covering new `tests/kanbaleStreaming.test.ts` plus updated `tests/mapTiles.test.ts` and `tests/performance.test.ts`.
- **`npm run build`**: passed (`432 modules transformed`, built in `8.91s`).
- **Kanbale Streaming Browser E2E (`scripts/verifyKanbaleStreamingBrowser.mjs`, `passed: true`)**:
  - **Myothar Spawn (`atSpawn`)**: `0` Kanbale chunks, `0` streamed building colliders, `0` active pool geometries.
  - **Teleport to Kanbale West (`atKanbaleWest`, `(458.67, -464.24)`)**: `4` bounded chunks (`kanbale-chunk-000000`, `kanbale-chunk-000003`, `kanbale-chunk-000001`, `kanbale-chunk-000005`), both detailed landmarks mounted (`kanbale-custom-farmhouse`, `kanbale-custom-school`), `271` streamed building colliders active, `239` draw calls, `107,898` tris.
  - **Travel East (`atKanbaleEast`, `(1385, -804)`)**: swapped to east chunks (`kanbale-chunk-000005`, `kanbale-chunk-000006`, `kanbale-chunk-000007`), **`reuseHits: 60`** on **`4`** active pooled unit geometries.
  - **Teleport Back to Myothar Spawn (`afterReturn`, `ward.spawn` `(139.87, 239.14)`)**: `0` Kanbale chunks, `0` building colliders, `0` labels, `0` pool refs, `0` active pool geometries/materials.
  - **Return to Kanbale (`secondVisit`)**: clean remount (`kanbale-chunk-000000`, `kanbale-chunk-000003`, `kanbale-chunk-000001`, `kanbale-chunk-000005`, `271` colliders) with zero runtime or console errors (`RobotBots.tsx` / `CarBots.tsx` dynamically key streamed patrols/traffic per route revision).
- **World Streaming Browser Check (`scripts/verifyWorldStreaming.mjs`, `passed: true`)**:
  - At initial spawn (`ward.spawn`), mounted `regions: ["detail-myothar", "detail-tharsi"]`, `kanbale` download phase `"idle"`, `kanbaleChunks: []`, `streamedStats.residentChunks: 0`, `poolStats.totalRefs: 0`.

> **Not Measured:** Physical Android APK/WebView FPS, real mobile GPU frame times, and thermal behavior remain **`not measured`** until Phase 4 hardware profiling. Also legacy non-Kanbale regions (`myothar`, `natmyaung`, `kalayArea1`, etc.) intentionally remain in the eager audit catalog for subsequent per-region migration.

---

## 3. Changed Files, Rollback & Gate

- **Added**:
  - `src/game/floatingOrigin.ts`
  - `src/game/streamedAssetPool.ts`
  - `src/game/streamedChunkRegistry.ts`
  - `src/game/worldEditsSync.ts`
  - `src/game/kanbaleTiledEditor.ts`
  - `src/data/villages/kanbale/kanbaleMeta.ts`
  - `src/data/kanbaleDataset.json`
  - `src/components/villages/kanbale/KanbaleChunkTiles.tsx`
  - `public/map/kanbale/68bfa30f429b9d52b602/manifest.json` + `tiles/*.json` (8 chunks)
  - `scripts/buildKanbaleTiles.mjs`
  - `scripts/verifyKanbaleStreamingBrowser.mjs`
  - `tests/kanbaleStreaming.test.ts`
  - `docs/architecture/06-phase3-world-streaming-report.md`
- **Modified**:
  - `scripts/mapTiles.mjs`, `scripts/auditMapData.mjs`, `package.json`
  - `src/data/types.ts`, `src/data/villages/kanbale/index.ts`, `src/data/villages/index.ts`
  - `src/game/mapTileStore.ts`, `src/game/collision.ts`, `src/game/editorRegions.ts`, `src/game/regionObjectsMigration.ts`
  - `src/main.tsx`, `src/components/MapDataset.tsx`, `src/components/StreamedWorld.tsx`, `src/components/DynamicWorldObjects.tsx`, `src/components/WardVillageEditor.tsx`, `src/components/RobotBots.tsx`, `src/components/CarBots.tsx`, `src/components/MapLabels.tsx`, `src/components/MapSelectionMap.tsx`, `src/components/villages/kanbale/KanbaleVillage.tsx`, `src/components/villages/kanbale/KanbalePlan.tsx`
  - `tests/performance.test.ts`, `tests/fixtures/worldPerformance.tsx`
- **Rollback**: Original Kanbale source files (`kanbaleBuildings.ts`, `kanbaleRoads.ts`) are untouched on disk; switching `kanbaleMeta.ts` / `KanbaleVillage.tsx` back to importing them restores pre-Phase 3 synchronous bundling without affecting saved editor edits (`mm-editor-region-v1:kanbale`) or player saves.
- **Next Gate**: Stop after Phase 3 and await explicit user approval before starting **Phase 4 (Android Performance Baseline, Native Packaging & Content-Pack OTA)**.
