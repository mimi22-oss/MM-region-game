import type { HorrorPreset } from '../ghostAudio.ts';
export type HauntedBand = 'outside' | 'distant' | 'uneasy' | 'near' | 'encounter';
export interface HauntedZoneConfig {
  distances: readonly [number, number, number, number];
  hysteresis: number;
  maxOverlap: number;
  silenceSec: number;
  laughCooldownSec: number;
  screamCooldownSec: number;
}
export const DEFAULT_HAUNTED_ZONE_CONFIG: HauntedZoneConfig = {
  distances: [60, 40, 20, 8], hysteresis: 2, maxOverlap: 2,
  silenceSec: 2.5, laughCooldownSec: 24, screamCooldownSec: 50,
};
const bands: HauntedBand[] = ['outside', 'distant', 'uneasy', 'near', 'encounter'];
export function hauntedBand(distance: number, previous: HauntedBand, config = DEFAULT_HAUNTED_ZONE_CONFIG): HauntedBand {
  if (!Number.isFinite(distance)) return 'outside';
  let index = bands.indexOf(previous);
  while (index < 4 && distance <= config.distances[index]) index++;
  while (index > 0 && distance > config.distances[index - 1] + config.hysteresis) index--;
  return bands[index];
}
export function hauntedGain(distance: number, radius = 60) {
  const x = Math.max(0, Math.min(1, (radius - distance) / 15));
  return x * x * (3 - 2 * x);
}
interface Choice { preset: HorrorPreset; weight: number; kind: 'warehouse' | 'tree' }
const distant: Choice[] = [
  {preset:'warehouse_creak',weight:4,kind:'warehouse'}, {preset:'metal_knock',weight:2,kind:'warehouse'},
  {preset:'tree_rustle',weight:5,kind:'tree'}, {preset:'horror_drone',weight:2,kind:'warehouse'},
];
const uneasy: Choice[] = [...distant, {preset:'wood_crack',weight:4,kind:'warehouse'},
  {preset:'ghost_evil_laugh',weight:2,kind:'warehouse'}, {preset:'ghost_footsteps',weight:3,kind:'warehouse'}];
const near: Choice[] = [...uneasy, {preset:'ghost_whisper',weight:6,kind:'warehouse'}, {preset:'warehouse_scrape',weight:3,kind:'warehouse'},
  {preset:'ghost_sudden_scream',weight:1,kind:'warehouse'}, {preset:'warehouse_creak',weight:3,kind:'warehouse'}];
/** Pure simulation clock + seeded PRNG. No timers, audio graph or ghost AI mutations. */
export class GhostAudioEventScheduler {
  private seed: number;
  private time = 0;
  private due = 0;
  private laughAt = -Infinity;
  private screamAt = -Infinity;
  private lastPreset: HorrorPreset | null = null;
  private lastOrigin = '';
  band: HauntedBand = 'outside';
  readonly config:HauntedZoneConfig;
  constructor(seed = 3514936176, config = DEFAULT_HAUNTED_ZONE_CONFIG) {
    this.config=config;
    this.seed = seed >>> 0; this.defer();
  }
  private random() { this.seed = (Math.imul(this.seed,1664525)+1013904223)>>>0; return this.seed/4294967296; }
  private defer() {
    const range = (this.band==='near'||this.band==='encounter') ? [4,8] : this.band==='uneasy' ? [7,13] : [10,18];
    this.due=this.time+range[0]+this.random()*(range[1]-range[0]);
  }
  tick(dt:number, distance:number, enabled:boolean, activeVoices:number, _encounterBusy=false): Choice | null {
    this.time += Math.max(0, Math.min(Number.isFinite(dt)?dt:0, .5));
    const previous=this.band;
    this.band = enabled ? hauntedBand(distance,this.band,this.config) : 'outside';
    if(this.band==='outside') {this.defer();return null;}
    if(previous==='outside')this.due=this.time+1+this.random()*2;
    else if(previous!==this.band)this.due=Math.min(this.due,this.time+3+this.random()*3);
    if(this.time<this.due)return null;
    if(activeVoices>=this.config.maxOverlap){this.due=this.time+this.config.silenceSec;return null;}
    const pool=(this.band==='near'||this.band==='encounter')?near:this.band==='uneasy'?uneasy:distant;
    const choices=pool.filter(c=>c.preset!==this.lastPreset&&
      (c.preset!=='ghost_evil_laugh'||this.time-this.laughAt>=this.config.laughCooldownSec)&&
      (c.preset!=='ghost_sudden_scream'||this.time-this.screamAt>=this.config.screamCooldownSec));
    let roll=this.random()*choices.reduce((sum,c)=>sum+c.weight,0),choice=choices[choices.length-1];
    for(const candidate of choices){roll-=candidate.weight;if(roll<0){choice=candidate;break;}}
    if(!choice){this.defer();return null;}
    if(choice.preset==='ghost_evil_laugh')this.laughAt=this.time;
    if(choice.preset==='ghost_sudden_scream')this.screamAt=this.time;
    this.lastPreset=choice.preset;this.defer();
    // Longest preset is four seconds; reserve its tail plus a quiet gap.
    this.due=Math.max(this.due,this.time+4.1+this.config.silenceSec);
    return choice;
  }
  variation(){return {pitch:.85+this.random()*.3,volume:.65+this.random()*.35};}
  chooseOrigin<T extends {id:string}>(origins:readonly T[]):T|undefined {
    const choices=origins.filter(p=>p.id!==this.lastOrigin);
    const pool=choices.length?choices:origins;
    const selected=pool[Math.floor(this.random()*pool.length)];
    if(selected)this.lastOrigin=selected.id;return selected;
  }
}
