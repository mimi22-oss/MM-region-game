export type OtaChannel = 'production' | 'staging';

export type AssetCategory =
  | 'character-model'
  | 'ghost-npc'
  | 'shared-motion'
  | 'map-data'
  | 'building-road-data'
  | 'texture'
  | 'app-bundle'
  | 'other-offline';

export interface VersionedAssetEntry {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly category: AssetCategory;
  readonly critical: boolean;
}

export interface VersionedAssetManifest {
  readonly schemaVersion: number;
  readonly version: string;
  readonly channel: OtaChannel;
  readonly commitSha: string;
  readonly generatedAt: string;
  readonly minNativeVersion: string;
  readonly maxNativeVersion?: string;
  readonly minAndroidVersionCode: number;
  readonly totalBytes: number;
  readonly files: readonly VersionedAssetEntry[];
}

export interface CapacitorDeltaEntry {
  readonly file_name: string;
  readonly file_hash: string;
  readonly download_url: string;
  readonly file_size?: number;
}

export interface ChannelReleaseDescriptor {
  readonly schemaVersion: number;
  readonly channel: OtaChannel;
  readonly version: string;
  readonly commitSha: string;
  readonly releasedAt: string;
  readonly bundleUrl: string;
  readonly bundleSha256: string;
  readonly bundleBytes: number;
  readonly assetManifestUrl: string;
  readonly assetManifestSha256: string;
  readonly minNativeVersion: string;
  readonly maxNativeVersion?: string;
  readonly minAndroidVersionCode: number;
  readonly mandatory?: boolean;
  readonly requiresNativeApk?: boolean;
  readonly releaseNotes?: string;
  readonly deltaManifest?: readonly CapacitorDeltaEntry[];
}

export interface LocalNativeRuntimeInfo {
  readonly nativeVersion: string;
  readonly androidVersionCode: number;
  readonly schemaVersion: number;
  readonly currentVersion: string;
  readonly channel: OtaChannel;
}

export type CompatibilityReason =
  | 'compatible'
  | 'up_to_date'
  | 'requires_native_apk'
  | 'schema_mismatch'
  | 'invalid_checksum'
  | 'invalid_url'
  | 'downgrade_blocked'
  | 'malformed_descriptor';

export interface UpdateCompatibilityResult {
  readonly compatible: boolean;
  readonly updateAvailable: boolean;
  readonly requiresNativeApk: boolean;
  readonly reason: CompatibilityReason;
  readonly message: string;
}

export interface NativeChangeClassification {
  readonly otaEligible: boolean;
  readonly requiresNativeApk: boolean;
  readonly nativePaths: readonly string[];
  readonly otaPaths: readonly string[];
  readonly docsOrCiPaths: readonly string[];
  readonly reasons: readonly string[];
}

export interface AssetDeltaDiff {
  readonly toDownload: readonly VersionedAssetEntry[];
  readonly reusable: readonly VersionedAssetEntry[];
  readonly obsoletePaths: readonly string[];
  readonly totalBytes: number;
  readonly downloadBytes: number;
  readonly reusedBytes: number;
}

export const APP_NATIVE_BASELINE = {
  appId: 'com.mmregion.town3d',
  appName: 'MM Region Game',
  nativeVersion: '1.0.0',
  androidVersionName: '1.0',
  androidVersionCode: 1,
  otaSchemaVersion: 1,
  capacitorMajor: 8,
} as const;

export const DEFAULT_OTA_BASE_URL = 'https://mm-region-game.vercel.app';
export const DEFAULT_GITHUB_REPO = 'mimi22-oss/MM-region-game';
export const DEFAULT_MAX_ASSET_STORAGE_BYTES = 128 * 1024 * 1024;

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;
const NATIVE_PACKAGE_PREFIXES = ['@capacitor/', '@capgo/'];

export function isValidSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_RE.test(value.trim());
}

export function normalizeAssetPath(rawPath: string): string {
  const forward = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  const segments = forward.split('/').filter((seg) => seg.length > 0 && seg !== '.');
  if (segments.some((seg) => seg === '..')) {
    throw new Error(`Unsafe asset path traversal rejected: ${rawPath}`);
  }
  return segments.join('/');
}

