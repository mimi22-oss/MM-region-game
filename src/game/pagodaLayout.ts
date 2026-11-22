export interface PagodaPlacement {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly yaw?: number;
  readonly radius: number;
  readonly weekdayShrines?: boolean;
}

export const PAGODA_PLINTH_SIDES = 8;
export const PAGODA_APRON = { baseY: .04, thickness: .018, radius: 1.13, shrineRadius: 1.76 };
export const PAGODA_SHRINE = { distance: 1.49, referenceRadius: 5, width: 1.72, depth: 1.44 };
export const PAGODA_OUTLINE = Array.from({ length: PAGODA_PLINTH_SIDES }, (_, i) => {
  const heading = i * Math.PI / 4;
  return { x: Math.sin(heading), z: Math.cos(heading) };
});

// The compass matches the local U/V axes of the map. Wednesday is represented by two corners.
export const PAGODA_WEEKDAYS = [
  { id: 'friday', bearing: 0, label: 'သောကြာ', animal: 'ပူး', figure: 'guinea-pig' },
  { id: 'sunday', bearing: 45, label: 'တနင်္ဂနွေ', animal: 'ဂဠုန်', figure: 'garuda' },
  { id: 'monday', bearing: 90, label: 'တနင်္လာ', animal: 'ကျား', figure: 'tiger' },
  { id: 'tuesday', bearing: 135, label: 'အင်္ဂါ', animal: 'ခြင်္သေ့', figure: 'lion' },
  { id: 'wednesday', bearing: 180, label: 'ဗုဒ္ဓဟူး', animal: 'အစွယ်ပါဆင်', figure: 'elephant' },
  { id: 'saturday', bearing: 225, label: 'စနေ', animal: 'နဂါး', figure: 'naga' },
  { id: 'thursday', bearing: 270, label: 'ကြာသပတေး', animal: 'ကြွက်', figure: 'mouse' },
  { id: 'rahu', bearing: 315, label: 'ရာဟု', animal: 'အစွယ်မဲ့ဆင်', figure: 'tuskless-elephant' },
] as const;
export type PagodaAnimal = (typeof PAGODA_WEEKDAYS)[number]['figure'];

export function getPagodaShrines(stupa: PagodaPlacement, northYaw = 0) {
  if (!stupa.weekdayShrines) return [];
  const distance = stupa.radius * PAGODA_SHRINE.distance;
  const scale = stupa.radius / PAGODA_SHRINE.referenceRadius;
  return PAGODA_WEEKDAYS.map(day => {
    const yaw = northYaw + Math.PI - day.bearing * Math.PI / 180;
    return { ...day, x: stupa.x + Math.sin(yaw) * distance, z: stupa.z + Math.cos(yaw) * distance, yaw, scale };
  });
}

export type PagodaShrinePlacement = ReturnType<typeof getPagodaShrines>[number];

export function touchesPagodaPlinth(x: number, z: number, playerRadius: number, stupa: PagodaPlacement) {
  const dx = x - stupa.x, dz = z - stupa.z;
  const reach = stupa.radius + playerRadius;
  if (dx * dx + dz * dz > reach * reach) return false;
  const yaw = stupa.yaw ?? 0;
  // An octagon expanded by a circular player footprint, with rounded rather than square corners.
  const lx = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / stupa.radius;
  const lz = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / stupa.radius;
  const paddingSq = (playerRadius / stupa.radius) ** 2;
  let inside = true;
  for (let i = 0; i < PAGODA_OUTLINE.length; i++) {
    const a = PAGODA_OUTLINE[i], b = PAGODA_OUTLINE[(i + 1) % PAGODA_OUTLINE.length];
    const ex = b.x - a.x, ez = b.z - a.z;
    const px = lx - a.x, pz = lz - a.z;
    if (ex * pz - ez * px > 0) inside = false;
    const t = Math.max(0, Math.min(1, (px * ex + pz * ez) / (ex * ex + ez * ez)));
    if ((px - t * ex) ** 2 + (pz - t * ez) ** 2 < paddingSq) return true;
  }
  return inside;
}

export function touchesPagodaShrine(x: number, z: number, playerRadius: number, shrine: PagodaShrinePlacement) {
  const dx = x - shrine.x, dz = z - shrine.z;
  const reach = 1.16 * shrine.scale + playerRadius;
  if (dx * dx + dz * dz > reach * reach) return false;
  const c = Math.cos(shrine.yaw), s = Math.sin(shrine.yaw);
  const outsideX = Math.max(0, Math.abs(dx * c - dz * s) - PAGODA_SHRINE.width * shrine.scale / 2);
  const outsideZ = Math.max(0, Math.abs(dx * s + dz * c) - PAGODA_SHRINE.depth * shrine.scale / 2);
  return outsideX * outsideX + outsideZ * outsideZ < playerRadius * playerRadius;
}
