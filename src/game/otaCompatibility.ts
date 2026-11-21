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

export type ContentPackKind =
  | 'core-shell'
  | 'characters'
  | 'motions'
  | 'ghost-npc'
  | 'map-region'
  | 'media';

export interface ContentPackDescriptor {
  readonly id: string;
  readonly name: string;
  readonly kind: ContentPackKind;
  readonly required: boolean;
  readonly version: string;
  readonly sha256: string;
  readonly totalBytes: number;
  readonly fileCount: number;
  readonly paths: readonly string[];
  readonly minNativeVersion: string;
  readonly maxNativeVersion?: string;
  readonly minAndroidVersionCode: number;
  readonly schemaVersion: number;
}

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
  readonly packs?: readonly ContentPackDescriptor[];
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
  readonly bundleIncludesAssets?: boolean;
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

function validateNativeCompatibilityGate(
  descriptor: {
    readonly version: string;
    readonly schemaVersion: number;
    readonly minNativeVersion: string;
    readonly maxNativeVersion?: string;
    readonly minAndroidVersionCode: number;
    readonly requiresNativeApk?: boolean;
  } | null | undefined,
  local: LocalNativeRuntimeInfo,
  label: string,
): UpdateCompatibilityResult | null {
  if (!descriptor || typeof descriptor !== 'object' || typeof descriptor.version !== 'string') {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'malformed_descriptor',
      message: `${label} is missing version metadata.`,
    };
  }

  try {
    parseSemver(descriptor.version);
    parseSemver(descriptor.minNativeVersion);
    if (descriptor.maxNativeVersion) parseSemver(descriptor.maxNativeVersion);
  } catch {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'malformed_descriptor',
      message: `Invalid semantic version in ${label.toLowerCase()} (${descriptor.version}).`,
    };
  }

  if (descriptor.schemaVersion !== local.schemaVersion) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'schema_mismatch',
      message: `OTA schema v${descriptor.schemaVersion} does not match app schema v${local.schemaVersion}; APK update required.`,
    };
  }

  if (descriptor.requiresNativeApk) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'requires_native_apk',
      message: 'This release changes native Android/Capacitor components and requires an updated APK.',
    };
  }

  if (!isVersionWithinBounds(local.nativeVersion, descriptor.minNativeVersion, descriptor.maxNativeVersion)) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'requires_native_apk',
      message: `Installed APK (${local.nativeVersion}) is outside supported native range ${descriptor.minNativeVersion}${descriptor.maxNativeVersion ? `–${descriptor.maxNativeVersion}` : '+'}.`,
    };
  }

  if (local.androidVersionCode < descriptor.minAndroidVersionCode) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: true,
      reason: 'requires_native_apk',
      message: `Installed Android versionCode ${local.androidVersionCode} is below required ${descriptor.minAndroidVersionCode}.`,
    };
  }

  return null;
}

