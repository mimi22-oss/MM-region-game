import json
import math
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Coordinates and constants
kanbale_lon = 94.068471
kanbale_lat = 23.168500
kanbale_u = 0.0
kanbale_v = -740.0
m_per_deg_lat = 111320.0
m_per_deg_lon = 111320.0 * math.cos(23.160308 * math.pi / 180) # ~102354.72
angle = math.pi / 4
cosA = math.cos(angle)
sinA = math.sin(angle)

def geo_to_uv(lon, lat):
    u = kanbale_u + (lon - kanbale_lon) * m_per_deg_lon
    v = kanbale_v - (lat - kanbale_lat) * m_per_deg_lat
    return round(u, 2), round(v, 2)

def uv_to_world(u, v):
    x = u * cosA + v * sinA
    z = -u * sinA + v * cosA
    return round(x, 2), round(z, 2)

def geo_to_world(lon, lat):
    u, v = geo_to_uv(lon, lat)
    return uv_to_world(u, v)

# Palette definitions for authentic Myanmar township buildings
wall_colors = [
    '#f5ede1', '#e3d5c1', '#d6c7b0', '#dfd5c6', '#5c432d',
    '#e8e1d5', '#ede5d8', '#ccbda8', '#d0c3b0', '#f2ece4',
    '#e5dfd3', '#c9ba9b', '#ded7c8', '#ebd8b7', '#dbc9ad'
]

roof_colors = [
    '#8c3a2b', '#3b6d8c', '#a65342', '#627c85', '#a39a85',
    '#4b6b55', '#964332', '#4a607a', '#7d3c2e', '#556b2f',
    '#395b64', '#705843', '#8b4513', '#606c38', '#2b4162'
]

fence_colors = [
    '#2563a6', '#2563a6', '#2563a6', # Area 5 signature Blue Sheet
    '#2e6b52', # Sage Green Galvanized Sheet
    '#627d85', # Classic Zinc Galvanized Corrugated Sheet
    '#6d4c41'  # Teak wood fence
]

# Read GeoJSON
with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    geojson_data = json.load(f)

raw_features = geojson_data['features']
print(f"Total features loaded: {len(raw_features)}")

# 1. Process POIs
raw_points = [f for f in raw_features if f['geometry']['type'] == 'Point']
pois = []
poi_seen_names = set()

for i, p in enumerate(raw_points):
    props = p['properties']
    name = props.get('name', f'အထင်ကရနေရာ {i+1}')
    kind = props.get('kind', 'shop')
    p_id = p.get('id') or props.get('id') or f'poi-{i+1}'
    lon, lat = p['geometry']['coordinates']
    u, v = geo_to_uv(lon, lat)
    x, z = uv_to_world(u, v)

    # Deduplicate exact duplicate points (e.g. OSO duplicate)
    key = (name, round(lon, 5), round(lat, 5))
    if key in poi_seen_names:
        continue
    poi_seen_names.add(key)

    pois.append({
        'id': p_id,
        'name': name,
        'kind': kind,
        'lon': lon,
        'lat': lat,
        'u': u,
        'v': v,
        'x': x,
        'z': z
    })

print(f"Processed POIs: {len(pois)}")

# 2. Process Roads
raw_roads = [f for f in raw_features if f['geometry']['type'] == 'LineString']
roads = []
road_segments = []

