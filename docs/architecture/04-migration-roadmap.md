# 04 — Phased Migration Roadmap & Approval Gates

Date: 2026-11-16
Phase: **Phase 0 (Audit & Plan Only — Stop Here for User Approval)**

Every phase produces a verifiable working increment, leaves tests green (`npm test`, `npm run server:check`, `npm run build`), includes a clear rollback lever, and requires **explicit user approval** before advancing to the next gate.

---

## Summary Matrix (per `SKILL.md` Deliverable Format)

| Findings | Evidence (path/symbol) | Proposed change | Risk | Tests | Results | Rollback | Approval required |
|---|---|---|---|---|---|---|---|
| Workspace has root configs (`package.json`, `vite.config.ts`, `capacitor.config.ts`, `tsconfig.json`), plus presence-only Colyseus server (`TownPresenceRoom.ts`) and 5,862-feature eager town/village data (`ward.ts`, `villages/index.ts`, `regionAssets.ts`). No combat, economy, delivery, auth DB, or Blender CLI compression pipeline exists yet. | `package.json`, `server/TownPresenceRoom.ts`, `shared/network.ts`, `src/data/ward.ts`, `src/game/mapTileStore.ts`, `src/game/assetRegistry.ts`, `src/game/mapPermissions.ts`, `android/app/build.gradle` | Execute gated Phases 1–8 incrementally via adapters and modular-monolith boundaries without breaking current town, ghost, audio, editor, or APK features. | Medium–High if rushed (coordinate drift, OOM on mobile, cheated multiplayer/economy state, broken saves/editor IDs). | `npm run server:check`, `npm run map:audit`, `npm test` (and `npm run build` in Phase 0 gate). | `npm run server:check` PASS (0), `npm run map:audit` PASS (`5862` features), `npm test` PASS (`284/284` passed, 0 failed); Android physical FPS & load benchmarks: `not measured`. | Phase 0 writes `docs/architecture/*.md` only; zero production impact (`git clean` on code). | **YES — Stop after Phase 0 for user review and approval before Phase 1.** |

---

## Detailed Execution Gates (Phases 0–8)

### Phase 0 — Repository Audit & Target Plan (CURRENT — STOP GATE)
- **Scope**: Read-only inspection of full codebase, root configs, server/shared boundary, Android packaging/OTA, Blender/GLB assets, and test suite. Author `docs/architecture/00-current-state.md` through `04-migration-roadmap.md`. Zero edits to `src/`, `server/`, `shared/`, `android/`, or `scripts/`.
- **Deliverables**: 5 Markdown docs under `docs/architecture/` + baseline check verification.
- **Gate**: Explicit user approval to begin Phase 1.

### Phase 1 — Contract Boundaries & Port Adapters (First Implementation Slice)
- **Objective**: Define canonical IDs, schema versions, DTOs, and simulation ports cleanly without moving large folder trees (`"No mass file moves"`).
- **Exact Touchpoints**:
  - Extend `shared/network.ts` (versioned envelopes, auth claims, entity/combat/economy/delivery contracts, error codes) + create `packages/contracts/` or structured `shared/contracts/` domain modules wired via TypeScript paths (`tsconfig.json` & `server/tsconfig.json`).
  - Add pure adapters: `WalkabilityPort` / `StoragePort` for `src/game/ghostAi.ts` and `src/game/playerHomeProtection.ts` (preserving 100% existing callers via default wrappers); versioned `AssetDefinitionV2` metadata adapter alongside `src/game/assetRegistry.ts`; save/layout schema version guards (`gameSave.ts`, `worldLayout.ts`); add `npm run server:check` into `.github/workflows/release-ota.yml`.
- **Gate Criteria**: All 284+ unit tests + contract round-trip tests + `tsc -b` + `server:check` pass; zero behavioral changes in Web/Android game.
- **Rollback**: Remove adapter shims / revert workspace alias additions; existing callers never broken.
- **Approval Required**: User sign-off before Phase 2.

