import {
  COMPONENT_FLOAT,
  COMPONENT_SHORT,
  encodeGlb,
  readAccessorFloatArray,
} from './glbCodec.mjs';

export const DEFAULT_OPTIMIZATION_OPTIONS = {
  /** Drop rotation keyframes whose piecewise NLERP angular deviation is <= 0.0012 rad (~0.069 deg). */
  rotationToleranceRad: 0.0012,
  /** Drop translation keyframes whose linear deviation is <= 0.00035 units (~0.63mm at 1.8m scale). */
  translationTolerance: 0.00035,
  /** Drop constant channels whose value matches the node bind rest pose within tolerance. */
  dropRestMatchingConstantChannels: true,
  /** Drop all scale channels matching uniform [1, 1, 1]. */
  dropUnitScaleChannels: true,
  /** Encode unit quaternions using glTF 2.0 normalized INT16 (2 bytes/component instead of 4 bytes). */
  quantizeQuaternionsInt16: true,
};

function normalizeQuatInPlace(arr, offset) {
  const x = arr[offset];
  const y = arr[offset + 1];
  const z = arr[offset + 2];
  const w = arr[offset + 3];
  const len = Math.hypot(x, y, z, w) || 1;
  arr[offset] = x / len;
  arr[offset + 1] = y / len;
  arr[offset + 2] = z / len;
  arr[offset + 3] = w / len;
}

export function canonicalizeQuatTrack(data) {
  const out = new Float32Array(data.length);
  out.set(data);
  const count = out.length / 4;
  for (let i = 0; i < count; i++) {
    const off = i * 4;
    normalizeQuatInPlace(out, off);
    if (i > 0) {
      const prev = (i - 1) * 4;
      const dot =
        out[prev] * out[off] +
        out[prev + 1] * out[off + 1] +
        out[prev + 2] * out[off + 2] +
        out[prev + 3] * out[off + 3];
      if (dot < 0) {
        out[off] = -out[off];
        out[off + 1] = -out[off + 1];
        out[off + 2] = -out[off + 2];
        out[off + 3] = -out[off + 3];
      }
    }
  }
  return out;
}

export function isConstantTrack(data, numComponents, eps = 1e-6) {
  for (let i = numComponents; i < data.length; i += numComponents) {
    for (let c = 0; c < numComponents; c++) {
      if (Math.abs(data[i + c] - data[c]) >= eps) return false;
    }
  }
  return true;
}

