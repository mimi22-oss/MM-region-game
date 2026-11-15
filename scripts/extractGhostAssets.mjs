import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CHUNK_BIN,
  CHUNK_JSON,
  GLB_MAGIC,
  GLB_VERSION,
  buildSkeletonOnlyNodes,
  parseGlb,
} from './extract-motions/glbCodec.mjs';
import { extractOptimizedClipToGlb } from './extract-motions/optimizeKeyframes.mjs';
import {
  parseGlbStripTexturesBuffer,
  validateExtractedMotionFile,
} from './extract-motions/validateMotion.mjs';

export const GHOST_EXTRACTION_JOBS = [
  { id: 'depressed', sourceClip: 'depressed.001', outRelPath: 'ghost/depressed.glb' },
  { id: 'freaky', sourceClip: 'freaky.001', outRelPath: 'ghost/freaky.glb' },
  { id: 'flee_01', sourceClip: 'flee_01.001', outRelPath: 'ghost/flee_01.glb' },
  { id: 'dig', sourceClip: 'dig.001', outRelPath: 'ghost/dig.glb' },
  { id: 'laugh_01', sourceClip: 'laugh_01.001', outRelPath: 'ghost/laugh_01.glb' },
  { id: 'flee_02', sourceClip: 'flee_02.001', outRelPath: 'ghost/flee_02.glb' },
  { id: 'fall', sourceClip: 'fall.001', outRelPath: 'ghost/fall.glb' },
];

function pad4(n) {
  return Math.ceil(n / 4) * 4;
}

/**
 * Rebuilds `ghost women.glb` into `public/models/ghost-woman.glb` with mobile-safe 1024x1024
 * textures (cutting GPU VRAM and Android bundle bloat by >75% while preserving the exact rig & mesh).
 */
