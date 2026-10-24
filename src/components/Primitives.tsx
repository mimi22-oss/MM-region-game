export function Box({position,size,color,walkable=false}:{walkable?:boolean;position:[number,number,number];size:[number,number,number];color:string}){
 return <mesh userData={{walkable}} position={position} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>;
}
export function Block({x=0,y=0,z=0,w,h,d,color,walkable=false}:{walkable?:boolean;x?:number;y?:number;z?:number;w:number;h:number;d:number;color:string}){return <mesh userData={{walkable}} position={[x,y,z]} castShadow receiveShadow><boxGeometry args={[w,h,d]}/><meshStandardMaterial color={color}/></mesh>}
