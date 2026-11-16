---
name: mm-region-architecture
description: Repository-grounded architecture, asset-pipeline and phased migration guidance for MM Region Game (R3F, Capacitor, Colyseus, Blender, nationwide world, combat, social and economy).
---

# MM Region Game Architecture Skill

## When to use
Use this skill whenever the user requests architecture, restructuring, optimization, feature integration, or migration for the MM Region Game repository, including characters at scale, Blender asset libraries, open-world streaming, Android, multiplayer, fighting/war, social, shops, market and delivery.

## Operating rules
1. Inspect actual source files before making claims or edits. Never infer code behavior from filenames alone.
2. If root configs or source are missing, identify exactly what is absent; do not claim builds pass.
3. Preserve gameplay, custom maps/wards, editor-created assets, player saves, ghost AI, home safe zones, procedural horror audio, OTA and offline behavior.
4. Start with **Phase 0 audit**, then propose small changes with explicit user approval at each phase.
5. Prefer adapters and incremental extraction to moving entire `src` trees. Do not create empty architecture folders without functionality.
6. Use a modular-monolith backend first; service splitting must be justified by scaling evidence.
7. Treat game client as untrusted for combat, money, inventories, ownership and delivery.
8. Keep asset definitions separate from placements and engine-independent schemas separate from R3F rendering.
9. Validate every `.blend` -> GLB pipeline change against rigs, clips, textures and visual regressions.
10. For each change, show tests actually run, remaining gaps, rollback plan and performance evidence. No invented results.

## Repository anchors to recheck
- `src/game/assetRegistry.ts`: existing asset metadata and 2D footprints.
- `src/game/mapTileStore.ts`: existing versioned map tile validation/cache concepts.
- `src/game/spatialIndex.ts`, `src/game/staticBatch.ts`: spatial/render optimization candidates.
- `src/components/StreamedWorld.tsx`, `src/components/AssetLibraryPage.tsx`: world and editor integration.
- `src/animation/core/`, `src/animation/retargeting/`: animation systems.
- `src/game/ghostAi.ts`, `src/game/playerHomeProtection.ts`, `src/game/audio/`: preserve existing horror gameplay.
- `src/services/assetCacheManager.ts`, `src/services/otaUpdater.ts`: offline and OTA.
- `server/TownPresenceRoom.ts`, `shared/network.ts`: presence-only Colyseus prototype, `MAX_PLAYERS = 8`, protocol v1 in supplied snapshot.
- Supplied archive lacks root `package.json`, `vite.config.ts`, `capacitor.config.ts`; require full repo for build/deployment validation.

## Decision process
1. **Locate** actual owner of a feature and its import graph.
2. **Classify** into contracts, game-core, world, assets, characters, combat, social, economy, delivery, renderer, platform, audio or server.
3. **Design** smallest interface boundary that preserves current callers.
4. **Implement** one vertical slice, behind feature flags if needed.
5. **Verify** unit/contract tests, editor round-trips, offline/OTA, multiplayer security, and real device performance when possible.
6. **Document** before/after structure, changed files, migration and rollback.

## Required architectural invariants
- Stable `assetId` != `instanceId`; published artifacts versioned by hash.
- Administrative ward/village hierarchy != streaming spatial grid.
- Shared GLB/texture GPU resources must not be disposed while referenced.
- Nearby render/simulation only; server interest management independent from client LOD.
- Offline game state is not authority for online market/war outcomes.
- Inventory changes and order transitions are transactional and idempotent.
- Web bundle OTA cannot replace Android native code or permissions.
- New client protocols and data schemas are explicitly versioned.

## Work phases
- **P0:** Audit, dependency graph, risks, target design, migration plan. No production code edits.
- **P1:** Shared contracts and adapters.
- **P2:** Blender export/GLB optimization/asset registry vertical slice.
- **P3:** Village chunk streaming + editor compatibility.
- **P4:** Android offline and measured performance.
- **P5:** Authoritative multiplayer + combat foundation.
- **P6:** Marketplace/inventory/orders/delivery transactional slice.
- **P7:** Social/war/crowd and scaling tests.
- **P8:** Native engine benchmark only if justified.

## Deliverable format
`Findings | Evidence (path/symbol) | Proposed change | Risk | Tests | Results | Rollback | Approval required`.

For the full coding-agent brief, read `PROMPT.md` alongside this file. Stop after P0 until user approves proceeding.
