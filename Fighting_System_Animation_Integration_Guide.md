# Fighting System Animation Integration Guide

**Project:** Myanmar Town Prototype — React Three Fiber / Three.js / TypeScript  
**Scope:** Connect the four supplied combat-animated GLB files to the existing Ghost Mission V2 without breaking movement, mission progress, or ghost AI.

> **Status:** Integration guide, not an applied code patch. GLB JSON and animation targets were checked in the supplied pack. Full project runtime, Blender appearance, and Android performance have **not** been verified.

## 1. Actual supplied files

| File | Embedded clips | Intended use |
|---|---:|---|
| `girl-combat-animated.glb` | 23 | Girl player with combat animations |
| `boy-combat-animated.glb` | 23 | Boy player with combat animations |
| `canolia-character-combat-animated.glb` | 32 | Canolia player: 9 original + 23 combat clips |
| `ghost-woman-combat-animated.glb` | 4 | Ghost enemy combat reactions |
| `knife(1).glb` | Separate existing weapon asset | Attach to character's hand; not embedded in animation pack |

**The GLBs are animated character models, not animation-only files.** Replace the existing rendered character with the matching combat GLB, or explicitly extract and retarget clips to an existing compatible skeleton. Do not render the old player model and combat model together. These clips are procedural prototype rotations, mostly in-place, not production-quality motion capture. No weapon, damage, hitbox, sound, VFX, or gameplay logic is embedded.

### Exact player clip names (case-sensitive)

```
Combat_Idle
Sword_Walk
Sword_Run
Combat_Strafe_Left
Combat_Strafe_Right
Slash_Left
Slash_Right
Slash_Diagonal_Left
Slash_Diagonal_Right
Slash_Overhead
Slash_Rising
Slash_Middle
Sword_Thrust
Sword_Block
Sword_Parry
Dodge_Left
Dodge_Right
Hit_React
Knockback
Spin_Slash
Jump_Slash
Heavy_Slash
Combo_Finisher
```

### Exact ghost clip names

```
Ghost_Attack
Ghost_Hit
Ghost_Stagger
Ghost_Death
```

Canolia also preserves: `Bike_Drive`, `Bike_Idle`, `Bike_Mount`, `Car_Drive`, `Idle`, `Swim_Forward`, `Swim_Idle`, `Vault`, `Walk`.

## 2. Recommended file locations

Copy the files to:

```
public/models/characters/girl-combat-animated.glb
public/models/characters/boy-combat-animated.glb
public/models/characters/canolia-character-combat-animated.glb
public/models/enemies/ghost-woman-combat-animated.glb
public/models/weapons/knife.glb
```

Use `/models/...` URLs from `public`, **not** `/public/models/...`. If the existing project uses different paths, update the asset manifest instead of duplicating files.

## 3. Audit the existing character pipeline FIRST

Before editing, locate the current player model renderer, animation mixer, movement controller, selected-character state, ghost renderer (`GhostNpc.tsx`), mission scene (`ThreeGhostsMissionScene.tsx`), and combat/damage code. Check:

1. Whether the project uses `useGLTF`, `useAnimations`, a manual `AnimationMixer`, or custom bone rotations.
2. Whether the player has one mounted skeleton; avoid mounting a second combat model over it.
3. Whether existing `useFrame` logic writes bone rotations every frame; this can override attack clips.
4. Whether the character selection switches among girl/boy/Canolia and whether their rigs have different bone names.
5. Whether ghost AI movement is on a parent group; keep movement on the same parent and animation on its child rig.
6. Whether `F` is already used for attacking. Reuse existing input routing; do not add a competing global listener.
7. Whether the original ghost death animation is hard-coded; preserve game-state transitions.

## 4. Load and play an embedded animation

The following is a **minimal standalone example**, not a drop-in replacement for the current player component. In the actual project, reuse its existing mounted model and controller. A dedicated animation component can manage the mixer.

```tsx
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

type ClipName = 'Combat_Idle' | 'Slash_Left' | 'Slash_Right' | 'Slash_Overhead';

export function CombatModelDemo({ clip }: { clip: ClipName }) {
  const { scene, animations } = useGLTF('/models/characters/girl-combat-animated.glb');
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const current = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const nextMixer = new THREE.AnimationMixer(scene);
    mixer.current = nextMixer;
    return () => {
      nextMixer.stopAllAction();
      nextMixer.uncacheRoot(scene);
      if (mixer.current === nextMixer) mixer.current = null;
    };
  }, [scene]);

  useEffect(() => {
    const m = mixer.current;
    if (!m) return;
    const animation = animations.find(a => a.name === clip);
    if (!animation) {
      console.warn('Missing combat clip:', clip);
      return;
    }
    const next = m.clipAction(animation);
    const previous = current.current;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setLoop(clip === 'Combat_Idle' ? THREE.LoopRepeat : THREE.LoopOnce, 1);
    next.clampWhenFinished = clip !== 'Combat_Idle';
    next.fadeIn(0.12).play();
    if (previous && previous !== next) previous.fadeOut(0.12);
    current.current = next;
  }, [clip, animations]);

  useFrame((_, delta) => mixer.current?.update(delta));
  return <primitive object={scene} />;
}
```

