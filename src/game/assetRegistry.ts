/**
 * 3D Asset Registry for Myanmar Town Virtual World & 2D Map Editor
 *
 * Centralizes all reusable 3D models and procedural components with:
 * - Unique assetId, English & Myanmar names, category
 * - Source component mapping
 * - Default 3D dimensions (width, depth, height), scale, and rotation
 * - Accurate 2D SVG top-down footprints matching actual 3D meshes
 * - Physical collision properties (box / cylinder / none)
 */

import { loadCustomAssets, type CustomAsset } from './customAssets';

export type AssetCategory =
  | 'buildings'
  | 'nature'
  | 'infrastructure'
  | 'furniture'
  | 'vehicles'
  | 'cultural';

export interface AssetFootprint {
  shape: 'rect' | 'circle' | 'complex';
  defaultWidth: number;
  defaultDepth: number;
  /** SVG fill color or styling hint */
  color: string;
  stroke: string;
  roofRidge?: boolean; // Draw center roof ridge line
  subElements?: Array<{
    type: 'rect' | 'circle' | 'line';
    x: number;
    y: number;
    width?: number;
    height?: number;
    r?: number;
    color?: string;
    stroke?: string;
  }>;
}

export interface AssetDefinition {
  assetId: string;
  name: string;
  nameMm: string;
  category: AssetCategory;
  sourceComponent: string;
  description: string;
  defaultDimensions: {
    width: number;
    depth: number;
    height?: number;
  };
  defaultScale: number;
  defaultRotation: number;
  defaultColor?: string;
  defaultRoofColor?: string;
  collision: {
    type: 'box' | 'cylinder' | 'none';
    width?: number;
    depth?: number;
    radius?: number;
  };
  footprint: AssetFootprint;
  tags: string[];
  isAnimated?: boolean;
  isVehicle?: boolean;
  customModel?: CustomAsset;
}

export const ASSET_CATEGORIES: { id: AssetCategory; label: string; labelMm: string; icon: string }[] = [
  { id: 'buildings', label: 'Buildings', labelMm: 'အဆောက်အအုံများ', icon: '🏠' },
  { id: 'nature', label: 'Nature & Trees', labelMm: 'သစ်ပင်နှင့် သဘာဝ', icon: '🌳' },
  { id: 'infrastructure', label: 'Infrastructure', labelMm: 'အခြေခံအဆောက်အအုံ', icon: '🚏' },
  { id: 'furniture', label: 'Street & Furniture', labelMm: 'ပရိဘောဂနှင့် အသုံးအဆောင်', icon: '🪑' },
  { id: 'vehicles', label: 'Vehicles', labelMm: 'ယာဉ်ယန္တရားများ', icon: '🚗' },
  { id: 'cultural', label: 'Cultural & Festive', labelMm: 'ရိုးရာနှင့် ပွဲတော်', icon: '🪔' },
];

