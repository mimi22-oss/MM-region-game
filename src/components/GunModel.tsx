import { useMemo } from 'react';
import { createProceduralGunModel } from '../game/missions/gunAttachment';

export function GunModel({ held = true }: { held?: boolean }) {
  const model = useMemo(() => createProceduralGunModel(held), [held]);
  return <primitive object={model} />;
}
