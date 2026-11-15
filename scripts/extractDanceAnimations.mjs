import fs from 'node:fs';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const DANCE_MAPPING = [
  { sourceClip: 'dance_01.001', outFile: 'dance_01.glb' },
  { sourceClip: 'dance_02.001', outFile: 'dance_02.glb' },
  { sourceClip: 'dance_03.001', outFile: 'dance_03.glb' },
  { sourceClip: 'dance_04.001', outFile: 'dance_04.glb' },
  { sourceClip: 'dance_05.001', outFile: 'dance_05.glb' },
  { sourceClip: 'dance_06.001', outFile: 'dance_06.glb' },
];

function parseGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 12 || buf.readUInt32LE(0) !== GLB_MAGIC || buf.readUInt32LE(4) !== GLB_VERSION) {
    throw new Error(`Invalid GLB v2 file: ${filePath}`);
  }
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== CHUNK_JSON) throw new Error('Expected JSON chunk first in GLB');
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binHeaderOff = 20 + jsonLen;
  let bin = Buffer.alloc(0);
  if (binHeaderOff + 8 <= buf.length && buf.readUInt32LE(binHeaderOff + 4) === CHUNK_BIN) {
    const binLen = buf.readUInt32LE(binHeaderOff);
    bin = buf.subarray(binHeaderOff + 8, binHeaderOff + 8 + binLen);
  }
  return { byteLength: buf.length, gltf, bin };
}

function componentCount(type) {
  switch (type) {
    case 'SCALAR': return 1;
    case 'VEC2': return 2;
    case 'VEC3': return 3;
    case 'VEC4': return 4;
    case 'MAT4': return 16;
    default: throw new Error(`Unsupported accessor type: ${type}`);
  }
}

function readAccessorFloat32(gltf, bin, accIdx) {
  const acc = gltf.accessors[accIdx];
  if (acc.componentType !== 5126) {
    throw new Error(`Expected FLOAT accessor at index ${accIdx}, got ${acc.componentType}`);
  }
  const bv = gltf.bufferViews[acc.bufferView];
  const n = componentCount(acc.type);
  const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || n * 4;
  const out = new Float32Array(acc.count * n);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < n; c++) {
      out[i * n + c] = bin.readFloatLE(off + i * stride + c * 4);
    }
  }
  return { count: acc.count, type: acc.type, numComponents: n, data: out };
}

function isConstantTrack(data, numComponents, eps = 1e-6) {
  for (let i = numComponents; i < data.length; i += numComponents) {
    for (let c = 0; c < numComponents; c++) {
      if (Math.abs(data[i + c] - data[c]) >= eps) return false;
    }
  }
  return true;
}

function matchesNodeRestPose(node, trackPath, firstValue) {
  if (trackPath === 'rotation') {
    const rest = node.rotation || [0, 0, 0, 1];
    const dot = Math.abs(
      firstValue[0] * rest[0] +
      firstValue[1] * rest[1] +
      firstValue[2] * rest[2] +
      firstValue[3] * rest[3]
    );
    return dot >= 0.99999;
  }
  if (trackPath === 'translation') {
    const rest = node.translation || [0, 0, 0];
    return (
      Math.abs(firstValue[0] - rest[0]) < 1e-5 &&
      Math.abs(firstValue[1] - rest[1]) < 1e-5 &&
      Math.abs(firstValue[2] - rest[2]) < 1e-5
    );
  }
  if (trackPath === 'scale') {
    const rest = node.scale || [1, 1, 1];
    return (
      Math.abs(firstValue[0] - rest[0]) < 1e-5 &&
      Math.abs(firstValue[1] - rest[1]) < 1e-5 &&
      Math.abs(firstValue[2] - rest[2]) < 1e-5
    );
  }
  return false;
}

function computeScalarMinMax(data) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  return { min: [min], max: [max] };
}

