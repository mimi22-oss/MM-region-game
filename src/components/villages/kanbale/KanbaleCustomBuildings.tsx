import type { ComponentType } from 'react';
import type { KanbaleBuildingData } from '../../../data/villages/kanbale';
import { KanbaleFarmhouse } from './KanbaleFarmhouse';

export interface CustomBuildingProps {
  building: KanbaleBuildingData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * Custom Building Override Registry
 * OSM Building ID များကို Custom TSX Model Components များနှင့် ချိတ်ဆက်ပေးသော စနစ်။
 *
 * အသုံးပြုပုံ:
 * - ဤနေရာတွင် OSM Building ID (ဥပမာ "way/403027623") ကို Custom TSX Component (ဥပမာ KanbaleFarmhouse) နှင့် တွဲပေးလိုက်ရုံဖြင့်
 *   KanbaleVillage Component သည် Default Extruded Polygon အစား Custom 3D Model ကို အလိုအလျောက် အစားထိုး Render လုပ်ပေးမည် ဖြစ်သည်။
 */
export const customBuildings: Record<string, ComponentType<CustomBuildingProps>> = {
  'way/403027623': KanbaleFarmhouse,
};

/**
 * ပေးထားသော Building ID အတွက် Custom Component သတ်မှတ်ထားခြင်း ရှိ/မရှိ စစ်ဆေးခြင်း
 */
export function hasCustomBuilding(id: string): boolean {
  return Boolean(customBuildings[id]);
}

/**
 * Building ID အလိုက် သက်ဆိုင်ရာ Custom Component ကို ရယူခြင်း
 */
export function getCustomBuilding(
  id: string,
): ComponentType<CustomBuildingProps> | undefined {
  return customBuildings[id];
}
