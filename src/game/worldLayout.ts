import {
  CONTRACT_SCHEMA_VERSIONS,
  isValidAssetId,
  parseAssetId,
  parseInstanceId,
  parseRegionId,
  validateWorldPlacement,
  type WorldPlacementV1,
} from '../../shared/contracts/index.ts';

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

const FALLBACK_ASSET_BY_KIND: Record<FeatureKind, string> = {
  ward: 'infrastructure:region-marker',
  block: 'infrastructure:region-marker',
  road: 'infrastructure:road-segment',
  house: 'building:myothar-house',
  school: 'building:village-school',
  hospital: 'building:myothar-house',
  office: 'building:myothar-house',
  shop: 'building:u-shwe-house',
  market: 'building:u-shwe-house',
  tree: 'nature:canopy-tree',
  toilet: 'infrastructure:toilet-block',
  well: 'infrastructure:water-pump',
  religious: 'cultural:candle-in-holder',
  farm: 'nature:canopy-tree',
  furniture: 'furniture:tea-table',
  vehicle: 'vehicle:compact-car',
  cultural: 'cultural:candle-in-holder',
  custom: 'custom:generic-object',
};

export function extractWorldPlacements(
  layout: WorldLayout,
  rawRegionId: string,
  authority: WorldPlacementV1['authority'] = 'local-offline',
): WorldPlacementV1[] {
  const regionId = parseRegionId(rawRegionId);
  const placements: WorldPlacementV1[] = [];
  for (const f of layout.features) {
    const pt = f.points[0];
    if (!pt || f.kind === 'ward' || f.kind === 'block' || f.kind === 'road') continue;
    const rawAssetId = f.assetId && isValidAssetId(f.assetId) ? f.assetId : FALLBACK_ASSET_BY_KIND[f.kind];
    const assetId = parseAssetId(rawAssetId);
    const rawInstanceId = f.id === assetId ? `inst:${f.id}` : f.id;
    const instanceId = parseInstanceId(rawInstanceId);
    const scaleArr: readonly [number, number, number] = Array.isArray(f.scale)
      ? [f.scale[0] ?? 1, f.scale[1] ?? 1, f.scale[2] ?? 1]
      : typeof f.scale === 'number' && Number.isFinite(f.scale) && f.scale > 0
        ? [f.scale, f.scale, f.scale]
        : [1, 1, 1];
    placements.push(validateWorldPlacement({
      schemaVersion: CONTRACT_SCHEMA_VERSIONS.worldPlacement,
      instanceId,
      assetId,
      regionId,
      position: [pt.x, 0, pt.z],
      rotationY: typeof f.rotation === 'number' && Number.isFinite(f.rotation) ? f.rotation : 0,
      scale: scaleArr,
      ...(f.color || f.roofColor || f.name
        ? { variantOverrides: { ...(f.color ? { primaryColor: f.color } : {}), ...(f.roofColor ? { secondaryColor: f.roofColor } : {}), ...(f.name ? { label: f.name } : {}) } }
        : {}),
      authority,
    }));
  }
  return placements;
}
