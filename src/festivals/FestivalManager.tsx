import { lazy, Suspense, useEffect, useMemo, type ComponentType } from 'react';
import { useThree } from '@react-three/fiber';
import { periodAtMinute } from '../game/environmentTime.ts';
import { useFestivalConfiguration } from './FestivalConfiguration.ts';
import {
  resolveActiveFestivalPlugin,
  type FestivalPluginSceneProps,
} from './FestivalRegistry.ts';

const lazyPluginCache = new Map<string, ComponentType<FestivalPluginSceneProps>>();

function getLazyPluginComponent(
  id: string,
  loader: () => Promise<{ default: ComponentType<FestivalPluginSceneProps> }>,
): ComponentType<FestivalPluginSceneProps> {
  let cached = lazyPluginCache.get(id);
  if (!cached) {
    cached = lazy(loader);
    lazyPluginCache.set(id, cached);
  }
  return cached;
}

export interface FestivalManagerProps {
  minute: number;
}

/**
 * Reusable R3F Festival Overlay Manager.
 * Mounts inside the existing Canvas and only loads/renders festival scene assets when enabled.
 */
export function FestivalManager({ minute }: FestivalManagerProps) {
  const { scene } = useThree();
  const config = useFestivalConfiguration();
  const period = periodAtMinute(minute);
  const night = period === 'night' || period === 'evening';

  const activePlugin = useMemo(() => resolveActiveFestivalPlugin(config), [config]);

  useEffect(() => {
    if (activePlugin) return;
    const roots = scene.children;
    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      if (root.name === 'festival-candles' || root.name === 'festival-overview') {
        root.visible = false;
      }
      const children = root.children;
      for (let j = 0; j < children.length; j++) {
        const child = children[j];
        if (child.name === 'festival-candles' || child.name === 'festival-overview') {
          child.visible = false;
        }
      }
    }
  }, [activePlugin, scene]);

  if (!activePlugin) {
    return null;
  }

  const PluginScene = getLazyPluginComponent(activePlugin.id, activePlugin.loadScene);

  return (
    <Suspense fallback={null}>
      <PluginScene config={config} minute={minute} night={night} />
    </Suspense>
  );
}

export default FestivalManager;
