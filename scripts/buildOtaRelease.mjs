import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DEFAULT_OTA_BASE_URL, parseSemver } from '../src/game/otaCompatibility.ts';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const base = parseSemver(pkg.version);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const revision = Number(git('log', '-1', '--format=%ct'));
if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Could not resolve the Git release revision');

const channel = process.env.OTA_CHANNEL ?? (process.env.VERCEL_ENV === 'preview' ? 'staging' : 'production');
if (channel !== 'production' && channel !== 'staging') throw new Error(`Unknown OTA channel: ${channel}`);
const version = process.env.OTA_VERSION ?? `${base.major}.${base.minor}.${Math.max(base.patch, revision)}${channel === 'staging' ? '-staging' : ''}`;
parseSemver(version);

const baseUrl = process.env.OTA_BASE_URL ?? (channel === 'staging' && process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : DEFAULT_OTA_BASE_URL);
if (new URL(baseUrl).protocol !== 'https:') throw new Error('Hosted OTA releases need an HTTPS origin');

const runNode = (script, args = [], env = process.env) => execFileSync(process.execPath, ['--experimental-strip-types', script, ...args], { env, stdio: 'inherit' });
const nativeChange = process.env.OTA_REQUIRES_NATIVE_APK ?? JSON.parse(execFileSync(process.execPath, [
  '--experimental-strip-types', 'scripts/classifyGitChanges.mjs', '--head', commit,
], { encoding: 'utf8' })).requiresNativeApk;

const gradle = readFileSync('android/app/build.gradle', 'utf8');
const nativeVersionCode = /^\s*versionCode\s+(\d+)\b/m.exec(gradle)?.[1];
const nativeVersion = /^\s*versionName\s+["']([^"']+)["']/m.exec(gradle)?.[1];
if (!nativeVersionCode || !nativeVersion) throw new Error('Could not read the Android release version from build.gradle');

runNode(process.env.npm_execpath, ['run', 'build'], {
  ...process.env,
  VITE_APP_VERSION: version,
  VITE_OTA_CHANNEL: channel,
  VITE_OTA_BASE_URL: baseUrl,
});
runNode('scripts/generateOtaArtifacts.mjs', [
  '--channel', channel, '--version', version, '--commit', commit, '--base-url', baseUrl,
  '--host-bundle', '--requires-native-apk', String(nativeChange),
  '--min-android-version-code', nativeVersionCode, '--min-native-version', nativeVersion,
]);
runNode('scripts/verifyOtaArtifacts.mjs', [
  '--channel', channel, '--native-version', nativeVersion, '--android-version-code', nativeVersionCode,
]);
