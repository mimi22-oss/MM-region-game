# Player home safety and ghost retreat

## Location audit and selected boundary

Authoritative fallback centre: X 174.891, Z 183.666. Provided local U/V (-6.205, 253.538) agrees with the Area 5 projection to rounding. Approximate GPS and the player's reference yaw are not used to position or orient ghosts.

The actual existing owned home is `farmhouse` (`homeOwnership` / `homeAccess`), at local U=-72, V=270. Its render and collision compound agree on local X=-9..18, Z=-7.5..7.5, rotated by farmhouse.rotation. The authored frontLot and other Area 5 yards do not contain the requested authoritative point. That point is approximately 68 m from the farmhouse centre, near the AH1 approach. Recentring the existing compound on it would invent geometry. This implementation therefore uses the explicitly allowed temporary circle at the exact requested coordinates: radius 18 m, retreat/re-entry buffer 5 m. It does not move any house, yard, fence, gate or map record.

`configureTemporaryHomeRadius(radius)` permits fallback tuning while retaining the exact authoritative centre. These defaults are temporary; they can cover part of the road until an actual yard polygon is authored.

An admin can draw/select a Block polygon in the existing map editor, click **Use as player home safe boundary**, edit its vertices and Save. A valid saved polygon marked `metadata.safeZone: player-home` replaces the circle. Boundary edges count as protected; the 5 m outer buffer is based on nearest polygon-edge distance. Keep one tagged polygon; if multiple exist, the first valid saved polygon wins deterministically. Remove the tag to restore the fallback. Invalid/self-crossing/degenerate rings fall back safely. The cached boundary is rebuilt once per saved editor revision, not searched every frame. Existing user ownership/edit permissions remain intact; non-admin users cannot assign the region-wide safety tag through this UI.

## Safety and state ordering

`GhostAiController.step` checks home protection before schedule activation, sensing, encounter counting, SCARING windup, chase movement and GRABBING catch checks. Entering clears the pending AI audio cue, grab phase, fall progress and navigation target. The shared controller covers all currently spawned ghosts, including all three independent instances. The current repository does not have separate Hunter/Ambusher/Stalker implementations; any instance using this controller receives the same highest-priority rule.

Existing DORMANT/HIDING/WANDERING/CHASING/GRABBING/COOLDOWN states are retained. New states are **RETREAT** and **FADE_OUT**:

1. Cancel chase/grab and attack/collision eligibility immediately.
2. Face the player for 0.4 s, using player-relative atan2 rather than the supplied player reference yaw.
3. Back away for 0.6 s in the existing depressed/hesitation animation.
4. Continue moving away while opacity follows a smoothstep fade over 2 s.
5. Remain invisible through a 12 s cooldown, returning to the original recorded spawn while hidden.
6. Respawn with the existing fade-in only after cooldown, player exit beyond the 5 m buffer, an active schedule and a valid unblocked spawn outside protection/buffer.

Retreat tests short candidate steps (at most 8 cm) through the existing walkability/collision system, accepting only steps that do not approach the home boundary. Alternatives are angled backward/sideways. If buildings/fences block all candidates, the ghost stands and fades; it never forces a path through obstacles. The hidden reset to spawn is an intentional non-rendered relocation, not visible movement through a wall. If map edits block or protect the spawn, it remains hidden rather than respawning unsafely.

Player-side protection clears stale multi-ghost grab/threat signals before consuming them, preventing a previous-frame grab/fall callback from affecting a protected character. A fall special action started by a ghost is cancelled on protected entry. Normal manual actions are not deliberately cancelled. Repeated protected frames do not restart retreat or fade. Simulation dt advances the sequence, with no attack/fade wall-clock timers. Paused scenes now keep ghost instances mounted and suspend their asset-arm/AI/mixer frame work, preserving retreat and cooldown progress across pause/resume. Other NPC and ambient scene gating stays on its existing lifecycle; background audio uses the shared suspension behavior.

