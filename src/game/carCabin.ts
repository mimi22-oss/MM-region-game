import { ExtrudeGeometry, Shape, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// All coordinates are in the unscaled car, facing -Z.
export const DRIVER_SCALE = .8;
export const DRIVER_POSITION: [number, number, number] = [.28, .48, .04];
export const DRIVER_EYE: [number, number, number] = [.28, 1.75, -.11];
export const STEERING_POSITION: [number, number, number] = [.28, 1.30, -.28];
export const STEERING_TILT = -.45;
export const STEERING_RADIUS = .17;

/** Two thin body sides and separate engine/boot compartments leave the cabin empty. */
export function carBodyShellGeometry() {
 const side = new Shape();
 side.moveTo(-1.55, .43); side.lineTo(1.64, .43);
 side.quadraticCurveTo(1.78, 1.15, .76, 1.24);
 side.lineTo(.65, 1.16); side.lineTo(.13, 1.16);
 side.lineTo(-.16, 1.18); side.lineTo(-.91, 1.18); side.lineTo(-1.18, 1.22);
 side.quadraticCurveTo(-1.44, 1.18, -1.55, .43); side.closePath();
 const hood = new Shape();
 hood.moveTo(.80, .43); hood.lineTo(1.64, .43);
 hood.quadraticCurveTo(1.78, 1.15, .80, 1.235); hood.closePath();
 const boot = new Shape();
 boot.moveTo(-1.55, .43); boot.lineTo(-1.17, .43); boot.lineTo(-1.17, 1.22);
 boot.quadraticCurveTo(-1.44, 1.18, -1.55, .43); boot.closePath();
 const extrude = (shape: Shape, depth: number, offset: number) => {
  const g = new ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelSegments:2, steps:1, bevelSize:.025, bevelThickness:.025, curveSegments:16});
  return g.translate(0, 0, offset).rotateY(Math.PI / 2);
 };
 const parts = [extrude(side, .09, -.745), extrude(side, .09, .655), extrude(hood, 1.40, -.70), extrude(boot, 1.40, -.70)];
 const shell = mergeGeometries(parts, false)!;
 parts.forEach(part => part.dispose());
 return shell;
}

/** Grip centers stay on the tilted rim; at large locks the rim feeds through the hands. */
export function driverGrip(side: number, wheelAngle: number, target: Vector3) {
 const angle = Math.max(-.85, Math.min(.85, wheelAngle));
 const x = side * STEERING_RADIUS * Math.cos(angle), y = side * STEERING_RADIUS * Math.sin(angle);
 return target.set(
  (STEERING_POSITION[0] + x - DRIVER_POSITION[0]) / DRIVER_SCALE,
  (STEERING_POSITION[1] + y * Math.cos(STEERING_TILT) - DRIVER_POSITION[1]) / DRIVER_SCALE,
  (STEERING_POSITION[2] + y * Math.sin(STEERING_TILT) - DRIVER_POSITION[2]) / DRIVER_SCALE,
 );
}
