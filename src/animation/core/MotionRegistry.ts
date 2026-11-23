export type UiActionCategory = 'dance' | 'training' | 'reactions' | 'movement';
export type MotionCategory = UiActionCategory | 'interactions';

export type MotionSubgroup =
  | 'dances'
  | 'boxing'
  | 'kicking'
  | 'exercise'
  | 'hit-reactions'
  | 'defeat'
  | 'movement-moves'
  | 'vehicle';

export type MotionInterruptibility = 'always' | 'vehicle-only';
export type MotionEndPose = 'standing' | 'prone' | 'turned';

export type MotionId =
  | 'dance_01'
  | 'dance_02'
  | 'dance_03'
  | 'dance_04'
  | 'dance_05'
  | 'dance_06'
  | 'dance_07'
  | 'box_01'
  | 'box_02'
  | 'box_03'
  | 'front_kick_01'
  | 'front_kick_02'
  | 'warm_up'
  | 'press_up'
  | 'hit_to_head'
  | 'hit_to_stomach'
  | 'hit_to_side'
  | 'hit_to_body_01'
  | 'hit_to_body_02'
  | 'defeat_02'
  | 'defeat_03'
  | 'fall'
  | 'dive'
  | 'turn'
  | 'victory'
  | 'flying-back-away'
  | 'vehicle-wait'
  | 'sitting-idle'
  | 'sit-to-stand'
  | 'shooting'
  | 'gun-idle'
  | 'gun-hold-walking'
  | (string & {});

export interface MotionDefinition {
  readonly id: MotionId;
  readonly category: MotionCategory;
  readonly subgroup: MotionSubgroup;
  readonly label: string;
  readonly myanmarLabel: string;
  readonly assetUrl: string;
  readonly clipName: string;
  readonly durationSec: number;
  readonly defaultLoop: boolean;
  readonly allowLoopToggle: boolean;
  readonly allowRetrigger: boolean;
  readonly interruptibility: MotionInterruptibility;
  readonly supportsGroupSync: boolean;
  readonly priority: number;
  readonly defaultSpeed: number;
  readonly crossFadeSec: number;
  readonly fadeOutSec: number;
  readonly endHoldSec: number;
  readonly endPose: MotionEndPose;
  readonly rootMotion?: 'in-place' | 'preserve';
  readonly autoTriggeredOnly?: boolean;
  readonly allowWhileMoving?: boolean;
}

export interface MotionCategoryMeta {
  readonly id: UiActionCategory;
  readonly label: string;
  readonly myanmarLabel: string;
  readonly subgroups: readonly MotionSubgroup[];
}

export interface MotionSubgroupMeta {
  readonly id: MotionSubgroup;
  readonly category: MotionCategory;
  readonly label: string;
  readonly myanmarLabel: string;
  readonly defaultExpanded: boolean;
}

export interface MotionCategoryWithCount extends MotionCategoryMeta {
  readonly count: number;
}

export interface MotionSubgroupGroup {
  readonly subgroup: MotionSubgroupMeta;
  readonly actions: readonly MotionDefinition[];
}

export const MOTION_CATEGORIES: readonly MotionCategoryMeta[] = [
  {
    id: 'dance',
    label: 'Dance',
    myanmarLabel: 'အက',
    subgroups: ['dances'],
  },
  {
    id: 'training',
    label: 'Training',
    myanmarLabel: 'လေ့ကျင့်ခန်း',
    subgroups: ['boxing', 'kicking', 'exercise'],
  },
  {
    id: 'reactions',
    label: 'Reactions',
    myanmarLabel: 'တုံ့ပြန်မှု',
    subgroups: ['hit-reactions', 'defeat'],
  },
  {
    id: 'movement',
    label: 'Movement',
    myanmarLabel: 'လှုပ်ရှားမှု',
    subgroups: ['movement-moves'],
  },
];

