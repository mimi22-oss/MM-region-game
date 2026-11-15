import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_NATIVE_BASELINE,
  checkUpdateCompatibility,
  validateAssetManifest,
} from '../src/game/otaCompatibility.ts';

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

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const args = parseArgs(process.argv.slice(2));
const rootDir = process.cwd();
const distDir = path.resolve(rootDir, args['dist-dir'] ?? 'dist');
const artifactDir = path.resolve(rootDir, args['out-dir'] ?? 'ota-artifacts');
const channel = (args.channel ?? process.env.OTA_CHANNEL ?? 'production') === 'staging' ? 'staging' : 'production';

const manifestRaw = fs.readFileSync(path.join(distDir, 'ota', 'asset-manifest.json'), 'utf8');
const manifest = validateAssetManifest(JSON.parse(manifestRaw));
const expectedManifestSha = sha256Hex(Buffer.from(manifestRaw, 'utf8'));

for (const file of manifest.files) {
  const fullPath = path.join(distDir, file.path);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Manifest references missing built asset: ${file.path}`);
  }
  const bytes = fs.readFileSync(fullPath);
  if (bytes.length !== file.bytes) {
    throw new Error(`Asset byte count mismatch for ${file.path}: ${bytes.length} !== ${file.bytes}`);
  }
  const actualSha = sha256Hex(bytes);
  if (actualSha !== file.sha256) {
    throw new Error(`Asset SHA-256 mismatch for ${file.path}: ${actualSha} !== ${file.sha256}`);
  }
}

const releasePath = path.join(distDir, 'ota', `${channel}.json`);
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
if (release.assetManifestSha256 !== expectedManifestSha) {
  throw new Error('Channel descriptor assetManifestSha256 mismatch');
}

const zipPath = path.join(artifactDir, `mm-region-ota-${release.version}.zip`);
if (!fs.existsSync(zipPath)) {
  throw new Error(`Missing OTA zip artifact at ${zipPath}`);
}
const zipBytes = fs.readFileSync(zipPath);
if (zipBytes.length !== release.bundleBytes) {
  throw new Error(`OTA zip byte mismatch: ${zipBytes.length} !== ${release.bundleBytes}`);
}
const zipSha = sha256Hex(zipBytes);
if (zipSha !== release.bundleSha256) {
  throw new Error(`OTA zip SHA-256 mismatch: ${zipSha} !== ${release.bundleSha256}`);
}

const compatAgainstOlderVersion = checkUpdateCompatibility(release, {
  nativeVersion: APP_NATIVE_BASELINE.nativeVersion,
  androidVersionCode: APP_NATIVE_BASELINE.androidVersionCode,
  schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
  currentVersion: '0.0.1',
  channel,
});

if (!release.requiresNativeApk && !compatAgainstOlderVersion.compatible) {
  throw new Error(`Compatibility gate failed: ${compatAgainstOlderVersion.message}`);
}

if (process.env.GITHUB_OUTPUT) {
  const lines = [
    `ota_publishable=${!release.requiresNativeApk && compatAgainstOlderVersion.compatible ? 'true' : 'false'}`,
    `version=${release.version}`,
    `bundle_zip=${path.relative(rootDir, zipPath).replace(/\\/g, '/')}`,
    `bundle_sha256=${zipSha}`,
  ];
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, 'utf8');
}

console.log(
  `Verified ${manifest.files.length} dist assets, manifest (${expectedManifestSha.slice(0, 12)}...), and ZIP (${zipSha.slice(0, 12)}...). otaPublishable=${!release.requiresNativeApk && compatAgainstOlderVersion.compatible}`,
);
