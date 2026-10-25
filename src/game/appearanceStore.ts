import {configurePlayerCar} from './carRide';
import {useSyncExternalStore} from 'react';
import {defaultAppearance,normalizeAppearance,type AppearanceSettings} from '../data/appearance';
export const APPEARANCE_STORAGE_KEY='myanmar-town.appearance.v1';
function read(){try{return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)??'null'));}catch{return defaultAppearance();}}
let snapshot=read();
configurePlayerCar(snapshot.car);
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function getAppearance(){return snapshot;}
export function setAppearance(next:AppearanceSettings){snapshot=normalizeAppearance(next);configurePlayerCar(snapshot.car);try{localStorage.setItem(APPEARANCE_STORAGE_KEY,JSON.stringify(snapshot));}catch{}listeners.forEach(listener=>listener());}
export function useAppearance(){return useSyncExternalStore(subscribe,getAppearance,getAppearance);}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===APPEARANCE_STORAGE_KEY||event.key===null){snapshot=read();configurePlayerCar(snapshot.car);listeners.forEach(listener=>listener());}});
