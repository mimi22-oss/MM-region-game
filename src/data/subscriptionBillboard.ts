import { farmhouse, toWorld } from './ward.ts';

export const SUBSCRIPTION_WEBSITE_URL = 'https://subscription-app-nine-phi.vercel.app/';

export interface SubscriptionBillboardConfig {
  id: string;
  anchorBuildingId: string;
  /** Local position inside FarmhouseBuilding (`+Z` East, `+X` North). */
  localOffset: { x: number; y: number; z: number };
  /** Local Euler Y rotation inside FarmhouseBuilding (0 faces `+Z` East into room). */
  localRotationY: number;
  size: { width: number; height: number; depth: number };
  url: string;
  title: string;
  subtitle: string;
  /** Proximity highlight & E/Tap prompt radius in meters. */
  interactionDistanceM: number;
  /** Maximum direct raycast click/tap distance in meters. */
  maxClickDistanceM: number;
  /** When true, direct clicks beyond `interactionDistanceM` do not open the dialog. */
  enforceDistance: boolean;
  /** Optional explicit world override if moved away from farmhouse wall. */
  worldOverride?: { x: number; y: number; z: number; rotationY: number };
}

export interface SubscriptionBillboardWorldPose {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  rotationY: number;
}

/**
 * Default Subscription Shop billboard mounted flush on the unobstructed center
 * section (`lx = -0.65`) of the Farmhouse interior West back wall (`lz = -4.88`
 * inner face -> `-4.85` center for 6 cm panel depth), facing `+U` East (`0.69 m`
 * from player reference location `U=-76.161, V=270.693`, clear of both the
 * right window `lx=-3.5` and Smart TV console `lx=+2.6`).
 */
export const DEFAULT_SUBSCRIPTION_BILLBOARD: SubscriptionBillboardConfig = {
  id: 'farmhouse-subscription-shop-billboard',
  anchorBuildingId: farmhouse.id,
  localOffset: { x: -0.45, y: 1.72, z: -4.85 },
  localRotationY: 0,
  size: { width: 2.2, height: 1.35, depth: 0.06 },
  url: SUBSCRIPTION_WEBSITE_URL,
  title: 'Subscription Shop',
  subtitle: 'Subscription Link · Digital Accounts & Licenses',
  interactionDistanceM: 5,
  maxClickDistanceM: 22,
  enforceDistance: false,
};

/**
 * Computes world `(x, y, z)`, AH1-local `(u, v)`, and yaw `rotationY` for the
 * Subscription Shop billboard from its active configuration.
 */
export function computeSubscriptionBillboardWorldPose(
  config: SubscriptionBillboardConfig = DEFAULT_SUBSCRIPTION_BILLBOARD,
): SubscriptionBillboardWorldPose {
  if (config.worldOverride) {
    const { x, y, z, rotationY } = config.worldOverride;
    const inv = Math.PI / 4;
    const u = x * Math.cos(inv) - z * Math.sin(inv);
    const v = x * Math.sin(inv) + z * Math.cos(inv);
    return { x, y, z, u, v, rotationY };
  }

  // Farmhouse uses rotation = angle + Math.PI/2, where local +Z maps to +U and +X maps to -V.
  const u = -72 + config.localOffset.z;
  const v = 270 - config.localOffset.x;
  const worldXZ = toWorld(u, v);
  const cosR = Math.cos(farmhouse.rotation);
  const sinR = Math.sin(farmhouse.rotation);
  const rx = farmhouse.x + config.localOffset.x * cosR + config.localOffset.z * sinR;
  const rz = farmhouse.z - config.localOffset.x * sinR + config.localOffset.z * cosR;

  return {
    x: Math.abs(rx - worldXZ.x) < 1e-4 ? rx : worldXZ.x,
    y: config.localOffset.y,
    z: Math.abs(rz - worldXZ.z) < 1e-4 ? rz : worldXZ.z,
    u,
    v,
    rotationY: farmhouse.rotation + config.localRotationY,
  };
}
