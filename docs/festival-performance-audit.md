# Festival / character performance audit

Measured 2026-11-15; audio and walking-DPR verification completed 2026-11-16 (Asia/Rangoon).

Scope: current workspace source. Requested `src(3).zip` and `characters.zip` were not found in the workspace or checked Desktop/Downloads locations; their contents were not audited. Concurrent work changed this repository during the audit. Frozen before/after source snapshots under `artifacts/performance-audit/{before,after}` isolate the component measurements. The before snapshot came from the then-current Git index, not an assumed pristine release. These snapshots are ignored by Git.

## Findings and implementation

- `activeZoneId: all` / 120 remains an authored event setting. Runtime quality budgets select only nearby zones; default desktop: at most two zones / 110 decorative balloons / three detailed balloons, mobile: one zone / 32 decorative balloons / one detailed balloon. No distant village trajectory simulation. Near detail updates each frame; mid/far work is throttled to 12 Hz desktop / 8 Hz mobile. Rideable balloon gameplay remains separate.
- Fixed a near-LOD overflow list/count mismatch that defeated far throttling. Scratch poses, matrices and materials are reused. Stable seed-by-zone IDs preserve trajectory identities when subsets/order/quality change.
- Camera obstruction previously triangle-raycast every descendant, including the local skinned character, and discarded excluded hits afterward. The new query prunes invisible/avatar/ridden-vehicle/decorative subtrees before raycasting and reuses hit storage. Architectural walls still obstruct the camera.
- Festival lights use cached candle candidates and one shared bounded light pool. Added pool change subscriptions, protected replacement cleanup, and daylight shutdown for hero-only lighting. This prevents stale/duplicate fallback pools on quality switches.
- Decorations/balloon meshes use the concurrently implemented shared resources and bounded zone activation. GLB rendering retains skeletons and existing pose/animation controllers. No extra animation mixer or render loop was introduced.
- Full-screen blue flash investigation found an actual DPR feedback loop: FrameBudget lowered renderer DPR imperatively, while walking parent renders reapplied Canvas DPR. Canvas now receives persistent controlled DPR. The browser regression reproduced 0.85 -> 1.25 on every parent update before, and stable 0.85 afterward. This proves the resize loop is fixed; a full-world user-device blue-flash reproduction remains unverified.

## Runtime GLBs

| Asset | Bytes | Triangles | Joints | Embedded clips |
|---|---:|---:|---:|---:|
| src/assets/boy.glb | 3,801,836 | 10,962 | 65 | 0 |
| src/assets/girl.glb | 8,502,652 | 3,173 | 54 | 0 |
| public/models/canolia-character.glb | 2,151,492 | 65,720 | 22 | 9 |

Boy/girl normally use GlbHuman with TypeScript skeletal poses; BlenderCharacter/canolia is a separate fallback/reference path. The later concurrent ghost feature adds its own ghost model and motion GLBs, outside the frozen festival benchmark. Inventory: `artifacts/performance-audit/glb-inventory.json`.

## Measured results

Chrome headless ANGLE SwiftShader (software WebGL). Paired component fixture, 960x640 desktop / 390x844 mobile, DPR 1, synthetic 500 candle candidates, no full village geometry. Approximately 5.5 seconds sampled per case after warmup; very slow frames lengthen sampling. One pair per case, no statistical confidence interval. 1% low is reciprocal mean of the slowest ceil(1%) frame durations, so samples below 100 frames make it especially noisy. JS time is CDP ScriptDuration delta for the sample, not isolated simulation cost; heap is a non-GC-normalized point sample.

| Scenario | Version | Frames | Avg FPS | 1% low FPS | Frame ms | Draws | Triangles | Textures | Geometry | Camera query ms/frame | JS ms/sample | Heap MiB |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| off / 0 characters / walk / medium | before | 82 | 14.34 | 7.46 | 69.74 | 14.00 | 1716.00 | 1.00 | 7.00 | 0.00 | 5358.60 | 44.44 |
| off / 0 characters / walk / medium | after | 70 | 12.11 | 6.13 | 82.59 | 14.00 | 1716.00 | 1.00 | 7.00 | 0.00 | 5421.88 | 83.81 |
| on / 0 characters / walk / medium | before | 10 | 1.54 | 1.06 | 650.73 | 189.00 | 1118088.00 | 1.00 | 335.00 | 0.00 | 5510.85 | 153.95 |
| on / 0 characters / walk / medium | after | 37 | 5.28 | 0.99 | 189.46 | 38.00 | 238472.00 | 1.00 | 19.00 | 0.01 | 5366.14 | 159.11 |
| on / 1 characters / walk / medium | before | 10 | 1.22 | 0.37 | 818.77 | 188.80 | 1129587.60 | 3.00 | 336.00 | 93.06 | 5567.47 | 187.72 |
| on / 1 characters / walk / medium | after | 30 | 5.14 | 2.94 | 194.41 | 39.00 | 249434.00 | 3.00 | 20.00 | 0.39 | 5426.79 | 179.05 |
| on / 1 characters / ride / medium | before | 9 | 1.16 | 0.36 | 859.91 | 188.78 | 1129597.56 | 3.00 | 336.00 | 68.57 | 5525.16 | 239.96 |
| on / 1 characters / ride / medium | after | 32 | 5.41 | 4.71 | 184.83 | 39.00 | 249434.00 | 3.00 | 20.00 | 0.21 | 5515.11 | 193.47 |
| on / 4 characters / walk / medium | before | 9 | 1.02 | 0.34 | 975.82 | 191.33 | 1162682.67 | 6.00 | 336.00 | 20.83 | 5745.07 | 249.76 |
| on / 4 characters / walk / medium | after | 24 | 3.53 | 1.25 | 283.55 | 42.00 | 282320.00 | 6.00 | 20.00 | 0.46 | 5629.86 | 113.73 |
| off / 4 characters / walk / medium | before | 35 | 4.79 | 0.52 | 208.79 | 18.00 | 45564.00 | 6.00 | 8.00 | 14.97 | 5509.51 | 88.17 |
| off / 4 characters / walk / medium | after | 35 | 5.97 | 4.96 | 167.42 | 18.00 | 45564.00 | 6.00 | 8.00 | 0.38 | 5610.96 | 118.00 |
| on / 1 characters / walk / mobile | before | 37 | 6.49 | 6.02 | 154.10 | 20.00 | 383834.00 | 2.00 | 14.00 | 14.19 | 5681.32 | 105.04 |
| on / 1 characters / walk / mobile | after | 80 | 13.27 | 6.08 | 75.36 | 19.00 | 91440.00 | 2.00 | 14.00 | 0.12 | 5349.24 | 105.04 |

