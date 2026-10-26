import { myotharCenterBuildings, myotharCenterRoads } from '../src/data/wards/myothar/center/index.ts';
import { kanbaleBuildings } from '../src/data/villages/kanbale/kanbaleBuildings.ts';

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

console.log('Checking collisions for', targetBuildings.length, 'moved buildings:');

let buildingCollisions = 0;
for (const tb of targetBuildings) {
  const newX = tb.x + dx;
  const newZ = tb.z + dz;
  const tbRadius = Math.max(tb.width, tb.depth) / 2;

  // Check against existing MC buildings (except the rice mill which is at -156.825, -306.959)
  for (const mb of myotharCenterBuildings) {
    if (mb.id === 'way/403027697') continue;
    const mbRadius = Math.max(mb.width, mb.depth) / 2;
    const dist = Math.hypot(newX - mb.x, newZ - mb.z);
    if (dist < (tbRadius + mbRadius) * 0.7) {
      console.log(`Collision between moved ${tb.id} and MC ${mb.id} (${mb.name}): dist=${dist.toFixed(1)}, rSum=${(tbRadius+mbRadius).toFixed(1)}`);
      buildingCollisions++;
    }
  }
}

console.log(`Total building collisions: ${buildingCollisions}`);
