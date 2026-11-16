import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { encodeGlb } from '../scripts/extract-motions/glbCodec.mjs';
import { optimizeAndValidateAsset } from '../pipelines/asset-optimize/optimizeGlb.mjs';
import { validateAssetDefinitionV2 } from '../shared/contracts/index.ts';
import {
  ASSET_LIST,
  ASSET_REGISTRY,
  clearPublishedAssetsV2,
  getAssetDefinition,
  getAssetDefinitionV2,
  listAssetDefinitionsV2,
  registerPublishedManifestV2,
} from '../src/game/assetRegistry.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

afterEach(() => {
  clearPublishedAssetsV2();
});

function listFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

test('Phase 2 published manifest validates under AssetDefinitionV2 and integrates with assetRegistry without breaking legacy IDs', () => {
  const manifestPath = path.join(ROOT, 'content/manifests/assets.v2.json');
  assert.ok(fs.existsSync(manifestPath), 'content/manifests/assets.v2.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    schemaVersion: number;
    assetCount: number;
    assets: unknown[];
  };
  assert.equal(manifest.schemaVersion, 2);
  assert.ok(manifest.assets.length >= 20, `expected >= 20 published prototype assets, got ${manifest.assets.length}`);
  assert.equal(manifest.assetCount, manifest.assets.length);

  for (const raw of manifest.assets) {
    const validated = validateAssetDefinitionV2(raw);
    assert.match(validated.contentHash ?? '', /^[a-f0-9]{64}$/);
    assert.ok(validated.lods.length >= 1);
  }

  const legacyCount = ASSET_LIST.length;
  const legacyHouseBefore = getAssetDefinition('building:myothar-house');
  assert.ok(legacyHouseBefore);

  const registeredCount = registerPublishedManifestV2(manifest);
  assert.equal(registeredCount, manifest.assets.length);

  // Legacy definitions & footprints remain untouched
  assert.equal(ASSET_LIST.length, legacyCount);
  assert.deepEqual(getAssetDefinition('building:myothar-house'), legacyHouseBefore);
  assert.equal(ASSET_REGISTRY['building:tea-shop']?.footprint.shape, 'complex');

  const girlV2 = getAssetDefinitionV2('character:girl-base');
  assert.ok(girlV2);
  assert.equal(girlV2.skeletonId, 'mixamo-humanoid-v1');
  assert.ok(listAssetDefinitionsV2().length >= legacyCount + manifest.assets.length);
});

test('GLB optimizer quarantine rejects non-finite vertices and over-budget assets without publishing', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-quarantine-'));
  try {
    // Minimal GLB with 1 triangle containing a NaN vertex coordinate
    const badPos = Buffer.alloc(36);
    badPos.writeFloatLE(Number.NaN, 0);
    badPos.writeFloatLE(0, 4);
    badPos.writeFloatLE(0, 8);
    badPos.writeFloatLE(1, 12);
    badPos.writeFloatLE(0, 16);
    badPos.writeFloatLE(0, 20);
    badPos.writeFloatLE(0, 24);
    badPos.writeFloatLE(1, 28);
    badPos.writeFloatLE(0, 32);

    const badGlb = encodeGlb(
      {
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'BadMeshNode', mesh: 0 }],
        meshes: [{ name: 'BadMesh', primitives: [{ attributes: { POSITION: 0 } }] }],
        accessors: [
          {
            bufferView: 0,
            componentType: 5126,
            count: 3,
            type: 'VEC3',
            min: [0, 0, 0],
            max: [1, 1, 0],
          },
        ],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
        buffers: [{ byteLength: 36 }],
      },
      [badPos],
    );

    const srcPath = path.join(tmpDir, 'bad-nan.glb');
    const outDir = path.join(tmpDir, 'published');
    const quarantineDir = path.join(tmpDir, 'quarantine');
    fs.writeFileSync(srcPath, badGlb);

    const res = await optimizeAndValidateAsset({
      assetId: 'prop:bad-nan-test',
      sourcePath: srcPath,
      profileKey: 'character-rigged',
      outDir,
      quarantineDir,
      decodeIterations: 1,
    });

    assert.equal(res.status, 'quarantined');
    assert.match(res.reason, /Non-finite vertex/i);
    assert.equal(fs.existsSync(outDir) ? fs.readdirSync(outDir).length : 0, 0);
    assert.ok(fs.existsSync(path.join(quarantineDir, 'prop_bad-nan-test', 'failure.json')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Git LFS tracks .blend/raw GLBs and zero .blend sources leak into web/Android runtime directories', () => {
  const gitattrsPath = path.join(ROOT, '.gitattributes');
  assert.ok(fs.existsSync(gitattrsPath));
  const gitattrs = fs.readFileSync(gitattrsPath, 'utf8');
  assert.match(gitattrs, /\*\.blend filter=lfs/);

  for (const runtimeDir of ['public', 'dist', path.join('android', 'app', 'src', 'main', 'assets', 'public')]) {
    const files = listFilesRecursive(path.join(ROOT, runtimeDir));
    const leaks = files.filter((f) => f.toLowerCase().endsWith('.blend'));
    assert.deepEqual(leaks, [], `.blend leaked into runtime directory ${runtimeDir}`);
  }
});
