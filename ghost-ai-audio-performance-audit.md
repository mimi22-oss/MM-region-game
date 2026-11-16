# MM REGION GAME — GHOST AI, HORROR AUDIO & PERFORMANCE AUDIT

## ROLE

Act as a Principal Game AI Engineer, Senior Three.js / React Three Fiber Engineer, Web Audio API Engineer, and Game QA Automation Engineer.

Perform a comprehensive, evidence-based audit of the existing MM Region Game project.

Primary objective:

Ensure that ghosts actually detect, chase, approach, attack, and catch the player according to their configured behavior, while horror audio remains reliable, immersive, and lightweight on Web and Capacitor Android.

**AUDIT FIRST. DO NOT MODIFY PRODUCTION CODE UNTIL THE AUDIT REPORT IS COMPLETE.**

Do not assume that an existing function, event, component, or test means the feature works correctly at runtime.

---

# PART 1 — REPOSITORY DISCOVERY

Inspect the entire relevant dependency chain, including:

- `src/game/ghostAi.ts`
- `src/game/ghostAudio.ts`
- `src/game/gameAudio.ts`
- `src/game/playerHomeProtection.ts`
- `src/components/StreamedWorld.tsx`
- `src/components/HauntedWarehouseAudioZone.tsx`
- `src/game/audio/`
- `src/components/EnvironmentAudio.tsx`
- `src/game/spatialIndex.ts`
- `src/game/regionLoading.ts`
- `src/services/assetCacheManager.ts`
- `scripts/checkGhostAudio.mjs`

Also discover all actual ghost components, ghost spawning logic, player controllers, animation controllers, scene transforms, physics/collision systems, world-streaming dependencies, and performance configuration.

Do not assume the listed files are the complete implementation.

Produce a dependency diagram showing:

Player Position → Ghost Detection → AI State → Movement → Attack → Audio → Rendering.

Identify all early returns, feature flags, diagnostic switches, visibility gates, paused states, and mounting conditions that could prevent ghost behavior.

---

# PART 2 — GHOST SPAWN AND LIFECYCLE AUDIT

Verify:

1. Ghost entities are actually spawned.
2. Spawn coordinates are valid.
3. Ghosts are mounted in the active scene.
4. Ghosts are not accidentally disabled by performance settings.
5. Ghost AI continues running when appropriate.
6. Ghost AI does not depend on visual rendering unnecessarily.
7. Ghosts are not silently removed by chunk unloading.
8. Spawn/despawn does not create duplicate ghost entities.
9. Ghost models and animations load correctly.
10. Ghosts resume correctly after pause, teleport, or scene transitions.

For every ghost, record:

- Entity ID
- Spawn position
- Active state
- Current AI state
- Detection range
- Attack range
- Movement speed
- Player distance
- Last state transition
- Last movement update
- Reason for inactivity

If a ghost is visible but does not move, identify the exact point where its behavior stops.

---

# PART 3 — GHOST DETECTION AND CHASE AUDIT

Verify the complete detection pipeline.

Test:

- Player outside detection radius.
- Player just inside detection radius.
- Player directly beside the ghost.
- Player overlapping the ghost.
- Player running away.
- Player standing still.
- Player moving behind the ghost.
- Player teleporting into detection range.
- Player entering and leaving the range repeatedly.
- Player moving rapidly across chunk boundaries.

Investigate:

- Incorrect coordinate spaces.
- Scene/world position mismatches.
- X/Z distance calculations.
- Incorrect distance thresholds.
- Stale player position references.
- React stale closures.
- Missing frame updates.
- Incorrect delta time.
- Disabled AI updates.
- Invalid target references.
- State machine deadlocks.
- Animation locks.
- Movement cancellation.
- Collision blocking.
- Navigation/pathfinding failure.

Check whether ghost movement is updated using the correct simulation time step.

Avoid frame-rate-dependent movement.

A ghost should not remain idle indefinitely while an eligible player is inside its detection radius unless a documented rule explains why.

