export type HumanPreset = 'boy' | 'girl' | 'mother' | 'grandmother' | 'grandfather' | 'father';
export type HumanAppearance = {
 preset:HumanPreset; hair:'swept'|'bob'|'long'|'bun'; hairColor:string; skin:string;
 face:'oval'|'round'|'mature'; clothes:'hoodie'|'shirt'|'dress'|'longyi';
 clothingColor:string; trousersColor:string; height:number; shoes:'sneakers'|'boots'|'sandals'; shoeColor:string;
};
export type RobotAppearance = {color:string;accent:string;size:number;legs:'wheels'|'feet'|'tracks';hands:'rounded'|'claw'|'gripper'};
export type CarModel = 'compact'|'toyota'|'lambo'|'toshiba'|'lighttruck';
export type CarAppearance = {model:CarModel;color:string;transmission:'manual'|'automatic'};
export type AppearanceSettings = {version:1;human:HumanAppearance;robot:RobotAppearance;car:CarAppearance};
export const HUMAN_PRESETS:Record<HumanPreset,HumanAppearance>={
 boy:{preset:'boy',hair:'swept',hairColor:'#302b2b',skin:'#edba95',face:'oval',clothes:'hoodie',clothingColor:'#6936ae',trousersColor:'#272934',height:1,shoes:'sneakers',shoeColor:'#f4f0e9'},
 girl:{preset:'girl',hair:'bob',hairColor:'#352720',skin:'#e9b18a',face:'round',clothes:'dress',clothingColor:'#b8518e',trousersColor:'#483346',height:.94,shoes:'sneakers',shoeColor:'#f2d8e5'},
 mother:{preset:'mother',hair:'long',hairColor:'#292324',skin:'#bd875f',face:'oval',clothes:'longyi',clothingColor:'#298c86',trousersColor:'#244b6e',height:1.07,shoes:'sandals',shoeColor:'#71482d'},
 grandmother:{preset:'grandmother',hair:'bun',hairColor:'#b6b3b0',skin:'#c69b7c',face:'mature',clothes:'longyi',clothingColor:'#99734f',trousersColor:'#56396d',height:.97,shoes:'sandals',shoeColor:'#49382c'},
 grandfather:{preset:'grandfather',hair:'swept',hairColor:'#b4b2af',skin:'#b88a68',face:'mature',clothes:'longyi',clothingColor:'#ded2af',trousersColor:'#59675d',height:1.05,shoes:'sandals',shoeColor:'#594531'},
 father:{preset:'father',hair:'swept',hairColor:'#252222',skin:'#aa7552',face:'mature',clothes:'shirt',clothingColor:'#4f7198',trousersColor:'#303b47',height:1.16,shoes:'boots',shoeColor:'#4b3529'},
};
export const CAR_MODELS:Record<CarModel,{label:string;roofFront:number;roofRear:number;roofY:number}>={
 compact:{label:'Compact · မူလကား',roofFront:-.2,roofRear:.65,roofY:2.1},
 toyota:{label:'Toyota ပုံစံ · Sedan',roofFront:-.22,roofRear:.60,roofY:2.12},
 lambo:{label:'Lambo ပုံစံ · Sport',roofFront:-.05,roofRear:.40,roofY:2.08},
 toshiba:{label:'Toshiba · Custom van',roofFront:-.39,roofRear:1.03,roofY:2.23},
 lighttruck:{label:'Light truck · ကုန်တင်ကား',roofFront:-.28,roofRear:.44,roofY:2.17},
};
export function defaultAppearance():AppearanceSettings{return {version:1,human:{...HUMAN_PRESETS.boy},robot:{color:'#b5f3e5',accent:'#ff9b3e',size:1,legs:'wheels',hands:'rounded'},car:{model:'compact',color:'#277fbd',transmission:'manual'}};}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'?value as Record<string,unknown>:{};
function choice<T extends string>(value:unknown,options:readonly T[],fallback:T):T{return options.includes(value as T)?value as T:fallback;}
const color=(value:unknown,fallback:string)=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?value:fallback;
const range=(value:unknown,min:number,max:number,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
/** Validate saved or caller-supplied data before it reaches geometry or movement. */
export function normalizeAppearance(input:unknown):AppearanceSettings{
 const source=object(input),h=object(source.human),r=object(source.robot),c=object(source.car),d=defaultAppearance();
 const preset=choice(h.preset,Object.keys(HUMAN_PRESETS) as HumanPreset[],'boy'),base=HUMAN_PRESETS[preset];
 return {version:1,human:{preset,hair:choice(h.hair,['swept','bob','long','bun'],base.hair),hairColor:color(h.hairColor,base.hairColor),skin:color(h.skin,base.skin),face:choice(h.face,['oval','round','mature'],base.face),clothes:choice(h.clothes,['hoodie','shirt','dress','longyi'],base.clothes),clothingColor:color(h.clothingColor,base.clothingColor),trousersColor:color(h.trousersColor,base.trousersColor),height:range(h.height,.8,1.2,base.height),shoes:choice(h.shoes,['sneakers','boots','sandals'],base.shoes),shoeColor:color(h.shoeColor,base.shoeColor)},
 robot:{color:color(r.color,d.robot.color),accent:color(r.accent,d.robot.accent),size:range(r.size,.75,1.25,1),legs:choice(r.legs,['wheels','feet','tracks'],'wheels'),hands:choice(r.hands,['rounded','claw','gripper'],'rounded')},
 car:{model:choice(c.model,Object.keys(CAR_MODELS) as CarModel[],'compact'),color:color(c.color,d.car.color),transmission:choice(c.transmission,['manual','automatic'],'manual')}};
}
