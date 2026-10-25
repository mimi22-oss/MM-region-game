import { BoxGeometry, MeshStandardMaterial } from 'three';

// Thousands of town boxes share these immutable resources.
const boxGeometry = new BoxGeometry(1, 1, 1);
boxGeometry.userData.shared = true;
const materials = new Map<string, MeshStandardMaterial>();
function material(color: string) {
 let result = materials.get(color);
 if (!result) {
  result = new MeshStandardMaterial({ color });
  result.userData.shared = true;
  materials.set(color, result);
 }
 return result;
}
export function Box({position,size,color,walkable=false}:{walkable?:boolean;position:[number,number,number];size:[number,number,number];color:string}){
 return <mesh userData={{walkable}} position={position} scale={size} geometry={boxGeometry} material={material(color)} dispose={null} castShadow receiveShadow/>;
}
export function Block({x=0,y=0,z=0,w,h,d,color,walkable=false}:{walkable?:boolean;x?:number;y?:number;z?:number;w:number;h:number;d:number;color:string}){return <Box position={[x,y,z]} size={[w,h,d]} color={color} walkable={walkable}/>}