`attackEnabled`, `collisionEnabled` and `homeProtected` are exposed on the snapshot; eligibility is mirrored on NPC userData. Existing ghosts do not register solid player-blocking bodies or an independent damage/health/kill service; retreat does not add one. Their navigation still respects buildings/fences. These flags let future attack/collision consumers retain the safety invariant.

## Visuals and audio

Ghost materials were already cloned per instance. Their authored opacity, transparency and depthWrite defaults are now remembered on the clones, multiplied by fade opacity, and restored on respawn. Shader updates occur only when the transparency mode changes, not at every opacity change. Shared cached GLB materials stay untouched.

Four additional runtime presets use the existing shared Web Audio graph:

- ghost_hesitation: falling voiced tone and breath noise.
- ghost_low_laugh: quiet, low rhythmic voiced pulses.
- ghost_retreat_whoosh: filtered noise and descending tone.
- ghost_fade_ambient: soft two-second noise/drone envelope.

RETREAT and FADE_OUT state edges emit their cues once. Old chase/scream/grab voices are cancelled before retreat cues; ordinary ambient/tension loops are disabled during retreat. Pending old animation clips cannot retrigger attack audio during safety transitions. Existing audio files/network behavior is unchanged: there are no external sound assets and one shared AudioContext.

## Changed files

| File | Reason |
|---|---|
| src/game/playerHomeProtection.ts (new) | Exact-coordinate fallback, configurable radius, editor polygon validation/cache, inclusive signed-distance/buffer query and collision-aware retreat stepping |
| src/game/ghostAi.ts | Priority safety check, two states, pending-grab cancellation, original spawn, hidden cooldown, snapshot eligibility |
| src/components/Player.tsx | Protected-area guard against stale grab/fall signals |
| src/components/GhostNpc.tsx | Retreat audio cancellation, pending-clip safety, state metadata, per-instance opacity helper, pause propagation and frame suspension |
| src/components/StreamedWorld.tsx | Preserve ghost/controller identity across pause, passing paused instead of unmounting ghosts |
| src/game/ghostVisuals.ts (new) | Preserve/restore instance material defaults with bounded shader updates |
| src/game/ghostAudio.ts | Four procedural retreat presets and deduplicated state-edge cues |
| src/components/WardVillageEditor.tsx | Admin polygon safe-boundary toggle; existing vertex editing/save flow |
| tests/playerHomeProtection.test.ts (new) | Boundary/cache, same-frame catch precedence, windup/grab cancellation, independent ghosts, collision/fade/cooldown/pause/respawn and material isolation |
| tests/ghostAudio.test.ts | Inventory and retreat/fade event deduplication |
| scripts/checkGhostAudio.mjs | Exercise all 21 procedural presets through actual browser audio graph |
| package.json | Register the new safety tests |
| artifacts/performance-audit/home-*.log | Actual validation evidence |

## Executed validation

- Targeted AI/audio/home suite: **18 passed, zero failed**.
- Full `npm test`: **274 passed, zero failed**. Includes existing threshold 2–6 encounter/animation/navigation tests, collision/physics, editor permissions and streaming tests.
- `npm run map:audit`: **passed**, 5,862 records / 11 regions. No dataset, projection or feature count changes; no new geometry/collision/traffic adapter.
- Final targeted home/audio/special-action suite: **15 passed, zero failed**, including configurable circle and existing animation generation/retrigger behavior.
- Actual Chrome audio browser regression: **passed**, all 21 presets, shared context, bounded voices, cleanup, mounted warehouse zone, background suspension and zero audio-file requests.
- `npm run build`: **passed** (TypeScript + Vite); existing large-chunk warning remains. Evidence: home-build.log.

Browser tests exercise synthesis/lifecycle and the existing haunted zone; pure simulation/Three.js tests exercise retreat, timing and material isolation. A full rendered home-entry encounter and physical Android device/WebView performance have not been visually profiled. No universal FPS or acoustic-loudness guarantee is made.

This remains the existing client-side NPC simulation. It adds no network message that accepts client-supplied safety, ownership or damage authority. A future authoritative multiplayer ghost/damage service must evaluate the same boundary against server-owned player positions and an admin-validated boundary definition. The original multiplayer Phase 2 remains separate.
