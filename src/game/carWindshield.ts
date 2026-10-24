import { BufferGeometry, Float32BufferAttribute } from "three";

/**
 * Evaluate a point and outward 2D unit normal on the car's upper cabin Bezier profile:
 * P0 = (0.76, 1.28), P1 = (0.42, 2.55), P2 = (-1.25, 2.55), P3 = (-1.55, 0.43)
 */
export function cabinCurvePoint(t: number, offset = 0) {
  const u = 1 - t;
  const bx =
    u * u * u * 0.76 +
    3 * u * u * t * 0.42 +
    3 * u * t * t * -1.25 +
    t * t * t * -1.55;
  const by =
    u * u * u * 1.28 +
    3 * u * u * t * 2.55 +
    3 * u * t * t * 2.55 +
    t * t * t * 0.43;
  const dx =
    3 * u * u * (0.42 - 0.76) +
    6 * u * t * (-1.25 - 0.42) +
    3 * t * t * (-1.55 - -1.25);
  const dy = 3 * u * u * (2.55 - 1.28) + 3 * t * t * (0.43 - 2.55);
  const len = Math.hypot(dx, dy) || 1;
  const nx = dy / len;
  const ny = -dx / len;
  return {
    y: by + offset * ny,
    z: -(bx + offset * nx),
    ny,
    nz: -nx,
  };
}

/**
 * Curved glass surface following the cabin Bezier profile with subtle lateral crown.
 */
export function windshieldGeometry(
  width = 0.64,
  start = 0.015,
  end = 0.27,
  offset = 0.055,
  xCenter = 0,
) {
  const positions: number[] = [];
  const indices: number[] = [];
  const stepsT = 16;
  const stepsX = 8;
  for (let i = 0; i <= stepsT; i++) {
    const t = start + ((end - start) * i) / stepsT;
    const base = cabinCurvePoint(t, offset);
    for (let j = 0; j <= stepsX; j++) {
      const s = (j / stepsX) * 2 - 1; // -1 .. +1
      const x = xCenter + s * width;
      const crown = (1 - s * s) * 0.018;
      const y = base.y + crown * base.ny;
      const z = base.z + crown * base.nz;
      positions.push(x, y, z);
    }
  }
  const row = stepsX + 1;
  for (let i = 0; i < stepsT; i++) {
    for (let j = 0; j < stepsX; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Solid 3D curved arch ribbon along the cabin Bezier profile (for the roof cap, A-pillars, C-pillars, and window seals).
 */
export function roofBoxRibbonGeometry(
  xMin: number,
  xMax: number,
  start: number,
  end: number,
  innerOffset = -0.015,
  outerOffset = 0.075,
  steps = 16,
) {
  const positions: number[] = [];
  const indices: number[] = [];

  // For each step i, push 4 vertices:
  // 0: (xMin, inner), 1: (xMax, inner), 2: (xMax, outer), 3: (xMin, outer)
  for (let i = 0; i <= steps; i++) {
    const t = start + ((end - start) * i) / steps;
    const inn = cabinCurvePoint(t, innerOffset);
    const out = cabinCurvePoint(t, outerOffset);
    positions.push(
      xMin,
      inn.y,
      inn.z,
      xMax,
      inn.y,
      inn.z,
      xMax,
      out.y,
      out.z,
      xMin,
      out.y,
      out.z,
    );
  }

  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };

  for (let i = 0; i < steps; i++) {
    const b0 = i * 4;
    const b1 = (i + 1) * 4;
    // Top / outer face (2 -> 3 -> b1+3 -> b1+2)
    quad(b0 + 2, b0 + 3, b1 + 3, b1 + 2);
    // Bottom / inner face (0 -> 1 -> b1+1 -> b1+0)
    quad(b0 + 0, b0 + 1, b1 + 1, b1 + 0);
    // Right (+X) face (1 -> 2 -> b1+2 -> b1+1)
    quad(b0 + 1, b0 + 2, b1 + 2, b1 + 1);
    // Left (-X) face (3 -> 0 -> b1+0 -> b1+3)
    quad(b0 + 3, b0 + 0, b1 + 0, b1 + 3);
  }

  // Start cap (i = 0)
  quad(0, 3, 2, 1);
  // End cap (i = steps)
  const last = steps * 4;
  quad(last + 0, last + 1, last + 2, last + 3);

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
