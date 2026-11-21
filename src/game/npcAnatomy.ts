import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// These small meshes are shared by the village, household and school rigs.
type ProfileRow = [y: number, width: number, depth: number, x?: number, z?: number, pleatDepth?: number];

export function npcProfile(rows: readonly ProfileRow[], sides = 12): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [y, width, depth, x = 0, z = 0, pleatDepth = 0] of rows) {
    for (let side = 0; side < sides; side++) {
      const angle = side * Math.PI * 2 / sides;
      const pleat = 1 - (side % 2) * pleatDepth;
      positions.push(x + Math.cos(angle) * width * pleat, y, z + Math.sin(angle) * depth * pleat);
    }
  }
  for (let row = 0; row < rows.length - 1; row++) {
    for (let side = 0; side < sides; side++) {
      const a = row * sides + side;
      const b = row * sides + (side + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function npcScalpHair(hairline: (angle: number) => number, rearY: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const rings = 12;
  const sides = 32;
  for (let row = 0; row <= rings; row++) {
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const front = Math.sin(angle);
      const edgeY = front > 0 ? .027 + front * hairline(angle) : .027 - front * rearY;
      const edgeLatitude = Math.asin(Math.max(-1, Math.min(1, (edgeY - .01) / .163)));
      const latitude = row === rings ? Math.PI / 2 : edgeLatitude + (Math.PI / 2 - edgeLatitude) * row / rings;
      const edgeTaper = row === 0 ? .98 : 1;
      const radius = Math.pow(Math.max(0, Math.cos(latitude)), .68) * edgeTaper;
      const x = Math.cos(angle) * radius * .152;
      const y = .01 + Math.sin(latitude) * .163;
      const z = front * radius * .155 - .001;
      positions.push(x, y, z);
      if (row < rings) {
        const a = row * sides + side;
        const b = row * sides + (side + 1) % sides;
        indices.push(a, a + sides, b, b, a + sides, b + sides);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const npcCroppedHairGeometry = npcScalpHair(angle => .041 + .008 * Math.cos(angle * 5), -.082);
export const npcTiedHairGeometry = npcScalpHair(angle => .046 + .026 * Math.pow(Math.sin(angle), 12), -.102);
const sphere = new SphereGeometry(1, 12, 8);

export function npcEllipsoid(x: number, y: number, z: number, width: number, height: number, depth: number) {
  const geometry = sphere.clone().scale(width, height, depth).translate(x, y, z);
  geometry.deleteAttribute('uv');
  return geometry;
}

export function joinNpcGeometry(parts: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return geometry;
}

function tinted(geometry: BufferGeometry, r: number, g: number, b: number) {
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([r, g, b], i);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function makeEyes() {
  return [-1, 1].flatMap(side => {
    // Align the corners of the eyelids with the curve of the cheek.
    const eye = (x: number, y: number, z: number, w: number, h: number, d: number, tilt = 0) =>
      npcEllipsoid(0, 0, 0, w, h, d).rotateZ(tilt).rotateY(side * .25).translate(side * .052 + x, y, z);
    return [
      tinted(eye(0, .012, .138, .026, .011, .009, side * .09), .12, .062, .044),
      tinted(eye(0, .011, .142, .023, .0082, .007, side * .09), .88, .84, .77),
      tinted(eye(-side * .0015, .012, .148, .010, .009, .003), .19, .09, .047),
      tinted(eye(-side * .0015, .012, .151, .0056, .0064, .0018), .018, .012, .011),
      tinted(eye(-.003, .016, .1525, .0024, .0023, .001), .95, .94, .9),
      tinted(eye(0, .035, .138, .026, .0044, .005, side * -.08), .064, .038, .031),
    ];
  });
}

export const npcFaceMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: .76 });
export const npcEyesGeometry = joinNpcGeometry(makeEyes());
export const npcFaceGeometry = joinNpcGeometry([
  npcEyesGeometry.clone(),
  tinted(npcEllipsoid(0, -.059, .131, .031, .0045, .007), .25, .083, .058),
  tinted(npcEllipsoid(0, -.064, .13, .022, .004, .006), .38, .156, .11),
]);

export const npcHeadGeometry = joinNpcGeometry([
  npcProfile([
    [-.147, 0, 0], [-.133, .058, .066, 0, .014], [-.104, .097, .096, 0, .005],
    [-.061, .121, .124], [-.015, .139, .143], [.036, .139, .141],
    [.084, .124, .126], [.124, .095, .102], [.151, .045, .047], [.158, 0, 0],
  ], 24),
  npcEllipsoid(0, -.012, .141, .017, .035, .022),
  npcEllipsoid(0, -.031, .154, .021, .013, .019),
  npcEllipsoid(-.135, -.029, -.007, .018, .033, .019).rotateZ(-.03),
  npcEllipsoid(.135, -.029, -.007, .018, .033, .019).rotateZ(.03),
]);

// The origin is at the wrist. Mirror X for the opposite hand.
export const npcHandGeometry = joinNpcGeometry([
  npcProfile([
    [-.048, 0, 0], [-.043, .029, .011], [-.028, .034, .016], [-.009, .03, .017],
    [.009, .025, .018], [.018, .024, .017], [.02, 0, 0],
  ]),
  ...[.022, .007, -.009, -.024].map((x, i) => {
    const tip = [-.077, -.085, -.08, -.069][i];
    const endX = x * 1.11;
    const radius = [.0085, .0085, .0077, .0067][i];
    return npcProfile([
      [tip - .004, 0, 0, endX, .011], [tip, radius * .64, radius * .72, endX, .011],
      [tip + .009, radius * .77, radius * .83, endX, .007],
      [-.05, radius, radius, x, .002], [-.034, radius, radius, x, 0], [-.028, 0, 0, x, 0],
    ], 8);
  }),
  npcProfile([
    [-.044, 0, 0, .041, .015], [-.039, .0078, .008, .041, .013],
    [-.025, .011, .011, .041, .008], [-.01, .014, .012, .028, .006],
    [.003, .013, .012, .021, .004], [.012, 0, 0, .018, .003],
  ], 10),
]);

// The heel is under the ankle and the longer toe box faces +Z.
export const npcShoeGeometry = npcProfile([
  [0, 0, 0, 0, .04], [0, .038, .081, 0, .037], [.009, .048, .094, 0, .04],
  [.026, .048, .094, 0, .04], [.046, .043, .082, 0, .033],
  [.063, .034, .046, 0, .005], [.074, .029, .034, 0, -.003], [.075, 0, 0],
], 16);

export const npcSandalFootGeometry = npcProfile([
  [.002, 0, 0, 0, .03], [.008, .035, .078, 0, .036], [.024, .041, .082, 0, .037],
  [.041, .034, .065, 0, .025], [.067, .026, .034], [.092, .025, .026], [.093, 0, 0],
], 16);

export const npcSleeveGeometry = npcProfile([
  [-.46, 0, 0], [-.46, .034, .033], [-.38, .039, .037], [-.25, .043, .041],
  [-.12, .053, .049], [-.015, .056, .052], [.025, .044, .042], [.043, 0, 0],
]);

const calfProfile: ProfileRow[] = [
  [-.265, 0, 0], [-.263, .027, .028], [-.21, .029, .03],
  [-.14, .039, .039, 0, -.008], [-.08, .046, .044, 0, -.006],
];

export const npcCalfGeometry = npcProfile([
  ...calfProfile,
  [-.018, .043, .044], [.032, .036, .036], [.048, 0, 0],
]);

export const npcLowerLegGeometry = npcProfile([
  ...calfProfile,
  [-.018, .043, .044], [.05, .047, .048], [.17, .057, .057], [.25, .058, .057], [.28, 0, 0],
]);
