import { BufferGeometry, Float32BufferAttribute } from 'three';
/** Follow the actual curved roof surface; an inset planar pane is hidden by the body. */
export function windshieldGeometry(width=.59,start=.06,end=.31){
 const positions:number[]=[],indices:number[]=[];
 for(let i=0;i<=12;i++){
  const t=start+(end-start)*i/12,u=1-t;
  const front=u*u*u*.76+3*u*u*t*.42+3*u*t*t*-1.25+t*t*t*-1.55;
  const y=u*u*u*1.28+3*u*u*t*2.55+3*u*t*t*2.55+t*t*t*.43;
  for(const x of [-width,width])positions.push(x,y+.035,-front-.025);
  if(i<12){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
