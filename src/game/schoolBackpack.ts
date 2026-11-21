import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { joinNpcGeometry } from './npcAnatomy.ts';

type Point = [number, number, number];

export const SCHOOL_BACKPACK_POSITION: Point = [0, 1.10, -.17];

const path = (points: Point[]) => new CatmullRomCurve3(points.map(point => new Vector3(...point)));

function webbing(points: Point[]) {
  const curve = path(points);
  const steps = 20;
  const sides = 8;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const across = new Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
    const normal = new Vector3().crossVectors(tangent, across);
    for (let side = 0; side < sides; side++) {
      const angle = Math.PI * 2 * side / sides;
      const point = center.clone()
        .addScaledVector(across, Math.cos(angle) * .015)
        .addScaledVector(normal, Math.sin(angle) * .004);
      vertices.push(point.x, point.y, point.z);
      if (i < steps) {
        const a = i * sides + side;
        const b = i * sides + (side + 1) % sides;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Each of the three existing colorways can render the entire pack in one draw call.
function shade(part: BufferGeometry, brightness: number) {
  const geometry = part.index ? part.toNonIndexed() : part;
  if (geometry !== part) part.dispose();
  geometry.deleteAttribute('uv');
  const colors = new Float32Array(geometry.getAttribute('position').count * 3).fill(brightness);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

const cord = (points: Point[], radius: number, steps: number) => new TubeGeometry(path(points), steps, radius, 6, false);

export function createSchoolBackpackGeometry(): BufferGeometry {
  return joinNpcGeometry([
    shade(new RoundedBoxGeometry(.244, .338, .153, 2, .045).translate(0, -.008, -.028), 1),
    shade(new RoundedBoxGeometry(.18, .13, .05, 2, .022).translate(0, -.082, -.109), .82),
    shade(cord([
      [-.113, -.047, -.092], [-.112, .072, -.095], [-.085, .132, -.100],
      [-.043, .149, -.094], [0, .151, -.091], [.043, .149, -.094],
      [.085, .132, -.100], [.112, .072, -.095], [.113, -.047, -.092],
    ], .0039, 24), .13),
    shade(cord([[-.073, -.047, -.132], [-.04, -.043, -.135], [.043, -.043, -.135], [.073, -.047, -.132]], .0034, 12), .16),
    shade(cord([[-.042, .142, -.022], [-.034, .192, -.026], [0, .208, -.027], [.034, .192, -.026], [.042, .142, -.022]], .008, 14), .28),
    shade(new RoundedBoxGeometry(.010, .026, .006, 1, .003).rotateZ(.21).translate(.107, .063, -.101), 1.2),
    shade(new RoundedBoxGeometry(.009, .020, .005, 1, .0025).rotateZ(-.17).translate(.058, -.056, -.137), 1.2),
    ...[-1, 1].flatMap(side => [
      shade(webbing([
        [.083, .143, .014], [.094, .207, .057], [.098, .232, .107], [.102, .243, .169],
        [.106, .227, .223], [.109, .194, .268], [.108, .093, .275], [.117, .007, .271],
        [.136, -.079, .247], [.157, -.121, .178],
        [.129, -.135, .072], [.105, -.112, .023],
      ].map(([x, y, z]): Point => [side * x, y, z])), .36),
      shade(new RoundedBoxGeometry(.035, .015, .011, 1, .003)
        .rotateZ(side * .12).translate(side * .123, -.025, .265), .16),
    ]),
  ]);
}
