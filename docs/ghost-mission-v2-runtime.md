# Ghost Mission V2 runtime tracking

> Follow-up: the latest player request replaces the original sword pickup rule below. Once all three encounters unlock the sword, entering its 3.2m radius alive and on foot now collects it immediately, with no E key, hold timer, or 20m ghost-clearance requirement. The equipped model follows the player's real right-hand attachment and survives reload/region changes. See `docs/ghost-sword-pickup.md` for the follow-up changes and checks. The earlier clearance tests below describe the previous implementation; the clearance helper remains for compatibility/diagnostics.

## Diagnosis

The reported missing registry module exists in the current workspace as an untracked, partially integrated file. Its relative import from `ThreeGhostsMissionScene.tsx` is correct. The exact historical filesystem state that produced the Vite overlay is unavailable; it would be inaccurate to claim that error was reproduced against the current files. The initial TypeScript check did reproduce a separate integration error: `ActiveGhostZoneMarker` has `ghostId`, not `id`.

The developer position publisher previously selected any named Three.js ghost root before the AI registry. `GhostNpc` deliberately stops updating that root after distance/visibility culling, while its AI can retain a different current position. Thus an existing hidden root could override fresh movement data. The registry also had no state or mount ownership, and cleanup by ID could remove a replacement mount's entry. Guard fallbacks used a nonzero-coordinate test rather than initialization/freshness. The map continuously refitted its bounds as entities moved, which changed the apparent scale of stationary landmarks.

## Implementation

The existing gameplay registry is retained, with owner-scoped registration handles. Replacement registrations invalidate old data and writers; old cleanup cannot delete a newer owner. Entries contain ID, world X/Z, state, active status, position source, and a monotonic timestamp. Entries expire after one second. Reports update one reusable entry without React state, listeners, per-frame object allocations, or additional animation loops.

`LoadedGhostNpc` publishes from its existing R3F frame callback. Visible roots publish `getWorldPosition()` after movement using one reusable vector. Hidden roots publish the current world-coordinate AI/guard simulation instead. Paused entries are inactive and do not advance movement. Defeated ghosts clear their entry, and unmount releases its owner. A translated parent player proxy is included in the browser test to verify world-coordinate player tracking.

The mission scene copies these entries at 4Hz in Vite development mode. It caches the player object and clears the debug snapshot on unmount. The developer UI subscribes only while open. It shows all three IDs, state/status/source, world/player/sword distances, encounter count, pickup clearance, the rotated authored football field, and sword position. Authored anchor bounds and a uniform SVG scale prevent movement or CSS resizing from changing the world projection. Spawn and fresh guard estimates are explicitly distinguished from live data.

Sword clearance reads the same fresh runtime coordinates as encounters/combat. Unavailable or inactive surviving ghosts block pickup; exactly 20m also blocks pickup. Previously defeated ghosts retain their existing exemption. No persistence key, progress migration, HP tuning, encounter radius, chase-group selection, combat damage, counterattack, vehicle unlock, or saved progress has been changed.

`ThreeGhostsMissionHud.tsx` already contained the correct `import.meta.env.DEV` conditional lazy import; it is retained. The registry stays in production because gameplay uses it. Developer position dispatch and the map/model helper must be absent from the production output.

## Files modified by this task

| File | Reason |
|---|---|
| `src/game/missions/ghostRuntimeRegistry.ts` | Owner-scoped, stateful, timestamped runtime entries and expiry. |
| `src/components/GhostNpc.tsx` | Publish actual rendered/AI positions; safe pause, defeat and unmount lifecycle. |
| `src/components/ThreeGhostsMissionScene.tsx` | Use registry instead of stale root lookup; 4Hz DEV publisher and cleanup; cache player. |
| `src/game/missions/ghostGuardCoordinator.ts` | Mark initialized/fresh guard estimates; use runtime sword distances; Node-compatible imports. |
| `src/components/GhostDevMap.tsx` | Live telemetry UI, fixed projection, honest fallbacks and closed-map unsubscribe. |
| `src/game/carRide.ts` | Add `.ts` to the existing mission import so Node tests resolve it. |
| `src/game/carSummon.ts` | Same existing mission import compatibility fix. |
| `package.json` | Dedicated mission unit/regression and browser test commands. |