export async function optimizeGhostModelGlb({
  sourcePath = 'c:/Users/EBPMyanmar/Downloads/ghost women.glb',
  outPath = path.resolve(process.cwd(), 'public/models/ghost-woman.glb'),
  maxTexturePx = 1024,
} = {}) {
  const { gltf: srcGltf, bin: srcBin, byteLength: srcBytes } = parseGlb(sourcePath);
  const gltf = structuredClone(srcGltf);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-opt-'));

  try {
    const newBufferViews = [];
    const newBinChunks = [];
    let binOffset = 0;

    const imageBvSet = new Set((gltf.images || []).map((img) => img.bufferView));

    for (let bvIdx = 0; bvIdx < gltf.bufferViews.length; bvIdx++) {
      const bv = gltf.bufferViews[bvIdx];
      const srcOff = bv.byteOffset || 0;
      let chunk = srcBin.subarray(srcOff, srcOff + bv.byteLength);

      if (imageBvSet.has(bvIdx)) {
        const imgIdx = gltf.images.findIndex((img) => img.bufferView === bvIdx);
        const imgDef = gltf.images[imgIdx];
        const rawExt = imgDef.mimeType === 'image/png' ? 'png' : 'jpg';
        const inFile = path.join(tmpDir, `in_${imgIdx}.${rawExt}`);
        const outFile = path.join(tmpDir, `out_${imgIdx}.jpg`);
        fs.writeFileSync(inFile, chunk);

        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i',
            inFile,
            '-vf',
            `scale='min(${maxTexturePx},iw)':'min(${maxTexturePx},ih)':flags=lanczos`,
            '-q:v',
            imgIdx === 1 ? '2' : '3',
            outFile,
          ],
          { stdio: 'ignore' },
        );
        chunk = fs.readFileSync(outFile);
        imgDef.mimeType = 'image/jpeg';
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
    gltf.buffers = [{ byteLength: binOffset }];

    const jsonStr = JSON.stringify(gltf);
    const jsonBuf = Buffer.from(jsonStr.padEnd(pad4(jsonStr.length), ' '), 'utf8');
    const binBuf = Buffer.concat(newBinChunks, binOffset);
    const totalLength = 12 + 8 + jsonBuf.length + 8 + binBuf.length;

    const outBuf = Buffer.alloc(totalLength);
    outBuf.writeUInt32LE(GLB_MAGIC, 0);
    outBuf.writeUInt32LE(GLB_VERSION, 4);
    outBuf.writeUInt32LE(totalLength, 8);
    outBuf.writeUInt32LE(jsonBuf.length, 12);
    outBuf.writeUInt32LE(CHUNK_JSON, 16);
    jsonBuf.copy(outBuf, 20);
    const binHeaderOff = 20 + jsonBuf.length;
    outBuf.writeUInt32LE(binBuf.length, binHeaderOff);
    outBuf.writeUInt32LE(CHUNK_BIN, binHeaderOff + 4);
    binBuf.copy(outBuf, binHeaderOff + 8);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, outBuf);

    // Validate rewritten GLB loads cleanly via Three.js GLTFLoader (with texture strip mock in Node)
    const parsed = await parseGlbStripTexturesBuffer(outBuf);
    let meshCount = 0;
    let skinnedCount = 0;
    parsed.scene.traverse((o) => {
      if (o.isMesh) meshCount++;
      if (o.isSkinnedMesh) skinnedCount++;
    });
    if (meshCount !== 1 || skinnedCount !== 1) {
      throw new Error(`Expected 1 SkinnedMesh in ${outPath}, found mesh=${meshCount}, skinned=${skinnedCount}`);
    }

    return {
      sourceBytes: srcBytes,
      outBytes: outBuf.length,
      reductionPct: Number((((srcBytes - outBuf.length) / srcBytes) * 100).toFixed(2)),
      outPath,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function extractGhostAnimations({
  actionSourcePath = 'c:/Users/EBPMyanmar/Downloads/ghost women action.glb',
  outputRoot = path.resolve(process.cwd(), 'public/motions'),
} = {}) {
  const source = parseGlb(actionSourcePath);
  const srcGltfClean = structuredClone(source.gltf);
  for (const anim of srcGltfClean.animations || []) {
    anim.channels = anim.channels.filter((ch) => {
      if (ch.target?.path !== 'scale') return true;
      const acc = srcGltfClean.accessors[anim.samplers[ch.sampler].output];
      const bv = srcGltfClean.bufferViews[acc.bufferView];
      const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      for (let i = 0; i < acc.count * 3; i++) {
        if (Math.abs(source.bin.readFloatLE(base + i * 4) - 1) > 5e-4) return true;
      }
      return false;
    });
  }
  const skeleton = buildSkeletonOnlyNodes(srcGltfClean);
  const results = [];

  for (const job of GHOST_EXTRACTION_JOBS) {
    const outPath = path.join(outputRoot, job.outRelPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const { glbBuffer, stats } = extractOptimizedClipToGlb({
      srcGltf: srcGltfClean,
      srcBin: source.bin,
      skeleton,
      sourceClipName: job.sourceClip,
    });
    fs.writeFileSync(outPath, glbBuffer);

    const validation = await validateExtractedMotionFile({
      sourceFilePath: actionSourcePath,
      sourceClipName: job.sourceClip,
      extractedFilePath: outPath,
    });
    results.push({
      id: job.id,
      outRelPath: job.outRelPath,
      sourceBytes: source.byteLength,
      ...stats,
      maxSegmentAngleDeg: validation.maxSegmentAngleDeg,
      maxHipsDelta: validation.maxHipsDelta,
    });
  }

  return {
    sourceBytes: source.byteLength,
    results,
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

if (isCli) {
  const modelRes = await optimizeGhostModelGlb();
  console.log(
    `Ghost model optimized: ${modelRes.sourceBytes.toLocaleString()} -> ${modelRes.outBytes.toLocaleString()} bytes (${modelRes.reductionPct}% smaller) -> ${modelRes.outPath}`,
  );
  const animRes = await extractGhostAnimations();
  const totalAnimBytes = animRes.results.reduce((s, r) => s + r.byteLength, 0);
  console.log(
    `Ghost actions extracted (${animRes.results.length} GLBs): ${animRes.sourceBytes.toLocaleString()} -> ${totalAnimBytes.toLocaleString()} bytes total`,
  );
  console.table(
    animRes.results.map((r) => ({
      id: r.id,
      file: r.outRelPath,
      bytes: r.byteLength,
      kfBefore: r.sourceKeyframes,
      kfAfter: r.keptKeyframes,
      maxAngleErrDeg: r.maxSegmentAngleDeg,
      maxHipsDelta: r.maxHipsDelta,
    })),
  );
}
