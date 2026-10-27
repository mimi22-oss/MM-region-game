# Map data management

## Current audit and limits

Run `npm run map:audit` for current counts. The first audit of this change found 5,789 unique building/road/field/tree records across 11 regions. This is not a count of meshes, vertices or all landmark internals. `regionAssets.ts` lazy-loads scene components, but `ward.ts`, `villages/index.ts`, collision, labels and traffic still import legacy data eagerly. Therefore lazy scene imports alone do **not** make the legacy system suitable for hundreds of thousands of additional records.

Current runtime fixes:

- Only active regions and one nearby neighbour are requested. Moving drops queued irrelevant imports; an already-running JS import cannot be cancelled or unloaded from the browser module cache.
- Prepared scene cache remains bounded (2 mobile / 5 desktop); Myothar is the one live pin. Other spawn regions can be evicted after startup. Ground registration is released before geometry disposal. Active use updates cache recency.
- Distant overview meshes are limited to 16 mobile / 32 desktop regions. Detailed cache, overview and collision memory are distinct budgets.

New bulk data must follow the JSON path below. The first production consumer is the 20 separation fields around Si Thar: their detailed meshes stream from two JSON tiles, while the small existing field metadata continues to serve the SVG/overview. Existing villages have not all been converted to tiles; migrate each adapter with its physics, labels and traffic together, then remove its eager exports. Do not claim the entire old world has already been migrated.

## Import and version workflow

1. Keep the original GeoJSON outside the game bundle. Record source date, attribution, dataset slug, coordinate reference and user corrections. Preserve stable source IDs. Longitude comes before latitude.
2. Normalize/validate offline. The builder accepts WGS84 FeatureCollections, preserves properties and geometry, validates rings/coordinates/IDs, and creates content-derived IDs only when missing. Changing a feature without a source ID changes its generated ID; use explicit IDs for CRUD. It does not repair self-intersections or infer missing roads, buildings or permissions.
3. Create a new output directory whose parent already exists:

   ```powershell
   npm run map:tiles -- --input path/to/data.geojson --output public/map/my-village/v1 --dataset my-village
   ```

   Existing output directories are refused. Manifest and tile URLs must be published together. To update/move/delete, apply the change to source by stable ID, rebuild into a new version directory, verify it, then change the small dataset configuration. Retain the previous version for rollback; delete it only as a deliberate asset cleanup. Never edit a hash-named tile in place.
4. The manifest contains schema version, dataset version, WGS84 CRS, counts, limits and full geometry bounding boxes. Tiles are JSON FeatureCollections. Dense cells split by geometry-centre order and stable ID even when every point coincides. Long geometry bounds cover the entire feature; oversized individual features are rejected and require explicit simplification or semantic splitting. Do not drop polygon holes, bridge structure or precision to make a budget pass.
5. Configure production caching for immutable versioned assets (`Cache-Control: public, max-age=31536000, immutable`) on the hosting service when deploying. That header is a deployment requirement, not configured by this source change. Offline persistence and zero network waits are not guaranteed.

## Client budgets and adapters

| Budget | Mobile | Desktop |
|---|---:|---:|
| Selected JSON tiles per dataset | 2 | 4 |
| Resident JSON tiles per dataset | 4 | 8 |
| Resident serialized bytes per dataset | 1 MiB | 2 MiB |
| Concurrent tile requests | 2 | 2 |
| Features per tile | 256 | 256 |
| Coordinates per tile | 8,192 | 8,192 |
| Serialized bytes per tile | 256 KiB | 256 KiB |

These are serialized payload budgets, **not** total JS heap/GPU budgets. Each dataset adds its own quota: only mount nearby catalogue datasets and enforce an aggregate budget before adding many datasets. Do not mount thousands of dataset components at startup. For very large catalogues, partition the catalogue geographically; the client rejects manifests over 4 MiB.

`MapTileIndex` builds a bounding-volume tree once; its nearest query stops at the selection cap. `MapTileStore` deduplicates requests, cancels irrelevant requests, ignores late completions, caches recently used JSON, and backs off failed requests. `fetchMapJson` limits streamed bytes before parsing even without Content-Length. Dense areas can contain more visible tiles than the detail budget; provide an offline simplified overview/LOD for those datasets rather than raising limits or silently losing features.

`MapDataset.tsx` is the reusable R3F selection/lifecycle component. Supply a stable metadata-only `config` (`manifest`, `projection`) and a `view` component accepting `MapTileViewProps`. `MapProjection` requires a geographic origin, scene anchor, metres-per-degree scale and scene rotation. Villages use different compressed scales; never assume one universal origin or copy another village's scale. `projectMapPoint` and `unprojectMapPoint` must round-trip and match existing neighbours.

`SeparationFieldTiles.tsx` demonstrates one draw call per tile through instancing, ground registration and cleanup. Rebuild its checked-in assets with `npm run map:fields`. The view currently supports authored field points; it is **not** a universal GeoJSON building/water renderer. For another feature kind implement and test its adapter before pointing the catalogue at it:

- Buildings: preserve footprint, orientation, holes, entrances and roof profile. Reuse meshes/materials; create coarse distant LOD offline. Bound mesh count, vertices and per-frame construction work.
- Trees: instance shared trunk/canopy geometry; keep trunk colliders spatially indexed.
- Roads/water: preserve polylines/polygon topology, widths, elevation and junctions. Index road/deck walkable geometry only. Build bot routes along real roads and verify obstacle clearance. Water must not become walkable unless explicitly bridged.
- Labels, collision and traffic: register by dataset/version/tile/feature ID, query locally and remove on tile release. Ensure actor motion cannot enter an unloaded collision region; load/pin the actor corridor and test teleports and fast balloon travel before enabling new solid tiles.
- Ground: call `registerGroundRegion` and `releaseGroundRegion` with unique tile IDs. Release before geometry disposal. Rendering roots hidden by LOD must not accidentally remove required near-actor physics.

Do not put the fetched payload in a global never-cleared array, import JSON as an ES module, regenerate every region on a view change, or loop through every feature in `useFrame`. For expensive geometry, use a worker or bounded multi-frame construction and attach the completed result atomically.

## Verification and rollout

Run `npm test`, `npm run map:audit`, `npm run build`. `tests/mapTiles.test.ts` uses 100,000 synthetic features to verify count, byte/coordinate caps, deterministic partitioning, dense coincidence, full-bounds discovery, cancellation, cache reuse, failure backoff and disposal. This proves data-management invariants; it does not establish 100k visible-mesh FPS.

Verify browser travel spawn -> edge -> neighbour -> back, fast movement/teleport, mobile and desktop, offline/missing tiles, and disposal. Record long tasks, frame-time percentiles, draw calls, triangles, heap and renderer memory after repeated trips. Compare the same scene/camera/device/build before and after. Do not infer laptop FPS from headless software rendering.

Legacy migration order: largest eager GeoJSON regions first (Myothar centre/Area1, Kanbale, Natmyaung), then remaining procedural villages. Move data, rendering, collision, label and bot consumers as one reviewed region change; keep special landmarks and home interactions intact. Re-run the audit and inspect production entry chunks after each migration. The present main bundle still contains eager legacy data and the build still warns about large chunks.
