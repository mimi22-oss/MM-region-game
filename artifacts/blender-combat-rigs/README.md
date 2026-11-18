# Ghost Mission V2 · Blender rig inspection

Blender 5.2.3 LTS imported each production GLB in a separate empty scene. Each adjacent Blender file is an editable baseline with the imported actions and packed images. The inspection covered the three characters supplied for this step.

![Imported rest skeletons](rest-skeletons.png)

## Rest pose and orientation

| Character | Deform rig bones | Existing actions | Left / right arm below horizontal | Packed images |
| --- | ---: | ---: | --- | ---: |
| Boy | 65 | 23 | 6.31° / 6.42° | 1 |
| Girl | 54 | 23 | 45.68° / 44.98° | 3 |
| Ghost Woman | 65 | 4 | 37.31° / 39.42° | 3 |

Angles measure the shoulder-to-wrist direction in the imported rest skeleton. Boy has a near T-pose. Girl has an A-pose. The ghost has a pitched torso, staggered ankles and asymmetrically bent arms. Copying local wrist rotations across these rigs would put each palm in a different place.

Blender world up is +Z. Both the toe and shoulder estimates point toward −Y for Boy and Girl, corresponding to glTF +Z. The player renderer turns the model by π to face gameplay −Z. The ghost's asymmetric rest body has a shoulder-forward estimate of (0.164, −0.986, 0) and a toe-forward estimate of (0.212, −0.977, 0) in Blender world axes. Its guard renderer aims model +Z toward the target. Those rest-pose estimates describe body orientation and should not be baked into the NPC's gameplay yaw.

## Verified bone map

The skin joint list was read from each GLB and matched to the imported armature. The inspection checked these parent relationships directly in Blender. Each named joint below has the literal prefix `mixamorig:` in the GLB and Blender. The game finds the sanitized name `mixamorigRightHand` after GLTFLoader import.

| Region | Parent-to-child chain |
| --- | --- |
| Pelvis through head | Hips → Spine → Spine1 → Spine2 (chest) → Neck → Head |
| Left arm | Spine2 → LeftShoulder → LeftArm → LeftForeArm → LeftHand |
| Right arm | Spine2 → RightShoulder → RightArm → RightForeArm → RightHand |
| Left leg | Hips → LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase |
| Right leg | Hips → RightUpLeg → RightLeg → RightFoot → RightToeBase |

Girl has three named finger segments per digit. Boy and Ghost also have fourth terminal finger joints and HeadTop_End. The hand, thumb and finger chains needed for a grip exist on all three. The full joint hierarchy, world-space rest heads and tails, and armature object matrices are recorded in [inspection.json](inspection.json).

## IK feasibility

The imported armatures had zero pose-bone and armature-object constraints. Blender supplied an icosphere for bone display. Each scene had one skinned character mesh bound to its armature. The display shape is a Blender helper.

On disposable reopened copies, each left/right hand and foot received a reachable, offset target. A two-joint Blender IK constraint used the hand or ankle head as the end effector. All 12 solves converged to within 0.01% of the original shoulder-to-hand or hip-to-ankle span. The maximum measured relative error was 0.00874% rounded upward. This is a reachability check at one target per limb. Pole continuity through a swing, wrist roll, contact with a particular hilt and foot sliding across many frames still require motion-specific validation. The saved baselines contain the imported armatures and actions, without the disposable target objects.

## Existing actions

### Boy and Girl

| Action | Seconds | Animated GLB channels |
| --- | ---: | ---: |
| Combat_Idle | 1.40 | 5 |
| Sword_Walk | 0.85 | 5 |
| Sword_Run | 0.65 | 5 |
| Combat_Strafe_Left | 0.85 | 3 |
| Combat_Strafe_Right | 0.85 | 3 |
| Slash_Left | 0.62 | 4 |
| Slash_Right | 0.62 | 4 |
| Slash_Diagonal_Left | 0.72 | 3 |
| Slash_Diagonal_Right | 0.72 | 3 |
| Slash_Overhead | 0.88 | 4 |
| Slash_Rising | 0.75 | 3 |
| Slash_Middle | 0.60 | 3 |
| Sword_Thrust | 0.65 | 3 |
| Sword_Block | 0.85 | 3 |
| Sword_Parry | 0.68 | 3 |
| Dodge_Left | 0.60 | 3 |
| Dodge_Right | 0.60 | 3 |
| Hit_React | 0.62 | 3 |
| Knockback | 0.82 | 4 |
| Spin_Slash | 1.10 | 2 |
| Jump_Slash | 0.95 | 4 |
| Heavy_Slash | 1.10 | 3 |
| Combo_Finisher | 1.30 | 3 |

### Ghost Woman

| Action | Seconds | Animated GLB channels |
| --- | ---: | ---: |
| Ghost_Attack | 0.80 | 3 |
| Ghost_Hit | 0.65 | 3 |
| Ghost_Stagger | 1.05 | 4 |
| Ghost_Death | 1.55 | 4 |

## Implications for Blender authoring and game playback

The existing Heavy_Slash keys the chest, right upper arm and right forearm six times each over 1.10 s. It supplies neither a left-hand contact track nor lower-body weight transfer. The Ghost_Attack action has three animated channels over 0.80 s. These actions establish timing references for the game's existing attack windows.

For the first full-body take, use a shared hilt target for the two hands during the heavy strike, independent elbow poles, and planted foot targets while the pelvis loads and unwinds. Set each rig's grip offsets from its own rest pose. Bake evaluated deform-bone transforms at export. A Blender IK control rig can stay in the authoring scene.

The game currently fits player combat clips in `src/game/combat/SwordPose.ts` before binding them to the mixer. This replaces selected bone tracks and the pelvis translation. In `src/game/glbHuman.ts`, combat playback also reapplies procedural finger curls after each mixer update. A future authored-clip integration must explicitly give those full-body tracks and finger poses ownership during playback. The existing `src/game/glbEyeBlink.ts` relies on the imported head, skinned mesh and material. Preserve those assets and the head binding when exporting. Ghost melee contact also uses the normalized Ghost_Attack timing, so its contact pose must agree with the game marker.

## Verification

Blender reopened all three saved projects. Checks compared bone names and parent links, action names, skinned mesh vertex and face counts, material names, and presence of packed images. SHA-256 hashes computed before import and after testing matched for each source GLB. Source files, per-action Blender frame ranges at 24 fps, and per-probe measurements are in the JSON report. This inspection creates authoring baselines. New action authoring, a GLB export of those actions and in-game playback validation are subsequent work.