**Important:** This example's `scene` object is not safe to mount in multiple places simultaneously. If multiple NPCs share one asset, clone the skinned hierarchy with `SkeletonUtils.clone()` and create one mixer per clone. Avoid calling `useGLTF()` separately for every instance unnecessarily. Do not combine this example with an existing mixer that already updates the same skeleton.

For real gameplay, listen to mixer `finished` events and return to `Combat_Idle` or locomotion; remove the listener on cleanup. Avoid changing React state every frame.

## 5. Weapon attachment: knife stays separate

Load `knife.glb` and attach its cloned scene to the character's actual right-hand bone **after** the character rig is mounted. Bone names vary; inspect the hierarchy in Blender or log the `Bone` nodes. Do **not** assume the bone is literally named `RightHand`.

```ts
import * as THREE from 'three';

export function findRightHand(root: THREE.Object3D): THREE.Bone | undefined {
  const bones: THREE.Bone[] = [];
  root.traverse(o => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });
  return bones.find(b => /right.?hand|hand.?r|mixamorigRightHand/i.test(b.name));
}

export function attachWeapon(
  character: THREE.Object3D,
  weapon: THREE.Object3D,
  gripPosition = new THREE.Vector3(),
  gripRotation = new THREE.Euler()
): () => void {
  const hand = findRightHand(character);
  if (!hand) throw new Error('Right hand bone not found: inspect skeleton names');
  hand.add(weapon);
  weapon.position.copy(gripPosition);
  weapon.rotation.copy(gripRotation);
  return () => hand.remove(weapon);
}
```

Calibrate grip translation and rotation for each rig. Attach once, not every animation frame. Keep weapon visible only when equipped. A proper equip/unequip animation may later use sockets on hand and back/hip.

## 6. Combat controller and attack queue

Use a finite-state machine, for example:

```
UNARMED → EQUIPPING → COMBAT_IDLE ↔ COMBAT_MOVE
                           ↓
                      ATTACK_WINDUP
                           ↓
                      ATTACK_ACTIVE
                           ↓
                      ATTACK_RECOVERY → COMBAT_IDLE
                           ↘ (buffered input) NEXT_COMBO

Any allowed state → HIT_REACTION / BLOCK / DODGE / DEATH
```

Suggested basic combo sequence:

```
Slash_Left → Slash_Right → Slash_Diagonal_Left → Slash_Overhead
```

Each `F` press queues **one** attack. If pressed during an allowed combo window, buffer the next input; do not restart the current clip on every keydown repeat. Use animation duration or normalized clip time for windup/active/recovery phases. Do not assume hard-coded seconds until clips are inspected.

The existing Ghost Mission V2 has a 10-damage sword rule and a rule preventing damage when two or more ghosts are nearby. **Preserve these unless gameplay design explicitly changes.** The animation name must not independently change damage.

## 7. Hit detection and damage: independent of animation playback

During `ATTACK_ACTIVE` only:

1. Obtain sword base/tip world transforms (or calibrated local sword endpoints transformed to world space).
2. Sweep between previous and current sword positions to avoid missing targets between frames.
3. Check collision against the ghost's actual hit volume; use sphere/capsule or swept segments as appropriate.
4. Register each ghost at most once per attack ID.
5. Ask the existing mission damage resolver whether damage is permitted (range, cooldown, ghost proximity rule, HP, player state).
6. If permitted, apply existing damage and play `Ghost_Hit` or `Ghost_Stagger`.
7. When HP reaches zero, transition to `Ghost_Death` once and stop ghost AI attacks/movement as existing mission code requires.

Do **not** apply damage merely because `Slash_Left` started, or because an arbitrary `setTimeout` elapsed. Use the animation's active window and actual collision. Avoid repeated damage every frame while sword overlaps a ghost.

## 8. Ghost integration

Replace or adapt the ghost visual model with `ghost-woman-combat-animated.glb` without replacing ghost AI positions or guard-coordinator logic. The model's animations are:

