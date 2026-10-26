import { Group, InstancedMesh, Mesh, OrthographicCamera, Scene, WebGLRenderTarget, type WebGLRenderer, type BufferGeometry, type Material, type Object3D, Light } from 'three';
import { mobileQuality, type RegionBounds } from './sceneBudget.ts';

/** Keep the batched render objects, allowing the much larger React source tree to be released. */
export function snapshotRegion(source: Group) {
 const result = source.clone(true);
 result.traverse(object => {
  object.updateMatrix();
  object.matrixAutoUpdate = !!object.userData.flowPeriod;
 });
 return result;
}

export function regionFlows(root: Group) {
 const flows: Object3D[] = [];
 root.traverse(object => { if (object.userData.flowPeriod || object.userData.flowPath) flows.push(object); });
 return flows;
}

export function animateRegionFlows(flows: Object3D[], time: number) {
 for (const flow of flows) {
  if (flow.userData.flowPeriod) flow.position.z = (time * flow.userData.flowSpeed) % flow.userData.flowPeriod;
  const path = flow.userData.flowPath as {total:number;segments:{a:number;b:number;u:number;v:number;length:number}[]} | undefined;
  if (!path || path.total <= 0) continue;
  flow.children.forEach((child, i) => {
   let distance = (i * 8 + time * 1.5) % path.total;
   for (const segment of path.segments) {
    if (distance <= segment.length) {
     child.position.set(segment.a + (segment.u - segment.a) * distance / segment.length, .18, segment.b + (segment.v - segment.b) * distance / segment.length);
     child.updateMatrix(); break;
    }
    distance -= segment.length;
   }
  });
 }
}

/** Upload geometry and compile materials during the one startup wait. On mobile, safely bypass to save memory. */
export async function warmRegion(renderer: WebGLRenderer, world: Scene, root: Group, bounds: RegionBounds) {
 if (mobileQuality) {
  // Mobile GPUs have strictly limited memory budgets; bypass offscreen render target to prevent context exhaustion
  return;
 }
 const staging = new Scene();
 staging.fog = world.fog;
 staging.environment = world.environment;
 for (const child of world.children) if (child instanceof Light) staging.add(child.clone());
 const width = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) + 100;
 const camera = new OrthographicCamera(-width / 2, width / 2, width / 2, -width / 2, .1, 20000);
 const x = (bounds.minX + bounds.maxX) / 2, z = (bounds.minZ + bounds.maxZ) / 2;
 camera.position.set(x, 3000, z + 1);
 camera.lookAt(x, 0, z);
 const parent = root.parent;
 staging.add(root);
 const target = new WebGLRenderTarget(1, 1);
 try {
  await renderer.compileAsync(staging, camera);
  const previous = renderer.getRenderTarget();
  const autoShadow = renderer.shadowMap.autoUpdate, needsShadow = renderer.shadowMap.needsUpdate;
  const culling: [Mesh, boolean][] = [];
  root.traverse(object => { if (object instanceof Mesh) { culling.push([object, object.frustumCulled]); object.frustumCulled = false; } });
  try {
   renderer.shadowMap.autoUpdate = false;
   renderer.shadowMap.needsUpdate = false;
   renderer.setRenderTarget(target);
   renderer.render(staging, camera);
  } finally {
   renderer.setRenderTarget(previous);
   renderer.shadowMap.autoUpdate = autoShadow;
   renderer.shadowMap.needsUpdate = needsShadow;
   for (const [mesh, enabled] of culling) mesh.frustumCulled = enabled;
  }
 } finally {
  root.removeFromParent();
  if (parent) parent.add(root);
  target.dispose();
 }
}

export function disposePreparedRegion(root: Group) {
 root.removeFromParent();
 const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
 root.traverse(object => {
  if (!(object instanceof Mesh)) return;
  if (object instanceof InstancedMesh) object.dispose();
  geometries.add(object.geometry);
  (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
 });
 for (const geometry of geometries) if (!geometry.userData.shared) geometry.dispose();
 for (const material of materials) if (!material.userData.shared) material.dispose();
}