export const MOTION_SUBGROUPS: Readonly<Record<MotionSubgroup, MotionSubgroupMeta>> = {
  dances: {
    id: 'dances',
    category: 'dance',
    label: 'Dances',
    myanmarLabel: 'အကများ',
    defaultExpanded: true,
  },
  boxing: {
    id: 'boxing',
    category: 'training',
    label: 'Boxing',
    myanmarLabel: 'လက်ဝှေ့',
    defaultExpanded: true,
  },
  kicking: {
    id: 'kicking',
    category: 'training',
    label: 'Kicking',
    myanmarLabel: 'ကန်ချက်',
    defaultExpanded: true,
  },
  exercise: {
    id: 'exercise',
    category: 'training',
    label: 'Exercise',
    myanmarLabel: 'ကိုယ်ကာယ',
    defaultExpanded: true,
  },
  'hit-reactions': {
    id: 'hit-reactions',
    category: 'reactions',
    label: 'Hit Reactions',
    myanmarLabel: 'ထိမှန်တုံ့ပြန်မှု',
    defaultExpanded: true,
  },
  defeat: {
    id: 'defeat',
    category: 'reactions',
    label: 'Defeat',
    myanmarLabel: 'ရှုံးနိမ့်ဟန်',
    defaultExpanded: true,
  },
  'movement-moves': {
    id: 'movement-moves',
    category: 'movement',
    label: 'Fall · Dive · Turn',
    myanmarLabel: 'လဲကျ · ခုန်ငုပ် · လှည့်',
    defaultExpanded: true,
  },
  vehicle: {
    id: 'vehicle',
    category: 'interactions',
    label: 'Vehicle Lifecycle',
    myanmarLabel: 'ယာဉ်စောင့်ဆိုင်းမှု',
    defaultExpanded: true,
  },
};

function makeDanceDef(
  id: MotionId,
  label: string,
  myanmarLabel: string,
  durationSec: number,
): MotionDefinition {
  return {
    id,
    category: 'dance',
    subgroup: 'dances',
    label,
    myanmarLabel,
    assetUrl: `/motions/dance/${id}.glb`,
    clipName: `${id}.001`,
    durationSec,
    defaultLoop: true,
    allowLoopToggle: true,
    allowRetrigger: false,
    interruptibility: 'always',
    supportsGroupSync: true,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
    fadeOutSec: 0.28,
    endHoldSec: 0,
    endPose: 'standing',
    rootMotion: 'in-place',
  };
}

function makeActionDef(
  opts: Pick<
    MotionDefinition,
    'id' | 'category' | 'subgroup' | 'label' | 'myanmarLabel' | 'assetUrl' | 'clipName' | 'durationSec'
  > &
    Partial<Omit<MotionDefinition, 'id' | 'category' | 'subgroup' | 'label' | 'myanmarLabel' | 'assetUrl' | 'clipName' | 'durationSec'>>,
): MotionDefinition {
  return {
    defaultLoop: false,
    allowLoopToggle: false,
    allowRetrigger: true,
    interruptibility: 'always',
    supportsGroupSync: false,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.24,
    fadeOutSec: 0.32,
    endHoldSec: 0,
    endPose: 'standing',
    rootMotion: 'in-place',
    ...opts,
  };
}

