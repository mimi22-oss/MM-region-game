import { Room, ServerError, type Client } from '@colyseus/core';
import { MAX_PLAYERS, PROTOCOL_ERROR, parseJoinPresence, type ProtocolError } from '../shared/network.ts';
import { PlayerPresence, TownPresenceState } from './state.ts';

/** Fixed presence anchors near the authored Myothar spawn; not movement state.
 * Kept here to avoid importing browser singletons or eager map barrels on the server.
 * Replace with validated spawn data when authoritative simulation is introduced.
 */
export function presenceSpawn(slot: number) {
  const yaw = Math.PI * .75;
  const right = (slot % 4 - 1.5) * 1.4;
  const forward = 2 + Math.floor(slot / 4) * 1.4;
  return {
    x: 139.86572131869906 + Math.cos(yaw) * right - Math.sin(yaw) * forward,
    y: .012,
    z: 239.14351339729038 - Math.sin(yaw) * right - Math.cos(yaw) * forward,
    yaw,
  };
}

export class TownPresenceRoom extends Room<{ state: TownPresenceState }> {
  maxClients = MAX_PLAYERS;
  maxMessagesPerSecond = 10;

  onCreate() {
    this.setState(new TownPresenceState());
    this.setPatchRate(100);
    // No gameplay command is accepted in Phase 1, even from a modified client.
    this.onMessage('*', client => {
      const error: ProtocolError = { code: 'unsupported-message' };
      client.send(PROTOCOL_ERROR, error);
    });
  }

  onAuth(_client: Client, options: unknown) {
    const profile = parseJoinPresence(options);
    if (!profile) throw new ServerError(400, 'Invalid presence profile or protocol version');
    return profile; // Guest profile validation, not account authentication.
  }

  onJoin(client: Client) {
    const occupied = new Set<number>();
    this.state.players.forEach(player => occupied.add(player.slot));
    let slot = 0;
    while (occupied.has(slot)) slot++;
    const player = new PlayerPresence();
    Object.assign(player, presenceSpawn(slot), {
      sessionId: client.sessionId, name: client.auth.name, avatar: client.auth.avatar, slot,
    });
    this.state.players.set(client.sessionId, player);
  }

  onDrop(client: Client) { this.state.players.delete(client.sessionId); }
  onLeave(client: Client) { this.state.players.delete(client.sessionId); }
}
