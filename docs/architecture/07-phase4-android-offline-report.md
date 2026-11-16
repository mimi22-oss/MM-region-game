# 07 — Phase 4 Android Performance Baseline, Offline Caching, Compatibility & Rollback Report

Date: 2026-11-16
Phase: **Phase 4 (Implementation & Desktop/Build Verification Complete — Ready for User Manual APK Device Test)**

---

## 1. Phase 4 Implementation Summary

1. **Android Baseline Instrumentation & Telemetry Export**
   - **`src/game/perfMetrics.ts` + `src/components/FrameBudget.tsx`**:
     - Records un-clamped per-frame render durations into fixed circular typed buffers (`Float64Array(512)` for frame times, `Float32Array(900)` for ~15 min of 1-Hz FPS samples) without per-frame heap allocation.
     - Tracks FPS (`current`, `avg`, `min`, `p1`, `p5`, `p50`), frame latency (`avg`, `p95`, `p99`, `max`), DPR adaptations, WebGL draw calls/triangles/geometries/textures, current & peak JS heap MB, active streamed chunk count (`residentChunks`, `buildingColliders`), and pooled geometry/material reuse.
     - Exposes `buildAndroidBaselineReport(...)` and `window.__MM_PERF_EXPORT__()` JSON reports.
   - **`src/game/startupDiagnostics.ts`**:
     - Mirrors current startup checkpoints and crash reports to persistent `localStorage` alongside `sessionStorage` so Android WebView process kills / OOMs across cold restarts survive `sessionStorage` loss.
     - Exposes `getFirstFrameMs()`, `getTimeToReadyMs()`, `getContextLostCount()`, and `getStartupSummary()`.

2. **Segmented Content-Pack Architecture & Persistent WebView Storage**
   - **`src/game/otaCompatibility.ts`**:
     - Added `ContentPackDescriptor`, `classifyContentPack`, `serializeContentPackDigestInput`, `buildContentPacks`, and `checkContentPackCompatibility` (sharing native compatibility gate logic with `checkUpdateCompatibility`).
     - Manifests remain backward-compatible while categorizing built assets into `core-shell`, `characters-core`, `npc-ghost`, `motions-shared`, `region-kanbale`, and `region-sithar-fields`.
   - **`src/services/assetCacheManager.ts`**:
     - Added `IndexedDbAssetBlobStore` (`mm-region-ota-db-v1`) wrapped by `AdaptiveWebAssetBlobStore` (IndexedDB primary -> CacheStorage -> memory fallback) plus `requestPersistentOfflineStorage()` (`navigator.storage.persist()` & `estimate()`).
     - Added per-pack `syncPack`, `rollbackPack`, `evictPack`, `rollbackPacksForCodeVersion`, and `getPackSummaries` alongside atomic whole-manifest `syncToManifest`, SHA-256 verification, budget protection, and sole-offline-copy preservation.
   - **`src/services/otaUpdater.ts`**:
     - Integrates storage diagnostics, per-pack sync/rollback (`downloadContentPack`, `rollbackContentPack`), `verifyOfflineIntegrity`, and cascading code+pack rollback on failed native OTA bundle activation.
   - **`scripts/generateOtaArtifacts.mjs` & `scripts/verifyOtaArtifacts.mjs`**:
     - Emits segmented pack metadata into `dist/ota/asset-manifest.json` + `dist/ota/packs.json` and validates every pack digest, file sum, and native compatibility gate.

3. **In-App Manual APK Inspection UI (`src/components/UpdateStatusPanel.tsx` + `src/style.css`)**
   - Added **Updates**, **Content Packs**, and **Device Baseline** tabs inside the `↻` dialog (`UpdateStatusDialog`):
     - **Device Baseline**: live FPS/p50/p5, frame p95, cold-start ms, draw calls, triangles, heap, streamed chunks, previous crash banner, plus **Copy Baseline JSON** and **Share / Save `.json`** (`navigator.share` / file download / selectable preview).
     - **Content Packs**: displays storage engine (`indexeddb` / `cache-storage` / `memory`), persistence grant, cached bytes/quota, pack breakdown, and per-pack Sync / Rollback / Integrity Check controls.

4. **Android Release Packaging (`android/app/build.gradle`, `android/app/proguard-rules.pro`)**
   - Enabled `minifyEnabled true` and `shrinkResources true` using `proguard-android-optimize.txt` with explicit Capacitor bridge, `@CapacitorPlugin`, `ee.forgr.capacitor_updater.**`, `MainActivity`, AndroidX SplashScreen, and `JavascriptInterface` keep rules.

---

## 2. Measured Build, Pack & Verification Results

### Android Signed Production APK Delta (`assembleRelease` + `apksigner verify`)
- **Signed Release APK** (`android/app/build/outputs/apk/release/app-release.apk` & `android/app/build/outputs/apk/release/mm region game.apk`):
  - Before (`11/16/2026 12:46:55 AM`): **`29,234,617` bytes (`27.88 MB`)**
  - After (`11/16/2026 10:37:49 AM`): **`22,967,231` bytes (`21.90 MB`)** (**`-6,267,386` bytes / `-21.4%`**)
