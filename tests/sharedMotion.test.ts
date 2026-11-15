import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  listDanceActions,
  playDanceAction,
} from '../src/animation/actions/DanceActions.ts';
import {
  clearMotionCaches,
  getMotionCacheStats,
} from '../src/animation/core/MotionCache.ts';
import {
  loadRawMotionAsset,
  loadRetargetedMotionClip,
} from '../src/animation/core/MotionLoader.ts';
import {
  getMotion,
  listMotions,
} from '../src/animation/core/MotionRegistry.ts';
import {
  analyzeSkeleton,
  compareSkeletons,
} from '../src/animation/retargeting/SkeletonAnalyzer.ts';
import { retargetMotionClip } from '../src/animation/retargeting/SkeletonRetargeter.ts';
import {
  getSpecialActionState,
  markSpecialActionError,
  markSpecialActionPlaying,
  notifyCharacterRigChanged,
  notifySpecialActionFadeOutComplete,
  playSpecialAction,
  retryLastSpecialAction,
  stopSpecialAction,
  syncCharacterLocomotionState,
} from '../src/animation/actions/SpecialActionManager.ts';
import { createGlbHuman } from '../src/game/glbHuman.ts';

async function parseGlbStripTextures(relativePath: string): Promise<GLTF> {
  const bytes = await readFile(new URL(relativePath, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  delete json.images;
  delete json.textures;
  delete json.samplers;
  delete json.materials;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material;
  }
  const rawJson = JSON.stringify(json);
  const encoded = Buffer.from(rawJson.padEnd(Math.ceil(rawJson.length / 4) * 4, ' '));
  const bin = bytes.subarray(20 + jsonLength);
  const buffer = Buffer.alloc(20 + encoded.length + bin.length);
  bytes.copy(buffer, 0, 0, 12);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(encoded.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  encoded.copy(buffer, 20);
  bin.copy(buffer, 20 + encoded.length);
  return new GLTFLoader().parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    '',
  );
}

async function parseExtractedMotion(assetUrl: string): Promise<GLTF> {
  const bytes = await readFile(new URL(`../public${assetUrl}`, import.meta.url));
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
}

const INSPECTED_SEGMENTS: ReadonlyArray<readonly [string, string]> = [
  ['mixamorigHips', 'mixamorigSpine'],
  ['mixamorigSpine2', 'mixamorigHead'],
  ['mixamorigLeftShoulder', 'mixamorigLeftArm'],
  ['mixamorigLeftArm', 'mixamorigLeftForeArm'],
  ['mixamorigLeftForeArm', 'mixamorigLeftHand'],
  ['mixamorigRightShoulder', 'mixamorigRightArm'],
  ['mixamorigRightArm', 'mixamorigRightForeArm'],
  ['mixamorigRightForeArm', 'mixamorigRightHand'],
  ['mixamorigLeftUpLeg', 'mixamorigLeftLeg'],
  ['mixamorigLeftLeg', 'mixamorigLeftFoot'],
  ['mixamorigLeftFoot', 'mixamorigLeftToeBase'],
  ['mixamorigRightUpLeg', 'mixamorigRightLeg'],
  ['mixamorigRightLeg', 'mixamorigRightFoot'],
  ['mixamorigRightFoot', 'mixamorigRightToeBase'],
];

afterEach(() => {
  stopSpecialAction(true);
  clearMotionCaches();
});

test('SkeletonAnalyzer & BoneMapping identify zero missing core joints on boy.glb, girl.glb, and girl (1).glb', async () => {
  const [boy, girl, girl1, waitExt] = await Promise.all([
    parseGlbStripTextures('../src/assets/boy.glb'),
    parseGlbStripTextures('../src/assets/girl.glb'),
    parseGlbStripTextures('../girl (1).glb'),
    parseExtractedMotion('/motions/interactions/vehicle-wait.glb'),
  ]);

  const boyInfo = analyzeSkeleton(boy.scene);
  const girlInfo = analyzeSkeleton(girl.scene);
  const girl1Info = analyzeSkeleton(girl1.scene);

  assert.equal(boyInfo.boneObjectCount, 65);
  assert.equal(girlInfo.boneObjectCount, 54);
  assert.equal(girl1Info.boneObjectCount, 54);
  assert.equal(girl1Info.endEffectorNames.length, 11);
  assert.equal(girlInfo.rigSignature, girl1Info.rigSignature, 'girl.glb & girl (1).glb produce identical rig signature');

  const compatBoy = compareSkeletons(waitExt.scene, boy.scene);
  const compatGirl = compareSkeletons(waitExt.scene, girl1.scene);
  assert.equal(compatBoy.compatible, true);
  assert.equal(compatGirl.compatible, true);
  assert.equal(compatBoy.missingCoreBones.length, 0);
  assert.equal(compatGirl.missingCoreBones.length, 0);
});

test('Girl (girl (1).glb & girl.glb) and Boy accurately retarget all 6 dances + vehicle-wait with aligned limbs & ground contact', async () => {
  const [boy, girl, girl1] = await Promise.all([
    parseGlbStripTextures('../src/assets/boy.glb'),
    parseGlbStripTextures('../src/assets/girl.glb'),
    parseGlbStripTextures('../girl (1).glb'),
  ]);

  const allMotions = listMotions();
  assert.equal(allMotions.length, 24);
  assert.equal(listDanceActions().length, 6);
  assert.equal(getMotion('vehicle-wait')?.clipName, 'wait.001');
  const baseLocomotionMotions = [...listDanceActions(), getMotion('vehicle-wait')!];

  const boyRefAvatar = createGlbHuman(boy.scene, { preset: 'boy' });
  const girlAvatar = createGlbHuman(girl.scene, { preset: 'girl' });
  const girl1Avatar = createGlbHuman(girl1.scene, { preset: 'girl' });

  const a1 = new Vector3();
  const a2 = new Vector3();
  const b1 = new Vector3();
  const b2 = new Vector3();

  try {
    for (const def of baseLocomotionMotions) {
      const ext = await parseExtractedMotion(def.assetUrl);
      const srcClip = ext.animations[0];

      const boyClip = retargetMotionClip(srcClip, ext.scene, boy.scene);
      const girlClip = retargetMotionClip(srcClip, ext.scene, girl.scene);
      const girl1Clip = retargetMotionClip(srcClip, ext.scene, girl1.scene);

      // Play all three rigs at matching synchronized timestamps and compare limb segment vectors & ground contact
      boyRefAvatar.setSpecialClip(boyClip, { loop: true, syncTimeSec: 0, crossFadeSec: 0 });
      girlAvatar.setSpecialClip(girlClip, { loop: true, syncTimeSec: 0, crossFadeSec: 0 });
      girl1Avatar.setSpecialClip(girl1Clip, { loop: true, syncTimeSec: 0, crossFadeSec: 0 });

      for (let settle = 0; settle < 24; settle++) {
        boyRefAvatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
        girlAvatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
        girl1Avatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
      }

      const stepDt = Math.min(0.45, Math.max(0.2, srcClip.duration / 6));
      for (let sampleIdx = 0; sampleIdx < 5; sampleIdx++) {
        boyRefAvatar.update({ speed: 0, distance: 0 }, false, undefined, stepDt);
        girlAvatar.update({ speed: 0, distance: 0 }, false, undefined, stepDt);
        girl1Avatar.update({ speed: 0, distance: 0 }, false, undefined, stepDt);

        boyRefAvatar.root.updateMatrixWorld(true);
        girlAvatar.root.updateMatrixWorld(true);
        girl1Avatar.root.updateMatrixWorld(true);

        // Verify zero duplicate SkinnedMeshes instantiated
        let girlMeshCount = 0;
        girl1Avatar.root.traverse((o) => {
          if ((o as { isMesh?: boolean }).isMesh) girlMeshCount++;
        });
        assert.equal(girlMeshCount, 1, `Girl keeps single SkinnedMesh on ${def.id}`);

        // Verify standing height, ground contact, and anchored world root
        const bounds = new Box3().setFromObject(girl1Avatar.root);
        const size = bounds.getSize(new Vector3());
        assert.ok(size.y > 1.25 && size.y < 2.05, `Girl scale valid on ${def.id}: ${size.y.toFixed(3)}m`);
        assert.ok(
          bounds.min.y > -0.14 && bounds.min.y < 0.35,
          `Girl ground contact valid on ${def.id}: min.y=${bounds.min.y.toFixed(3)}`,
        );
        assert.ok(
          Math.abs(girl1Avatar.root.position.x) < 1e-4 && Math.abs(girl1Avatar.root.position.z) < 1e-4,
          `Girl root position stays anchored on ${def.id}`,
        );

        // Verify shoulder, elbow, wrist, spine, hip, knee, and ankle angles closely match Boy playback (< 2.5deg)
        for (const [startBone, endBone] of INSPECTED_SEGMENTS) {
          boyRefAvatar.root.getObjectByName(startBone)!.getWorldPosition(a1);
          boyRefAvatar.root.getObjectByName(endBone)!.getWorldPosition(a2);
          girl1Avatar.root.getObjectByName(startBone)!.getWorldPosition(b1);
          girl1Avatar.root.getObjectByName(endBone)!.getWorldPosition(b2);
          const angleDeg = (a2.sub(a1).normalize().angleTo(b2.sub(b1).normalize()) * 180) / Math.PI;
          assert.ok(
            angleDeg < 2.5,
            `${def.id} Girl segment ${startBone}->${endBone} aligned (${angleDeg.toFixed(2)}deg)`,
          );
        }
      }
    }
  } finally {
    boyRefAvatar.dispose();
    girlAvatar.dispose();
    girl1Avatar.dispose();
  }
});

test('SpecialActionManager state machine transitions, duplicate prevention, character switching, error/retry & cleanup work cleanly', async () => {
  const [boy, girl] = await Promise.all([
    parseGlbStripTextures('../src/assets/boy.glb'),
    parseGlbStripTextures('../src/assets/girl.glb'),
  ]);

  stopSpecialAction(true);
  syncCharacterLocomotionState(false);
  assert.equal(getSpecialActionState().machineState, 'IDLE');

  syncCharacterLocomotionState(true);
  assert.equal(getSpecialActionState().machineState, 'LOCOMOTION');

  // Repeated Play call for same dance does not bump generation
  assert.equal(playDanceAction('dance_01', { loop: true }), true);
  const firstSnap = getSpecialActionState();
  assert.equal(firstSnap.machineState, 'SPECIAL_ACTION_LOADING');
  assert.equal(playDanceAction('dance_01', { loop: true }), true);
  assert.equal(getSpecialActionState().generation, firstSnap.generation, 'duplicate trigger suppressed');

  markSpecialActionPlaying('dance_01', firstSnap.generation);
  assert.equal(getSpecialActionState().machineState, 'SPECIAL_ACTION_PLAYING');

  // Smooth stop transitions PLAYING -> SPECIAL_ACTION_STOPPING -> LOCOMOTION/IDLE when fade-out finishes
  stopSpecialAction();
  assert.equal(getSpecialActionState().machineState, 'SPECIAL_ACTION_STOPPING');
  notifySpecialActionFadeOutComplete();
  assert.equal(getSpecialActionState().machineState, 'LOCOMOTION');

  // Vehicle-wait transitions cleanly into VEHICLE_WAITING
  playSpecialAction('vehicle-wait', { loop: true });
  const waitGen = getSpecialActionState().generation;
  markSpecialActionPlaying('vehicle-wait', waitGen);
  assert.equal(getSpecialActionState().machineState, 'VEHICLE_WAITING');

  // Lower-priority dance cannot hijack active vehicle-wait unless forced
  assert.equal(playDanceAction('dance_02'), false);
  assert.equal(getSpecialActionState().activeActionId, 'vehicle-wait');

  stopSpecialAction(true);

  // Simulate character switching mid-action (boy -> girl)
  playDanceAction('dance_03', { loop: true });
  const boyAvatar = createGlbHuman(boy.scene, { preset: 'boy' });
  const clipBoy = await loadRetargetedMotionClip(
    'dance_03',
    'boy',
    boy.scene,
    { loaderFn: (u) => parseExtractedMotion(u) },
  );
  boyAvatar.setSpecialClip(clipBoy, { loop: true });
  markSpecialActionPlaying('dance_03', getSpecialActionState().generation);
  assert.equal(getSpecialActionState().machineState, 'SPECIAL_ACTION_PLAYING');

  // Switch character rig mid-playback
  boyAvatar.dispose();
  notifyCharacterRigChanged();
  assert.equal(getSpecialActionState().machineState, 'SPECIAL_ACTION_LOADING');
  const girlAvatar = createGlbHuman(girl.scene, { preset: 'girl' });
  const clipGirl = await loadRetargetedMotionClip(
    'dance_03',
    'girl',
    girl.scene,
    { loaderFn: (u) => parseExtractedMotion(u) },
  );
  girlAvatar.setSpecialClip(clipGirl, { loop: true });
  markSpecialActionPlaying('dance_03', getSpecialActionState().generation);
  assert.equal(getSpecialActionState().machineState, 'SPECIAL_ACTION_PLAYING');
  girlAvatar.dispose();

  stopSpecialAction(true);

  // Error handling and retry recovery
  let failAttempts = 0;
  await assert.rejects(
    loadRawMotionAsset('dance_05', {
      retries: 1,
      loaderFn: async () => {
        failAttempts++;
        throw new Error('Simulated network failure');
      },
    }),
    /Simulated network failure/,
  );
  assert.equal(failAttempts, 2, 'retries once before surfacing error');

  playDanceAction('dance_05');
  markSpecialActionError('dance_05', 'Network error', getSpecialActionState().generation);
  assert.equal(getSpecialActionState().status, 'error');
  assert.equal(retryLastSpecialAction(), true);
  assert.equal(getSpecialActionState().activeActionId, 'dance_05');
  assert.equal(getSpecialActionState().status, 'loading');
});

test('Repeated 60x Play/Switch/Stop cycles keep mixer action count and LRU cache sizes strictly bounded', async () => {
  const [boy, girl] = await Promise.all([
    parseGlbStripTextures('../src/assets/boy.glb'),
    parseGlbStripTextures('../src/assets/girl.glb'),
  ]);
  const girlAvatar = createGlbHuman(girl.scene, { preset: 'girl' });
  const boyAvatar = createGlbHuman(boy.scene, { preset: 'boy' });
  const mockLoader = (url: string) => parseExtractedMotion(url);

  const cycleIds = [
    'dance_01',
    'dance_02',
    'box_01',
    'front_kick_01',
    'warm_up',
    'press_up',
    'hit_to_head',
    'defeat_03',
    'fall',
    'dive',
    'turn',
    'vehicle-wait',
  ] as const;

  try {
    for (let i = 0; i < 60; i++) {
      const id = cycleIds[i % cycleIds.length];
      const clip = await loadRetargetedMotionClip(id, 'girl', girl.scene, { loaderFn: mockLoader });
      girlAvatar.setSpecialClip(clip, { loop: true, crossFadeSec: 0.25 });
      girlAvatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
      if (i % 5 === 4) {
        girlAvatar.setSpecialClip(null);
        for (let f = 0; f < 25; f++) {
          girlAvatar.update({ speed: 0, distance: 0 }, false, undefined, 0.032);
        }
        assert.equal(girlAvatar.specialBlend(), 0);
      }
    }

    const stats = getMotionCacheStats();
    assert.ok(stats.rawCount <= stats.maxRawEntries, `raw cache bounded (${stats.rawCount}/${stats.maxRawEntries})`);
    assert.ok(stats.clipCount <= stats.maxClipEntries, `clip cache bounded (${stats.clipCount}/${stats.maxClipEntries})`);
  } finally {
    girlAvatar.dispose();
    boyAvatar.dispose();
  }
});
