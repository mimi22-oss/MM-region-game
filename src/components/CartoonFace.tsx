import { useMemo, useEffect, type RefObject } from 'react';
import { HUMAN_PRESETS, type HumanAppearance } from '../data/appearance';
import { BufferGeometry, Float32BufferAttribute, SphereGeometry, MeshStandardMaterial, Color, Group, CatmullRomCurve3, Vector3, TubeGeometry } from 'three';
type P=[number,number,number];
const material=(color:string,roughness=.65)=>new MeshStandardMaterial({color,roughness});
const skin=material('#edb58e'), inner=material('#ce917e'), crease=material('#975e51'), browMat=material('#302523',.85), white=material('#fffaf0',.28), pupil=material('#100d0d',.12), shine=new MeshStandardMaterial({color:'#fff',emissive:'#fff',emissiveIntensity:.25});
const skinVertex=new MeshStandardMaterial({vertexColors:true,roughness:.72});
const sphere=new SphereGeometry(1,24,18);
const gaussian=(x:number,y:number,cx:number,cy:number,rx:number,ry:number)=>Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2));
function width(y:number){return .247*(y<-.04?1+Math.min(0,(y+.04))*.44:1);}
/** A rounded oval with a broad facial plane, sculpted cheek pads and one continuous nose. */
function faceZ(x:number,y:number){
 const sy=y/.294,sx=x/width(y),r=Math.max(0,1-sx*sx-sy*sy);
 let z=-.222*Math.pow(r,.29);
 z-=.011*(gaussian(x,y,.137,-.06,.075,.065)+gaussian(x,y,-.137,-.06,.075,.065));
 z-=.009*gaussian(x,y,0,-.036,.024,.075)+.034*gaussian(x,y,0,-.076,.034,.032);
 z-=.009*(gaussian(x,y,.027,-.083,.017,.017)+gaussian(x,y,-.027,-.083,.017,.017));
 z-=.009*gaussian(x,y,0,-.157,.08,.038);
 return z;
}
const head=new SphereGeometry(1,112,84);
{
 const p=head.attributes.position,colors:number[]=[];
 const base=new Color('#edba95'),pink=new Color('#e69588'),nosePink=new Color('#da937d');
 for(let i=0;i<p.count;i++){
  const nx=p.getX(i),ny=p.getY(i),nz=p.getZ(i),y=ny*.294,x=nx*width(y);
  const z=nz<0?faceZ(x,y):nz*.216;
  p.setXYZ(i,x,y,z);
  const front=Math.max(0,-nz),cheek=(gaussian(x,y,.154,-.063,.067,.052)+gaussian(x,y,-.154,-.063,.067,.052))*.32*front;
  const c=base.clone().lerp(pink,cheek).lerp(nosePink,.19*gaussian(x,y,0,-.084,.035,.025)*front);
  colors.push(c.r,c.g,c.b);
 }
 head.setAttribute('color',new Float32BufferAttribute(colors,3));head.computeVertexNormals();
}
const eyeX=.105,eyeY=.014,eyeW=.071;
function eyeHeight(a:number){return Math.sin(a)>=0?.052:.043;}
function eyeSurface(side:number,x:number,y:number){
 const rx=x/eyeW,ry=y/(y>=0?.052:.043),r2=Math.min(1,rx*rx+ry*ry);
 return faceZ(side*eyeX+x,eyeY+y)-.003-.015*(1-r2);
}
function patch(side:number){
 const p:number[]=[],idx:number[]=[],rings=10,sides=64;
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
  const r=i/rings,a=j/sides*Math.PI*2,x=eyeW*Math.cos(a)*r,y=eyeHeight(a)*Math.sin(a)*r;
  p.push(x,y,eyeSurface(side,x,y));
  if(i<rings&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function tube(points:P[],radius:number){return new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p))),48,radius,6,false);}