export function matchesNodeRestPose(node, trackPath, firstValue) {
  if (trackPath === 'rotation') {
    const rest = node.rotation || [0, 0, 0, 1];
    const dot = Math.abs(
      firstValue[0] * rest[0] +
      firstValue[1] * rest[1] +
      firstValue[2] * rest[2] +
      firstValue[3] * rest[3],
    );
    return dot >= 0.99998;
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

function quatAngleRad(ax, ay, az, aw, bx, by, bz, bw) {
  const dot = Math.min(1, Math.abs(ax * bx + ay * by + az * bz + aw * bw));
  return 2 * Math.acos(dot);
}

/**
 * Ramer-Douglas-Peucker simplification matching glTF LINEAR interpolation:
 * - Vec3 uses Euclidean linear error
 * - Quat uses normalized linear interpolation (NLERP = glTF LINEAR) angular error in radians
 */
function decimateTrack(times, values, numComponents, tolerance, isQuat) {
  const count = times.length;
  if (count <= 2) {
    return { times, values, count };
  }

  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;

  const stack = [[0, count - 1]];
  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop();
    if (endIdx - startIdx <= 1) continue;

    const t0 = times[startIdx];
    const t1 = times[endIdx];
    const span = t1 - t0;
    let maxErr = -1;
    let maxIdx = -1;

    for (let i = startIdx + 1; i < endIdx; i++) {
      const alpha = span > 1e-9 ? (times[i] - t0) / span : 0;
      let err = 0;

      if (isQuat) {
        const a0 = startIdx * 4;
        const a1 = endIdx * 4;
        let ix = values[a0] + (values[a1] - values[a0]) * alpha;
        let iy = values[a0 + 1] + (values[a1 + 1] - values[a0 + 1]) * alpha;
        let iz = values[a0 + 2] + (values[a1 + 2] - values[a0 + 2]) * alpha;
        let iw = values[a0 + 3] + (values[a1 + 3] - values[a0 + 3]) * alpha;
        const len = Math.hypot(ix, iy, iz, iw) || 1;
        ix /= len;
        iy /= len;
        iz /= len;
        iw /= len;

        const cur = i * 4;
        err = quatAngleRad(ix, iy, iz, iw, values[cur], values[cur + 1], values[cur + 2], values[cur + 3]);
      } else {
        const a0 = startIdx * numComponents;
        const a1 = endIdx * numComponents;
        const cur = i * numComponents;
        let sq = 0;
        for (let c = 0; c < numComponents; c++) {
          const interp = values[a0 + c] + (values[a1 + c] - values[a0 + c]) * alpha;
          const d = values[cur + c] - interp;
          sq += d * d;
        }
        err = Math.sqrt(sq);
      }

      if (err > maxErr) {
        maxErr = err;
        maxIdx = i;
      }
    }

    if (maxErr > tolerance && maxIdx > startIdx && maxIdx < endIdx) {
      keep[maxIdx] = 1;
      stack.push([startIdx, maxIdx], [maxIdx, endIdx]);
    }
  }

  let keptCount = 0;
  for (let i = 0; i < count; i++) if (keep[i]) keptCount++;

  if (keptCount === count) {
    return { times, values, count };
  }

  const outTimes = new Float32Array(keptCount);
  const outValues = new Float32Array(keptCount * numComponents);
  let w = 0;
  for (let i = 0; i < count; i++) {
    if (!keep[i]) continue;
    outTimes[w] = times[i];
    const srcOff = i * numComponents;
    const dstOff = w * numComponents;
    for (let c = 0; c < numComponents; c++) {
      outValues[dstOff + c] = values[srcOff + c];
    }
    w++;
  }
  return { times: outTimes, values: outValues, count: keptCount };
}

function quantizeQuaternionsInt16(floatData) {
  const out = new Int16Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    const clamped = Math.max(-1, Math.min(1, floatData[i]));
    out[i] = Math.max(-32767, Math.min(32767, Math.round(clamped * 32767)));
  }
  return out;
}

function hashFloat32Array(arr) {
  // Exact hash by byte content so identical decimated timestamp arrays reuse one bufferView + accessor
  let h = 2166136261;
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  for (let i = 0; i < u8.length; i++) {
    h ^= u8[i];
    h = Math.imul(h, 16777619);
  }
  return `${arr.length}:${h >>> 0}`;
}

