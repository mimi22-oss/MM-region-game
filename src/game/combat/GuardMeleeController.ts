import type {GhostEncounterInteractionState} from '../ghostConfig.ts';

export const GHOST_REACTION_DELAY_MIN_SEC = 1.0;
export const GHOST_REACTION_DELAY_MAX_SEC = 3.0;

/** Random 1–3s hesitation delay before a nearby ghost reacts/strikes in sword duel mode. */
export function sampleGhostReactionDelay(rng: () => number = Math.random): number {
  return GHOST_REACTION_DELAY_MIN_SEC + rng() * (GHOST_REACTION_DELAY_MAX_SEC - GHOST_REACTION_DELAY_MIN_SEC);
}

type Input={
  dt:number;
  valid:boolean;
  protected:boolean;
  distance:number;
  attackNormalized:number;
  defence:'none'|'block'|'parry'|'dodge';
  x:number;
  z:number;
  swordEquipped?:boolean;
  playerAttacking?:boolean;
  rng?:()=>number;
};

/**
 * Ghost melee controller:
 * - Unarmed: classic neck-grab -> fall -> death contract.
 * - Sword duel (`swordEquipped: true`): matches Zombie combat — waits a random 2–5s delay
 *   when near the player so the player has a fair window to slash, then strikes to deduct
 *   1 Heart (`hitLanded = true`) instead of instant-grabbing!
 */
export class GuardMeleeController {
  private phase:'idle'|'wait'|'windup'|'grab'|'fall'='idle';
  private elapsed=0;
  private cooldown=0;
  private waitTimer=0;
  private seq=100000;
  readonly interaction:GhostEncounterInteractionState={active:false,phase:'none',seq:0,ghostX:0,ghostZ:0,fallProgress:0};
  started=false;
  killed=false;
  parried=false;
  /** True on the frame a sword-duel ghost strike connects (deducts 1 Heart like Zombie). */
  hitLanded=false;
  private holdSec:number;
  private fallSec:number;
  constructor(holdSec=1.15,fallSec=3.15){this.holdSec=holdSec;this.fallSec=fallSec;}
  get engaged(){return this.phase!=='idle'&&this.phase!=='wait';}
  get waiting(){return this.phase==='wait';}
  cancel(cooldownSec=1.5){
    this.phase='idle';
    this.elapsed=0;
    this.waitTimer=0;
    this.interaction.active=false;
    this.interaction.phase='none';
    this.cooldown=Math.max(this.cooldown,cooldownSec);
  }
  step(input:Input){
    this.started=false;
    this.killed=false;
    this.parried=false;
    this.hitLanded=false;
    this.cooldown=Math.max(0,this.cooldown-input.dt);
    const maxEngageDist=input.swordEquipped?2.25:2.45;
    if(input.protected||!input.valid||input.distance>maxEngageDist){
      if(this.phase!=='idle')this.cancel(input.swordEquipped?0.4:1.5);
      return this.interaction;
    }

    // Sword-duel mode: Zombie-style random 2–5s hesitation before striking for -1 Heart (no instant grab!)
    if(input.swordEquipped){
      const strikeRange=1.95;
      if(input.playerAttacking&&this.phase==='windup'){
        // Player's sword swing clashes and resets the ghost's windup cleanly
        this.phase='wait';
        this.waitTimer=sampleGhostReactionDelay(input.rng);
        this.elapsed=0;
        this.interaction.active=false;
        this.interaction.phase='none';
        this.interaction.ghostX=input.x;
        this.interaction.ghostZ=input.z;
        return this.interaction;
      }
      if(this.phase==='idle'){
        if(input.distance<=strikeRange&&this.cooldown===0){
          this.phase='wait';
          this.waitTimer=sampleGhostReactionDelay(input.rng);
          this.elapsed=0;
        }
      }else if(this.phase==='wait'){
        if(input.distance>strikeRange+0.25){
          this.phase='idle';
          this.waitTimer=0;
        }else{
          this.waitTimer=Math.max(0,this.waitTimer-input.dt);
          if(this.waitTimer===0&&!input.playerAttacking){
            this.phase='windup';
            this.started=true;
            this.elapsed=0;
          }
        }
      }else if(this.phase==='windup'){
        this.elapsed+=input.dt;
        if(input.attackNormalized>=.5){
          if(input.defence!=='none'){
            this.parried=input.defence==='parry';
          }else{
            this.hitLanded=true;
            this.interaction.seq=++this.seq;
          }
          // After strike (or block), pause another random 2–5s before next attack!
          this.phase='wait';
          this.waitTimer=sampleGhostReactionDelay(input.rng);
          this.elapsed=0;
          this.interaction.active=false;
          this.interaction.phase='none';
        }else if(this.elapsed>=2.4){
          // Safety reset if attack clip was interrupted
          this.phase='wait';
          this.waitTimer=sampleGhostReactionDelay(input.rng);
          this.elapsed=0;
        }
      }else{
        this.cancel(0.5);
      }
      this.interaction.ghostX=input.x;
      this.interaction.ghostZ=input.z;
      return this.interaction;
    }

    // Unarmed mode: classic neck-grab -> fall -> death contract
    if(this.phase==='idle'){
      if(input.distance<=1.65&&this.cooldown===0){this.phase='windup';this.started=true;this.elapsed=0;}
    }else if(this.phase==='windup'){
      // Contact is driven by Ghost_Attack's actual mixer progress, not an unrelated timeout.
      if(input.attackNormalized>=.5){
        if(input.defence!=='none'){this.parried=input.defence==='parry';this.cancel();}
        else{this.phase='grab';this.elapsed=0;this.interaction.active=true;this.interaction.phase='neck-grab';this.interaction.seq=++this.seq;}
      }
    }else{
      this.elapsed+=input.dt;
      if(this.phase==='grab'&&this.elapsed>=this.holdSec){this.phase='fall';this.elapsed=0;this.interaction.phase='player-fall';this.interaction.seq=++this.seq;}
      else if(this.phase==='fall'){
        this.interaction.fallProgress=Math.min(1,this.elapsed/this.fallSec);
        if(this.elapsed>=this.fallSec){this.killed=true;this.cancel();}
      }
    }
    this.interaction.ghostX=input.x;
    this.interaction.ghostZ=input.z;
    return this.interaction;
  }
}
