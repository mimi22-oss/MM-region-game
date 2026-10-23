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
 villageTract?: string;
 description?: string;
 x: number;
 z: number;
 houses: House[];
 roads: RoadPlot[];
 fields: FieldPlot[];
 trees: TreePlot[];
 areas?: AreaMeta[];
};

