# Latest car and mobile controls verification

- TypeScript + Vite production build: PASS.
- Targeted suite: 9 tests PASS, including car collision/road clearance and touch directions/reset state.
- Reviewed independent left/right pointer capture, long-press timer cleanup, pointer cancellation, blur/visibility cleanup and menu/map disabling.
- Desktop pitch is unchanged when touch input is idle.
- Real phone multi-touch and browser visual checks not performed.
- dist/ and ZIP refreshed. Previous unrelated lake-road issue remains documented below.

---
# Latest autonomous robot verification

- TypeScript + production build: PASS.
- Targeted performance/robot suite: 7 tests PASS. Coverage includes 64 unique palettes/sizes, road junctions, blocked edges, dead-end reversal and safe patrol routes from lanes to highways in all eight regions.
- Static world layout, player movement and player mint palette retained.
- Browser visual verification / FPS measurement not performed.
- dist/ and ZIP refreshed. Existing unrelated Kyar Inn lake-access overlap remains documented below.

---
# Latest robot eye update

- Added dark pupils and small white highlights to both eyes.
- TypeScript + Vite build: PASS.
- Browser visual verification not performed.
- dist/ and ZIP refreshed.

---
# Latest camera / robot heading fix

- Camera yaw and robot heading separated.
- Targeted suite: 4 tests PASS, including stationary orbit, cardinal/diagonal movement, and negligible movement.
- TypeScript + Vite build: PASS. dist/ and ZIP refreshed.
- Browser mouse-orbit appearance has not been visually verified.

---
# Latest robot character verification

- TypeScript and Vite production build: PASS.
- Robot is rendered under the existing player root, preserving camera self-exclusion and first-person hiding.
- Wheel rotation uses the actual movement delta, excluding aerial camera movement.
- Browser appearance and wheel animation have not been visually verified.
- Existing lake-access overlap noted below is unrelated and not changed in this update.
- dist/ and ZIP refreshed with the robot character.

---
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

### Mobile pinch / free steering update
- Performance and input regression suite: 10/10 passed, including diagonal steering, sprint versus pinch, both same-half pinch cases, zoom direction, reset and remaining-finger suppression.
- TypeScript and Vite production build passed. Existing large-bundle warning remains.
- Real-device multitouch and visual browser verification not performed. Full collision suite not rerun; previously recorded lake-access road overlap remains outside this change.

### Mobile village travel
- Input/performance suite: 11/11 passed. Added parallel two-finger drag tests on either half and across halves, unchanged zoom under parallel drag, combined pinch/pan, and release/reset suppression.
- TypeScript/Vite production build passed; existing bundle size warning remains.
- Desktop and touch panning share the same bounds and collision-aware placement implementation. Physical mobile gesture testing has not been performed.

### Mobile memory / scene loading update
- Input/performance regression suite: 12/12 passed. A synthetic 1,000-region selection test verifies one/two detailed-region caps, 16/32 overview caps, aerial unloading, distant eviction and boundary hysteresis.
- TypeScript + Vite production build passed with separately emitted region/plan chunks. The main vendor/data bundle still exceeds Vite's 500 KB advisory threshold.
- Runtime browser inspection was attempted, but the browser tool failed to initialize its kernel assets. No real-device FPS, peak memory, or crash reproduction measurements are claimed. The cause of the reported mobile browser page failure remains unconfirmed.
- Full collision suite was not rerun; the previously recorded lake-access road issue is unchanged.
- Manual follow-up: load on a phone, pan through each village, switch day/night, zoom to aerial view, select a destination in Ward Plan, return to walking; monitor peak memory and GPU resource counts over repeated trips.

### Camera / character separation
13/13 input/performance tests passed, including camera travel at rotated headings and world bounds without mutating robot position or heading. TypeScript/Vite production build passed. Physical device verification not performed.

### Camera navigation shortcuts
TypeScript/Vite build and 14/14 input/performance tests passed. Teleport tests cover a clear target, nearby clearance, fully blocked ground and invalid coordinates. Real-device interaction and visual checks remain unperformed.

### View location / flicker mitigation
16/16 input/performance tests passed, including camera-focus travel to Htauk Kyant while the robot remains at spawn, region altitude hysteresis and movement/zoom settling. TypeScript/Vite build passed. Physical-device visual verification was not available, so elimination of all rendering flicker is not claimed. Existing full collision-suite caveat remains unchanged.

### Home ownership and car traffic
Full `npm test`: 47/47 passed. Includes owner/non-owner gate behavior, closed/open collision and delayed closing; timed walking from the main road through the property gate; farmhouse entry and interior furniture/wall collision; main-road merging, two-way paths and continuous turns; appearance variation; windshield outward offset. Previous collision-suite caveats are superseded by this full passing run against the current workspace. TypeScript/Vite production build passed. No physical-mobile or visual browser verification performed.

### Estate perimeter and areca palms
48/48 tests passed, including owned parcel corner containment, neighbor exclusion, entrance clearance, raised canal panels and palm placement. TypeScript/Vite production build passed after running outside the restricted filesystem sandbox. No physical-device or visual browser verification performed.

### Three-second entry and farmhouse spawn
49/49 tests passed, including no unlock before three seconds, movement resetting the wait, owner access, timed entry from the road, and safe interior spawn coordinates. TypeScript/Vite production build passed. Physical-device visual verification not performed.

### Robot location panel
50/50 tests passed, including geographic anchor, east/north coordinate signs, compass directions and precise coordinate copy text. TypeScript/Vite production build passed. Browser/device visual interaction and clipboard verification were not performed.

### Cartoon character / robot selection
Full existing automated suite: 58/58 passed, including the two-room toilet approaches, entry and fixture/wall collision. Final TypeScript/Vite production build passed (existing large-chunk advisory remains). Isolated headless Chrome visual review covered front and rear views, with hair/hood refinements after inspection. Browser checks confirmed one active player model, Cartoon -> Robot -> Cartoon switching without changing position/yaw/camera, local persistence after reload, and a 390px mobile Settings layout without horizontal overflow; no runtime exceptions were observed in that smoke check. Physical-phone performance was not measured. Preview images are saved under artifacts/.

### Surface-following actors and motorcycle riding (2026-10-24)
64/64 automated tests passed. Tests cover semantic bridge/stair heights, rotated and instanced surfaces, streamed surface removal, tire clearance, variable car sizes, shared surface indexing, speed limits, braking/reverse, camera pause and blocked movement. TypeScript and Vite production build passed; existing large-chunk advisory remains. Player, parked motorcycle/cars, robot patrols and car traffic now sample the shared ground index. Cartoon walking includes extra swing-foot clearance on steps; this is procedural animation rather than full skeletal foot IK. Head and motorcycle isolated Chrome previews completed without runtime exceptions. Physical-phone performance and a full interactive ride over every bridge have not been verified.
