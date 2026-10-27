export type Point2 = {x:number;z:number};
export type FeatureKind = 'ward'|'block'|'road'|'house'|'school'|'hospital'|'office'|'shop'|'market'|'tree'|'toilet'|'well'|'religious'|'farm'|'furniture'|'vehicle'|'cultural'|'custom';
export type LayoutFeature = {
  id: string;
  groupId?: string;
  kind: FeatureKind;
  name: string;
  points: Point2[];
  wardId?: string;
  blockId?: string;
  width?: number;
  rotation?: number;
  size?: number;
  assetId?: string;
  dimensions?: { width: number; depth: number; height?: number };
  scale?: [number, number, number] | number;
  color?: string;
  roofColor?: string;
  isCustomPlaced?: boolean;
  metadata?: Record<string, unknown>;
};
export type WorldLayout = {version:1;name:string;features:LayoutFeature[];updatedAt:string;deletedSourceIds?:string[]};
export const WORLD_LAYOUT_KEY='myanmar-town-world-layout-v1';
export const emptyLayout=():WorldLayout=>({version:1,name:'New Village',features:[],updatedAt:new Date().toISOString()});
export function validLayout(value:unknown):value is WorldLayout {
 if(!value||typeof value!=='object')return false;
 const v=value as Partial<WorldLayout>;
 return v.version===1&&typeof v.name==='string'&&Array.isArray(v.features)&&v.features.every(f=>typeof f.id==='string'&&typeof f.name==='string'&&Array.isArray(f.points)&&f.points.length<=5000&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
}
export function loadLayout():WorldLayout {try{const raw=localStorage.getItem(WORLD_LAYOUT_KEY);if(raw){const data:unknown=JSON.parse(raw);if(validLayout(data))return data;}}catch{}return emptyLayout();}
export function saveLayout(layout:WorldLayout){const next={...layout,updatedAt:new Date().toISOString()};localStorage.setItem(WORLD_LAYOUT_KEY,JSON.stringify(next));window.dispatchEvent(new CustomEvent('world-layout-updated',{detail:next}));return next;}
export function downloadLayout(layout:WorldLayout){const blob=new Blob([JSON.stringify(layout,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='village-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function aiLayoutPrompt(layout:WorldLayout){return `Recreate this 3D Myanmar village layout exactly. Coordinates are world X/Z in meters, not latitude/longitude. Preserve every ID, geometry point, road width, ward/block association and object position. Do not invent or move objects. Reuse existing React Three Fiber components where available. Render polygons as ward/block boundaries, roads as connected ribbons and point objects as 3D assets. Layout JSON:\n${JSON.stringify(layout,null,2)}`;}
