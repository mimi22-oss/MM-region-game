---
name: map-data-management
description: Manage Myanmar-Town-Prototype map data imports, GeoJSON changes and large-map loading. Use when adding, moving, deleting or updating map features or auditing map memory, streaming and scale. Defines the map-data agent workflow; excludes unrelated UI and character work.
---

# Map Data Agent

Read [the repository data guide](../../../docs/map-data-management.md) before changing map storage or introducing a dataset. Inspect `git status` and current adapters first; other tasks may be changing nearby villages.

## Responsibilities

Own source normalization, stable feature IDs, explicit geographic calibration, bounded tile generation, metadata-only catalogues and lifecycle integration. Use the sibling [map-location-pipeline](../map-location-pipeline/SKILL.md) for building/road geometry and spatial verification. No external API credential is required for local GeoJSON processing; use configured tools only if the request actually needs external data.

For new bulk features, use `scripts/mapTiles.mjs`, `src/game/mapTileStore.ts` and `src/components/MapDataset.tsx`. Do not grow eager exports in `ward.ts`/`villages/index.ts`. Small authored corrections to existing metadata can stay in their region while migration proceeds. The field adapter is an example, not support for every geometry kind: implement the matching bounded renderer plus collision/ground/label/traffic lifecycles before enabling a new kind.

Keep original source and authored overrides separate. CRUD uses stable feature IDs and a new immutable dataset version. Preserve closed polygons/holes, source precision, local scale and road connectivity. Do not generate buildings across real roads or fill water with houses. User directions on spacing and position take priority over stale generated data.

Before shipping, run relevant tests and `npm run map:audit`; shared streaming changes also require `npm test` and `npm run build`. Verify travel out/back, collision/ground continuity, HTTP errors and cache release. Use the existing 100k-feature tests as data-budget validation; separately measure browser rendering. Report unconverted legacy imports and remaining limits explicitly instead of promising lag-free operation on every device.

## Completion record

State the changed region/dataset, feature counts, projection/anchor, versioned manifest, cache/geometry budgets, validation performed and any unresolved issue. For a new feature adapter, include how physics, labels and traffic unregister. Avoid embedding credentials or current test-count claims in reusable instructions.
