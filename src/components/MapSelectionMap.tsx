import { memo } from 'react';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { myotharCenterBuildings } from '../data/wards/myothar/center/myotharCenterBuildings';
import { myotharCenterRoads } from '../data/wards/myothar/center/myotharCenterRoads';
import { kanbaleRoads } from '../data/villages/kanbale/kanbaleRoads';
import { natmyaungRoads } from '../data/villages/natmyaung/natmyaungRoads';

type Rectangle = { x: number; z: number; width: number; depth: number; rotation: number };
function rectanglePath(r: Rectangle) {
 const c = Math.cos(r.rotation), s = Math.sin(r.rotation);
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v], i) => `${i ? 'L' : 'M'}${r.x + c*u*r.width/2 + s*v*r.depth/2},${r.z - s*u*r.width/2 + c*v*r.depth/2}`).join('') + 'Z';
}
// Static, batched SVG paths keep dragging a large map inexpensive, including on phones.
const houses = [...ward.houses, ...kalayVillages.flatMap(v => v.houses)].map(rectanglePath).join('') +
 myotharCenterBuildings.map(b => rectanglePath({ ...b, width: b.houseWidth ?? b.width, depth: b.houseLength ?? b.depth })).join('');
const roads = [...ward.roads, ...kalayVillages.filter(v => v.id !== 'kanbale' && v.id !== 'natmyaung').flatMap(v => v.roads)].map(rectanglePath).join('');
const polylines = [...myotharCenterRoads, ...kanbaleRoads, ...natmyaungRoads];
const trees = [...ward.trees, ...kalayVillages.flatMap(v => v.trees)].map(t => `M${t.x-1.5},${t.z}a1.5,1.5 0 1,0 3,0a1.5,1.5 0 1,0 -3,0`).join('');
export const MapSelectionMap = memo(function MapSelectionMap() {
 return <g pointerEvents="none" aria-hidden="true">
  <rect x={-20000} y={-20000} width={40000} height={40000} fill="#c1cfab" />
  <path d={roads} fill="#89948e" />
  {polylines.map((road, index) => <path key={`${index}:${road.id}`} d={road.worldPoints.map((p,i) => `${i?'L':'M'}${p[0]},${p[1]}`).join('')} fill="none" stroke="#89948e" strokeWidth={road.width} strokeLinejoin="round" strokeLinecap="round" />)}
  <path d={houses} fill="#ae927a" stroke="#715f52" strokeWidth={0.5} />
  <path d={trees} fill="#5d8551" />
 </g>;
});
