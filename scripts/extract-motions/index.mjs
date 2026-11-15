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

export async function extractAllMotions({
  danceSourcePath = path.resolve(process.cwd(), 'dance group.glb'),
  waitSourcePath = path.resolve(process.cwd(), 'boy wait.glb'),
  outputRoot = path.resolve(process.cwd(), 'public/motions'),
  validate = true,
  optimizationOptions = {},
} = {}) {
  const results = [];

  const danceSource = parseGlb(danceSourcePath);
  const danceSkeleton = buildSkeletonOnlyNodes(danceSource.gltf);

  for (const job of DANCE_EXTRACTION_JOBS) {
    const outPath = path.join(outputRoot, job.outRelPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const { glbBuffer, stats } = extractOptimizedClipToGlb({
      srcGltf: danceSource.gltf,
      srcBin: danceSource.bin,
      skeleton: danceSkeleton,
      sourceClipName: job.sourceClip,
      options: optimizationOptions,
    });
    fs.writeFileSync(outPath, glbBuffer);

    const validation = validate
      ? await validateExtractedMotionFile({
          sourceFilePath: danceSourcePath,
          sourceClipName: job.sourceClip,
          extractedFilePath: outPath,
        })
      : null;

    results.push({
      id: job.id,
      outRelPath: job.outRelPath,
      sourceBytes: danceSource.byteLength,
      ...stats,
      maxSegmentAngleDeg: validation?.maxSegmentAngleDeg ?? null,
      maxHipsDelta: validation?.maxHipsDelta ?? null,
    });
  }

  const waitSource = parseGlb(waitSourcePath);
  const waitSkeleton = buildSkeletonOnlyNodes(waitSource.gltf);

  for (const job of INTERACTION_EXTRACTION_JOBS) {
    const outPath = path.join(outputRoot, job.outRelPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const { glbBuffer, stats } = extractOptimizedClipToGlb({
      srcGltf: waitSource.gltf,
      srcBin: waitSource.bin,
      skeleton: waitSkeleton,
      sourceClipName: job.sourceClip,
      options: optimizationOptions,
    });
    fs.writeFileSync(outPath, glbBuffer);

    const validation = validate
      ? await validateExtractedMotionFile({
          sourceFilePath: waitSourcePath,
          sourceClipName: job.sourceClip,
          extractedFilePath: outPath,
        })
      : null;

    results.push({
      id: job.id,
      outRelPath: job.outRelPath,
      sourceBytes: waitSource.byteLength,
      ...stats,
      maxSegmentAngleDeg: validation?.maxSegmentAngleDeg ?? null,
      maxHipsDelta: validation?.maxHipsDelta ?? null,
    });
  }

  const totalDanceSourceBytes = danceSource.byteLength;
  const totalWaitSourceBytes = waitSource.byteLength;
  const totalExtractedBytes = results.reduce((sum, r) => sum + r.byteLength, 0);

  return {
    outputRoot,
    totalSourceBytes: totalDanceSourceBytes + totalWaitSourceBytes,
    totalExtractedBytes,
    overallReductionPct: Number(
      (((totalDanceSourceBytes + totalWaitSourceBytes - totalExtractedBytes) /
        (totalDanceSourceBytes + totalWaitSourceBytes)) *
        100).toFixed(2),
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
    `Extracted total (7 GLBs in public/motions/): ${summary.totalExtractedBytes.toLocaleString()} bytes (${summary.overallReductionPct}% smaller)`,
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
