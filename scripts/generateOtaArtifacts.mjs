import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  APP_NATIVE_BASELINE,
  buildContentPacks,
  classifyAssetCategory,
  DEFAULT_GITHUB_REPO,
  DEFAULT_OTA_BASE_URL,
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

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a deterministic, cross-platform PKZIP archive compatible with Android
 * ZipInputStream and @capgo/capacitor-updater without external CLI binaries.
 */
function buildDeterministicZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  // Fixed DOS timestamp for bit-reproducible OTA zip checksums
  const dosTime = 0x0000;
  const dosDate = 0x5421;
  const utf8Flag = 0x0800;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.relativePath, 'utf8');
    const raw = entry.bytes;
    const crc = crc32(raw);
    const deflated = zlib.deflateRawSync(raw, { level: 6 });
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(utf8Flag, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(utf8Flag, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBytes, payload);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + payload.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function walkFilesRecursive(rootDir, currentDir = rootDir, result = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of entries) {
    const fullPath = path.join(currentDir, item.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    // Skip generated ota output so repeated runs stay idempotent and never recurse
    if (relPath === 'ota' || relPath.startsWith('ota/')) continue;
    if (item.isDirectory()) {
      walkFilesRecursive(rootDir, fullPath, result);
    } else if (item.isFile()) {
      result.push({ fullPath, relativePath: relPath });
    }
  }
  return result;
}

const rootDir = process.cwd();
const args = parseArgs(process.argv.slice(2));
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const distDir = path.resolve(rootDir, args['dist-dir'] ?? 'dist');
const outArtifactDir = path.resolve(rootDir, args['out-dir'] ?? 'ota-artifacts');
if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(`Missing built dist bundle at ${distDir}. Run "npm run build" first.`);
  process.exit(1);
}

const channelRaw = args.channel ?? process.env.OTA_CHANNEL ?? 'production';
const channel = channelRaw === 'staging' ? 'staging' : 'production';
const version = (args.version ?? process.env.OTA_VERSION ?? pkg.version).trim();
const commitSha = (args.commit ?? process.env.GITHUB_SHA ?? 'local').trim();
const baseUrl = (args['base-url'] ?? process.env.OTA_BASE_URL ?? DEFAULT_OTA_BASE_URL).replace(/\/+$/, '');
const releaseTag = (args['release-tag'] ?? process.env.OTA_RELEASE_TAG ?? `ota-v${version}`).trim();
const repoSlug = (args.repo ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_GITHUB_REPO).trim();
const zipFileName = `mm-region-ota-${version}.zip`;
const bundleUrl = (
  args['bundle-url'] ??
  process.env.OTA_BUNDLE_URL ??
  `https://github.com/${repoSlug}/releases/download/${releaseTag}/${zipFileName}`
).trim();
const requiresNativeApk =
  (args['requires-native-apk'] ?? process.env.OTA_REQUIRES_NATIVE_APK ?? 'false') === 'true';

const minNativeVersion = (args['min-native-version'] ?? APP_NATIVE_BASELINE.nativeVersion).trim();
const minAndroidVersionCode = Number(
  args['min-android-version-code'] ?? APP_NATIVE_BASELINE.androidVersionCode,
);
const maxNativeVersion = args['max-native-version']?.trim() || undefined;

const discovered = walkFilesRecursive(distDir);
const zipEntries = [];
const manifestFiles = [];
let totalBytes = 0;

for (const item of discovered) {
  const bytes = fs.readFileSync(item.fullPath);
  const hash = sha256Hex(bytes);
  const category = classifyAssetCategory(item.relativePath);
  totalBytes += bytes.length;
  zipEntries.push({ relativePath: item.relativePath, bytes });
  manifestFiles.push({
    path: item.relativePath,
    sha256: hash,
    bytes: bytes.length,
    category,
    critical:
      item.relativePath === 'index.html' ||
      category === 'character-model' ||
      category === 'ghost-npc' ||
      category === 'shared-motion' ||
      category === 'map-data' ||
      category === 'building-road-data' ||
      category === 'app-bundle',
  });
}

const generatedAt = new Date().toISOString();
const contentPacks = await buildContentPacks(
  manifestFiles,
  {
    version,
    schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
    minNativeVersion,
    ...(maxNativeVersion ? { maxNativeVersion } : {}),
    minAndroidVersionCode,
  },
  (buf) => sha256Hex(Buffer.from(buf)),
);

const assetManifest = validateAssetManifest({
  schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
  version,
  channel,
  commitSha,
  generatedAt,
  minNativeVersion,
  ...(maxNativeVersion ? { maxNativeVersion } : {}),
  minAndroidVersionCode,
  totalBytes,
  files: manifestFiles,
  packs: contentPacks,
});

const assetManifestJson = `${JSON.stringify(assetManifest, null, 2)}\n`;
const assetManifestSha256 = sha256Hex(Buffer.from(assetManifestJson, 'utf8'));

