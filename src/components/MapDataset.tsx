import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ComponentType} from 'react';
import {useFrame} from '@react-three/fiber';
import {openMapDataset,type MapTile,type MapTilePayload} from '../game/mapTileStore';
import {projectMapPoint,unprojectMapPoint,type MapProjection} from '../game/mapProjection';
import {mobileQuality} from '../game/sceneBudget';
import {setStreamedPendingTileBounds} from '../game/streamedChunkRegistry';
import {TELEPORT_SEARCH_RADIUS} from '../game/cameraNavigation';
import {destinationNearBounds,type DestinationBounds,type DestinationPart,type DestinationStatus,type WorldDestination} from '../game/regionLoading';

export type MapTileViewProps={tile:MapTile;data:MapTilePayload;projection:MapProjection};
export type MapDatasetConfig={
 manifest:string;
 projection:MapProjection;
 travel?:{part:Exclude<DestinationPart,'region'>;bounds:DestinationBounds};
};
type OpenDataset=Awaited<ReturnType<typeof openMapDataset>>;
function ActiveDataset({
 dataset,
 projection,
 manifestKey,
 active = true,
 destination,
 onDestinationStatus,
 radiusMeters,
 View,
}:{
 dataset:OpenDataset;
 projection:MapProjection;
 manifestKey:string;
 active?:boolean;
 destination?:WorldDestination|null;
 onDestinationStatus?:(seq:number,ready:boolean)=>void;
 radiusMeters?:number;
 View:ComponentType<MapTileViewProps>;
}){
 const loaded=useSyncExternalStore(dataset.store.subscribe,dataset.store.getSnapshot);
 const elapsed=useRef(Infinity),selectedIdsRef=useRef<string[]>([]),pendingIdsRef=useRef<string[]>([]);
 const maxActive=mobileQuality?2:4;
 const scale=Math.min(...projection.metersPerDegree);
 const destinationIds=useMemo(()=>{
  if(!destination)return null;
  const geo=unprojectMapPoint(projection,destination.x,destination.z);
  return dataset.index.nearest(geo.lon,geo.lat,TELEPORT_SEARCH_RADIUS/scale,maxActive).map(tile=>tile.id);
 },[dataset,destination,maxActive,projection,scale]);

 const updatePendingBounds=useCallback((resident:typeof loaded)=>{
  const ids=selectedIdsRef.current.filter(id=>!resident.some(item=>item.tile.id===id));
  if(ids.length===pendingIdsRef.current.length&&ids.every((id,index)=>id===pendingIdsRef.current[index]))return;
  pendingIdsRef.current=ids;
  const pending=ids
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
 },[manifestKey,dataset,projection]);

 const selectTiles=useCallback((ids:string[])=>{
  selectedIdsRef.current=ids;
  dataset.store.select(ids);
  updatePendingBounds(dataset.store.getSnapshot());
 },[dataset,updatePendingBounds]);

 useEffect(()=>{
  if(!active)selectTiles([]);
  else if(destinationIds)selectTiles(destinationIds);
  else elapsed.current=Infinity;
 },[active,destinationIds,selectTiles]);

 useEffect(()=>{
  updatePendingBounds(loaded);
  // The tile views register their ground and collision in layout effects.
  if(active&&destination&&destinationIds?.every(id=>loaded.some(item=>item.tile.id===id))){
   onDestinationStatus?.(destination.seq,true);
  }
 },[active,destination,destinationIds,loaded,onDestinationStatus,updatePendingBounds]);

 useEffect(()=>()=>setStreamedPendingTileBounds(manifestKey,[]),[manifestKey]);

 useFrame(({camera},dt)=>{
  if(!active)return;
  if(destination){
   if(destinationIds?.some(id=>dataset.store.hasLoadFailure(id)))onDestinationStatus?.(destination.seq,false);
   return;
  }
  elapsed.current+=dt;if(elapsed.current<.35)return;elapsed.current=0;
  const focus=camera.userData.viewFocus??camera.position;
  const radius=(radiusMeters??(mobileQuality?450:650))/scale;
  const geo=unprojectMapPoint(projection,focus.x,focus.z);
  selectTiles(dataset.index.nearest(geo.lon,geo.lat,radius,maxActive).map(tile=>tile.id));
 });
 return active?<>{loaded.map(item=><View key={item.tile.id} {...item} projection={projection}/>)}</>:null;
}
/** One instance per active catalogue dataset. The view owns bounded mesh/physics cleanup. */
export function MapDataset({
 config,
 view:View,
 active = true,
 destination,
 onDestinationStatus,
 radiusMeters,
}:{
 config:MapDatasetConfig;
 view:ComponentType<MapTileViewProps>;
 active?:boolean;
 destination?:WorldDestination|null;
 onDestinationStatus?:DestinationStatus;
 radiusMeters?:number;
}){
 const [dataset,setDataset]=useState<OpenDataset|null>(null);
 const [manifestFailed,setManifestFailed]=useState(false);
 const travel=config.travel;
 const preparesDestination=destination&&travel&&destinationNearBounds(destination,travel.bounds,TELEPORT_SEARCH_RADIUS);
 const reportDestination=useCallback((seq:number,ready:boolean)=>{
  if(travel)onDestinationStatus?.(seq,travel.part,ready);
 },[onDestinationStatus,travel]);
 useEffect(()=>{
  if(!destination||!travel)return;
  if(!preparesDestination)reportDestination(destination.seq,true);
  else if(manifestFailed)reportDestination(destination.seq,false);
 },[destination,manifestFailed,preparesDestination,reportDestination,travel]);
 useEffect(()=>{
  const controller=new AbortController();let current:OpenDataset|undefined;
  setDataset(null);
  setManifestFailed(false);
  void openMapDataset(config.manifest,controller.signal,mobileQuality).then(next=>{
   if(controller.signal.aborted){next.store.dispose();return;}
   current=next;setDataset(next);
  }).catch(error=>{
   if(controller.signal.aborted)return;
   setManifestFailed(true);
   console.warn('Map dataset unavailable:',config.manifest,error);
  });
  return ()=>{controller.abort();setStreamedPendingTileBounds(config.manifest,[]);current?.store.dispose();};
 },[config]);
 return dataset?<ActiveDataset dataset={dataset} projection={config.projection} manifestKey={config.manifest}
  active={active||Boolean(preparesDestination)} destination={preparesDestination?destination:null}
  onDestinationStatus={reportDestination} radiusMeters={radiusMeters} View={View}/>:null;
}
