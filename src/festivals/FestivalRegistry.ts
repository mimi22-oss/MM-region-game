import type { ComponentType } from 'react';
import {
  TAZAUNGDAING_START_DATE,
  TAZAUNGDAING_END_DATE,
  isFestivalActive,
  type FestivalConfigurationState,
} from './FestivalConfiguration.ts';

export interface FestivalPluginSceneProps {
  config: FestivalConfigurationState;
  minute: number;
  night: boolean;
}

export interface FestivalPlugin {
  id: string;
  name: string;
  myanmarName: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  /** Lazy loader for the festival scene overlay so disabled festivals do not load scene assets. */
  loadScene: () => Promise<{ default: ComponentType<FestivalPluginSceneProps> }>;
}

const registry = new Map<string, FestivalPlugin>();

export function registerFestivalPlugin(plugin: FestivalPlugin): void {
  if (!plugin || !plugin.id) {
    throw new Error('FestivalPlugin must define a valid non-empty id');
  }
  registry.set(plugin.id, plugin);
}

export function unregisterFestivalPlugin(id: string): boolean {
  return registry.delete(id);
}

export function getFestivalPlugin(id: string): FestivalPlugin | undefined {
  return registry.get(id);
}

export function listFestivalPlugins(): FestivalPlugin[] {
  return Array.from(registry.values());
}

/**
 * Resolves the currently active festival plugin based on configuration and date window.
 * Returns null if the festival system is disabled or outside the active schedule window.
 */
export function resolveActiveFestivalPlugin(
  config: FestivalConfigurationState,
  now: Date = new Date(),
): FestivalPlugin | null {
  const plugin = registry.get(config.activeFestivalId);
  if (!plugin) return null;
  const active = isFestivalActive(config, now, plugin.startDate, plugin.endDate);
  return active ? plugin : null;
}

/**
 * Register Tazaungdaing Festival (တန်ဆောင်တိုင် မီးထွန်းပွဲတော်) as the first built-in festival plugin.
 * Dates: 2026-11-15 through 2026-11-24.
 */
export const TAZAUNGDAING_PLUGIN: FestivalPlugin = {
  id: 'tazaungdaing',
  name: 'Tazaungdaing Festival',
  myanmarName: 'တန်ဆောင်တိုင် မီးထွန်းပွဲတော်',
  description:
    'Traditional Myanmar Tazaungdaing Festival of Lights featuring hot-air fire balloon launch shows and lantern decorations (2026 Nov 15 – Nov 24).',
  startDate: TAZAUNGDAING_START_DATE,
  endDate: TAZAUNGDAING_END_DATE,
  loadScene: () => import('./TazaungdaingScene.tsx'),
};

registerFestivalPlugin(TAZAUNGDAING_PLUGIN);
