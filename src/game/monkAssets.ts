import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Material,
} from 'three';
import { getWeipulaVillagerCache, type WeipulaVillagerCache } from './weipulaVillagers.ts';
import { npcProfile } from './npcAnatomy.ts';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Myanmar Theravada Buddhist Monks
 * (`ဘုန်းတော်ကြီးများ နှင့် ကိုရင်များ`)
 * ============================================================================
 *
 * Shares the base human parts, robe meshes and monastic accessories across all slots.
 */

function markSharedGeo<T extends BufferGeometry>(geo: T): T {
  geo.userData.shared = true;
  return geo;
}

function markSharedMat<T extends Material>(mat: T): T {
  mat.userData.shared = true;
  return mat;
}

export interface MonkAssetCache {
  readonly id: string;
  readonly base: WeipulaVillagerCache;

  // Monastic accessory geometries (created ONCE globally)
  readonly chestGeo: BufferGeometry;
  readonly wrappedRobeGeo: BufferGeometry;
  readonly shoulderDrapeGeo: BufferGeometry;
  readonly lowerRobeGeo: BufferGeometry;
  readonly almsBowlBodyGeo: SphereGeometry;
  readonly almsBowlRimGeo: CylinderGeometry;
  readonly almsBowlLidGeo: SphereGeometry;
  readonly palmFanBladeGeo: CylinderGeometry;
  readonly palmFanHandleGeo: CylinderGeometry;
  readonly prayerBeadsGeo: TorusGeometry;

  // Authentic Myanmar Theravada Robe (`သင်္ကန်း`) & accessory materials
  readonly maroonRobeMat: MeshStandardMaterial;
  readonly burgundyRobeMat: MeshStandardMaterial;
  readonly saffronRobeMat: MeshStandardMaterial;
  readonly shoulderDrapeMats: readonly MeshStandardMaterial[];
  readonly almsBowlMat: MeshStandardMaterial;
  readonly almsBowlRimMat: MeshStandardMaterial;
  readonly palmFanMat: MeshStandardMaterial;
  readonly palmFanHandleMat: MeshStandardMaterial;
  readonly prayerBeadsMat: MeshStandardMaterial;
  readonly sandalMat: MeshStandardMaterial;
}

let singletonMonkCache: MonkAssetCache | null = null;

