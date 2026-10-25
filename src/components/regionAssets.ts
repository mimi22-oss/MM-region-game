import type { ComponentType } from 'react';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { RegionDownloadQueue } from '../game/regionLoading';
import kalaySignFace from '../assets/kalay_sign_face.png';
import burmeseLionEmblem from '../assets/burmese_lion_emblem.png';

const images = new Map<string, Promise<void>>();
function preloadImage(url: string) {
  const existing = images.get(url);
  if (existing) return existing;
  const pending = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => { image.decode().then(resolve, reject); };
    image.onerror = () => reject(new Error('Scene image could not be loaded'));
    image.src = url;
  }).catch(error => { images.delete(url); throw error; });
  images.set(url, pending);
  return pending;
}

const loaders: Record<string, () => Promise<ComponentType>> = {
  myothar: () => import('./wards/myothar').then(m => m.MyotharWard),
  tharsi: () => import('./villages/tharsi').then(m => m.TharSiVillage),
  chinsai: () => import('./villages/chinsai').then(m => m.ChinSaiVillage),
  zingalin: () => import('./villages/zingalin').then(m => m.ZingalinVillage),
  htomar: () => import('./villages/htomar').then(m => m.HtomarVillage),
  tharyargone: () => import('./villages/tharyargone').then(m => m.TharYarGoneVillage),
  htaukkyant: () => import('./villages/htaukkyant').then(m => m.HtaukKyantVillage),
  kyarinn: () => import('./villages/kyarinn').then(m => m.KyarInnVillage),
  kanbale: () => import('./villages/kanbale/KanbaleVillage').then(m => m.KanbaleVillage),
  natmyaung: () => import('./villages/natmyaung/NatmyaungVillage').then(m => m.NatmyaungVillage),
};

export const worldRegions = [
  { id: 'myothar', name: ward.name, houses: ward.houses, roads: ward.roads, fields: ward.fields },
  ...kalayVillages,
];

export const regionAssets = new RegionDownloadQueue(worldRegions.map(region => ({
  id: region.id,
  name: region.name,
  load: async () => {
    const [Scene] = await Promise.all([
      loaders[region.id](),
      ...(region.id === 'myothar' ? [preloadImage(kalaySignFace), preloadImage(burmeseLionEmblem)] : []),
    ]);
    return Scene;
  },
})));
