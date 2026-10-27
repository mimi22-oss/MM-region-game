import { angle } from '../data/ward.ts';
import { robotLocation } from './robotLocation.ts';
import { toLocalUV, detectLocation } from './locationDetect.ts';
import * as center from '../data/wards/myothar/center/myotharCenterData.ts';
import * as kanbale from '../data/villages/kanbale/kanbaleData.ts';
import * as sithar from '../data/villages/sithar/sitharData.ts';
import * as natmyaung from '../data/villages/natmyaung/natmyaungData.ts';

export type MapPoint = { x: number; z: number };
export type GeoReference = 'myothar-center' | 'kanbale' | 'sithar' | 'natmyaung' | 'scene';
export type FillKind = 'mixed' | 'house' | 'building' | 'office' | 'tree' | 'ward' | 'river' | 'stream' | 'lake' | 'pond' | 'canal' | 'drain';
export type SelectionGeometry = 'Polygon' | 'LineString';
export type SelectionOperation = 'create' | 'update' | 'move' | 'delete';
export const SELECTION_OPERATIONS: Record<SelectionOperation, string> = { create: 'အသစ်ထည့်ရန်', update: 'ပြင်ဆင်ရန်', move: 'နေရာရွှေ့ရန်', delete: 'ဖျက်ရန်' };
export type SelectionPin = MapPoint & { id: string; name: string; kind: FillKind };
export type MapSelectionDraft = { points: MapPoint[]; pins: SelectionPin[]; name: string; kind: FillKind; notes: string; reference: GeoReference; waterWidth?: number; operation?: SelectionOperation; targetId?: string; moveTo?: MapPoint; moveReference?: GeoReference };
export const SELECTION_STORAGE_KEY = 'mm-town-map-selection-v1';
export const FILL_KINDS: Record<FillKind, string> = { mixed: 'အိမ် / အဆောက်အဦ / သစ်ပင် ရောနှော', house: 'လူနေအိမ်', building: 'အဆောက်အဦ', office: 'ဌာန / ရုံး', tree: 'သစ်ပင်', ward: 'ရပ်ကွက်', river: 'မြစ်', stream: 'ချောင်း', lake: 'အင်း / အိုင်', pond: 'ရေကန်', canal: 'ဆည်မြောင်း / ရေသွင်းမြောင်း', drain: 'ရေနုတ်မြောင်း' };
export function selectionGeometry(kind: FillKind): SelectionGeometry { return ['river', 'stream', 'canal', 'drain'].includes(kind) ? 'LineString' : 'Polygon'; }
export function defaultWaterWidth(kind: FillKind) { return kind === 'river' ? 20 : kind === 'stream' ? 5 : kind === 'canal' ? 3 : 1; }
export const GEO_REFERENCES: Record<GeoReference, string> = { 'myothar-center': 'မြို့သာ အလယ် GeoJSON', kanbale: 'ကံပုလဲ GeoJSON', sithar: 'စည်သာ GeoJSON', natmyaung: 'နတ်မြောင်း GeoJSON (ချုံ့ထားသောမြေပုံ)', scene: 'အခြားနေရာ — Scene ခန့်မှန်းတည်နေရာ' };

