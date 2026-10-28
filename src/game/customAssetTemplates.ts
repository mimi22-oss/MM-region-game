import type { CustomAsset, CustomPart } from './customAssets';
export type TemplateKind = 'blank' | 'character' | 'building' | 'tree';
const part = (shape: CustomPart['shape'], position: CustomPart['position'], size: CustomPart['size'], color: string, rotation?: CustomPart['rotation']): CustomPart => ({ shape, position, size, color, ...(rotation ? { rotation } : {}) });
export function createCustomTemplate(kind: TemplateKind, id: string): CustomAsset {
  if (kind === 'character') return { id, name: 'Character', nameMm: 'လူပုံစံ', category: 'cultural', dimensions: [1.2, 1.8, 0.7], parts: [
    part('sphere', [0, 0.85, 0], [0.35, 0.18, 0.58], '#c98862'), part('sphere', [0, 0.92, -0.025], [0.37, 0.12, 0.6], '#3c2a24'),
    part('box', [0, 0.57, 0], [0.45, 0.36, 0.5], '#2a8f83'),
    part('cylinder', [-0.29, 0.55, 0], [0.14, 0.36, 0.2], '#c98862'), part('cylinder', [0.29, 0.55, 0], [0.14, 0.36, 0.2], '#c98862'),
    part('box', [-0.12, 0.21, 0], [0.18, 0.39, 0.24], '#34485e'), part('box', [0.12, 0.21, 0], [0.18, 0.39, 0.24], '#34485e'),
    part('box', [-0.12, 0.025, 0.06], [0.2, 0.05, 0.36], '#242d33'), part('box', [0.12, 0.025, 0.06], [0.2, 0.05, 0.36], '#242d33'),
  ] };
  if (kind === 'building') return { id, name: 'Village house', nameMm: 'အိမ်ပုံစံ', category: 'buildings', dimensions: [8, 6, 8], parts: [
    part('box', [0, 0.32, 0], [0.8, 0.62, 0.8], '#d4b38c'), part('pyramid', [0, 0.79, 0], [1.3, 0.32, 1.3], '#8d4934', [0, 45, 0]),
    part('box', [0, 0.22, 0.406], [0.18, 0.44, 0.025], '#704630'), part('box', [-0.25, 0.4, 0.406], [0.18, 0.18, 0.025], '#87bed1'), part('box', [0.25, 0.4, 0.406], [0.18, 0.18, 0.025], '#87bed1'),
  ] };
  if (kind === 'tree') return { id, name: 'Tree', nameMm: 'သစ်ပင်ပုံစံ', category: 'nature', dimensions: [5, 8, 5], parts: [
    part('cylinder', [0, 0.29, 0], [0.13, 0.58, 0.13], '#795136'), part('sphere', [0, 0.68, 0], [0.78, 0.44, 0.78], '#397f49'), part('sphere', [-0.22, 0.63, 0], [0.53, 0.37, 0.59], '#4a9651'), part('sphere', [0.22, 0.68, 0.03], [0.56, 0.38, 0.57], '#348044'),
  ] };
  return { id, name: 'New 3D asset', nameMm: '3D ပုံစံအသစ်', category: 'buildings', dimensions: [6, 6, 6], parts: [part('box', [0, 0.5, 0], [1, 1, 1], '#c49a6c')] };
}
