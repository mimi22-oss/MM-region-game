import type { AuthorityOwner } from '../../shared/contracts/index.ts';
import { farmhouse } from '../data/ward.ts';
import { PLAYER_OWNER, homeOwnership, ownsHome } from './homeAccess.ts';
import type { LayoutFeature, WorldLayout } from './worldLayout.ts';

export type MapRole = 'admin' | 'user';
export type MapPortalTool = 'editor' | 'geojson';

export interface MapAccessContext {
  role: MapRole;
  actorId: string;
  ownedHouseIds: string[];
}

export const MAP_ACCESS_STORAGE_KEY = 'mm-map-access-role-v1';

/**
 * Builds a MapAccessContext combining static homeOwnership records (such as the player's
 * farmhouse) and any extra owned house IDs supplied by session/auth state.
 */
export function createMapAccessContext(
  role: MapRole = 'admin',
  actorId: string = PLAYER_OWNER,
  extraOwnedIds: string[] = [],
): MapAccessContext {
  const ownedSet = new Set<string>(extraOwnedIds);
  for (const [houseId, ownerId] of Object.entries(homeOwnership)) {
    if (ownerId === actorId) ownedSet.add(houseId);
  }
  if (actorId === PLAYER_OWNER && farmhouse?.id) {
    ownedSet.add(farmhouse.id);
  }
  return {
    role,
    actorId,
    ownedHouseIds: [...ownedSet],
  };
}

export function getStoredMapRole(): MapRole {
  try {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('role');
      if (param === 'admin' || param === 'user') return param;
      const saved = window.localStorage?.getItem(MAP_ACCESS_STORAGE_KEY);
      if (saved === 'admin' || saved === 'user') return saved;
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return 'admin';
}

export function setStoredMapRole(role: MapRole): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(MAP_ACCESS_STORAGE_KEY, role);
    }
  } catch {
    // Ignore storage write errors
  }
}

export function canOpenMapTool(tool: MapPortalTool, ctx: MapAccessContext): boolean {
  if (ctx.role === 'admin') return true;
  return tool === 'editor';
}

export function isOwnHomeFeature(
  feature: Pick<LayoutFeature, 'id' | 'kind' | 'metadata'>,
  ctx: MapAccessContext,
): boolean {
  if (ctx.ownedHouseIds.includes(feature.id)) return true;
  if (ownsHome(feature.id, ctx.actorId)) return true;

  const sourceId = typeof feature.metadata?.sourceId === 'string' ? feature.metadata.sourceId : undefined;
  if (sourceId && (ctx.ownedHouseIds.includes(sourceId) || ownsHome(sourceId, ctx.actorId))) {
    return true;
  }

  const ownerId = typeof feature.metadata?.ownerId === 'string' ? feature.metadata.ownerId : undefined;
  if (ownerId && ownerId === ctx.actorId && feature.kind === 'house') {
    return true;
  }

  return false;
}

export function canEditMapFeature(
  feature: Pick<LayoutFeature, 'id' | 'kind' | 'metadata'>,
  ctx: MapAccessContext,
): boolean {
  if (ctx.role === 'admin') return true;
  return isOwnHomeFeature(feature, ctx);
}

export function canCreateMapFeature(ctx: MapAccessContext): boolean {
  return ctx.role === 'admin';
}

export function canDeleteMapFeature(
  _feature: Pick<LayoutFeature, 'id' | 'kind' | 'metadata'>,
  ctx: MapAccessContext,
): boolean {
  return ctx.role === 'admin';
}

export function canImportOrModifyRegion(ctx: MapAccessContext): boolean {
  return ctx.role === 'admin';
}

export function canEditAssetLibrary(ctx: MapAccessContext): boolean {
  return ctx.role === 'admin';
}

/**
 * Defense-in-depth layout filter: ensures non-admin users can only modify properties
 * of their own home feature and cannot mutate region metadata, add features,
 * delete features, or alter roads, wards, neighbors, or public landmarks.
 */
