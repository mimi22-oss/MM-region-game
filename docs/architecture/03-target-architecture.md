# 03 — Target Architecture (Adapted to Actual Repository)

Date: 2026-11-16
Phase: **Phase 0 (Audit & Plan Only)**

## 1. Adaptation Principles for `Myanmar-Town-Prototype`
1. **No Big-Bang Rewrite / No Empty Placeholders**: Preserve every working feature (11 Myothar/Kalay regions, Ward/Village Editor, Asset Studio, Car/Motorcycle/Balloon vehicles, Tazaungdaing Festival, Mixamo/Blender animations, Night Ghost AI & Safe Zone, Procedural Horror Audio, OTA + Offline APK). Extract domain packages incrementally via **adapters** so `npm test`, `npm run build`, `npm run server:check`, and Android builds remain green after every step.
2. **Modular Monolith Backend First**: Evolve `server/` (`Colyseus + Express 5`) into one modular deployable backend backed by PostgreSQL (transactional state, ledgers, inventory, orders, delivery) and optional Redis pub/sub only when horizontal scaling requires it.
3. **Engine-Independent Domain Core**: Pure TypeScript contracts, physics/collision/walkability ports, AI (`ghostAi`), combat, economy, delivery, and social logic live outside `three` / `@react-three/fiber` / React / Capacitor so client and server share validation cleanly.

## 2. Target Workspace Layout (Gradual Convergence)

Notice how the prompt's long-term layout adapts cleanly onto the actual repository using **npm workspaces** introduced incrementally (avoiding giant `git mv` churn before Phase 1/2 readiness):

```text
apps/
  game-web/                 # Gradual slimming of src/main.tsx + Town shell + HUD
  game-android/             # Existing android/ Capacitor 8 container + thin lifecycle wiring
  admin-studio/             # Lazy-extracted WardVillageEditor + AssetLibraryPage + MapSelectionTool
packages/
  contracts/                # Evolved from shared/network.ts -> versioned IDs, DTOs, errors, schemas
  game-core/                # Clock/time, entity transforms, ghost AI rules, safe zones, save migrations
  world/                    # Global CRS, MapProjection adapters, spatial chunk manifests, navigation/walkability
  asset-system/             # AssetDefinition v2 (content hashes, LODs, rigs, footprints, refcount cache)
  characters/               # Extracted from src/animation/* + character definitions & crowd state
  combat/                   # Server-authoritative hit/cooldown/damage/health, factions & war cell rules
  social/                   # Friends, parties, localized/moderated chat contracts, presence state
  economy/                  # Shops, catalogs, listings, price-snapshot orders, stock reservation, double-entry ledger
  delivery/                 # Delivery jobs, courier assignment, state transitions, proof/escrow release
  renderer-three/           # R3F scene adapters, instancing, GPU resource refcounting, floating origin, retargeting
  platform/                 # Migrated from src/services/* -> Capacitor bridge, OTA, offline pack store
  audio/                    # Migrated from src/game/gameAudio.ts & src/game/audio/*
services/
  game-server/              # Evolved from server/ -> modular Colyseus rooms + Express REST/webhook APIs + auth
pipelines/
  blender-export/           # Pinned headless Blender CLI (.blend -> validated GLB, zero Downloads paths)
  asset-optimize/           # Headless Meshopt/Draco/KTX2/LOD optimizer + budget gate + quarantine
  world-build/              # Evolved from scripts/mapTiles.mjs -> OSM + custom edits -> versioned spatial chunks
content/
  manifests/                # Versioned chunk/asset/character/item registries (hash-addressed; small JSON)
  definitions/              # Declarative catalog/ability/character definitions
infra/                      # PostgreSQL migrations, Docker Compose local stack, CI workflows, metrics/alerts
tests/                      # Unit, contract, deterministic simulation, integration, Playwright, Android E2E
docs/architecture/          # ADRs, schemas, rollback runbooks
```

### Existing Owner -> Target Package Mapping