for r_idx, r in enumerate(raw_roads):
    props = r['properties']
    highway = props.get('highway', 'residential')
    ref = props.get('ref', '')
    raw_name = props.get('name', '')
    
    if ref == 'NH41':
        name = 'AH1 / NH41 အာရှလမ်းမကြီး (မြို့သာ အလယ်ခေါင်)'
        width = 12.0
    elif highway == 'service':
        name = raw_name or f'မြို့သာ ရပ်ကွက်တွင်း လမ်းသွယ် ({r_idx+1})'
        width = 5.0
    else:
        name = raw_name or f'မြို့သာ ရပ်ကွက်လယ်လမ်း ({r_idx+1})'
        width = 6.5

    if ref == 'NH41':
        # Straight AH1 Asian Highway along u=0 connecting to Area 5 at v=-66.62
        # passing through Shwe Myanmar gap (between Rice Mill and Vacant Lot at v=-210..-250)
        # and continuing straight North through Myothar Center
        ah1_vs = [-66.62] + list(range(-100, -1450, -50))
        uv_points = [[0.0, float(v)] for v in ah1_vs]
        geo_points = [[
            round(kanbale_lon + (uv[0] - kanbale_u) / m_per_deg_lon, 7),
            round(kanbale_lat - (uv[1] - kanbale_v) / m_per_deg_lat, 7)
        ] for uv in uv_points]
        world_points = [list(uv_to_world(uv[0], uv[1])) for uv in uv_points]
    else:
        coords = r['geometry']['coordinates']
        uv_points = [list(geo_to_uv(pt[0], pt[1])) for pt in coords]
        for end_i in (0, -1):
            if abs(uv_points[end_i][0]) < 12.0:
                uv_points[end_i][0] = 0.0
        geo_points = [[
            round(kanbale_lon + (uv[0] - kanbale_u) / m_per_deg_lon, 7),
            round(kanbale_lat - (uv[1] - kanbale_v) / m_per_deg_lat, 7)
        ] for uv in uv_points]
        world_points = [list(uv_to_world(uv[0], uv[1])) for uv in uv_points]

    r_id = r.get('id') or props.get('id') or f'myothar-center-road-{r_idx+1}'
    roads.append({
        'id': r_id,
        'highway': highway,
        'ref': ref,
        'name': name,
        'width': width,
        'geoPoints': geo_points,
        'uvPoints': uv_points,
        'worldPoints': world_points
    })
    
    for i in range(len(world_points) - 1):
        road_segments.append((world_points[i], world_points[i+1], width))

print(f"Processed Roads: {len(roads)} (Segments: {len(road_segments)})")

def dist_point_to_segment(px, pz, p1, p2):
    x1, z1 = p1
    x2, z2 = p2
    dx = x2 - x1
    dz = z2 - z1
    l2 = dx*dx + dz*dz
    if l2 == 0:
        return math.hypot(px - x1, pz - z1), (x1, z1)
    t = max(0.0, min(1.0, ((px - x1)*dx + (pz - z1)*dz) / l2))
    return math.hypot(px - (x1 + t*dx), pz - (z1 + t*dz)), (x1 + t*dx, z1 + t*dz)

def closest_road_dir(cx, cz):
    min_dist = 1e9
    best_proj = (cx, cz)
    for p1, p2, _ in road_segments:
        d, proj = dist_point_to_segment(cx, cz, p1, p2)
        if d < min_dist:
            min_dist = d
            best_proj = proj
    vx = best_proj[0] - cx
    vz = best_proj[1] - cz
    # Yaw angle where local +Z points towards nearest road
    return min_dist, math.atan2(vx, vz)

# 3. Process Buildings
raw_buildings = [f for f in raw_features if f['geometry']['type'] == 'Polygon']
print(f"Raw building polygons: {len(raw_buildings)}")

# POI world coordinates
poi_world = [(p['x'], p['z'], p['id']) for p in pois]

raw_items = []
for b_idx, b in enumerate(raw_buildings):
    props = b['properties']
    osm_id_val = props.get('osm_id', 920000000 + b_idx)
    b_id = b.get('id') or props.get('id') or f'way/{osm_id_val}'
    osm_id = props.get('osm_id', 920000000 + b_idx)
    osm_type = props.get('osm_type', 'way')
    poly_coords = b['geometry']['coordinates'][0]

    world_pts = [list(geo_to_world(lon, lat)) for lon, lat in poly_coords]
    n = len(world_pts)
    cx = sum(p[0] for p in world_pts[:-1]) / (n - 1)
    cz = sum(p[1] for p in world_pts[:-1]) / (n - 1)
    
    # Polygon area (Shoelace)
    area = 0.0
    for i in range(n - 1):
        area += (world_pts[i][0] * world_pts[i+1][1] - world_pts[i+1][0] * world_pts[i][1])
    area = abs(area) / 2.0
    
    # Check if close to POI
    matched_poi = None
    for px, pz, pid in poi_world:
        if math.hypot(cx - px, cz - pz) < 14.0:
            matched_poi = pid
            break
            
    is_osm = 'id' in b or props.get('source') != 'generated'
    
    raw_items.append({
        'b_idx': b_idx,
        'b_id': str(b_id),
        'osm_id': int(osm_id) if str(osm_id).isdigit() else 0,
        'osm_type': str(osm_type),
        'name': props.get('name') or f'လူနေအိမ် {404 + b_idx}',
        'poly_coords': poly_coords,
        'world_pts': world_pts,
        'cx': cx,
        'cz': cz,
        'area': area,
        'matched_poi': matched_poi,
        'is_osm': is_osm
    })