export function isTrustedHttpsUrl(rawUrl: unknown, allowLocalDev = false): rawUrl is string {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:') return true;
    if (allowLocalDev && parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly (number | string)[];
}

/**
 * Parses semver strings including short Android versionName forms such as "1.0"
 * and prerelease suffixes such as "1.2.0-staging.4+abc123".
 */
export function parseSemver(version: string): ParsedSemver {
  const cleaned = version.trim().replace(/^v/i, '').split('+')[0] ?? '';
  const hyphenIndex = cleaned.indexOf('-');
  const corePart = hyphenIndex >= 0 ? cleaned.slice(0, hyphenIndex) : cleaned;
  const prePart = hyphenIndex >= 0 ? cleaned.slice(hyphenIndex + 1) : '';
  const nums = corePart.split('.').map((part) => {
    if (!/^\d+$/.test(part)) return NaN;
    return Number(part);
  });
  if (nums.length === 0 || nums.length > 3 || nums.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Invalid semantic version: "${version}"`);
  }
  const [major = 0, minor = 0, patch = 0] = nums;
  const prerelease = prePart
    ? prePart.split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id))
    : [];
  return { major, minor, patch, prerelease };
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;

  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;

  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i++) {
    const x = pa.prerelease[i];
    const y = pb.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xNum = typeof x === 'number';
    const yNum = typeof y === 'number';
    if (xNum && yNum) return (x as number) < (y as number) ? -1 : 1;
    if (xNum !== yNum) return xNum ? -1 : 1;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

export function isVersionWithinBounds(version: string, minVersion: string, maxVersion?: string): boolean {
  if (compareSemver(version, minVersion) < 0) return false;
  if (maxVersion && compareSemver(version, maxVersion) > 0) return false;
  return true;
}

export function checkUpdateCompatibility(
  release: ChannelReleaseDescriptor | null | undefined,
  local: LocalNativeRuntimeInfo,
  options?: { allowChannelSwitch?: boolean; allowLocalDevHttp?: boolean },
): UpdateCompatibilityResult {
  if (!release || typeof release !== 'object' || typeof release.version !== 'string') {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'malformed_descriptor',
      message: 'Update descriptor is missing version metadata.',
    };
  }

  try {
    parseSemver(release.version);
    parseSemver(release.minNativeVersion);
    if (release.maxNativeVersion) parseSemver(release.maxNativeVersion);
  } catch {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'malformed_descriptor',
      message: `Invalid semantic version in update descriptor (${release.version}).`,
    };
  }

  if (release.schemaVersion !== local.schemaVersion) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'schema_mismatch',
      message: `OTA schema v${release.schemaVersion} does not match app schema v${local.schemaVersion}; APK update required.`,
    };
  }

  if (release.requiresNativeApk) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'requires_native_apk',
      message: 'This release changes native Android/Capacitor components and requires an updated APK.',
    };
  }

  if (!isVersionWithinBounds(local.nativeVersion, release.minNativeVersion, release.maxNativeVersion)) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'requires_native_apk',
      message: `Installed APK (${local.nativeVersion}) is outside supported native range ${release.minNativeVersion}${release.maxNativeVersion ? `–${release.maxNativeVersion}` : '+'}.`,
    };
  }

  if (local.androidVersionCode < release.minAndroidVersionCode) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'requires_native_apk',
      message: `Installed Android versionCode ${local.androidVersionCode} is below required ${release.minAndroidVersionCode}.`,
    };
  }

  if (!isValidSha256(release.bundleSha256) || !isValidSha256(release.assetManifestSha256)) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'invalid_checksum',
      message: 'Release checksum failed SHA-256 format validation.',
    };
  }

  const allowHttp = Boolean(options?.allowLocalDevHttp);
  if (
    !isTrustedHttpsUrl(release.bundleUrl, allowHttp) ||
    !isTrustedHttpsUrl(release.assetManifestUrl, allowHttp)
  ) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'invalid_url',
      message: 'Release URL must use HTTPS.',
    };
  }

  const cmp = compareSemver(release.version, local.currentVersion);
  if (cmp === 0 && release.channel === local.channel) {
    return {
      compatible: true,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'up_to_date',
      message: `Already running version ${local.currentVersion} (${local.channel}).`,
    };
  }

  if (cmp < 0 && !options?.allowChannelSwitch) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'downgrade_blocked',
      message: `Refusing silent downgrade from ${local.currentVersion} to ${release.version}.`,
    };
  }

  return {
    compatible: true,
    updateAvailable: true,
    requiresNativeApk: false,
    reason: 'compatible',
    message: `Compatible OTA update ${release.version} ready for download.`,
  };
}

export function classifyAssetCategory(relativePath: string): AssetCategory {
  const path = normalizeAssetPath(relativePath).toLowerCase();
  if (path === 'models/ghost-woman.glb' || path.startsWith('motions/ghost/')) {
    return 'ghost-npc';
  }
  if (
    path === 'models/canolia-character.glb' ||
    /^assets\/(boy|girl)-[a-z0-9_-]+\.glb$/.test(path) ||
    (path.startsWith('models/') && path.endsWith('.glb'))
  ) {
    return 'character-model';
  }
  if (path.startsWith('motions/') && path.endsWith('.glb')) {
    return 'shared-motion';
  }
  if (path.startsWith('map/')) {
    if (
      path.includes('building') ||
      path.includes('road') ||
      path.includes('separation') ||
      path.includes('tile')
    ) {
      return 'building-road-data';
    }
    return 'map-data';
  }
  if (/\.(png|webp|jpe?g|ico|svg|ktx2|basis)$/.test(path)) {
    return 'texture';
  }
  if (
    path === 'index.html' ||
    path === 'candle-preview.html' ||
    /\.(js|mjs|css|woff2?)$/.test(path)
  ) {
    return 'app-bundle';
  }
  return 'other-offline';
}

export function validateAssetManifest(raw: unknown): VersionedAssetManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Asset manifest must be a JSON object');
  }
  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== APP_NATIVE_BASELINE.otaSchemaVersion) {
    throw new Error(`Unsupported asset manifest schemaVersion: ${String(candidate.schemaVersion)}`);
  }
  if (typeof candidate.version !== 'string' || !candidate.version.trim()) {
    throw new Error('Asset manifest missing version');
  }
  parseSemver(candidate.version);

  if (candidate.channel !== 'production' && candidate.channel !== 'staging') {
    throw new Error(`Invalid asset manifest channel: ${String(candidate.channel)}`);
  }
  if (typeof candidate.minNativeVersion !== 'string' || !candidate.minNativeVersion.trim()) {
    throw new Error('Asset manifest missing minNativeVersion');
  }
  parseSemver(candidate.minNativeVersion);
  if (candidate.maxNativeVersion !== undefined) {
    if (typeof candidate.maxNativeVersion !== 'string') {
      throw new Error('Asset manifest maxNativeVersion must be a string');
    }
    parseSemver(candidate.maxNativeVersion);
  }
  if (
    typeof candidate.minAndroidVersionCode !== 'number' ||
    !Number.isInteger(candidate.minAndroidVersionCode) ||
    candidate.minAndroidVersionCode < 1
  ) {
    throw new Error('Asset manifest minAndroidVersionCode must be a positive integer');
  }
  if (!Array.isArray(candidate.files)) {
    throw new Error('Asset manifest files must be an array');
  }

  const seen = new Set<string>();
  const normalizedFiles: VersionedAssetEntry[] = [];
  let sumBytes = 0;

  for (const item of candidate.files) {
    if (!item || typeof item !== 'object') {
      throw new Error('Asset manifest entry must be an object');
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.path !== 'string' || !entry.path.trim()) {
      throw new Error('Asset manifest entry missing path');
    }
    const cleanPath = normalizeAssetPath(entry.path);
    if (seen.has(cleanPath)) {
      throw new Error(`Duplicate asset manifest path: ${cleanPath}`);
    }
    seen.add(cleanPath);

    if (!isValidSha256(entry.sha256)) {
      throw new Error(`Invalid SHA-256 digest for ${cleanPath}`);
    }
    if (typeof entry.bytes !== 'number' || !Number.isInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error(`Invalid byte count for ${cleanPath}`);
    }
    sumBytes += entry.bytes;
    normalizedFiles.push({
      path: cleanPath,
      sha256: entry.sha256.toLowerCase(),
      bytes: entry.bytes,
      category:
        typeof entry.category === 'string'
          ? (entry.category as AssetCategory)
          : classifyAssetCategory(cleanPath),
      critical: Boolean(entry.critical ?? true),
    });
  }

  const declaredTotal =
    typeof candidate.totalBytes === 'number' ? candidate.totalBytes : sumBytes;
  if (declaredTotal !== sumBytes) {
    throw new Error(
      `Asset manifest totalBytes (${declaredTotal}) does not match file byte sum (${sumBytes})`,
    );
  }

  return {
    schemaVersion: candidate.schemaVersion,
    version: candidate.version.trim(),
    channel: candidate.channel,
    commitSha: typeof candidate.commitSha === 'string' ? candidate.commitSha : '',
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : '',
    minNativeVersion: candidate.minNativeVersion.trim(),
    ...(candidate.maxNativeVersion ? { maxNativeVersion: candidate.maxNativeVersion.trim() } : {}),
    minAndroidVersionCode: candidate.minAndroidVersionCode,
    totalBytes: sumBytes,
    files: normalizedFiles,
  };
}

/**
 * Computes which manifest files actually need network download by checking whether a
 * verified asset with the identical SHA-256 is already stored locally.
 */
export function diffAssetManifests(
  targetManifest: VersionedAssetManifest,
  cachedAssetsByPath: ReadonlyMap<string, { readonly sha256: string; readonly bytes?: number }>,
  previousGenerationPaths: readonly string[] = [],
): AssetDeltaDiff {
  const toDownload: VersionedAssetEntry[] = [];
  const reusable: VersionedAssetEntry[] = [];
  const targetPaths = new Set<string>();
  let downloadBytes = 0;
  let reusedBytes = 0;

  for (const entry of targetManifest.files) {
    targetPaths.add(entry.path);
    const cached = cachedAssetsByPath.get(entry.path);
    if (cached && cached.sha256.toLowerCase() === entry.sha256.toLowerCase()) {
      reusable.push(entry);
      reusedBytes += entry.bytes;
    } else {
      toDownload.push(entry);
      downloadBytes += entry.bytes;
    }
  }

  const obsoletePaths: string[] = [];
  for (const prevPath of previousGenerationPaths) {
    const norm = normalizeAssetPath(prevPath);
    if (!targetPaths.has(norm)) obsoletePaths.push(norm);
  }
  for (const cachedPath of cachedAssetsByPath.keys()) {
    const norm = normalizeAssetPath(cachedPath);
    if (!targetPaths.has(norm) && !obsoletePaths.includes(norm)) {
      obsoletePaths.push(norm);
    }
  }

  return {
    toDownload,
    reusable,
    obsoletePaths,
    totalBytes: targetManifest.totalBytes,
    downloadBytes,
    reusedBytes,
  };
}

/**
 * Classifies git changes into OTA-eligible vs Native-APK-required changes so CI and
 * release operators never ship breaking native expectations to older APK installs.
 */
export function classifyChangedPathsForRelease(
  changedFiles: readonly string[],
  options?: {
    changedDependencies?: readonly string[];
    capacitorConfigNativeChanged?: boolean;
  },
): NativeChangeClassification {
  const nativePaths: string[] = [];
  const otaPaths: string[] = [];
  const docsOrCiPaths: string[] = [];
  const reasons: string[] = [];

  for (const raw of changedFiles) {
    const file = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!file) continue;

    if (file.startsWith('android/')) {
      nativePaths.push(file);
      reasons.push(`Android native project modified: ${file}`);
      continue;
    }

    if (file === 'capacitor.config.ts' || file === 'capacitor.config.json') {
      if (options?.capacitorConfigNativeChanged !== false) {
        nativePaths.push(file);
        reasons.push(`Native Capacitor configuration modified: ${file}`);
      } else {
        otaPaths.push(file);
      }
      continue;
    }

    if (
      file.startsWith('docs/') ||
      file.startsWith('.github/') ||
      file.endsWith('.md') ||
      file.startsWith('tests/') ||
      file === '.gitignore'
    ) {
      docsOrCiPaths.push(file);
      continue;
    }

    if (
      file.startsWith('src/') ||
      file.startsWith('public/') ||
      file === 'index.html' ||
      file === 'candle-preview.html' ||
      file === 'vite.config.ts' ||
      file === 'vercel.json' ||
      file === 'tsconfig.json' ||
      file.startsWith('scripts/')
    ) {
      otaPaths.push(file);
      continue;
    }

    if (file === 'package.json' || file === 'package-lock.json') {
      const nativeDeps = (options?.changedDependencies ?? []).filter((dep) =>
        NATIVE_PACKAGE_PREFIXES.some((prefix) => dep.startsWith(prefix)),
      );
      if (nativeDeps.length > 0) {
        nativePaths.push(file);
        reasons.push(`Native Capacitor/Capgo dependency changed: ${nativeDeps.join(', ')}`);
      } else {
        otaPaths.push(file);
      }
      continue;
    }

    otaPaths.push(file);
  }

  const requiresNativeApk = nativePaths.length > 0;
  return {
    otaEligible: !requiresNativeApk && (otaPaths.length > 0 || docsOrCiPaths.length === 0),
    requiresNativeApk,
    nativePaths,
    otaPaths,
    docsOrCiPaths,
    reasons,
  };
}