const DEFAULT_MOTIONS: MotionDefinition[] = [
  makeDanceDef('dance_01', 'Dance 01', 'အက ၁', 23.208),
  makeDanceDef('dance_02', 'Dance 02', 'အက ၂', 12.833),
  makeDanceDef('dance_03', 'Dance 03', 'အက ၃', 12.833),
  makeDanceDef('dance_04', 'Dance 04', 'အက ၄', 10.833),
  makeDanceDef('dance_05', 'Dance 05', 'အက ၅', 2.917),
  makeDanceDef('dance_06', 'Dance 06', 'အက ၆', 10.917),
  makeDanceDef('dance_07', 'Dance 07', 'အက ၇ (Flair)', 1.033),

  // Training: Boxing
  makeActionDef({
    id: 'box_01',
    category: 'training',
    subgroup: 'boxing',
    label: 'Box 01',
    myanmarLabel: 'လက်သီးထိုး ၁',
    assetUrl: '/motions/training/box_01.glb',
    clipName: 'box_01.001',
    durationSec: 2.25,
    allowLoopToggle: true,
    crossFadeSec: 0.2,
    fadeOutSec: 0.28,
  }),
  makeActionDef({
    id: 'box_02',
    category: 'training',
    subgroup: 'boxing',
    label: 'Box 02',
    myanmarLabel: 'လက်သီးထိုး ၂',
    assetUrl: '/motions/training/box_02.glb',
    clipName: 'box_02.001',
    durationSec: 2.833,
    allowLoopToggle: true,
    crossFadeSec: 0.2,
    fadeOutSec: 0.28,
  }),
  makeActionDef({
    id: 'box_03',
    category: 'training',
    subgroup: 'boxing',
    label: 'Box 03',
    myanmarLabel: 'လက်သီးထိုး ၃',
    assetUrl: '/motions/training/box_03.glb',
    clipName: 'box_03.001',
    durationSec: 2.583,
    allowLoopToggle: true,
    crossFadeSec: 0.2,
    fadeOutSec: 0.28,
  }),

  // Training: Kicking
  makeActionDef({
    id: 'front_kick_01',
    category: 'training',
    subgroup: 'kicking',
    label: 'Front Kick 01',
    myanmarLabel: 'ရှေ့ကန် ၁',
    assetUrl: '/motions/training/front_kick_01.glb',
    clipName: 'front_kick_01.001',
    durationSec: 2.542,
    allowLoopToggle: true,
    crossFadeSec: 0.2,
    fadeOutSec: 0.28,
  }),
  makeActionDef({
    id: 'front_kick_02',
    category: 'training',
    subgroup: 'kicking',
    label: 'Front Kick 02',
    myanmarLabel: 'ရှေ့ကန် ၂',
    assetUrl: '/motions/training/front_kick_02.glb',
    clipName: 'front_kick_02.001',
    durationSec: 1.417,
    allowLoopToggle: true,
    crossFadeSec: 0.2,
    fadeOutSec: 0.28,
  }),

  // Training: Exercise
  makeActionDef({
    id: 'warm_up',
    category: 'training',
    subgroup: 'exercise',
    label: 'Warm Up',
    myanmarLabel: 'သွေးပူလေ့ကျင့်',
    assetUrl: '/motions/training/warm_up.glb',
    clipName: 'warm_up.001',
    durationSec: 18.333,
    defaultLoop: true,
    allowLoopToggle: true,
    allowRetrigger: false,
    crossFadeSec: 0.32,
    fadeOutSec: 0.35,
  }),
  makeActionDef({
    id: 'press_up',
    category: 'training',
    subgroup: 'exercise',
    label: 'Push Up',
    myanmarLabel: 'ဒိုက်ထိုး',
    assetUrl: '/motions/training/press_up.glb',
    clipName: 'press-up.001',
    durationSec: 2.0,
    defaultLoop: true,
    allowLoopToggle: true,
    allowRetrigger: false,
    crossFadeSec: 0.35,
    fadeOutSec: 0.75,
    endPose: 'prone',
  }),

  // Reactions: Hit Reactions
  makeActionDef({
    id: 'hit_to_head',
    category: 'reactions',
    subgroup: 'hit-reactions',
    label: 'Hit to Head',
    myanmarLabel: 'ခေါင်းထိမှန်',
    assetUrl: '/motions/reactions/hit_to_head.glb',
    clipName: 'hit_to_head.001',
    durationSec: 1.875,
    crossFadeSec: 0.18,
  }),
  makeActionDef({
    id: 'hit_to_stomach',
    category: 'reactions',
    subgroup: 'hit-reactions',
    label: 'Hit to Stomach',
    myanmarLabel: 'ဗိုက်ထိမှန်',
    assetUrl: '/motions/reactions/hit_to_stomach.glb',
    clipName: 'hit_to_stomach.001',
    durationSec: 1.583,
    crossFadeSec: 0.18,
  }),
  makeActionDef({
    id: 'hit_to_side',
    category: 'reactions',
    subgroup: 'hit-reactions',
    label: 'Hit to Side',
    myanmarLabel: 'ဘေးတိုက်ထိမှန်',
    assetUrl: '/motions/reactions/hit_to_side.glb',
    clipName: 'hit_to_side.001',
    durationSec: 1.292,
    crossFadeSec: 0.18,
  }),
  makeActionDef({
    id: 'hit_to_body_01',
    category: 'reactions',
    subgroup: 'hit-reactions',
    label: 'Body Hit 01',
    myanmarLabel: 'ကိုယ်ထည်ထိမှန် ၁',
    assetUrl: '/motions/reactions/hit_to_body_01.glb',
    clipName: 'hit_to_body_01.001',
    durationSec: 1.333,
    crossFadeSec: 0.18,
  }),
  makeActionDef({
    id: 'hit_to_body_02',
    category: 'reactions',
    subgroup: 'hit-reactions',
    label: 'Body Hit 02',
    myanmarLabel: 'ကိုယ်ထည်ထိမှန် ၂',
    assetUrl: '/motions/reactions/hit_to_body_02.glb',
    clipName: 'hit_to_body_02.001',
    durationSec: 1.75,
    crossFadeSec: 0.18,
  }),

  // Reactions: Defeat
  makeActionDef({
    id: 'defeat_02',
    category: 'reactions',
    subgroup: 'defeat',
    label: 'Defeat 02',
    myanmarLabel: 'ရှုံးနိမ့်ဟန် ၁',
    assetUrl: '/motions/reactions/defeat_02.glb',
    clipName: 'defeat_02.001',
    durationSec: 8.5,
    crossFadeSec: 0.28,
    fadeOutSec: 0.45,
    endHoldSec: 0.65,
    endPose: 'prone',
  }),
  makeActionDef({
    id: 'defeat_03',
    category: 'reactions',
    subgroup: 'defeat',
    label: 'Defeat 03',
    myanmarLabel: 'လဲကျရှုံးနိမ့်',
    assetUrl: '/motions/reactions/defeat_03.glb',
    clipName: 'defeat_03.001',
    durationSec: 5.583,
    crossFadeSec: 0.28,
    fadeOutSec: 0.85,
    endHoldSec: 0.45,
    endPose: 'prone',
  }),

  // Movement: Fall, Dive, Turn
  makeActionDef({
    id: 'fall',
    category: 'movement',
    subgroup: 'movement-moves',
    label: 'Fall',
    myanmarLabel: 'လဲကျ',
    assetUrl: '/motions/movement/fall.glb',
    clipName: 'fall.001',
    durationSec: 3.042,
    crossFadeSec: 0.25,
    fadeOutSec: 0.85,
    endHoldSec: 0.55,
    endPose: 'prone',
  }),
  makeActionDef({
    id: 'dive',
    category: 'movement',
    subgroup: 'movement-moves',
    label: 'Dive',
    myanmarLabel: 'ရှောင်တိမ်းခုန်',
    assetUrl: '/motions/movement/dive.glb',
    clipName: 'dive.001',
    durationSec: 2.75,
    crossFadeSec: 0.22,
    fadeOutSec: 0.45,
    endHoldSec: 0,
    endPose: 'standing',
  }),
  makeActionDef({
    id: 'turn',
    category: 'movement',
    subgroup: 'movement-moves',
    label: 'Turn',
    myanmarLabel: 'နောက်ပြန်လှည့်',
    assetUrl: '/motions/movement/turn.glb',
    clipName: 'turn.001',
    durationSec: 3.875,
    crossFadeSec: 0.25,
    fadeOutSec: 0.65,
    endHoldSec: 0.25,
    endPose: 'turned',
  }),
  makeActionDef({
    id: 'victory',
    category: 'movement',
    subgroup: 'movement-moves',
    label: 'Victory',
    myanmarLabel: 'အောင်ပွဲခံ',
    assetUrl: '/motions/movement/victory.glb',
    clipName: 'mixamo.com',
    durationSec: 8.567,
    defaultLoop: true,
    allowLoopToggle: false,
    allowRetrigger: false,
    crossFadeSec: 0.25,
    fadeOutSec: 0.45,
    endHoldSec: 0,
    endPose: 'standing',
    autoTriggeredOnly: true,
  }),
  makeActionDef({
    id: 'flying-back-away',
    category: 'movement',
    subgroup: 'movement-moves',
    label: 'Flying Back Away',
    myanmarLabel: 'နောက်သို့လွင့်ကျ',
    assetUrl: '/motions/movement/flying-back-away.glb',
    clipName: 'mixamo.com',
    durationSec: 3.067,
    defaultLoop: false,
    allowLoopToggle: false,
    allowRetrigger: true,
    crossFadeSec: 0.12,
    fadeOutSec: 0.35,
    endHoldSec: 0.45,
    endPose: 'prone',
    autoTriggeredOnly: true,
    allowWhileMoving: true,
  }),

  // Interactions: Vehicle Waiting (auto-controlled)
  {
    id: 'vehicle-wait',
    category: 'interactions',
    subgroup: 'vehicle',
    label: 'Vehicle Waiting',
    myanmarLabel: 'ကားစောင့်နေသည်',
    assetUrl: '/motions/interactions/vehicle-wait.glb',
    clipName: 'wait.001',
    durationSec: 6.042,
    defaultLoop: true,
    allowLoopToggle: false,
    allowRetrigger: false,
    interruptibility: 'vehicle-only',
    supportsGroupSync: false,
    priority: 20,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
    fadeOutSec: 0.28,
    endHoldSec: 0,
    endPose: 'standing',
    rootMotion: 'in-place',
    autoTriggeredOnly: true,
  },

  // Interactions: Sitting Idle on Chair (auto-controlled)
  {
    id: 'sitting-idle',
    category: 'interactions',
    subgroup: 'vehicle',
    label: 'Sitting Idle',
    myanmarLabel: 'ထိုင်ခုံတွင် ထိုင်နေသည်',
    assetUrl: '/motions/interactions/sitting-idle.glb',
    clipName: 'sitting-idle.001',
    durationSec: 6.433,
    defaultLoop: true,
    allowLoopToggle: false,
    allowRetrigger: false,
    interruptibility: 'vehicle-only',
    supportsGroupSync: false,
    priority: 20,
    defaultSpeed: 1,
    crossFadeSec: 0.35,
    fadeOutSec: 0.35,
    endHoldSec: 0,
    endPose: 'standing',
    rootMotion: 'in-place',
    autoTriggeredOnly: true,
  },

  // Interactions: Sit To Stand from Chair (auto-controlled)
  {
    id: 'sit-to-stand',
    category: 'interactions',
    subgroup: 'vehicle',
    label: 'Sit To Stand',
    myanmarLabel: 'ထိုင်ရာမှ ထရပ်သည်',
    assetUrl: '/motions/interactions/sit-to-stand.glb',
    clipName: 'sit-to-stand.001',
    durationSec: 2.3,
    defaultLoop: false,
    allowLoopToggle: false,
    allowRetrigger: false,
    interruptibility: 'always',
    supportsGroupSync: false,
    priority: 25,
    defaultSpeed: 1,
    crossFadeSec: 0.25,
    fadeOutSec: 0.25,
    endHoldSec: 0.05,
    endPose: 'standing',
    rootMotion: 'in-place',
    autoTriggeredOnly: true,
  },

  // Interactions: Gun Shooting (auto-triggered on F / Shoot when Gun is equipped)
  {
    id: 'shooting',
    category: 'interactions',
    subgroup: 'vehicle',
    label: 'Shooting',
    myanmarLabel: 'သေနတ်ပစ်ခတ်သည်',
    assetUrl: '/motions/interactions/shooting.glb',
    clipName: 'mixamo.com',
    durationSec: 1.2,
    defaultLoop: false,
    allowLoopToggle: false,
    allowRetrigger: true,
    interruptibility: 'always',
    supportsGroupSync: false,
    priority: 26,
    defaultSpeed: 1,
    crossFadeSec: 0.12,
    fadeOutSec: 0.18,
    endHoldSec: 0,
    endPose: 'standing',
    rootMotion: 'in-place',
    autoTriggeredOnly: true,
    allowWhileMoving: true,
  },

  // Interactions: Gun Idle & Walk Pose (auto-triggered while Gun is equipped)
  {
    id: 'gun-idle',
    category: 'interactions',
    subgroup: 'vehicle',
    label: 'Gun Idle',
    myanmarLabel: 'သေနတ်ကိုင် ရပ်/လျှောက်ဟန်',
    assetUrl: '/motions/interactions/gun-idle.glb',
    clipName: 'mixamo.com.001',
    durationSec: 3.133,
    defaultLoop: true,
    allowLoopToggle: false,
    allowRetrigger: false,
    interruptibility: 'always',
    supportsGroupSync: false,
    priority: 22,
    defaultSpeed: 1,
    crossFadeSec: 0.2,
    fadeOutSec: 0.2,
    endHoldSec: 0,
    endPose: 'standing',
    rootMotion: 'in-place',
    autoTriggeredOnly: true,
    allowWhileMoving: true,
  },

  // Interactions: Gun Hold Walking (auto-triggered when walking with Gun equipped)
  {
    id: 'gun-hold-walking',
    category: 'interactions',
    subgroup: 'vehicle',
    label: 'Gun Hold Walking',
    myanmarLabel: 'သေနတ်ကိုင် လမ်းလျှောက်ဟန်',
    assetUrl: '/motions/interactions/gun-hold-walking.glb',
    clipName: 'mixamo.com.002',
    durationSec: 1.5,
    defaultLoop: true,
    allowLoopToggle: false,
    allowRetrigger: false,
    interruptibility: 'always',
    supportsGroupSync: false,
    priority: 22,
    defaultSpeed: 1,
    crossFadeSec: 0.16,
    fadeOutSec: 0.16,
    endHoldSec: 0,
    endPose: 'standing',
    rootMotion: 'in-place',
    autoTriggeredOnly: true,
    allowWhileMoving: true,
  },
];