Do not bypass intentional safe zones or gameplay restrictions to force a chase.

---

# PART 4 — MULTIPLE GHOST STATE MACHINES

Audit every ghost independently.

Inspect existing configuration rather than assuming all ghosts have the same detection radius.

Verify the intended state transitions:

IDLE
  ↓
DETECTING
  ↓
CHASING
  ↓
ATTACKING / GRABBING
  ↓
RECOVERY / RETREAT
  ↓
IDLE

Also inspect special states such as:

- DISABLED
- DESPAWNED
- STUNNED
- RETURNING
- SAFE_ZONE_RETREAT

Verify:

1. Every state has a valid entry condition.
2. Every state has valid exit conditions.
3. No state becomes permanently stuck.
4. Timers and cooldowns advance correctly.
5. Multiple ghosts do not overwrite one another's state.
6. Ghost detection ranges remain independent.
7. Ghosts can recover from failed pathfinding.
8. Ghosts resume chasing after temporary movement obstruction when appropriate.
9. Ghosts do not repeatedly trigger attacks every frame.
10. Ghosts correctly stop chasing when the player reaches a protected zone.

Add deterministic tests for all critical transitions.

---

# PART 5 — GHOST MOVEMENT AND NAVIGATION

Audit actual movement behavior.

Verify:

- Ghost approaches the player's current or predicted position.
- Ghost does not move in the opposite direction.
- Ghost does not remain frozen while playing a walking animation.
- Movement speed matches configuration.
- Ghost movement is independent of rendering FPS.
- Navigation obstacles are handled correctly.
- Ghost does not pass through blocked geometry unless intentionally designed.
- Ghost does not become stuck on buildings, walls, or terrain.
- Teleporting the player does not corrupt ghost navigation.
- Pathfinding is not recalculated unnecessarily every frame.

Measure:

- Distance to player over time.
- Movement displacement.
- Pathfinding update frequency.
- Number of stalled movement frames.
- Time required to reach the player.

Create a reproducible test in an unobstructed environment:

When the player is inside detection range and outside protected zones, the ghost must enter the intended chase state and reduce its distance to the player within the configured response window.

The exact response window must come from existing design configuration or be proposed explicitly, not invented as an existing requirement.

---

# PART 6 — ATTACK, GRAB, DEATH AND RESPAWN

Verify:

1. Attack range uses correct world coordinates.
2. Ghost can actually reach attack range.
3. Attack events trigger once per valid attack.
4. Attack animation and gameplay hit detection are coordinated.
5. Player damage or death occurs according to existing rules.
6. Attack cooldowns work.
7. Ghost cannot attack through protected zones.
8. Multiple ghosts do not cause duplicate death processing.
9. Respawn restores the intended player state.
10. Ghosts reset or retreat correctly after respawn.

Check whether the attack depends on an animation event that may never fire.

Provide deterministic tests for close-range encounters.

---

# PART 7 — PLAYER HOME SAFE ZONE

Inspect the existing player home protection system.

Verify:

- Safe-zone geometry and coordinates.
- Polygon versus fallback-radius behavior.
- Scene coordinate transformations.
- Boundary buffer behavior.
- Ghost retreat logic.
- Ghost fade/disappearance.
- Audio fade behavior.
- Re-entry behavior.

A ghost should chase the player outside the safe zone when eligible, but must respect the configured safe-zone rules.

Test the exact boundary and just-inside/just-outside positions.

Do not remove safe-zone protection as a workaround for broken chase logic.

---

# PART 8 — HORROR AUDIO FUNCTIONAL AUDIT

Inspect the existing procedural audio engine and the supplied horror audio pack integration.

Check:

- AudioContext lifecycle.
- Audio unlock.
- Browser autoplay restrictions.
- Android WebView behavior.
- Master volume.
- Ghost audio volume.
- Warehouse ambience volume.
- Audio asset paths.
- Manifest resolution.
- Opus decoding.
- Spatial audio.
- Distance attenuation.
- Sound event scheduling.
- Random sound event cooldowns.
- Audio bus routing.
- Paused/suspended states.
- Background/foreground recovery.