# Deduplicate to separate tightly stuck polygons (min spacing 4.8m)
deduped_items = []
for item in raw_items:
    dup = False
    for d in deduped_items:
        dist = math.hypot(item['cx'] - d['cx'], item['cz'] - d['cz'])
        if dist < 4.8:
            dup = True
            # Prioritize landmark POI matching
            if item['matched_poi'] and not d['matched_poi']:
                deduped_items.remove(d)
                deduped_items.append(item)
            # Prioritize real OSM over generated
            elif item['is_osm'] and not d['is_osm'] and not d['matched_poi']:
                deduped_items.remove(d)
                deduped_items.append(item)
            break
    if not dup:
        deduped_items.append(item)

print(f"Deduped distinct compound lots: {len(deduped_items)}")

def inside_polygon(x, z, polygon):
    inside = False
    for a, b in zip(polygon, polygon[1:]):
        if (a[1] > z) != (b[1] > z):
            if x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]:
                inside = not inside
    return inside

def rectangle_corners(cx, cz, yaw, width, depth):
    c, s = math.cos(yaw), math.sin(yaw)
    return [(cx + x*c + z*s, cz - x*s + z*c)
            for x, z in [(-width/2, -depth/2), (width/2, -depth/2),
                         (width/2, depth/2), (-width/2, depth/2)]]

def rectangles_overlap(a, b, clearance=0.2):
    # Separating-axis test: retain a real gap between neighbouring fences.
    for poly in (a, b):
        for i in (0, 1):
            dx, dz = poly[i+1][0]-poly[i][0], poly[i+1][1]-poly[i][1]
            length = math.hypot(dx, dz)
            nx, nz = -dz/length, dx/length
            pa = [x*nx+z*nz for x, z in a]
            pb = [x*nx+z*nz for x, z in b]
            if max(pa)+clearance <= min(pb) or max(pb)+clearance <= min(pa):
                return False
    return True

road_rectangles = []
for a, b, width in road_segments:
    dx, dz = b[0]-a[0], b[1]-a[1]
    length = math.hypot(dx, dz)
    if length > 0.01:
        # Extra half-metre verge, including junction/end-cap clearance.
        road_rectangles.append(rectangle_corners((a[0]+b[0])/2, (a[1]+b[1])/2,
            math.atan2(dx, dz), width+1.0, length+width+1.0))

