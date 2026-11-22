import {
  BufferGeometry, Color, Float32BufferAttribute, MeshLambertMaterial,
  MeshStandardMaterial, SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Mountain Rabbits (`တောင်ပေါ် ယုန်ကလေးများ`)
 * ============================================================================
 * Zero geometry or material duplication: every pooled wild mountain rabbit AND
 * every standalone editor-placed rabbit shares ONE single GPU resource set.
 */

export interface MountainRabbitAssetCache {
  readonly id: string;
  readonly bodyGeo: BufferGeometry;
  readonly headGeo: BufferGeometry;
  readonly earOuterGeo: BufferGeometry;
  readonly earInnerGeo: BufferGeometry;
  readonly tailGeo: BufferGeometry;
  readonly pawGeo: BufferGeometry;
  readonly eyeGeo: SphereGeometry;
  readonly noseGeo: SphereGeometry;
  readonly furInstancedMat: MeshLambertMaterial;
  readonly tailWhiteMat: MeshStandardMaterial;
  readonly pinkInnerMat: MeshStandardMaterial;
  readonly eyeDarkMat: MeshStandardMaterial;
}

let singletonRabbitCache: MountainRabbitAssetCache | null = null;
let rabbitCacheCreationCount = 0;

export const RABBIT_COAT_COLORS = [
  '#f5f1e8', // Snowy white
  '#c9a57b', // Warm cottontail tan
  '#b8895e', // Highland fawn
  '#a6a29c', // Misty mountain grey
  '#e8d8be', // Soft cream
] as const;

function oval(x: number, y: number, z: number, width: number, height: number, depth: number) {
  return new SphereGeometry(1, 14, 10).scale(width, height, depth).translate(x, y, z);
}

function tintFur(geometry: BufferGeometry, paleY: number, ear = false) {
  const positions = geometry.getAttribute('position');
  const shade = new Color();
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i), z = positions.getZ(i);
    const patch = Math.sin(positions.getX(i) * 91 + y * 32) * Math.sin(z * 57 + y * 83);
    const light = Math.min(1, (y < paleY && !ear ? .99 : .74) + .11 * patch - (ear && y > .117 ? .34 : 0));
    shade.setRGB(light, light * .98, light * .945);
    colors.push(shade.r, shade.g, shade.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function combine(parts: BufferGeometry[], paleY: number) {
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return tintFur(geometry, paleY);
}

function rabbitEar(inner: boolean) {
  const geometry = oval(0, inner ? .009 : .006, 0, inner ? .027 : .045, inner ? .134 : .181, inner ? .012 : .025);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) * Math.max(.2, .92 - y * 2.4));
    p.setZ(i, p.getZ(i) - y * y * 1.18);
  }
  geometry.computeVertexNormals();
  return inner ? geometry : tintFur(geometry, 0, true);
}

export function getMountainRabbitAssetCache(): MountainRabbitAssetCache {
  if (singletonRabbitCache) return singletonRabbitCache;

  rabbitCacheCreationCount += 1;

  singletonRabbitCache = Object.freeze({
    id: `mountain-rabbit-singleton-${rabbitCacheCreationCount}`,
    bodyGeo: combine([
      oval(0, .014, -.078, .226, .224, .252),
      oval(0, .031, .114, .173, .179, .17),
      ...[-1, 1].flatMap(side => [
        oval(side * .142, -.043, -.108, .12, .14, .163),
        oval(side * .152, -.202, -.075, .056, .048, .139),
      ]),
    ], -.09),
    headGeo: combine([
      oval(0, .005, -.015, .145, .135, .135),
      oval(0, -.044, .077, .099, .085, .105),
      ...[-1, 1].map(side => oval(side * .038, -.053, .141, .051, .041, .051)),
    ], -.028),
    earOuterGeo: rabbitEar(false),
    earInnerGeo: rabbitEar(true),
    tailGeo: oval(0, .012, 0, .060, .069, .065).rotateX(-.4),
    pawGeo: tintFur(oval(0, .025, 0, .049, .097, .055).rotateX(-.19), 0),
    eyeGeo: new SphereGeometry(.027, 10, 8).scale(.69, 1, 1),
    noseGeo: new SphereGeometry(.022, 10, 8).scale(.81, .57, .7),

    furInstancedMat: new MeshLambertMaterial({ color: '#ffffff', vertexColors: true }),
    tailWhiteMat: new MeshStandardMaterial({ color: '#faf8f4', roughness: 0.92 }),
    pinkInnerMat: new MeshStandardMaterial({ color: '#c78e87', roughness: 0.85 }),
    eyeDarkMat: new MeshStandardMaterial({ color: '#18161a', roughness: 0.25 }),
  });

  return singletonRabbitCache;
}

export function getMountainRabbitAssetCacheStats() {
  return {
    initialized: singletonRabbitCache !== null,
    creationCount: rabbitCacheCreationCount,
  };
}

export function disposeMountainRabbitAssetCache(): void {
  if (!singletonRabbitCache) return;
  const c = singletonRabbitCache;
  singletonRabbitCache = null;
  c.bodyGeo.dispose();
  c.headGeo.dispose();
  c.earOuterGeo.dispose();
  c.earInnerGeo.dispose();
  c.tailGeo.dispose();
  c.pawGeo.dispose();
  c.eyeGeo.dispose();
  c.noseGeo.dispose();
  c.furInstancedMat.dispose();
  c.tailWhiteMat.dispose();
  c.pinkInnerMat.dispose();
  c.eyeDarkMat.dispose();
}
