import { Vector3 } from 'three';

type Point = readonly [number, number];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const saturate = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = saturate(value);
  return t * t * (3 - 2 * t);
};
const interval = (p: number, from: number, to: number) => smooth((p - from) / (to - from));
const wrap = (phase: number) => phase - Math.floor(phase);
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export const HORSE_BODY_Y = 1.25;
export const SADDLE_Y = .34;
export const SADDLE_Z = -.02;
export const STIRRUP_X = .36;
export const STIRRUP_STRAP_LENGTH = .62;
export const STIRRUP_Z = .045;
export const MOUNT_SIDE_X = -.81;
export const MOUNT_SIDE_Z = .10;

export interface HorseMountApproach {
  points: Point[];
  distance: number;
  seconds: number;
  yaw: number;
}

/** Local avatar coordinates (+X right, -Z forward). Try each end of the horse. */
export function planHorseMountApproach(
  x: number, z: number, yaw: number, scale: number,
  clear: (localX: number, localZ: number) => boolean,
): HorseMountApproach | null {
  const side = -MOUNT_SIDE_X * scale;
  const rear = 1.19 * scale;
  const front = -1.65 * scale;
  const start: Point = [x, z];
  const end: Point = [-side, MOUNT_SIDE_Z * scale];
  const startInside = Math.abs(x) < side && z > front && z < rear;
  const exit: Point = [x > 0 ? side : -side, z];
  const paths: Point[][] = [[start, end]];
  for (const around of [rear, front]) {
    const edge: Point = [side, around];
    const opposite: Point = [-side, around];
    paths.push([start, edge, opposite, end], [start, opposite, end]);
    if (startInside) {
      paths.push([start, exit, edge, opposite, end], [start, exit, opposite, end]);
    }
  }
  if (startInside && x <= 0) paths.push([start, exit, end]);

  let best: HorseMountApproach | null = null;
  for (const points of paths) {
    let distance = 0;
    let valid = true;
    for (let i = 1; i < points.length && valid; i++) {
      const [ax, az] = points[i - 1];
      const [bx, bz] = points[i];
      const length = Math.hypot(bx - ax, bz - az);
      const samples = Math.max(1, Math.ceil(length / .12));
      for (let j = 1; j <= samples; j++) {
        const px = mix(ax, bx, j / samples);
        const pz = mix(az, bz, j / samples);
        const exiting = startInside && i === 1 && bx === exit[0] && bz === exit[1];
        if ((!exiting && Math.abs(px) < side - .001 && pz > front + .001 && pz < rear - .001) || !clear(px, pz)) {
          valid = false;
          break;
        }
      }
      distance += length;
    }
    if (valid && (!best || distance < best.distance)) {
      best = { points, distance, seconds: .22 + distance / 2.25, yaw };
    }
  }
  return best;
}

export function createHorseRiderPose() {
  return {
    active: false,
    hip: new Vector3(),
    feet: [new Vector3(), new Vector3()],
    hands: [new Vector3(), new Vector3()],
    footYaw: [0, 0],
    yaw: 0, lean: 0, roll: 0, footPitch: 0, reinGrip: 0,
    headTurn: 0,
  };
}
export type HorseRiderPose = ReturnType<typeof createHorseRiderPose>;

export function horseStirrupDrop(horseScale: number, riderScale: number) {
  return Math.max(.24, Math.min(STIRRUP_STRAP_LENGTH, .49 * riderScale / horseScale - .095));
}

export function gallopWeight(speed: number) {
  return smooth((speed - 4.6) / 4.3);
}

export function horseStrideLength(speed: number, scale: number) {
  return mix(mix(1.6, 2.65, saturate(speed / 4.6)), 4.8, gallopWeight(speed)) * scale;
}

export function sampleHorseGait(cycle: number, speed: number, pitch: number, airborne: boolean) {
  const moving = saturate(speed / 1.3);
  const gallop = gallopWeight(speed);
  const phase = cycle * Math.PI * 2;
  const suspension = Math.sin(phase - 3.8);
  const bounce = airborne ? 0 : moving * mix(Math.cos(phase * 2) * .017, .025 + suspension * .074, gallop);
  const rock = airborne ? 0 : moving * mix(Math.sin(phase * 2) * .018, Math.sin(phase - .1) * .13, gallop);
  return {
    moving, gallop, bounce, pitch: pitch * .85 + rock,
    nod: moving * mix(Math.sin(phase * 2 - .4) * .034, Math.sin(phase - .55) * .14, gallop),
  };
}
export type HorseGait = ReturnType<typeof sampleHorseGait>;

