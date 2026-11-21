import {
  CanvasTexture,
  CircleGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { getWeipulaVillagerCache, type WeipulaVillagerCache } from './weipulaVillagers.ts';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Football Players & Soccer Balls
 * ============================================================================
 * Strictly reuses articulated human anatomy & uniform BufferGeometries from
 * `npcAnatomy.ts`, `schoolNpcUniform.ts`, and `getWeipulaVillagerCache()`,
 * creating ONLY the Red/Green team kit materials, goalkeeper gloves, and
 * soccer ball texture/geometry ONCE globally across all pitches.
 */

export interface FootballMatchAssetCache {
  readonly id: string;
  readonly base: WeipulaVillagerCache;
  readonly ballGeo: SphereGeometry;
  readonly ballShadowGeo: CircleGeometry;
  readonly gloveGeo: SphereGeometry;
  readonly ballTexture: CanvasTexture | null;
  readonly ballMat: MeshStandardMaterial;
  readonly ballShadowMat: MeshBasicMaterial;
  // Team Red (အနီရောင် အသင်း)
  readonly redJerseyMat: MeshStandardMaterial;
  readonly redShortsMat: MeshStandardMaterial;
  readonly redSockMat: MeshStandardMaterial;
  readonly redGkJerseyMat: MeshStandardMaterial;
  readonly redGkGloveMat: MeshStandardMaterial;
  // Team Green (အစိမ်းရောင် အသင်း)
  readonly greenJerseyMat: MeshStandardMaterial;
  readonly greenShortsMat: MeshStandardMaterial;
  readonly greenSockMat: MeshStandardMaterial;
  readonly greenGkJerseyMat: MeshStandardMaterial;
  readonly greenGkGloveMat: MeshStandardMaterial;
  // Shared details
  readonly collarTrimMat: MeshStandardMaterial;
  readonly cleatMat: MeshStandardMaterial;
}

function createSoccerBallTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Classic bright white leather panels
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle panel seams
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  for (let y = 24; y < 128; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Classic black pentagons arranged around equator & poles
  const drawPentagon = (cx: number, cy: number, r: number) => {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  // Top & bottom polar bands
  for (let i = 0; i < 4; i++) {
    drawPentagon(32 + i * 64, 24, 12);
    drawPentagon(64 + i * 64 - 32, 104, 12);
  }
  // Equator pentagons
  for (let i = 0; i < 5; i++) {
    drawPentagon(16 + i * 52, 64, 13.5);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let singletonCache: FootballMatchAssetCache | null = null;

export function getFootballMatchAssetCache(): FootballMatchAssetCache {
  if (singletonCache) return singletonCache;

  const base = getWeipulaVillagerCache();
  const ballTexture = createSoccerBallTexture();

  const created: FootballMatchAssetCache = Object.freeze({
    id: 'football-match-singleton-cache',
    base,
    ballGeo: new SphereGeometry(0.24, 16, 12),
    ballShadowGeo: new CircleGeometry(0.3, 14),
    gloveGeo: new SphereGeometry(0.062, 8, 6),
    ballTexture,
    ballMat: new MeshStandardMaterial({
      color: '#ffffff',
      map: ballTexture ?? undefined,
      roughness: 0.42,
      metalness: 0.04,
    }),
    ballShadowMat: new MeshBasicMaterial({
      color: '#0f172a',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),

    // Team Red (အနီရောင် အသင်း)
    redJerseyMat: new MeshStandardMaterial({ color: '#dc2626', roughness: 0.62 }),
    redShortsMat: new MeshStandardMaterial({ color: '#991b1b', roughness: 0.72 }),
    redSockMat: new MeshStandardMaterial({ color: '#ef4444', roughness: 0.74 }),
    redGkJerseyMat: new MeshStandardMaterial({ color: '#f97316', roughness: 0.58 }),
    redGkGloveMat: new MeshStandardMaterial({ color: '#fde047', roughness: 0.5 }),

    // Team Green (အစိမ်းရောင် အသင်း) — vibrant emerald so players stand out clearly on green grass
    greenJerseyMat: new MeshStandardMaterial({ color: '#10b981', roughness: 0.58 }),
    greenShortsMat: new MeshStandardMaterial({ color: '#065f46', roughness: 0.72 }),
    greenSockMat: new MeshStandardMaterial({ color: '#34d399', roughness: 0.72 }),
    greenGkJerseyMat: new MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.58 }),
    greenGkGloveMat: new MeshStandardMaterial({ color: '#bef264', roughness: 0.5 }),

    collarTrimMat: new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 }),
    cleatMat: new MeshStandardMaterial({ color: '#111827', roughness: 0.5 }),
  });

  singletonCache = created;
  return created;
}

export function disposeFootballMatchAssetCache(): void {
  if (!singletonCache) return;
  const c = singletonCache;
  singletonCache = null;
  c.ballGeo.dispose();
  c.ballShadowGeo.dispose();
  c.gloveGeo.dispose();
  c.ballTexture?.dispose();
  c.ballMat.dispose();
  c.ballShadowMat.dispose();
  c.redJerseyMat.dispose();
  c.redShortsMat.dispose();
  c.redSockMat.dispose();
  c.redGkJerseyMat.dispose();
  c.redGkGloveMat.dispose();
  c.greenJerseyMat.dispose();
  c.greenShortsMat.dispose();
  c.greenSockMat.dispose();
  c.greenGkJerseyMat.dispose();
  c.greenGkGloveMat.dispose();
  c.collarTrimMat.dispose();
  c.cleatMat.dispose();
}
