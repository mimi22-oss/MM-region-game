import fs from 'fs';
import { kanbaleBuildings, kanbaleHouses } from '../src/data/villages/kanbale/kanbaleBuildings.ts';
import { toLocalUV } from '../src/game/locationDetect.ts';

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

const dx = -172.57545025791478;
const dz = 60.811430687791415;

const targetBuildings = kanbaleBuildings.filter(b => pointInPolygon([b.x, b.z], sourceBoundary));
const targetIds = new Set(targetBuildings.map(b => b.id));

console.log('Target IDs:', Array.from(targetIds));

const translatedBuildings = targetBuildings.map(b => {
  const nx = Number((b.x + dx).toFixed(3));
  const nz = Number((b.z + dz).toFixed(3));
  const { u, v } = toLocalUV(nx, nz);
  const nPoly = b.polygonPoints.map(([px, pz]) => [
    Number((px + dx).toFixed(3)),
    Number((pz + dz).toFixed(3))
  ]);
  return {
    ...b,
    x: nx,
    z: nz,
    u: Number(u.toFixed(2)),
    v: Number(v.toFixed(2)),
    polygonPoints: nPoly
  };
});

fs.writeFileSync('scripts/translated_buildings.json', JSON.stringify(translatedBuildings, null, 2));
console.log('Written translated buildings to scripts/translated_buildings.json');
