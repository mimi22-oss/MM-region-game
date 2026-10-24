/** Immutable uniform grid for static obstacle candidates. */
export function spatialIndex<T>(
  items: readonly T[],
  bounds: (item: T) => { x: number; z: number; radius: number },
  size = 64,
) {
  const cells = new Map<string, T[]>(),
    empty: readonly T[] = [];
  for (const item of items) {
    const b = bounds(item);
    for (
      let x = Math.floor((b.x - b.radius) / size);
      x <= Math.floor((b.x + b.radius) / size);
      x++
    )
      for (
        let z = Math.floor((b.z - b.radius) / size);
        z <= Math.floor((b.z + b.radius) / size);
        z++
      ) {
        const key = `${x},${z}`;
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = [];
          cells.set(key, bucket);
        }
        bucket.push(item);
      }
  }
  return (x: number, z: number): readonly T[] =>
    cells.get(`${Math.floor(x / size)},${Math.floor(z / size)}`) ?? empty;
}
