import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Box3, Vector3 } from 'three';
import {
  buildSkeletonOnlyNodes,
  encodeGlb,
  parseGlb,
} from '../../scripts/extract-motions/glbCodec.mjs';
import { extractOptimizedClipToGlb } from '../../scripts/extract-motions/optimizeKeyframes.mjs';
import {
  parseGlbStripTexturesBuffer,
  validateExtractedMotionFile,
} from '../../scripts/extract-motions/validateMotion.mjs';
import { analyzeSkeleton } from '../../src/animation/retargeting/SkeletonAnalyzer.ts';

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

export const ASSET_OPTIMIZE_PROFILES = {
  'character-rigged': {
    maxTexturePx: 1024,
    webpQuality: 82,
    alphaQuality: 90,
    maxTriangles: 45_000,
    maxBytes: 3_500_000,
    stripExtensions: ['FB_ngon_encoding'],
  },
  'character-highpoly': {
    maxTexturePx: 1024,
    webpQuality: 82,
    alphaQuality: 90,
    maxTriangles: 70_000,
    maxBytes: 2_600_000,
    stripExtensions: ['FB_ngon_encoding'],
  },
  'motion-clip': {
    maxTexturePx: 0,
    webpQuality: 0,
    alphaQuality: 0,
    maxTriangles: 0,
    maxBytes: 320_000,
    stripExtensions: ['FB_ngon_encoding'],
  },
};

export function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function pad4(n) {
  return Math.ceil(n / 4) * 4;
}

function countGltfTriangles(gltf) {
  let tris = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const idxAcc = prim.indices !== undefined ? gltf.accessors?.[prim.indices] : undefined;
      const posAcc =
        prim.attributes?.POSITION !== undefined ? gltf.accessors?.[prim.attributes.POSITION] : undefined;
      const count = idxAcc?.count ?? posAcc?.count ?? 0;
      tris += Math.round(count / 3);
    }
  }
  return tris;
}

function probeImageStream(filePath) {
  const stdout = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', filePath],
    { encoding: 'utf8', windowsHide: true },
  );
  const stream = JSON.parse(stdout).streams?.[0];
  return {
    width: Number(stream?.width ?? 0),
    height: Number(stream?.height ?? 0),
    pixFmt: String(stream?.pix_fmt ?? ''),
  };
}

function hasAlphaChannel(pixFmt) {
  return /(rgba|bgra|argb|abgr|yuva|pal8|gray\da)/i.test(pixFmt);
}

/**
 * Re-encodes embedded GLB images to category-bounded WebP (preserving alpha if present),
 * strips authoring-only extensions (e.g. `FB_ngon_encoding`) and unused extras, and repacks aligned GLB v2.
 */
