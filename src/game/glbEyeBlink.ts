import {
 Color,
 Matrix4,
 type Material,
 MeshStandardMaterial,
 type Object3D,
 Raycaster,
 SkinnedMesh,
 SRGBColorSpace,
 type Texture,
 Vector2,
 Vector3,
 Vector4,
} from 'three';

export type GlbEyePreset = 'boy' | 'girl';

export interface GlbEyeBlinkController {
 step(dt: number): void;
 value(): number;
 dispose(): void;
}

interface EyeBlinkProfile {
 cx: number;
 cy: number;
 rx: number;
 ry: number;
 zMin: number;
 curve: number;
}

const EYE_BLINK_PROFILES: Record<GlbEyePreset, EyeBlinkProfile> = {
 boy: { cx: 0.073, cy: 0.130, rx: 0.047, ry: 0.040, zMin: 0.082, curve: 0.006 },
 girl: { cx: 0.096, cy: 0.122, rx: 0.060, ry: 0.043, zMin: 0.125, curve: 0.008 },
};

const BLINK_DURATION = 0.17;
const HALF_BLINK = BLINK_DURATION * 0.5;
const BRIDGE_XS = [-0.006, 0, 0.006] as const;
const BRIDGE_DYS = [0.135, 0.145, 0.155] as const;
const DEFAULT_SKIN_COLOR = new Color('#e8ab90');
const EYELASH_COLOR = new Color('#221614');

const skinSampleCache = new WeakMap<Texture, Color>();
let instanceSeed = 0;

function sampleBridgeSkin(skinned: SkinnedMesh, mat: MeshStandardMaterial, headPos: Vector3): Color {
 const map = mat.map;
 if (!map) return DEFAULT_SKIN_COLOR;
 const cached = skinSampleCache.get(map);
 if (cached) return cached;

 const img = map.image as { width?: number; height?: number } | undefined;
 if (!img || !img.width || !img.height || typeof document === 'undefined') {
  return DEFAULT_SKIN_COLOR;
 }

 try {
  let ctx: CanvasRenderingContext2D | null = null;
  if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) {
   ctx = img.getContext('2d', { willReadFrequently: true });
  }
  if (!ctx) {
   const canvas = document.createElement('canvas');
   canvas.width = img.width;
   canvas.height = img.height;
   ctx = canvas.getContext('2d', { willReadFrequently: true });
   if (!ctx) return DEFAULT_SKIN_COLOR;
   ctx.drawImage(img as CanvasImageSource, 0, 0);
  }

  const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
  const raycaster = new Raycaster();
  const origin = new Vector3();
  const dir = new Vector3(0, 0, -1);
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let xi = 0; xi < BRIDGE_XS.length; xi++) {
   for (let yi = 0; yi < BRIDGE_DYS.length; yi++) {
    raycaster.set(origin.set(BRIDGE_XS[xi], headPos.y + BRIDGE_DYS[yi], headPos.z + 0.6), dir);
    const hits = raycaster.intersectObject(skinned, false);
    if (!hits.length || !hits[0].uv) continue;
    const uv = hits[0].uv;
    const px = Math.max(0, Math.min(img.width - 1, Math.round(uv.x * (img.width - 1))));
    const py = Math.max(0, Math.min(img.height - 1, Math.round((map.flipY ? 1 - uv.y : uv.y) * (img.height - 1))));
    const idx = (py * img.width + px) * 4;
    rSum += pixels[idx];
    gSum += pixels[idx + 1];
    bSum += pixels[idx + 2];
    count++;
   }
  }

  if (!count) return DEFAULT_SKIN_COLOR;
  const sampled = new Color().setRGB(
   ((rSum / count) / 255) * 0.96,
   ((gSum / count) / 255) * 0.94,
   ((bSum / count) / 255) * 0.94,
   SRGBColorSpace,
  );
  skinSampleCache.set(map, sampled);
  return sampled;
 } catch {
  return DEFAULT_SKIN_COLOR;
 }
}

