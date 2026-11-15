import type { Intersection, Object3D, Raycaster } from 'three';

/** Cull excluded subtrees BEFORE triangle/skinning raycasts, not after them.
 * Scratch storage belongs to one camera and is reused each frame.
 */
export function createCameraObstructionQuery() {
  const hits: Intersection[] = [];
  function visit(ray: Raycaster, object: Object3D, avatar: Object3D | null, ridingBalloon: boolean, carId: string | null) {
    if (!object.visible || object === avatar || object.userData.cameraIgnore === true ||
      (ridingBalloon && object.userData.passengerBalloon === true) ||
      (carId !== null && object.userData.carId === carId)) return;
    if (object.layers.test(ray.layers)) {
      const propagate: unknown = object.raycast(ray, hits);
      if (propagate === false) return;
    }
    for (let i = 0; i < object.children.length; i++) visit(ray, object.children[i], avatar, ridingBalloon, carId);
  }
  return (ray: Raycaster, scene: Object3D, avatar: Object3D | null, ridingBalloon: boolean, carId: string | null) => {
    hits.length = 0;
    visit(ray, scene, avatar, ridingBalloon, carId);
    let nearest: Intersection | undefined;
    for (let i = 0; i < hits.length; i++) if (!nearest || hits[i].distance < nearest.distance) nearest = hits[i];
    return nearest;
  };
}