export function optimizeCharacterGlbBuffer(srcBuffer, profile) {
  const jsonLen = srcBuffer.readUInt32LE(12);
  const srcGltf = JSON.parse(srcBuffer.subarray(20, 20 + jsonLen).toString('utf8'));
  const binHeaderOff = 20 + jsonLen;
  const binLen = binHeaderOff + 8 <= srcBuffer.length ? srcBuffer.readUInt32LE(binHeaderOff) : 0;
  const srcBin = binLen > 0 ? srcBuffer.subarray(binHeaderOff + 8, binHeaderOff + 8 + binLen) : Buffer.alloc(0);

  const gltf = structuredClone(srcGltf);
  delete gltf.asset?.extras;
  if (Array.isArray(gltf.extensionsUsed)) {
    gltf.extensionsUsed = gltf.extensionsUsed.filter((ext) => !profile.stripExtensions.includes(ext));
    if (gltf.extensionsUsed.length === 0) delete gltf.extensionsUsed;
  }
  if (Array.isArray(gltf.extensionsRequired)) {
    gltf.extensionsRequired = gltf.extensionsRequired.filter((ext) => !profile.stripExtensions.includes(ext));
    if (gltf.extensionsRequired.length === 0) delete gltf.extensionsRequired;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-opt-'));
  const imageReport = [];

  try {
    const newBufferViews = [];
    const newBinChunks = [];
    let binOffset = 0;
    const imageBvMap = new Map();
    for (let i = 0; i < (gltf.images ?? []).length; i++) {
      if (gltf.images[i].bufferView !== undefined) {
        imageBvMap.set(gltf.images[i].bufferView, i);
      }
    }

    for (let bvIdx = 0; bvIdx < (gltf.bufferViews ?? []).length; bvIdx++) {
      const bv = gltf.bufferViews[bvIdx];
      const srcOff = bv.byteOffset ?? 0;
      let chunk = srcBin.subarray(srcOff, srcOff + bv.byteLength);

      if (imageBvMap.has(bvIdx)) {
        const imgIdx = imageBvMap.get(bvIdx);
        const imgDef = gltf.images[imgIdx];
        const ext = imgDef.mimeType === 'image/png' ? 'png' : imgDef.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const inFile = path.join(tmpDir, `in_${imgIdx}.${ext}`);
        const outFile = path.join(tmpDir, `out_${imgIdx}.webp`);
        fs.writeFileSync(inFile, chunk);

        const info = probeImageStream(inFile);
        const maxPx = profile.maxTexturePx;
        const alpha = hasAlphaChannel(info.pixFmt);
        const scaleExpr = `scale='min(${maxPx},iw)':'min(${maxPx},ih)':flags=lanczos`;

        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i',
            inFile,
            '-vf',
            scaleExpr,
            '-c:v',
            'libwebp',
            '-quality',
            String(profile.webpQuality),
            ...(alpha ? ['-alpha_quality', String(profile.alphaQuality)] : []),
            outFile,
          ],
          { stdio: 'ignore', windowsHide: true },
        );

        const webpBuf = fs.readFileSync(outFile);
        const outInfo = probeImageStream(outFile);
        imageReport.push({
          index: imgIdx,
          beforeMime: imgDef.mimeType,
          beforeBytes: chunk.length,
          beforePx: `${info.width}x${info.height}`,
          afterMime: 'image/webp',
          afterBytes: webpBuf.length,
          afterPx: `${outInfo.width}x${outInfo.height}`,
        });
        chunk = webpBuf;
        imgDef.mimeType = 'image/webp';
      }

      const paddedLen = pad4(chunk.length);
      const paddedChunk = Buffer.alloc(paddedLen);
      chunk.copy(paddedChunk, 0);

      newBufferViews.push({
        ...bv,
        buffer: 0,
        byteOffset: binOffset,
        byteLength: chunk.length,
      });
      newBinChunks.push(paddedChunk);
      binOffset += paddedLen;
    }

    gltf.bufferViews = newBufferViews;
    return {
      outBuffer: encodeGlb(gltf, newBinChunks),
      imageReport,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function benchmarkNodeDecodeMs(glbBuffer, iterations = 5) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await parseGlbStripTexturesBuffer(glbBuffer);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return Number(times[Math.floor(times.length / 2)].toFixed(3));
}

function checkFiniteGeometry(root) {
  let vertices = 0;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
    const pos = obj.geometry.attributes.position.array;
    vertices += pos.length / 3;
    for (let i = 0; i < pos.length; i++) {
      if (!Number.isFinite(pos[i])) {
        throw new Error(`Non-finite vertex coordinate at mesh "${obj.name}"`);
      }
    }
  });
  return vertices;
}

/**
 * Optimizes and strictly validates a single character/prop/motion GLB candidate.
 * Throws descriptive errors on validation failures so callers quarantine broken outputs.
 */
