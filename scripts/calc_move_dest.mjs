import { toWorld } from '../src/data/wards/myothar/area5.ts';
import { kanbaleBuildings } from '../src/data/villages/kanbale/kanbaleBuildings.ts';
import { myotharCenterBuildings } from '../src/data/wards/myothar/center/myotharCenterBuildings.ts';
import { myotharCenterRoads } from '../src/data/wards/myothar/center/myotharCenterRoads.ts';
import { detectLocation, toLocalUV } from '../src/game/locationDetect.ts';

const b = kanbaleBuildings.find(item => item.id === 'way/403027697');
console.log('Original Building way/403027697:');
console.log(b);

const dx = -172.57545025791478;
const dz = 60.811430687791415;

const newX = b.x + dx;
const newZ = b.z + dz;
const newUV = toLocalUV(newX, newZ);
console.log('\nNew Building Center:');
console.log(`x = ${newX.toFixed(3)}, z = ${newZ.toFixed(3)}`);
console.log(`u = ${newUV.u.toFixed(3)}, v = ${newUV.v.toFixed(3)}`);

const newPolygon = b.polygonPoints.map(([px, pz]) => [Number((px + dx).toFixed(3)), Number((pz + dz).toFixed(3))]);
console.log('\nNew Polygon Points count:', newPolygon.length);
console.log('Sample points:', newPolygon.slice(0, 3));

// Check collision with other buildings in Myothar Center
const bRad = Math.hypot(b.width, b.depth) / 2;
console.log('\n--- Checking collision with existing Myothar Center buildings ---');
for (const mb of myotharCenterBuildings) {
  const dist = Math.hypot(mb.x - newX, mb.z - newZ);
  const mbRad = Math.hypot(mb.width, mb.depth) / 2;
  if (dist < bRad + mbRad) {
    console.log(`Collides with Myothar building: ${mb.id} (${mb.name}) at dist = ${dist.toFixed(2)}m (radii sum = ${(bRad + mbRad).toFixed(2)}m)`);
  }
}

// Check collision with roads in Myothar Center
console.log('\n--- Checking road proximity ---');
for (const r of myotharCenterRoads) {
  for (let i = 0; i < r.worldPoints.length - 1; i++) {
    const p1 = r.worldPoints[i];
    const p2 = r.worldPoints[i+1];
    const rdx = p2[0] - p1[0];
    const rdz = p2[1] - p1[1];
    const len = Math.hypot(rdx, rdz);
    const t = Math.max(0, Math.min(1, ((newX - p1[0])*rdx + (newZ - p1[1])*rdz) / (len * len)));
    const px = p1[0] + rdx * t;
    const pz = p1[1] + rdz * t;
    const d = Math.hypot(newX - px, newZ - pz);
    if (d < bRad + r.width / 2) {
      console.log(`Near/on road ${r.id} (${r.name}): dist = ${d.toFixed(2)}m (bRad + halfWidth = ${(bRad + r.width/2).toFixed(2)}m)`);
    }
  }
}

// Location detection
const loc = detectLocation(newX, newZ);
console.log('\nDetected Location at new position:');
console.log(loc);
