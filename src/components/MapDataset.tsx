import {useEffect,useRef,useState,useSyncExternalStore,type ComponentType} from 'react';
import {useFrame} from '@react-three/fiber';
import {openMapDataset,type MapTile,type MapTilePayload} from '../game/mapTileStore';
import {projectMapPoint,unprojectMapPoint,type MapProjection} from '../game/mapProjection';
import {mobileQuality} from '../game/sceneBudget';
import {setStreamedPendingTileBounds} from '../game/streamedChunkRegistry';

export type MapTileViewProps={tile:MapTile;data:MapTilePayload;projection:MapProjection};
export type MapDatasetConfig={manifest:string;projection:MapProjection};
type OpenDataset=Awaited<ReturnType<typeof openMapDataset>>;
function ActiveDataset({
 dataset,
 projection,
 manifestKey,
 active = true,
 destination,
 radiusMeters,
 View,
}:{
 dataset:OpenDataset;
 projection:MapProjection;
 manifestKey:string;
 active?:boolean;
 destination?:{x:number;z:number}|null;
 radiusMeters?:number;
 View:ComponentType<MapTileViewProps>;
}){
 const loaded=useSyncExternalStore(dataset.store.subscribe,dataset.store.getSnapshot),elapsed=useRef(Infinity),selectedIdsRef=useRef<string[]>([]);

 useEffect(()=>{
  const loadedIds=new Set(loaded.map(item=>item.tile.id));
  const pending=selectedIdsRef.current
   .filter(id=>!loadedIds.has(id))
   .map(id=>dataset.manifest.tiles.find(t=>t.id===id))
   .filter((t):t is MapTile=>Boolean(t))
   .map(t=>{
    const corners=[
     projectMapPoint(projection,t.bbox[0],t.bbox[1]),
     projectMapPoint(projection,t.bbox[2],t.bbox[1]),
     projectMapPoint(projection,t.bbox[2],t.bbox[3]),
     projectMapPoint(projection,t.bbox[0],t.bbox[3]),
    ];
    return {
     minX:Math.min(...corners.map(c=>c.x)),
     maxX:Math.max(...corners.map(c=>c.x)),
     minZ:Math.min(...corners.map(c=>c.z)),
     maxZ:Math.max(...corners.map(c=>c.z)),
    };
   });
  setStreamedPendingTileBounds(manifestKey,pending);
  return ()=>setStreamedPendingTileBounds(manifestKey,[]);
 },[loaded,manifestKey,dataset,projection,active]);

 useEffect(()=>{
  if(!active){
   selectedIdsRef.current=[];
   setStreamedPendingTileBounds(manifestKey,[]);
   dataset.store.select([]);
  }else if(destination){
   const geo=unprojectMapPoint(projection,destination.x,destination.z);
   const radius=(radiusMeters??(mobileQuality?450:650))/Math.min(...projection.metersPerDegree);
   const tiles=dataset.index.nearest(geo.lon,geo.lat,radius,mobileQuality?2:4);
   selectedIdsRef.current=tiles.map(t=>t.id);
   dataset.store.select(selectedIdsRef.current);
  }
 },[active,destination?.x,destination?.z,dataset,projection,manifestKey,radiusMeters]);

 useFrame(({camera},dt)=>{
  if(!active)return;
  elapsed.current+=dt;if(elapsed.current<.35)return;elapsed.current=0;
  const focus=camera.userData.viewFocus??camera.position;
  const maxActive=mobileQuality?2:4;
  const radius=(radiusMeters??(mobileQuality?450:650))/Math.min(...projection.metersPerDegree);
  const geo=unprojectMapPoint(projection,focus.x,focus.z);
  const merged=new Map<string,MapTile>();
  for(const t of dataset.index.nearest(geo.lon,geo.lat,radius,maxActive))merged.set(t.id,t);
  if(destination&&merged.size<maxActive){
   const destGeo=unprojectMapPoint(projection,destination.x,destination.z);
   for(const t of dataset.index.nearest(destGeo.lon,destGeo.lat,radius,maxActive))merged.set(t.id,t);
  }
  const nextIds=[...merged.keys()].slice(0,maxActive);
  selectedIdsRef.current=nextIds;
  dataset.store.select(nextIds);
 });
 return active?<>{loaded.map(item=><View key={item.tile.id} {...item} projection={projection}/>)}</>:null;
}
/** One instance per active catalogue dataset. The view owns bounded mesh/physics cleanup. */
export function MapDataset({
 config,
 view:View,
 active = true,
 destination,
 radiusMeters,
}:{
 config:MapDatasetConfig;
 view:ComponentType<MapTileViewProps>;
 active?:boolean;
 destination?:{x:number;z:number}|null;
 radiusMeters?:number;
}){
 const [dataset,setDataset]=useState<OpenDataset|null>(null);
 useEffect(()=>{
  const controller=new AbortController();let current:OpenDataset|undefined;
  setDataset(null);
  void openMapDataset(config.manifest,controller.signal,mobileQuality).then(next=>{
   if(controller.signal.aborted){next.store.dispose();return;}
   current=next;setDataset(next);
  }).catch(error=>{if(!controller.signal.aborted)console.error('Map dataset unavailable:',config.manifest,error);});
  return ()=>{controller.abort();setStreamedPendingTileBounds(config.manifest,[]);current?.store.dispose();};
 },[config]);
 return dataset?<ActiveDataset dataset={dataset} projection={config.projection} manifestKey={config.manifest} active={active} destination={destination} radiusMeters={radiusMeters} View={View}/>:null;
}