function lid(side:number,upper:boolean){
 return tube(Array.from({length:25},(_,i)=>{const a=(upper?0:Math.PI)+i/24*Math.PI,x=eyeW*Math.cos(a),y=eyeHeight(a)*Math.sin(a);return [x,y,eyeSurface(side,x,y)-.001] as P}),upper?.0035:.0024);
}
function iris(side:number){
 const p:number[]=[],idx:number[]=[],colors:number[]=[],rings=10,sides=64;
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
  const r=i/rings,a=j/sides*Math.PI*2,x=Math.cos(a)*.038*r-side*.004,y=Math.sin(a)*.041*r-.001;
  p.push(x,y,eyeSurface(side,x,y)-.0018-.002*(1-r*r));
  const fibre=(Math.sin(a*47+Math.sin(a*19)*2)+Math.sin(a*73+r*6))*.025;
  const c=new Color(r>.86?'#38271d':r<.52?'#21150f':'#80512e');c.multiplyScalar(1+fibre);
  colors.push(c.r,c.g,c.b);
  if(i<rings&&j<sides){const k=i*(sides+1)+j;idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const irisMat=new MeshStandardMaterial({vertexColors:true,roughness:.28});
function brow(side:number){
 const p:number[]=[],idx:number[]=[],steps=32,sides=8;
 for(let i=0;i<=steps;i++){
  const t=i/steps,x=side*(.046+t*.131),y=.126+.011*Math.sin(t*Math.PI)-.027*t*t;
  const thick=.014*(1-t**3)*Math.min(1,Math.sqrt(t/.10))+.0008;
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,yy=y+Math.cos(a)*thick;
   p.push(x,yy,faceZ(x,yy)-.004-Math.sin(a)*.004);
   if(i<steps&&j<sides){const k=i*(sides+1)+j;if(side<0)idx.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);else idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
  }
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const smile=tube(Array.from({length:31},(_,i)=>{const x=(i/30-.5)*.155,y=-.157+.013*(x/.0775)**2;return [x,y,faceZ(x,y)-.0016] as P}),.0018);
const lip=tube(Array.from({length:25},(_,i)=>{const x=(i/24-.5)*.12,y=-.163+.008*(x/.06)**2;return [x,y,faceZ(x,y)-.002] as P}),.0024);
const eyes=[-1,1].map(side=>({side,white:patch(side),iris:iris(side),top:lid(side,true),bottom:lid(side,false),brow:brow(side)}));
function Ball({p,s,m}:{p:P;s:P;m:MeshStandardMaterial}){return <mesh geometry={sphere} position={p} scale={s} material={m}/>;}
export function CartoonFace({leftEye,rightEye,appearance=HUMAN_PRESETS.boy}:{leftEye:RefObject<Group|null>;rightEye:RefObject<Group|null>;appearance?:HumanAppearance}){
 const palette=useMemo(()=>{
  const target=new Color(appearance.skin),base=new Color('#edba95');
  return {skin:material(appearance.skin),inner:material(target.clone().multiplyScalar(.78).getStyle()),crease:material(target.clone().multiplyScalar(.52).getStyle()),browMat:material(appearance.hairColor,.85),skinVertex:new MeshStandardMaterial({vertexColors:true,roughness:.72,color:new Color(target.r/base.r,target.g/base.g,target.b/base.b)})};
 },[appearance.skin,appearance.hairColor]);
 useEffect(()=>()=>Object.values(palette).forEach(m=>m.dispose()),[palette]);
 const {skin,inner,crease,browMat,skinVertex}=palette;
 return <group name="sculpted-cartoon-face" dispose={null}>
  <mesh geometry={head} material={skinVertex}/>
  {eyes.map(e=><group key={e.side}>
   <Ball p={[e.side*.247,-.053,.001]} s={[.049,.079,.035]} m={skin}/>
   <Ball p={[e.side*.255,-.051,-.027]} s={[.031,.054,.012]} m={inner}/>
   <Ball p={[e.side*.242,-.057,-.035]} s={[.013,.033,.013]} m={skin}/>
   <group ref={e.side<0?leftEye:rightEye} position={[e.side*eyeX,eyeY,0]}>
    <mesh geometry={e.white} material={white}/><mesh geometry={e.iris} material={irisMat}/>
    <Ball p={[-e.side*.004,-.001,eyeSurface(e.side,-e.side*.004,-.001)-.005]} s={[.024,.029,.0028]} m={pupil}/>
    <Ball p={[-.014,.020,eyeSurface(e.side,-.014,.020)-.007]} s={[.0065,.0075,.002]} m={shine}/>
    <Ball p={[.012,-.020,eyeSurface(e.side,.012,-.020)-.005]} s={[.0025,.003,.0015]} m={shine}/>
    <mesh geometry={e.top} material={browMat}/><mesh geometry={e.bottom} material={skin}/>
   </group>
   <mesh geometry={e.brow} material={browMat}/>
   <Ball p={[e.side*.018,-.09,faceZ(e.side*.018,-.09)-.001]} s={[.004,.002,.001]} m={crease}/>
   <Ball p={[e.side*.079,-.144,faceZ(e.side*.079,-.144)-.0008]} s={[.003,.0025,.001]} m={crease}/>
  </group>)}
  <mesh geometry={smile} material={crease}/>
  {appearance.face==='mature'&&[-1,1].map(side=><group key={side} position={[side*.105,-.057,-.211]}><mesh rotation={[0,0,side*.10]} material={crease}><boxGeometry args={[.067,.0025,.002]}/></mesh><mesh position={[0,-.009,0]} material={crease}><boxGeometry args={[.047,.002,.002]}/></mesh></group>)}
  {appearance.preset==='grandmother'&&<group position={[0,.014,-.242]}>{[-1,1].map(side=><mesh key={side} position={[side*.105,0,0]}><torusGeometry args={[.073,.004,6,24]}/><meshStandardMaterial color="#665c58"/></mesh>)}<mesh><boxGeometry args={[.065,.006,.006]}/><meshStandardMaterial color="#665c58"/></mesh></group>}
 </group>;
}