| Current Repository Owner | Target Package / Service | Migration Mechanism |
|---|---|---|
| `shared/network.ts` | `packages/contracts` | Extend with `schemaVersion`, shared domain IDs, Zod/runtime validators; re-export from `shared/` during transition. |
| `src/game/ghostAi.ts`, `ghostConfig.ts`, `ghostPersonalities.ts`, `playerHomeProtection.ts`, `playerDeath.ts`, `environmentTime.ts`, `gameSave.ts` | `packages/game-core` | Inject `WalkabilityOracle` & storage ports so simulation runs identically in Node server & browser. |
| `src/game/mapTileStore.ts`, `mapProjection.ts`, `spatialIndex.ts`, `locationDetect.ts`, `worldLayout.ts`, `editorRegions.ts`, `worldEdits.ts`, `data/ward.ts`, `data/villages/` | `packages/world` + `pipelines/world-build` | Keep small authored overrides; convert bulky GeoJSON/village data progressively into versioned spatial JSON chunks + collision/label adapters. |
| `src/game/assetRegistry.ts`, `customAssets.ts`, `builtInAssetEdits.ts` | `packages/asset-system` | Split `AssetDefinition` (version, hash, rig/LOD/budget metadata, 2D footprint) from `WorldPlacement` (`instanceId` -> `assetId` + transform); preserve all existing `assetId` keys. |
| `src/animation/*`, `src/data/appearance.ts`, `src/game/glbHuman.ts` | `packages/characters` + `packages/renderer-three` | Core rig/motion definitions in `characters`; Three.js `SkeletonRetargeter`, `AnimationController`, GPU instanced/LOD crowd renderer in `renderer-three`. |
| `src/components/StreamedWorld.tsx`, `Asset3DRenderer.tsx`, `StaticBatch.tsx`, `Player.tsx`, `GhostNpc.tsx`, `GlbHuman.tsx`, `src/multiplayer/RemotePlayers.tsx` | `packages/renderer-three` | Decouple Three.js scene tree (`FloatingOriginGroup`, refcounted GLB/texture cache, LOD switcher) from React root UI (`main.tsx`). |
| `src/game/audio/*`, `src/game/ghostAudio.ts`, `src/game/gameAudio.ts` | `packages/audio` | Wrap with audio capability port; retain procedural Web Audio engine cleanly. |
| `src/services/*`, `src/game/otaCompatibility.ts`, `updateSafety.ts`, `android/` | `packages/platform` + `apps/game-android` | Separate core web app OTA vs modular optional/regional content pack cache (`>128 MiB` pack tiers on Android native storage when needed). |
| `server/index.ts`, `server/server.ts`, `server/TownPresenceRoom.ts`, `server/state.ts` | `services/game-server` | Keep single deployable process initially; add JWT/session auth, spatial cell Colyseus rooms, Express HTTP routes (`/api/economy`, `/api/delivery`, `/api/admin`), and PostgreSQL persistence. |

## 3. Core Architectural Mechanisms Across Domains

### A. World Streaming & Floating Origin
- **Spatial Partitioning vs Administrative Boundaries**: Administrative boundaries (`ward`, `village`, `township`) become query/UI/ownership attributes (`regionId`), while streaming, server interest management, and client rendering load **canonical spatial grid chunks** (e.g., `256m x 256m` L1 neighborhood cells, `64m x 64m` L2 detail/collision cells) indexed in a global coordinate space (`EPSG:4326` <-> Myanmar metric tangent/projection frames with explicit `MapProjection` calibration for legacy villages).
- **Floating Origin**: Client stores `cameraAnchorWorldXZ` (`float64`) and rebases active Three.js scene groups into camera-local offsets (`offset = worldPos - originXZ`) whenever displacement exceeds e.g. `512m`, eliminating vertex jitter across nationwide distances.
- **Zero Orphaned Physics**: Every streamed tile registers/releases collision primitives, walkable surfaces, ground heights, labels, and NPC/traffic routes atomically on mount/eviction via a unified `WorldChunkAdapter`.