function attachBlinkShader(
 mat: MeshStandardMaterial,
 bindToHead: Matrix4,
 profile: EyeBlinkProfile,
 skinColor: Color,
 blinkUniform: { value: number },
): void {
 mat.customProgramCacheKey = () => 'glb-eye-blink-v1';
 mat.onBeforeCompile = shader => {
  shader.uniforms.uBlink = blinkUniform;
  shader.uniforms.uBindToHead = { value: bindToHead };
  shader.uniforms.uEyeParams = { value: new Vector4(profile.cx, profile.cy, profile.rx, profile.ry) };
  shader.uniforms.uEyeExtra = { value: new Vector2(profile.zMin, profile.curve) };
  shader.uniforms.uEyelidColor = { value: skinColor };
  shader.uniforms.uEyelashColor = { value: EYELASH_COLOR };

  shader.vertexShader = shader.vertexShader
   .replace('#include <common>', '#include <common>\nuniform mat4 uBindToHead;\nvarying vec3 vHeadBindPos;')
   .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadBindPos = (uBindToHead * vec4(position, 1.0)).xyz;');

  shader.fragmentShader = shader.fragmentShader
   .replace(
    '#include <common>',
    `#include <common>
uniform float uBlink;
uniform vec4 uEyeParams;
uniform vec2 uEyeExtra;
uniform vec3 uEyelidColor;
uniform vec3 uEyelashColor;
varying vec3 vHeadBindPos;`,
   )
   .replace(
    '#include <map_fragment>',
    `#include <map_fragment>
float glbBlinkCover = 0.0;
if (uBlink > 0.002 && vHeadBindPos.z > uEyeExtra.x) {
  float absX = abs(vHeadBindPos.x);
  float dx = (absX - uEyeParams.x) / uEyeParams.z;
  float dy = (vHeadBindPos.y - uEyeParams.y) / uEyeParams.w;
  float r2 = dx * dx + dy * dy;
  if (r2 < 1.15) {
    float eyeMask = 1.0 - smoothstep(0.84, 1.06, r2);
    float arch = (1.0 - min(1.0, dx * dx)) * uEyeExtra.y;
    float meetY = uEyeParams.y - uEyeParams.w * 0.24 - arch * 0.35;
    float topStart = uEyeParams.y + uEyeParams.w * 1.15 + arch;
    float botStart = uEyeParams.y - uEyeParams.w * 1.15 - arch * 0.2;
    float upperEdge = mix(topStart, meetY, uBlink);
    float lowerEdge = mix(botStart, meetY, uBlink);

    float upperCover = smoothstep(upperEdge - 0.0025, upperEdge + 0.0025, vHeadBindPos.y);
    float lowerCover = 1.0 - smoothstep(lowerEdge - 0.0025, lowerEdge + 0.0025, vHeadBindPos.y);
    glbBlinkCover = clamp(upperCover + lowerCover, 0.0, 1.0) * eyeMask;

    float upperLash = exp(-pow((vHeadBindPos.y - upperEdge) / 0.0022, 2.0)) * smoothstep(0.12, 0.55, uBlink);
    float lowerLash = exp(-pow((vHeadBindPos.y - lowerEdge) / 0.0015, 2.0)) * smoothstep(0.75, 1.0, uBlink) * 0.45;
    float lashMix = clamp(max(upperLash, lowerLash) * eyeMask, 0.0, 0.88);

    vec3 lidShade = mix(uEyelidColor, uEyelashColor, lashMix);
    diffuseColor.rgb = mix(diffuseColor.rgb, lidShade, glbBlinkCover);
  }
}`,
   )
   .replace(
    '#include <roughnessmap_fragment>',
    `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.86, glbBlinkCover);`,
   )
   .replace(
    '#include <metalnessmap_fragment>',
    `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.0, glbBlinkCover);`,
   )
   .replace(
    '#include <normal_fragment_maps>',
    `vec3 glbSmoothNormal = normal;
#include <normal_fragment_maps>
normal = normalize(mix(normal, glbSmoothNormal, glbBlinkCover));`,
   );
 };
 mat.needsUpdate = true;
}

/**
 * Attaches an allocation-free eyelid blink shader and natural blink timer to textured
 * GLB character skinned meshes in upright +Z bind pose before placement rotation is applied.
 */
export function createGlbEyeBlink(object: Object3D, preset?: GlbEyePreset): GlbEyeBlinkController {
 const head = object.getObjectByName('mixamorigHead');
 const headPos = new Vector3();
 if (head) head.getWorldPosition(headPos);
 const resolvedPreset: GlbEyePreset = preset ?? (head && headPos.y < 1.335 ? 'girl' : 'boy');
 const profile = EYE_BLINK_PROFILES[resolvedPreset];

 const blinkUniform = { value: 0 };
 const clonedMaterials: Material[] = [];
 const headOffset = new Matrix4().makeTranslation(-headPos.x, -headPos.y, -headPos.z);

 if (head) {
  object.traverse(child => {
   if (!(child instanceof SkinnedMesh)) return;
   const bindToHead = new Matrix4().multiplyMatrices(headOffset, child.matrixWorld);
   const cloneAndPatch = (mat: Material): Material => {
    if (!(mat instanceof MeshStandardMaterial) || !mat.map) return mat;
    const cloned = mat.clone();
    const skinColor = sampleBridgeSkin(child, mat, headPos);
    attachBlinkShader(cloned, bindToHead, profile, skinColor, blinkUniform);
    clonedMaterials.push(cloned);
    return cloned;
   };
   if (Array.isArray(child.material)) {
    child.material = child.material.map(cloneAndPatch);
   } else {
    child.material = cloneAndPatch(child.material);
   }
  });
 }

 const seed = ++instanceSeed;
 let elapsed = seed * 0.9;
 let timer = 0.6 + ((seed * 0.83) % 2.5);

 function step(dt: number): void {
  elapsed += dt;
  timer -= dt;
  if (timer < -BLINK_DURATION) {
   timer = 3.1 + Math.sin(elapsed * 2.3) * 0.8;
  }
  if (timer < 0) {
   const raw = Math.min(1, Math.max(0, 1 - Math.abs(timer + HALF_BLINK) / HALF_BLINK) * 1.18);
   blinkUniform.value = raw * raw * (3 - 2 * raw);
  } else {
   blinkUniform.value = 0;
  }
 }

 return {
  step,
  value: () => blinkUniform.value,
  dispose: () => {
   for (let i = 0; i < clonedMaterials.length; i++) clonedMaterials[i].dispose();
   clonedMaterials.length = 0;
  },
 };
}
