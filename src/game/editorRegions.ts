import {emptyLayout,loadLayout,validLayout,type LayoutFeature,type Point2,type WorldLayout,type FeatureKind} from './worldLayout';
import { MAP_DESTINATIONS } from './locationDetect';
export const REGIONS = [
 {id:'custom',name:'New / Custom Village'},
 {id:'myothar',name:'မြို့သာရပ်ကွက် (Myothar Ward)',destination:'myothar-center'},
 {id:'kalay-area-1',name:'ကလေး နယ်မြေ (၁) (Kalay Area 1)',destination:'kalay-area-1'},
 {id:'tharsi',name:'သာစည်ရွာ (Tharsi)',destination:'tharsi'},
 {id:'chinsai',name:'ချင်းဆိုင်ရွာ (Chinsai)',destination:'chinsai'},
 {id:'zingalin',name:'ဇင်းကလင်းရွာ (Zingalin)',destination:'zingalin'},
 {id:'htomar',name:'ထိုမာရွာ (Htomar)',destination:'htomar'},
 {id:'tharyargone',name:'သာယာကုန်းရွာ (Tharyargone)',destination:'tharyargone'},
 {id:'htaukkyant',name:'ထောက်ကြန့်ရွာ (Htaukkyant)',destination:'htaukkyant'},
 {id:'kyarinn',name:'ကြာအင်းရွာ (Kyarinn)',destination:'kyarinn'},
 {id:'sithar',name:'စည်သာရွာ (Si Thar)',destination:'sithar'},
 {id:'kanbale',name:'ကံပုလဲရွာ (Kanbale)',destination:'kanbale'},
 {id:'natmyaung',name:'နတ်မြောင်းရွာ (Natmyaung)',destination:'natmyaung'},
 {id:'natchaung',name:'နတ်ချောင်း (Custom)',destination:undefined},
];
export function regionCenter(id:string,fallback:Point2):Point2 {
 const normId = normalizeAuthoredRegionId(id);
 const destination = REGIONS.find(r=>r.id===id || r.id===normId)?.destination;
 const point = MAP_DESTINATIONS.find(d=>d.id===destination || d.id===normId);
 return point?{x:point.x,z:point.z}:fallback;
}
import { getRegionAuthoredFeatures, normalizeAuthoredRegionId } from './regionObjectsMigration';
import { publishWorldEdits } from './worldEdits';

const key=(id:string)=>`mm-editor-region-v1:${id}`;
export function loadRegionLayout(id:string):WorldLayout{
 if(id==='custom')return loadLayout();
 const normId = normalizeAuthoredRegionId(id);
 try{
   const raw=localStorage.getItem(key(id)) || localStorage.getItem(key(normId));
   if(raw){const data:unknown=JSON.parse(raw);if(validLayout(data))return data;}
 }catch{}
 const authored = getRegionAuthoredFeatures(normId);
 return {
   ...emptyLayout(),
   name: REGIONS.find(r=>r.id===id || r.id===normId)?.name ?? id,
   features: authored,
 };
}

export function syncAllWorldEdits(): WorldLayout[] {
  const layouts: WorldLayout[] = [];
  for (const r of REGIONS) {
    try {
      const normId = normalizeAuthoredRegionId(r.id);
      const raw = r.id === 'custom'
        ? localStorage.getItem('myanmar-town-world-layout-v1')
        : (localStorage.getItem(key(r.id)) || localStorage.getItem(key(normId)));
      if (raw) {
        const l = loadRegionLayout(r.id);
        if (l && Array.isArray(l.features)) layouts.push(l);
      }
    } catch {}
  }
  publishWorldEdits(layouts);
  return layouts;
}

export function saveRegionLayout(id:string,layout:WorldLayout){
  const normId = normalizeAuthoredRegionId(id);
  const next: WorldLayout = {
    ...layout,
    version: 1,
    name: layout.name || (REGIONS.find(r => r.id === id || r.id === normId)?.name ?? id),
    updatedAt: new Date().toISOString(),
  };
  if(id==='custom'){
    localStorage.setItem('myanmar-town-world-layout-v1',JSON.stringify(next));
  } else {
    localStorage.setItem(key(id),JSON.stringify(next));
    if (normId !== id) {
      localStorage.setItem(key(normId), JSON.stringify(next));
    }
  }
  syncAllWorldEdits();
  window.dispatchEvent(new CustomEvent('world-layout-updated',{detail:{regionId:id,layout:next}}));
}
// GeoJSON import requires already projected local world X/Z coordinates.
// GPS lon/lat must first be transformed using the game's authoritative projection.
export function importGeoJSONFeatures(input:unknown):LayoutFeature[]{
 if(!input||typeof input!=='object')throw Error('Invalid GeoJSON');
 const root=input as {type?:string;features?:unknown[]};
 if(root.type!=='FeatureCollection'||!Array.isArray(root.features))throw Error('Expected FeatureCollection');
 const result:LayoutFeature[]=[];
 const point=(v:unknown):Point2=>{if(!Array.isArray(v)||v.length<2||!Number.isFinite(v[0])||!Number.isFinite(v[1]))throw Error('Invalid coordinates');const x=Number(v[0]),z=Number(v[1]);if(Math.abs(x)<=180&&Math.abs(z)<=90)throw Error('GPS lon/lat detected: project to world X/Z before import');return {x,z};};
 for(const item of root.features){
  const f=item as {id?:string|number;geometry?:{type?:string;coordinates?:unknown};properties?:Record<string,unknown>};
  const g=f?.geometry,p=f?.properties??{};if(!g)continue;
  let points:Point2[];let kind:FeatureKind;
  if(g.type==='Point'){points=[point(g.coordinates)];const raw=String(p.kind??p.type??p.amenity??p.building??'custom').toLowerCase();kind=raw.includes('school')?'school':raw.includes('hospital')?'hospital':raw.includes('tree')?'tree':raw.includes('shop')?'shop':raw.includes('house')||raw==='yes'?'house':'custom';}
  else if(g.type==='LineString'){points=(g.coordinates as unknown[]).map(point);kind='road';}
  else if(g.type==='Polygon'){points=((g.coordinates as unknown[][])[0]??[]).map(point);if(points.length>1&&points[0].x===points.at(-1)?.x&&points[0].z===points.at(-1)?.z)points.pop();kind=p.building?'house':p.boundary?'ward':'block';}
  else continue;
  if(!points.length||points.length>5000)continue;
  result.push({id:`geo-${String(f.id??crypto.randomUUID())}`,kind,name:String(p.name??p.label??kind),points,width:kind==='road'?Number(p.width)||5:undefined});
 }
 return result;
}
