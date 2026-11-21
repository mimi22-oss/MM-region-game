import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  TorusGeometry,
} from 'three';

/**
 * ============================================================================
 * Singleton Equestrian Tack Cache
 * ============================================================================
 * Saddle, Stirrups (`ခြေနင်းအိတ်`), Bridle (`နဖားကြိုး`), and Reins (`မြင်းကြိုး ၂ ချောင်း`).
 * Reuses ALL horse body, neck, head, mane, tail, and leg geometries from
 * `getFieldLivestockAssetCache().models.horse` (ZERO duplicate horse anatomy).
 */

export interface HorseTackAssetCache {
  readonly id: string;
  readonly blanketGeo: BoxGeometry;
  readonly saddleSeatGeo: BoxGeometry;
  readonly pommelGeo: CylinderGeometry;
  readonly cantleGeo: CylinderGeometry;
  readonly girthGeo: TorusGeometry;
  readonly stirrupStrapGeo: CylinderGeometry;
  readonly stirrupArchGeo: TorusGeometry;
  readonly stirrupTreadGeo: BoxGeometry;
  readonly bridleBandGeo: TorusGeometry;
  readonly cheekStrapGeo: CylinderGeometry;
  readonly bitRingGeo: TorusGeometry;
  readonly reinSegGeo: CylinderGeometry;
  readonly markerRingGeo: RingGeometry;
  readonly blanketMat: MeshStandardMaterial;
  readonly leatherDarkMat: MeshStandardMaterial;
  readonly leatherWarmMat: MeshStandardMaterial;
  readonly ironMat: MeshStandardMaterial;
  readonly brassMat: MeshStandardMaterial;
  readonly markerRingMat: MeshBasicMaterial;
}

let tackSingleton: HorseTackAssetCache | null = null;

export function getHorseTackAssetCache(): HorseTackAssetCache {
  if (tackSingleton) return tackSingleton;
  tackSingleton = Object.freeze({
    id: 'horse-tack-singleton-cache',
    blanketGeo: new BoxGeometry(0.68, 0.05, 0.78),
    saddleSeatGeo: new BoxGeometry(0.46, 0.11, 0.56),
    pommelGeo: new CylinderGeometry(0.11, 0.16, 0.14, 10),
    cantleGeo: new CylinderGeometry(0.15, 0.2, 0.16, 10),
    girthGeo: new TorusGeometry(0.325, 0.026, 8, 22),
    stirrupStrapGeo: new CylinderGeometry(0.015, 0.015, 0.62, 6),
    stirrupArchGeo: new TorusGeometry(0.072, 0.012, 6, 14, Math.PI),
    stirrupTreadGeo: new BoxGeometry(0.145, 0.018, 0.068),
    bridleBandGeo: new TorusGeometry(0.108, 0.014, 6, 16),
    cheekStrapGeo: new CylinderGeometry(0.011, 0.011, 0.44, 6),
    bitRingGeo: new TorusGeometry(0.032, 0.008, 6, 12),
    reinSegGeo: new CylinderGeometry(0.011, 0.011, 1.0, 6),
    markerRingGeo: new RingGeometry(1.45, 1.62, 36),
    blanketMat: new MeshStandardMaterial({ color: '#991b1b', roughness: 0.86 }),
    leatherDarkMat: new MeshStandardMaterial({ color: '#3b1f0e', roughness: 0.62 }),
    leatherWarmMat: new MeshStandardMaterial({ color: '#6b3a1c', roughness: 0.58 }),
    ironMat: new MeshStandardMaterial({ color: '#94a3b8', metalness: 0.72, roughness: 0.34 }),
    brassMat: new MeshStandardMaterial({ color: '#d4af37', metalness: 0.68, roughness: 0.32 }),
    markerRingMat: new MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0.72,
      side: DoubleSide,
      depthWrite: false,
    }),
  });
  return tackSingleton;
}