export function checkUpdateCompatibility(
  release: ChannelReleaseDescriptor | null | undefined,
  local: LocalNativeRuntimeInfo,
  options?: { allowChannelSwitch?: boolean; allowLocalDevHttp?: boolean; allowSameVersion?: boolean },
): UpdateCompatibilityResult {
  const gateError = validateNativeCompatibilityGate(release, local, 'Update descriptor');
  if (gateError || !release) {
    return gateError!;
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
  if (cmp === 0 && release.channel === local.channel && !options?.allowSameVersion) {
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

  let normalizedPacks: ContentPackDescriptor[] | undefined;
  if (candidate.packs !== undefined) {
    if (!Array.isArray(candidate.packs)) {
      throw new Error('Asset manifest packs must be an array');
    }
    const fileMap = new Map(normalizedFiles.map((f) => [f.path, f]));
    const packIds = new Set<string>();
    normalizedPacks = [];
    for (const rawPack of candidate.packs) {
      if (!rawPack || typeof rawPack !== 'object') {
        throw new Error('Content pack entry must be an object');
      }
      const p = rawPack as Record<string, unknown>;
      if (typeof p.id !== 'string' || !p.id.trim()) {
        throw new Error('Content pack missing id');
      }
      const packId = p.id.trim();
      if (packIds.has(packId)) {
        throw new Error(`Duplicate content pack id: ${packId}`);
      }
      packIds.add(packId);
      if (typeof p.name !== 'string' || !p.name.trim()) {
        throw new Error(`Content pack "${packId}" missing name`);
      }
      if (!isValidSha256(p.sha256)) {
        throw new Error(`Content pack "${packId}" has invalid SHA-256`);
      }
      if (typeof p.version !== 'string' || !p.version.trim()) {
        throw new Error(`Content pack "${packId}" missing version`);
      }
      parseSemver(p.version);
      if (!Array.isArray(p.paths) || p.paths.length === 0) {
        throw new Error(`Content pack "${packId}" must include at least one path`);
      }
      const cleanPaths = p.paths.map((item) => {
        if (typeof item !== 'string' || !item.trim()) {
          throw new Error(`Content pack "${packId}" contains invalid path`);
        }
        const norm = normalizeAssetPath(item);
        if (!fileMap.has(norm)) {
          throw new Error(`Content pack "${packId}" references missing manifest file: ${norm}`);
        }
        return norm;
      });
      const expectedBytes = cleanPaths.reduce((acc, item) => acc + (fileMap.get(item)?.bytes ?? 0), 0);
      const declaredPackBytes = typeof p.totalBytes === 'number' ? p.totalBytes : expectedBytes;
      if (declaredPackBytes !== expectedBytes) {
        throw new Error(
          `Content pack "${packId}" totalBytes (${declaredPackBytes}) does not match file sum (${expectedBytes})`,
        );
      }
      const declaredCount = typeof p.fileCount === 'number' ? p.fileCount : cleanPaths.length;
      if (declaredCount !== cleanPaths.length) {
        throw new Error(`Content pack "${packId}" fileCount (${declaredCount}) mismatch`);
      }
      const minNative =
        typeof p.minNativeVersion === 'string' && p.minNativeVersion.trim()
          ? p.minNativeVersion.trim()
          : candidate.minNativeVersion.trim();
      parseSemver(minNative);
      if (p.maxNativeVersion !== undefined && typeof p.maxNativeVersion !== 'string') {
        throw new Error(`Content pack "${packId}" maxNativeVersion must be a string`);
      }
      if (typeof p.maxNativeVersion === 'string') {
        parseSemver(p.maxNativeVersion);
      }
      const minCode =
        typeof p.minAndroidVersionCode === 'number' && Number.isInteger(p.minAndroidVersionCode)
          ? p.minAndroidVersionCode
          : candidate.minAndroidVersionCode;
      normalizedPacks.push({
        id: packId,
        name: p.name.trim(),
        kind: (typeof p.kind === 'string' ? p.kind : 'media') as ContentPackKind,
        required: Boolean(p.required),
        version: p.version.trim(),
        sha256: p.sha256.toLowerCase(),
        totalBytes: expectedBytes,
        fileCount: cleanPaths.length,
        paths: cleanPaths,
        minNativeVersion: minNative,
        ...(typeof p.maxNativeVersion === 'string' ? { maxNativeVersion: p.maxNativeVersion.trim() } : {}),
        minAndroidVersionCode: minCode,
        schemaVersion:
          typeof p.schemaVersion === 'number' ? p.schemaVersion : candidate.schemaVersion,
      });
    }
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
    ...(normalizedPacks ? { packs: normalizedPacks } : {}),
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

function formatDatasetLabel(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function classifyContentPack(relativePath: string): {
  packId: string;
  name: string;
  kind: ContentPackKind;
  required: boolean;
} {
  const clean = normalizeAssetPath(relativePath);
  const lower = clean.toLowerCase();

  if (lower === 'models/ghost-woman.glb' || lower.startsWith('motions/ghost/')) {
    return {
      packId: 'npc-ghost',
      name: 'Ghost NPC Pack',
      kind: 'ghost-npc',
      required: true,
    };
  }

  if (
    lower.startsWith('models/') ||
    /^assets\/(boy|girl)-[a-z0-9_-]+\.glb$/.test(lower)
  ) {
    return {
      packId: 'characters-core',
      name: 'Characters & Avatars Pack',
      kind: 'characters',
      required: true,
    };
  }

  if (lower.startsWith('motions/')) {
    return {
      packId: 'motions-shared',
      name: 'Shared Motion Library',
      kind: 'motions',
      required: false,
    };
  }

  if (lower.startsWith('map/')) {
    const parts = lower.split('/');
    const datasetSlug = parts.length >= 3 && parts[1] ? parts[1] : '';
    if (datasetSlug) {
      return {
        packId: `region-${datasetSlug}`,
        name: `${formatDatasetLabel(datasetSlug)} Map Pack`,
        kind: 'map-region',
        required: false,
      };
    }
    return {
      packId: 'map-shared',
      name: 'Shared Map Pack',
      kind: 'map-region',
      required: true,
    };
  }

  return {
    packId: 'core-shell',
    name: 'Core App Shell',
    kind: 'core-shell',
    required: true,
  };
}

export function serializeContentPackDigestInput(entries: readonly VersionedAssetEntry[]): Uint8Array {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const text = sorted.map((e) => `${e.path}:${e.sha256.toLowerCase()}:${e.bytes}`).join('\n');
  return new TextEncoder().encode(text);
}

export async function buildContentPacks(
  files: readonly VersionedAssetEntry[],
  meta: {
    version: string;
    schemaVersion: number;
    minNativeVersion: string;
    maxNativeVersion?: string;
    minAndroidVersionCode: number;
  },
  hashBytes: (bytes: Uint8Array) => Promise<string> | string,
): Promise<ContentPackDescriptor[]> {
  const buckets = new Map<
    string,
    {
      meta: { packId: string; name: string; kind: ContentPackKind; required: boolean };
      entries: VersionedAssetEntry[];
      totalBytes: number;
    }
  >();

  for (const entry of files) {
    const info = classifyContentPack(entry.path);
    let bucket = buckets.get(info.packId);
    if (!bucket) {
      bucket = { meta: info, entries: [], totalBytes: 0 };
      buckets.set(info.packId, bucket);
    }
    bucket.entries.push(entry);
    bucket.totalBytes += entry.bytes;
  }

  const order: Record<ContentPackKind, number> = {
    'core-shell': 0,
    characters: 1,
    'ghost-npc': 2,
    motions: 3,
    'map-region': 4,
    media: 5,
  };

  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => {
    const kindDiff = order[a.meta.kind] - order[b.meta.kind];
    return kindDiff !== 0 ? kindDiff : a.meta.packId.localeCompare(b.meta.packId);
  });

  const descriptors: ContentPackDescriptor[] = [];
  for (const bucket of sortedBuckets) {
    const digestInput = serializeContentPackDigestInput(bucket.entries);
    const sha256 = (await hashBytes(digestInput)).toLowerCase();
    const paths = bucket.entries.map((e) => e.path).sort();
    descriptors.push({
      id: bucket.meta.packId,
      name: bucket.meta.name,
      kind: bucket.meta.kind,
      required: bucket.meta.required,
      version: meta.version,
      sha256,
      totalBytes: bucket.totalBytes,
      fileCount: bucket.entries.length,
      paths,
      minNativeVersion: meta.minNativeVersion,
      ...(meta.maxNativeVersion ? { maxNativeVersion: meta.maxNativeVersion } : {}),
      minAndroidVersionCode: meta.minAndroidVersionCode,
      schemaVersion: meta.schemaVersion,
    });
  }
  return descriptors;
}

export function checkContentPackCompatibility(
  pack: ContentPackDescriptor | null | undefined,
  local: LocalNativeRuntimeInfo,
  installedPackVersion?: string | null,
): UpdateCompatibilityResult {
  const gateError = validateNativeCompatibilityGate(
    pack,
    local,
    pack?.id ? `Content pack "${pack.id}" descriptor` : 'Content pack descriptor',
  );
  if (gateError || !pack) {
    return gateError!;
  }

  if (!isValidSha256(pack.sha256)) {
    return {
      compatible: false,
      updateAvailable: false,
      requiresNativeApk: false,
      reason: 'invalid_checksum',
      message: `Pack "${pack.id}" checksum failed SHA-256 format validation.`,
    };
  }

  if (installedPackVersion) {
    const cmp = compareSemver(pack.version, installedPackVersion);
    if (cmp === 0) {
      return {
        compatible: true,
        updateAvailable: false,
        requiresNativeApk: false,
        reason: 'up_to_date',
        message: `Pack "${pack.name}" is already cached at v${installedPackVersion}.`,
      };
    }
    if (cmp < 0) {
      return {
        compatible: false,
        updateAvailable: false,
        requiresNativeApk: false,
        reason: 'downgrade_blocked',
        message: `Refusing pack downgrade for "${pack.id}" (${installedPackVersion} -> ${pack.version}).`,
      };
    }
  }

  return {
    compatible: true,
    updateAvailable: true,
    requiresNativeApk: false,
    reason: 'compatible',
    message: `Pack "${pack.name}" v${pack.version} compatible.`,
  };
}
