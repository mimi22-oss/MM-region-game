# Ghost Mission sword combat and weapon inventory

## Controls

Encounter the three distinct ghosts within 8 m. Approach the football-field sword within 3.2 m after all live guards are more than 20 m from it. Press E or tap Pick up and remain eligible for two seconds. The sword equips for the mission.

Press F or tap Attack for a combo. Press again during the second half of the current swing to buffer one follow-up. The six cuts are left, right, left diagonal, overhead, rising and finisher. Shift+F performs a heavy cut. The combat HUD also offers individual attacks, block, parry and left/right dodge.

Defeating the last ghost stores the sword and frees both hands. Open the main HUD menu and use **Weapon** to choose the ghost sword or empty hands. Stowing during an attack releases its action and movement lock. The mission save stores the choice. Completed version-1 saves without an equipment field start empty-handed. An unfinished save with the collected quest sword starts armed.

## What made the combat look stiff

The actual heavy clip on all three player rigs has six keys each on the chest, right upper arm and right forearm. The horizontal left clip adds the left upper arm. Neither move supplies a support-hand contact, weight transfer or foot plant. The old grip calibration depended on the wrist pose at attachment time. The first browser probe showed the first slash passing to the side of a stationary ghost 1.1 m ahead and dealing zero damage.

The fitted clips use rig-specific shoulder width, reach, palm offsets and a calibrated grip. One-hand attacks bring the free hand back for balance. Overhead, heavy, jumping cuts, finisher and block bring the support palm onto the pommel. Chamber, cut and recovery have different hip/chest turns and knee bends. The standing cuts plant the feet in a staggered stance. Fitting runs once per loaded character asset and caches regular animation tracks. Each avatar plays them on its existing mixer. Both meshes face model +Z, although Canolia assigns its right-hand bone to the opposite X side from Mixamo.

## Assets and gameplay

Boy and Girl each contain the 23 combat clips below. Canolia contains the same clips plus Bike_Drive, Bike_Idle, Bike_Mount, Car_Drive, Idle, Swim_Forward, Swim_Idle, Vault and Walk. The ghost contains Ghost_Attack, Ghost_Hit, Ghost_Stagger and Ghost_Death.

| Group | Embedded player clips |
| --- | --- |
| Stance and travel | Combat_Idle, Sword_Walk, Sword_Run, Combat_Strafe_Left, Combat_Strafe_Right |
| Directional attacks | Slash_Left, Slash_Right, Slash_Diagonal_Left, Slash_Diagonal_Right, Slash_Overhead, Slash_Rising, Slash_Middle, Sword_Thrust |
| Defence and reactions | Sword_Block, Sword_Parry, Dodge_Left, Dodge_Right, Hit_React, Knockback |
| Special attacks | Spin_Slash, Jump_Slash, Heavy_Slash, Combo_Finisher |

The active clip time gates collision. Each bounded mixer step samples the actual held model's blade markers in world space. The sweep checks the target capsule, facing, distance and obstruction. A successful hit deals 10 damage once per target and swing. Two live ghosts within the 12 m player shield radius block damage. The ribbon follows the blade and a bounded particle pool emits hit flashes, sparks and ghost mist. Local mission HP starts at 100/150/200. Death disables the ghost's combat interactions and runs its death animation before hiding it.

## Changed files and responsibilities

| Files | Change |
| --- | --- |
| `src/game/combat/AttackDefinitions.ts`, `CombatController.ts`, `combatInput.ts` | Clip mapping, hit windows, input priority, combo timing, equip-aware commands |
| `src/game/combat/SwordPose.ts`, `CombatAnimationDriver.ts` | Cached rig-specific stance and grip fitting, one-mixer playback and completion |
| `src/game/combat/SwordHitDetection.ts`, `combatRuntime.ts` | Swept contacts, target and weapon ownership, damage, effect pools |
| `src/game/combat/GhostCombatReactions.ts`, `GuardMeleeController.ts` | Independent target reactions and guard melee timing |
| `src/game/glbHuman.ts`, `src/components/GlbHuman.tsx`, `BlenderCharacter.tsx`, `CartoonCharacter.tsx` | Player model integration, local combat ownership, normal movement, cleanup |
| `src/game/characterRenderer.ts`, `src/components/AppearanceSettings.tsx` | Canolia renderer selection |
| `src/components/Player.tsx`, `HeldGhostSword.tsx` | Player restrictions, dodge movement, hand attachment, equipment lifecycle, world-space effects |
| `src/components/ThreeGhostsMissionScene.tsx`, `ThreeGhostsMissionHud.tsx`, `GhostDevMap.tsx` | Pickup conditions, mission instructions, clearance display |
| `src/game/missions/threeGhostsMission.ts`, `ghostGuardCoordinator.ts` | Save migration, reward and equip selection, guard movement during reactions and protected-home checks |
| `src/components/GhostNpc.tsx`, `src/game/ghostConfig.ts` | Combat ghost model, real target registration, reaction and death clips |
| `src/components/combat/SwordCombatVFX.tsx`, `CombatControls.tsx`, `WeaponMenu.tsx` | Pooled effects, touch controls and reward menu |
| `src/main.tsx`, `src/style.css` | Main HUD Weapon selector and styling |
| `scripts/inspectCombatAssets.mjs`, `scripts/checkSwordCombat.mjs`, `tests/fixtures/swordCombat.html`, `swordCombat.tsx` | Asset audit and Chrome R3F integration fixture |
| `tests/swordCombat.test.ts`, `tests/ghostMissionRuntime.test.ts`, `package.json` | Real-rig pose and combat checks, persistence, unlock checks and test entry points |
| `tests/fixtures/completedVehicleMission.ts`, `tests/carRide.test.ts`, `tests/actorImpact.test.ts`, `tests/vehicleWaiting.test.ts` | Establish the campaign unlock before vehicle-specific regression tests |
| `tests/hudMenu.test.ts` | Check that Weapon is reachable from the main HUD tray |

## Verification scope

The asset inventory in `artifacts/sword-combat/assets.json` compares the original node, mesh, skin, image and material definitions and original binary payload against each supplied combat pack. The player test samples actual fitted tracks on all three rigs, measuring the support palm against the held weapon during the active windows. The browser fixture uses the game renderers, ghost actors, mission scene, weapon menu and combat logic with a positioned player root and controlled enemy starting positions.

The largest sampled two-hand palm-to-pommel gaps at default avatar size were 0.28 cm for Boy, 0.37 cm for Girl and 0.35 cm for Canolia. The free hand stayed at least 18.90 cm, 24.00 cm and 25.08 cm away respectively on the tested one-hand cuts. These are rig marker measurements.

Headless Chrome verified 18 attack, defence and reaction actions per player renderer, one held sword per avatar, the six buffered F attacks, actual blade contact, a miss, group shielding and death. The 1.1 m frontal hit reduced the first ghost from 100 to 90 HP. The fixture tested the last hit of each ghost after preparing its remaining HP, verified automatic stowing on completion, selected the sword through the rendered inventory control and stowed it again. See `artifacts/sword-combat/runtime.json` and the three character pose screenshots alongside it. The focused Node run passed all 46 checks in `artifacts/sword-combat/final-regression.log`.

The motion remains procedurally fitted prototype animation. Partner choreography, terrain-aware lunges and motion-captured footwork would require additional animation work. The mission remains local to the player save. This implementation does not add a network combat protocol. Physical Android frame time, a complete manual playthrough, and the appearance of every move from every camera angle remain unmeasured.