export async function optimizeAndValidateAsset({
  assetId,
  sourcePath,
  profileKey,
  outDir,
  quarantineDir,
  motionClipName,
  decodeIterations = 5,
}) {
  const profile = ASSET_OPTIMIZE_PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown optimization profile: ${profileKey}`);

  const srcBuffer = fs.readFileSync(sourcePath);
  const srcParsedMeta = parseGlb(sourcePath);
  const beforeTriangles = countGltfTriangles(srcParsedMeta.gltf);
  const beforeImages = (srcParsedMeta.gltf.images ?? []).length;

  try {
    let outBuffer;
    let imageReport = [];

    if (profileKey === 'motion-clip') {
      const skeleton = buildSkeletonOnlyNodes(srcParsedMeta.gltf);
      const clipName = motionClipName ?? srcParsedMeta.gltf.animations?.[0]?.name;
      if (!clipName) throw new Error(`No animation clip found in motion GLB ${sourcePath}`);
      const { glbBuffer } = extractOptimizedClipToGlb({
        srcGltf: srcParsedMeta.gltf,
        srcBin: srcParsedMeta.bin,
        skeleton,
        sourceClipName: clipName,
      });
      outBuffer = glbBuffer;
    } else {
      const opt = optimizeCharacterGlbBuffer(srcBuffer, profile);
      outBuffer = opt.outBuffer;
      imageReport = opt.imageReport;
    }

    const afterHash = sha256Buffer(outBuffer);
    const outGltfMeta = JSON.parse(outBuffer.subarray(20, 20 + outBuffer.readUInt32LE(12)).toString('utf8'));
    const afterTriangles = countGltfTriangles(outGltfMeta);
    const afterImages = (outGltfMeta.images ?? []).length;

    if (afterTriangles > profile.maxTriangles) {
      throw new Error(
        `Triangle budget exceeded for "${assetId}": ${afterTriangles} > ${profile.maxTriangles}`,
      );
    }
    if (outBuffer.length > profile.maxBytes) {
      throw new Error(
        `Byte budget exceeded for "${assetId}": ${outBuffer.length} > ${profile.maxBytes}`,
      );
    }
    for (const img of imageReport) {
      const [w, h] = img.afterPx.split('x').map(Number);
      if (w > profile.maxTexturePx || h > profile.maxTexturePx) {
        throw new Error(`Texture dimension ${img.afterPx} exceeds ${profile.maxTexturePx}px`);
      }
    }

    const beforeScene = await parseGlbStripTexturesBuffer(srcBuffer);
    const afterScene = await parseGlbStripTexturesBuffer(outBuffer);

    const beforeVertices = checkFiniteGeometry(beforeScene.scene);
    const afterVertices = checkFiniteGeometry(afterScene.scene);
    if (profileKey !== 'motion-clip' && (afterVertices === 0 || beforeVertices === 0)) {
      throw new Error(`Zero geometry vertices in "${assetId}"`);
    }

    const beforeSkel = analyzeSkeleton(beforeScene.scene);
    const afterSkel = analyzeSkeleton(afterScene.scene);
    if (profileKey === 'motion-clip') {
      const beforeNames = new Set(beforeSkel.boneNames);
      const missingBones = afterSkel.boneNames.filter((name) => !beforeNames.has(name));
      if (afterSkel.jointCount < 15 || beforeSkel.jointCount !== afterSkel.jointCount || missingBones.length > 0) {
        throw new Error(
          `Skeleton hierarchy mismatch on motion clip "${assetId}": before=${beforeSkel.jointCount}, after=${afterSkel.jointCount}`,
        );
      }
    } else if (beforeSkel.rigSignature !== afterSkel.rigSignature) {
      throw new Error(
        `Rig signature changed for "${assetId}" (${beforeSkel.rigSignature} !== ${afterSkel.rigSignature})`,
      );
    }

    const beforeBox = new Box3().setFromObject(beforeScene.scene).getSize(new Vector3());
    const afterBox = new Box3().setFromObject(afterScene.scene).getSize(new Vector3());
    const boundsDelta = Math.max(
      Math.abs(beforeBox.x - afterBox.x),
      Math.abs(beforeBox.y - afterBox.y),
      Math.abs(beforeBox.z - afterBox.z),
    );
    if (profileKey !== 'motion-clip' && boundsDelta > 0.02) {
      throw new Error(`Bounds drifted by ${boundsDelta.toFixed(4)}m in "${assetId}"`);
    }

    let maxClipDurationDeltaMs = 0;
    if (profileKey === 'motion-clip') {
      const clipName = motionClipName ?? srcParsedMeta.gltf.animations[0].name;
      const beforeClip = beforeScene.animations.find((a) => a.name === clipName);
      const afterClip = afterScene.animations[0];
      if (!beforeClip || !afterClip) {
        throw new Error(`Missing extracted motion clip "${clipName}" in "${assetId}"`);
      }
      maxClipDurationDeltaMs = Math.abs(beforeClip.duration - afterClip.duration) * 1000;
    } else {
      if (beforeScene.animations.length !== afterScene.animations.length) {
        throw new Error(
          `Animation clip count mismatch: ${beforeScene.animations.length} !== ${afterScene.animations.length}`,
        );
      }
      for (let i = 0; i < beforeScene.animations.length; i++) {
        const deltaMs = Math.abs(beforeScene.animations[i].duration - afterScene.animations[i].duration) * 1000;
        if (deltaMs > maxClipDurationDeltaMs) maxClipDurationDeltaMs = deltaMs;
      }
    }
    if (maxClipDurationDeltaMs > 2) {
      throw new Error(`Animation duration drifted ${maxClipDurationDeltaMs.toFixed(2)}ms (> 2ms)`);
    }

    const slug = assetId.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${slug}.${afterHash.slice(0, 16)}.glb`;
    const publishedPath = path.join(outDir, fileName);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(publishedPath, outBuffer);

    let motionAccuracy = null;
    if (profileKey === 'motion-clip') {
      const clipName = motionClipName ?? srcParsedMeta.gltf.animations[0].name;
      motionAccuracy = await validateExtractedMotionFile({
        sourceFilePath: sourcePath,
        sourceClipName: clipName,
        extractedFilePath: publishedPath,
      });
    }

    const beforeDecodeMs = await benchmarkNodeDecodeMs(srcBuffer, decodeIterations);
    const afterDecodeMs = await benchmarkNodeDecodeMs(outBuffer, decodeIterations);

    return {
      status: 'published',
      assetId,
      profileKey,
      sourcePath,
      publishedPath,
      fileName,
      sha256: afterHash,
      beforeBytes: srcBuffer.length,
      afterBytes: outBuffer.length,
      bytesSavedPct: Number((((srcBuffer.length - outBuffer.length) / srcBuffer.length) * 100).toFixed(2)),
      beforeTriangles,
      afterTriangles,
      beforeImages,
      afterImages,
      imageReport,
      beforeDecodeMs,
      afterDecodeMs,
      bounds: {
        width: Number(Math.max(0.05, afterBox.x).toFixed(4)),
        depth: Number(Math.max(0.05, afterBox.z).toFixed(4)),
        height: Number(Math.max(0.05, afterBox.y).toFixed(4)),
      },
      skeleton: {
        jointCount: afterSkel.jointCount,
        boneObjectCount: afterSkel.boneObjectCount,
        rigSignature: afterSkel.rigSignature,
      },
      clips: afterScene.animations.map((a) => a.name),
      validation: {
        rigSignatureMatch: true,
        maxClipDurationDeltaMs: Number(maxClipDurationDeltaMs.toFixed(4)),
        boundsDeltaM: Number(boundsDelta.toFixed(6)),
        motionAccuracy,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const slug = assetId.replace(/[^a-zA-Z0-9._-]/g, '_');
    const qDir = path.join(quarantineDir, slug);
    fs.mkdirSync(qDir, { recursive: true });
    fs.writeFileSync(
      path.join(qDir, 'failure.json'),
      JSON.stringify({ assetId, sourcePath, profileKey, reason, timestamp: new Date().toISOString() }, null, 2),
    );
    return { status: 'quarantined', assetId, sourcePath, reason };
  }
}
