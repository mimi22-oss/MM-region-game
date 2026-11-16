import { Box3, Group, Quaternion, Vector3, type Object3D } from 'three';

const HAND_NAMES = ['mixamorigRightHand', 'equipment-right-hand', 'Hand_R'];
/** Called only when locating/replacing a rig, never for every animation frame. */
export function findSwordHand(avatar:Object3D):Object3D|null {
  for (const name of HAND_NAMES) {
    const hand=avatar.getObjectByName(name);
    if (hand) return hand;
  }
  return null;
}
export function belongsToAvatar(hand:Object3D,avatar:Object3D):boolean {
  for(let node:Object3D|null=hand;node;node=node.parent) if(node===avatar)return true;
  return false;
}
/** Calibrate once at attachment: point the blade forward/down instead of into the forearm. */
export function swordGripRotation(hand:Object3D,avatar:Object3D):Quaternion {
  const forwardDown=new Vector3(0,-.35,-1).normalize();
  const facing=avatar.getWorldQuaternion(new Quaternion());
  const blade=new Quaternion().setFromUnitVectors(new Vector3(0,-1,0),forwardDown);
  return hand.getWorldQuaternion(new Quaternion()).invert().multiply(facing).multiply(blade);
}
/** Clone only the hierarchy; cached GLB buffers/materials remain shared and unmodified. */
export function createGhostSwordModel(source:Group,held:boolean):Group {
  const object=source.clone(true),root=new Group(),placement=new Group();
  const bounds=new Box3().setFromObject(object),size=bounds.getSize(new Vector3());
  const grip=bounds.getCenter(new Vector3());
  // knife.glb is authored blade-down along Y, with its handle near the upper end.
  if(held)grip.y=bounds.max.y-size.y*.18;
  const scale=(held?.95:2.2)/Math.max(size.x,size.y,size.z,.001);
  placement.scale.setScalar(scale);placement.position.copy(grip).multiplyScalar(-scale);
  placement.add(object);root.add(placement);
  return root;
}