export function suggestGeoReference(point: MapPoint): GeoReference {
	const place = detectLocation(point.x, point.z), { u, v } = toLocalUV(point.x, point.z);
	if (place.id === 'kanbale' || place.id === 'kanbale-rice-mill' || place.id === 'kanbale-school') return 'kanbale';
	if (place.id === 'sithar' || (v >= 4018 && v <= 4108)) return 'sithar';
	if (place.id === 'natmyaung' || (v >= 4120 && v <= 4350)) return 'natmyaung';
	if (v < -270 && v >= -1800 && u >= -1000 && u <= 650) return 'myothar-center';
	return 'scene';
}
export function selectionGeo(point: MapPoint, reference: GeoReference) {
	const { u, v } = toLocalUV(point.x, point.z);
	if (reference === 'myothar-center') return center.localUVToGeo(u, v);
	if (reference === 'kanbale') return kanbale.localUVToGeo(u, v);
	if (reference === 'sithar') return sithar.localUVToGeo(u, v);
	if (reference === 'natmyaung') return natmyaung.localUVToGeo(u, v);
	const geo = robotLocation(point.x, point.z, 0);
	return { lon: geo.longitude, lat: geo.latitude };
}
const cross = (a: MapPoint, b: MapPoint, c: MapPoint) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
function onSegment(a: MapPoint, b: MapPoint, p: MapPoint) {
	return Math.abs(cross(a, b, p)) < 1e-7 && p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7 && p.z >= Math.min(a.z, b.z) - 1e-7 && p.z <= Math.max(a.z, b.z) + 1e-7;
}
export function insideSelection(point: MapPoint, points: MapPoint[]) {
	let inside = false;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const a = points[i], b = points[j];
		if (onSegment(a, b, point)) return true;
		if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
	}
	return inside;
}
export function selectionMetrics(points: MapPoint[], geometry: SelectionGeometry = 'Polygon') {
	const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.z - points[i].z), 0);
	if (geometry === 'LineString') {
		let remaining = length / 2;
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1], b = points[i], segment = Math.hypot(b.x - a.x, b.z - a.z);
			if (segment > 0 && remaining <= segment) return { area: 0, length, center: { x: a.x + (b.x - a.x) * remaining / segment, z: a.z + (b.z - a.z) * remaining / segment } };
			remaining -= segment;
		}
		return { area: 0, length, center: points[0] ?? { x: 0, z: 0 } };
	}
	let twiceArea = 0, cx = 0, cz = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i], b = points[(i + 1) % points.length], value = a.x * b.z - b.x * a.z;
		twiceArea += value; cx += (a.x + b.x) * value; cz += (a.z + b.z) * value;
	}
	return { area: Math.abs(twiceArea) / 2, length, center: Math.abs(twiceArea) > 1e-8 ? { x: cx / (3 * twiceArea), z: cz / (3 * twiceArea) } : points[0] ?? { x: 0, z: 0 } };
}
export function selectionError(points: MapPoint[], geometry: SelectionGeometry = 'Polygon') {
	if (points.length < (geometry === 'LineString' ? 2 : 3)) return geometry === 'LineString' ? 'လမ်းကြောင်းအတွက် အနည်းဆုံး ၂ မှတ် ရွေးပါ။' : 'အနည်းဆုံး ထောင့်မှတ် ၃ ခုဖြင့် နယ်မြေကို ဝိုက်ရွေးပါ။';
	if (points.length > 512 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) return 'နယ်မြေမှတ်များ မမှန်ပါ။ ပြန်ဆွဲပါ။';
	for (let i = 0; i < points.length - (geometry === 'LineString' ? 1 : 0); i++) {
		const a = points[i], b = points[(i + 1) % points.length];
		if (Math.hypot(a.x - b.x, a.z - b.z) < 0.001) return 'ထပ်နေသော ထောင့်မှတ်ကို ဖယ်ပြီး ပြန်ရွေးပါ။';
		if (geometry === 'LineString') continue;
		for (let j = i + 2; j < points.length; j++) {
			if (i === 0 && j === points.length - 1) continue;
			const c = points[j], d = points[(j + 1) % points.length];
			if ((cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
				onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return 'မျဉ်းချင်း ဖြတ်နေပါတယ်။ နယ်နိမိတ်ကို မဖြတ်ဘဲ ပြန်ဝိုက်ပါ။';
		}
	}
	if (geometry === 'LineString') return selectionMetrics(points, geometry).length < 0.1 ? 'လမ်းကြောင်း သေးလွန်းပါတယ်။' : '';
	if (selectionMetrics(points).area < 1) return 'နယ်မြေ သေးလွန်းပါတယ်။ အနည်းဆုံး ၁ စတုရန်းမီတာ ရွေးပါ။';
	return '';
}
export function selectionDraftError(draft: MapSelectionDraft) {
	const error = selectionError(draft.points, selectionGeometry(draft.kind));
	if (error) return error;
	if (selectionGeometry(draft.kind) === 'LineString') {
		const width = draft.waterWidth ?? defaultWaterWidth(draft.kind);
		if (!Number.isFinite(width) || width < 0.2 || width > 500) return 'ရေလမ်းအကျယ်ကို ၀.၂ မှ ၅၀၀ မီတာအတွင်း ထည့်ပါ။';
	}
	const operation = draft.operation ?? 'create';
	if (!Object.hasOwn(SELECTION_OPERATIONS, operation)) return 'လုပ်ဆောင်ချက်ကို ပြန်ရွေးပါ။';
	if (operation !== 'create' && !draft.name.trim() && !draft.targetId?.trim()) return 'လုပ်ဆောင်မည့်အရာ၏ မူလအမည် သို့မဟုတ် ID ကို ထည့်ပါ။';
	if (operation === 'update' && !draft.notes.trim()) return 'ဘာကို ဘယ်လိုပြင်မလဲဆိုတာ ညွှန်ကြားချက်တွင် ရေးပါ။';
	if (operation === 'move') {
		if (!draft.moveTo || !Number.isFinite(draft.moveTo.x) || !Number.isFinite(draft.moveTo.z)) return 'နေရာအသစ်ရွေးရန်ကို နှိပ်ပြီး မြေပုံပေါ်တွင် ရွှေ့မည့်နေရာကို နှိပ်ပါ။';
		const center = selectionMetrics(draft.points, selectionGeometry(draft.kind)).center;
		if (Math.hypot(draft.moveTo.x - center.x, draft.moveTo.z - center.z) < 0.01) return 'မူလနေရာနှင့် မတူသော နေရာအသစ်ကို ရွေးပါ။';
	}
	return '';
}
/** Translate the complete shape without changing its dimensions, bend order or source. */
export function movedSelectionPoints(draft: MapSelectionDraft): MapPoint[] {
	if (!draft.moveTo) return [];
	const center = selectionMetrics(draft.points, selectionGeometry(draft.kind)).center;
	return draft.points.map(p => ({ x: p.x + draft.moveTo!.x - center.x, z: p.z + draft.moveTo!.z - center.z }));
}
/** Simplify a drag stroke in world units corresponding to a few screen pixels. */
export function simplifySelection(points: MapPoint[], tolerance: number): MapPoint[] {
	if (points.length <= 2) return points;
	const a = points[0], b = points[points.length - 1], length2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
	let max = tolerance * tolerance, index = -1;
	for (let i = 1; i < points.length - 1; i++) {
		const p = points[i], t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / length2)) : 0;
		const distance = (p.x - a.x - t * (b.x - a.x)) ** 2 + (p.z - a.z - t * (b.z - a.z)) ** 2;
		if (distance > max) { max = distance; index = i; }
	}
	return index < 0 ? [a, b] : [...simplifySelection(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplifySelection(points.slice(index), tolerance)];
}
export function readSelectionDraft(text: string | null): MapSelectionDraft | null {
	try {
		const d = JSON.parse(text ?? 'null');
		const validPoint = (p: MapPoint) => p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= 100000 && Math.abs(p.z) <= 100000;
		if (!d || !Object.hasOwn(GEO_REFERENCES, d.reference) || !Object.hasOwn(FILL_KINDS, d.kind) || typeof d.name !== 'string' || typeof d.notes !== 'string' ||
			!Array.isArray(d.points) || d.points.length > 512 || !d.points.every(validPoint) || !Array.isArray(d.pins) || d.pins.length > 100 ||
			!d.pins.every((p: SelectionPin) => validPoint(p) && typeof p.id === 'string' && typeof p.name === 'string' && Object.hasOwn(FILL_KINDS, p.kind))) return null;
		if (d.waterWidth !== undefined && (typeof d.waterWidth !== 'number' || !Number.isFinite(d.waterWidth) || d.waterWidth < 0.2 || d.waterWidth > 500)) return null;
		if (d.operation !== undefined && !Object.hasOwn(SELECTION_OPERATIONS, d.operation)) return null;
		if (d.targetId !== undefined && typeof d.targetId !== 'string') return null;
		if (d.moveTo !== undefined && !validPoint(d.moveTo)) return null;
		if (d.moveReference !== undefined && !Object.hasOwn(GEO_REFERENCES, d.moveReference)) return null;
		return d;
	} catch { return null; }
}
function exportSelectionGeometry(draft: MapSelectionDraft) {
	const round = (n: number) => Math.round(n * 1e7) / 1e7;
	const coordinates = draft.points.map(point => { const geo = selectionGeo(point, draft.reference); return [round(geo.lon), round(geo.lat)]; });
	const geometry = selectionGeometry(draft.kind), line = geometry === 'LineString';
	// Only polygon rings close/reorient. A waterway retains every vertex in drawing order.
	const signed = coordinates.reduce((sum, a, i) => { const b = coordinates[(i + 1) % coordinates.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
	if (!line) { if (signed < 0) coordinates.reverse(); coordinates.push([...coordinates[0]]); }
	const metrics = selectionMetrics(draft.points, geometry), geo = selectionGeo(metrics.center, draft.reference);
	const scenePoints = draft.points.map(p => [p.x, p.z]), localPoints = draft.points.map(p => { const uv = toLocalUV(p.x, p.z); return [uv.u, uv.v]; });
	return {
		type: 'FeatureCollection',
		features: [{
			type: 'Feature', id: line ? 'requested-waterway' : 'requested-area', geometry: { type: geometry, coordinates: line ? coordinates : [coordinates] }, properties: {
				name: draft.name.trim() || (line ? FILL_KINDS[draft.kind] : 'ဖြည့်စွက်ရန် နယ်မြေ'), request_kind: draft.kind, instructions: draft.notes,
				operation: draft.operation ?? 'create', target_id: (draft.operation ?? 'create') === 'create' ? null : draft.targetId?.trim() || null,
				purpose: 'map-content-request', geo_reference: draft.reference, geo_reference_label: GEO_REFERENCES[draft.reference],
				coordinate_note: 'Geographic coordinates use the selected scene projection, not surveyed GPS. GeoJSON coordinates are [longitude, latitude]. Use scene_boundary_xz or scene_path_xz for exact placement in this game; measurements and width are scene meters.',
				scene_rotation_radians: angle,
				...(line ? { scene_path_xz: scenePoints, local_path_uv: localPoints, scene_length_m: Math.round(metrics.length * 100) / 100, waterway: draft.kind, scene_width_m: draft.waterWidth ?? defaultWaterWidth(draft.kind) } : { scene_boundary_xz: scenePoints, local_boundary_uv: localPoints, scene_area_m2: Math.round(metrics.area * 100) / 100 }),
				...(['lake', 'pond'].includes(draft.kind) ? { natural: 'water', water: draft.kind } : {}),
				scene_center: metrics.center, geographic_center: [geo.lon, geo.lat],
			}
		}, ...(line || (draft.operation ?? 'create') !== 'create' ? [] : draft.pins).filter(pin => insideSelection(pin, draft.points)).map(pin => {
			const point = selectionGeo(pin, draft.reference); return {
				type: 'Feature', id: pin.id, geometry: { type: 'Point', coordinates: [round(point.lon), round(point.lat)] },
				properties: { name: pin.name, request_kind: pin.kind, operation: draft.operation ?? 'create', target_id: (draft.operation ?? 'create') === 'create' ? null : draft.targetId?.trim() || null, scene_x: pin.x, scene_z: pin.z, ...toLocalUV(pin.x, pin.z), geo_reference: draft.reference },
			};
		})],
	};
}

export function exportMapSelection(draft: MapSelectionDraft) {
	const error = selectionDraftError(draft); if (error) throw new Error(error);
	const operation = draft.operation ?? 'create', source = exportSelectionGeometry(draft);
	const request = { operation, target_id: (draft.operation ?? 'create') === 'create' ? null : draft.targetId?.trim() || null, target_name: draft.name.trim(), request_kind: draft.kind, instructions: draft.notes };
	if (operation !== 'move') return { ...source, request };
	const center = selectionMetrics(draft.points, selectionGeometry(draft.kind)).center;
	const offset = { x: draft.moveTo!.x - center.x, z: draft.moveTo!.z - center.z };
	const destination = exportSelectionGeometry({ ...draft, reference: draft.moveReference ?? draft.reference, points: movedSelectionPoints(draft), pins: draft.pins.map(pin => ({ ...pin, x: pin.x + offset.x, z: pin.z + offset.z })) });
	return {
		type: 'FeatureCollection', request: { ...request, scene_translation_xz: [offset.x, offset.z], destination_geo_reference: draft.moveReference ?? draft.reference }, features: [
			...source.features.map(feature => ({ ...feature, properties: { ...feature.properties, selection_role: 'source' } })),
			...destination.features.map(feature => ({ ...feature, id: `${feature.id}:destination`, properties: { ...feature.properties, selection_role: 'destination', source_feature_id: feature.id } })),
		]
	};
}

export function selectionLocationText(draft: MapSelectionDraft) {
	const error = selectionDraftError(draft); if (error) throw new Error(error);
	const line = selectionGeometry(draft.kind) === 'LineString';
	const rows = draft.points.map((point, i) => { const geo = selectionGeo(point, draft.reference), uv = toLocalUV(point.x, point.z); return `${i + 1}. Lat: ${geo.lat.toFixed(7)}, Lon: ${geo.lon.toFixed(7)} | X/Z: ${point.x.toFixed(3)}, ${point.z.toFixed(3)} | U/V: ${uv.u.toFixed(3)}, ${uv.v.toFixed(3)}`; });
	const operation = draft.operation ?? 'create';
	const destinationRows = operation === 'move' ? movedSelectionPoints(draft).map((p, i) => { const geo = selectionGeo(p, draft.moveReference ?? draft.reference), uv = toLocalUV(p.x, p.z); return `${i + 1}. Lat: ${geo.lat.toFixed(7)}, Lon: ${geo.lon.toFixed(7)} | X/Z: ${p.x.toFixed(3)}, ${p.z.toFixed(3)} | U/V: ${uv.u.toFixed(3)}, ${uv.v.toFixed(3)}`; }) : [];
	return [`Operation: ${operation} · ${SELECTION_OPERATIONS[operation]}`, `Target ID: ${operation === 'create' ? '(new object)' : draft.targetId?.trim() || '(not provided)'}`, `${draft.name.trim() || FILL_KINDS[draft.kind]} · ${selectionGeometry(draft.kind)}`, `Reference: ${GEO_REFERENCES[draft.reference]}`,
		'Latitude/longitude: approximate scene projection, not surveyed GPS. X/Z and U/V: exact scene meters.',
	...(line ? [`Waterway width (scene meters): ${draft.waterWidth ?? defaultWaterWidth(draft.kind)}`, 'Open centerline; points follow drawing order. Do not connect the last point to the first.'] : ['Closed area boundary.']),
	operation === 'create' ? 'PLACEMENT' : 'SOURCE / မူလနေရာ', ...rows, ...(destinationRows.length ? ['DESTINATION / နေရာအသစ်', `Reference: ${GEO_REFERENCES[draft.moveReference ?? draft.reference]}`, ...destinationRows] : []), `Instructions: ${draft.notes}`].join('\n');
}

/** Copyable brief only; no model API call or transfer to an external service. */
export function selectionAiPrompt(draft: MapSelectionDraft) {
	const line = selectionGeometry(draft.kind) === 'LineString';
	const operation = draft.operation ?? 'create';
	const actionInstructions: Record<SelectionOperation, string> = {
		create: 'ဖော်ပြထားသည့်အမျိုးအစားကို ပေးထားသောနေရာတွင် အသစ်ထည့်ပေးပါ။',
		update: 'မူလအမည်/ID ဖြင့် ကိုက်ညီသည့်အရာကို ညွှန်ကြားချက်အတိုင်း ပြင်ဆင်ပါ။ အသစ်ထပ်မဖန်တီးပါနှင့်။',
		move: 'selection_role=source မှ မူလအမည်/ID ကိုက်ညီသည့်အရာကို selection_role=destination သို့ ရွှေ့ပါ။ scene_translation_xz ကို သုံး၍ ပုံသဏ္ဌာန်၊ အရွယ်အစား၊ ID ကိုထိန်းသိမ်းပါ။ မူလနေရာ၌ မိတ္တူမကျန်စေပါနှင့်။ source_feature_id ဖြင့် မူလ/အသစ်ကို တွဲကြည့်ပါ။',
		delete: 'မူလအမည်/ID နှင့် တည်နေရာကိုက်ညီသည့်အရာကိုသာ ဖျက်ပါ။ ရွေးထားသည့်ဧရိယာအတွင်းရှိ အခြားအရာအားလုံးကို မဖျက်ပါနှင့်။ အသစ်မထည့်ပါနှင့်။',
	};
	return [
		`Myanmar-Town-Prototype (React / Three.js) — ${SELECTION_OPERATIONS[operation]} (operation=${operation})`,
		`အမျိုးအစား: ${FILL_KINDS[draft.kind]}။ အမည်: ${draft.name.trim() || 'မသတ်မှတ်ရသေး'}။ ID: ${operation === 'create' ? 'အသစ်' : draft.targetId?.trim() || 'မပေးထား'}။`,
		actionInstructions[operation],
		`အသေးစိတ်ညွှန်ကြားချက်: ${draft.notes.trim() || 'အထက်ပါ လုပ်ဆောင်ချက်အတိုင်း ဆောင်ရွက်ပါ။'}`,
		...(operation === 'create' ? [] : ['အမည်/ID ကိုက်ညီသည့်အရာ တစ်ခုတည်း မတွေ့လျှင် ခန့်မှန်းမလုပ်ဘဲ မည်သည့်အရာကို ဆိုလိုကြောင်း အရင်မေးပါ။']),
		'GeoJSON geometry သည် [longitude, latitude] အစဉ်ဖြစ်သည်။ Geographic coordinates သည် scene projection ကိုအခြေခံသော ခန့်မှန်းတန်ဖိုးဖြစ်သည်။ Game ထဲတည်ဆောက်ရာတွင် properties ထဲက scene coordinates နှင့် scene meter အတိုင်းအတာများကို ဦးစားပေးပါ။',
		line ? 'scene_path_xz သည် ရေလမ်းအလယ်မျဉ်းဖြစ်သည်။ scene_width_m သည် အပြည့်အကျယ်ဖြစ်သည်။ အဆုံးမှတ်ကို အစမှတ်နှင့် မဆက်ပါနှင့်။ ရေစီးအရပ်ကို drawing order တစ်ခုတည်းဖြင့် မခန့်မှန်းပါနှင့်။' : 'scene_boundary_xz သည် ရွေးထားသည့်ဧရိယာ၏ နယ်နိမိတ်ဖြစ်သည်။',
		'လုပ်ဆောင်ချက်နှင့်အတူ collision၊ 2D map နှင့် location labels တို့ကို ကိုက်ညီအောင် ပြင်ပါ။ သတ်မှတ်ထားသည့်အရာသာ ပြင်ပြီး အခြားလမ်း၊ အိမ်၊ တံတားများကို ထိန်းသိမ်းပါ။ လိုအပ်သော repository ဖိုင်များ မပေးထားလျှင် ထိုဖိုင်များကို အရင်တောင်းပါ။',
		'', '```json', JSON.stringify(exportMapSelection(draft), null, 2), '```',
	].join('\n');
}
