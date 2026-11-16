import { CONTRACT_SCHEMA_VERSIONS, type AuthorityOwner } from './ids.ts';

export type NetworkDomainName =
  | 'presence'
  | 'movement'
  | 'ghost-ai'
  | 'combat'
  | 'war'
  | 'social-chat'
  | 'party'
  | 'shop-catalog'
  | 'orders'
  | 'inventory'
  | 'delivery'
  | 'world-edit-shared';

export interface DomainAuthorityPolicy {
  readonly domain: NetworkDomainName;
  readonly authoritativeOwner: Extract<AuthorityOwner, 'server-authoritative'>;
  readonly clientRole: 'client-intent' | 'read-only-mirror';
  readonly offlinePolicy: 'disallowed-for-settlement' | 'local-sandbox-only';
  readonly requiresIdempotencyKey: boolean;
}

/**
 * Authoritative boundary matrix binding client & Colyseus/REST backends.
 * Offline single-player may simulate locally, never mint authoritative server outcomes.
 */
export const DOMAIN_AUTHORITY_MATRIX: Readonly<Record<NetworkDomainName, DomainAuthorityPolicy>> = {
  presence: {
    domain: 'presence',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'local-sandbox-only',
    requiresIdempotencyKey: false,
  },
  movement: {
    domain: 'movement',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'local-sandbox-only',
    requiresIdempotencyKey: false,
  },
  'ghost-ai': {
    domain: 'ghost-ai',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'read-only-mirror',
    offlinePolicy: 'local-sandbox-only',
    requiresIdempotencyKey: false,
  },
  combat: {
    domain: 'combat',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: false,
  },
  war: {
    domain: 'war',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: false,
  },
  'social-chat': {
    domain: 'social-chat',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: true,
  },
  party: {
    domain: 'party',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: true,
  },
  'shop-catalog': {
    domain: 'shop-catalog',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'read-only-mirror',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: false,
  },
  orders: {
    domain: 'orders',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: true,
  },
  inventory: {
    domain: 'inventory',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'read-only-mirror',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: true,
  },
  delivery: {
    domain: 'delivery',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'disallowed-for-settlement',
    requiresIdempotencyKey: true,
  },
  'world-edit-shared': {
    domain: 'world-edit-shared',
    authoritativeOwner: 'server-authoritative',
    clientRole: 'client-intent',
    offlinePolicy: 'local-sandbox-only',
    requiresIdempotencyKey: true,
  },
};

export interface AuthSessionClaimsV2 {
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSIONS.networkAuthoritative;
  readonly accountId: string;
  readonly role: 'player' | 'moderator' | 'admin';
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

export interface ClientIntentEnvelope<TType extends string = string, TPayload = unknown> {
  readonly protocolVersion: typeof CONTRACT_SCHEMA_VERSIONS.networkAuthoritative;
  readonly domain: NetworkDomainName;
  readonly type: TType;
  readonly seq: number;
  readonly clientTimeMs: number;
  readonly idempotencyKey?: string;
  readonly payload: TPayload;
}

export interface ServerSnapshotEnvelope<TState = unknown> {
  readonly protocolVersion: typeof CONTRACT_SCHEMA_VERSIONS.networkAuthoritative;
  readonly serverTick: number;
  readonly serverTimeMs: number;
  readonly cellId: string;
  readonly authoritative: true;
  readonly state: TState;
}

const FORBIDDEN_CLIENT_AUTHORITY_KEYS = new Set([
  'price',
  'unitPrice',
  'unit_price',
  'totalPrice',
  'stock',
  'balance',
  'damage',
  'hp',
  'isAdmin',
  'role',
  'authoritative',
  'ownerOverride',
]);

function hasForbiddenAuthorityField(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 6) return false;
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenAuthorityField(item, depth + 1));
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CLIENT_AUTHORITY_KEYS.has(k)) return true;
    if (hasForbiddenAuthorityField(v, depth + 1)) return true;
  }
  return false;
}

/**
 * Trust-boundary parser for future Phase 5+ client intents:
 * rejects mismatched protocol versions, missing idempotency keys on mutating commerce/delivery domains,
 * and client-supplied authoritative fields (prices, balances, damage, admin roles).
 */
export function parseClientIntentEnvelope<TPayload = unknown>(
  value: unknown,
): ClientIntentEnvelope<string, TPayload> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.protocolVersion !== CONTRACT_SCHEMA_VERSIONS.networkAuthoritative) return null;
  if (typeof v.domain !== 'string' || !(v.domain in DOMAIN_AUTHORITY_MATRIX)) return null;
  const policy = DOMAIN_AUTHORITY_MATRIX[v.domain as NetworkDomainName];
  if (policy.clientRole !== 'client-intent') return null;
  if (typeof v.type !== 'string' || !/^[a-z0-9:._-]{2,64}$/i.test(v.type)) return null;
  if (!Number.isSafeInteger(v.seq) || (v.seq as number) < 0) return null;
  if (typeof v.clientTimeMs !== 'number' || !Number.isFinite(v.clientTimeMs)) return null;
  if (policy.requiresIdempotencyKey) {
    if (typeof v.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(v.idempotencyKey)) {
      return null;
    }
  }
  if (v.payload === undefined || hasForbiddenAuthorityField(v.payload)) return null;
  return {
    protocolVersion: CONTRACT_SCHEMA_VERSIONS.networkAuthoritative,
    domain: policy.domain,
    type: v.type,
    seq: v.seq as number,
    clientTimeMs: v.clientTimeMs,
    ...(typeof v.idempotencyKey === 'string' ? { idempotencyKey: v.idempotencyKey } : {}),
    payload: v.payload as TPayload,
  };
}
