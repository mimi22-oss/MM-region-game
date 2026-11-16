import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CONTRACT_SCHEMA_VERSIONS,
  type AuthSessionClaimsV2,
  type AuthoritativeAvatarStyle,
} from '../shared/contracts/index.ts';

export interface VerifiedSessionAuth extends AuthSessionClaimsV2 {
  readonly displayName: string;
  readonly avatar: AuthoritativeAvatarStyle;
}

const DEFAULT_DEV_SECRET = 'mm-region-dev-session-secret-change-in-prod';
const HEADER_B64 = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'MM-SESSION-V2' }),
  'utf8',
).toString('base64url');

export function resolveAuthSecret(explicitSecret?: string): string {
  const secret = (explicitSecret ?? process.env.MM_SESSION_SECRET ?? DEFAULT_DEV_SECRET).trim();
  if (secret.length < 16) {
    throw new Error('MM_SESSION_SECRET must be at least 16 characters');
  }
  return secret;
}

export function sanitizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 24 || /[\p{Cc}\p{Cf}<>]/u.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function isValidAccountId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

/** Issues an HMAC-SHA256 signed session token bound to accountId, role, and expiry. */
export function issueSessionToken(
  secret: string,
  input: {
    accountId: string;
    displayName: string;
    role?: 'player' | 'moderator' | 'admin';
    avatar?: AuthoritativeAvatarStyle;
    ttlMs?: number;
  },
  nowMs: number = Date.now(),
): string {
  const validName = sanitizeDisplayName(input.displayName);
  if (!validName || !isValidAccountId(input.accountId)) {
    throw new Error('Invalid session accountId or displayName');
  }
  const ttlMs = Math.max(1000, Math.min(24 * 60 * 60 * 1000, input.ttlMs ?? 60 * 60 * 1000));
  const payload = {
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.networkAuthoritative,
    accountId: input.accountId,
    displayName: validName,
    role: input.role ?? 'player',
    avatar: input.avatar === 'gold' ? 'gold' : 'mint',
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signingInput = `${HEADER_B64}.${payloadB64}`;
  const sigB64 = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sigB64}`;
}

/** Never accepts client-supplied admin roles; guest issuance always assigns `'player'`. */
export function issueGuestSessionToken(
  secret: string,
  rawName: unknown,
  avatar?: unknown,
  accountId: string = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  nowMs: number = Date.now(),
): { token: string; claims: VerifiedSessionAuth } {
  const displayName = sanitizeDisplayName(rawName);
  if (!displayName) {
    throw new Error('Invalid guest player displayName');
  }
  const safeAvatar: AuthoritativeAvatarStyle = avatar === 'gold' ? 'gold' : 'mint';
  const ttlMs = 60 * 60 * 1000;
  const token = issueSessionToken(
    secret,
    { accountId, displayName, role: 'player', avatar: safeAvatar, ttlMs },
    nowMs,
  );
  return {
    token,
    claims: {
      schemaVersion: CONTRACT_SCHEMA_VERSIONS.networkAuthoritative,
      accountId,
      displayName,
      role: 'player',
      avatar: safeAvatar,
      issuedAtMs: nowMs,
      expiresAtMs: nowMs + ttlMs,
    },
  };
}

export function verifySessionToken(
  secret: string,
  token: string,
  nowMs: number = Date.now(),
): VerifiedSessionAuth | null {
  if (typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (headerB64 !== HEADER_B64 || !payloadB64 || !sigB64) return null;

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', secret).update(signingInput).digest();
  let suppliedSig: Buffer;
  try {
    suppliedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (suppliedSig.length !== expectedSig.length || !timingSafeEqual(suppliedSig, expectedSig)) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.schemaVersion !== CONTRACT_SCHEMA_VERSIONS.networkAuthoritative) return null;
  if (!isValidAccountId(parsed.accountId)) return null;
  const displayName = sanitizeDisplayName(parsed.displayName);
  if (!displayName) return null;
  if (parsed.role !== 'player' && parsed.role !== 'moderator' && parsed.role !== 'admin') {
    return null;
  }
  const avatar: AuthoritativeAvatarStyle = parsed.avatar === 'gold' ? 'gold' : 'mint';
  if (typeof parsed.issuedAtMs !== 'number' || typeof parsed.expiresAtMs !== 'number') return null;
  if (!Number.isFinite(parsed.issuedAtMs) || !Number.isFinite(parsed.expiresAtMs)) return null;
  if (parsed.issuedAtMs > nowMs + 60_000) return null;
  if (parsed.expiresAtMs <= nowMs) return null;

  return {
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.networkAuthoritative,
    accountId: parsed.accountId,
    displayName,
    role: parsed.role,
    avatar,
    issuedAtMs: parsed.issuedAtMs,
    expiresAtMs: parsed.expiresAtMs,
  };
}