- **`classes.dex`**: `10,376,148` B uncompressed (`3,743,968` B compressed) -> **`1,995,644` B uncompressed (`907,597` B compressed)** (**`-80.8%` raw**, **`-75.8%` compressed**).
- **Android `res/`**: `385` files (`4,414,180` B) -> **`347` files (`1,053,818` B)** (**`-76.1%` resource payload**).
- **`apksigner verify --verbose`**: **`Verifies`** (`v2: true`, `v3: true`, `Number of signers: 1`).

### Segmented Production OTA Pack Breakdown (`ota:manifest` & `ota:verify`)
- Total built web assets: `119` files, `28,868,759` bytes uncompressed, deterministic OTA ZIP `20,776,971` bytes (`otaPublishable=true`):
  - `core-shell` (required): `72` files (`7,710,310` B)
  - `characters-core` (required): `3` files (`14,455,980` B)
  - `npc-ghost` (required): `8` files (`4,269,028` B)
  - `motions-shared` (optional): `24` files (`1,928,224` B)
  - `region-kanbale` (optional): `9` files (`499,872` B)
  - `region-sithar-fields` (optional): `3` files (`5,345` B)

### Automated Checks & Headless Browser Verification
- **`npm run server:check`**: **passed** (`exit 0`).
- **`npm run map:audit`**: **passed** (`exit 0`; `kanbale` streamed `0` eager features, `4,973` total eager features).
- **`npm test`**: **303 / 303 passed** (`0` failed, `0` cancelled, `0` skipped; `44,723.98 ms`), including `tests/phase4OfflineAndPerf.test.ts` (6/6).
- **`npm run build`**: **passed** (`432 modules transformed`, built in `11.10s`, `dist/assets/main-zpiCzWGR.js` `2,189.64 kB` / gzip `487.82 kB`).
- **Headless Chromium Mobile Baseline (`scripts/verifyPhase4BaselineBrowser.mjs`, `412x915 @ 2.625x`, SwiftShader WebGL, `passed: true`)**:
  - Cold start: `firstFrameMs: 738.1 ms`, `timeToReadyMs: 4445.1 ms`, `contextLostCount: 0`.
  - Steady state on software renderer: `drawCalls: 189` (`maxDrawCalls: 1157`), `triangles: 234,232`, `geometries: 912`, `heapUsedMb: 308.6 MB`. *(Software SwiftShader FPS is `0.4–2.3` CPU rasterization only and does not reflect physical Android GPU FPS.)*
  - UI Baseline Export (`Device Baseline` -> `Copy Baseline JSON`): rendered `4,115`-char JSON report cleanly.
  - IndexedDB persistent blob write/read/SHA-256 check in Chromium: passed cleanly (`readBackLen: 21`), offline transition handled with `0` uncaught errors.

---

## 3. Manual Physical Android APK Test Checklist (Not Yet Measured)

> **Not Measured:** Physical Android GPU FPS percentiles, real mobile WebView cold-start latency, 15-minute thermal throttling behavior, and real on-device Airplane Mode / OTA rollback UX have **not** been measured in hardware (no ADB device connected here). Complete these checks with the manual APK before signing off for Phase 5:

1. Install **`android/app/build/outputs/apk/release/app-release.apk`** (copied also as **`android/app/build/outputs/apk/release/mm region game.apk`**) onto your Android test device(s).
2. **Offline Boot Check**: Enable Airplane Mode *before* launching the APK cold -> verify 3D town renders, player movement, Kanbale teleport/streaming (`KanbaleChunkTiles`), and Ghost NPC audio work offline (`↻` -> Connection: `Offline (Playable)`).
3. **Real Hardware Baseline Export**: Walk ~5–15 minutes around Myothar Ward and teleport to Kanbale -> tap Menu (`☰`) -> **`↻` App Updates & Offline Assets** -> **`Device Baseline`** tab -> tap **`Share / Save .json`** or **`Copy Baseline JSON`** and inspect real device `fps` (`p50`, `p5`, `p1`), `frameMs.p95`, `timeToReadyMs`, `peakHeapUsedMb`, and `dprAdaptations`.
4. **Content Pack & Rollback Verification**: Check **`Content Packs`** tab (`Storage Engine: indexeddb`), run **`Verify Checksums`**, verify **`OTA Updates`** offline behavior, and confirm zero missing Capacitor plugin bridges after R8 shrinking.

---

## 4. Rollback & Phase Gate

- **Rollback**:
  - Client OTA / packs: `@capgo/capacitor-updater` `reset({ toLastSuccessful: true })` and `assetCache.rollbackToPrevious()` / `rollbackPack(id)` revert cleanly to bundled APK assets.
  - Native APK shrinking: set `minifyEnabled false` / `shrinkResources false` in `android/app/build.gradle` if any unanticipated R8 reflection issue is discovered on manual device testing.
- **Next Gate**: Stop after Phase 4 until manual physical Android APK testing completes and user explicitly approves advancing to **Phase 5 (Authoritative Multiplayer & Combat Foundation)**.