const motionRegistry = new Map<string, MotionDefinition>(
  DEFAULT_MOTIONS.map((def) => [def.id, def]),
);

const motionAliases = new Map<string, string>([
  ['wait_car', 'vehicle-wait'],
  ['press-up', 'press_up'],
  ['sit_idle', 'sitting-idle'],
  ['sit-idle', 'sitting-idle'],
  ['sit_stand', 'sit-to-stand'],
]);

export function registerMotion(definition: MotionDefinition): void {
  motionRegistry.set(definition.id, definition);
}

export function registerMotionAlias(alias: string, targetId: MotionId): void {
  motionAliases.set(alias, targetId);
}

export function resolveMotionId(id: string): string {
  return motionAliases.get(id) ?? id;
}

export function getMotion(id: string): MotionDefinition | undefined {
  return motionRegistry.get(resolveMotionId(id));
}

export function listMotions(category?: MotionCategory): MotionDefinition[] {
  const all = Array.from(motionRegistry.values());
  return category ? all.filter((def) => def.category === category) : all;
}

export function listManualMotions(category?: UiActionCategory): MotionDefinition[] {
  const all = Array.from(motionRegistry.values()).filter((def) => !def.autoTriggeredOnly);
  return category ? all.filter((def) => def.category === category) : all;
}

export function listMotionsBySubgroup(subgroup: MotionSubgroup): MotionDefinition[] {
  return Array.from(motionRegistry.values()).filter(
    (def) => def.subgroup === subgroup && !def.autoTriggeredOnly,
  );
}

export function listMotionCategories(): MotionCategoryWithCount[] {
  return MOTION_CATEGORIES.map((meta) => ({
    ...meta,
    count: listManualMotions(meta.id).length,
  }));
}

export function listMotionSubgroups(category?: MotionCategory): MotionSubgroupMeta[] {
  const all = Object.values(MOTION_SUBGROUPS);
  return category ? all.filter((meta) => meta.category === category) : all;
}

export function getMotionCategoryGroups(category: UiActionCategory): MotionSubgroupGroup[] {
  const catMeta = MOTION_CATEGORIES.find((c) => c.id === category);
  if (!catMeta) return [];
  const groups: MotionSubgroupGroup[] = [];
  for (const subgroupId of catMeta.subgroups) {
    const subgroupMeta = MOTION_SUBGROUPS[subgroupId];
    const actions = listMotionsBySubgroup(subgroupId);
    if (subgroupMeta && actions.length > 0) {
      groups.push({ subgroup: subgroupMeta, actions });
    }
  }
  return groups;
}