export const ASSET_REGISTRY: Record<string, AssetDefinition> = {
  // ==========================================
  // 1. BUILDINGS
  // ==========================================
  'building:myothar-house': {
    assetId: 'building:myothar-house',
    name: 'Myothar 2-Storey House',
    nameMm: 'မြို့သာ ၂ ထပ် ပျဉ်ထောင်အိမ်ကြီး',
    category: 'buildings',
    sourceComponent: 'House',
    description: 'Two-storey wooden & plaster village house with pitched galvanized iron roof, porch veranda and wire mesh yard.',
    defaultDimensions: { width: 8.0, depth: 9.6, height: 7.5 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#baa892',
    defaultRoofColor: '#687788',
    collision: { type: 'box', width: 8.0, depth: 9.6 },
    footprint: {
      shape: 'complex',
      defaultWidth: 8.0,
      defaultDepth: 9.6,
      color: '#baa892',
      stroke: '#4a5568',
      roofRidge: true,
      subElements: [
        { type: 'rect', x: -2.6, y: 4.8, width: 5.2, height: 1.6, color: '#b9ad94', stroke: '#71523c' }, // Front Veranda
      ],
    },
    tags: ['house', 'residential', 'myothar', 'two-storey', 'wooden'],
  },

  'building:sithar-house': {
    assetId: 'building:sithar-house',
    name: 'Si Thar Village House',
    nameMm: 'စည်သာရွာ ပျဉ်ထောင်အိမ်',
    category: 'buildings',
    sourceComponent: 'SiTharBuilding',
    description: 'Traditional Si Thar village residence with foundation plinth, gable roof and wire mesh fence.',
    defaultDimensions: { width: 6.8, depth: 7.2, height: 6.2 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#b0a088',
    defaultRoofColor: '#5c6d7a',
    collision: { type: 'box', width: 6.8, depth: 7.2 },
    footprint: {
      shape: 'rect',
      defaultWidth: 6.8,
      defaultDepth: 7.2,
      color: '#b0a088',
      stroke: '#3b434e',
      roofRidge: true,
    },
    tags: ['house', 'sithar', 'village', 'residential'],
  },

  'building:natmyaung-house': {
    assetId: 'building:natmyaung-house',
    name: 'Nat Myaung Gable House',
    nameMm: 'နတ်မြောင်းရွာ အိမ်',
    category: 'buildings',
    sourceComponent: 'NatmyaungBuilding',
    description: 'Spacious Nat Myaung residence with eaves cornice trim, slanted pitched convex roof panels and front balcony.',
    defaultDimensions: { width: 7.5, depth: 8.0, height: 6.0 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#c4b69d',
    defaultRoofColor: '#4f5d69',
    collision: { type: 'box', width: 7.5, depth: 8.0 },
    footprint: {
      shape: 'rect',
      defaultWidth: 7.5,
      defaultDepth: 8.0,
      color: '#c4b69d',
      stroke: '#374151',
      roofRidge: true,
    },
    tags: ['house', 'natmyaung', 'village', 'residential'],
  },

  'building:farmhouse': {
    assetId: 'building:farmhouse',
    name: 'Character Walk-in Farmhouse',
    nameMm: 'စိုက်ခင်းအိမ်ကြီး (မီးဖိုဆောင်အဖီပါ)',
    category: 'buildings',
    sourceComponent: 'FarmhouseBuilding',
    description: 'Spacious character farmhouse with attached culinary banquet kitchen annex, veranda, and complete interior layout.',
    defaultDimensions: { width: 21.0, depth: 10.0, height: 7.2 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#8a9f7b',
    defaultRoofColor: '#80523d',
    collision: { type: 'box', width: 21.0, depth: 10.0 },
    footprint: {
      shape: 'complex',
      defaultWidth: 21.0,
      defaultDepth: 10.0,
      color: '#8a9f7b',
      stroke: '#3f5731',
      roofRidge: true,
      subElements: [
        { type: 'rect', x: 6.0, y: -4.0, width: 9.0, height: 8.0, color: '#a27b5c', stroke: '#4f3320' }, // Kitchen annex
      ],
    },
    tags: ['farmhouse', 'estate', 'interior', 'walk-in', 'kitchen'],
  },

  'building:u-shwe-house': {
    assetId: 'building:u-shwe-house',
    name: 'U Shwe House & Snack Shop',
    nameMm: 'ဦးရွှေအိမ်နှင့် မုန့်စျေးဆိုင်',
    category: 'buildings',
    sourceComponent: 'UShweHouse',
    description: 'Traditional two-storey Myanmar residence with front snack stall, snack jars, fritters tray and outdoor seating.',
    defaultDimensions: { width: 10.0, depth: 11.5, height: 7.2 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#c8a882',
    defaultRoofColor: '#8b5545',
    collision: { type: 'box', width: 10.0, depth: 11.5 },
    footprint: {
      shape: 'complex',
      defaultWidth: 10.0,
      defaultDepth: 11.5,
      color: '#c8a882',
      stroke: '#5c3d2e',
      roofRidge: true,
      subElements: [
        { type: 'rect', x: -4.5, y: 4.5, width: 9.0, height: 2.5, color: '#f59e0b', stroke: '#b45309' }, // Snack stall
      ],
    },
    tags: ['shop', 'snacks', 'u-shwe', 'residential', 'market'],
  },

  'building:tea-shop': {
    assetId: 'building:tea-shop',
    name: 'Traditional Myanmar Tea Shop',
    nameMm: 'ရိုးရာ လက်ဖက်ရည်ဆိုင် (နန်းကလိန်)',
    category: 'buildings',
    sourceComponent: 'KalayArea1TeaShop',
    description: 'Walk-in open air tea shop featuring indoor counter, outdoor deck with round tables, stools, teapots and TV.',
    defaultDimensions: { width: 16.0, depth: 12.0, height: 4.8 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#475569',
    defaultRoofColor: '#0284c7',
    collision: { type: 'box', width: 16.0, depth: 12.0 },
    footprint: {
      shape: 'complex',
      defaultWidth: 16.0,
      defaultDepth: 12.0,
      color: '#cbd5e1',
      stroke: '#334155',
      subElements: [
        { type: 'rect', x: -8.0, y: -6.0, width: 9.0, height: 12.0, color: '#94a3b8', stroke: '#475569' }, // Outdoor patio
        { type: 'rect', x: 1.0, y: -6.0, width: 7.0, height: 12.0, color: '#e2e8f0', stroke: '#64748b' }, // Indoor hall
      ],
    },
    tags: ['tea-shop', 'cafe', 'food', 'social', 'furniture'],
  },

  'building:village-school': {
    assetId: 'building:village-school',
    name: 'Village Primary School Hall',
    nameMm: 'အခြေခံပညာ မူလတန်းကျောင်းဆောင်',
    category: 'buildings',
    sourceComponent: 'KanbaleSchool',
    description: 'Classic Myanmar government school building with emerald green roof, classroom wings and assembly grounds.',
    defaultDimensions: { width: 32.0, depth: 14.0, height: 5.6 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#f8fafc',
    defaultRoofColor: '#1b4332',
    collision: { type: 'box', width: 32.0, depth: 14.0 },
    footprint: {
      shape: 'complex',
      defaultWidth: 32.0,
      defaultDepth: 14.0,
      color: '#f8fafc',
      stroke: '#1b4332',
      roofRidge: true,
      subElements: [
        { type: 'rect', x: -4.0, y: 7.0, width: 8.0, height: 3.0, color: '#10b981', stroke: '#065f46' }, // School porch
      ],
    },
    tags: ['school', 'education', 'public', 'landmark'],
  },

  'building:rice-mill': {
    assetId: 'building:rice-mill',
    name: 'Rice Mill & Paddy Warehouse',
    nameMm: 'ဆန်စက်နှင့် စပါးသိုလှောင်ရုံ',
    category: 'buildings',
    sourceComponent: 'KanbaleRiceMill',
    description: 'Industrial rural rice mill complex with milling hall, loading bays and grain storage silos.',
    defaultDimensions: { width: 24.0, depth: 16.0, height: 8.0 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#e2e8f0',
    defaultRoofColor: '#b45309',
    collision: { type: 'box', width: 24.0, depth: 16.0 },
    footprint: {
      shape: 'rect',
      defaultWidth: 24.0,
      defaultDepth: 16.0,
      color: '#e2e8f0',
      stroke: '#b45309',
      roofRidge: true,
    },
    tags: ['mill', 'rice', 'agriculture', 'industrial', 'warehouse'],
  },

  'building:warehouse': {
    assetId: 'building:warehouse',
    name: 'Storage Warehouse',
    nameMm: 'ကုန်လှောင်ရုံကြီး',
    category: 'buildings',
    sourceComponent: 'Warehouses',
    description: 'High-clearance agricultural and freight storage warehouse with large loading doors and high roofline.',
    defaultDimensions: { width: 14.0, depth: 22.0, height: 8.2 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#607d8b',
    defaultRoofColor: '#455a64',
    collision: { type: 'box', width: 14.0, depth: 22.0 },
    footprint: {
      shape: 'rect',
      defaultWidth: 14.0,
      defaultDepth: 22.0,
      color: '#cfd8dc',
      stroke: '#455a64',
      roofRidge: true,
    },
    tags: ['warehouse', 'storage', 'depot', 'logistics'],
  },

  'building:toilet-block': {
    assetId: 'building:toilet-block',
    name: 'Two-Room Toilet Block',
    nameMm: '၂ ခန်းတွဲ အိမ်သာ (ခေါင်မိုး ရေကန်ပါ)',
    category: 'buildings',
    sourceComponent: 'ToiletBlock',
    description: 'Two-room village sanitary building with overhead concrete water tanks, tiled floors and entrance steps.',
    defaultDimensions: { width: 3.6, depth: 2.4, height: 2.8 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#dfd8cb',
    defaultRoofColor: '#8c8577',
    collision: { type: 'box', width: 3.6, depth: 2.4 },
    footprint: {
      shape: 'rect',
      defaultWidth: 3.6,
      defaultDepth: 2.4,
      color: '#dfd8cb',
      stroke: '#6b7280',
    },
    tags: ['toilet', 'sanitation', 'utility', 'public'],
  },

  // ==========================================
  // 2. NATURE & TREES
  // ==========================================
  'nature:shade-tree': {
    assetId: 'nature:shade-tree',
    name: 'Large Village Shade Tree',
    nameMm: 'အရိပ်ရ သစ်ပင်ကြီး',
    category: 'nature',
    sourceComponent: 'Tree',
    description: 'Magnificent spreading shade tree with branched hardwood trunk and dense multi-cluster canopy.',
    defaultDimensions: { width: 13.0, depth: 13.0, height: 17.6 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'cylinder', radius: 1.2 },
    footprint: {
      shape: 'circle',
      defaultWidth: 13.0,
      defaultDepth: 13.0,
      color: '#4ade8055',
      stroke: '#16a34a',
      subElements: [
        { type: 'circle', x: 0, y: 0, r: 1.0, color: '#71543b', stroke: '#451a03' }, // Trunk
      ],
    },
    tags: ['tree', 'nature', 'shade', 'foliage', 'large'],
  },

  'nature:canopy-tree': {
    assetId: 'nature:canopy-tree',
    name: 'Roadside Canopy Tree',
    nameMm: 'လမ်းဘေး ခုံးအုပ် သစ်ပင်',
    category: 'nature',
    sourceComponent: 'Tree',
    description: 'Tall roadside tree with slanted branch arching over lanes to form a natural shaded tunnel canopy.',
    defaultDimensions: { width: 11.0, depth: 11.0, height: 16.0 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'cylinder', radius: 0.9 },
    footprint: {
      shape: 'circle',
      defaultWidth: 11.0,
      defaultDepth: 11.0,
      color: '#86efac55',
      stroke: '#22c55e',
      subElements: [
        { type: 'circle', x: 0, y: 0, r: 0.8, color: '#796043', stroke: '#451a03' },
      ],
    },
    tags: ['tree', 'nature', 'roadside', 'canopy'],
  },

  'nature:farm-tree': {
    assetId: 'nature:farm-tree',
    name: 'Farm Plot Tree',
    nameMm: 'စိုက်ခင်း သစ်ပင်ဖြောင့်',
    category: 'nature',
    sourceComponent: 'Tree',
    description: 'Slender, high-canopy tree ideal for agricultural boundaries, orchards and farmland borders.',
    defaultDimensions: { width: 7.2, depth: 7.2, height: 14.0 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'cylinder', radius: 0.6 },
    footprint: {
      shape: 'circle',
      defaultWidth: 7.2,
      defaultDepth: 7.2,
      color: '#a7f3d055',
      stroke: '#059669',
      subElements: [
        { type: 'circle', x: 0, y: 0, r: 0.5, color: '#795d3b', stroke: '#451a03' },
      ],
    },
    tags: ['tree', 'nature', 'farm', 'plot', 'slender'],
  },

  'nature:mango-tree': {
    assetId: 'nature:mango-tree',
    name: 'Mango Orchard Tree',
    nameMm: 'သရက်ပင်ကြီး (သရက်သီးတွဲများပါ)',
    category: 'nature',
    sourceComponent: 'MangoTree',
    description: 'Spreading tropical mango tree with wide root flare, dark leafy dome and hanging golden mango fruit clusters.',
    defaultDimensions: { width: 7.0, depth: 7.0, height: 5.5 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'cylinder', radius: 0.8 },
    footprint: {
      shape: 'circle',
      defaultWidth: 7.0,
      defaultDepth: 7.0,
      color: '#fef08a66',
      stroke: '#ca8a04',
      subElements: [
        { type: 'circle', x: 0, y: 0, r: 0.7, color: '#543c26', stroke: '#291b0e' },
      ],
    },
    tags: ['tree', 'mango', 'fruit', 'orchard', 'agriculture'],
  },

  'nature:tamarind-tree': {
    assetId: 'nature:tamarind-tree',
    name: 'Tamarind Tree',
    nameMm: 'မန်ကျည်းပင် (မန်ကျည်းသီးတောင့်များပါ)',
    category: 'nature',
    sourceComponent: 'TamarindTree',
    description: 'Iconic Central Myanmar dry-zone tamarind tree with rugged trunk, feathery foliage and brown curved pod clusters.',
    defaultDimensions: { width: 7.5, depth: 7.5, height: 5.8 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'cylinder', radius: 0.8 },
    footprint: {
      shape: 'circle',
      defaultWidth: 7.5,
      defaultDepth: 7.5,
      color: '#fed7aa66',
      stroke: '#c2410c',
      subElements: [
        { type: 'circle', x: 0, y: 0, r: 0.7, color: '#4a3319', stroke: '#241407' },
      ],
    },
    tags: ['tree', 'tamarind', 'dry-zone', 'fruit', 'foliage'],
  },

  // ==========================================
  // 3. INFRASTRUCTURE & FENCES
  // ==========================================
  'infrastructure:water-pump': {
    assetId: 'infrastructure:water-pump',
    name: 'Cast-Iron Hand Water Pump & Basin',
    nameMm: 'သံလက်နှိပ် ရေဘုံဘိုင်နှင့် ရေစုပ်စက်',
    category: 'infrastructure',
    sourceComponent: 'WaterPump',
    description: 'Deep tube-well station with classic blue cast-iron hand pump, flowing spout water, wash basin and electric motor pump.',
    defaultDimensions: { width: 2.4, depth: 2.2, height: 1.6 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'box', width: 2.4, depth: 2.2 },
    footprint: {
      shape: 'rect',
      defaultWidth: 2.4,
      defaultDepth: 2.2,
      color: '#38bdf8',
      stroke: '#0369a1',
      subElements: [
        { type: 'circle', x: 0, y: -0.1, r: 0.25, color: '#1c5ea2', stroke: '#075985' }, // Pump cylinder
      ],
    },
    tags: ['water', 'pump', 'well', 'utility', 'infrastructure'],
  },

  'infrastructure:kalay-signboard': {
    assetId: 'infrastructure:kalay-signboard',
    name: 'Kalaymyo Ceremonial Arch Signboard',
    nameMm: 'ကလေးမြို့ အဝင် မုခ်ဦး ဆိုင်းဘုတ်ကြီး',
    category: 'infrastructure',
    sourceComponent: 'KalaySignboard',
    description: 'Grand ornate highway welcome arch spanning over the highway with golden Myanmar lettering, finials and concrete pillars.',
    defaultDimensions: { width: 16.0, depth: 3.2, height: 8.5 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'box', width: 16.0, depth: 3.2 },
    footprint: {
      shape: 'rect',
      defaultWidth: 16.0,
      defaultDepth: 3.2,
      color: '#facc15',
      stroke: '#854d0e',
      subElements: [
        { type: 'rect', x: -7.0, y: -1.0, width: 2.0, height: 2.0, color: '#ca8a04', stroke: '#713f12' },
        { type: 'rect', x: 5.0, y: -1.0, width: 2.0, height: 2.0, color: '#ca8a04', stroke: '#713f12' },
      ],
    },
    tags: ['signboard', 'arch', 'monument', 'entrance', 'highway'],
  },

  'infrastructure:wire-fence': {
    assetId: 'infrastructure:wire-fence',
    name: 'Wire Mesh Compound Fence (10m)',
    nameMm: 'သံဇကာ ခြံစည်းရိုး (၁၀ မီတာ)',
    category: 'infrastructure',
    sourceComponent: 'WireMeshSegment',
    description: 'Semi-transparent galvanized wire mesh compound fence segment with steel angle-iron posts and top rail.',
    defaultDimensions: { width: 10.0, depth: 0.2, height: 1.6 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'box', width: 10.0, depth: 0.3 },
    footprint: {
      shape: 'rect',
      defaultWidth: 10.0,
      defaultDepth: 0.3,
      color: '#94a3b8',
      stroke: '#475569',
    },
    tags: ['fence', 'wire-mesh', 'boundary', 'compound', 'security'],
  },

  'infrastructure:home-gate': {
    assetId: 'infrastructure:home-gate',
    name: 'Blue Sheet Entrance Gate',
    nameMm: 'သွပ်ပြာ ခြံဝင်း အဝင်ဂိတ်တံခါး',
    category: 'infrastructure',
    sourceComponent: 'HomeGate',
    description: 'Myanmar residential compound gate with ribbed blue corrugated panels, posts and center leaf opening.',
    defaultDimensions: { width: 6.0, depth: 0.3, height: 2.0 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'box', width: 6.0, depth: 0.3 },
    footprint: {
      shape: 'rect',
      defaultWidth: 6.0,
      defaultDepth: 0.3,
      color: '#2563a6',
      stroke: '#1e40af',
    },
    tags: ['gate', 'fence', 'entrance', 'residential'],
  },

  'infrastructure:football-pitch': {
    assetId: 'infrastructure:football-pitch',
    name: 'Village Football Field & Goalposts',
    nameMm: 'ရွာ့ ဘောလုံးကွင်းနှင့် ဂိုးတိုင်များ',
    category: 'infrastructure',
    sourceComponent: 'FootballPitch',
    description: 'Full-size regulation village football ground with grass turf stripes, white boundary lines, center circle and goal nets.',
    defaultDimensions: { width: 68.0, depth: 104.0, height: 2.5 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'none' },
    footprint: {
      shape: 'complex',
      defaultWidth: 68.0,
      defaultDepth: 104.0,
      color: '#81925c',
      stroke: '#fef08a',
      subElements: [
        { type: 'rect', x: -30.0, y: -48.0, width: 60.0, height: 96.0, color: '#719858', stroke: '#ffffff' },
        { type: 'circle', x: 0, y: 0, r: 9.15, color: 'none', stroke: '#ffffff' },
      ],
    },
    tags: ['sports', 'football', 'playground', 'recreation', 'community'],
  },

  'infrastructure:football-goal': {
    assetId: 'infrastructure:football-goal',
    name: 'Football Goalpost',
    nameMm: 'ဘောလုံး ဂိုးတိုင်',
    category: 'infrastructure',
    sourceComponent: 'FootballGoalModel',
    description: 'Regulation football goalpost with white vertical stanchions, horizontal crossbar, and rear ground support stays.',
    defaultDimensions: { width: 7.44, depth: 2.44, height: 2.44 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'box', width: 7.44, depth: 2.44 },
    footprint: {
      shape: 'rect',
      defaultWidth: 7.44,
      defaultDepth: 2.44,
      color: '#f8fafc',
      stroke: '#0f172a',
      subElements: [
        { type: 'rect', x: -3.6, y: -1.1, width: 7.2, height: 2.2, color: '#e2e8f0', stroke: '#94a3b8' },
      ],
    },
    tags: ['sports', 'football', 'goal', 'goalpost', 'pitch'],
  },

  'infrastructure:football-center-circle': {
    assetId: 'infrastructure:football-center-circle',
    name: 'Football Pitch Center Circle',
    nameMm: 'ဘောလုံးကွင်း အလယ်စက်ဝိုင်း',
    category: 'infrastructure',
    sourceComponent: 'FootballCenterCircleModel',
    description: 'Regulation white chalk center circle line marking for football pitch kick-off area.',
    defaultDimensions: { width: 18.3, depth: 18.3, height: 0.15 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'none' },
    footprint: {
      shape: 'circle',
      defaultWidth: 18.3,
      defaultDepth: 18.3,
      color: 'none',
      stroke: '#ffffff',
    },
    tags: ['sports', 'football', 'circle', 'center', 'markings'],
  },

  'infrastructure:football-lines': {
    assetId: 'infrastructure:football-lines',
    name: 'Football Pitch Markings & Boxes',
    nameMm: 'ဘောလုံးကွင်း စည်းမျဉ်းများ',
    category: 'infrastructure',
    sourceComponent: 'FootballLinesModel',
    description: 'White boundary touchlines, penalty areas, goal areas, and halfway line for football pitch.',
    defaultDimensions: { width: 60.0, depth: 96.0, height: 0.15 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'none' },
    footprint: {
      shape: 'rect',
      defaultWidth: 60.0,
      defaultDepth: 96.0,
      color: 'none',
      stroke: '#ffffff',
      subElements: [
        { type: 'rect', x: -18.0, y: -48.0, width: 36.0, height: 16.0, color: 'none', stroke: '#ffffff' },
        { type: 'rect', x: -18.0, y: 32.0, width: 36.0, height: 16.0, color: 'none', stroke: '#ffffff' },
      ],
    },
    tags: ['sports', 'football', 'lines', 'touchline', 'penalty-box'],
  },

  'infrastructure:football-pitch-surface': {
    assetId: 'infrastructure:football-pitch-surface',
    name: 'Football Pitch Turf Surface',
    nameMm: 'ဘောလုံးကွင်း မြက်ခင်းပြင်',
    category: 'infrastructure',
    sourceComponent: 'FootballSurfaceModel',
    description: 'Full-size regulation manicured football turf ground with alternating green lawn mowing stripes.',
    defaultDimensions: { width: 68.0, depth: 104.0, height: 0.1 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'none' },
    footprint: {
      shape: 'rect',
      defaultWidth: 68.0,
      defaultDepth: 104.0,
      color: '#81925c',
      stroke: '#4d7c0f',
    },
    tags: ['sports', 'football', 'turf', 'grass', 'surface'],
  },

  // ==========================================
  // 4. VEHICLES
  // ==========================================
  'vehicle:motorcycle': {
    assetId: 'vehicle:motorcycle',
    name: 'Classic Blue Step-Through Motorcycle',
    nameMm: 'မော်တော်ဆိုင်ကယ် (Wave / Cub ပုံစံ)',
    category: 'vehicles',
    sourceComponent: 'MotorcycleModel',
    description: 'Detailed classic blue 110cc step-through motorcycle with spoked wheels, leg shield, dual shocks and kickstand.',
    defaultDimensions: { width: 0.7, depth: 1.9, height: 1.15 },
    defaultScale: 1.0,
    defaultRotation: 0,
    isVehicle: true,
    collision: { type: 'box', width: 0.7, depth: 1.9 },
    footprint: {
      shape: 'rect',
      defaultWidth: 0.7,
      defaultDepth: 1.9,
      color: '#0ea5e9',
      stroke: '#0369a1',
    },
    tags: ['vehicle', 'motorcycle', 'bike', 'transport'],
  },

  'vehicle:compact-car': {
    assetId: 'vehicle:compact-car',
    name: 'Compact Sedan Car',
    nameMm: 'အိမ်စီး ကားလေး',
    category: 'vehicles',
    sourceComponent: 'Car',
    description: 'Classic compact passenger car with crystal clear windshield, steering wheel, cabin seating and headlights.',
    defaultDimensions: { width: 1.8, depth: 3.9, height: 1.45 },
    defaultScale: 1.0,
    defaultRotation: 0,
    defaultColor: '#2563eb',
    isVehicle: true,
    collision: { type: 'box', width: 1.8, depth: 3.9 },
    footprint: {
      shape: 'rect',
      defaultWidth: 1.8,
      defaultDepth: 3.9,
      color: '#3b82f6',
      stroke: '#1d4ed8',
    },
    tags: ['vehicle', 'car', 'sedan', 'automobile', 'transport'],
  },

  'vehicle:fire-balloon': {
    assetId: 'vehicle:fire-balloon',
    name: 'Myanmar Traditional Hot-Air Fire Balloon',
    nameMm: 'မြန်မာ့ရိုးရာ မီးပုံးပျံကြီး (ဆီမီးခွက်ပါ)',
    category: 'vehicles',
    sourceComponent: 'MyanmarFireBalloon',
    description: 'Traditional paper hot-air fire balloon adorned with festival candle in golden holder and woven suspension rigging.',
    defaultDimensions: { width: 4.8, depth: 4.8, height: 6.2 },
    defaultScale: 1.0,
    defaultRotation: 0,
    isAnimated: true,
    collision: { type: 'none' },
    footprint: {
      shape: 'circle',
      defaultWidth: 4.8,
      defaultDepth: 4.8,
      color: '#fb923c88',
      stroke: '#ea580c',
    },
    tags: ['balloon', 'festival', 'tazaungdaing', 'cultural', 'floating'],
  },

  // ==========================================
  // 5. CULTURAL & STREET FURNITURE
  // ==========================================
  'cultural:candle-in-holder': {
    assetId: 'cultural:candle-in-holder',
    name: 'Festival Candle in Gold Cup with Flame',
    nameMm: 'ဆီမီးခွက်နှင့် တောက်ပနေသော ဖယောင်းတိုင်မီး',
    category: 'cultural',
    sourceComponent: 'CandleInHolder',
    description: 'Traditional Buddhist festival candle sitting in a purple wax pool inside an ornamental golden brass holder with flickering flame.',
    defaultDimensions: { width: 0.4, depth: 0.4, height: 0.5 },
    defaultScale: 1.0,
    defaultRotation: 0,
    isAnimated: true,
    collision: { type: 'none' },
    footprint: {
      shape: 'circle',
      defaultWidth: 0.4,
      defaultDepth: 0.4,
      color: '#facc15',
      stroke: '#ca8a04',
    },
    tags: ['candle', 'light', 'festival', 'buddhist', 'illumination'],
  },

  'furniture:tea-table': {
    assetId: 'furniture:tea-table',
    name: 'Tea Table with Stools, Teapot & Cups',
    nameMm: 'လက်ဖက်ရည်ဝိုင်း (စားပွဲ၊ ထိုင်ခုံ ၄ လုံး၊ ရေနွေးကရား)',
    category: 'furniture',
    sourceComponent: 'TeaTable',
    description: 'Round outdoor wooden tea table accompanied by 4 wooden stools, ceramic cups and steaming hot green teapot.',
    defaultDimensions: { width: 2.2, depth: 2.2, height: 0.8 },
    defaultScale: 1.0,
    defaultRotation: 0,
    collision: { type: 'box', width: 2.0, depth: 2.0 },
    footprint: {
      shape: 'complex',
      defaultWidth: 2.2,
      defaultDepth: 2.2,
      color: '#d97706',
      stroke: '#92400e',
      subElements: [
        { type: 'circle', x: 0, y: 0, r: 0.6, color: '#f59e0b', stroke: '#b45309' }, // Table
        { type: 'circle', x: -0.9, y: 0, r: 0.2, color: '#78350f', stroke: '#451a03' }, // Stool W
        { type: 'circle', x: 0.9, y: 0, r: 0.2, color: '#78350f', stroke: '#451a03' }, // Stool E
        { type: 'circle', x: 0, y: -0.9, r: 0.2, color: '#78350f', stroke: '#451a03' }, // Stool N
        { type: 'circle', x: 0, y: 0.9, r: 0.2, color: '#78350f', stroke: '#451a03' }, // Stool S
      ],
    },
    tags: ['furniture', 'table', 'chair', 'tea', 'cafe'],
  },
};

export const ASSET_LIST: AssetDefinition[] = Object.values(ASSET_REGISTRY);

export function registerCustomAsset(asset: CustomAsset) {
  const [width, height, depth] = asset.dimensions;
  const def: AssetDefinition = { assetId: asset.id, name: asset.name, nameMm: asset.nameMm, category: asset.category, sourceComponent: 'Custom 3D', description: 'AI-created geometric 3D asset', defaultDimensions: { width, height, depth }, defaultScale: 1, defaultRotation: 0, collision: { type: 'box' }, footprint: { shape: 'rect', defaultWidth: width, defaultDepth: depth, color: asset.parts[0].color, stroke: '#475569' }, tags: ['custom', 'ai'], customModel: asset };
  ASSET_REGISTRY[asset.id] = def;
  const index = ASSET_LIST.findIndex(a => a.assetId === asset.id);
  if (index < 0) ASSET_LIST.push(def); else ASSET_LIST[index] = def;
  return def;
}
export function unregisterCustomAsset(id: string) {
  if (!ASSET_REGISTRY[id]?.customModel) return;
  delete ASSET_REGISTRY[id];
  const index = ASSET_LIST.findIndex(a => a.assetId === id);
  if (index >= 0) ASSET_LIST.splice(index, 1);
}
for (const asset of loadCustomAssets()) registerCustomAsset(asset);

export function getAssetDefinition(assetId: string | undefined): AssetDefinition | undefined {
  if (!assetId) return undefined;
  return ASSET_REGISTRY[assetId];
}

export function searchAssets(query: string, category?: AssetCategory): AssetDefinition[] {
  const q = query.trim().toLowerCase();
  return ASSET_LIST.filter(a => {
    if (category && a.category !== category) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.nameMm.toLowerCase().includes(q) ||
      a.assetId.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  });
}
