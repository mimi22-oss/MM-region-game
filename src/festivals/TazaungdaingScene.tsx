import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { FestivalLighting } from '../components/FestivalLighting.tsx';
import { areBalloonsVisibleAtMinute } from '../game/environmentTime.ts';
import { resolveActiveFestivalZones } from './FestivalConfiguration.ts';
import type { FestivalPluginSceneProps } from './FestivalRegistry.ts';
import { BalloonShow } from './BalloonShow.tsx';
import { FestivalDecorations } from './FestivalDecorations.tsx';

function setFestivalCandleGroupsVisible(scene: { children: { name: string; visible: boolean; children: { name: string; visible: boolean }[] }[] }, visible: boolean) {
  const roots = scene.children;
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    if (root.name === 'festival-candles' || root.name === 'festival-overview') {
      root.visible = visible;
    }
    const children = root.children;
    for (let j = 0; j < children.length; j++) {
      const child = children[j];
      if (child.name === 'festival-candles' || child.name === 'festival-overview') {
        child.visible = visible;
      }
    }
  }
}

export function TazaungdaingScene({ config, minute, night }: FestivalPluginSceneProps) {
  const { scene } = useThree();
  const zones = useMemo(() => resolveActiveFestivalZones(config), [config]);
  // Balloons stay hidden during daytime and appear strictly at night.
  const showBalloons = areBalloonsVisibleAtMinute(minute);

  // Ensure regional fence/porch candle batches update immediately on mount & unmount without deep traversal
  useEffect(() => {
    setFestivalCandleGroupsVisible(scene, true);
    return () => {
      setFestivalCandleGroupsVisible(scene, false);
    };
  }, [scene]);

  return (
    <group name="tazaungdaing-festival-scene" userData={{cameraIgnore:true}}>
      <FestivalLighting night={night} />
      <BalloonShow
        zones={zones}
        balloonsPerZone={config.balloonsPerZone}
        active={showBalloons}
        seed={config.seed}
      />
      {config.decorationsEnabled && (
        <FestivalDecorations zones={zones} night={night} showBalloons={showBalloons} />
      )}
    </group>
  );
}

export default TazaungdaingScene;
