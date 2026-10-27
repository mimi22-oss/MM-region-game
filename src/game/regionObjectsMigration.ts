import type { LayoutFeature, FeatureKind } from './worldLayout.ts';
import { ward, farmhouse, uShweHouse, toWorld, kalayVillages, chinSaiMonasteries, zingalinMonasteries, htomarLandmarks, htomarRoadsideShops, tharYarGoneLandmarkBuildings, htaukKyantLandmarkBuildings, htaukKyantLandmarks, htaukKyantIntermediateField, kyarInnLandmarkBuildings, kyarInnLandmarks, kyarInnLakeStructures } from '../data/ward.ts';
import type { TreePlot, VillageMeta } from '../data/types.ts';
import { myotharCenterBuildings } from '../data/wards/myothar/center/myotharCenterBuildings.ts';
import { myotharCenterRoads } from '../data/wards/myothar/center/myotharCenterRoads.ts';
import { kalayArea1Buildings } from '../data/wards/kalayArea1/kalayArea1Buildings.ts';
import { kalayArea1Roads, kalayArea1Trees, nankaleinCreek } from '../data/wards/kalayArea1/kalayArea1Data.ts';
import { nankaleinTeaShopData } from '../data/wards/kalayArea1/kalayArea1TeaShop.ts';
import { siTharBuildings } from '../data/villages/sithar/sitharBuildings.ts';
import { siTharRoads } from '../data/villages/sithar/sitharRoads.ts';
import { natmyaungBuildings } from '../data/villages/natmyaung/natmyaungBuildings.ts';
import { natmyaungRoads } from '../data/villages/natmyaung/natmyaungRoads.ts';
import { kanbaleBuildings } from '../data/villages/kanbale/kanbaleBuildings.ts';
import { kanbaleRoads } from '../data/villages/kanbale/kanbaleRoads.ts';
import { mangoTrees } from '../data/mangoTrees.ts';
import { tamarindTrees } from '../data/tamarindTrees.ts';
import { parkedCars } from '../data/cars.ts';
import { BALLOON_LAUNCH } from './balloonRide.ts';

type Rectangle = { id?: string; name?: string; x: number; z: number; width: number; depth: number; rotation?: number; color?: string; roof?: string };
type Building = Rectangle & { houseWidth?: number; houseLength?: number; wallColor?: string; roofColor?: string; type?: string; kind?: string; height?: number };
type Line = { id: string; name?: string; width: number; worldPoints: [number, number][] };

