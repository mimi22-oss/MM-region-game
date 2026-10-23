# Latest mountain appearance verification

- TypeScript + Vite production build: PASS.
- Tests: 28 passed / 29 total. All 3 performance/terrain tests pass, including shared-edge normals, finite heights and the road gap.
- Existing Kyar Inn layout test fails: `ki-lake-access-road-1` at local (-258, 3675) overlaps pond `ki-pond-east-green-1`. The mountain change does not modify either layout or collision logic.
- Foreground terrain: 58 meshes, 28,504 triangles; local geometry generation approximately 129 ms.
- Browser visual matching and FPS not measured.
- dist/ and ZIP refreshed. Non-blocking Vite bundle-size warning remains.

---
Previous checks:

# Latest performance change verification

- TypeScript (`npx.cmd tsc -b`): PASS.
- Existing collision and layout tests: PASS, 25 tests.
- New performance tests: PASS, 2 tests. They check batching transforms, ray hits, animated/transparent exclusions, cleanup/remounts, and spatial-index boundary candidates.
- All 1,293 houses and 464 trees remain in the data.
- Browser appearance and FPS measurements: not performed.
- Production build rechecked on 2026-10-23: PASS (TypeScript + Vite).
- dist/ and Myanmar-Town-Prototype.zip refreshed with the performance update.
- Vite reports a non-blocking bundle-size warning (approximately 1.25 MB JavaScript, 341 kB gzip).

---
Previous verification (before this change):

# Verification

- Component extraction: House, Farmhouse, MainRoad, Lane, Tree, Canal and Field are wired into the scene; shared primitives extracted.
- Production build: PASS (TypeScript + Vite).
- Automated tests: PASS, 16 tests, including rice mill and storage collision, clear yard and fields, two field rows between homes, and scene bounds.
- Western landscape: five rear plots plus five north and five south, mountain ordering, enlarged world bounds and mountain collision verified.
- Existing canal routing, bridge crossings and residential lanes pass regression checks.
- 98 homes, 8 original warehouses, plus rice mill and paddy storage.
- Browser visual and pointer-lock checks were not performed in this session.
- Vite reports a non-blocking large Three.js bundle warning.
