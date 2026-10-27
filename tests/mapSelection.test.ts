import test from 'node:test';
import assert from 'node:assert/strict';
import { exportMapSelection, insideSelection, readSelectionDraft, selectionError, selectionGeo, selectionMetrics, simplifySelection, selectionAiPrompt, selectionLocationText, selectionGeometry, movedSelectionPoints, selectionDraftError, type MapSelectionDraft } from '../src/game/mapSelection.ts';
import { geoToWorld as centerWorld } from '../src/data/wards/myothar/center/myotharCenterData.ts';
import { geoToWorld as kanbaleWorld } from '../src/data/villages/kanbale/kanbaleData.ts';
import { geoToWorld as sitharWorld } from '../src/data/villages/sithar/sitharData.ts';
import { geoToWorld as natmyaungWorld } from '../src/data/villages/natmyaung/natmyaungData.ts';

const square = [{x:0,z:0},{x:20,z:0},{x:20,z:10},{x:0,z:10}];
const draft: MapSelectionDraft = { points:square, pins:[], name:'ဖြည့်ရန် မြေကွက်', kind:'house', notes:'အိမ်နှင့် သစ်ပင်များ', reference:'myothar-center' };
test('selection rejects crossed, duplicate and degenerate boundaries, and handles concave shapes', () => {
 assert.equal(selectionError(square), '');
 assert.equal(selectionMetrics(square).area, 200);
 assert.deepEqual(selectionMetrics(square).center, {x:10,z:5});
 assert.ok(selectionError([square[0],square[2],square[1],square[3]]));
 assert.ok(selectionError([square[0],square[1],square[1],square[2]]));
 assert.ok(selectionError([{x:0,z:0},{x:1,z:0},{x:2,z:0}]));
 const concave = [{x:0,z:0},{x:10,z:0},{x:10,z:4},{x:4,z:4},{x:4,z:10},{x:0,z:10}];
 assert.equal(selectionError(concave),'');
 assert.equal(insideSelection({x:2,z:8},concave),true);
 assert.equal(insideSelection({x:8,z:8},concave),false);
 assert.equal(insideSelection({x:4,z:7},concave),true);
});
test('each imported region uses its inverse geographic projection including Natmyaung scale', () => {
 for (const [reference, project] of [['myothar-center',centerWorld],['kanbale',kanbaleWorld],['sithar',sitharWorld],['natmyaung',natmyaungWorld]] as const) {
  const source = {lon:94.068,lat:23.16}, world = project(source.lon,source.lat), actual = selectionGeo(world,reference);
  assert.ok(Math.abs(actual.lon-source.lon)<1e-10,reference);
  assert.ok(Math.abs(actual.lat-source.lat)<1e-10,reference);
 }
});
test('GeoJSON closes a CCW longitude/latitude ring and retains exact scene coordinates and instructions', () => {
 const data = exportMapSelection({...draft,pins:[{id:'inside',name:'အိမ် ၁',kind:'house',x:5,z:5},{id:'outside',name:'tree',kind:'tree',x:99,z:99}]});
 assert.equal(data.type,'FeatureCollection');
 assert.equal(data.features.length,2);
 const area = data.features[0], ring = area.geometry.coordinates[0] as number[][];
 assert.equal(area.geometry.type,'Polygon');
 assert.deepEqual(ring[0],ring.at(-1)); assert.equal(ring.length,5);
 const signed = ring.slice(0,-1).reduce((sum,a,i)=>{const b=ring[i+1];return sum+a[0]*b[1]-b[0]*a[1];},0);
 assert.ok(signed>0);
 assert.ok(ring.every(p=>p[0]>90 && p[1]>20 && p[1]<30));
 assert.deepEqual(area.properties.scene_boundary_xz, square.map(p=>[p.x,p.z]));
 assert.equal(area.properties.instructions,draft.notes);
 assert.equal(data.features[1].geometry.type,'Point');
 assert.equal(data.features[1].properties.scene_x,5);
 assert.throws(()=>exportMapSelection({...draft,points:[] }));
});
test('draft restore validates storage and stroke simplification preserves corners', () => {
 assert.deepEqual(readSelectionDraft(JSON.stringify(draft)),draft);
 assert.equal(readSelectionDraft('{broken'),null);
 assert.equal(readSelectionDraft(JSON.stringify({...draft,reference:'unknown'})),null);
 assert.equal(readSelectionDraft(JSON.stringify({...draft,kind:'__proto__'})),null);
 assert.equal(readSelectionDraft(JSON.stringify({...draft,points:[{x:'12',z:0}]})),null);
 const points = [{x:0,z:0},{x:5,z:.01},{x:10,z:0},{x:10,z:10},{x:0,z:10}];
 const simplified = simplifySelection(points,.1);
 assert.equal(simplified.length,4);
 assert.equal(selectionError(simplified),'');
});

