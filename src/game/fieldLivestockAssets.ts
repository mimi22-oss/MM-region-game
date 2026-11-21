import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, MeshStandardMaterial, Vector3 } from 'three';
import { joinNpcGeometry, npcEllipsoid, npcProfile } from './npcAnatomy.ts';
import type { LivestockSpecies } from './fieldLivestockPool.ts';

type Point = [x: number, y: number, z: number];
type Section = [z: number, halfWidth: number, bottom: number, top: number];
type SweepSection = [x: number, y: number, z: number, halfWidth: number, halfDepth: number];

function barrel(rows: Section[], sides = 16) {
  return npcProfile(
    rows.map(([z, width, bottom, top]) => [z, width, (top - bottom) / 2, 0, -(top + bottom) / 2]),
    sides,
  ).rotateX(Math.PI / 2);
}

function sweep(rows: SweepSection[], reference: Point = [1, 0, 0], sides = 10) {
  const curve = new CatmullRomCurve3(rows.map(([x, y, z]) => new Vector3(x, y, z)));
  const across = new Vector3(...reference);
  const positions: number[] = [];
  const indices: number[] = [];
  const steps = (rows.length - 1) * 3;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const center = curve.getPoint(t);
    const forward = curve.getTangent(t);
    const u = across.clone().addScaledVector(forward, -across.dot(forward)).normalize();
    const v = forward.clone().cross(u);
    const row = Math.min(rows.length - 2, Math.floor(i / 3));
    const blend = i / 3 - row;
    const w = rows[row][3] * (1 - blend) + rows[row + 1][3] * blend;
    const h = rows[row][4] * (1 - blend) + rows[row + 1][4] * blend;
    for (let j = 0; j < sides; j++) {
      const angle = j * Math.PI * 2 / sides;
      const pt = center.clone().addScaledVector(u, Math.cos(angle) * w).addScaledVector(v, Math.sin(angle) * h);
      positions.push(pt.x, pt.y, pt.z);
      if (i < steps) {
        const a = i * sides + j;
        const b = i * sides + (j + 1) % sides;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface LivestockLegModel {
  readonly hip: Point;
  readonly upperLength: number;
  readonly lowerLength: number;
  readonly hoofHeight: number;
  readonly upper: BufferGeometry;
  readonly lower: BufferGeometry;
  readonly hoof: BufferGeometry;
}

interface LivestockModel {
  readonly bodyY: number;
  readonly neckAnchor: Point;
  readonly headAnchor: Point;
  readonly earAnchor: Point;
  readonly tailAnchor: Point;
  readonly neckRest: number;
  readonly grazePitchOffset: number;
  readonly headRest: number;
  readonly headGraze: number;
  readonly strideLength: number;
  readonly front: LivestockLegModel;
  readonly hind: LivestockLegModel;
  readonly meshes: {
    readonly body: BufferGeometry;
    readonly neck: BufferGeometry;
    readonly head: BufferGeometry;
    readonly muzzle: BufferGeometry;
    readonly eyes: BufferGeometry;
    readonly noseDetails: BufferGeometry;
    readonly ear: BufferGeometry;
    readonly horns: BufferGeometry | null;
    readonly mane: BufferGeometry | null;
    readonly tail: BufferGeometry;
    readonly tuft: BufferGeometry | null;
  };
}

const twoSides = [-1, 1] as const;

function makeHoof(height: number, width: number, split: boolean) {
  const toe = (x: number, halfWidth: number) => npcProfile([
    [-height, 0, 0, x, .016], [-height, halfWidth, .064, x, .016],
    [-height + .018, halfWidth, .066, x, .016], [-.052, halfWidth * .89, .058, x, .011],
    [0, halfWidth * .75, .038, x], [.017, 0, 0, x],
  ], 10);
  return split ? joinNpcGeometry(twoSides.map(side => toe(side * width * .52, width * .47))) : toe(0, width);
}

function makeLeg(hip: Point, upperLength: number, lowerLength: number, hoofHeight: number, size: number, hind: boolean, split: boolean): LivestockLegModel {
  const shoulder = hind ? .156 : .114;
  const upper = npcProfile([
    [-upperLength - .041, 0, 0], [-upperLength - .022, .04 * size, .043 * size],
    [-upperLength + .045, .052 * size, .061 * size], [-upperLength * .60, .068 * size, .078 * size, 0, hind ? .06 : .014],
    [-upperLength * .24, shoulder * .81 * size, shoulder * 1.11 * size, 0, hind ? .032 : .013],
    [.025, shoulder * size, shoulder * 1.31 * size], [.142, shoulder * .79 * size, shoulder * size],
    [.215, 0, 0],
  ]);
  const lower = npcProfile([
    [-lowerLength - .02, 0, 0], [-lowerLength - .006, .034 * size, .038 * size],
    [-lowerLength + .077, .031 * size, .035 * size, 0, -.005],
    [-lowerLength * .5, .034 * size, .04 * size, 0, hind ? -.014 : -.004],
    [-.075, .043 * size, .050 * size, 0, hind ? -.021 : -.007],
    [0, .052 * size, .058 * size], [.041, .036 * size, .04 * size], [.058, 0, 0],
  ], 10);
  return { hip, upperLength, lowerLength, hoofHeight, upper, lower, hoof: makeHoof(hoofHeight, .060 * size, split) };
}

function eyePair(x: number, y: number, z: number, size: number) {
  return joinNpcGeometry(twoSides.map(side =>
    npcEllipsoid(side * x, y, z, size * .61, size, size * 1.24),
  ));
}

function nostrils(x: number, y: number, z: number, size: number) {
  return joinNpcGeometry(twoSides.map(side => npcEllipsoid(0, 0, 0, size, size * .55, size * .24)
    .rotateZ(-side * .30).rotateY(side * .28).translate(side * x, y, z)));
}

function horns(path: SweepSection[]) {
  return joinNpcGeometry(twoSides.map(side =>
    sweep(path.map(([x, y, z, w, h]) => [side * x, y, z, w, h]), [0, 0, 1], 11),
  ));
}

function ruminantTail(length: number) {
  return sweep([
    [0, .025, .017, 0, 0], [0, -.035, -.02, .033, .033],
    [0, -length * .29, -.09, .026, .026], [0, -length * .62, -.095, .018, .02],
    [0, -length * .94, -.065, .014, .017], [0, -length, -.077, 0, 0],
  ], [1, 0, 0], 8);
}

function makeCow(): LivestockModel {
  return {
    bodyY: 1.01, neckAnchor: [0, .14, .61], headAnchor: [0, .56, .43], earAnchor: [.144, .041, -.072],
    tailAnchor: [0, .15, -.91], neckRest: .15, grazePitchOffset: 1.24, headRest: .18, headGraze: -.64, strideLength: .79,
    front: makeLeg([.235, .02, .62], .48, .47, .105, .91, false, true),
    hind: makeLeg([.224, .025, -.64], .49, .466, .105, .93, true, true),
    meshes: {
      body: barrel([
        [-1.045, 0, .10, .10], [-.974, .18, -.087, .274], [-.836, .265, -.225, .322],
        [-.628, .296, -.273, .372], [-.39, .303, -.297, .339], [-.08, .332, -.357, .386],
        [.17, .314, -.367, .562], [.32, .296, -.338, .658], [.43, .283, -.316, .633],
        [.57, .266, -.288, .49], [.74, .24, -.245, .329], [.907, .18, -.164, .231], [.98, 0, .012, .012],
      ], 20),
      neck: joinNpcGeometry([
        sweep([
          [0, -.12, -.12, 0, 0], [0, -.06, -.051, .16, .224], [0, .053, .03, .19, .248],
          [0, .23, .147, .169, .23], [0, .42, .28, .126, .163],
          [0, .545, .414, .12, .115], [0, .626, .474, 0, 0],
        ]),
        sweep([
          [0, -.180, .19, 0, 0], [0, -.115, .28, .052, .059], [0, .017, .34, .058, .075],
          [0, .165, .405, .055, .079], [0, .32, .461, .047, .068], [0, .462, .493, 0, 0],
        ]),
      ]),
      head: barrel([
        [-.153, 0, -.011, -.011], [-.124, .101, -.113, .113], [-.045, .151, -.143, .133],
        [.082, .146, -.132, .112], [.181, .115, -.15, .052], [.282, .116, -.153, .013],
        [.351, .123, -.149, .022], [.388, 0, -.081, -.081],
      ]),
      muzzle: npcEllipsoid(0, -.079, .328, .149, .081, .114),
      eyes: eyePair(.14, .047, .069, .025),
      noseDetails: nostrils(.080, -.061, .422, .022),
      ear: sweep([
        [0, 0, 0, .022, .026], [.062, -.015, -.005, .056, .021],
        [.143, -.045, -.012, .064, .016], [.211, -.067, -.02, .037, .012], [.242, -.076, -.02, 0, 0],
      ], [0, 1, 0]),
      horns: horns([[.105, .096, -.089, .051, .047], [.169, .148, -.106, .044, .040],
        [.224, .213, -.125, .030, .027], [.252, .276, -.103, .014, .012], [.248, .313, -.082, 0, 0]]),
      mane: null,
      tail: ruminantTail(.755),
      tuft: npcEllipsoid(0, -.744, -.076, .04, .10, .039),
    },
  };
}

function makeBuffalo(): LivestockModel {
  return {
    bodyY: 1.05, neckAnchor: [0, .16, .68], headAnchor: [0, .54, .46], earAnchor: [.182, .027, -.11],
    tailAnchor: [0, .17, -.99], neckRest: 0, grazePitchOffset: 1.31, headRest: .18, headGraze: -.64, strideLength: .77,
    front: makeLeg([.293, .017, .68], .515, .48, .12, 1.11, false, true),
    hind: makeLeg([.278, .018, -.72], .527, .472, .12, 1.14, true, true),
    meshes: {
      body: barrel([
        [-1.13, 0, .09, .09], [-1.05, .223, -.13, .288], [-.895, .332, -.278, .365],
        [-.661, .392, -.367, .381], [-.34, .425, -.427, .39], [-.01, .432, -.433, .4],
        [.28, .398, -.414, .426], [.58, .347, -.35, .445], [.817, .28, -.296, .32],
        [.967, .207, -.169, .219], [1.052, 0, .02, .02],
      ], 20),
      neck: sweep([
        [0, -.091, -.115, 0, 0], [0, -.031, -.071, .173, .197], [0, .094, .032, .228, .247], [0, .202, .134, .213, .24],
        [0, .366, .28, .171, .178], [0, .51, .423, .16, .143], [0, .611, .511, 0, 0],
      ]),
      head: barrel([
        [-.184, 0, -.012, -.012], [-.146, .133, -.13, .139], [-.07, .194, -.157, .154],
        [.066, .185, -.169, .128], [.18, .153, -.174, .063], [.291, .164, -.184, .018],
        [.407, .146, -.173, -.009], [.455, 0, -.087, -.087],
      ]),
      muzzle: npcEllipsoid(0, -.095, .37, .181, .087, .137),
      eyes: eyePair(.183, .046, .06, .029),
      noseDetails: nostrils(.094, -.068, .479, .025),
      ear: sweep([
        [0, .01, 0, .026, .028], [.08, -.013, -.009, .058, .024],
        [.153, -.042, -.027, .057, .022], [.21, -.054, -.035, .032, .012], [.238, -.048, -.039, 0, 0],
      ], [0, 1, 0]),
      horns: horns([[.139, .096, -.09, .104, .079], [.265, .094, -.115, .085, .066],
        [.419, .102, -.202, .062, .049], [.553, .151, -.313, .045, .037],
        [.618, .235, -.44, .03, .025], [.615, .324, -.532, .015, .014], [.572, .404, -.575, 0, 0]]),
      mane: null,
      tail: ruminantTail(.81),
      tuft: npcEllipsoid(0, -.796, -.076, .044, .112, .041),
    },
  };
}

function makeHorse(): LivestockModel {
  return {
    bodyY: 1.25, neckAnchor: [0, .17, .61], headAnchor: [0, .79, .51], earAnchor: [.078, .102, -.086],
    tailAnchor: [0, .238, -.883], neckRest: 0, grazePitchOffset: 1.02, headRest: .39, headGraze: -.60, strideLength: 1.0,
    front: makeLeg([.19, .01, .632], .59, .61, .11, .87, false, false),
    hind: makeLeg([.201, .01, -.642], .62, .58, .115, .93, true, false),
    meshes: {
      body: barrel([
        [-1.052, 0, .143, .143], [-.984, .16, -.069, .276], [-.84, .245, -.229, .344],
        [-.629, .28, -.287, .367], [-.417, .249, -.258, .335], [-.113, .284, -.325, .333],
        [.17, .304, -.34, .362], [.385, .296, -.322, .4], [.593, .269, -.311, .444],
        [.75, .231, -.245, .38], [.887, .167, -.141, .236], [.954, 0, .05, .05],
      ], 20),
      neck: sweep([
        [0, -.10, -.105, 0, 0], [0, -.049, -.075, .149, .194], [0, .065, -.032, .174, .238],
        [0, .279, .078, .155, .246], [0, .485, .25, .122, .199],
        [0, .664, .376, .098, .139], [0, .781, .478, .093, .103], [0, .859, .533, 0, 0],
      ], [1, 0, 0], 14),
      head: barrel([
        [-.17, 0, -.011, -.011], [-.128, .085, -.095, .095], [-.031, .129, -.137, .137],
        [.074, .125, -.172, .119], [.187, .093, -.172, .057], [.288, .082, -.188, .012],
        [.385, .09, -.198, -.02], [.444, .076, -.179, -.037], [.485, 0, -.104, -.104],
      ]),
      muzzle: npcEllipsoid(0, -.119, .419, .097, .08, .116),
      eyes: eyePair(.122, .053, .075, .024),
      noseDetails: nostrils(.054, -.088, .513, .021),
      ear: sweep([
        [0, -.014, 0, .036, .028], [.022, .051, -.013, .036, .029],
        [.038, .106, -.02, .026, .023], [.052, .154, -.023, .018, .013], [.057, .181, -.024, 0, 0],
      ]),
      horns: null,
      mane: sweep([
        [0, .06, -.312, 0, 0], [0, .238, -.156, .076, .141], [-.016, .413, -.014, .091, .152],
        [-.017, .563, .096, .092, .149], [0, .7, .238, .067, .116],
        [0, .819, .356, .057, .089], [0, .867, .448, .037, .074], [0, .835, .507, 0, 0],
      ]),
      tail: sweep([
        [0, .015, .015, 0, 0], [0, -.034, -.036, .049, .054],
        [0, -.148, -.163, .068, .077], [0, -.33, -.255, .089, .084],
        [0, -.54, -.284, .085, .072], [0, -.729, -.294, .061, .053],
        [0, -.922, -.314, .043, .037], [0, -1.06, -.356, 0, 0],
      ], [1, 0, 0], 13),
      tuft: null,
    },
  };
}

const material = (color: string, roughness = .84) => new MeshStandardMaterial({ color, roughness });

export interface FieldLivestockAssetCache {
  readonly models: Record<LivestockSpecies, LivestockModel>;
  readonly coats: Record<LivestockSpecies, readonly MeshStandardMaterial[]>;
  readonly muzzles: Record<LivestockSpecies, MeshStandardMaterial>;
  readonly horns: Record<'cow' | 'buffalo', MeshStandardMaterial>;
  readonly horseHair: readonly MeshStandardMaterial[];
  readonly hoof: MeshStandardMaterial;
  readonly eyes: MeshStandardMaterial;
  readonly nostrils: MeshStandardMaterial;
}

let cache: FieldLivestockAssetCache | null = null;

export function getFieldLivestockAssetCache(): FieldLivestockAssetCache {
  if (cache) return cache;
  cache = {
    models: { cow: makeCow(), buffalo: makeBuffalo(), horse: makeHorse() },
    coats: {
      cow: ['#b17c48', '#ddcfb5', '#965638', '#ca9f70'].map(color => material(color)),
      buffalo: ['#44474a', '#505253', '#3d4145', '#5a5853'].map(color => material(color)),
      horse: ['#874a28', '#9e5630', '#594031', '#be8b56'].map(color => material(color, .78)),
    },
    muzzles: { cow: material('#554438', .63), buffalo: material('#5c5751', .68), horse: material('#685143', .62) },
    horns: { cow: material('#cfbd9a', .61), buffalo: material('#343230', .62) },
    horseHair: [material('#271d18'), material('#3a2a21')],
    hoof: material('#29241e', .68),
    eyes: material('#211916', .25),
    nostrils: material('#241f1e', .74),
  };
  return cache;
}

export function disposeFieldLivestockAssetCache() {
  if (!cache) return;
  for (const model of Object.values(cache.models)) {
    for (const mesh of Object.values(model.meshes)) mesh?.dispose();
    for (const leg of [model.front, model.hind]) {
      leg.upper.dispose();
      leg.lower.dispose();
      leg.hoof.dispose();
    }
  }
  for (const coats of Object.values(cache.coats)) coats.forEach(mat => mat.dispose());
  Object.values(cache.muzzles).forEach(mat => mat.dispose());
  Object.values(cache.horns).forEach(mat => mat.dispose());
  cache.horseHair.forEach(mat => mat.dispose());
  cache.hoof.dispose();
  cache.eyes.dispose();
  cache.nostrils.dispose();
  cache = null;
}
