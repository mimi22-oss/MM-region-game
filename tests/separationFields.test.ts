import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kyarInnSiTharSeparationFields,siTharNatMyaungSeparationFields,siTharSeparationFields} from '../src/data/villages/sithar/separationFields.ts';
import {siTharVillage,siTharRoads} from '../src/data/villages/sithar/index.ts';
import {kyarInnVillage} from '../src/data/villages/kyarinn/index.ts';
import {natmyaungVillage,natmyaungRoads,natmyaungBoundaryBounds} from '../src/data/villages/natmyaung/index.ts';
import {natmyaungWeipulaSeparationFields} from '../src/data/villages/natmyaung/separationFields.ts';
import {ward} from '../src/data/ward.ts';
import {mountainHeight} from '../src/game/mountainTerrain.ts';
type Rect={x:number;z:number;width:number;depth:number;rotation:number};
function corners(r:Rect){const c=Math.cos(r.rotation),s=Math.sin(r.rotation);return [[-1,-1],[-1,1],[1,1],[1,-1]].map(([a,b])=>({x:r.x+c*a*r.width/2+s*b*r.depth/2,z:r.z-s*a*r.width/2+c*b*r.depth/2}));}
function overlaps(a:Rect,b:Rect){const aa=corners(a),bb=corners(b);for(const r of [a,b])for(const angle of [r.rotation,r.rotation+Math.PI/2]){const x=Math.cos(angle),z=-Math.sin(angle),as=aa.map(p=>p.x*x+p.z*z),bs=bb.map(p=>p.x*x+p.z*z);if(Math.max(...as)<=Math.min(...bs)||Math.max(...bs)<=Math.min(...as))return false;}return true;}
test('village gaps contain ten separate fields each with a clear AH1 corridor',()=>{
 assert.equal(kyarInnSiTharSeparationFields.length,10);assert.equal(siTharNatMyaungSeparationFields.length,10);
 for(const row of [kyarInnSiTharSeparationFields,siTharNatMyaungSeparationFields]){assert.equal(row.filter(f=>f.u<0).length,5);assert.equal(row.filter(f=>f.u>0).length,5);}
 assert.equal(new Set(siTharSeparationFields.map(f=>f.id)).size,20);
 for(const f of siTharSeparationFields){assert.ok(Math.abs(f.u)-f.width/2>8);for(const other of siTharSeparationFields)if(other!==f)assert.ok(!overlaps(f,other));}
});
test('fields and their bunds do not cover neighbouring buildings or road ribbons',()=>{
 const roads:Rect[]=[...kyarInnVillage.roads];
 for(const r of [...siTharRoads,...natmyaungRoads])for(let i=1;i<r.worldPoints.length;i++){
  const [x,z]=r.worldPoints[i-1],[xx,zz]=r.worldPoints[i];roads.push({x:(x+xx)/2,z:(z+zz)/2,width:Math.hypot(xx-x,zz-z)+.15,depth:r.width,rotation:-Math.atan2(zz-z,xx-x)});
 }
 const failures:string[]=[];
 for(const f of siTharSeparationFields){const padded={...f,width:f.width+.3,depth:f.depth+.3};
  for(const b of [...kyarInnVillage.houses,...siTharVillage.houses,...natmyaungVillage.houses])if(overlaps(padded,b))failures.push(`${f.id} building ${b.id}`);
  for(const p of [...kyarInnVillage.ponds,...natmyaungVillage.ponds])if(overlaps(padded,p))failures.push(`${f.id} pond ${p.id}`);
  roads.forEach((r,i)=>{if(overlaps(padded,r))failures.push(`${f.id} road ${i}`);});
 }
 assert.deepEqual(failures,[]);
});
test('ten separation paddy fields lie between Nat Myaung and Maha Weipula with clear AH1 and zero overlaps',()=>{
 assert.equal(natmyaungWeipulaSeparationFields.length,10);
 assert.equal(natmyaungWeipulaSeparationFields.filter(f=>f.u<0).length,5);
 assert.equal(natmyaungWeipulaSeparationFields.filter(f=>f.u>0).length,5);
 assert.equal(new Set(natmyaungWeipulaSeparationFields.map(f=>f.id)).size,10);
 const peaks=[...ward.mountains,...ward.weipula.peaks];
 const roads:Rect[]=[];
 for(const r of natmyaungRoads)for(let i=1;i<r.worldPoints.length;i++){
  const [x,z]=r.worldPoints[i-1],[xx,zz]=r.worldPoints[i];roads.push({x:(x+xx)/2,z:(z+zz)/2,width:Math.hypot(xx-x,zz-z)+.15,depth:r.width,rotation:-Math.atan2(zz-z,xx-x)});
 }
 for(const f of natmyaungWeipulaSeparationFields){
  assert.ok(f.v-f.depth/2>natmyaungBoundaryBounds.maxV,'field sits cleanly south of Nat Myaung boundary');
  assert.ok(Math.abs(f.u)-f.width/2>8,'AH1 highway corridor stays completely clear');
  assert.equal(mountainHeight(f.u,f.v,peaks),0,'field sits on flat ground north of Maha Weipula foothills');
  for(const other of natmyaungWeipulaSeparationFields)if(other!==f)assert.ok(!overlaps(f,other));
  const padded={...f,width:f.width+.5,depth:f.depth+.5};
  for(const b of natmyaungVillage.houses)assert.ok(!overlaps(padded,b),`${f.id} clears ${b.id}`);
  for(const p of natmyaungVillage.ponds)assert.ok(!overlaps(padded,p),`${f.id} clears ${p.id}`);
  for(const r of roads)assert.ok(!overlaps(padded,r),`${f.id} clears natmyaung road`);
 }
});