### Phase 2 — Deterministic Blender Export & GLB Optimization Pipeline (10–30 Assets)
- **Objective**: Replace ad-hoc GLB copies and `Downloads/` hardcoded paths with reproducible headless Blender -> optimized GLB publishing & Git LFS tracking.
- **Exact Touchpoints**:
  - Add `.gitattributes` (Git LFS policy for `*.blend`, `artifacts/blender-character/`, source raw GLBs) + clean up duplicate root GLBs once pipeline verified.
  - Create `pipelines/blender-export/` (pinned Blender CLI worker script with explicit resource/timeout bounds) and `pipelines/asset-optimize/` (Meshopt/Draco/KTX2 + LOD1/LOD2 generation + triangle/texture/bone/clip validators + quarantine directory).
  - Test on 10–30 representative assets (`boy.glb`, `girl.glb`, `ghost-woman.glb`, `canolia-character.glb`, sample modular buildings/trees/props). Measure before/after byte sizes, parse time, and visual/animation retarget parity in Playwright/Chrome.
- **Gate Criteria**: Zero bone/clip mismatches (`validateExtractedMotionFile` & retarget tests pass), measurable GLB size & VRAM reduction documented before/after, existing character picker & `AssetLibraryPage` work identically.
- **Rollback**: Feature flag (`useOptimizedAssets`) or retain uncompressed fallback paths in `assetRegistry` until validated.
- **Approval Required**: User sign-off before Phase 3.

### Phase 3 — World Spatial Chunk Streaming, Floating Origin & Legacy Migration Slice
- **Objective**: Convert one large eager GeoJSON/ward slice (e.g., `myotharCenter` or `kanbale`) into `mapTileStore.ts` v2 spatial chunks (buildings, roads, trees, collision, ground, labels, bots) + introduce camera-relative Floating Origin rendering + split heavy Editor/Studio bundles out of main gameplay chunk.
- **Exact Touchpoints**:
  - Extend `src/game/mapTileStore.ts` (`schemaVersion: 2`, content SHA-256 verification, dependency IDs, per-region `MapProjection` metadata) & `scripts/mapTiles.mjs`.
  - Implement unified `WorldChunkAdapter` registering/releasing `groundSurface`, `collision`, `mapLabels`, and bot routes atomically with tile mount/evict.
  - Add Floating Origin transform wrapper inside Three.js scene root (`Town` / `StreamedWorld` / `Player`), and convert lazy route splitting for `AssetLibraryPage` & `WardVillageEditor`.
  - **Backward Compatibility**: Existing `mm-editor-region-v1:*` edits, GeoJSON export/import, and `PLAYER_HOME_REFERENCE` / safe zones round-trip losslessly.
- **Gate Criteria**: Chunk residency & eviction soak tests (spawn -> edge -> teleport -> neighbor -> return), editor round-trip tests pass, `dist/assets/main-*.js` size drops measurably, `map:audit` shows reduced eager feature count.
- **Rollback**: Keep migrated region toggleable behind dataset manifest feature flag (`useTiledKanbale`).
- **Approval Required**: User sign-off before Phase 4.

### Phase 4 — Android Performance Baseline, Native Packaging & Content-Pack OTA
- **Objective**: Establish measured performance on real Android hardware and refactor asset caching so APK/OTA never bloat or delete user data.
- **Exact Touchpoints**:
  - Enable release code shrinking/optimizations safely (`android/app/build.gradle` `minifyEnabled` evaluation with Capacitor Proguard rules) + wire automated telemetry export from `perfMetrics.ts` / `startupDiagnostics.ts`.
  - Split OTA web shell (`@capgo/capacitor-updater`) from regional/character pack downloads (`AssetCacheManager` upgraded to support segmented regional/pack manifests, IndexedDB/Filesystem storage on Capacitor Android exceeding Cache API constraints where needed, strict native-vs-OTA gates).
  - Run physical Android measurements (cold start, WebGL draw calls, triangles, JS/WebView heap, 15-min walk FPS/thermal behavior, offline airplane-mode boot + failed OTA rollback).
