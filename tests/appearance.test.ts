import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultAppearance,normalizeAppearance,HUMAN_PRESETS,CAR_MODELS} from '../src/data/appearance.ts';
test('saved appearance round-trips every preset and vehicle model without changing registry defaults',()=>{
 for(const human of Object.values(HUMAN_PRESETS))for(const model of Object.keys(CAR_MODELS)){
  const saved={...defaultAppearance(),human:{...human},car:{model,color:'#9abcde',transmission:'automatic'}};
  assert.deepEqual(normalizeAppearance(JSON.parse(JSON.stringify(saved))),saved);
 }
 const a=normalizeAppearance({human:{preset:'mother'}}),b=defaultAppearance();a.human.clothingColor='#000000';
 assert.equal(HUMAN_PRESETS.mother.clothingColor,'#298c86');assert.equal(b.human.clothingColor,'#6936ae');
});
test('corrupt saved values cannot inject invalid geometry sizes, colors or model identifiers',()=>{
 const a=normalizeAppearance({human:{height:Infinity,hair:'missing',skin:'url(evil)'},robot:{size:100,legs:'missing'},car:{model:'missing',transmission:'missing'}});
 assert.equal(a.human.height,1);assert.equal(a.human.hair,'swept');assert.equal(a.human.skin,'#edba95');assert.equal(a.robot.size,1.25);assert.equal(a.robot.legs,'wheels');assert.equal(a.car.model,'compact');assert.equal(a.car.transmission,'manual');
 assert.deepEqual(normalizeAppearance(null),defaultAppearance());assert.deepEqual(normalizeAppearance('broken'),defaultAppearance());
});
