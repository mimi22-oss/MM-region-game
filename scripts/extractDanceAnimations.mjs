import path from 'node:path';
import fs from 'node:fs';
import { buildSkeletonOnlyNodes, parseGlb } from './extract-motions/glbCodec.mjs';
import { extractOptimizedClipToGlb } from './extract-motions/optimizeKeyframes.mjs';
import { DANCE_EXTRACTION_JOBS } from './extract-motions/index.mjs';

export function extractAllDanceAnimations({
  inputPath = path.resolve(process.cwd(), 'dance group.glb'),
  outputDir = path.resolve(process.cwd(), 'public/motions/dance'),
} = {}) {
  const { byteLength: sourceBytes, gltf: srcGltf, bin: srcBin } = parseGlb(inputPath);
  const skeleton = buildSkeletonOnlyNodes(srcGltf);
  fs.mkdirSync(outputDir, { recursive: true });

  const results = [];
  let totalOutputBytes = 0;
  for (const job of DANCE_EXTRACTION_JOBS) {
    const outFile = path.basename(job.outRelPath);
    const { glbBuffer, stats } = extractOptimizedClipToGlb({
      srcGltf,
      srcBin,
      skeleton,
      sourceClipName: job.sourceClip,
    });
    fs.writeFileSync(path.join(outputDir, outFile), glbBuffer);
    totalOutputBytes += glbBuffer.byteLength;
    results.push({ file: outFile, ...stats });
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

export function extractSingleAnimationGlb({ inputPath, outputPath, sourceClipName }) {
  const { byteLength: sourceBytes, gltf: srcGltf, bin: srcBin } = parseGlb(inputPath);
  const skeleton = buildSkeletonOnlyNodes(srcGltf);
  const clipName = sourceClipName ?? srcGltf.animations?.[0]?.name;
  if (!clipName) throw new Error(`No animation clip found in ${inputPath}`);
  const { glbBuffer, stats } = extractOptimizedClipToGlb({
    srcGltf,
    srcBin,
    skeleton,
    sourceClipName: clipName,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, glbBuffer);
  return {
    sourcePath: inputPath,
    outputPath,
    sourceBytes,
    outputBytes: glbBuffer.byteLength,
    reductionPct: Number((((sourceBytes - glbBuffer.byteLength) / sourceBytes) * 100).toFixed(2)),
    ...stats,
  };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isCli) {
  const summary = extractAllDanceAnimations();
  console.log(`Total Extracted (6 GLBs): ${summary.totalOutputBytes.toLocaleString()} bytes (${summary.reductionPct}% smaller)`);
  console.table(summary.results);
}