accepted_compounds = []
omitted_buildings = []
buildings = []
# Real surveyed features and POIs get first choice of their own footprint.
# Generated infill must adapt to them, never displace them.
deduped_items.sort(key=lambda item: (not bool(item['matched_poi']), not item['is_osm'], -item['area']))
for out_idx, item in enumerate(deduped_items):
    world_pts = item['world_pts']
    cx = item['cx']
    cz = item['cz']
    area = item['area']
    
    # Road orientation: face towards nearest road
    dist_road, yaw = closest_road_dir(cx, cz)
    
    # Project vertices to local compound frame
    cosY = math.cos(yaw)
    sinY = math.sin(yaw)
    lxs = []
    lzs = []
    for pt in world_pts[:-1]:
        dx = pt[0] - cx
        dz = pt[1] - cz
        lx = dx * cosY - dz * sinY
        lz = dx * sinY + dz * cosY
        lxs.append(lx)
        lzs.append(lz)
        
    span_x = max(lxs) - min(lxs) if lxs else 10.0
    span_z = max(lzs) - min(lzs) if lzs else 12.0
    center_lx = (min(lxs) + max(lxs)) / 2.0 if lxs else 0.0
    center_lz = (min(lzs) + max(lzs)) / 2.0 if lzs else 0.0
    
    # Refined compound center in world space
    comp_cx = cx + center_lx * cosY + center_lz * sinY
    comp_cz = cz - center_lx * sinY + center_lz * cosY
    
    # Compound bounds (ခြံဝန်း အတိုင်းအတာများ)
    # Give clean setback from parcel boundary
    comp_w = min(span_x - 0.6, 15.0)
    comp_d = min(span_z - 0.6, 17.0)
    # An imported polygon is not permission to invent a larger parcel. Keep
    # all fences, house eaves and porches inside it and outside road ribbons.
    fitted = False
    for _ in range(50):
        if comp_w < 3.0 or comp_d < 4.0:
            break
        corners = rectangle_corners(comp_cx, comp_cz, yaw, comp_w, comp_d)
        # Edge midpoint checks also catch most concave footprint notches.
        probes = corners + [((corners[i][0]+corners[(i+1)%4][0])/2,
                              (corners[i][1]+corners[(i+1)%4][1])/2) for i in range(4)]
        if (all(inside_polygon(x, z, world_pts) for x, z in probes)
                and not any(rectangles_overlap(corners, road, 0) for road in road_rectangles)
                and not any(rectangles_overlap(corners, other) for other in accepted_compounds)):
            fitted = True
            accepted_compounds.append(corners)
            break
        comp_w *= 0.94
        comp_d *= 0.94
    if not fitted:
        omitted_buildings.append(item['b_id'])
        continue
    
    side_half = round(comp_w / 2.0, 2)
    back_half = round(comp_d / 2.0, 2)
    front_half = round(comp_d / 2.0, 2)
    gate_w = min(2.4, round(comp_w * 0.5, 2))
    
    # House dimensions inside compound (leaving at least 1.1m side yards and 1.2m rear, 2.5m front yard)
    house_w = min(comp_w - 1.2, 5.6)
    house_d = min(comp_d - 2.0, 6.8)
    
    # House local offset inside compound (shifted to rear to leave welcoming front yard)
    house_z_offset = -0.4
    
    # Height & floors
    is_two_storey = area >= 70.0
    wall_h = 5.8 if is_two_storey else 3.2
    roof_h = 2.0 if is_two_storey else 1.6
    total_h = wall_h + roof_h
    
    # Colors
    wall_color = wall_colors[out_idx % len(wall_colors)]
    roof_color = roof_colors[(out_idx * 3) % len(roof_colors)]
    fence_color = fence_colors[out_idx % len(fence_colors)]
    
    # Geo / UV centroid
    cu = comp_cx * cosA - comp_cz * sinA
    cv = comp_cx * sinA + comp_cz * cosA
    clon = kanbale_lon + (cu - kanbale_u) / m_per_deg_lon
    clat = kanbale_lat - (cv - kanbale_v) / m_per_deg_lat
    
    # Relative polygon points
    rel_pts = [[round(p[0] - comp_cx, 3), round(p[1] - comp_cz, 3)] for p in world_pts]
    round_world_pts = [[round(p[0], 3), round(p[1], 3)] for p in world_pts]

    buildings.append({
        'id': item['b_id'],
        'osmId': item['osm_id'],
        'osmType': item['osm_type'],
        'name': item['name'],
        'lon': round(clon, 7),
        'lat': round(clat, 7),
        'u': round(cu, 2),
        'v': round(cv, 2),
        'x': round(comp_cx, 2),
        'z': round(comp_cz, 2),
        'width': round(comp_w, 2),
        'depth': round(comp_d, 2),
        'height': round(total_h, 2),
        'area': round(area, 1),
        'wallColor': wall_color,
        'roofColor': roof_color,
        'rotation': round(yaw, 3),
        'houseWidth': round(house_w, 2),
        'houseLength': round(house_d, 2),
        'houseZOffset': house_z_offset,
        'wallHeight': round(wall_h, 2),
        'roofHeight': round(roof_h, 2),
        'compoundWidth': round(comp_w, 2),
        'compoundDepth': round(comp_d, 2),
        'fenceSideHalf': side_half,
        'fenceBackHalf': back_half,
        'fenceFrontHalf': front_half,
        'gateWidth': gate_w,
        'fenceColor': fence_color,
        'polygonPoints': round_world_pts,
        'relativePoints': rel_pts
    })

print(f"Generated {len(buildings)} compounds and separated houses.")
print(f"Omitted {len(omitted_buildings)} unusable/overlapping polygons; source GeoJSON is unchanged.")

# Link POIs to closest building
for p in pois:
    closest_b = min(buildings, key=lambda b: math.hypot(b['x'] - p['x'], b['z'] - p['z']))
    p['buildingId'] = closest_b['id']
    closest_b['landmarkName'] = p['name']
    closest_b['isLandmark'] = True
    closest_b['landmarkKind'] = p['kind']
    print(f"Linked Landmark: {p['name']} -> Building {closest_b['id']} ({closest_b['name']})")