function createWrappedRobe() {
  const geometry = npcProfile([
    [.82, .175, .125], [.92, .178, .128, 0, 0, .034], [1.04, .192, .127, 0, 0, .056],
    [1.14, .195, .125, 0, 0, .047], [1.24, .166, .107],
  ], 24);
  const positions = geometry.getAttribute('position');
  const topRing = positions.count - 24;
  for (let i = topRing - 24; i < positions.count; i++) {
    const x = positions.getX(i);
    // The neckline slopes from under the bare arm toward the covered shoulder.
    positions.setY(i, positions.getY(i) + x * (i >= topRing ? .55 : .32) - (i >= topRing ? .045 : .025));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createShoulderDrape() {
  // Rows follow the folded cloth from the front hem, over the left shoulder (+X), to the back hem.
  const rows = [
    [.105, .83, .136, .089, -.026, -.030],
    [.139, .96, .143, .092, -.013, -.036],
    [.158, 1.12, .135, .094, .010, -.048],
    [.157, 1.28, .101, .105, -.032, -.023],
    [.153, 1.357, .050, .102, -.028, -.004],
    [.151, 1.372, -.013, .100, -.034, -.006],
    [.154, 1.339, -.082, .105, -.041, .014],
    [.149, 1.23, -.124, .111, -.025, .025],
    [.129, 1.07, -.137, .109, -.016, .027],
    [.115, .89, -.134, .098, -.029, .032],
  ];
  const crossSection = [-1, -.93, -.71, -.46, -.16, .12, .42, .70, .92, 1];
  const ridges = [.001, .008, .004, .016, .002, .018, .004, .011, .005, .001];
  const tone = [.51, .80, .75, .91, .62, .96, .68, .90, .82, .54];
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let row = 0; row < rows.length; row++) {
    const [x, y, z, acrossX, acrossY, acrossZ] = rows[row];
    const roundedTop = Math.max(0, 1 - Math.abs(row - 4.5) / 2.3);
    for (let col = 0; col < crossSection.length; col++) {
      const u = crossSection[col];
      const pleat = ridges[col];
      positions.push(x + u * acrossX, y + u * acrossY + pleat * roundedTop,
        z + u * acrossZ + Math.sign(z) * pleat * (1 - roundedTop));
      colors.push(tone[col], tone[col], tone[col]);
      if (row > 0 && col > 0) {
        const a = row * crossSection.length + col;
        const b = a - crossSection.length;
        indices.push(b - 1, a - 1, b, a - 1, a, b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function getMonkAssetCache(): MonkAssetCache {
  if (singletonMonkCache) return singletonMonkCache;

  const base = getWeipulaVillagerCache();

  const created: MonkAssetCache = Object.freeze({
    id: 'theravada-monk-singleton-cache',
    base,

    // Accessory geometries (ZERO duplication across any number of pooled monks)
    chestGeo: markSharedGeo(npcProfile([
      [.91, .149, .101], [1.04, .158, .108], [1.20, .182, .115], [1.29, .190, .104],
      [1.334, .152, .082], [1.365, .058, .052], [1.38, 0, 0],
    ], 18)),
    wrappedRobeGeo: markSharedGeo(createWrappedRobe()),
    shoulderDrapeGeo: markSharedGeo(createShoulderDrape()),
    lowerRobeGeo: markSharedGeo(npcProfile([
      [.22, .192, .140, .011, .006, .085], [.239, .197, .141, .012, .006, .075],
      [.41, .190, .136, .006, .005, .068], [.64, .175, .127, .001, 0, .056],
      [.84, .158, .121, 0, 0, .042], [.91, .151, .111],
    ], 24)),
    almsBowlBodyGeo: markSharedGeo(new SphereGeometry(0.145, 12, 10)),
    almsBowlRimGeo: markSharedGeo(new CylinderGeometry(0.132, 0.14, 0.035, 12)),
    almsBowlLidGeo: markSharedGeo(new SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48)),
    palmFanBladeGeo: markSharedGeo(new CylinderGeometry(0.16, 0.12, 0.018, 10)),
    palmFanHandleGeo: markSharedGeo(new CylinderGeometry(0.014, 0.016, 0.32, 8)),
    prayerBeadsGeo: markSharedGeo(new TorusGeometry(0.062, 0.012, 6, 12)),

    // Authentic Myanmar Theravada monastic robe palette (`ကြက်သွေးရောင် / နီညိုရောင် / ဝါရွှေရောင် သင်္ကန်း`)
    maroonRobeMat: markSharedMat(new MeshStandardMaterial({ color: '#6e141a', roughness: 0.78 })),
    burgundyRobeMat: markSharedMat(new MeshStandardMaterial({ color: '#821c21', roughness: 0.76 })),
    saffronRobeMat: markSharedMat(new MeshStandardMaterial({ color: '#b45309', roughness: 0.74 })),
    shoulderDrapeMats: ['#8b232b', '#a32d31', '#cd6e1c'].map(color => markSharedMat(
      new MeshStandardMaterial({ color, roughness: .92, side: DoubleSide, vertexColors: true }),
    )),
    almsBowlMat: markSharedMat(new MeshStandardMaterial({ color: '#171414', roughness: 0.26, metalness: 0.22 })),
    almsBowlRimMat: markSharedMat(new MeshStandardMaterial({ color: '#b38728', roughness: 0.32, metalness: 0.55 })),
    palmFanMat: markSharedMat(new MeshStandardMaterial({ color: '#cfa75c', roughness: 0.68 })),
    palmFanHandleMat: markSharedMat(new MeshStandardMaterial({ color: '#5c3318', roughness: 0.72 })),
    prayerBeadsMat: markSharedMat(new MeshStandardMaterial({ color: '#4b2a16', roughness: 0.62 })),
    sandalMat: markSharedMat(new MeshStandardMaterial({ color: '#4a301e', roughness: 0.85 })),
  });

  singletonMonkCache = created;
  return created;
}

export function disposeMonkAssetCache(): void {
  if (!singletonMonkCache) return;
  const c = singletonMonkCache;
  singletonMonkCache = null;

  c.shoulderDrapeGeo.dispose();
  c.wrappedRobeGeo.dispose();
  c.chestGeo.dispose();
  c.lowerRobeGeo.dispose();
  c.almsBowlBodyGeo.dispose();
  c.almsBowlRimGeo.dispose();
  c.almsBowlLidGeo.dispose();
  c.palmFanBladeGeo.dispose();
  c.palmFanHandleGeo.dispose();
  c.prayerBeadsGeo.dispose();

  c.maroonRobeMat.dispose();
  c.burgundyRobeMat.dispose();
  c.saffronRobeMat.dispose();
  c.shoulderDrapeMats.forEach(material => material.dispose());
  c.almsBowlMat.dispose();
  c.almsBowlRimMat.dispose();
  c.palmFanMat.dispose();
  c.palmFanHandleMat.dispose();
  c.prayerBeadsMat.dispose();
  c.sandalMat.dispose();
}
