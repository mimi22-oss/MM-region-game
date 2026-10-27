import type { ComponentType } from 'react';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { myotharCenterBuildings } from '../data/wards/myothar/center/index.ts';
import { kalayArea1Buildings } from '../data/wards/kalayArea1/kalayArea1Buildings.ts';
import { RegionDownloadQueue } from '../game/regionLoading';
import kalaySignFace from '../assets/kalay_sign_face.png';
import burmeseLionEmblem from '../assets/burmese_lion_emblem.png';

import { startupDiagnostics } from '../game/startupDiagnostics';
import { diagnosticConfig } from '../game/diagnosticMode';

const images = new Map<string, Promise<void>>();
function preloadImage(url: string) {
  const existing = images.get(url);
  if (existing) return existing;
  const pending = new Promise<void>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      image.decode().then(() => resolve()).catch(() => resolve());
    };
    image.onerror = () => {
      console.warn('[regionAssets] Non-fatal texture preload failure for:', url);
      resolve(); // Do not block game startup on image error
    };
    image.src = url;
  });
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
  sithar: () => import('./villages/sithar/SiTharVillage').then(m => m.SiTharVillage),
  kanbale: () => import('./villages/kanbale/KanbaleVillage').then(m => m.KanbaleVillage),
  natmyaung: () => import('./villages/natmyaung/NatmyaungVillage').then(m => m.NatmyaungVillage),
};

export const worldRegions = [
  {
    id: 'myothar',
    name: ward.name,
    houses: [
      ...ward.houses,
      ...myotharCenterBuildings.map((b) => ({
        id: b.id,
        name: b.name,
        x: b.x,
        z: b.z,
        width: b.width,
        depth: b.depth,
        color: b.wallColor,
        rotation: b.rotation,
        roof: b.roofColor,
      })),
      ...kalayArea1Buildings.map((b) => ({
        id: b.id,
        name: b.name,
        x: b.x,
        z: b.z,
        width: b.width,
        depth: b.depth,
        color: b.wallColor,
        rotation: b.rotation,
        roof: b.roofColor,
      })),
    ],
    roads: ward.roads,
    fields: ward.fields,
  },
  ...kalayVillages,
];

export const regionAssets = new RegionDownloadQueue(worldRegions.map(region => ({
  id: region.id,
  name: region.name,
  load: async () => {
    startupDiagnostics.record('map-data-load', { regionId: region.id, name: region.name });
    const shouldLoadTextures = !diagnosticConfig.disableTextures && region.id === 'myothar';
    const [Scene] = await Promise.all([
      loaders[region.id](),
      ...(shouldLoadTextures ? [preloadImage(kalaySignFace), preloadImage(burmeseLionEmblem)] : []),
    ]);
    if (shouldLoadTextures) {
      startupDiagnostics.record('texture-load', { regionId: region.id });
    }
    return Scene;
  },
})));
