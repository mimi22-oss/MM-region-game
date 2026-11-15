import path from 'node:path';
import { extractSingleAnimationGlb } from './extractDanceAnimations.mjs';

export function extractWaitAnimations({
  inputPath = path.resolve(process.cwd(), 'boy wait.glb'),
  outputPath = path.resolve(process.cwd(), 'public/motions/interactions/vehicle-wait.glb'),
  sourceClipName = 'wait.001',
} = {}) {
  return extractSingleAnimationGlb({
    inputPath,
    outputPath,
    sourceClipName,
  });
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isCli) {
  const summary = extractWaitAnimations();
  console.log(`Output: ${summary.outputPath} (${summary.outputBytes.toLocaleString()} bytes, ${summary.reductionPct}% smaller)`);
}