const WALK_CONTACTS = [0.25, 0.75, 0, 0.5];
const GALLOP_CONTACTS = [.39, .53, 0, .14];

/** Leg order is left/right foreground pair, then left/right hind pair. */
export function sampleHorseHoof(index: number, cycle: number, strideLength: number, gait: HorseGait) {
  const stance = mix(.67, .27, gait.gallop);
  const contact = mix(WALK_CONTACTS[index], GALLOP_CONTACTS[index], gait.gallop);
  const phase = wrap(cycle - contact);
  const swing = saturate((phase - stance) / (1 - stance));
  const extent = strideLength * stance * .5;
  const swingArc = Math.sin(swing * Math.PI);
  return {
    ahead: mix(extent * (1 - 2 * Math.min(1, phase / stance)), extent, smooth(swing)) * gait.moving,
    lift: swingArc ** 2 * mix(.17, index < 2 ? .47 : .36, gait.gallop) * gait.moving,
    curl: swingArc * mix(.22, index < 2 ? .75 : .59, gait.gallop) * gait.moving,
  };
}

/** Samples targets in the same coordinate system as the avatar and the saddle. */
export function sampleHorseRider(
  pose: HorseRiderPose, scale: number, heightScale: number, gait: HorseGait,
  steer: number, airborne: boolean, mount: HorseMountApproach | null, elapsed: number,
  climbSeconds: number, groundOffset: (x: number, z: number) => number,
) {
  const bodyY = HORSE_BODY_Y + gait.bounce;
  const cos = Math.cos(gait.pitch);
  const sin = Math.sin(gait.pitch);
  const onBody = (out: Vector3, x: number, y: number, z: number) =>
    out.set(x * scale, (bodyY + y * cos - z * sin) * scale, (y * sin + z * cos) * scale);

  const hipHeight = .79 * heightScale;
  onBody(pose.hip, 0, SADDLE_Y + .095 + (.108 + .025 * gait.gallop) * heightScale / scale, -SADDLE_Z - .07 * gait.gallop);
  pose.yaw = 0;
  pose.footYaw.fill(0);
  pose.lean = .12 + .27 * gait.gallop + (airborne ? .18 : 0) - gait.pitch * .42;
  pose.roll = -steer * .14;
  pose.footPitch = -.10 + gait.pitch;
  pose.headTurn = steer * .25;
  pose.reinGrip = 1;
  const treadY = SADDLE_Y - horseStirrupDrop(scale, heightScale);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    onBody(pose.feet[i], side * STIRRUP_X, treadY + .09 * heightScale / scale, -SADDLE_Z - STIRRUP_Z + .059);
    onBody(pose.hands[i], side * .16 + steer * .046, .69 + .03 * gait.gallop, -.29 - .16 * gait.gallop + Math.max(0, -side * steer) * .07);
  }
  if (!mount) return;

  const p = saturate((elapsed - mount.seconds) / climbSeconds);
  if (p === 1) return;
  const approach = saturate(elapsed / mount.seconds);
  if (approach < 1) {
    let remaining = mount.distance * approach;
    let walked = 0;
    let [x, z] = mount.points[0];
    let yaw = mount.yaw;
    for (let i = 1; i < mount.points.length; i++) {
      const [bx, bz] = mount.points[i];
      const distance = Math.hypot(bx - x, bz - z);
      if (distance > .001 && remaining <= distance) {
        const direction = Math.atan2(x - bx, z - bz);
        yaw += angleDiff(yaw, direction) * smooth(remaining / .34);
        x = mix(x, bx, remaining / distance);
        z = mix(z, bz, remaining / distance);
        walked += remaining;
        break;
      }
      if (distance > .001) yaw = Math.atan2(x - bx, z - bz);
      remaining -= distance;
      walked += distance;
      x = bx;
      z = bz;
    }
    yaw += angleDiff(yaw, -Math.PI / 2) * interval(approach, .78, 1);
    const walk = walked * Math.PI * 2 / (.92 * heightScale);
    const weight = Math.min(1, mount.distance * 2) * interval(approach, 0, .16) * (1 - interval(approach, .82, 1));
    pose.hip.set(x, groundOffset(x, z) + hipHeight + Math.abs(Math.sin(walk)) * .024 * weight, z);
    pose.yaw = yaw;
    pose.footYaw.fill(yaw);
    pose.lean = .075 * weight;
    pose.footPitch = 0;
    pose.reinGrip = 0;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const step = side * Math.sin(walk) * weight;
      const offsetX = side * .102 * heightScale;
      const offsetZ = step * .22 * heightScale;
      const fx = x + offsetX * Math.cos(yaw) + offsetZ * Math.sin(yaw);
      const fz = z - offsetX * Math.sin(yaw) + offsetZ * Math.cos(yaw);
      pose.feet[i].set(fx, groundOffset(fx, fz) + (.09 + Math.max(0, -step) * .12) * heightScale, fz);
      const hz = -step * .19 * heightScale;
      const hx = side * .25 * heightScale;
      pose.hands[i].set(x + hx * Math.cos(yaw) + hz * Math.sin(yaw), pose.hip.y - .03 * heightScale, z - hx * Math.sin(yaw) + hz * Math.cos(yaw));
    }
    return;
  }

  const x = MOUNT_SIDE_X * scale;
  const z = MOUNT_SIDE_Z * scale;
  const ground = groundOffset(x, z);
  const plant = interval(p, .06, .39);
  const rise = interval(p, .23, .61);
  const swing = interval(p, .50, .85);
  const settle = interval(p, .79, 1);
  const grip = interval(p, .02, .24);
  const regrip = interval(p, .82, 1);
  pose.yaw = -Math.PI / 2 * (1 - swing);
  pose.footYaw[0] = -Math.PI / 2 * (1 - plant);
  pose.footYaw[1] = pose.yaw;
  const overSaddle = interval(p, .36, .61);
  pose.lean = mix(.20 * grip + .17 * Math.sin(rise * Math.PI) + .40 * overSaddle, pose.lean, settle);
  pose.roll += .08 * Math.sin(swing * Math.PI);
  pose.footPitch *= plant;
  pose.reinGrip = regrip;
  pose.hip.set(
    mix(x + .19 * plant, pose.hip.x, interval(p, .44, .84)),
    mix(ground + hipHeight + .10 * plant, pose.hip.y + .075 * scale, rise) - .075 * scale * settle,
    mix(z, pose.hip.z, swing),
  );

  const left = pose.feet[0];
  const leftZ = z - .102 * heightScale;
  left.set(mix(x, left.x, plant), mix(groundOffset(x, leftZ) + .09 * heightScale, left.y, plant) + Math.sin(Math.PI * plant) * .20, mix(leftZ, left.z, plant));
  const right = pose.feet[1];
  const rightZ = z + .102 * heightScale;
  const push = interval(p, .24, .57);
  const tuck = Math.sin(Math.PI * swing);
  right.set(
    mix(x - .04 * push, right.x, swing),
    mix(groundOffset(x, rightZ) + .09 * heightScale + push * (.90 + .29 * rise) * scale, right.y, swing) + tuck * (.52 * scale),
    mix(rightZ, right.z, swing) + tuck * .58 * scale,
  );
  for (let i = 0; i < 2; i++) {
    const target = pose.hands[i];
    const onSaddle = interval(p, .28, .56);
    const handX = mix(x, mix(-.44, -.14 + i * .12, onSaddle) * scale, grip);
    const handY = mix(ground + hipHeight - .03 * heightScale, (HORSE_BODY_Y + mix(.04, SADDLE_Y + .18, onSaddle)) * scale, grip);
    const handZ = mix(z + (i === 0 ? -.25 : .25) * heightScale, (i === 0 ? -.21 : mix(.23, -.22, interval(p, .49, .77))) * scale, grip);
    target.set(mix(handX, target.x, regrip), mix(handY, target.y, regrip), mix(handZ, target.z, regrip));
  }
}
