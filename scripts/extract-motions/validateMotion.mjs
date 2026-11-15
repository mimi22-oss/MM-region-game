import fs from 'node:fs';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

const VALIDATION_SEGMENTS = [
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
  ['mixamorigRightUpLeg', 'mixamorigRightLeg'],
  ['mixamorigRightLeg', 'mixamorigRightFoot'],
];

export async function parseGlbStripTexturesBuffer(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  delete json.materials;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) delete prim.material;
  }
  const rawJson = JSON.stringify(json);
  const encoded = Buffer.from(rawJson.padEnd(Math.ceil(rawJson.length / 4) * 4, ' '), 'utf8');
  const bin = bytes.subarray(20 + jsonLength);
  const rebuilt = Buffer.alloc(20 + encoded.length + bin.length);
  bytes.copy(rebuilt, 0, 0, 12);
  rebuilt.writeUInt32LE(rebuilt.length, 8);
  rebuilt.writeUInt32LE(encoded.length, 12);
  rebuilt.writeUInt32LE(0x4e4f534a, 16);
  encoded.copy(rebuilt, 20);
  bin.copy(rebuilt, 20 + encoded.length);
  return await new GLTFLoader().parseAsync(
    rebuilt.buffer.slice(rebuilt.byteOffset, rebuilt.byteOffset + rebuilt.byteLength),
    '',
  );
}

export async function validateExtractedMotionFile({
  sourceFilePath,
  sourceClipName,
  extractedFilePath,
  sampleCount = 40,
}) {
  const extBytes = fs.readFileSync(extractedFilePath);
  const jsonLen = extBytes.readUInt32LE(12);
  const extJson = JSON.parse(extBytes.subarray(20, 20 + jsonLen).toString('utf8'));

  if (extJson.meshes || extJson.images || extJson.textures || extJson.materials || extJson.skins) {
    throw new Error(`Extracted GLB ${extractedFilePath} retained mesh/material/texture/skin data`);
  }

  const extGltf = await new GLTFLoader().parseAsync(
    extBytes.buffer.slice(extBytes.byteOffset, extBytes.byteOffset + extBytes.byteLength),
    '',
  );

  let meshCount = 0;
  extGltf.scene.traverse((o) => {
    if (o.isMesh) meshCount++;
  });
  if (meshCount > 0) {
    throw new Error(`Extracted scene ${extractedFilePath} instantiated ${meshCount} Mesh objects`);
  }
  if (extGltf.animations.length !== 1) {
    throw new Error(`Expected 1 animation in ${extractedFilePath}, found ${extGltf.animations.length}`);
  }

  const extClip = extGltf.animations[0];
  if (extClip.name !== sourceClipName) {
    throw new Error(`Expected clip name ${sourceClipName}, got ${extClip.name}`);
  }
  if (extClip.tracks.some((t) => t.name.endsWith('.scale'))) {
    throw new Error(`Scale tracks should be stripped in ${extractedFilePath}`);
  }

  const srcBytes = fs.readFileSync(sourceFilePath);
  const srcGltf = await parseGlbStripTexturesBuffer(srcBytes);
  const srcClip = srcGltf.animations.find((a) => a.name === sourceClipName);
  if (!srcClip) {
    throw new Error(`Source clip ${sourceClipName} missing in ${sourceFilePath}`);
  }
  if (Math.abs(extClip.duration - srcClip.duration) > 1e-3) {
    throw new Error(`Duration mismatch: ${extClip.duration} vs ${srcClip.duration}`);
  }

  const srcMixer = new AnimationMixer(srcGltf.scene);
  const extMixer = new AnimationMixer(extGltf.scene);
  srcMixer.clipAction(srcClip).play();
  extMixer.clipAction(extClip).play();

  const a1 = new Vector3();
  const a2 = new Vector3();
  const b1 = new Vector3();
  const b2 = new Vector3();
  let maxSegmentAngleDeg = 0;
  let maxHipsDelta = 0;

  try {
    for (let i = 0; i <= sampleCount; i++) {
      const t = Math.min(srcClip.duration, (srcClip.duration * i) / sampleCount);
      srcMixer.setTime(t);
      extMixer.setTime(t);
      srcGltf.scene.updateMatrixWorld(true);
      extGltf.scene.updateMatrixWorld(true);

      const srcHips = srcGltf.scene.getObjectByName('mixamorigHips');
      const extHips = extGltf.scene.getObjectByName('mixamorigHips');
      if (srcHips && extHips) {
        srcHips.getWorldPosition(a1);
        extHips.getWorldPosition(b1);
        maxHipsDelta = Math.max(maxHipsDelta, a1.distanceTo(b1));
      }

      for (const [startName, endName] of VALIDATION_SEGMENTS) {
        const sA = srcGltf.scene.getObjectByName(startName);
        const sB = srcGltf.scene.getObjectByName(endName);
        const eA = extGltf.scene.getObjectByName(startName);
        const eB = extGltf.scene.getObjectByName(endName);
        if (!sA || !sB || !eA || !eB) continue;
        sA.getWorldPosition(a1);
        sB.getWorldPosition(a2);
        eA.getWorldPosition(b1);
        eB.getWorldPosition(b2);
        const deg = (a2.sub(a1).normalize().angleTo(b2.sub(b1).normalize()) * 180) / Math.PI;
        if (deg > maxSegmentAngleDeg) maxSegmentAngleDeg = deg;
      }
    }
  } finally {
    srcMixer.stopAllAction();
    srcMixer.uncacheRoot(srcGltf.scene);
    extMixer.stopAllAction();
    extMixer.uncacheRoot(extGltf.scene);
  }

  return {
    sourceClipName,
    durationSec: Number(extClip.duration.toFixed(3)),
    maxSegmentAngleDeg: Number(maxSegmentAngleDeg.toFixed(3)),
    maxHipsDelta: Number(maxHipsDelta.toFixed(5)),
  };
}
