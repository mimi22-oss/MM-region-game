# Verification

- Component extraction: House, Farmhouse, MainRoad, Lane, Tree, Canal and Field are wired into the scene; shared primitives extracted.
- Production build: PASS (TypeScript + Vite).
- Automated tests: PASS, 16 tests, including rice mill and storage collision, clear yard and fields, two field rows between homes, and scene bounds.
- Western landscape: five rear plots plus five north and five south, mountain ordering, enlarged world bounds and mountain collision verified.
- Existing canal routing, bridge crossings and residential lanes pass regression checks.
- 98 homes, 8 original warehouses, plus rice mill and paddy storage.
- Browser visual and pointer-lock checks were not performed in this session.
- Vite reports a non-blocking large Three.js bundle warning.
