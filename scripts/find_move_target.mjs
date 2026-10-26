import { area5 } from '../src/data/wards/myothar/area5.ts';
import { kanbaleBuildings, kanbaleHouses } from '../src/data/villages/kanbale/kanbaleBuildings.ts';
import { kanbaleVillage } from '../src/data/villages/kanbale/index.ts';
import { myotharCenterBuildings } from '../src/data/wards/myothar/center/myotharCenterBuildings.ts';
import { myotharCenterPOIs } from '../src/data/wards/myothar/center/myotharCenterPOIs.ts';
import { MAP_DESTINATIONS } from '../src/game/locationDetect.ts';
import { insideSelection } from '../src/game/mapSelection.ts';

const sourceBoundary = [
  [-71.09459304312583, -428.8307778507101],
  [-49.14035503656379, -438.14470208069224],
  [-41.157003374975034, -438.8099744067603],
  [1.4209000697556462, -438.14470208069224],
  [24.040438318642998, -432.8224676396331],
  [61.96137964838255, -415.5251917480621],
  [70.61000363603938, -404.2153947073612],
  [73.93644901515148, -372.94726038707427],
  [67.94891433176707, -364.29858056690296],
  [33.35436254862515, -343.0096707189235],
  [9.404307563858879, -339.6832811723258],
  [-3.236062045235485, -335.0263190573347],
  [-28.516689598395146, -313.73735337684076],
  [-50.47092760495718, -313.07205313451544],
  [-72.42516561151922, -329.70405670001827],
  [-79.07797262097182, -337.68738044534985],
  [-83.7349347359629, -358.3111017160329],
  [-78.41270029490374, -396.2320709620297]
].map(([x, z]) => ({ x, z }));

console.log('--- Search all items named ဆန်စက် ---');
for (const b of kanbaleBuildings) {
  if (b.name && b.name.includes('ဆန်စက်')) {
    console.log(`KanbaleBuilding: id=${b.id}, name=${b.name}, x=${b.x}, z=${b.z}, insideSource=${insideSelection({ x: b.x, z: b.z }, sourceBoundary)}`);
  }
}
for (const b of myotharCenterBuildings) {
  if (b.name && b.name.includes('ဆန်စက်')) {
    console.log(`MyotharBuilding: id=${b.id}, name=${b.name}, x=${b.x}, z=${b.z}, insideSource=${insideSelection({ x: b.x, z: b.z }, sourceBoundary)}`);
  }
}
for (const p of myotharCenterPOIs) {
  if (p.name && p.name.includes('ဆန်စက်')) {
    console.log(`MyotharCenterPOI: id=${p.id}, name=${p.name}, x=${p.x}, z=${p.z}, insideSource=${insideSelection({ x: p.x, z: p.z }, sourceBoundary)}`);
  }
}
for (const d of MAP_DESTINATIONS) {
  if (d.label && d.label.includes('ဆန်စက်')) {
    console.log(`MAP_DESTINATION: id=${d.id}, label=${d.label}, x=${d.x}, z=${d.z}, insideSource=${insideSelection({ x: d.x, z: d.z }, sourceBoundary)}`);
  }
}

console.log('\n--- Check all buildings inside source boundary ---');
let insideCount = 0;
for (const b of kanbaleBuildings) {
  if (insideSelection({ x: b.x, z: b.z }, sourceBoundary)) {
    insideCount++;
    console.log(`Inside KanbaleBuilding: id=${b.id}, name=${b.name}, x=${b.x.toFixed(2)}, z=${b.z.toFixed(2)}`);
  }
}
for (const b of myotharCenterBuildings) {
  if (insideSelection({ x: b.x, z: b.z }, sourceBoundary)) {
    insideCount++;
    console.log(`Inside MyotharBuilding: id=${b.id}, name=${b.name}, x=${b.x.toFixed(2)}, z=${b.z.toFixed(2)}`);
  }
}
console.log(`Total buildings inside source boundary: ${insideCount}`);
