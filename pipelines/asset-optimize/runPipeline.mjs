import fs from 'node:fs';
import path from 'node:path';
import { CONTRACT_SCHEMA_VERSIONS, validateAssetDefinitionV2 } from '../../shared/contracts/index.ts';
import { exportBlendBatch } from '../blender-export/runExport.mjs';
import { optimizeAndValidateAsset } from './optimizeGlb.mjs';

const ROOT = process.cwd();
const OUT_ROOT = path.resolve(ROOT, 'artifacts/phase2-pipeline');
const BLENDER_STAGE_DIR = path.join(OUT_ROOT, 'blender-staged');
const PUBLISHED_DIR = path.join(OUT_ROOT, 'published');
const QUARANTINE_DIR = path.join(OUT_ROOT, 'quarantine');
const MANIFEST_OUT = path.resolve(ROOT, 'content/manifests/assets.v2.json');

const BLEND_JOBS = [
  {
    id: 'blender:reference-model',
    blendPath: path.resolve(ROOT, 'artifacts/blender-character/reference_model.blend'),
    outPath: path.join(BLENDER_STAGE_DIR, 'reference-model.lod0.glb'),
    lod1OutPath: path.join(BLENDER_STAGE_DIR, 'reference-model.lod1.glb'),
    lod1Ratio: 0.35,
    stripHelpers: true,
    imageFormat: 'WEBP',
    metaOutPath: path.join(BLENDER_STAGE_DIR, 'reference-model.meta.json'),
  },
  {
    id: 'blender:reference-model-animated',
    blendPath: path.resolve(ROOT, 'artifacts/blender-character/reference_model_animated.blend'),
    outPath: path.join(BLENDER_STAGE_DIR, 'reference-model-animated.lod0.glb'),
    lod1OutPath: path.join(BLENDER_STAGE_DIR, 'reference-model-animated.lod1.glb'),
    lod1Ratio: 0.35,
    stripHelpers: true,
    imageFormat: 'WEBP',
    metaOutPath: path.join(BLENDER_STAGE_DIR, 'reference-model-animated.meta.json'),
  },
  {
    id: 'blender:rig-material-source',
    blendPath: path.resolve(ROOT, 'artifacts/blender-character/rig_material_source.blend'),
    outPath: path.join(BLENDER_STAGE_DIR, 'rig-material-source.lod0.glb'),
    stripHelpers: true,
    imageFormat: 'WEBP',
    metaOutPath: path.join(BLENDER_STAGE_DIR, 'rig-material-source.meta.json'),
  },
];

