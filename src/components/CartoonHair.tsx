import { BufferGeometry,Float32BufferAttribute,Vector3,CatmullRomCurve3,MeshStandardMaterial,CanvasTexture,SRGBColorSpace } from 'three';
type P=[number,number,number];
// Fine directional strands are procedural surface detail, not individual hair meshes.
const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
const ctx=canvas.getContext('2d')!;ctx.fillStyle='#302b2b';ctx.fillRect(0,0,512,512);
let seed=71;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<420;i++){
 const x=random()*512,w=.3+random()*1.3,bright=35+Math.floor(random()*30);
 ctx.strokeStyle=`rgba(${bright+6},${bright},${bright-2},${.15+random()*.38})`;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,0);
 ctx.bezierCurveTo(x+random()*8-4,160,x+random()*8-4,360,x,512);ctx.stroke();
}
const tex=new CanvasTexture(canvas);tex.colorSpace=SRGBColorSpace;
const hair=new MeshStandardMaterial({map:tex,color:'#bdb4b0',roughness:.55,metalness:0});
const rootMat=new MeshStandardMaterial({map:tex,color:'#a59c9c',roughness:.65});
function finish(p:number[],idx:number[],uv:number[]){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
const cap=(()=>{
 const p:number[]=[],idx:number[]=[],uv:number[]=[],rings=36,sides=80;
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
  const phi=j/sides*Math.PI*2,front=Math.max(0,-Math.sin(phi)),side=Math.abs(Math.cos(phi));
  const maxTheta=2.06-.96*Math.pow(front,1.3);
  const theta=i/rings*maxTheta,ridge=.002*Math.sin(phi*21+theta*4)*Math.sin(theta);
  p.push(Math.cos(phi)*Math.sin(theta)*(.263+ridge),Math.cos(theta)*.325+.045,Math.sin(phi)*Math.sin(theta)*(.25+ridge)+.015);
  uv.push(j/sides,i/rings);
  if(i<rings&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
 }
 return finish(p,idx,uv);
})();
function lock(points:P[],width:number,depth:number){
 const projected=points.map(p=>{
  const v=new Vector3(p[0]/.27,(p[1]-.045)/.325,(p[2]-.015)/.25),len=v.length();
  const fitted=v.clone().divideScalar(len);
  const blend=Math.min(1,Math.max(0,(p[1]-.15)/.07));
  return new Vector3(p[0]+(fitted.x*.274-p[0])*blend,p[1]+(fitted.y*.33+.045-p[1])*blend,p[2]+(fitted.z*.255+.015-p[2])*blend);
 });
 const curve=new CatmullRomCurve3(projected),p:number[]=[],idx:number[]=[],uv:number[]=[],rings=40,sides=20;
 for(let i=0;i<=rings;i++){
  const t=i/rings,c=curve.getPoint(t),tangent=curve.getTangent(t);
  const radial=new Vector3(c.x/(.27*.27),(c.y-.045)/(.325*.325),(c.z-.015)/(.25*.25)).normalize();
  const across=new Vector3().crossVectors(tangent,radial).normalize(),normal=new Vector3().crossVectors(across,tangent).normalize();
  const taper=Math.max(.003,Math.pow(Math.sin(Math.PI*(.018+t*.982)),.55));
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,w=Math.cos(a)*width*taper,d=Math.sin(a)*depth*taper;
   const v=c.clone().addScaledVector(across,w).addScaledVector(normal,d);
   p.push(v.x,v.y,v.z);uv.push(j/sides,t);
   if(i<rings&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
  }
 }
 return finish(p,idx,uv);
}
// Part on the character's left (viewer right); long layers sweep toward viewer left.
const locks=[
 lock([[-.11,.247,-.104],[-.04,.35,-.10],[.105,.357,-.082],[.229,.298,-.045],[.252,.32,.015]],.064,.025),
 lock([[-.105,.229,-.169],[-.026,.311,-.181],[.12,.30,-.178],[.24,.215,-.144],[.29,.202,-.05]],.064,.026),
 lock([[-.112,.217,-.20],[-.024,.273,-.223],[.11,.236,-.23],[.22,.169,-.19],[.292,.142,-.09]],.065,.026),
 lock([[-.10,.207,-.211],[-.034,.228,-.244],[.017,.194,-.256],[.041,.139,-.253],[.067,.118,-.237]],.039,.021),
 lock([[.10,.248,-.19],[.206,.207,-.181],[.25,.102,-.149],[.283,.068,-.071],[.307,.095,-.015]],.046,.02),
 lock([[.187,.175,-.105],[.249,.098,-.107],[.258,-.018,-.084],[.23,-.089,-.044]],.038,.021),
 lock([[-.105,.234,-.139],[-.204,.223,-.12],[-.256,.142,-.105],[-.277,.075,-.048],[-.308,.095,.008]],.062,.027),
 lock([[-.186,.184,-.071],[-.252,.078,-.066],[-.26,-.019,-.058],[-.231,-.093,-.018]],.036,.019),
 lock([[-.11,.276,.061],[.019,.356,.043],[.104,.375,.031],[.121,.407,.045]],.043,.025),
 lock([[.11,.27,.12],[.225,.223,.104],[.272,.097,.09],[.29,.083,.031]],.047,.021),
 lock([[-.17,.25,.095],[-.253,.167,.11],[-.268,.04,.086],[-.287,.081,.024]],.036,.019),
];
export function CartoonHair(){return <group name="swept-layered-hair" dispose={null}><mesh geometry={cap} material={rootMat}/>{locks.filter((_,i)=>![5,7,9,10].includes(i)).map((g,i)=><mesh key={i} geometry={g} material={hair}/>)}</group>}
