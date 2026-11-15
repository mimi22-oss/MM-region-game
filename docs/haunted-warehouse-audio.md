# Haunted Warehouse Audio Zone

Implemented at သိုလှောင်ရုံတန်း · မြို့သာ နယ်မြေ (၅), anchor X 35.149 / Z 36.176. The zone can be heard independently of ghost model loading or visibility. Existing randomized ghost spawn assignments and AI approach counts are preserved.

## Incremental changes

1. Added pure seeded scheduler, hysteretic distance bands, and geometry-derived sound origins; verified these independently of Web Audio.
2. Extended the existing procedural synthesizer with warehouse creak, wood crack, metal knock, tree rustle, horror drone, and sudden-scream presets. Existing whisper, evil-laugh, footsteps and encounter sounds are reused. All 17 available presets use runtime-generated oscillators/noise; there are no audio downloads, decoders, media elements or remote audio services.
3. Mounted HauntedWarehouseAudioZone alongside the existing streamed NPCs, reusing world time, sound preference, active Myothar region, intro/pause gating, shared context and Ghost bus. Added spatial controller, smooth gains, optional coarse occlusion and bounded resources.
4. Added browser regression covering actual mounted R3F zone, real Web Audio graph, authored source coordinates, night/day and background transitions.

## Architecture

- **HauntedWarehouseAudioZone** reads player world position and active camera world basis without per-frame React state updates. Camera tracking remains independent of the lazy ghost GLB. Zone logic runs at 10 Hz. This component never calls AI encounter or threshold methods.
- **ProceduralHorrorSynth** is the public compatibility name for the existing shared GhostHorrorAudio implementation, not a second context or graph. New effects combine FM oscillators, filtered noise, formant filtering, envelopes and synthesized reflections.
- **GhostAudioEventScheduler** uses seeded LCG weighted selection, randomized intervals and a simulation clock. Distant events emphasize tree rustle, building creaks, knocks and low drone. Nearer events add wood cracks, distant/mimicked laughter/footsteps and whispered voices. Sudden screams have low probability in the near band. No adjacent preset/origin repetition where alternatives exist. Scheduler does not schedule footsteps for the moving NPC; those remain tied to real mixer timing.
- **GhostSpatialAudioController** owns only warehouse zone sources and their lifetime. At most four emitter slots are retained; idle slots are evicted/reused as origin selection changes. All sources share the application's context, Ghost bus and existing compressor/output protection. Per-emitter low-pass filters are reused. Normal daytime rural ambience remains on its existing Ambience bus.

Distance thresholds are configurable through HauntedZoneConfig, default 60 / 40 / 20 / 8 m. Entry uses the nominal boundary and exit requires a 2 m margin. Outer gain uses a smoothstep ramp over the last 15 m. Source gains ramp over 120 ms; HRTF panning and inverse attenuation apply between the actual source and camera. Zone sources use a 12 m reference distance / 1.25 rolloff so distant environment effects remain softer but audible; NPC sources retain their original 3 m / 1.8 settings. A source must also be within 65 m of the player to be selected.

The first eligible event is 1–3 simulation seconds after entry. Subsequent intervals vary by band: distant 10–18 s, uneasy 7–13 s, near 4–8 s, with a minimum 4.1 s tail allowance plus 2.5 s quiet gap. Laughter cooldown is 24 s, screams 50 s. Zone overlap limit defaults to two; tail reservation normally produces one event at a time. No catch-up burst is emitted after pause/background. Within the encounter band or while NPC confrontation audio is playing, zone effects fade/stop and the existing clip/contact audio takes priority.

Ambient laughter is a spatial environmental/mimicked sound from a warehouse wall; it does not make an invisible NPC animate. Actual NPC laughter/scream remains tied to its running laugh/freaky clip. Existing AI already supports threshold 2–6 -> freaky -> laugh -> chase -> grab/fall; its implementation is unchanged.

## Actual geometry