const DIRECT_GLB_JOBS = [
  {
    assetId: 'character:boy-base',
    name: 'Boy Base Rigged Character',
    nameMm: 'လူငယ် 3D ဇာတ်ကောင်',
    category: 'character',
    rendererHint: 'GlbHuman',
    sourcePath: path.resolve(ROOT, 'src/assets/boy.glb'),
    profileKey: 'character-rigged',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'src/assets/boy.glb' },
  },
  {
    assetId: 'character:girl-base',
    name: 'Girl Base Rigged Character',
    nameMm: 'မိန်းကလေး 3D ဇာတ်ကောင်',
    category: 'character',
    rendererHint: 'GlbHuman',
    sourcePath: path.resolve(ROOT, 'src/assets/girl.glb'),
    profileKey: 'character-rigged',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'src/assets/girl.glb' },
  },
  {
    assetId: 'character:ghost-woman',
    name: 'Night Ghost Character',
    nameMm: 'ညသရဲမ ဇာတ်ကောင်',
    category: 'character',
    rendererHint: 'GhostNpc',
    sourcePath: path.resolve(ROOT, 'public/models/ghost-woman.glb'),
    profileKey: 'character-rigged',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'public/models/ghost-woman.glb' },
  },
  {
    assetId: 'character:canolia-animated',
    name: 'Canolia Styled Character',
    nameMm: 'ကနိုလီယာ 3D ဇာတ်ကောင်',
    category: 'character',
    rendererHint: 'BlenderCharacter',
    sourcePath: path.resolve(ROOT, 'public/models/canolia-character.glb'),
    profileKey: 'character-highpoly',
    skeletonId: 'canolia-biped-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'public/models/canolia-character.glb' },
  },
  // Motion extractions from multi-clip raw GLBs & runtime ghost motion library (12 clips)
  {
    assetId: 'cultural:motion-dance-01',
    name: 'Dance Motion 01',
    nameMm: 'အက (၁)',
    category: 'cultural',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'dance group.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'dance_01.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'dance group.glb' },
  },
  {
    assetId: 'cultural:motion-dance-02',
    name: 'Dance Motion 02',
    nameMm: 'အက (၂)',
    category: 'cultural',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'dance group.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'dance_02.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'dance group.glb' },
  },
  {
    assetId: 'cultural:motion-dance-03',
    name: 'Dance Motion 03',
    nameMm: 'အက (၃)',
    category: 'cultural',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'dance group.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'dance_03.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'dance group.glb' },
  },
  {
    assetId: 'character:motion-vehicle-wait',
    name: 'Vehicle Waiting Pose',
    nameMm: 'ကားစောင့်ဟန်',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy wait.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'wait.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy wait.glb' },
  },
  {
    assetId: 'character:motion-box-01',
    name: 'Boxing Combo 01',
    nameMm: 'လက်ဝှေ့ (၁)',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy hit fight dive.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'box_01.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy hit fight dive.glb' },
  },
  {
    assetId: 'character:motion-front-kick-01',
    name: 'Front Kick 01',
    nameMm: 'ရှေ့ကန်ချက် (၁)',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy hit fight dive.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'front_kick_01.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy hit fight dive.glb' },
  },
  {
    assetId: 'character:motion-warm-up',
    name: 'Warm Up Exercise',
    nameMm: 'သွေးပူလေ့ကျင့်ခန်း',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy hit fight dive.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'warm_up.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy hit fight dive.glb' },
  },
  {
    assetId: 'character:motion-hit-to-head',
    name: 'Hit To Head Reaction',
    nameMm: 'ဦးခေါင်းထိမှန်ဟန်',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy hit fight dive.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'hit_to_head.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy hit fight dive.glb' },
  },
  {
    assetId: 'character:motion-defeat-02',
    name: 'Defeat Knockdown 02',
    nameMm: 'လဲကျဟန် (၂)',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy hit fight dive.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'defeat_02.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy hit fight dive.glb' },
  },
  {
    assetId: 'character:motion-fall',
    name: 'Fall Motion',
    nameMm: 'လဲကျဟန်',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy hit fight dive.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'fall.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy hit fight dive.glb' },
  },
  {
    assetId: 'character:motion-dive',
    name: 'Dive Roll Motion',
    nameMm: 'ခုန်ဝင်ဟန်',
    category: 'character',
    rendererHint: 'MotionLoader',
    sourcePath: path.resolve(ROOT, 'boy hit fight dive.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'dive.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'boy hit fight dive.glb' },
  },
  {
    assetId: 'character:motion-ghost-freaky',
    name: 'Ghost Scare Clip',
    nameMm: 'သရဲခြောက်ဟန်',
    category: 'character',
    rendererHint: 'GhostMotionLibrary',
    sourcePath: path.resolve(ROOT, 'public/motions/ghost/freaky.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'freaky.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'public/motions/ghost/freaky.glb' },
  },
  {
    assetId: 'character:motion-ghost-depressed',
    name: 'Ghost Depressed Clip',
    nameMm: 'သရဲစိတ်ဓာတ်ကျဟန်',
    category: 'character',
    rendererHint: 'GhostMotionLibrary',
    sourcePath: path.resolve(ROOT, 'public/motions/ghost/depressed.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'depressed.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'public/motions/ghost/depressed.glb' },
  },
  {
    assetId: 'character:motion-ghost-laugh',
    name: 'Ghost Laugh Clip',
    nameMm: 'သရဲရယ်သံဟန်',
    category: 'character',
    rendererHint: 'GhostMotionLibrary',
    sourcePath: path.resolve(ROOT, 'public/motions/ghost/laugh_01.glb'),
    profileKey: 'motion-clip',
    motionClipName: 'laugh_01.001',
    skeletonId: 'mixamo-humanoid-v1',
    provenance: { sourceType: 'blender-glb', sourceRef: 'public/motions/ghost/laugh_01.glb' },
  },
];

