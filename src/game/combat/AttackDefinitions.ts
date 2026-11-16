export const COMBAT_CLIPS = ['Combat_Idle','Sword_Walk','Sword_Run','Combat_Strafe_Left','Combat_Strafe_Right','Slash_Left','Slash_Right','Slash_Diagonal_Left','Slash_Diagonal_Right','Slash_Overhead','Slash_Rising','Slash_Middle','Sword_Thrust','Sword_Block','Sword_Parry','Dodge_Left','Dodge_Right','Hit_React','Knockback','Spin_Slash','Jump_Slash','Heavy_Slash','Combo_Finisher'] as const;
export type CombatClip = typeof COMBAT_CLIPS[number];
export const COMBO = ['Slash_Left','Slash_Right','Slash_Diagonal_Left','Slash_Overhead','Slash_Rising','Combo_Finisher'] as const;
export type CombatCommand = CombatClip | 'combo';
export type AttackDefinition = {activeStart:number;activeEnd:number;bufferStart:number;direction:string;damaging:boolean};
const attack=(direction:string,start=.24,end=.72):AttackDefinition=>({activeStart:start,activeEnd:end,bufferStart:.5,direction,damaging:true});
export const ATTACKS:Partial<Record<CombatClip,AttackDefinition>>={
 Slash_Left:attack('left-to-right'),Slash_Right:attack('right-to-left'),Slash_Diagonal_Left:attack('diagonal-left'),Slash_Diagonal_Right:attack('diagonal-right'),
 Slash_Overhead:attack('down'),Slash_Rising:attack('up'),Slash_Middle:attack('middle'),Sword_Thrust:attack('forward',.28,.7),Heavy_Slash:attack('heavy-down',.32,.75),
 Spin_Slash:attack('spin',.2,.82),Jump_Slash:attack('jump-down',.3,.75),Combo_Finisher:attack('finisher',.25,.8),
};
export const COMBAT_MODEL_URLS={boy:'/models/characters/boy-combat-animated.glb',girl:'/models/characters/girl-combat-animated.glb',canolia:'/models/characters/canolia-character-combat-animated.glb',ghost:'/models/enemies/ghost-woman-combat-animated.glb'} as const;