- **Gate Criteria**: Measured before/after Android device report (FPS percentiles, heap, thermal throttle behavior, APK/OTA payload size), offline survival & rollback verified.
- **Rollback**: OTA reverts via `@capgo/capacitor-updater` `reset()`; offline assets remain readable via builtin pack or previous active cache generation.
- **Approval Required**: User sign-off before Phase 5.

### Phase 5 — Authoritative Multiplayer & Combat Foundation
- **Objective**: Upgrade `server/` Colyseus presence prototype into an authenticated, spatial-interest-managed authoritative world + combat vertical slice.
- **Exact Touchpoints**:
  - Add session authentication (JWT / signed tokens) to Colyseus `onAuth` and remove client `'admin'` default in `mapPermissions.ts` when online.
  - Implement spatial cell Colyseus rooms (`services/game-server`) with server-owned player movement reconciliation, bounded tick budget, interest radius filtering, reconnect handling, and one authoritative combat + Ghost AI encounter slice enforcing `playerHomeProtection` on the server.
  - Run multi-client synthetic soak + anti-cheat tests (speedhack, impossible hits, safe-zone bypass, forged packets).
- **Gate Criteria**: Contract + real-socket integration + load test report (CPU/tick time at N synthetic bots per room, packet rates, zero exploit pass-throughs).
- **Rollback**: Feature flag (`VITE_MULTIPLAYER_MODE='presence-v1' | 'authoritative-v2'`) keeps single-player local mode and v1 presence fallback intact.
- **Approval Required**: User sign-off before Phase 6.

### Phase 6 — Marketplace, Shops, Inventory, Orders & Delivery Vertical Slice
- **Objective**: Build end-to-end transactional economy & delivery slice backed by PostgreSQL inside the modular-monolith server.
- **Exact Touchpoints**:
  - Add `infra/migrations/` (PostgreSQL schema: `accounts`, `shops`, `listings`, `inventories`, `wallets`, `ledger_entries`, `orders`, `order_items`, `delivery_jobs`, `idempotency_keys`, `outbox_events`).
  - Implement Express HTTP + Colyseus endpoints in `services/game-server` for 1 shop -> 1 listing -> order placement -> stock reservation -> courier delivery pickup/completion -> double-entry settlement & refund/cancellation paths.
  - Isolate virtual in-game coin ledgers strictly from external real-money store links (`SubscriptionShopDialog` / legal/payment compliance boundary).
- **Gate Criteria**: Concurrency tests (100 concurrent buyers vs stock = 10 -> zero oversell), idempotency replay tests, balanced ledger invariant (`SUM(amount) == 0` per transaction), authorization negative tests (non-owner edit, self-delivery fraud, stale price rejection).
- **Rollback**: Feature flag disables online market endpoints cleanly; migration down scripts + DB backup before release.
- **Approval Required**: User sign-off before Phase 7.

### Phase 7 — Social, Factions, War & Crowd Scaling
- **Objective**: Introduce friends, parties, chat moderation/rate limits, faction territory war cells, and large NPC/player crowd rendering once economy & combat telemetry hold steady.
- **Exact Touchpoints**:
  - Partitionable faction/war state per spatial world cell in `services/game-server`.
  - Instanced/batched crowd renderer + tiered AI simulation LOD in `packages/characters` & `packages/renderer-three`.
  - Benchmark crowd draw calls, server tick latency under war skirmish bursts, and cell boundary handoffs.
- **Gate Criteria**: Measured crowd render budget & server cell tick headroom tests pass without violating single-player/town invariants.
- **Rollback**: Per-feature kill switches (`war`, `chat`, `crowdDensityCap`).
- **Approval Required**: User sign-off before Phase 8.

### Phase 8 — Native Renderer / Engine Decision Gate
- **Objective**: Decide objectively — **only if measured Android perf/thermal/fidelity targets cannot be hit on optimized R3F + Capacitor** — whether a native engine migration pays off.
- **Exact Protocol**: Build one small timeboxed native prototype (Unity/Godot/native renderer) rendering **the exact same representative chunk + character crowd + lighting benchmark** used in Phase 4, comparing startup, FPS, memory, battery/thermal, binary size, and maintenance cost against optimized R3F. Proceed ONLY if benchmark delta justifies multi-platform rewrite cost.
