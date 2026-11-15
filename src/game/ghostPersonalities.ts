import {DEFAULT_GHOST_AI_CONFIG,type GhostAiConfig} from './ghostConfig.ts';
export type GhostPersonalityId='hunter'|'ambusher'|'stalker';
export const GHOST_PERSONALITIES={
 hunter:{id:'hunter',label:'Aggressive Hunter',detectRadiusM:25,chaseSpeedMps:4.2,acceleration:6,observeSec:0,giveUpDistance:45},
 ambusher:{id:'ambusher',label:'Close Ambusher',detectRadiusM:5,chaseSpeedMps:4.8,acceleration:14,observeSec:0,giveUpDistance:20},
 stalker:{id:'stalker',label:'Medium-Range Stalker',detectRadiusM:12,chaseSpeedMps:3.8,acceleration:5,observeSec:.65,giveUpDistance:32},
} as const;
export function ghostPersonalityForId(id:string){const n=Number(id.match(/(\d+)$/)?.[1]??1);return (['hunter','ambusher','stalker'] as const)[Math.max(0,n-1)%3];}
export function createGhostPersonalityConfig(id:GhostPersonalityId):GhostAiConfig{
 const p=GHOST_PERSONALITIES[id];return {...DEFAULT_GHOST_AI_CONFIG,detectRadiusM:p.detectRadiusM,closeScareRadiusM:Math.min(3,p.detectRadiusM),loseSightRadiusM:p.giveUpDistance,chaseGiveUpDistanceM:p.giveUpDistance,chaseSpeedMps:p.chaseSpeedMps,
  chaseAccelerationMps2:p.acceleration,observeBeforeChaseSec:p.observeSec,maxChaseDurationSec:45,grabRangeM:1.65,grabHoldDurationSec:id==='ambusher'?.65:1.05};
}
export const PLAYER_ON_FOOT_SPEED={walk:3.2,run:9.5} as const;