/** UI aliases never become runtime source identities. */
export function normalizeAuthoredRegionId(id: string): string {
  return id === 'myotha' ? 'myothar' : id === 'sitha' ? 'sithar' : id;
}
export function getAuthoredRegionIds(): string[] {
  return ['myothar', 'kalay-area-1', ...kalayVillages.map(v => v.id)];
}
function markSource(region: string, feature: LayoutFeature): LayoutFeature {
  const { points, rotation, dimensions, width, assetId, color, roofColor, name } = feature;
  const sourceSnapshot = JSON.parse(JSON.stringify({ points, rotation, dimensions, width, assetId, color, roofColor, name }));
  return { ...feature, metadata: { ...feature.metadata, authored: true, sourceId: feature.id, sourceRegion: region, sourceAssetId: assetId,
    sourceX: points[0]?.x ?? 0, sourceZ: points[0]?.z ?? 0, sourceRotation: rotation ?? 0,
    sourceWidth: dimensions?.width ?? width, sourceDepth: dimensions?.depth, sourceSnapshot } };
}
function rectangle(data: Rectangle, id: string, category: string, name: string, assetId?: string, kind: FeatureKind = 'custom'): LayoutFeature {
  return { id: data.id ?? id, name: data.name ?? name, kind, assetId, points: [{ x: data.x, z: data.z }], rotation: data.rotation ?? 0,
    dimensions: { width: data.width, depth: data.depth }, color: data.color, roofColor: data.roof, metadata: { geometry: 'rectangle', category } };
}
function building(data: Building, assetId = 'building:myothar-house'): LayoutFeature {
  const type = data.type ?? data.kind;
  const kind: FeatureKind = type === 'school' ? 'school' : type === 'office' ? 'office' : type === 'clinic' ? 'hospital' :
    type === 'shop' ? 'shop' : ['monastery', 'church', 'pagoda'].includes(type ?? '') ? 'religious' : 'house';
  const feature = rectangle({ ...data, width: data.houseWidth ?? data.width, depth: data.houseLength ?? data.depth }, data.id!, 'building', 'အဆောက်အဦ', assetId, kind);
  feature.color = data.wallColor ?? data.color; feature.roofColor = data.roofColor ?? data.roof;
  if(data.height) feature.dimensions!.height = data.height;
  feature.metadata!.sourceType = type;
  return feature;
}
function tree(data: TreePlot, variant: 'large' | 'canopy' | 'farm' | 'mango' | 'tamarind'): LayoutFeature {
  const size = variant === 'farm' ? 7.2 : 13;
  return { id: data.id, kind: 'tree', name: 'သစ်ပင်', assetId: `nature:${variant === 'large' ? 'shade' : variant}-tree`, points: [{ x: data.x, z: data.z }], rotation: 0,
    dimensions: { width: size, depth: size, height: 17.6 }, metadata: { geometry: 'rectangle', category: 'tree', variant, radius: data.radius } };
}
function line(data: Line, category = 'road'): LayoutFeature {
  return { id: data.id, kind: category === 'road' ? 'road' : 'custom', name: data.name || (category === 'road' ? 'လမ်း' : 'ရေမြောင်း'),
    points: data.worldPoints.map(([x,z]) => ({x,z})), width: data.width, metadata: { geometry: 'polyline', category } };
}
function roadRectangle(data: Rectangle, id?: string): LayoutFeature {
  const rotation = data.rotation ?? 0, c = Math.cos(rotation), s = Math.sin(rotation), alongX = data.width > data.depth;
  const dx = alongX ? data.width / 2 * c : data.depth / 2 * s, dz = alongX ? -data.width / 2 * s : data.depth / 2 * c;
  const feature = line({ id: data.id ?? id!, name: data.name, width: Math.min(data.width,data.depth), worldPoints:[[data.x-dx,data.z-dz],[data.x+dx,data.z+dz]] });
  feature.metadata!.sourceRectangle = {...data};
  return feature;
}
function villageCanals(v: VillageMeta): LayoutFeature[] {
  const features: LayoutFeature[] = [];
  if(v.connectingCanal) {
    const canal=v.connectingCanal as typeof v.connectingCanal & {worldPoints?:[number,number][]};
    features.push(line({id:canal.id,name:canal.name,width:canal.depth,worldPoints:canal.worldPoints ?? canal.points.map(([u,w])=>{const p=toWorld(u,w);return [p.x,p.z];})},'canal'));
  }
  if(v.canal) {
    const canal=v.canal, a=toWorld(canal.uMin,canal.v), b=toWorld(canal.uMax,canal.v);
    features.push(line({id:canal.id,name:canal.name,width:canal.width,worldPoints:[[a.x,a.z],[b.x,b.z]]},'canal'));
  }
  return features;
}
function footballPitchGroup(data: Rectangle, idPrefix: string, namePrefix: string): LayoutFeature[] {
  const rot = data.rotation ?? 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  const px = data.x, pz = data.z;
  const w = data.width, d = data.depth;
  const halfD = d / 2;
  const northGoalX = px - (-halfD) * s;
  const northGoalZ = pz + (-halfD) * c;
  const southGoalX = px - halfD * s;
  const southGoalZ = pz + halfD * c;

  return [
    {
      id: `${idPrefix}-surface`,
      groupId: idPrefix,
      kind: 'custom',
      name: `${namePrefix} - မြက်ခင်းပြင်`,
      assetId: 'infrastructure:football-pitch-surface',
      points: [{ x: px, z: pz }],
      rotation: rot,
      dimensions: { width: w + 8, depth: d + 8, height: 0.1 },
      metadata: { geometry: 'rectangle', category: 'football-pitch', compoundRole: 'surface' },
    },
    {
      id: `${idPrefix}-lines`,
      groupId: idPrefix,
      kind: 'custom',
      name: `${namePrefix} - ကွင်းစည်းမျဉ်း`,
      assetId: 'infrastructure:football-lines',
      points: [{ x: px, z: pz }],
      rotation: rot,
      dimensions: { width: w, depth: d, height: 0.15 },
      metadata: { geometry: 'rectangle', category: 'football-pitch', compoundRole: 'lines' },
    },
    {
      id: `${idPrefix}-circle`,
      groupId: idPrefix,
      kind: 'custom',
      name: `${namePrefix} - အလယ်စက်ဝိုင်း`,
      assetId: 'infrastructure:football-center-circle',
      points: [{ x: px, z: pz }],
      rotation: rot,
      dimensions: { width: 18.3, depth: 18.3, height: 0.15 },
      metadata: { geometry: 'rectangle', category: 'football-pitch', compoundRole: 'circle' },
    },
    {
      id: `${idPrefix}-goal-north`,
      groupId: idPrefix,
      kind: 'custom',
      name: `${namePrefix} - မြောက်ဘက်ဂိုးတိုင်`,
      assetId: 'infrastructure:football-goal',
      points: [{ x: northGoalX, z: northGoalZ }],
      rotation: rot,
      dimensions: { width: 7.44, depth: 2.44, height: 2.44 },
      metadata: { geometry: 'rectangle', category: 'football-pitch', compoundRole: 'goal' },
    },
    {
      id: `${idPrefix}-goal-south`,
      groupId: idPrefix,
      kind: 'custom',
      name: `${namePrefix} - တောင်ဘက်ဂိုးတိုင်`,
      assetId: 'infrastructure:football-goal',
      points: [{ x: southGoalX, z: southGoalZ }],
      rotation: rot,
      dimensions: { width: 7.44, depth: 2.44, height: 2.44 },
      metadata: { geometry: 'rectangle', category: 'football-pitch', compoundRole: 'goal' },
    },
  ];
}

