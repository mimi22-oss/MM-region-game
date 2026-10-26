import {test} from 'node:test';
import assert from 'node:assert/strict';
import {environmentBlend,environmentMinute,localMinute,periodAtMinute,parseEnvironmentPreferences,TIME_PERIODS} from '../src/game/environmentTime.ts';

test('device-local clock follows all four exact boundaries, including midnight',()=>{
 const cases:[number,string][]=[[0,'night'],[299.99,'night'],[300,'morning'],[659.99,'morning'],[660,'day'],[989.99,'day'],[990,'evening'],[1139.99,'evening'],[1140,'night'],[1439.99,'night'],[1440,'night']];
 for(const [minute,expected] of cases)assert.equal(periodAtMinute(minute),expected);
 const date=new Date(2026,9,27,16,30,30);assert.equal(localMinute(date),990.5);assert.equal(environmentMinute('auto',date),990.5);
});
test('manual time stays independent of device time; switching to auto catches up immediately',()=>{
 for(const preset of TIME_PERIODS){
  assert.equal(environmentMinute(preset.id,new Date(2026,9,27,0)),preset.minute);
  assert.equal(environmentMinute(preset.id,new Date(2026,9,27,12)),preset.minute);
  assert.equal(periodAtMinute(preset.minute),preset.id);
 }
 assert.equal(periodAtMinute(environmentMinute('auto',new Date(2026,9,27,19))),'night');
});
test('saved settings survive reload, reject malformed modes and clamp audio volume',()=>{
 assert.deepEqual(parseEnvironmentPreferences(null),{mode:'auto',sound:true,volume:.3});
 assert.deepEqual(parseEnvironmentPreferences('{bad'),parseEnvironmentPreferences(null));
 for(const mode of ['auto',...TIME_PERIODS.map(p=>p.id)]){
  const setting={mode,sound:false,volume:.65};assert.deepEqual(parseEnvironmentPreferences(JSON.stringify(setting)),setting);
 }
 assert.deepEqual(parseEnvironmentPreferences('{"mode":"sunset","sound":"yes","volume":100}'),{mode:'auto',sound:true,volume:1});
 assert.equal(parseEnvironmentPreferences('{"volume":-2}').volume,0);
 assert.equal(parseEnvironmentPreferences('{"volume":null}').volume,.3);
});
test('atmosphere stays continuous across the cycle and uses bounded light/fog values',()=>{
 function sample(minute:number,key:'lamps'|'stars'|'sunlight'|'elevation'|'fogNear'|'fogFar'){
  const {a,b,t}=environmentBlend(minute);return a[key]+(b[key]-a[key])*t;
 }
 for(let m=0;m<1440;m++){
  for(const key of ['lamps','stars'] as const)assert.ok(sample(m,key)>=0&&sample(m,key)<=1);
  assert.ok(sample(m,'fogFar')>sample(m,'fogNear'));
  assert.ok(Math.abs(sample(m+.001,'sunlight')-sample(m-.001,'sunlight'))<.01);
 }
 for(const key of ['lamps','stars','sunlight'] as const)assert.ok(Math.abs(sample(0,key)-sample(1439.999,key))<.001);
 assert.equal(sample(780,'lamps'),0);assert.equal(sample(1260,'lamps'),1);
 assert.equal(sample(780,'stars'),0);assert.equal(sample(1260,'stars'),1);
 assert.ok(sample(1065,'lamps')>0);assert.ok(sample(420,'elevation')<sample(780,'elevation'));
 assert.ok(sample(420,'fogNear')<sample(780,'fogNear'));
});
