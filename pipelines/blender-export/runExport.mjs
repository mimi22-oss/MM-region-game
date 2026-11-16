import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const PINNED_BLENDER_VERSION = '5.2';
const DEFAULT_BLENDER_PATHS = [
  process.env.BLENDER_BIN,
  'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
  'blender',
].filter(Boolean);

export function resolveBlenderBinary() {
  for (const candidate of DEFAULT_BLENDER_PATHS) {
    if (candidate === 'blender') return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Pinned Blender 5.2 binary not found. Set BLENDER_BIN or install Blender 5.2.');
}

export async function verifyBlenderVersion(blenderBin = resolveBlenderBinary()) {
  const { stdout } = await execFileAsync(blenderBin, ['--version'], {
    windowsHide: true,
    timeout: 15_000,
  });
  const match = stdout.match(/Blender\s+(\d+\.\d+(?:\.\d+)?)/i);
  const detected = match ? match[1] : 'unknown';
  if (!detected.startsWith(PINNED_BLENDER_VERSION)) {
    throw new Error(`Blender version "${detected}" does not match pinned ${PINNED_BLENDER_VERSION}.x`);
  }
  return detected;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function quarantineFailure(quarantineDir, jobId, reason, details = {}) {
  const dir = path.join(quarantineDir, jobId.replace(/[^a-zA-Z0-9._-]/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    jobId,
    timestamp: new Date().toISOString(),
    reason,
    ...details,
  };
  fs.writeFileSync(path.join(dir, 'failure.json'), JSON.stringify(payload, null, 2));
  return payload;
}

/**
 * Exports `.blend` jobs using bounded headless worker concurrency, pinned `--factory-startup`
 * Blender 5.2 invocation, SHA-256 incremental cache, and failure quarantine.
 */
export async function exportBlendBatch(
  jobs,
  {
    concurrency = Math.min(2, Math.max(1, os.cpus().length)),
    timeoutMs = 180_000,
    cacheFile = path.resolve(process.cwd(), 'artifacts/phase2-pipeline/blender-export-cache.json'),
    quarantineDir = path.resolve(process.cwd(), 'artifacts/phase2-pipeline/quarantine'),
    force = false,
  } = {},
) {
  const blenderBin = resolveBlenderBinary();
  const blenderVersion = await verifyBlenderVersion(blenderBin);
  const scriptPath = path.resolve(process.cwd(), 'pipelines/blender-export/export_blend.py');
  const scriptHash = sha256File(scriptPath);

  let cache = {};
  if (!force && fs.existsSync(cacheFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch {
      cache = {};
    }
  }

  const results = [];
  const quarantined = [];
  let cursor = 0;

  async function runOne(job) {
    const startedAt = performance.now();
    try {
      if (!fs.existsSync(job.blendPath)) {
        throw new Error(`Missing .blend source: ${job.blendPath}`);
      }
      const srcHash = sha256File(job.blendPath);
      const jobKey = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            id: job.id,
            srcHash,
            scriptHash,
            stripHelpers: Boolean(job.stripHelpers),
            lod1Ratio: job.lod1Ratio ?? null,
            imageFormat: job.imageFormat ?? 'WEBP',
            draco: Boolean(job.draco),
          }),
        )
        .digest('hex');

      const cached = cache[job.id];
      if (
        !force &&
        cached &&
        cached.jobKey === jobKey &&
        fs.existsSync(job.outPath) &&
        (!job.lod1OutPath || fs.existsSync(job.lod1OutPath))
      ) {
        return {
          status: 'ok',
          cached: true,
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
          ...cached.result,
        };
      }

      const cliArgs = [
        '--factory-startup',
        '-b',
        job.blendPath,
        '--python-exit-code',
        '1',
        '--python',
        scriptPath,
        '--',
        '--out',
        job.outPath,
        '--image-format',
        job.imageFormat ?? 'WEBP',
      ];
      if (job.stripHelpers) cliArgs.push('--strip-helpers');
      if (job.lod1OutPath) {
        cliArgs.push('--lod1-out', job.lod1OutPath, '--lod1-ratio', String(job.lod1Ratio ?? 0.35));
      }
      if (job.draco) cliArgs.push('--draco');
      if (job.metaOutPath) cliArgs.push('--meta-out', job.metaOutPath);

      const { stdout, stderr } = await execFileAsync(blenderBin, cliArgs, {
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
      });

      if (!fs.existsSync(job.outPath)) {
        throw new Error(`Blender exited 0 without creating ${job.outPath}: ${stderr}`);
      }

      let meta = null;
      const lines = stdout.trim().split(/\r?\n/);
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith('{')) {
          try {
            meta = JSON.parse(lines[i]);
            break;
          } catch {
            // Scan earlier lines
          }
        }
      }

      const outStats = {
        id: job.id,
        blendPath: job.blendPath,
        blendBytes: fs.statSync(job.blendPath).size,
        outPath: job.outPath,
        outBytes: fs.statSync(job.outPath).size,
        lod1OutPath: job.lod1OutPath ?? null,
        lod1OutBytes: job.lod1OutPath && fs.existsSync(job.lod1OutPath) ? fs.statSync(job.lod1OutPath).size : null,
        blenderVersion,
        meta,
      };
      cache[job.id] = { jobKey, result: outStats };
      return {
        status: 'ok',
        cached: false,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        ...outStats,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const errObj = err && typeof err === 'object' ? err : {};
      const q = quarantineFailure(quarantineDir, job.id, reason, {
        blendPath: job.blendPath,
        stderr: typeof errObj.stderr === 'string' ? errObj.stderr.slice(-1500) : undefined,
      });
      quarantined.push(q);
      return { status: 'quarantined', id: job.id, reason };
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < jobs.length) {
      const idx = cursor++;
      const res = await runOne(jobs[idx]);
      results[idx] = res;
    }
  });
  await Promise.all(workers);

  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));

  return { blenderVersion, results, quarantined };
}
