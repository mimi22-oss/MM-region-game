import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { classifyChangedPathsForRelease } from '../src/game/otaCompatibility.ts';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function tryGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function extractNativeDeps(rawPkgJson) {
  try {
    const parsed = JSON.parse(rawPkgJson);
    const merged = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    const out = {};
    for (const [name, version] of Object.entries(merged)) {
      if (name.startsWith('@capacitor/') || name.startsWith('@capgo/')) {
        out[name] = String(version);
      }
    }
    return out;
  } catch {
    return {};
  }
}

const args = parseArgs(process.argv.slice(2));
const baseRef = args.base ?? process.env.GITHUB_BASE_SHA ?? 'HEAD~1';
const headRef = args.head ?? process.env.GITHUB_SHA ?? 'HEAD';

let changedFiles = [];
const diffOutput = tryGit(['diff', '--name-only', `${baseRef}..${headRef}`]);
if (diffOutput !== null) {
  changedFiles = diffOutput.split(/\r?\n/).filter(Boolean);
} else {
  const showOutput = tryGit(['show', '--pretty=', '--name-only', headRef]);
  changedFiles = showOutput ? showOutput.split(/\r?\n/).filter(Boolean) : [];
}

const changedDependencies = [];
if (changedFiles.includes('package.json')) {
  const prevPkg = tryGit(['show', `${baseRef}:package.json`]);
  const curPkg = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : null;
  if (prevPkg && curPkg) {
    const prevDeps = extractNativeDeps(prevPkg);
    const curDeps = extractNativeDeps(curPkg);
    const keys = new Set([...Object.keys(prevDeps), ...Object.keys(curDeps)]);
    for (const key of keys) {
      if (prevDeps[key] !== curDeps[key]) changedDependencies.push(key);
    }
  } else {
    changedDependencies.push('@capacitor/core');
  }
}

let capacitorConfigNativeChanged = true;
if (changedFiles.includes('capacitor.config.ts')) {
  const configDiff = tryGit(['diff', '-U0', `${baseRef}..${headRef}`, '--', 'capacitor.config.ts']) ?? '';
  const addedOrRemoved = configDiff
    .split(/\r?\n/)
    .filter((line) => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---'))
    .map((line) => line.slice(1).trim());
  const nativeKeys = ['appId', 'appName', 'webDir', 'androidScheme', 'cleartext', 'backgroundColor', 'allowMixedContent', 'captureInput', 'url:'];
  capacitorConfigNativeChanged = addedOrRemoved.some((line) =>
    nativeKeys.some((key) => line.includes(key)),
  );
}

const classification = classifyChangedPathsForRelease(changedFiles, {
  changedDependencies,
  capacitorConfigNativeChanged,
});

const report = {
  baseRef,
  headRef,
  changedFiles,
  changedNativeDependencies: changedDependencies,
  ...classification,
};

if (args.out) {
  const outPath = path.resolve(process.cwd(), args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  const lines = [
    `ota_eligible=${classification.otaEligible ? 'true' : 'false'}`,
    `requires_native_apk=${classification.requiresNativeApk ? 'true' : 'false'}`,
    `changed_count=${changedFiles.length}`,
  ];
  fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
