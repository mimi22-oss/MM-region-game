import {useLayoutEffect,useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {Color,InstancedMesh,Matrix4,Quaternion,Vector3} from 'three';
import {MapDataset,type MapTileViewProps,type MapDatasetConfig} from './MapDataset';
import {projectMapPoint} from '../game/mapProjection';
import {registerGroundRegion,releaseGroundRegion} from '../game/groundSurface';
import config from '../data/sitharFieldDataset.json';

function FieldTile({tile,data,projection}:MapTileViewProps){
 const mesh=useRef<InstancedMesh>(null),{scene}=useThree();
 useLayoutEffect(()=>{
  const object=mesh.current!,matrix=new Matrix4(),rotation=new Quaternion(),axis=new Vector3(0,1,0),position=new Vector3(),size=new Vector3(),color=new Color();
  let i=0;
  for(const f of data.features){
   const p=f.properties!,g=f.geometry as {coordinates:[number,number]},center=projectMapPoint(projection,...g.coordinates);
   const width=Number(p.width),depth=Number(p.depth),angle=Number(p.rotation),c=Math.cos(angle),s=Math.sin(angle);rotation.setFromAxisAngle(axis,angle);
   const box=(u:number,y:number,v:number,w:number,h:number,d:number,paint:string)=>{matrix.compose(position.set(center.x+u*c+v*s,y,center.z-u*s+v*c),rotation,size.set(w,h,d));object.setMatrixAt(i,matrix);object.setColorAt(i++,color.set(paint));};
   box(0,.02,0,width,.08,depth,String(p.color));
   for(const side of [-1,1]){box(0,.06,side*depth/2,width,.08,.3,'#556b2f');box(side*width/2,.06,0,.3,.08,depth,'#556b2f');}
  }
  object.instanceMatrix.needsUpdate=true;if(object.instanceColor)object.instanceColor.needsUpdate=true;object.computeBoundingSphere();object.computeBoundingBox();
  const id=`sithar-fields-${tile.id}`;registerGroundRegion(scene,id,object);
  return ()=>releaseGroundRegion(scene,id);
 },[data,projection,scene,tile.id]);
 return <instancedMesh name={`tile-fields-${tile.id}`} ref={mesh} args={[undefined,undefined,data.features.length*5]} receiveShadow userData={{walkable:true}}><boxGeometry/><meshLambertMaterial/></instancedMesh>;
}
export function SeparationFieldTiles(){return <MapDataset config={config as MapDatasetConfig} view={FieldTile}/>;}