## Files added by this task

- `src/game/missions/ghostDevMapModel.ts`: testable DEV-only selection/projection helpers.
- `tests/ghostMissionRuntime.test.ts`: registry ownership, stale data, independent IDs, marker priorities, map scale, saved progress, strict sword boundary, and mission completion tests.
- `tests/fixtures/ghostMissionRuntime.html` and `.tsx`: current real GhostNpc/GLB/AI/mission scene with a player proxy.
- `scripts/checkGhostMissionRuntime.mjs`: headless browser integration checks.
- `scripts/verifyGhostDevMapBuild.py`: inspect actual production JS and optionally compare packaged APK JavaScript hashes with this build.
- `docs/ghost-mission-v2-runtime.md`: this report.

## Executed validation

- `npm run test:ghost-mission`: **28 passed, 0 failed**, including existing ghost movement, proximity, personalities and protected-home tests. The first attempt found the extensionless vehicle imports described above; the rerun passed.
- `node scripts/checkGhostMissionRuntime.mjs`: **passed**, current source, real Three.js GLB/mixer/AI/mission components in headless Chrome with SwiftShader. All three ghosts moved, their registry coordinates matched their rendered roots within 0.001m, and their UI status was LIVE. Controlled guard chase/search/return states tracked all three independently; search stayed still. Nested player coordinates, inactive pause status, hidden-root fallback, unmount release and unchanged progress after unmount were checked. **0 runtime exceptions**. Raw evidence: `artifacts/ghost-mission-v2/runtime.json` and `browser.log`.
- `npx tsc --noEmit`: **passed**, exit 0 on the final source; `artifacts/ghost-mission-v2/typecheck.log` is empty. One redundant parallel check was stopped to reduce build resource contention, then the final command was rerun successfully.
- `npm run build`: **passed**, including `tsc -b` and Vite production compilation. Vite reported the existing warning about chunks over 500kB. Evidence: `artifacts/ghost-mission-v2/build.log`.
- `python scripts/verifyGhostDevMapBuild.py`: **passed**. All **32** production JavaScript files were scanned; no developer-map name, headline, debug position event, or distinctive fallback UI text remained. Evidence: `production-exclusion.json`.
- `npx cap copy android`: **passed**, copying this production output to Capacitor's bundled web directory. No native configuration was changed.
- `android/gradlew.bat assembleRelease --console=plain` with Android Studio's bundled JBR: **passed**. The release was rebuilt after copying the current web assets; the final incremental build completed in **39s**. Existing Gradle deprecation warnings remain. Evidence: `android-release-current.log`.
- `python scripts/verifyGhostDevMapBuild.py android/app/build/outputs/apk/release/app-release.apk`: **passed**. All **34** APK JavaScript entries were checked for developer-map content, and all **32** web-build JS files matched their packaged counterparts by SHA-256. Evidence: `android-exclusion.json`.
- `git diff --check`: **passed**. The full repository test suite was not rerun for this targeted change; the previous comprehensive audit's test count describes its separate source baseline.

The release APK is `android/app/build/outputs/apk/release/app-release.apk`. Building and inspecting it does not constitute a physical-device runtime test.

## Limits and regression risks

The runtime is local gameplay authority; this change does not turn the existing single-player mission into a server-authoritative multiplayer mission. It does not change guard pathfinding/collision or the broader ghost audit's fix plan. Missing/unloaded ghost models remain explicitly unavailable, and blocking sword pickup until all surviving ghosts report fresh positions is intentional. UI fallback estimates cannot trigger encounters.

The browser fixture uses a player proxy, not the complete player/vehicle controller, and software rendering, not physical Android hardware. No new device FPS or audio benchmark is claimed. World projection uses fixed authored bounds; a player beyond those bounds can leave the visible viewport. No storage is reset in the actual game. Other concurrent working-tree changes are preserved.