export function filterPermittedLayoutChanges(
  nextLayout: WorldLayout,
  prevLayout: WorldLayout,
  ctx: MapAccessContext,
): { layout: WorldLayout; blockedCount: number } {
  if (ctx.role === 'admin') {
    return { layout: nextLayout, blockedCount: 0 };
  }

  let blockedCount = 0;
  const prevById = new Map(prevLayout.features.map((f) => [f.id, f]));
  const nextById = new Map(nextLayout.features.map((f) => [f.id, f]));

  if (nextLayout.name !== prevLayout.name) {
    blockedCount++;
  }

  const prevDeleted = prevLayout.deletedSourceIds ?? [];
  const nextDeleted = nextLayout.deletedSourceIds ?? [];
  if (
    prevDeleted.length !== nextDeleted.length ||
    prevDeleted.some((id, i) => nextDeleted[i] !== id)
  ) {
    blockedCount++;
  }

  // Reject unauthorized new features added by non-admin
  for (const candidate of nextLayout.features) {
    if (!prevById.has(candidate.id)) {
      blockedCount++;
    }
  }

  // Keep prev feature ordering and reject unauthorized edits/deletions
  const sanitizedFeatures: LayoutFeature[] = [];
  for (const prevFeature of prevLayout.features) {
    const nextFeature = nextById.get(prevFeature.id);
    if (!nextFeature) {
      // Deletion is blocked for non-admin
      blockedCount++;
      sanitizedFeatures.push(prevFeature);
      continue;
    }

    if (canEditMapFeature(prevFeature, ctx)) {
      // Preserve immutable identity/ownership metadata even on own home edits
      sanitizedFeatures.push({
        ...nextFeature,
        id: prevFeature.id,
        kind: prevFeature.kind,
        metadata: prevFeature.metadata,
      });
    } else {
      if (JSON.stringify(nextFeature) !== JSON.stringify(prevFeature)) {
        blockedCount++;
      }
      sanitizedFeatures.push(prevFeature);
    }
  }

  return {
    layout: {
      ...prevLayout,
      features: sanitizedFeatures,
      deletedSourceIds: prevLayout.deletedSourceIds,
    },
    blockedCount,
  };
}

/**
 * Trust boundary adapter: preserves offline `'admin'` convenience ONLY in local single-player.
 * Connected authoritative worlds require an authenticated server role claim (`admin`), defaulting
 * otherwise to `'user'` regardless of local URL/storage settings.
 */
export function resolveEffectiveMapRole(
  ctx: MapAccessContext,
  authorityMode: Extract<AuthorityOwner, 'local-offline' | 'server-authoritative'>,
  serverClaimRole?: 'player' | 'moderator' | 'admin',
): MapRole {
  if (authorityMode === 'local-offline') {
    return ctx.role;
  }
  return serverClaimRole === 'admin' ? 'admin' : 'user';
}

export type ActiveAuthoritySession = Readonly<{
  mode: Extract<AuthorityOwner, 'local-offline' | 'server-authoritative'>;
  serverRole?: 'player' | 'moderator' | 'admin';
}>;

let activeAuthorityMode: Extract<AuthorityOwner, 'local-offline' | 'server-authoritative'> = 'local-offline';
let activeServerClaimRole: 'player' | 'moderator' | 'admin' | undefined;
let activeAuthoritySnapshot: ActiveAuthoritySession = Object.freeze({
  mode: activeAuthorityMode,
  serverRole: activeServerClaimRole,
});
const authorityListeners = new Set<() => void>();

export function setActiveAuthoritySession(
  mode: Extract<AuthorityOwner, 'local-offline' | 'server-authoritative'>,
  serverRole?: 'player' | 'moderator' | 'admin',
): void {
  const nextRole = mode === 'server-authoritative' ? serverRole : undefined;
  if (activeAuthorityMode === mode && activeServerClaimRole === nextRole) return;
  activeAuthorityMode = mode;
  activeServerClaimRole = nextRole;
  activeAuthoritySnapshot = Object.freeze({
    mode: activeAuthorityMode,
    serverRole: activeServerClaimRole,
  });
  authorityListeners.forEach((fn) => fn());
}

export function getActiveAuthoritySession(): ActiveAuthoritySession {
  return activeAuthoritySnapshot;
}

export function subscribeAuthoritySession(listener: () => void): () => void {
  authorityListeners.add(listener);
  return () => authorityListeners.delete(listener);
}

export function resolveCurrentMapAccessContext(ctx: MapAccessContext): MapAccessContext {
  const effectiveRole = resolveEffectiveMapRole(ctx, activeAuthorityMode, activeServerClaimRole);
  if (effectiveRole === ctx.role) return ctx;
  return { ...ctx, role: effectiveRole };
}
