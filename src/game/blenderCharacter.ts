export const CHARACTER_CLIPS = ['Idle','Walk','Vault','Bike_Mount','Bike_Idle','Bike_Drive','Car_Drive','Swim_Idle','Swim_Forward'] as const;
export type CharacterClip = typeof CHARACTER_CLIPS[number];
export type BlenderMotion = {speed:number; airborne?:boolean; jumpBend?:number; jumpVelocity?:number; swimming?:boolean};
export function characterClip(motion:BlenderMotion,riding=false,driving=false):CharacterClip {
 if(driving)return 'Car_Drive';
 if(riding)return Math.abs(motion.speed)>.15?'Bike_Drive':'Bike_Idle';
 if(motion.swimming)return Math.abs(motion.speed)>.15?'Swim_Forward':'Swim_Idle';
 if(motion.airborne||(motion.jumpBend??0)>.01)return 'Vault';
 return Math.abs(motion.speed)>.1?'Walk':'Idle';
}
/** The controller supplies world jump height; only the knee tuck comes from the clip. */
export function vaultPhase(motion:BlenderMotion) {
 return motion.airborne?.5-Math.atan((motion.jumpVelocity??0)/4)/Math.PI:.16*Math.max(0,Math.min(1,motion.jumpBend??0));
}
