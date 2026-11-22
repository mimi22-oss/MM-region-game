import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry,
  ExtrudeGeometry, LatheGeometry, MeshStandardMaterial, Shape, SphereGeometry,
  TorusGeometry, TubeGeometry, Vector2, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAGODA_PLINTH_SIDES, PAGODA_SHRINE, type PagodaAnimal } from './pagodaLayout.ts';

type Profile = readonly (readonly [radius: number, height: number])[];

function shared<T extends BufferGeometry | MeshStandardMaterial>(asset: T) {
  asset.userData.shared = true;
  return asset;
}

function lathe(profile: Profile, sides = 48) {
  return new LatheGeometry(profile.map(([radius, height]) => new Vector2(radius, height)), sides);
}

function merge(parts: BufferGeometry[]) {
  const indexed = parts.every(part => part.index !== null);
  const compatible = indexed ? parts : parts.map(part => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(compatible)!;
  compatible.forEach((part, i) => { if (part !== parts[i]) part.dispose(); });
  parts.forEach(part => part.dispose());
  return shared(geometry);
}

function oval(x: number, y: number, z: number, w: number, h: number, d: number) {
  return new SphereGeometry(1, 10, 7).scale(w, h, d).translate(x, y, z);
}

function box(x: number, y: number, z: number, w: number, h: number, d: number) {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

function lotusPetals(radius: number, y: number, count: number, down = false) {
  return Array.from({ length: count }, (_, i) =>
    new SphereGeometry(1, 7, 6).scale(.032, .072, .018)
      .rotateX(down ? -.48 : .36)
      .translate(0, y, radius)
      .rotateY(i * Math.PI * 2 / count),
  );
}

function buildStupa() {
  const plinth = lathe([
    [0, 0], [1, 0], [1, .036], [.979, .046], [.962, .059], [.962, .103],
    [.98, .103], [.98, .121], [.886, .121], [.877, .139], [.877, .177],
    [.896, .177], [.896, .199], [.782, .199], [.765, .215], [.765, .25],
    [.784, .25], [.784, .273], [.672, .273], [.656, .298], [0, .298],
  ], PAGODA_PLINTH_SIDES);
  const lowerTerrace = lathe([
    [0, .285], [.679, .285], [.679, .306], [.65, .32], [.65, .346],
    [.615, .346], [.61, .366], [.61, .389], [.58, .389], [.57, .418],
  ], PAGODA_PLINTH_SIDES);
  const bell = lathe([
    [0, .35], [.566, .35], [.62, .376], [.632, .397], [.629, .414], [.606, .433],
    [.567, .462], [.545, .50], [.526, .552], [.512, .624], [.492, .698],
    [.462, .768], [.427, .832], [.375, .898], [.31, .948], [.241, .983],
    [.23, 1.005], [.256, 1.023], [.259, 1.043], [.212, 1.065], [.200, 1.09],
    [.222, 1.114], [.231, 1.145], [.221, 1.18], [.19, 1.213], [.15, 1.231],
    [.174, 1.258], [.191, 1.284], [.179, 1.316], [.191, 1.35], [.178, 1.402],
    [.153, 1.449], [.116, 1.495], [.073, 1.544], [.041, 1.576], [0, 1.585],
  ]);
  const bands = [
    [.612, .423, .014], [.537, .518, .011], [.488, .711, .010],
    [.244, 1.015, .011], [.251, 1.049, .008], [.218, 1.182, .008],
    [.146, 1.235, .010], [.178, 1.331, .010],
  ].map(([radius, y, tube]) => new TorusGeometry(radius, tube, 6, 48).rotateX(-Math.PI / 2).translate(0, y, 0));
  const hti = lathe([
    [0, 1.495], [.016, 1.495], [.016, 1.605], [.169, 1.605], [.173, 1.619],
    [.133, 1.646], [.097, 1.659], [.138, 1.659], [.145, 1.677],
    [.095, 1.714], [.068, 1.722], [.112, 1.722], [.119, 1.742],
    [.067, 1.774], [.038, 1.782], [.084, 1.782], [.083, 1.802],
    [.025, 1.843], [.009, 1.913], [0, 1.925],
  ], 32);

  return {
    apron: shared(lathe([[0, 0], [1, 0], [1, 1], [0, 1]])),
    plinth: shared(plinth),
    structure: merge([lowerTerrace, bell]),
    decoration: merge([...bands, hti, ...lotusPetals(.162, 1.287, 18, true), ...lotusPetals(.169, 1.367, 18)]),
    finial: shared(oval(0, 1.934, 0, .018, .035, .018)),
    stone: shared(new MeshStandardMaterial({ color: '#eadac1', roughness: .87 })),
    terrace: shared(new MeshStandardMaterial({ color: '#b7a58b', roughness: .94 })),
    gold: shared(new MeshStandardMaterial({ color: '#db9d29', roughness: .37, metalness: .34, emissive: '#462204', emissiveIntensity: .19 })),
    gilding: shared(new MeshStandardMaterial({ color: '#ffcb53', roughness: .31, metalness: .42, emissive: '#613407', emissiveIntensity: .18 })),
    gem: shared(new MeshStandardMaterial({ color: '#fff4cd', roughness: .2, emissive: '#ffe2a1', emissiveIntensity: .25 })),
  };
}

let stupaCache: ReturnType<typeof buildStupa> | undefined;
export function getPagodaAssets() {
  return stupaCache ??= buildStupa();
}

function arch(width: number, spring: number, rise: number, depth: number, z: number) {
  const shape = new Shape();
  shape.moveTo(-width, .31);
  shape.lineTo(width, .31);
  shape.lineTo(width, spring);
  shape.bezierCurveTo(width, spring + rise * .55, width * .36, spring + rise * .72, 0, spring + rise);
  shape.bezierCurveTo(-width * .36, spring + rise * .72, -width, spring + rise * .55, -width, spring);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, z);
}

function buildShrine() {
  const { width, depth } = PAGODA_SHRINE;
  return {
    pedestal: merge([
      box(0, .095, 0, width, .19, depth),
      box(0, .245, -.06, 1.59, .11, 1.26),
      arch(.67, 1.22, .57, .20, -.55),
      ...[-.61, .61].map(x => new CylinderGeometry(.072, .085, .89, 10).translate(x, .78, -.25)),
    ]),
    trim: merge([
      box(0, .198, 0, width, .027, depth),
      box(0, .313, -.05, 1.57, .043, 1.23),
      arch(.588, 1.19, .47, .036, -.35),
      ...[-.61, .61].map(x => oval(x, 1.26, -.25, .083, .105, .083)),
    ]),
    niche: shared(arch(.537, 1.152, .422, .016, -.313)),
    statue: merge([
      oval(0, .48, -.08, .379, .125, .215),
      oval(0, .599, -.044, .312, .095, .195),
      oval(0, .822, -.12, .196, .258, .143),
      oval(-.171, .766, -.061, .07, .177, .076).rotateZ(-.10),
      oval(.171, .766, -.06, .07, .177, .076).rotateZ(.10),
      oval(0, .663, .071, .142, .050, .082),
      oval(0, 1.127, -.11, .114, .143, .114),
      oval(-.108, 1.107, -.105, .029, .064, .047),
      oval(.108, 1.107, -.105, .029, .064, .047),
      oval(0, 1.153, -.006, .024, .040, .026),
      oval(0, 1.268, -.112, .079, .057, .070),
    ]),
    basin: shared(lathe([
      [0, .328], [.187, .328], [.19, .365], [.105, .391], [.088, .455], [.162, .469],
      [.222, .495], [.234, .551], [.238, .572], [.215, .579], [.201, .553], [.170, .5], [0, .484],
    ], 28).translate(0, 0, .414)),
    water: shared(new CylinderGeometry(.199, .199, .006, 28).translate(0, .549, .414)),
    waterMat: shared(new MeshStandardMaterial({ color: '#659597', metalness: .3, roughness: .2 })),
    insetMat: shared(new MeshStandardMaterial({ color: '#782c26', roughness: .8 })),
    plaque: shared(new BoxGeometry(1.11, .255, .039)),
  };
}

let shrineCache: ReturnType<typeof buildShrine> | undefined;
export function getPagodaShrineAssets() {
  return shrineCache ??= buildShrine();
}

function curve(points: [number, number, number][], radius: number) {
  return new TubeGeometry(new CatmullRomCurve3(points.map(p => new Vector3(...p))), 10, radius, 6, false);
}

function buildAnimal(animal: PagodaAnimal) {
  if (animal === 'garuda') return merge([
    oval(0, .167, 0, .062, .121, .065),
    oval(0, .286, .013, .043, .047, .042),
    new ConeGeometry(.026, .059, 6).rotateX(Math.PI / 2).translate(0, .278, .063),
    ...[-1, 1].flatMap(side => [
      oval(0, 0, 0, .133, .052, .019).rotateZ(side * .44).translate(side * .108, .19, -.026),
      oval(0, 0, 0, .11, .03, .017).rotateZ(side * .75).translate(side * .103, .147, -.023),
      oval(side * .032, .053, .027, .027, .017, .041),
    ]),
  ]);
  if (animal === 'naga') return merge([
    new TorusGeometry(.087, .032, 8, 24).rotateX(-Math.PI / 2).translate(0, .049, .011),
    curve([[0, .065, -.044], [0, .119, -.056], [0, .207, -.037], [0, .253, .016]], .046),
    oval(0, .229, -.03, .094, .108, .025),
    oval(0, .263, .018, .046, .053, .04),
    oval(0, .246, .06, .042, .028, .046),
  ]);

  const elephant = animal === 'elephant' || animal === 'tuskless-elephant';
  const rodent = animal === 'mouse' || animal === 'guinea-pig';
  const parts: BufferGeometry[] = [
    oval(0, rodent ? .104 : .147, -.034, elephant ? .104 : .083, rodent ? .075 : .086, .139),
    oval(0, elephant ? .208 : rodent ? .132 : .195, .093, .066, .069, .072),
    ...[-1, 1].flatMap(side => [
      oval(side * .052, rodent ? .04 : .063, -.103, .035, rodent ? .024 : .05, .041),
      oval(side * .054, rodent ? .043 : .071, .061, .027, rodent ? .028 : .061, .034),
      oval(side * (elephant ? .064 : .041), elephant ? .199 : rodent ? .179 : .243, .083,
        elephant ? .055 : .024, elephant ? .071 : .029, elephant ? .022 : .018),
    ]),
  ];
  if (elephant) {
    parts.push(curve([[0, .208, .139], [0, .119, .181], [0, .069, .201], [0, .093, .229]], .028));
    if (animal === 'elephant') for (const side of [-1, 1]) {
      parts.push(new ConeGeometry(.017, .084, 5).rotateX(Math.PI / 2 - .38).translate(side * .047, .145, .172));
    }
  } else {
    parts.push(oval(0, rodent ? .109 : .172, .155, rodent ? .038 : .047, .035, .049));
    if (animal === 'lion') parts.push(oval(0, .185, .061, .103, .101, .075));
    if (animal !== 'guinea-pig') parts.push(curve([[0, .116, -.131], [.075, .125, -.183], [.137, .153, -.147]], rodent ? .009 : .014));
  }
  return merge(parts);
}

const figures = new Map<PagodaAnimal, BufferGeometry>();
export function getPagodaAnimalGeometry(animal: PagodaAnimal) {
  const cached = figures.get(animal);
  if (cached) return cached;
  const geometry = buildAnimal(animal);
  figures.set(animal, geometry);
  return geometry;
}