### B. Blender Asset Pipeline & NPC Crowd Architecture
- **Source of Truth**: `.blend` files live under Git LFS (or external content bucket tracked by hash), **never inside Web/APK bundles**. Only root/reusable base GLBs and optimization outputs exist in published manifests (`content/manifests/`).
- **Bounded Export & Optimization**: Headless Blender CLI (`pipelines/blender-export/`) runs with fixed worker concurrency -> exports glTF/GLB -> `pipelines/asset-optimize/` runs deterministic validation (triangle/bone/material limits, texture power-of-two/max-px budgets, zero NaNs, clip alignment checks) -> applies validated Meshopt/Draco/KTX2 + generates coarse LOD1/LOD2 -> publishes immutable content-addressed artifacts (`<assetId>.<sha256>.glb`). Any failure quarantines the asset before registry publication.
- **Thousand-Character Scalability**: Characters select from a tiny family of **shared base skeletons** (`mixamo-humanoid-v1`, etc.), separating `CharacterDefinition` (proportions, wearable slots, palette/material parameters, stat block) from GPU mesh/clip assets. Crowd NPCs use LOD tiers: near actors run full skeleton + `AnimationController` (pooling `SkeletonUtils.clone` & sharing GPU buffers/textures), mid-distance NPCs step at reduced update Hz, and distant crowds render baked/simplified instanced representations without per-NPC GLBs.

### C. Authoritative Multiplayer, Combat & War
- **Zero Client Trust**: Client sends versioned *intent commands* (`inputSeq`, move intent vectors, attack/ability request with timestamp, shop order requests). Server authenticates players (`JWT` / verified account session), owns authoritative positions, hitboxes/LOS/cooldown verification, HP/damage/death/respawn, faction allegiance, and war territory capture.
- **Ghost AI & Home Safe Zone Invariants Preserved**: Server validates ghost targetability and safe-zone containment using shared `@mm/game-core` pure rules (`isPlayerHomeProtected`, `HOME_RETREAT` boundaries) synced with authorized land/home ownership records; offline single-player runs the exact same shared simulation module locally.
- **Spatial Interest Management & Partitioning**: Rooms map to world spatial cells/zones (with seamless cell handoff/boundary replication). Players only receive entity/combat/crowd snapshots within interest radius `R`, capping bandwidth and CPU per room under explicit tick budgets (e.g. 20 Hz simulation / 10 Hz replication).

### D. Economy, Shops, Marketplace, Inventory & Delivery
- **Online Authoritative Ledger**: Offline exploration can cache read-only catalog views, **never minting currency, granting items, or confirming market trades offline**.
- **Order & Delivery State Machine**:
  1. `CreateOrder` (`Idempotency-Key` required): DB transaction reads authoritative seller listing price & snapshots `unit_price_minor` + tax/fee; executes conditional stock decrement (`WHERE stock >= qty`); writes `orders(status='reserved')` + escrow hold on buyer balance via double-entry `ledger_entries`.
  2. `Dispatch / Delivery Job`: Marketplace order creates `delivery_jobs(status='open' -> 'assigned' -> 'picked_up' -> 'in_transit' -> 'delivered' | 'cancelled' | 'disputed')` inside a transactional outbox.
  3. `Fulfillment & Settlement`: Server verifies courier proximity / proof token before transitioning `delivered`, atomically releasing escrow from buyer hold -> seller wallet (`ledger_entries` balanced `SUM = 0`) + awarding courier fee.
  4. **Currency & Compliance Separation**: Strict type boundary between **Virtual Game Currency** (`game_coin`, earned/spent inside verified game loops) and **Real-Money Commerce / Subscriptions** (handled strictly via external licensed payment providers/app-store billing with webhook verification, KYC/AML/tax reporting hooks; `SubscriptionShop` already enforces HTTPS external browser isolation).

### E. Android & OTA Strategy
- **Core vs Content Packs**: Separate core UI + starter chunk (~small OTA bundle via `@capgo/capacitor-updater`) from regional world/character GLB packs synced incrementally via `AssetCacheManager` + `OfflineAssetResolver`.
- **Safety Gates**: `checkUpdateCompatibility()` remains authoritative (`minNativeVersion`, `minAndroidVersionCode`, `otaSchemaVersion`); native Capacitor plugin/Manifest/Gradle changes force `requires_native_apk` rather than OTA. Preserve all local saves (`mm-region-game-save-v1`, custom layouts) across upgrades/rollbacks cleanly.