function buildSkeletonOnlyNodes(gltf) {
  const srcScene = gltf.scenes[gltf.scene ?? 0];
  const keepIndices = new Set();

  function markSkeletonSubtree(nodeIdx) {
    const node = gltf.nodes[nodeIdx];
    if (!node || node.mesh !== undefined || node.camera !== undefined) return false;
    const keptChildren = [];
    for (const childIdx of node.children || []) {
      if (markSkeletonSubtree(childIdx)) keptChildren.push(childIdx);
    }
    const isBoneOrArmature = /Armature|mixamorig/.test(node.name || '') || keptChildren.length > 0;
    if (isBoneOrArmature) keepIndices.add(nodeIdx);
    return isBoneOrArmature;
  }

  for (const rootIdx of srcScene.nodes || []) {
    markSkeletonSubtree(rootIdx);
  }

  const orderedOld = [...keepIndices].sort((a, b) => a - b);
  const oldToNew = new Map(orderedOld.map((oldIdx, newIdx) => [oldIdx, newIdx]));

  const nodes = orderedOld.map((oldIdx) => {
    const src = gltf.nodes[oldIdx];
    const clean = {};
    if (src.name) clean.name = src.name;
    if (src.translation) clean.translation = [...src.translation];
    if (src.rotation) clean.rotation = [...src.rotation];
    if (src.scale) clean.scale = [...src.scale];
    if (src.matrix) clean.matrix = [...src.matrix];
    const children = (src.children || []).filter((c) => oldToNew.has(c)).map((c) => oldToNew.get(c));
    if (children.length > 0) clean.children = children;
    return clean;
  });

  const sceneNodes = (srcScene.nodes || []).filter((r) => oldToNew.has(r)).map((r) => oldToNew.get(r));
  return { nodes, sceneNodes, oldToNew };
}

function encodeGlb(gltfObj, binChunks) {
  const rawBin = Buffer.concat(binChunks);
  const binPad = (4 - (rawBin.length % 4)) % 4;
  const paddedBin = binPad > 0 ? Buffer.concat([rawBin, Buffer.alloc(binPad, 0)]) : rawBin;
  gltfObj.buffers = [{ byteLength: paddedBin.length }];

  const rawJson = Buffer.from(JSON.stringify(gltfObj), 'utf8');
  const jsonPad = (4 - (rawJson.length % 4)) % 4;
  const paddedJson = jsonPad > 0 ? Buffer.concat([rawJson, Buffer.alloc(jsonPad, 0x20)]) : rawJson;

  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;
  const out = Buffer.allocUnsafe(totalLength);
  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(GLB_VERSION, 4);
  out.writeUInt32LE(totalLength, 8);

  out.writeUInt32LE(paddedJson.length, 12);
  out.writeUInt32LE(CHUNK_JSON, 16);
  paddedJson.copy(out, 20);

  const binOffset = 20 + paddedJson.length;
  out.writeUInt32LE(paddedBin.length, binOffset);
  out.writeUInt32LE(CHUNK_BIN, binOffset + 4);
  paddedBin.copy(out, binOffset + 8);
  return out;
}

