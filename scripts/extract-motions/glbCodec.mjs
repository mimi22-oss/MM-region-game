import fs from 'node:fs';

export const GLB_MAGIC = 0x46546c67;
export const GLB_VERSION = 2;
export const CHUNK_JSON = 0x4e4f534a;
export const CHUNK_BIN = 0x004e4942;

export const COMPONENT_FLOAT = 5126;
export const COMPONENT_SHORT = 5122;

export function componentCount(type) {
  switch (type) {
    case 'SCALAR': return 1;
    case 'VEC2': return 2;
    case 'VEC3': return 3;
    case 'VEC4': return 4;
    case 'MAT4': return 16;
    default: throw new Error(`Unsupported accessor type: ${type}`);
  }
}

export function parseGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 12 || buf.readUInt32LE(0) !== GLB_MAGIC || buf.readUInt32LE(4) !== GLB_VERSION) {
    throw new Error(`Invalid GLB v2 file: ${filePath}`);
  }
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== CHUNK_JSON) {
    throw new Error(`Expected JSON chunk first in GLB: ${filePath}`);
  }
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binHeaderOff = 20 + jsonLen;
  let bin = Buffer.alloc(0);
  if (binHeaderOff + 8 <= buf.length && buf.readUInt32LE(binHeaderOff + 4) === CHUNK_BIN) {
    const binLen = buf.readUInt32LE(binHeaderOff);
    bin = buf.subarray(binHeaderOff + 8, binHeaderOff + 8 + binLen);
  }
  return { byteLength: buf.length, gltf, bin };
}

export function readAccessorFloatArray(gltf, bin, accIdx) {
  const acc = gltf.accessors[accIdx];
  const bv = gltf.bufferViews[acc.bufferView];
  const n = componentCount(acc.type);
  const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const elemSize = acc.componentType === COMPONENT_SHORT ? 2 : 4;
  const stride = bv.byteStride || n * elemSize;
  const out = new Float32Array(acc.count * n);

  if (acc.componentType === COMPONENT_FLOAT) {
    for (let i = 0; i < acc.count; i++) {
      for (let c = 0; c < n; c++) {
        out[i * n + c] = bin.readFloatLE(off + i * stride + c * 4);
      }
    }
  } else if (acc.componentType === COMPONENT_SHORT && acc.normalized) {
    for (let i = 0; i < acc.count; i++) {
      for (let c = 0; c < n; c++) {
        out[i * n + c] = Math.max(bin.readInt16LE(off + i * stride + c * 2) / 32767, -1);
      }
    }
  } else {
    throw new Error(`Unsupported accessor componentType=${acc.componentType} normalized=${Boolean(acc.normalized)}`);
  }

  return { count: acc.count, type: acc.type, numComponents: n, data: out };
}

export function buildSkeletonOnlyNodes(gltf) {
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

export function encodeGlb(gltfObj, binChunks) {
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
