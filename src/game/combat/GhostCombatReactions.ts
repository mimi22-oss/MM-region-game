export type GhostReaction='Ghost_Attack'|'Ghost_Hit'|'Ghost_Stagger'|'Ghost_Death';
type Reaction={seq:number;clip:GhostReaction;stunned:boolean;engaged:boolean};
const entries=new Map<string,Reaction>();
export function ghostCombatReaction(id:string){return entries.get(id);}
export function requestGhostReaction(id:string,clip:GhostReaction){
 let entry=entries.get(id);if(!entry){entry={seq:0,clip,stunned:false,engaged:false};entries.set(id,entry);}
 entry.seq++;entry.clip=clip;entry.stunned=clip!=='Ghost_Attack';return entry.seq;
}
export function finishGhostReaction(id:string,seq:number){const e=entries.get(id);if(e?.seq===seq)e.stunned=e.clip==='Ghost_Death';}
export function setGhostCombatEngaged(id:string,engaged:boolean){let e=entries.get(id);if(!e&&engaged){e={seq:0,clip:'Ghost_Attack',stunned:false,engaged:false};entries.set(id,e);}if(e)e.engaged=engaged;}
export function ghostCombatMovementLocked(id:string){const e=entries.get(id);return !!e&&(e.stunned||e.engaged);}
export function clearGhostCombatReaction(id:string){entries.delete(id);}
