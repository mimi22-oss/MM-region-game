export type House = {
 id: string;
 name: string;
 x: number;
 z: number;
 width: number;
 depth: number;
 color: string;
 rotation: number;
 roof: string;
};

export type RoadPlot = {
 id: string;
 name: string;
 x: number;
 z: number;
 width: number;
 depth: number;
 rotation: number;
 main: boolean;
};

export type TreePlot = {
 id: string;
 x: number;
 z: number;
 radius: number;
};

export type FieldPlot = {
 id?: string;
 name?: string;
 row?: number;
 u?: number;
 v?: number;
 x: number;
 z: number;
 width: number;
 depth: number;
 rotation: number;
 color: string;
};

export type PondPlot = {
 id: string;
 name: string;
 u: number;
 v: number;
 x: number;
 z: number;
 width: number;
 depth: number;
 rotation: number;
 color?: string;
};

export type WindingCanalPlot = {
 id: string;
 name: string;
 depth: number;
 rotation: number;
 points: [number, number][];
 bridges: { u: number; v: number; width: number; depth: number }[];
};

export type EastWestCanalPlot = {
 id: string;
 name: string;
 u: number;
 v: number;
 uMin: number;
 uMax: number;
 x: number;
 z: number;
 width: number;
 depth: number;
 rotation: number;
 bridges: { u: number; v: number; width: number; depth: number }[];
};

/** ရပ်ကွက် သို့မဟုတ် ကျေးရွာအတွင်းရှိ နယ်မြေ (Area / Zone) တစ်ခုချင်းစီ၏ အခြေခံ အချက်အလက် */
export type AreaMeta = {
 id: string;
 number: number;
 name: string;
 wardName: string;
 houses: House[];
 roads: RoadPlot[];
 fields: FieldPlot[];
 trees: TreePlot[];
 largeTrees: TreePlot[];
};

/** ရပ်ကွက် (Ward) တစ်ခုချင်းစီ၏ အခြေခံ အချက်အလက် (နယ်မြေများ စုစည်းမှု) */
export type WardMeta = {
 id: string;
 name: string;
 shortName: string;
 currentArea: string;
 areas: AreaMeta[];
};

/** ကျေးရွာ (Village) တစ်ခုချင်းစီ၏ အခြေခံ အချက်အလက် */
export type VillageMeta = {
 id: string;
 name: string;
 englishName?: string;
 villageTract?: string;
 description?: string;
 coordinates?: { lat: number; lng: number };
 x: number;
 z: number;
 labelPos: { x: number; z: number };
 separationFields: FieldPlot[];
 connectingCanal?: WindingCanalPlot;
 canal?: EastWestCanalPlot;
 houses: House[];
 roads: RoadPlot[];
 fields: FieldPlot[];
 bundedFields: FieldPlot[];
 ponds?: PondPlot[];
 trees: TreePlot[];
 largeTrees: TreePlot[];
 farmTrees: TreePlot[];
 areas?: AreaMeta[];
};
