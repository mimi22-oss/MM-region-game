import { sourceBoundary } from './find_all_in_source_polygon.mjs';
import { kanbaleVillage } from '../src/data/villages/kanbale/index.ts';

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

const insideTrees = kanbaleVillage.trees.filter(t => pointInPolygon([t.x, t.z], sourceBoundary));
console.log(`Kanbale trees inside source polygon: ${insideTrees.length}`);
insideTrees.forEach(t => console.log(`  Tree: id=${t.id}, x=${t.x}, z=${t.z}`));

const insideLargeTrees = kanbaleVillage.largeTrees.filter(t => pointInPolygon([t.x, t.z], sourceBoundary));
console.log(`Kanbale largeTrees inside source polygon: ${insideLargeTrees.length}`);
insideLargeTrees.forEach(t => console.log(`  Large Tree: id=${t.id}, x=${t.x}, z=${t.z}`));