export async function runPhase2AssetPipeline({ force = false } = {}) {
  const startedAt = performance.now();

  const blendExport = await exportBlendBatch(BLEND_JOBS, {
    concurrency: 2,
    quarantineDir: QUARANTINE_DIR,
    force,
  });

  // Optimize & validate the 3 Blender-exported GLBs as well cleanly
  const blendOptimizeJobs = blendExport.results
    .filter((r) => r.status === 'ok')
    .map((r) => ({
      assetId: r.id === 'blender:reference-model'
        ? 'character:canolia-reference-static'
        : r.id === 'blender:reference-model-animated'
          ? 'character:canolia-reference-animated'
          : 'character:canolia-rig-source',
      name: r.id,
      nameMm: r.id,
      category: 'character',
      rendererHint: 'BlenderCharacter',
      sourcePath: r.outPath,
      lod1Path: r.lod1OutPath,
      profileKey: 'character-highpoly',
      skeletonId: r.meta?.lod0?.armatureCount > 0 ? 'canolia-biped-v1' : undefined,
      provenance: { sourceType: 'blender-glb', sourceRef: path.relative(ROOT, r.blendPath).replace(/\\/g, '/') },
    }));

  const allJobs = [...blendOptimizeJobs, ...DIRECT_GLB_JOBS];
  const results = [];
  for (const job of allJobs) {
    const res = await optimizeAndValidateAsset({
      assetId: job.assetId,
      sourcePath: job.sourcePath,
      profileKey: job.profileKey,
      outDir: PUBLISHED_DIR,
      quarantineDir: QUARANTINE_DIR,
      motionClipName: job.motionClipName,
      decodeIterations: 5,
    });
    results.push({ job, res });
  }

  const manifestEntries = [];
  for (const { job, res } of results) {
    if (res.status !== 'published') continue;
    const isMotion = job.profileKey === 'motion-clip';
    const lods = [
      {
        level: 0,
        url: `artifacts/phase2-pipeline/published/${res.fileName}`,
        sha256: res.sha256,
        maxTriangles: Math.max(1, res.afterTriangles || 1),
      },
    ];
    if (job.lod1Path && fs.existsSync(job.lod1Path)) {
      const lod1Buf = fs.readFileSync(job.lod1Path);
      lods.push({
        level: 1,
        url: path.relative(ROOT, job.lod1Path).replace(/\\/g, '/'),
        sha256: await import('./optimizeGlb.mjs').then((m) => m.sha256Buffer(lod1Buf)),
        maxTriangles: Math.max(1, Math.round((res.afterTriangles || 25000) * 0.45)),
      });
    }

    const defV2 = validateAssetDefinitionV2({
      schemaVersion: CONTRACT_SCHEMA_VERSIONS.assetDefinition,
      assetId: job.assetId,
      version: '2.0.0-prototype',
      contentHash: res.sha256,
      name: job.name,
      nameMm: job.nameMm,
      category: job.category,
      rendererHint: job.rendererHint,
      provenance: { ...job.provenance, license: 'project-authored' },
      bounds: isMotion ? { width: 1, depth: 1, height: 1.8 } : res.bounds,
      collision: isMotion ? { type: 'none' } : { type: 'box', width: res.bounds.width, depth: res.bounds.depth },
      footprint2d: {
        shape: 'circle',
        defaultWidth: Math.max(0.5, res.bounds.width),
        defaultDepth: Math.max(0.5, res.bounds.depth),
        color: '#6366f1',
        stroke: '#312e81',
      },
      ...(job.skeletonId ? { skeletonId: job.skeletonId } : {}),
      ...(res.clips.length > 0 ? { animationClips: res.clips } : {}),
      lods,
      budgets: {
        maxTriangles: Math.max(100, res.afterTriangles || 100),
        maxTexturePx: isMotion ? 64 : 1024,
        maxBytes: Math.max(1024, res.afterBytes),
      },
      dependencies: [],
      authority: 'publisher-manifest',
      tags: ['phase2-prototype', job.profileKey],
    });
    manifestEntries.push(defV2);
  }

  const manifestDoc = {
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.assetDefinition,
    generatedBy: 'pipelines/asset-optimize/runPipeline.mjs',
    pinnedBlenderVersion: blendExport.blenderVersion,
    assetCount: manifestEntries.length,
    assets: manifestEntries,
  };

  fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifestDoc, null, 2));

  const report = {
    blenderVersion: blendExport.blenderVersion,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    blendExports: blendExport.results,
    quarantinedCount:
      blendExport.quarantined.length + results.filter((r) => r.res.status !== 'published').length,
    publishedCount: manifestEntries.length,
    benchmarks: results.map(({ res }) => res),
  };

  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUT_ROOT, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const force = process.argv.includes('--force');
  const report = await runPhase2AssetPipeline({ force });
  console.log(JSON.stringify({
    blenderVersion: report.blenderVersion,
    publishedCount: report.publishedCount,
    quarantinedCount: report.quarantinedCount,
    durationMs: report.durationMs,
    summary: report.benchmarks.map((b) =>
      b.status === 'published'
        ? {
            id: b.assetId,
            beforeBytes: b.beforeBytes,
            afterBytes: b.afterBytes,
            savedPct: b.bytesSavedPct,
            tris: b.afterTriangles,
            beforeDecodeMs: b.beforeDecodeMs,
            afterDecodeMs: b.afterDecodeMs,
          }
        : b,
    ),
  }, null, 2));
}
