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

The APK ships with the complete `dist/` web bundle (`models/`, `motions/`, `map/`, compiled Three.js bundles, and icons/textures). On fresh offline launch, `otaCoordinator.initialize()` calls `CapacitorUpdater.notifyAppReady()` immediately before any network traffic so `@capgo/capacitor-updater` marks the local bundle healthy offline and never resets after `appReadyTimeout`.

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
2. **Delta Asset Cache Sync (`src/services/assetCacheManager.ts`)**:
   - Validates `/ota/asset-manifest.json`.
   - Diffs target file hashes against active/previous generations stored by content-addressed SHA-256 in Cache Storage (`mm-region-ota-blobs-v1`).
   - Downloads **changed files only**, verifies SHA-256 of every downloaded asset via Web Crypto (`crypto.subtle.digest`), checkpoints completed paths per file so interrupted downloads resume cleanly, and activates the new generation atomically only when complete.
   - Enforces bounded disk budget (`DEFAULT_MAX_ASSET_STORAGE_BYTES = 128 MB`) and never deletes the sole working offline copy.
   - Intercepts same-origin asset requests (`/models/`, `/motions/`, `/map/`, `/assets/`, textures) in `src/services/offlineAssetResolver.ts`, strictly reading the active generation so old assets cannot leak across versions.
3. **Capacitor Web Bundle & Rollback**:
   - Downloads verified OTA ZIP (`CapacitorUpdater.download({ url, version, checksum, manifest })`) in background with `httpsOnly: true`.
   - **Never interrupts** an active ghost chase (`isAnyGhostThreatActive()`), ghost neck-grab/fall (`getGhostEncounterInteraction()`), motorcycle ride, car drive, balloon ride, cinematic intro, or loading state (`src/game/updateSafety.ts`).
   - Flushes player position & settings (`flushGameSave`) immediately before `CapacitorUpdater.set()` reloads the WebView.
   - If the newly applied bundle fails startup health check (`appReadyTimeout: 10000`) or reports `status: 'error'` / `updateFailed`, Capacitor rolls back natively to the prior healthy/builtin bundle, `assetCacheManager.rollbackToPrevious()` restores paired assets, and `UpdateStatusPanel` surfaces the rollback notice.

---

## 4. GitHub Actions CI/CD & Secrets

Workflow: `.github/workflows/release-ota.yml`

Required repository secrets:
- `VERCEL_TOKEN`: Vercel API token
- `VERCEL_ORG_ID`: Vercel Team/Org ID
- `VERCEL_PROJECT_ID`: Vercel Project ID
- `GITHUB_TOKEN`: Built-in token with `contents: write` for GitHub Releases

Pipeline order:
1. Run `npm test` and `npm run map:audit`.
2. Classify git diff (`scripts/classifyGitChanges.mjs`).
3. Run `npm run build` (`tsc -b && vite build`).
4. Generate `dist/ota/asset-manifest.json`, `dist/ota/native-compat.json`, `dist/ota/<channel>.json`, `ota-artifacts/mm-region-ota-<version>.zip`, and `ota-artifacts/checksums.sha256` (`scripts/generateOtaArtifacts.mjs`).
5. Validate every built file hash, zip size/hash, and compatibility rule (`scripts/verifyOtaArtifacts.mjs`). Fail hard before publishing if invalid.
6. Upload GitHub Release assets (`mm-region-ota-<version>.zip` + manifests) ONLY when verification and native-compatibility checks pass.
7. Publish `dist/` + `/ota/*.json` prebuilt output to Vercel.

---

## 5. Local Commands & Verification

```bash
# Build web bundle & generate OTA manifests + ZIP + checksums
npm run build
npm run ota:manifest
npm run ota:verify

# Inspect git classification against previous commit
npm run ota:classify

# Run full unit & integration test suite (including tests/otaUpdate.test.ts)
npm test

# Sync Capacitor Android assets & compile Debug APK
npx cap sync android
.\android\gradlew.bat -p android assembleDebug
```