test('waterway exports keep an open ordered centerline, scene width, length and midpoint', () => {
 const points=[{x:0,z:0},{x:30,z:0},{x:30,z:40}];
 for(const kind of ['river','stream','canal','drain'] as const) {
  const water={...draft,kind,points,waterWidth:7.5};
  assert.equal(selectionGeometry(kind),'LineString');
  const feature=exportMapSelection(water).features[0];
  assert.equal(feature.geometry.type,'LineString');
  assert.equal(feature.geometry.coordinates.length,3);
  assert.notDeepEqual(feature.geometry.coordinates[0],feature.geometry.coordinates.at(-1));
  assert.deepEqual(feature.properties.scene_path_xz,[[0,0],[30,0],[30,40]]);
  assert.equal(feature.properties.scene_width_m,7.5);
  assert.equal(feature.properties.scene_length_m,70);
  assert.deepEqual(feature.properties.scene_center,{x:30,z:5});
  assert.equal(feature.properties.waterway,kind);
  assert.deepEqual(readSelectionDraft(JSON.stringify(water)),water);
 }
 assert.equal(selectionError(points.slice(0,2),'LineString'),'');
 assert.ok(selectionError(points.slice(0,1),'LineString'));
 assert.ok(selectionError([{x:0,z:0},{x:0,z:0}],'LineString'));
 for(const waterWidth of [-1,0,NaN,Infinity,501]) assert.throws(()=>exportMapSelection({...draft,kind:'river',points,waterWidth}));
});

test('lakes and ponds retain closed area geometry; AI and coordinate copies include usable source data', () => {
 for(const kind of ['lake','pond'] as const) {
  const feature=exportMapSelection({...draft,kind}).features[0];
  assert.equal(feature.geometry.type,'Polygon');
  assert.equal(feature.properties.natural,'water');
  assert.equal(feature.properties.water,kind);
  assert.equal(feature.properties.scene_area_m2,200);
 }
 const river={...draft,kind:'river' as const,points:[{x:0,z:0},{x:25,z:40}],waterWidth:12};
 const prompt=selectionAiPrompt(river),coordinates=selectionLocationText(river);
 assert.ok(prompt.includes('scene_path_xz'));
 assert.ok(prompt.includes('scene_width_m'));
 assert.ok(prompt.includes('[longitude, latitude]'));
 const embedded=JSON.parse(prompt.split('```json\n')[1].split('\n```')[0]);
 assert.deepEqual(embedded,exportMapSelection(river));
 assert.ok(coordinates.includes('Waterway width (scene meters): 12'));
 assert.ok(coordinates.includes('2. Lat:'));
 assert.ok(coordinates.includes('X/Z: 25.000, 40.000'));
 assert.ok(coordinates.includes('not surveyed GPS'));
});

test('CRUD requests retain explicit action and target while legacy drafts default to create', () => {
 assert.equal(exportMapSelection(draft).request.operation,'create');
 for(const operation of ['create','update','delete'] as const) {
  const request={...draft,operation,targetId:'way/123',notes:'အမိုးအရောင်ကို အနီပြောင်းရန်'};
  const data=exportMapSelection(request);
  assert.equal(data.request.operation,operation);
  assert.equal(data.features[0].properties.operation,operation);
  assert.equal(data.features[0].properties.target_id,operation==='create'?null:'way/123');
  assert.ok(selectionLocationText(request).includes(`Operation: ${operation}`));
  assert.ok(selectionAiPrompt(request).includes(`operation=${operation}`));
  assert.deepEqual(readSelectionDraft(JSON.stringify(request)),request);
 }
 assert.ok(selectionDraftError({...draft,operation:'delete',name:'',targetId:''}));
 assert.ok(selectionDraftError({...draft,operation:'update',notes:''}));
 assert.equal(selectionDraftError({...draft,operation:'delete',name:'',targetId:'way/123'}),'');
 assert.equal(readSelectionDraft(JSON.stringify({...draft,operation:'erase-all'})),null);
 assert.equal(readSelectionDraft(JSON.stringify({...draft,moveTo:{x:'bad',z:0}})),null);
});

test('move exports paired source and destination shapes without mutating or resizing the source', () => {
 for(const kind of ['house','river'] as const) {
  const request:MapSelectionDraft={...draft,kind,operation:'move',targetId:'existing-object',moveTo:{x:250,z:-300},waterWidth:5};
  const original=structuredClone(request), data=exportMapSelection(request), source=data.features[0],destination=data.features[1];
  assert.equal(data.features.length,2);
  assert.equal(source.properties.selection_role,'source');
  assert.equal(destination.properties.selection_role,'destination');
  assert.equal(destination.properties.source_feature_id,source.id);
  assert.notEqual(destination.id,source.id);
  assert.equal(destination.properties.operation,'move');
  const moved=movedSelectionPoints(request), geometry=selectionGeometry(kind);
  const center=selectionMetrics(moved,geometry).center;
  assert.ok(Math.hypot(center.x-250,center.z+300)<1e-7);
  assert.equal(selectionMetrics(moved,geometry).area,selectionMetrics(square,geometry).area);
  assert.equal(selectionMetrics(moved,geometry).length,selectionMetrics(square,geometry).length);
  assert.deepEqual(request,original);
  const text=selectionLocationText(request);assert.ok(text.includes('SOURCE /'));assert.ok(text.includes('DESTINATION /'));
  assert.ok(selectionAiPrompt(request).includes('selection_role=destination'));
  assert.deepEqual(readSelectionDraft(JSON.stringify(request)),request);
 }
 assert.ok(selectionDraftError({...draft,operation:'move'}));
 assert.ok(selectionDraftError({...draft,operation:'move',moveTo:{x:10,z:5}}));
});