Origins come from current Area 5 warehouse footprints and roadside tree records, retaining the authored Math.PI/4 projection/rotation. Wall points are transformed using x = centreX + localX*cos + localZ*sin, z = centreZ - localX*sin + localZ*cos. Warehouse effects sit on side walls at 2.2 m height (existing building eave 7 m); tree rustle is at the tree X/Z with 3 m source height. No arbitrary bounding-box routes or map features are created. Origins from original sources replaced/removed through the map editor are muted/skipped. Custom replacement geometry does not automatically gain audio origins in this version.

Optional occlusion (`occlusion` prop, off by default) tests the camera/source segment against actual rotated warehouse footprints and smoothly lowers the reused filter to 950 Hz. It is a coarse horizontal approximation below 6 m camera height, not diffraction, full acoustic simulation, or a triangle raycast.

No datasets, feature counts, map projections, physics, labels or traffic registrations changed. Myothar map audit remains 5,862 records over 11 regions. The new audio component follows the existing streamed scene lifetime; unmount releases its voices and emitters. It does not register new collision/ground geometry.

## Lifecycle / Android

Context creation/resume occurs only through the shared runtime's trusted user interaction handlers. Background visibility or the existing native/app active flag suspends the context and clears ghost voices; returning requires an appropriate gesture when the browser demands it. Daytime or zone exit fades/stops zone voices without suspending normal daylight ambience. Synth polyphony is globally capped at 24 preset voices; sources/modulators/filters are disconnected at completion or cancellation. Audio synthesis works offline after the application code is available. There are no per-frame React renders, audio fetches, new mixers or timer loops.

## Files

| File | Reason |
|---|---|
| src/components/HauntedWarehouseAudioZone.tsx (new) | R3F position, time, zone and scheduler integration |
| src/game/audio/GhostAudioEventScheduler.ts (new) | Configurable bands, seeded weighted scheduling, cooldowns and silence |
| src/game/audio/warehouseSoundOrigins.ts (new) | Authored wall/tree origins and optional footprint occlusion |
| src/game/audio/ProceduralHorrorSynth.ts (new) | Reusable synth API sharing existing engine |
| src/game/audio/GhostSpatialAudioController.ts (new) | Spatial owners, attenuation, filters and bounded emitter cache |
| src/components/StreamedWorld.tsx | Mount zone with existing NPC/pause/region lifecycle |
| src/game/ghostAudio.ts | Six extra presets, reusable occlusion filter, zone attenuation and voice activity queries |
| src/game/gameAudio.ts | Native/app inactive transition suspends context and clears voices |
| tests/hauntedWarehouseAudio.test.ts (new) | Scheduler, geometry, time, bands, overlap and cooldown checks |
| tests/ghostAudio.test.ts | Update preset inventory assertion to 17 |
| tests/fixtures/hauntedWarehouseAudio.html/.tsx (new) | Real mounted zone fixture without ghost GLB |
| scripts/checkGhostAudio.mjs | Real-browser zone, source churn, sound-file request and lifecycle assertions |
| package.json | Register both audio test suites and browser command |
| artifacts/performance-audit/warehouse-*.log, audio/audio-regression.json | Executed validation evidence |

## Validation and limits

- Targeted ghost AI/audio/warehouse suite: 15 passed, zero failed. Includes the existing complete 2–6 encounter escalation tests and animation/audio synchronization checks.
- Full `npm test`: 267 passed, zero failed. `npm run map:audit`: passed, 5,862 records / 11 regions. `npm run build`: passed (TypeScript + Vite); existing large-chunk warning remains. Evidence: warehouse-build.log.
- Chrome real Web Audio browser regression: all 17 presets; shared context with normal ambience; global voice cap 24; completion/cancellation cleanup; mounted R3F night entry and return; exit/daytime silence; HRTF source coordinates; encounter-band handoff; four-slot emitter cap under origin churn; inactive context suspension; zero audio-file requests and zero runtime exceptions.

Physical Android WebView, headphones, thermal behavior and full-world frame-time measurements have not been executed. Chromium browser success and bounded resource assertions are not a hardware FPS or subjective loudness guarantee. Remaining work is device listening/calibration, authored foot-contact marker refinement and terrain-height-aware occlusion/source heights if warehouse geometry changes. No multiplayer authority or event replication protocol is added; future authoritative ghost event IDs can feed the existing animation/audio interface.
