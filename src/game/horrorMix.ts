import {useSyncExternalStore} from 'react';
export interface HorrorMix {ghost:number;ambience:number}
let mix:HorrorMix={ghost:.7,ambience:1};
try{const saved=JSON.parse(localStorage.getItem('mm-horror-mix-v1')??'null');if(saved)for(const key of ['ghost','ambience'] as const)if(Number.isFinite(saved[key]))mix[key]=Math.max(0,Math.min(1,saved[key]));}catch{}
const listeners=new Set<()=>void>();
export function setHorrorMix(key:keyof HorrorMix,value:number){mix={...mix,[key]:Number.isFinite(value)?Math.max(0,Math.min(1,value)):0};try{localStorage.setItem('mm-horror-mix-v1',JSON.stringify(mix));}catch{}listeners.forEach(fn=>fn());}
export function useHorrorMix(){return useSyncExternalStore(cb=>{listeners.add(cb);return()=>{listeners.delete(cb);};},()=>mix);}