const packsIndex = {
  schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
  version,
  channel,
  generatedAt,
  assetManifestSha256,
  minNativeVersion,
  ...(maxNativeVersion ? { maxNativeVersion } : {}),
  minAndroidVersionCode,
  packs: contentPacks,
};
const packsIndexJson = `${JSON.stringify(packsIndex, null, 2)}\n`;

const nativeCompat = {
  schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
  appId: APP_NATIVE_BASELINE.appId,
  nativeBaseline: {
    nativeVersion: APP_NATIVE_BASELINE.nativeVersion,
    androidVersionName: APP_NATIVE_BASELINE.androidVersionName,
    androidVersionCode: APP_NATIVE_BASELINE.androidVersionCode,
    capacitorMajor: APP_NATIVE_BASELINE.capacitorMajor,
  },
  release: {
    version,
    channel,
    minNativeVersion,
    ...(maxNativeVersion ? { maxNativeVersion } : {}),
    minAndroidVersionCode,
    requiresNativeApk,
  },
  generatedAt,
};
const nativeCompatJson = `${JSON.stringify(nativeCompat, null, 2)}\n`;

// Include ota metadata inside the Capacitor bundle zip so the offline bundle self-describes its version.
zipEntries.push({
  relativePath: 'ota/asset-manifest.json',
  bytes: Buffer.from(assetManifestJson, 'utf8'),
});
zipEntries.push({
  relativePath: 'ota/native-compat.json',
  bytes: Buffer.from(nativeCompatJson, 'utf8'),
});
zipEntries.push({
  relativePath: 'ota/packs.json',
  bytes: Buffer.from(packsIndexJson, 'utf8'),
});

const zipBuffer = buildDeterministicZipBuffer(zipEntries);
const bundleSha256 = sha256Hex(zipBuffer);

const deltaManifest = manifestFiles.map((entry) => ({
  file_name: entry.path,
  file_hash: entry.sha256,
  download_url: `${baseUrl}/${entry.path}`,
  file_size: entry.bytes,
}));

const releaseDescriptor = {
  schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
  channel,
  version,
  commitSha,
  releasedAt: generatedAt,
  bundleUrl,
  bundleSha256,
  bundleBytes: zipBuffer.length,
  assetManifestUrl: `${baseUrl}/ota/asset-manifest.json`,
  assetManifestSha256,
  minNativeVersion,
  ...(maxNativeVersion ? { maxNativeVersion } : {}),
  minAndroidVersionCode,
  mandatory: false,
  requiresNativeApk,
  releaseNotes: `MM Region Game ${version} (${channel})`,
  deltaManifest,
};
const releaseDescriptorJson = `${JSON.stringify(releaseDescriptor, null, 2)}\n`;

const distOtaDir = path.join(distDir, 'ota');
fs.mkdirSync(distOtaDir, { recursive: true });
fs.mkdirSync(outArtifactDir, { recursive: true });

fs.writeFileSync(path.join(distOtaDir, 'asset-manifest.json'), assetManifestJson, 'utf8');
fs.writeFileSync(path.join(distOtaDir, 'native-compat.json'), nativeCompatJson, 'utf8');
fs.writeFileSync(path.join(distOtaDir, 'packs.json'), packsIndexJson, 'utf8');
fs.writeFileSync(path.join(distOtaDir, `${channel}.json`), releaseDescriptorJson, 'utf8');

fs.writeFileSync(path.join(outArtifactDir, zipFileName), zipBuffer);
fs.writeFileSync(path.join(outArtifactDir, 'asset-manifest.json'), assetManifestJson, 'utf8');
fs.writeFileSync(path.join(outArtifactDir, 'native-compat.json'), nativeCompatJson, 'utf8');
fs.writeFileSync(path.join(outArtifactDir, 'packs.json'), packsIndexJson, 'utf8');
fs.writeFileSync(path.join(outArtifactDir, `${channel}.json`), releaseDescriptorJson, 'utf8');

const checksumLines = [
  `${bundleSha256}  ${zipFileName}`,
  `${assetManifestSha256}  asset-manifest.json`,
  `${sha256Hex(Buffer.from(packsIndexJson, 'utf8'))}  packs.json`,
  `${sha256Hex(Buffer.from(releaseDescriptorJson, 'utf8'))}  ${channel}.json`,
  `${sha256Hex(Buffer.from(nativeCompatJson, 'utf8'))}  native-compat.json`,
].join('\n');
fs.writeFileSync(path.join(outArtifactDir, 'checksums.sha256'), `${checksumLines}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      version,
      channel,
      fileCount: manifestFiles.length,
      uncompressedBytes: totalBytes,
      packs: contentPacks.map((p) => ({
        id: p.id,
        fileCount: p.fileCount,
        totalBytes: p.totalBytes,
        required: p.required,
      })),
      bundleZip: path.relative(rootDir, path.join(outArtifactDir, zipFileName)),
      bundleBytes: zipBuffer.length,
      bundleSha256,
      requiresNativeApk,
    },
    null,
    2,
  ),
);
