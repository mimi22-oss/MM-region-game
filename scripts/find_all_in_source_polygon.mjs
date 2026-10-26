import fs from 'fs';

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
  [-78.41270029490374, -396.2320709620297],
];

function pointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// 1. Kanbale buildings
import { kanbaleBuildings, kanbaleHouses } from '../src/data/villages/kanbale/kanbaleBuildings.ts';

const insideBuildings = kanbaleBuildings.filter(b => pointInPolygon([b.x, b.z], sourceBoundary));
console.log(`Kanbale buildings inside polygon: ${insideBuildings.length}`);
insideBuildings.forEach(b => console.log(`  Building: id=${b.id}, name=${b.name}, x=${b.x}, z=${b.z}`));

const insideHouses = kanbaleHouses.filter(h => pointInPolygon([h.x, h.z], sourceBoundary));
console.log(`Kanbale houses inside polygon: ${insideHouses.length}`);
insideHouses.forEach(h => console.log(`  House: id=${h.id}, name=${h.name}, x=${h.x}, z=${h.z}`));

// 2. Check Myothar center buildings if any in that area
import { myotharCenterBuildings } from '../src/data/wards/myothar/center/myotharCenterBuildings.ts';
const insideMC = myotharCenterBuildings.filter(b => pointInPolygon([b.x, b.z], sourceBoundary));
console.log(`Myothar center buildings inside source polygon: ${insideMC.length}`);
insideMC.forEach(b => console.log(`  MC Building: id=${b.id}, name=${b.name}, x=${b.x}, z=${b.z}`));

// 3. Check trees
// Let's find tree files
