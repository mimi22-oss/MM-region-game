import { createContext, useContext } from 'react';
import { useFrame, type RenderCallback } from '@react-three/fiber';

export const RegionActivity = createContext(true);

/** Cached regions keep their state but perform no animation work off screen. */
export function useRegionFrame(callback: RenderCallback) {
 const active = useContext(RegionActivity);
 useFrame((state, delta, frame) => { if (active) callback(state, delta, frame); });
}
