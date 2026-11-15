export type MotionCategory = 'dance' | 'interactions';

export type MotionId =
  | 'dance_01'
  | 'dance_02'
  | 'dance_03'
  | 'dance_04'
  | 'dance_05'
  | 'dance_06'
  | 'vehicle-wait'
  | (string & {});

export interface MotionDefinition {
  readonly id: MotionId;
  readonly category: MotionCategory;
  readonly label: string;
  readonly myanmarLabel: string;
  readonly assetUrl: string;
  readonly clipName: string;
  readonly durationSec: number;
  readonly defaultLoop: boolean;
  readonly supportsGroupSync: boolean;
  readonly priority: number;
  readonly defaultSpeed: number;
  readonly crossFadeSec: number;
  readonly autoTriggeredOnly?: boolean;
}

const DEFAULT_MOTIONS: MotionDefinition[] = [
  {
    id: 'dance_01',
    category: 'dance',
    label: 'Dance 01',
    myanmarLabel: 'အက ၁',
    assetUrl: '/motions/dance/dance_01.glb',
    clipName: 'dance_01.001',
    durationSec: 23.208,
    defaultLoop: true,
    supportsGroupSync: true,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
  },
  {
    id: 'dance_02',
    category: 'dance',
    label: 'Dance 02',
    myanmarLabel: 'အက ၂',
    assetUrl: '/motions/dance/dance_02.glb',
    clipName: 'dance_02.001',
    durationSec: 12.833,
    defaultLoop: true,
    supportsGroupSync: true,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
  },
  {
    id: 'dance_03',
    category: 'dance',
    label: 'Dance 03',
    myanmarLabel: 'အက ၃',
    assetUrl: '/motions/dance/dance_03.glb',
    clipName: 'dance_03.001',
    durationSec: 12.833,
    defaultLoop: true,
    supportsGroupSync: true,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
  },
  {
    id: 'dance_04',
    category: 'dance',
    label: 'Dance 04',
    myanmarLabel: 'အက ၄',
    assetUrl: '/motions/dance/dance_04.glb',
    clipName: 'dance_04.001',
    durationSec: 10.833,
    defaultLoop: true,
    supportsGroupSync: true,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
  },
  {
    id: 'dance_05',
    category: 'dance',
    label: 'Dance 05',
    myanmarLabel: 'အက ၅',
    assetUrl: '/motions/dance/dance_05.glb',
    clipName: 'dance_05.001',
    durationSec: 2.917,
    defaultLoop: true,
    supportsGroupSync: true,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
  },
  {
    id: 'dance_06',
    category: 'dance',
    label: 'Dance 06',
    myanmarLabel: 'အက ၆',
    assetUrl: '/motions/dance/dance_06.glb',
    clipName: 'dance_06.001',
    durationSec: 10.917,
    defaultLoop: true,
    supportsGroupSync: true,
    priority: 10,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
  },
  {
    id: 'vehicle-wait',
    category: 'interactions',
    label: 'Vehicle Waiting',
    myanmarLabel: 'ကားစောင့်နေသည်',
    assetUrl: '/motions/interactions/vehicle-wait.glb',
    clipName: 'wait.001',
    durationSec: 6.042,
    defaultLoop: true,
    supportsGroupSync: false,
    priority: 20,
    defaultSpeed: 1,
    crossFadeSec: 0.28,
    autoTriggeredOnly: true,
  },
];

const motionRegistry = new Map<string, MotionDefinition>(
  DEFAULT_MOTIONS.map((def) => [def.id, def]),
);

const motionAliases = new Map<string, string>([
  ['wait_car', 'vehicle-wait'],
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
