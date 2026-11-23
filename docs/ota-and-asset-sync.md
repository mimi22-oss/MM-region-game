# MM Region Game — Git-Driven Android OTA Updates & Offline Asset Sync

## 1. Architecture Audit & Baseline

| Layer | Configuration | Status |
| --- | --- | --- |
| App ID / Title | `com.mmregion.town3d` / `MM Region Game` | Audited |
| Android Version (`android/app/build.gradle`) | `versionCode 1`, `versionName "1.0"`, `minSdk 24`, `targetSdk 36` | Baseline `schemaVersion: 1` |
| Capacitor Core / Android / CLI | `^8.6.2` | Compatible |
| Capacitor Plugins | `@capacitor/app@8.1.2`, `@capacitor/browser@8.0.5`, `@capacitor/network@8.0.1`, `@capgo/capacitor-updater@8.54.2` | Synced |
| Web Hosting (`vercel.json`) | Vite static build (`dist/`), SPA rewrite `/((?!ota/).*) -> /index.html` | `/ota/*` un-cached |
| Android WebView Entrypoint (`capacitor.config.ts`) | Local `webDir: 'dist'` with `androidScheme: 'https'`, `cleartext: false`, `allowMixedContent: false` | Offline-first (never loads remote URL as entry point) |

### Bundled Fallback Guarantee

The APK ships with the complete web bundle and its offline pack catalog when prepared with `npm run cap:sync`. On fresh offline launch, `otaCoordinator.initialize()` calls `CapacitorUpdater.notifyAppReady()` before attempting to read the bundled catalog or contacting the release server.

---

## 2. Native APK Release vs. OTA Eligibility Matrix

Changes are classified automatically in CI (`scripts/classifyGitChanges.mjs` -> `src/game/otaCompatibility.ts`):

| Change Scope | Release Path | Notes |
| --- | --- | --- |
| `src/**`, `index.html`, `candle-preview.html` | **OTA** (`otaEligible: true`) | Web UI, Three.js scenes, Ghost AI, physics, shaders |
| `public/models/*.glb`, `src/assets/*.glb` | **OTA + Delta Asset Sync** | Character GLBs (`boy.glb`, `girl.glb`, `canolia-character.glb`), Ghost NPC (`ghost-woman.glb`) |
| `public/motions/**/*.glb` | **OTA + Delta Asset Sync** | Shared locomotion, combat, dance, and ghost clips |
| `public/map/**` | **OTA + Delta Asset Sync** | Region manifests, building/road/separation tiles |
| `public/*.{png,webp,jpg,ico}` | **OTA + Delta Asset Sync** | Signboards, emblems, web/app icons |
| `android/**` (Kotlin/Java/Gradle/Manifest/resources) | **Native APK Required** | Splash screens, Android launcher icons, permissions, native SDK upgrades |
| `@capacitor/*` / `@capgo/*` dependency changes | **Native APK Required** | Native bridge registration requires APK rebuild |
| `capacitor.config.ts` native properties (`appId`, `android.*`, scheme) | **Native APK Required** | Native WebView/host behavior requires rebuilt binary |

If a push modifies native files or increments `minNativeVersion` / `minAndroidVersionCode` / `schemaVersion`, CI sets `requiresNativeApk: true`, withholds incompatible Android OTA bundle publishing, and installed APKs display **"New Android APK Required"** without attempting a broken download.

---

## 3. Runtime Update Flow & Safety Boundaries

1. **Discovery (`src/services/otaUpdater.ts`)**:
   - Reads `/ota/production.json` (or `/ota/staging.json` when channel is `staging`) with `Cache-Control: no-store`.
   - Evaluates compatibility (`checkUpdateCompatibility`) against `nativeVersion`, `androidVersionCode`, `schemaVersion`, HTTPS URL policy, SHA-256 format, and downgrade protection.
2. **Delta Asset Cache Sync & Segmented Content Packs (`src/services/assetCacheManager.ts`)**:
   - Validates `/ota/asset-manifest.json` and `/ota/packs.json` (`core-shell`, `characters-core`, `npc-ghost`, `motions-shared`, `region-kanbale`, `region-sithar-fields`).
   - Stores blobs by content-addressed SHA-256 primarily in **IndexedDB** (`mm-region-ota-db-v1`) with `navigator.storage.persist()`, falling back cleanly to **Cache Storage** (`mm-region-ota-blobs-v1`) and in-memory storage when unavailable.
   - Downloads **changed files only**, verifies SHA-256 of every downloaded asset via Web Crypto (`crypto.subtle.digest`), supports both whole-manifest sync (`syncToManifest`) and per-pack sync/rollback (`syncPack`, `rollbackPack`), resumes interrupted downloads cleanly, and activates atomically.
   - Enforces bounded disk budget (`DEFAULT_MAX_ASSET_STORAGE_BYTES = 128 MB`) and never deletes the sole working offline copy or required packs.
   - Intercepts same-origin asset requests (`/models/`, `/motions/`, `/map/`, `/assets/`, textures) in `src/services/offlineAssetResolver.ts`, strictly serving the newest active verified generation or falling back directly to the APK builtin assets.
3. **Capacitor Web Bundle & Rollback**:
   - Downloads the complete checksum-verified OTA ZIP through `CapacitorUpdater.download({ url, version, checksum })` with `httpsOnly: true`. The ZIP already includes the offline assets, so the Android updater does not duplicate this download in IndexedDB.
   - An installed APK can download an OTA ZIP with the same version. After activation, the Android bundle checksum identifies whether that release is already installed. Content packs remain available when no code update is needed.
   - **Never interrupts** an active ghost chase (`isAnyGhostThreatActive()`), ghost neck-grab/fall (`getGhostEncounterInteraction()`), motorcycle ride, car drive, balloon ride, cinematic intro, or loading state (`src/game/updateSafety.ts`).
   - A restart requested during a busy state returns to ready when gameplay clears. The player selects Restart & Apply again to restart. The app flushes player position and settings (`flushGameSave`) immediately before `CapacitorUpdater.set()` reloads the WebView.
   - If the newly applied bundle fails startup health check (`appReadyTimeout: 10000`) or reports `status: 'error'` / `updateFailed`, Capacitor rolls back natively to the prior healthy/builtin bundle, `assetCacheManager.rollbackToPrevious()` restores paired assets, and `UpdateStatusPanel` surfaces the rollback notice.

---

## 4. Publish Web and Android OTA Releases

The Git-connected Vercel project is the publisher. Its production build uses `npm run build:vercel` to build with a Git-derived release version and verify the pack catalog, checksums, and ZIP. The release descriptor and its ZIP under `/ota/bundles/` are published with the same deployment. Normal game code and asset changes take this path when merged to the production branch.

GitHub Actions runs the tests, server and map checks, and OTA artifact verification, then archives the results. The GitHub workflow does not deploy a second site or require deployment tokens. Preview deployments use their own staging origin and do not publish to the APK's production feed.

For native or Capacitor plugin changes, increase Android's `versionCode` in `android/app/build.gradle` when releasing the signed APK. Subsequent OTA builds take their minimum Android version from this file so older APKs remain gated after the native-changing commit.

---

## 5. Local Commands & Verification

```bash
# Build and verify a deployable release with its hosted ZIP
npm run build:vercel

# Inspect git classification against previous commit
npm run ota:classify

# Run full unit & integration test suite (including tests/otaUpdate.test.ts)
npm test

# Prepare the offline catalog and build a signed APK after a native change
npm run cap:sync
.\android\gradlew.bat -p android assembleRelease
```
