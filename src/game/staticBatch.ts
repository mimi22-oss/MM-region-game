import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

/** Batch opaque, immobile primitives by material and 128 m tile for culling. */
export function batchStaticMeshes(root: Group) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(),
    unitBox = new BoxGeometry(1, 1, 1);
  const groups = new Map<
    string,
    {
      geometry: BufferGeometry;
      material: Material;
      items: { mesh: Mesh; matrix: Matrix4 }[];
    }
  >();
  const materialKeys = new WeakMap<Material, string>();
  root.traverse((object) => {
    if (
      !(object instanceof Mesh) ||
      object instanceof InstancedMesh ||
      !object.visible ||
      Array.isArray(object.material)
    )
      return;
    for (let p: Object3D | null = object; p && p !== root; p = p.parent)
      if (p.userData.dynamic || !p.visible) return;
    const material = object.material;
    if (
      material.transparent ||
      !["MeshStandardMaterial", "MeshBasicMaterial"].includes(material.type)
    )
      return;
    let materialKey = materialKeys.get(material);
    if (!materialKey) {
      const json = material.toJSON();
      delete json.uuid;
      delete json.metadata;
      materialKey = JSON.stringify(json);
      materialKeys.set(material, materialKey);
    }
    const geometry = object.geometry,
      parameters = (
        geometry as BufferGeometry & { parameters?: Record<string, number> }
      ).parameters;
    if (!parameters) return;
    const matrix = new Matrix4().multiplyMatrices(inverse, object.matrixWorld);
    let shape = geometry;
    if (geometry.type === "BoxGeometry") {
      shape = unitBox;
      matrix.multiply(
        new Matrix4().makeScale(
          parameters.width,
          parameters.height,
          parameters.depth,
        ),
      );
    }
    const e = matrix.elements;
    const detail = shape === unitBox && matrix.getMaxScaleOnAxis() < 5;
    const key = JSON.stringify([
      Math.floor(e[12] / 128),
      Math.floor(e[14] / 128),
      shape === unitBox ? "box" : [geometry.type, parameters],
      detail,
      materialKey,
      object.castShadow,
      object.receiveShadow,
      object.renderOrder,
      Boolean(object.userData.walkable),
    ]);
    let group = groups.get(key);
    if (!group) {
      group = { geometry: shape, material, items: [] };
      groups.set(key, group);
    }
    group.items.push({ mesh: object, matrix });
  });
  const removed: { mesh: Mesh; parent: Object3D }[] = [],
    batches: InstancedMesh[] = [];
  for (const group of groups.values()) {
    if (group.items.length < 2) continue;
    const first = group.items[0].mesh,
      batch = new InstancedMesh(
        group.geometry,
        group.material,
        group.items.length,
      );
    batch.userData.walkable=Boolean(first.userData.walkable);
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    group.items.forEach(({ mesh, matrix }, i) => {
      batch.setMatrixAt(i, matrix);
      removed.push({ mesh, parent: mesh.parent! });
      mesh.removeFromParent();
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    batch.name = "static-tile";
    batch.userData.detail =
      group.geometry === unitBox &&
      group.items.every((item) => item.matrix.getMaxScaleOnAxis() < 5);
    root.add(batch);
    batches.push(batch);
  }
  // Batching removed the leaves. Remove their empty parent trees as well so
  // rendering, ground queries and camera rays do not visit thousands of empty groups.
  const emptyGroups: { group: Group; parent: Object3D }[] = [];
  function prune(parent: Object3D) {
    for (const child of [...parent.children]) {
      if (!(child instanceof Group) || child.userData.dynamic) continue;
      prune(child);
      if (child.children.length === 0) {
        emptyGroups.push({ group: child, parent });
        parent.remove(child);
      }
    }
  }
  prune(root);
  return {
    batches,
    sourceMeshes: removed.length,
    batchCount: batches.length,
    prunedGroups: emptyGroups.length,
    dispose() {
      for (const batch of batches) {
        root.remove(batch);
        batch.dispose();
      }
      for (const { group, parent } of [...emptyGroups].reverse()) parent.add(group);
      for (const { mesh, parent } of removed) parent.add(mesh);
      unitBox.dispose();
    },
  };
}
