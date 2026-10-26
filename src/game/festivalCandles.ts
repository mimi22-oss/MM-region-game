import {Group,InstancedMesh,Matrix4,Vector3,type Object3D,type BufferGeometry,type Material} from 'three';
import {candleGeometry,candleHolderGeometry,candlePoolGeometry,flameGeometry,candleGlowGeometry,candleSolidMaterial,candleHolderLitMaterial,candlePoolLitMaterial,candleFlameMaterial,candleGlowMaterial,CANDLE_WICK_TOP,HOLDER_CANDLE_BASE,HOLDER_CANDLE_SCALE} from './candleModel.ts';
type Item={x:number;y:number;z:number;holder?:boolean};
const noRaycast=()=>{};
/** One batch per part and 64m tile; no React trees or per-flame frame callbacks. */
export function decorateFestivalRegion(root:Group){
 if(root.getObjectByName('festival-candles'))return;
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),tiles=new Map<string,Item[]>(),point=new Vector3(),transform=new Matrix4();
 root.traverse(object=>{
  const items=object.userData.festivalCandles as Item[]|undefined;if(!items)return;
  transform.multiplyMatrices(inverse,object.matrixWorld);
  for(const item of items){point.set(item.x,item.y,item.z).applyMatrix4(transform);
   const key=`${Math.floor(point.x/64)},${Math.floor(point.z/64)}`;
   let tile=tiles.get(key);if(!tile){tile=[];tiles.set(key,tile);}
   tile.push({x:point.x,y:point.y,z:point.z,holder:item.holder});
  }
 });
 const festival=new Group();festival.name='festival-candles';festival.userData.dynamic=true;
 const matrix=new Matrix4();
 for(const [key,items] of tiles){
  const tile=new Group();tile.name=`candle-tile-${key}`;
  const [tx,tz]=key.split(',').map(Number);tile.position.set(tx*64,0,tz*64);
  const local=items.map(p=>({...p,x:p.x-tx*64,z:p.z-tz*64})),holders=local.filter(p=>p.holder);
  tile.userData.festivalTile=true;tile.userData.flamePositions=items.map(p=>[p.x,p.y+(p.holder?HOLDER_CANDLE_BASE+CANDLE_WICK_TOP*HOLDER_CANDLE_SCALE:CANDLE_WICK_TOP)+.06,p.z]);
  const batch=(name:string,geometry:BufferGeometry,material:Material,points:Item[],height:(p:Item)=>number,scaleFn:(p:Item)=>[number,number,number]=()=>[1,1,1])=>{
   if(!points.length)return;
   const mesh=new InstancedMesh(geometry,material,points.length);mesh.name=name;mesh.raycast=noRaycast;
   if(name==='festival-glows')mesh.frustumCulled=false; // Billboard size is expanded in the GPU shader.
   points.forEach((p,i)=>{const [sx,sy,sz]=scaleFn(p);matrix.makeScale(sx,sy,sz);matrix.setPosition(p.x,p.y+height(p),p.z);mesh.setMatrixAt(i,matrix);});
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.1;
   tile.add(mesh);
  };
  batch('festival-wax',candleGeometry,candleSolidMaterial,local,p=>p.holder?HOLDER_CANDLE_BASE:0,p=>p.holder?[1.1,HOLDER_CANDLE_SCALE,1.1]:[1,1,1]);
  batch('festival-holders',candleHolderGeometry,candleHolderLitMaterial,holders,()=>0);
  batch('festival-pools',candlePoolGeometry,candlePoolLitMaterial,holders,()=>0);
  const tip=(p:Item)=>p.holder?HOLDER_CANDLE_BASE+CANDLE_WICK_TOP*HOLDER_CANDLE_SCALE:CANDLE_WICK_TOP;
  batch('festival-flames',flameGeometry,candleFlameMaterial,local,tip,p=>p.holder?[1.4,1.4,1.4]:[1,1,1]);
  batch('festival-glows',candleGlowGeometry,candleGlowMaterial,local,p=>tip(p)+.065,p=>p.holder?[1.4,1.4,1.4]:[1,1,1]);
  festival.add(tile);
 }
 root.add(festival);
}

/** Distant candles keep their flames and radiant glows; nearby cups and wax retain full detail. */
export function updateFestivalVisibility(root:Object3D,x:number,z:number,mobile=false,height=0){
 const festival=root.children.find(child=>child.name==='festival-candles');if(!festival)return;
 for(const tile of festival.children){
  const distance=Math.hypot(tile.position.x+32-x,tile.position.z+32-z);
  tile.visible=distance<Math.max(mobile?300:600,height*1.8+100);
  for(const child of tile.children)child.visible=child.name==='festival-flames'||child.name==='festival-glows'||distance<(mobile?80:130);
 }
}

/** Small light markers accompany simplified houses when full regions are detached for aerial views. */
export function createFestivalOverview(root:Group){
 const result=new Group();result.name='festival-overview';
 const festival=root.children.find(c=>c.name==='festival-candles');if(!festival)return result;
 const positions=new Map<string,Vector3>(),matrix=new Matrix4(),p=new Vector3();
 for(const tile of festival.children){
  const cups=tile.children.find(c=>c.name==='festival-holders') as InstancedMesh|undefined;if(!cups)continue;
  for(let i=0;i<cups.count;i++){cups.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).add(tile.position);
   // Overview boxes have a 5m roof: these are light markers on that representation, not extra 3D candles.
   p.y=Math.max(5.2,p.y+.35);positions.set(`${Math.floor(p.x/3)},${Math.floor(p.z/3)}`,p.clone());}
 }
 if(positions.size){const mesh=new InstancedMesh(candleGlowGeometry,candleGlowMaterial,positions.size);mesh.name='festival-overview-glows';mesh.raycast=noRaycast;mesh.frustumCulled=false;
  let i=0;for(const p of positions.values()){matrix.makeTranslation(p.x,p.y,p.z);mesh.setMatrixAt(i++,matrix);}mesh.instanceMatrix.needsUpdate=true;result.add(mesh);}
 return result;
}
