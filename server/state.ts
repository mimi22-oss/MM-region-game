import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import type { AvatarStyle, PresencePlayer } from '../shared/network.ts';

export class PlayerPresence extends Schema implements PresencePlayer {
  // Native Node type stripping keeps class fields. `declare` plus assignment
  // preserves Schema's tracked setters instead of shadowing them with fields.
  declare sessionId: string;
  declare name: string;
  declare avatar: AvatarStyle;
  declare slot: number;
  declare x: number;
  declare y: number;
  declare z: number;
  declare yaw: number;
  constructor() {
    super();
    Object.assign(this, { sessionId: '', name: '', avatar: 'mint', slot: 0, x: 0, y: 0, z: 0, yaw: 0 });
  }
}
defineTypes(PlayerPresence, {
  sessionId: 'string', name: 'string', avatar: 'string', slot: 'uint8',
  x: 'float64', y: 'float64', z: 'float64', yaw: 'float64',
});

export class TownPresenceState extends Schema {
  declare players: MapSchema<PlayerPresence>;
  constructor() {
    super();
    this.players = new MapSchema<PlayerPresence>();
  }
}
defineTypes(TownPresenceState, { players: { map: PlayerPresence } });

export class TownAuthoritativeMetaState extends Schema {
  declare protocolVersion: number;
  declare serverTick: number;
  declare onlineCount: number;
  declare avgTickMs: number;
  constructor() {
    super();
    Object.assign(this, { protocolVersion: 2, serverTick: 0, onlineCount: 0, avgTickMs: 0 });
  }
}
defineTypes(TownAuthoritativeMetaState, {
  protocolVersion: 'uint8',
  serverTick: 'uint32',
  onlineCount: 'uint16',
  avgTickMs: 'float32',
});