Festival-on desktop one-character walk draws: ~189 -> 39, triangles: ~1.13M -> 249k. Camera query: 93.06 -> 0.39 ms/frame in this fixture. Empty festival-off average FPS regressed 14.34 -> 12.11, and festival-on zero-character 1% low regressed 1.06 -> 0.99. These single-run variations are reported rather than discarded. All measured animation-loop React commit counts were zero. At software-renderer frame rates below the throttle frequency, far updates can occur every frame; the mobile sample shows 39 uploads across 80 frames. None of these numbers establishes hardware/device FPS or universal stable gameplay.

Raw results: `artifacts/performance-audit/benchmark.json`. Run `npm run perf:festival` with the preserved before/after snapshots available. The after snapshot predates the later DPR/audio work.

## Files and reasons

| File | Change |
|---|---|
| src/game/cameraObstruction.ts (created) | Prune excluded subtrees before raycasting, reusable storage |
| src/components/Player.tsx | Use optimized camera obstruction query |
| src/festivals/TazaungdaingScene.tsx | Decorative subtree camera-ignore marker |
| src/festivals/BalloonShow.tsx | Repair LOD overflow and far update cadence |
| src/festivals/festivalSimulation.ts | Stable per-zone deterministic seed |
| src/game/pointLightPool.ts | Pool lifecycle subscriptions |
| src/components/FestivalLighting.tsx | Reactive pool selection and daylight cleanup |
| src/components/FrameBudget.tsx | Controlled DPR callback and honest raw frame-time reporting |
| src/main.tsx | Persist and pass adaptive Canvas DPR |
| tests/festivalPerformance.test.ts (created) | Zone determinism, allocation reuse, camera pruning, pool lifecycle regressions |
| tests/fixtures/festivalAudit.html/.tsx (created) | Isolated paired component measurement scene |
| scripts/benchmarkFestivalAudit.mjs (created) | Browser metrics capture |
| tests/fixtures/walkingFlash.html/.tsx (created) | DPR feedback/full-world diagnostic fixture |
| scripts/checkWalkingFlash.mjs (created) | Before/after DPR assertion and optional screenshots |
| package.json | Performance command and regression test registration |
| artifacts/performance-audit/* | Raw measurements, logs, inventory and ignored source snapshots |

Concurrently supplied optimizations were reviewed and included in measurements: qualityPreset, FestivalDecorations, MyanmarFireBalloon, TimeEnvironment, GlbHuman/rig helpers, collision/ground scratch reuse, robot throttling and StreamedWorld static-resource work. Their changes are not claimed as authored by this audit. No village datasets, map projections, map-editor permissions, ownership or multiplayer protocol were changed by this audit.

## Validation and remaining risks

- Initial complete suite: 201 passed, zero failed; map audit: 5,862 features / 11 regions passed; production TypeScript/Vite build passed. Later suite including the new audio tests and concurrent work: 261 passed, zero failed. Logs retained in artifacts/performance-audit.
- Browser DPR regression passed for three repeated parent-update cycles. Full-world screenshot diagnostic was not completed; Android hardware/WebView visual validation remains.
- Determinism tests guarantee equal transforms for equal seed/time. Cross-client festival epoch synchronization still depends on a shared authoritative time source; current visual clock.elapsedTime alone does not establish a multiplayer shared epoch.
- Culling thresholds may show zone/LOD transitions; verify teleportation and ride flight on actual mobile/desktop GPUs. Camera-ignore is limited to festival decoration; it must not be applied to solid architecture.
- Global shared geometries/materials are bounded lifetime caches. Full-game travel-out/back memory stability, long-session thermal behavior and repeated quality-switch screenshots remain device checks.
- Next: repeat longer warm benchmarks on real Android and desktop GPUs; inspect full-world blue flashes after DPR fix; connect festival time to multiplayer server epoch in the movement/synchronization phase.
