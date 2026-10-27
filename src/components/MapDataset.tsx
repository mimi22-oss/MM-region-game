import {useEffect,useRef,useState,useSyncExternalStore,type ComponentType} from 'react';
import {useFrame} from '@react-three/fiber';
import {openMapDataset,type MapTile,type MapTilePayload} from '../game/mapTileStore';
import {unprojectMapPoint,type MapProjection} from '../game/mapProjection';
import {mobileQuality} from '../game/sceneBudget';

export type MapTileViewProps={tile:MapTile;data:MapTilePayload;projection:MapProjection};
export type MapDatasetConfig={manifest:string;projection:MapProjection};
type OpenDataset=Awaited<ReturnType<typeof openMapDataset>>;
function ActiveDataset({dataset,projection,View}:{dataset:OpenDataset;projection:MapProjection;View:ComponentType<MapTileViewProps>}){
 const loaded=useSyncExternalStore(dataset.store.subscribe,dataset.store.getSnapshot),elapsed=useRef(Infinity);
 useFrame(({camera},dt)=>{
  elapsed.current+=dt;if(elapsed.current<.35)return;elapsed.current=0;
  const focus=camera.userData.viewFocus??camera.position;
  const geo=unprojectMapPoint(projection,focus.x,focus.z),radius=(mobileQuality?450:650)/Math.min(...projection.metersPerDegree);
  const tiles=dataset.index.nearest(geo.lon,geo.lat,radius,mobileQuality?2:4);
  dataset.store.select(tiles.map(t=>t.id));
 });
 return <>{loaded.map(item=><View key={item.tile.id} {...item} projection={projection}/>)}</>;
}
/** One instance per active catalogue dataset. The view owns bounded mesh/physics cleanup. */
export function MapDataset({config,view:View}:{config:MapDatasetConfig;view:ComponentType<MapTileViewProps>}){
 const [dataset,setDataset]=useState<OpenDataset|null>(null);
 useEffect(()=>{
  const controller=new AbortController();let current:OpenDataset|undefined;
  setDataset(null);
  void openMapDataset(config.manifest,controller.signal,mobileQuality).then(next=>{
   if(controller.signal.aborted){next.store.dispose();return;}
   current=next;setDataset(next);
  }).catch(error=>{if(!controller.signal.aborted)console.error('Map dataset unavailable:',config.manifest,error);});
  return ()=>{controller.abort();current?.store.dispose();};
 },[config]);
 return dataset?<ActiveDataset dataset={dataset} projection={config.projection} View={View}/>:null;
}