out_dir = os.path.abspath('src/data/wards/myothar/center')
os.makedirs(out_dir, exist_ok=True)

# 1. myotharCenterData.ts
bounds_x = [b['x'] for b in buildings]
bounds_z = [b['z'] for b in buildings]
bounds_u = [b['u'] for b in buildings]
bounds_v = [b['v'] for b in buildings]

data_ts = f"""import {{ angle }} from '../area5.ts';

/**
 * မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇ အထိ)
 * Myothar Ward Center (Areas 1 to 7) · Kalay Township
 *
 * တည်နေရာ:
 * - မြို့သာရပ်ကွက် နယ်မြေ (၅) ၏ ရွှေမြန်မာ စက်သုံးဆီဆိုင် တောင်ဘက်
 * - ကံပုလဲရွာ ၏ အနောက်ဘက်ခြမ်းတွင် ဆက်စပ်တည်ရှိသော မြို့သာရပ်ကွက် အလယ်ခေါင်
 *
 * OpenStreetMap (OSM) စစ်စစ် ဒေတာများ:
 * - အဆောက်အအုံနှင့် ခြံဝန်းပေါင်း {len(buildings)} ခု (Area 5 Style Compound Fences & Footprints)
 * - လမ်းကွန်ရက် {len(roads)} ခု (AH1 အာရှလမ်းမကြီးနှင့် ရပ်ကွက်တွင်းလမ်းများ)
 * - အဓိက အထင်ကရနေရာ {len(pois)} ခု (ကျောင်းတိုက်၊ စက်သုံးဆီဆိုင်များ၊ စားသောက်ဆိုင်၊ ဝပ်ရှော့၊ အရောင်းဆိုင်များ)
 */

export const MYOTHAR_CENTER_GEO_ORIGIN = {{
  lon: {kanbale_lon},
  lat: {kanbale_lat},
}};

export const MYOTHAR_CENTER_LOCAL_ANCHOR = {{
  u: {kanbale_u},
  v: {kanbale_v},
}};

export const METERS_PER_DEG_LAT = {m_per_deg_lat};
export const METERS_PER_DEG_LON = {round(m_per_deg_lon, 2)};

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

/**
 * GeoJSON (lon, lat) သြဒိနိတ်မှ Local (u, v) သို့ ပြောင်းလဲခြင်း
 */
export function geoToLocalUV(lon: number, lat: number): {{ u: number; v: number }} {{
  return {{
    u: MYOTHAR_CENTER_LOCAL_ANCHOR.u + (lon - MYOTHAR_CENTER_GEO_ORIGIN.lon) * METERS_PER_DEG_LON,
    v: MYOTHAR_CENTER_LOCAL_ANCHOR.v - (lat - MYOTHAR_CENTER_GEO_ORIGIN.lat) * METERS_PER_DEG_LAT,
  }};
}}

/**
 * Local (u, v) မှ GeoJSON (lon, lat) သို့ ပြောင်းလဲခြင်း
 */
export function localUVToGeo(u: number, v: number): {{ lon: number; lat: number }} {{
  return {{
    lon: MYOTHAR_CENTER_GEO_ORIGIN.lon + (u - MYOTHAR_CENTER_LOCAL_ANCHOR.u) / METERS_PER_DEG_LON,
    lat: MYOTHAR_CENTER_GEO_ORIGIN.lat - (v - MYOTHAR_CENTER_LOCAL_ANCHOR.v) / METERS_PER_DEG_LAT,
  }};
}}

/**
 * Local (u, v) မှ World (x, z) သို့ ပြောင်းလဲခြင်း
 */
export function toWorld(u: number, v: number): {{ x: number; z: number }} {{
  return {{
    x: u * cosA + v * sinA,
    z: -u * sinA + v * cosA,
  }};
}}

/**
 * World (x, z) မှ Local (u, v) သို့ ပြောင်းလဲခြင်း
 */
export function toLocalUV(x: number, z: number): {{ u: number; v: number }} {{
  return {{
    u: x * cosA - z * sinA,
    v: x * sinA + z * cosA,
  }};
}}

/**
 * GeoJSON (lon, lat) မှ World (x, z) သို့ တိုက်ရိုက်ပြောင်းလဲခြင်း
 */
export function geoToWorld(lon: number, lat: number): {{ x: number; z: number }} {{
  const {{ u, v }} = geoToLocalUV(lon, lat);
  return toWorld(u, v);
}}

/**
 * World (x, z) မှ GeoJSON (lon, lat) သို့ ပြောင်းလဲခြင်း
 */
export function worldToGeo(x: number, z: number): {{ lon: number; lat: number }} {{
  const {{ u, v }} = toLocalUV(x, z);
  return localUVToGeo(u, v);
}}

export const myotharCenterMeta = {{
  id: 'myothar-center',
  name: 'မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇)',
  shortName: 'မြို့သာ အလယ်ခေါင်',
  englishName: 'Myothar Ward Center (Areas 1-7)',
  township: 'ကလေးမြို့နယ်',
  region: 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  description: 'ကလေးမြို့နယ်၊ မြို့သာရပ်ကွက် နယ်မြေ (၅) ရွှေမြန်မာစက်သုံးဆီဆိုင် တောင်ဘက်နှင့် ကံပုလဲရွာ အနောက်ဘက်ခြမ်းတွင် ဆက်စပ်တည်ရှိသော မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇ အထိ) ခြံဝန်းနှင့် အဆောက်အအုံ {len(buildings)} လုံးနှင့် လမ်းကွန်ရက်',
  coordinates: {{ lat: 23.168500, lng: 94.068471 }},
  spawn: toWorld(0.0, -740.0),
  bounds: {{
    minU: {round(min(bounds_u), 1)},
    maxU: {round(max(bounds_u), 1)},
    minV: {round(min(bounds_v), 1)},
    maxV: {round(max(bounds_v), 1)},
    minX: {round(min(bounds_x), 1)},
    maxX: {round(max(bounds_x), 1)},
    minZ: {round(min(bounds_z), 1)},
    maxZ: {round(max(bounds_z), 1)},
  }},
}};
"""

