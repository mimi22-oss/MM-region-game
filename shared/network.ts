/** Phase 1 protocol. No client position, gameplay or permission messages exist. */
export const PROTOCOL_VERSION = 1;
export const PRESENCE_ROOM = 'town-presence-v1';
export const MAX_PLAYERS = 8;
export const PROTOCOL_ERROR = 'protocol-error';

export type AvatarStyle = 'mint' | 'gold';
export type JoinPresence = { version: number; name: string; avatar: AvatarStyle };
export type ProtocolError = { code: 'unsupported-message' };
export type PresencePlayer = {
  sessionId: string;
  name: string;
  avatar: AvatarStyle;
  slot: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
};
export type PresenceState = {
  players: { forEach(callback: (player: PresencePlayer, id: string) => void): void };
};

/** Validate at the trust boundary, including unexpected fields. */
export function parseJoinPresence(value: unknown): JoinPresence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !['version', 'name', 'avatar'].includes(key))) return null;
  if (v.version !== PROTOCOL_VERSION || typeof v.name !== 'string') return null;
  const name = v.name.trim();
  if (!name || name.length > 24 || /[\p{Cc}\p{Cf}<>]/u.test(name)) return null;
  if (v.avatar !== 'mint' && v.avatar !== 'gold') return null;
  return { version: PROTOCOL_VERSION, name, avatar: v.avatar };
}