export function extractOptimizedClipToGlb({
  srcGltf,
  srcBin,
  skeleton,
  sourceClipName,
  options = {},
}) {
  const cfg = { ...DEFAULT_OPTIMIZATION_OPTIONS, ...options };
  const srcAnim = (srcGltf.animations || []).find((a) => a.name === sourceClipName);
  if (!srcAnim) throw new Error(`Missing animation clip "${sourceClipName}"`);

  const binChunks = [];
  let binByteOffset = 0;
  const bufferViews = [];
  const accessors = [];
  const timeAccessorCache = new Map();

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

  function addTimeAccessor(times) {
    const key = hashFloat32Array(times);
    const cached = timeAccessorCache.get(key);
    if (cached !== undefined) {
      const existingAcc = accessors[cached];
      if (existingAcc.count === times.length) return cached;
    }
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < times.length; i++) {
      if (times[i] < min) min = times[i];
      if (times[i] > max) max = times[i];
    }
    const bvIdx = appendBufferView(times);
    const accIdx = accessors.length;
    accessors.push({
      bufferView: bvIdx,
      componentType: COMPONENT_FLOAT,
      count: times.length,
      type: 'SCALAR',
      min: [min],
      max: [max],
    });
    timeAccessorCache.set(key, accIdx);
    return accIdx;
  }

  function addOutputAccessor(data, type, count) {
    if (type === 'VEC4' && cfg.quantizeQuaternionsInt16) {
      const quantized = quantizeQuaternionsInt16(data);
      const bvIdx = appendBufferView(quantized);
      const accIdx = accessors.length;
      accessors.push({
        bufferView: bvIdx,
        componentType: COMPONENT_SHORT,
        normalized: true,
        count,
        type,
      });
      return accIdx;
    }
    const bvIdx = appendBufferView(data);
    const accIdx = accessors.length;
    accessors.push({
      bufferView: bvIdx,
      componentType: COMPONENT_FLOAT,
      count,
      type,
    });
    return accIdx;
  }

  const outSamplers = [];
  const outChannels = [];
  let droppedConstantChannels = 0;
  let sourceKeyframes = 0;
  let keptKeyframes = 0;
  let maxKeyframes = 0;
  let durationSec = 0;

  for (const ch of srcAnim.channels) {
    const oldNodeIdx = ch.target?.node;
    const newNodeIdx = skeleton.oldToNew.get(oldNodeIdx);
    if (newNodeIdx === undefined) continue;

    const srcSampler = srcAnim.samplers[ch.sampler];
    const parsedIn = readAccessorFloatArray(srcGltf, srcBin, srcSampler.input);
    const parsedOut = readAccessorFloatArray(srcGltf, srcBin, srcSampler.output);
    const node = srcGltf.nodes[oldNodeIdx];
    const trackPath = ch.target.path;
    const isQuat = trackPath === 'rotation';

    sourceKeyframes += parsedIn.count;
    if (parsedIn.count > 0) {
      durationSec = Math.max(durationSec, parsedIn.data[parsedIn.count - 1]);
    }

    if (trackPath === 'scale' && cfg.dropUnitScaleChannels && isConstantTrack(parsedOut.data, 3)) {
      const [sx, sy, sz] = parsedOut.data;
      if (Math.abs(sx - 1) < 1e-5 && Math.abs(sy - 1) < 1e-5 && Math.abs(sz - 1) < 1e-5) {
        droppedConstantChannels++;
        continue;
      }
    }

    const workingValues = isQuat ? canonicalizeQuatTrack(parsedOut.data) : parsedOut.data;
    const constEps = isQuat ? 2e-5 : 1e-6;
    const isConst = isConstantTrack(workingValues, parsedOut.numComponents, constEps);

    if (isConst && cfg.dropRestMatchingConstantChannels && matchesNodeRestPose(node, trackPath, workingValues)) {
      droppedConstantChannels++;
      continue;
    }

    let finalTimes;
    let finalValues;
    let finalCount;
    if (isConst) {
      finalTimes = new Float32Array([0]);
      finalValues = workingValues.subarray(0, parsedOut.numComponents);
      finalCount = 1;
    } else {
      const tol = isQuat ? cfg.rotationToleranceRad : cfg.translationTolerance;
      const decimated = decimateTrack(parsedIn.data, workingValues, parsedOut.numComponents, tol, isQuat);
      finalTimes = decimated.times;
      finalValues = decimated.values;
      finalCount = decimated.count;
    }

    keptKeyframes += finalCount;
    maxKeyframes = Math.max(maxKeyframes, finalCount);

    const inputAccIdx = addTimeAccessor(finalTimes);
    const outputAccIdx = addOutputAccessor(finalValues, parsedOut.type, finalCount);
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
        path: trackPath,
      },
    });
  }

  const gltfOut = {
    asset: {
      version: '2.0',
      generator: 'Myanmar-Town-Prototype extract-motions',
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
      sourceKeyframes,
      keptKeyframes,
      keyframeReductionPct: sourceKeyframes > 0
        ? Number((((sourceKeyframes - keptKeyframes) / sourceKeyframes) * 100).toFixed(2))
        : 0,
      maxKeyframes,
      durationSec: Number(durationSec.toFixed(3)),
    },
  };
}