Verify that audio playback is not incorrectly gated by ghost visibility or NPC rendering settings.

Verify that warehouse ambience can operate independently of ghost AI.

Check all sound events:

- Ghost idle
- Ghost detection
- Ghost chase
- Ghost laughter
- Ghost whisper
- Ghost scream
- Ghost grab
- Ghost retreat
- Warehouse entry
- Warehouse exit

For each event, record:

- Trigger condition
- Audio asset or procedural source
- Playback function
- Active volume
- Cooldown
- Spatial position
- Success/failure status
- Error or skip reason

Distinguish between successful scheduling, successful decoding, successful audio graph playback, and actual audible output.

Do not claim audio is audible based only on unit tests.

---

# PART 9 — AUDIO PERFORMANCE AUDIT

Horror audio must not cause noticeable gameplay slowdown.

Measure:

- Initial audio loading time.
- Audio download size.
- Decoded audio memory.
- Active AudioNodes.
- Active audio voices.
- AudioContext count.
- Audio event scheduling frequency.
- Audio decoding time.
- Main-thread blocking.
- Audio-related garbage collection.
- FPS and frame-time impact.
- Memory usage after repeated zone entry/exit.

Look for:

- Repeated fetch requests.
- Repeated decoding.
- AudioContext creation inside frame loops.
- Excessive AudioNode allocation.
- Unbounded sound overlap.
- Duplicate ambience loops.
- Unreleased AudioBuffer references.
- Unreleased audio nodes.
- Frequent React state updates caused by audio.
- Unnecessary spatial position updates.
- Large decoded background tracks.
- Sound scheduling on every render frame.

Recommendations should consider:

- Reusing one AudioContext.
- Shared audio buffers.
- Bounded voice pools.
- Short-effect preloading.
- Streaming long ambience when appropriate.
- Lazy loading.
- Controlled prefetching.
- Spatial audio update throttling.
- Smooth fades.
- Procedural fallback.
- Device-specific quality budgets.

Do not introduce complexity unless measurements justify it.

---

# PART 10 — GHOST AI PERFORMANCE AUDIT

Measure:

- Active ghost count.
- Simulated ghost count.
- Visible ghost count.
- AI update time.
- Pathfinding time.
- Animation update time.
- Collision-check time.
- Render draw calls.
- GPU memory.
- Total frame time.

Investigate:

- Excessive per-frame allocations.
- O(N²) distance checks.
- Duplicate AI update loops.
- Frequent pathfinding.
- Unnecessary animation updates.
- AI updates tied to React renders.
- Resource leaks after ghost despawn.
- Stale references after chunk unload.

Test performance with:

- 1 ghost
- 3 ghosts
- 10 ghosts
- 50 ghosts
- 100 ghosts

Separate simulation tests from rendering tests.

Do not assume all 100 ghosts must be fully rendered and animated simultaneously.

Preserve full AI behavior for ghosts near the player while using appropriate simulation LOD for distant NPCs.

---

# PART 11 — GAMEPLAY AND AUDIO INTEGRATION

Audit the event flow:

Ghost Detects Player
  → Chase State Starts
  → Detection Audio Plays
  → Ghost Moves Toward Player
  → Chase Tension Fades In
  → Ghost Reaches Attack Range
  → Attack/Grab Event Fires
  → Grab Audio Plays
  → Player Death/Respawn Logic Executes
  → Audio Fades or Resets

Ensure:

- Audio does not control AI logic.
- AI behavior does not depend on audio decoding.
- Failed audio playback never stops ghost movement.
- Audio events are emitted once per state transition.
- Chase audio does not restart every frame.
- Ghost despawn releases audio resources.
- Audio and animation remain synchronized where required.

Use explicit typed gameplay events if the existing architecture supports them.

---

# PART 12 — AUTOMATED REGRESSION TESTS

Create tests for:

1. Ghost detection within range.
2. Ghost ignores player outside range.
3. Ghost begins chasing eligible nearby player.
4. Ghost approaches player over time.
5. Ghost can reach attack range.
6. Ghost attack executes correctly.
7. Ghost respects safe zone.
8. Ghost recovers after temporary obstruction.
9. Ghost behavior survives pause/resume.
10. Ghost behavior survives teleport.
11. Multiple ghosts maintain independent state.
12. Ghost AI does not stop when audio fails.
13. Audio does not stop ghost movement.
14. Audio files are not repeatedly decoded.
15. Audio voice count stays within budget.
16. Warehouse ambience works independently.
17. Repeated enter/exit does not leak audio nodes.
18. AudioContext recovery works after suspension.
19. Existing ghost tests continue to pass.
20. Existing gameplay features remain functional.

Use deterministic clocks and seeded randomness where appropriate.

Avoid tests that only check whether functions exist.

Test actual state transitions and observable movement.

---

# PART 13 — RUNTIME DEBUGGING TOOLS

Recommend or implement, after approval, a development-only Ghost AI Debug Overlay.

Display:

- Ghost ID
- Ghost state
- Detection radius
- Player distance
- Target position
- Movement velocity
- Pathfinding status
- Last state transition
- Attack cooldown
- Safe-zone status
- Last emitted audio event
- Active audio voice count
- AudioContext state
- AI update time
- Audio processing time
- FPS / frame time

Provide optional visual debugging:

- Detection radius
- Attack radius
- Target direction
- Current navigation path
- Safe-zone boundary

Debug rendering must be disabled in production.

---

# PART 14 — AUDIT REPORT

Create:

`docs/audits/ghost-ai-audio-performance-audit.md`

For every finding, include:

- Severity: P0 / P1 / P2 / P3
- Affected file
- Exact function
- Relevant line numbers
- Reproduction steps
- Expected behavior
- Actual behavior
- Root cause
- Evidence
- Proposed fix
- Regression test
- Performance implications

Classify findings as:

- CONFIRMED
- REPRODUCED
- CODE-LEVEL RISK
- NOT VERIFIED

Do not label a runtime issue as confirmed unless it has been reproduced or directly demonstrated.

---

# PART 15 — FIX PLAN (DO NOT EXECUTE YET)

Prepare a prioritized implementation plan.

Priority order:

P0:
- Ghost cannot detect/chase eligible nearby player.
- Ghost AI permanently stops.
- Game crashes or freezes.

P1:
- Ghost cannot reach or attack player.
- Incorrect safe-zone behavior.
- Audio resource leaks.
- Severe performance degradation.

P2:
- Missing horror audio.
- Incorrect spatial audio.
- Repetitive or poorly synchronized sounds.
- Excessive asset loading.

P3:
- Cinematic polish.
- Additional sound variation.
- Minor animation/audio improvements.

For each proposed fix, estimate risk and required tests.

Do not implement fixes until explicitly approved.

---

# EXECUTION RULES

1. Audit the real repository, not assumptions.
2. Preserve existing gameplay design.
3. Do not modify production code during the initial audit.
4. Do not disable ghost AI to improve FPS.
5. Do not disable audio to hide performance problems.
6. Do not bypass safe zones to force ghost chasing.
7. Do not modify detection ranges without evidence.
8. Do not rebuild the audio engine unnecessarily.
9. Do not claim Android testing without a real device.
10. Do not claim audible sound without actual playback verification.
11. Provide commands executed and real test results.
12. Separate confirmed bugs from suspected problems.
13. Report missing files and blocked tests explicitly.
14. Do not claim a test passed unless it actually ran.
15. Do not stop after finding the first bug; inspect the entire behavior chain.

## START NOW

Perform the complete audit.

Begin with Ghost AI spawning, detection, chase, movement, and attack.

Then audit Horror Audio reliability and performance.

Finally produce the prioritized audit report and proposed regression tests.

Do not change production code until the audit report is complete.