- `Ghost_Attack`: play when the existing ghost AI performs a valid attack.
- `Ghost_Hit`: play when a valid hit is received.
- `Ghost_Stagger`: optional stronger reaction with controlled interruption.
- `Ghost_Death`: play once at HP 0; freeze/remove only according to existing mission behavior.

**Important:** `Ghost_Hit` should not trigger on an invulnerable or blocked hit. Keep `ghostRuntimeRegistry` and the real-time developer map tracking the actual ghost world positions, not animation bone offsets. If all three ghosts use the same GLB, clone the skinned scene separately per ghost.

## 9. Fire slash, sparks, sound, camera feedback

The supplied GLBs contain **no fire/sparks VFX**. Implement these in R3F:

- **Sword trail:** sample sword tip/base world positions while an attack is active; render a short-lived ribbon/mesh, with direction following the actual swing.
- **Fire:** particle burst or emissive trail at the sword tip; reuse pooled particles and materials.
- **Impact sparks:** spawn only on confirmed contact, at hit position.
- **Audio:** sword whoosh during active swing; hit sound only on contact.
- **Camera shake:** subtle short impulse only on confirmed hits; disable/reduce in accessibility settings.

Use object pooling and mobile-friendly limits; do not spawn hundreds of React elements per frame.

## 10. Integrate with Ghost Mission V2 safely

Recommended work order:

1. Back up the project and verify all four GLBs load in a viewer.
2. Replace only the selected player's visual GLB with the matching animated GLB; preserve player controls and collision body.
3. Add one mixer and test `Combat_Idle` and `Slash_Left` manually.
4. Attach `knife.glb` to the verified hand bone and calibrate offsets.
5. Add combo sequencing with `F` input and completion transitions.
6. Integrate hit windows with the existing ghost damage function, preserving mission rules.
7. Add ghost animation reactions without replacing ghost AI movement.
8. Add fire trail, sparks, audio and optional camera feedback.
9. Verify dev map ghost markers still follow real world X/Z positions.
10. Verify dev-only map is absent from production bundle.

### Runtime acceptance tests

- Girl, boy and Canolia each render once, without doubled meshes.
- All selected character clips exist and play by exact name.
- Combat animation does not override walking/swimming/vehicle transitions unexpectedly.
- Sword remains attached to right hand throughout all moves.
- Combo input does not restart clips or inflict duplicate hits.
- Ghost damage remains consistent with mission rules.
- Ghost hit/death animation occurs only on valid state transitions.
- Three ghost world positions remain live on the dev map.
- No repeated model loading, event listener leaks, or skeleton conflicts.
- `npx tsc --noEmit` and `npm run build` pass.
- Mobile/Android frame rate is checked with effects enabled.

## 11. Coding-agent implementation prompt

Copy the following into the coding agent with the project open:

> Inspect the current Myanmar Town Prototype R3F/Three.js project before editing. Integrate the four provided combat-animated GLBs as **replacement character visuals** (not duplicate meshes). Their embedded clips are listed in this guide. Preserve the existing player movement, vehicle/swim states, Ghost Mission V2 encounter logic, guard coordinator, sword pickup requirements, 10-damage rule, ghost HP, and real-time Ghost Dev Map. Build a single authoritative combat animation controller for the active player with correct mixer lifecycle, buffered `F` combos, attack windup/active/recovery, a right-hand socket for the existing knife GLB, and collision-based once-per-attack hit detection. Play Ghost_Attack/Ghost_Hit/Ghost_Stagger/Ghost_Death on existing ghost NPC instances without disturbing AI world positions. Add pooled fire trails and impact sparks tied to sword motion. Inspect actual bone names and clip durations instead of guessing. Test all character selections, TypeScript, production build, and mobile performance. Report changed files and real test results; do not claim unrun tests passed.

## 12. Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| Animation does not play | Wrong clip name or mixer root | Print `animations.map(a => a.name)` and inspect target hierarchy |
| Character disappears / doubles | Original and new model mounted together | Use one character visual at a time |
| Sword floats or points backward | Wrong hand bone / grip offset | Inspect bone names; calibrate position/rotation |
| Ghost does not move on dev map | Tracking static spawn/guard position | Read actual moving AI/root world position |
| Animation snaps after attack | Missing fade/finished handling | Fade to locomotion and clean mixer events |
| Damage happens without contact | Damage tied to keypress | Restrict damage to active-window swept hit detection |
| Same hit applies repeatedly | No per-attack target registry | Track hit ghost IDs for current attack |
| FPS drops on mobile | Too many VFX allocations | Pool objects, reduce particle counts and draw calls |

**Bottom line:** These GLBs provide a starting point for animation playback. A working fighting system still requires integration with the existing controller, sword attachment, combat state machine, collision/damage logic, ghost reactions, and R3F VFX.
