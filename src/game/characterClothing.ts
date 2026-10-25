import {BufferGeometry,Float32BufferAttribute,CatmullRomCurve3,TubeGeometry,Vector3} from 'three';
type Point=[number,number,number];

/** An opaque cloth shell with separate inside/outside surfaces and joined hems. */
export function garmentGeometry(kind:'dress'|'longyi'){
 const rows:Point[]=kind==='dress'?[[.225,.73,.155],[.25,.56,.19],[.29,.35,.24],[.33,.15,.28]]:[[.225,.73,.155],[.235,.56,.185],[.245,.35,.22],[.255,.14,.25]];
 const segments=48,positions:number[]=[],indices:number[]=[],ring=segments+1,layer=rows.length*ring;
 for(let inside=0;inside<2;inside++)for(let row=0;row<rows.length;row++)for(let j=0;j<=segments;j++){
  const phi=j/segments*Math.PI*2,[rx,y,rz]=rows[row],fold=Math.sin(phi*(kind==='dress'?12:4))*.006*row/(rows.length-1),thickness=inside*.012;
  positions.push(Math.cos(phi)*(rx+fold-thickness),y,Math.sin(phi)*(rz+fold-thickness));
 }
 const vertex=(i:number)=>new Vector3(positions[i*3],positions[i*3+1],positions[i*3+2]);
 const face=(a:number,b:number,c:number,d:number,outward:Vector3)=>{
  const normal=vertex(b).sub(vertex(a)).cross(vertex(c).sub(vertex(a)));
  if(normal.dot(outward)>0)indices.push(a,b,c,a,c,d);else indices.push(a,c,b,a,d,c);
 };
 for(let inside=0;inside<2;inside++)for(let row=0;row<rows.length-1;row++)for(let j=0;j<segments;j++){
  const k=inside*layer+row*ring+j,phi=(j+.5)/segments*Math.PI*2,sign=inside?-1:1;
  face(k,k+1,k+ring+1,k+ring,new Vector3(sign*Math.cos(phi),0,sign*Math.sin(phi)));
 }
 for(const row of [0,rows.length-1])for(let j=0;j<segments;j++){
  const k=row*ring+j;face(k,k+layer,k+layer+1,k+1,new Vector3(0,row===0?1:-1,0));
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** TubeGeometry has open ends; close both sleeve cuffs with correctly wound caps. */
export function closedSleeveGeometry(points:Point[],radius:number){
 const curve=new CatmullRomCurve3(points.map(p=>new Vector3(...p))),steps=24,sides=12,tube=new TubeGeometry(curve,steps,radius,sides,false);
 const positions=Array.from(tube.attributes.position.array),indices=Array.from(tube.index!.array);
 for(const end of [0,1]){
  const center=curve.getPoint(end),normal=curve.getTangent(end).multiplyScalar(end?1:-1),centerIndex=positions.length/3;
  positions.push(...center.toArray());
  const source=end*steps*(sides+1),start=positions.length/3;
  for(let j=0;j<=sides;j++)positions.push(tube.attributes.position.getX(source+j),tube.attributes.position.getY(source+j),tube.attributes.position.getZ(source+j));
  for(let j=0;j<sides;j++){
   const a=new Vector3().fromArray(positions,(start+j)*3).sub(center),b=new Vector3().fromArray(positions,(start+j+1)*3).sub(center);
   if(a.cross(b).dot(normal)>0)indices.push(centerIndex,start+j,start+j+1);else indices.push(centerIndex,start+j+1,start+j);
  }
 }
 tube.dispose();const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function coveredStride(phase:number,activity:number){return Math.sin(phase)*.12*activity;}
