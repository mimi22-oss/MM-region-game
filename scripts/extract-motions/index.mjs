import fs from 'node:fs';
import path from 'node:path';
import { buildSkeletonOnlyNodes, parseGlb } from './glbCodec.mjs';
import { extractOptimizedClipToGlb } from './optimizeKeyframes.mjs';
import { validateExtractedMotionFile } from './validateMotion.mjs';

export const DANCE_EXTRACTION_JOBS = [
  { id: 'dance_01', sourceClip: 'dance_01.001', outRelPath: 'dance/dance_01.glb' },
  { id: 'dance_02', sourceClip: 'dance_02.001', outRelPath: 'dance/dance_02.glb' },
  { id: 'dance_03', sourceClip: 'dance_03.001', outRelPath: 'dance/dance_03.glb' },
  { id: 'dance_04', sourceClip: 'dance_04.001', outRelPath: 'dance/dance_04.glb' },
  { id: 'dance_05', sourceClip: 'dance_05.001', outRelPath: 'dance/dance_05.glb' },
  { id: 'dance_06', sourceClip: 'dance_06.001', outRelPath: 'dance/dance_06.glb' },
];

export const INTERACTION_EXTRACTION_JOBS = [
  { id: 'vehicle-wait', sourceClip: 'wait.001', outRelPath: 'interactions/vehicle-wait.glb' },
];

export const TRAINING_EXTRACTION_JOBS = [
  { id: 'box_01', sourceClip: 'box_01.001', outRelPath: 'training/box_01.glb' },
  { id: 'box_02', sourceClip: 'box_02.001', outRelPath: 'training/box_02.glb' },
  { id: 'box_03', sourceClip: 'box_03.001', outRelPath: 'training/box_03.glb' },
  { id: 'front_kick_01', sourceClip: 'front_kick_01.001', outRelPath: 'training/front_kick_01.glb' },
  { id: 'front_kick_02', sourceClip: 'front_kick_02.001', outRelPath: 'training/front_kick_02.glb' },
  { id: 'warm_up', sourceClip: 'warm_up.001', outRelPath: 'training/warm_up.glb' },
  { id: 'press_up', sourceClip: 'press-up.001', outRelPath: 'training/press_up.glb' },
];

export const REACTION_EXTRACTION_JOBS = [
  { id: 'hit_to_head', sourceClip: 'hit_to_head.001', outRelPath: 'reactions/hit_to_head.glb' },
  { id: 'hit_to_stomach', sourceClip: 'hit_to_stomach.001', outRelPath: 'reactions/hit_to_stomach.glb' },
  { id: 'hit_to_side', sourceClip: 'hit_to_side.001', outRelPath: 'reactions/hit_to_side.glb' },
  { id: 'hit_to_body_01', sourceClip: 'hit_to_body_01.001', outRelPath: 'reactions/hit_to_body_01.glb' },
  { id: 'hit_to_body_02', sourceClip: 'hit_to_body_02.001', outRelPath: 'reactions/hit_to_body_02.glb' },
  { id: 'defeat_02', sourceClip: 'defeat_02.001', outRelPath: 'reactions/defeat_02.glb' },
  { id: 'defeat_03', sourceClip: 'defeat_03.001', outRelPath: 'reactions/defeat_03.glb' },
];

export const MOVEMENT_EXTRACTION_JOBS = [
  { id: 'fall', sourceClip: 'fall.001', outRelPath: 'movement/fall.glb' },
  { id: 'dive', sourceClip: 'dive.001', outRelPath: 'movement/dive.glb' },
  { id: 'turn', sourceClip: 'turn.001', outRelPath: 'movement/turn.glb' },
];

async function runExtractionBatch({
  sourcePath,
  jobs,
  outputRoot,
  validate,
  optimizationOptions,
}) {
  const source = parseGlb(sourcePath);
  const skeleton = buildSkeletonOnlyNodes(source.gltf);
  const batchResults = [];

  for (const job of jobs) {
    const outPath = path.join(outputRoot, job.outRelPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const { glbBuffer, stats } = extractOptimizedClipToGlb({
      srcGltf: source.gltf,
      srcBin: source.bin,
      skeleton,
      sourceClipName: job.sourceClip,
      options: optimizationOptions,
    });
    fs.writeFileSync(outPath, glbBuffer);

    const validation = validate
      ? await validateExtractedMotionFile({
          sourceFilePath: sourcePath,
          sourceClipName: job.sourceClip,
          extractedFilePath: outPath,
        })
      : null;

    batchResults.push({
      id: job.id,
      outRelPath: job.outRelPath,
      sourceBytes: source.byteLength,
      ...stats,
      maxSegmentAngleDeg: validation?.maxSegmentAngleDeg ?? null,
      maxHipsDelta: validation?.maxHipsDelta ?? null,
    });
  }

  return { sourceBytes: source.byteLength, batchResults };
}

export async function extractAllMotions({
  danceSourcePath = path.resolve(process.cwd(), 'dance group.glb'),
  waitSourcePath = path.resolve(process.cwd(), 'boy wait.glb'),
  actionPackSourcePath = path.resolve(process.cwd(), 'boy hit fight dive.glb'),
  outputRoot = path.resolve(process.cwd(), 'public/motions'),
  validate = true,
  optimizationOptions = {},
} = {}) {
  const batches = [
    { sourcePath: danceSourcePath, jobs: DANCE_EXTRACTION_JOBS },
    { sourcePath: waitSourcePath, jobs: INTERACTION_EXTRACTION_JOBS },
    {
      sourcePath: actionPackSourcePath,
      jobs: [
        ...TRAINING_EXTRACTION_JOBS,
        ...REACTION_EXTRACTION_JOBS,
        ...MOVEMENT_EXTRACTION_JOBS,
      ],
    },
  ];

  const results = [];
  let totalSourceBytes = 0;

  for (const batch of batches) {
    const { sourceBytes, batchResults } = await runExtractionBatch({
      sourcePath: batch.sourcePath,
      jobs: batch.jobs,
      outputRoot,
      validate,
      optimizationOptions,
    });
    totalSourceBytes += sourceBytes;
    results.push(...batchResults);
  }

  const totalExtractedBytes = results.reduce((sum, r) => sum + r.byteLength, 0);

  return {
    outputRoot,
    totalSourceBytes,
    totalExtractedBytes,
    overallReductionPct: Number(
      (((totalSourceBytes - totalExtractedBytes) / totalSourceBytes) * 100).toFixed(2),
    ),
    results,
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

if (isCli) {
  const summary = await extractAllMotions();
  console.log(`Source total: ${summary.totalSourceBytes.toLocaleString()} bytes`);
  console.log(
    `Extracted total (${summary.results.length} GLBs in public/motions/): ${summary.totalExtractedBytes.toLocaleString()} bytes (${summary.overallReductionPct}% smaller)`,
  );
  console.table(
    summary.results.map((r) => ({
      id: r.id,
      file: r.outRelPath,
      bytes: r.byteLength,
      channels: `${r.keptChannels}/${r.sourceChannels}`,
      kfBefore: r.sourceKeyframes,
      kfAfter: r.keptKeyframes,
      kfSavedPct: `${r.keyframeReductionPct}%`,
      maxAngleErrDeg: r.maxSegmentAngleDeg,
      maxHipsDelta: r.maxHipsDelta,
    })),
  );
}