/** Build one requested region only. Authored features reference originals and are
 * never marked custom: importing them must not create duplicate 3D models. */
export function getRegionAuthoredFeatures(regionId: string): LayoutFeature[] {
  const region=normalizeAuthoredRegionId(regionId), features:LayoutFeature[]=[];
  const addRectangles=(items:Rectangle[],category:string,label:string)=>items.forEach((item,index)=>features.push(rectangle(item,`${region}-${category}-${index}`,category,label,undefined,category==='field'?'farm':'custom')));
  const addBuildings=(items:Building[],asset?:string)=>items.forEach(b=>features.push(building(b,asset)));
  const addTrees=(items:TreePlot[],variant:Parameters<typeof tree>[1])=>items.forEach(t=>features.push(tree(t,variant)));
  if(region==='myothar') {
    for(const house of ward.houses) {
      const asset=house.id===farmhouse.id?'building:farmhouse':house.id===uShweHouse.id?'building:u-shwe-house':'building:myothar-house';
      const feature=building(house,asset);
      if(house.id===farmhouse.id) feature.dimensions={width:21,depth:10,height:7.2};
      if(house.id===uShweHouse.id) feature.dimensions={width:10,depth:11.5,height:7.2};
      features.push(feature);
    }
    addBuildings(myotharCenterBuildings); addBuildings(ward.warehouses,'building:warehouse'); addBuildings(ward.riceMill.buildings,'building:rice-mill');
    footballPitchGroup(ward.pitch, 'myothar-pitch', 'ဘောလုံးကွင်း').forEach(f => features.push(f));
    addTrees(ward.trees,'canopy'); addTrees(ward.largeTrees,'large'); addTrees(ward.farmTrees,'farm'); addTrees(mangoTrees,'mango'); addTrees(tamarindTrees,'tamarind');
    ward.roads.forEach(r=>features.push(roadRectangle(r))); myotharCenterRoads.forEach(r=>features.push(line(r)));
    addRectangles(ward.fields,'field','လယ်ကွင်း'); addRectangles(ward.southernFields,'field','လယ်ကွင်း'); addRectangles(ward.westernFields,'field','လယ်ကွင်း');
    ward.riceMill.fields.forEach((r,i)=>features.push(rectangle(r,`myothar-rice-mill-field-${i}`,'field','လယ်ကွင်း',undefined,'farm')));
    features.push(rectangle(ward.pond,'myothar-pond','pond','ရေကန်'),rectangle(ward.openGround,'myothar-open-ground','open-ground','ကွင်းပြင်'));
    const waterways:Array<[string,Rectangle]>=[['myothar-canal',ward.canal],...ward.drains.map((d,i):[string,Rectangle]=>[`myothar-drain-${i}`,d])];
    waterways.forEach(([id,data])=>{const f=roadRectangle(data,id);f.kind='custom';f.name='ရေမြောင်း';f.metadata!.category='canal';features.push(f);});
    features.push(line({id:'myothar-cross-canal',width:ward.crossCanal.depth,worldPoints:ward.crossCanal.points.map(([u,v])=>{const p=toWorld(u,v);return [p.x,p.z];})},'canal'));
    ward.riceMill.paths.forEach((r,i)=>features.push(roadRectangle(r,`myothar-rice-mill-path-${i}`)));
    parkedCars.forEach(car=>features.push(rectangle(car,car.id,'car','ကား','vehicle:compact-car','vehicle')));
    features.push(rectangle({...BALLOON_LAUNCH,rotation:BALLOON_LAUNCH.yaw,width:9.2,depth:9.2},'rideable-balloon','balloon','လူစီးမီးပုံးပျံ','vehicle:fire-balloon','vehicle'));
  } else if(region==='kalay-area-1') {
    addBuildings(kalayArea1Buildings,'building:sithar-house'); features.push(building(nankaleinTeaShopData,'building:tea-shop'));
    kalayArea1Roads.forEach(r=>features.push(line(r))); addTrees(kalayArea1Trees,'large');
    features.push(line({id:nankaleinCreek.id,name:nankaleinCreek.name,width:nankaleinCreek.waterWidth,worldPoints:nankaleinCreek.worldPoints as [number,number][]},'canal'));
  } else {
    const village=kalayVillages.find(v=>v.id===region); if(!village)return [];
    if(region==='sithar') addBuildings(siTharBuildings,'building:sithar-house');
    else if(region==='natmyaung') addBuildings(natmyaungBuildings,'building:natmyaung-house');
    else if(region==='kanbale') kanbaleBuildings.forEach(b=>features.push(building(b,b.id.includes('403030614')?'building:village-school':b.id.includes('403027623')?'building:rice-mill':'building:sithar-house')));
    else addBuildings(village.houses);
    const roads=region==='sithar'?siTharRoads:region==='natmyaung'?natmyaungRoads:region==='kanbale'?kanbaleRoads:undefined;
    if(roads) roads.forEach(r=>features.push(line(r))); else village.roads.forEach(r=>features.push(roadRectangle(r)));
    addRectangles(village.fields,'field','လယ်ကွင်း'); addRectangles(village.bundedFields,'field','လယ်ကွင်း'); addRectangles(village.separationFields,'field','လယ်ကွင်း'); addRectangles(village.ponds??[],'pond','ရေကန်');
    addTrees(village.trees,'canopy'); addTrees(village.largeTrees,'large'); addTrees(village.farmTrees,'farm'); features.push(...villageCanals(village));
    if(region==='chinsai') addBuildings(chinSaiMonasteries);
    if(region==='zingalin') addBuildings(zingalinMonasteries);
    if(region==='htomar') {addBuildings(htomarLandmarks);addBuildings(htomarRoadsideShops);}
    if(region==='tharyargone') addBuildings(tharYarGoneLandmarkBuildings);
    if(region==='htaukkyant') {addBuildings(htaukKyantLandmarkBuildings);addRectangles([htaukKyantIntermediateField],'field','လယ်ကွင်း');htaukKyantLandmarks.filter(m=>m.id.includes('pitch')).forEach(m=>footballPitchGroup(m, m.id, m.name).forEach(f=>features.push(f)));}
    if(region==='kyarinn') {addBuildings(kyarInnLandmarkBuildings);addBuildings(kyarInnLakeStructures);kyarInnLandmarks.filter(m=>m.id.includes('pitch')).forEach(m=>footballPitchGroup(m, m.id, m.name).forEach(f=>features.push(f)));}
  }

  // Shared arrays (fields/separationFields) and specialised models have one identity.
  const unique=new Map<string,LayoutFeature>();
  for(const feature of features) unique.set(feature.id,markSource(region,feature));
  return [...unique.values()];
}
/** Detached lookup suitable for edit baseline comparison. */
export function getAuthoredFeature(regionId:string,sourceId:string):LayoutFeature|undefined {
  return getRegionAuthoredFeatures(regionId).find(f=>f.metadata?.sourceId===sourceId);
}
export function getAuthoredFeatureBySourceId(sourceId:string):LayoutFeature|undefined {
  for(const region of getAuthoredRegionIds()){const feature=getAuthoredFeature(region,sourceId);if(feature)return feature;}
  return undefined;
}