with open(os.path.join(out_dir, 'myotharCenterData.ts'), 'w', encoding='utf-8') as f:
    f.write(data_ts)
print("Updated myotharCenterData.ts")

# 2. myotharCenterPOIs.ts
pois_ts = f"""export interface MyotharCenterPOI {{
  id: string;
  name: string;
  kind: string;
  lon: number;
  lat: number;
  u: number;
  v: number;
  x: number;
  z: number;
  buildingId: string;
}}

export const myotharCenterPOIs: MyotharCenterPOI[] = {json.dumps(pois, ensure_ascii=False, indent=2)};
"""

with open(os.path.join(out_dir, 'myotharCenterPOIs.ts'), 'w', encoding='utf-8') as f:
    f.write(pois_ts)
print("Updated myotharCenterPOIs.ts")

# 3. myotharCenterRoads.ts
roads_ts = f"""export interface MyotharCenterRoad {{
  id: string;
  highway: string;
  ref: string;
  name: string;
  width: number;
  geoPoints: [number, number][];
  uvPoints: [number, number][];
  worldPoints: [number, number][];
}}

export const myotharCenterRoads: MyotharCenterRoad[] = {json.dumps(roads, ensure_ascii=False, indent=2)};
"""

with open(os.path.join(out_dir, 'myotharCenterRoads.ts'), 'w', encoding='utf-8') as f:
    f.write(roads_ts)
print("Updated myotharCenterRoads.ts")

# 4. myotharCenterBuildings.ts
buildings_ts = f"""export interface MyotharCenterBuildingData {{
  id: string;
  osmId: number;
  osmType: string;
  name: string;
  lon: number;
  lat: number;
  u: number;
  v: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  area: number;
  wallColor: string;
  roofColor: string;
  rotation: number;
  houseLength: number;
  houseWidth: number;
  houseZOffset: number;
  wallHeight: number;
  roofHeight: number;
  compoundWidth: number;
  compoundDepth: number;
  fenceSideHalf: number;
  fenceBackHalf: number;
  fenceFrontHalf: number;
  gateWidth: number;
  fenceColor: string;
  polygonPoints: [number, number][];
  relativePoints: [number, number][];
  landmarkName?: string;
  isLandmark?: boolean;
  landmarkKind?: string;
}}

export const myotharCenterBuildings: MyotharCenterBuildingData[] = {json.dumps(buildings, ensure_ascii=False, indent=2)};
"""

with open(os.path.join(out_dir, 'myotharCenterBuildings.ts'), 'w', encoding='utf-8') as f:
    f.write(buildings_ts)
print("Updated myotharCenterBuildings.ts")

print("All Myothar Center data generated successfully!")