export function extractDanceClipToGlb({ srcGltf, srcBin, skeleton, sourceClipName }) {
  const srcAnim = (srcGltf.animations || []).find((a) => a.name === sourceClipName);
  if (!srcAnim) throw new Error(`Missing animation clip "${sourceClipName}"`);

  const binChunks = [];
  let binByteOffset = 0;
  const bufferViews = [];
  const accessors = [];
  const inputAccCache = new Map();

  function appendBufferView(typedArray) {
    const raw = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const pad = (4 - (raw.length % 4)) % 4;
    const chunk = pad > 0 ? Buffer.concat([raw, Buffer.alloc(pad, 0)]) : raw;
    const bvIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: binByteOffset,
      byteLength: raw.length,
    });
    binChunks.push(chunk);
    binByteOffset += chunk.length;
    return bvIdx;
  }

  function addScalarInputAccessor(srcInputIdx) {
    if (inputAccCache.has(srcInputIdx)) return inputAccCache.get(srcInputIdx);
    const { count, data } = readAccessorFloat32(srcGltf, srcBin, srcInputIdx);
    const { min, max } = computeScalarMinMax(data);
    const bvIdx = appendBufferView(data);
    const accIdx = accessors.length;
    accessors.push({
      bufferView: bvIdx,
      componentType: 5126,
      count,
      type: 'SCALAR',
      min,
      max,
    });
    inputAccCache.set(srcInputIdx, accIdx);
    return accIdx;
  }

  function addOutputAccessor(parsed, singleKeyframeOnly) {
    const data = singleKeyframeOnly ? parsed.data.subarray(0, parsed.numComponents) : parsed.data;
    const count = singleKeyframeOnly ? 1 : parsed.count;
    const bvIdx = appendBufferView(data);
    const accIdx = accessors.length;
    accessors.push({
      bufferView: bvIdx,
      componentType: 5126,
      count,
      type: parsed.type,
    });
    return accIdx;
  }

  const outSamplers = [];
  const outChannels = [];
  let droppedConstantChannels = 0;
  let maxKeyframes = 0;
  let durationSec = 0;

  for (const ch of srcAnim.channels) {
    const oldNodeIdx = ch.target?.node;
    const newNodeIdx = skeleton.oldToNew.get(oldNodeIdx);
    if (newNodeIdx === undefined) continue;

    const srcSampler = srcAnim.samplers[ch.sampler];
    const parsedOut = readAccessorFloat32(srcGltf, srcBin, srcSampler.output);
    const node = srcGltf.nodes[oldNodeIdx];
    const isConst = isConstantTrack(parsedOut.data, parsedOut.numComponents);

    if (isConst && matchesNodeRestPose(node, ch.target.path, parsedOut.data)) {
      droppedConstantChannels++;
      continue;
    }

    let inputAccIdx;
    let outputAccIdx;
    if (isConst) {
      // Held non-rest constant pose (e.g., static finger angle): collapse to 1 keyframe at t=0
      const bvTime = appendBufferView(new Float32Array([0]));
      inputAccIdx = accessors.length;
      accessors.push({
        bufferView: bvTime,
        componentType: 5126,
        count: 1,
        type: 'SCALAR',
        min: [0],
        max: [0],
      });
      outputAccIdx = addOutputAccessor(parsedOut, true);
    } else {
      inputAccIdx = addScalarInputAccessor(srcSampler.input);
      const timeAcc = accessors[inputAccIdx];
      maxKeyframes = Math.max(maxKeyframes, timeAcc.count);
      durationSec = Math.max(durationSec, timeAcc.max?.[0] || 0);
      outputAccIdx = addOutputAccessor(parsedOut, false);
    }

    const outSamplerIdx = outSamplers.length;
    outSamplers.push({
      input: inputAccIdx,
      interpolation: srcSampler.interpolation || 'LINEAR',
      output: outputAccIdx,
    });
    outChannels.push({
      sampler: outSamplerIdx,
      target: {
        node: newNodeIdx,
        path: ch.target.path,
      },
    });
  }

  const gltfOut = {
    asset: {
      version: '2.0',
      generator: 'Myanmar-Town-Prototype extractDanceAnimations.mjs',
    },
    scene: 0,
    scenes: [{ name: 'ArmatureOnly', nodes: skeleton.sceneNodes }],
    nodes: skeleton.nodes,
    bufferViews,
    accessors,
    animations: [
      {
        name: sourceClipName,
        samplers: outSamplers,
        channels: outChannels,
      },
    ],
  };

  const glbBuffer = encodeGlb(gltfOut, binChunks);
  return {
    glbBuffer,
    stats: {
      sourceClipName,
      byteLength: glbBuffer.byteLength,
      sourceChannels: srcAnim.channels.length,
      keptChannels: outChannels.length,
      droppedChannels: droppedConstantChannels,
      maxKeyframes,
      durationSec: Number(durationSec.toFixed(3)),
    },
  };
}

export function extractAllDanceAnimations({
  inputPath = path.resolve(process.cwd(), 'dance group.glb'),
  outputDir = path.resolve(process.cwd(), 'public/animations'),
} = {}) {
  const { byteLength: sourceBytes, gltf: srcGltf, bin: srcBin } = parseGlb(inputPath);
  const skeleton = buildSkeletonOnlyNodes(srcGltf);
  fs.mkdirSync(outputDir, { recursive: true });

  const results = [];
  let totalOutputBytes = 0;

  for (const item of DANCE_MAPPING) {
    const { glbBuffer, stats } = extractDanceClipToGlb({
      srcGltf,
      srcBin,
      skeleton,
      sourceClipName: item.sourceClip,
    });
    const outPath = path.join(outputDir, item.outFile);
    fs.writeFileSync(outPath, glbBuffer);
    totalOutputBytes += glbBuffer.byteLength;
    results.push({
      file: item.outFile,
      ...stats,
    });
  }

  return {
    sourcePath: inputPath,
    sourceBytes,
    outputDir,
    totalOutputBytes,
    reductionPct: Number((((sourceBytes - totalOutputBytes) / sourceBytes) * 100).toFixed(2)),
    results,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isCli) {
  const summary = extractAllDanceAnimations();
  console.log(`Source: ${summary.sourcePath} (${summary.sourceBytes.toLocaleString()} bytes)`);
  console.log(`Total Extracted (6 GLBs): ${summary.totalOutputBytes.toLocaleString()} bytes (${summary.reductionPct}% smaller)`);
  console.table(summary.results);
}
