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

def world_to_uv(x, z):
    u = x * cosA - z * sinA
    v = x * sinA + z * cosA
    return round(u, 2), round(v, 2)

def geo_to_world(lon, lat):
    u, v = geo_to_uv(lon, lat)
    return uv_to_world(u, v)

# Palette definitions
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
    '#2563a6', # Blue Galvanized Sheet
    '#2e6b52', # Sage Green Sheet
    '#627d85', # Classic Zinc Sheet
    '#6d4c41'  # Teak wood fence
]

# Load boundary GeoJSON
with open('map/kalay-area-1-boundary.geojson', 'r', encoding='utf-8') as f:
    boundary_geojson = json.load(f)

b_coords = boundary_geojson['features'][0]['geometry']['coordinates'][0]
boundary_uv_points = [list(geo_to_uv(p[0], p[1])) for p in b_coords]
boundary_world_points = [list(uv_to_world(p[0], p[1])) for p in boundary_uv_points]

b_us = [p[0] for p in boundary_uv_points]
b_vs = [p[1] for p in boundary_uv_points]
b_xs = [p[0] for p in boundary_world_points]
b_zs = [p[1] for p in boundary_world_points]

# Nan Ka Lein Creek definition
nankalein_uv_points = [
    [-650.0, -1182.0],
    [-450.0, -1180.0],
    [-300.0, -1178.0],
    [-150.0, -1176.0],
    [-50.0,  -1175.0],
    [0.0,    -1175.0], # AH1 Bridge Center
    [60.0,   -1174.0],
    [160.0,  -1173.0],
    [300.0,  -1171.0],
    [450.0,  -1169.0]
]
nankalein_world_points = [list(uv_to_world(p[0], p[1])) for p in nankalein_uv_points]

def dist_point_to_polyline(px, py, poly):
    min_d = 1e9
    for i in range(len(poly) - 1):
        x1, y1 = poly[i]
        x2, y2 = poly[i+1]
        dx, dy = x2 - x1, y2 - y1
        l2 = dx*dx + dy*dy
        if l2 == 0:
            d = math.hypot(px - x1, py - y1)
        else:
            t = max(0.0, min(1.0, ((px - x1)*dx + (py - y1)*dy) / l2))
            d = math.hypot(px - (x1 + t*dx), py - (y1 + t*dy))
        if d < min_d:
            min_d = d
    return min_d

# Load OSM features
with open('map/kalay-area-1-osm.geojson', 'r', encoding='utf-8') as f:
    osm_data = json.load(f)

raw_features = osm_data['features']

# Process Roads
raw_lines = [f for f in raw_features if f['geometry']['type'] == 'LineString']
roads = []
road_segments = []

# 1. Main AH1 / NH41 Asian Highway corridor along u=0 continuing through Area 1
# Width = 12m. We will reserve a total corridor of 22m (u from -11 to +11) so no house reaches onto AH1.
ah1_vs = [-1148.0] + list(range(-1150, -1520, -25))
ah1_uv_points = [[0.0, float(v)] for v in ah1_vs]
ah1_world_points = [list(uv_to_world(uv[0], uv[1])) for uv in ah1_uv_points]

roads.append({
    'id': 'kalay-area-1-ah1',
    'highway': 'trunk',
    'ref': 'NH41',
    'name': 'AH1 / NH41 အာရှလမ်းမကြီး (ကလေးမြို့ နယ်မြေ ၁)',
    'width': 12.0,
    'uvPoints': ah1_uv_points,
    'worldPoints': ah1_world_points
})
for i in range(len(ah1_world_points) - 1):
    road_segments.append((ah1_world_points[i], ah1_world_points[i+1], 12.0, True))

# 2. Process internal roads from OSM
for r_idx, r in enumerate(raw_lines):
    props = r.get('properties', {})
    ref = props.get('ref')
    if ref == 'NH41':
        continue

    hw = props.get('highway', 'residential')
    raw_name = props.get('name')
    coords = r['geometry']['coordinates']
    uv_points = [list(geo_to_uv(pt[0], pt[1])) for pt in coords]

    for end_i in (0, -1):
        if abs(uv_points[end_i][0]) < 14.0:
            uv_points[end_i][0] = 0.0

    world_points = [list(uv_to_world(uv[0], uv[1])) for uv in uv_points]
    width = 5.0 if hw == 'service' else 6.5
    r_name = raw_name or (f'နယ်မြေ (၁) လမ်းသွယ် ({r_idx})' if hw == 'service' else f'နယ်မြေ (၁) ရပ်ကွက်လမ်း ({r_idx})')

    roads.append({
        'id': f'kalay-area-1-road-{r_idx}',
        'highway': hw,
        'ref': ref or '',
        'name': r_name,
        'width': width,
        'uvPoints': uv_points,
        'worldPoints': world_points
    })
    for i in range(len(world_points) - 1):
        road_segments.append((world_points[i], world_points[i+1], width, False))

print(f"Total Roads processed: {len(roads)} (segments: {len(road_segments)})")

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
    for p1, p2, _, _ in road_segments:
        d, proj = dist_point_to_segment(cx, cz, p1, p2)
        if d < min_dist:
            min_dist = d
            best_proj = proj
    vx = best_proj[0] - cx
    vz = best_proj[1] - cz
    return min_dist, math.atan2(vx, vz), best_proj

def rectangle_corners(cx, cz, yaw, width, depth):
    c, s = math.cos(yaw), math.sin(yaw)
    return [(cx + x*c + z*s, cz - x*s + z*c)
            for x, z in [(-width/2, -depth/2), (width/2, -depth/2),
                         (width/2, depth/2), (-width/2, depth/2)]]

def rectangles_overlap(a, b, clearance=0.4):
    for poly in (a, b):
        for i in range(len(poly)):
            next_i = (i + 1) % len(poly)
            dx = poly[next_i][0] - poly[i][0]
            dz = poly[next_i][1] - poly[i][1]
            length = math.hypot(dx, dz)
            if length == 0:
                continue
            nx, nz = -dz / length, dx / length
            pa = [x*nx + z*nz for x, z in a]
            pb = [x*nx + z*nz for x, z in b]
            if max(pa) + clearance <= min(pb) or max(pb) + clearance <= min(pa):
                return False
    return True

# Build road bounding boxes (verge + buffer)
road_rectangles = []
for p1, p2, width, is_ah1 in road_segments:
    dx = p2[0] - p1[0]
    dz = p2[1] - p1[1]
    length = math.hypot(dx, dz)
    if length > 0.01:
        # For AH1, 12m width + 9m clearance (buffer 21m total width)
        # For side roads, width + 2.4m clearance
        buffer_width = (width + 9.0) if is_ah1 else (width + 2.4)
        mx = (p1[0] + p2[0]) / 2
        mz = (p1[1] + p2[1]) / 2
        yaw = math.atan2(dx, dz)
        road_rectangles.append(rectangle_corners(mx, mz, yaw, buffer_width, length + buffer_width * 0.4))

# Read existing Myothar Center buildings to avoid duplication
with open('src/data/wards/myothar/center/myotharCenterBuildings.ts', 'r', encoding='utf-8') as f:
    import re
    mc_content = f.read()
b_texts = re.findall(r'\{\s*"id":\s*"([^"]+)",\s*"osmId":\s*(\d+).*?"u":\s*(-?[\d.]+),\s*"v":\s*(-?[\d.]+)', mc_content, re.DOTALL)
myothar_b = [(m[0], int(m[1]), float(m[2]), float(m[3])) for m in b_texts]

# Process Raw Building Polygons
raw_buildings = [f for f in raw_features if f['geometry']['type'] == 'Polygon']
print(f"Raw Area 1 building polygons: {len(raw_buildings)}")

raw_items = []
for b_idx, b in enumerate(raw_buildings):
    props = b.get('properties', {})
    osm_id = props.get('osm_id', 930000000 + b_idx)
    b_id = b.get('id') or f'way/{osm_id}'
    poly_coords = b['geometry']['coordinates'][0]

    uv_pts = [list(geo_to_uv(lon, lat)) for lon, lat in poly_coords]
    world_pts = [list(uv_to_world(u, v)) for u, v in uv_pts]
    n = len(world_pts)
    cx = sum(p[0] for p in world_pts[:-1]) / (n - 1)
    cz = sum(p[1] for p in world_pts[:-1]) / (n - 1)
    cu = sum(p[0] for p in uv_pts[:-1]) / (n - 1)
    cv = sum(p[1] for p in uv_pts[:-1]) / (n - 1)

    # 1. Skip if duplicates an existing building in Myothar Center (< 6m)
    if any(math.hypot(cu - mb[2], cv - mb[3]) < 6.0 for mb in myothar_b):
        continue

    # 2. Skip if inside Nankalein creek bed channel (< 13m from creek center)
    if dist_point_to_polyline(cu, cv, nankalein_uv_points) < 13.0:
        continue

    # 3. Polygon area
    area = 0.0
    for i in range(n - 1):
        area += (world_pts[i][0] * world_pts[i+1][1] - world_pts[i+1][0] * world_pts[i][1])
    area = abs(area) / 2.0

    name = props.get('name') or f'လူနေအိမ် {b_idx + 1}'
    is_real_osm = props.get('source') != 'generated' and int(osm_id) < 900000000

    raw_items.append({
        'b_idx': b_idx,
        'b_id': str(b_id),
        'osm_id': int(osm_id) if str(osm_id).isdigit() else 930000000 + b_idx,
        'osm_type': props.get('osm_type', 'way'),
        'name': name,
        'lon': sum(p[0] for p in poly_coords[:-1]) / (n - 1),
        'lat': sum(p[1] for p in poly_coords[:-1]) / (n - 1),
        'u': round(cu, 2),
        'v': round(cv, 2),
        'cx': round(cx, 2),
        'cz': round(cz, 2),
        'world_pts': world_pts,
        'area': area,
        'is_real_osm': is_real_osm
    })

print(f"Candidates after basic filtering: {len(raw_items)}")

# Prioritize real surveyed OSM buildings, then largest area
raw_items.sort(key=lambda item: (not item['is_real_osm'], -item['area']))

accepted_compounds = [] # list of rectangle corners
accepted_buildings = []

for idx, item in enumerate(raw_items):
    cx = item['cx']
    cz = item['cz']
    cu = item['u']
    cv = item['v']
    world_pts = item['world_pts']

    # --- AH1 Main Highway Clearance Enforcement ---
    # AH1 is at u = 0.0. Reserve corridor |u| < 10.5m.
    if abs(cu) < 10.5:
        # If directly in center (|u| < 3m), skip to prevent sitting right in the road
        if abs(cu) < 3.0:
            continue
        # Nudge outward so compound fence stays outside AH1 highway corridor
        u_sign = 1.0 if cu >= 0 else -1.0
        shift_u = (11.5 * u_sign) - cu
        cu = 11.5 * u_sign
        # recalculate world cx, cz
        cx, cz = uv_to_world(cu, cv)

    # Road orientation: face toward nearest road
    dist_road, yaw, best_proj = closest_road_dir(cx, cz)

    # Project vertices to local compound frame
    cosY = math.cos(yaw)
    sinY = math.sin(yaw)
    lxs, lzs = [], []
    for pt in world_pts[:-1]:
        dx = pt[0] - cx
        dz = pt[1] - cz
        lx = dx * cosY - dz * sinY
        lz = dx * sinY + dz * cosY
        lxs.append(lx)
        lzs.append(lz)

    span_x = max(lxs) - min(lxs) if lxs else 9.0
    span_z = max(lzs) - min(lzs) if lzs else 11.0

    # Initial compound dimensions (clean realistic Myanmar town parcel: 10m-14m wide, 11m-16m deep)
    comp_w = max(8.0, min(14.0, span_x * 0.9))
    comp_d = max(9.0, min(15.0, span_z * 0.9))

    # --- Road Nudging Algorithm (အိမ်ကို နောက်ဆုတ်တာ/ရှေ့တိုးတာ) ---
    # If the compound is closer than comp_d/2 + 2.0 to the nearest road, nudge away from road
    min_safe_road_dist = comp_d / 2.0 + 1.8
    if dist_road < min_safe_road_dist:
        push_dist = min_safe_road_dist - dist_road
        # Vector pointing away from road projection
        away_dx = cx - best_proj[0]
        away_dz = cz - best_proj[1]
        away_len = math.hypot(away_dx, away_dz)
        if away_len > 0.01:
            cx += (away_dx / away_len) * push_dist
            cz += (away_dz / away_len) * push_dist
            cu, cv = world_to_uv(cx, cz)
            # Re-verify AH1 corridor
            if abs(cu) < 10.5:
                cu = 11.5 * (1.0 if cu >= 0 else -1.0)
                cx, cz = uv_to_world(cu, cv)

    # --- Separating Axis Theorem (SAT) Overlap & Road Clearance Fitting ---
    fitted = False
    for attempt in range(12):
        if comp_w < 6.5 or comp_d < 7.5:
            break
        corners = rectangle_corners(cx, cz, yaw, comp_w, comp_d)

        # Check overlap with all accepted neighbor compounds (clearance = 0.8m)
        overlaps_compound = any(rectangles_overlap(corners, other, clearance=0.8) for other in accepted_compounds)

        # Check overlap with all roads (clearance = 0.2m)
        overlaps_road = any(rectangles_overlap(corners, road, clearance=0.2) for road in road_rectangles)

        if not overlaps_compound and not overlaps_road:
            fitted = True
            accepted_compounds.append(corners)
            break

        # If overlapping road, nudge away from nearest road
        if overlaps_road:
            dist_r, _, b_proj = closest_road_dir(cx, cz)
            away_dx = cx - b_proj[0]
            away_dz = cz - b_proj[1]
            away_len = math.hypot(away_dx, away_dz)
            if away_len > 0.01:
                cx += (away_dx / away_len) * 0.8
                cz += (away_dz / away_len) * 0.8
                cu, cv = world_to_uv(cx, cz)

        # Progressively shrink compound dimensions to achieve a clean fit
        comp_w *= 0.94
        comp_d *= 0.94

    if not fitted:
        # If still cannot fit without overlapping neighbors or roads, skip to preserve spaciousness
        continue

    # Clean house sizing within the fitted compound
    side_half = round(comp_w / 2.0, 2)
    back_half = round(comp_d / 2.0, 2)
    front_half = round(comp_d / 2.0, 2)
    gate_w = min(2.8, round(comp_w * 0.45, 2))

    house_w = min(comp_w - 1.4, 5.6)
    house_l = min(comp_d - 2.2, 6.8)
    h_height = 4.2 + (len(accepted_buildings) % 4) * 0.35
    wall_h = 2.8 + (len(accepted_buildings) % 3) * 0.25
    roof_h = h_height - wall_h

    w_color = wall_colors[len(accepted_buildings) % len(wall_colors)]
    r_color = roof_colors[(len(accepted_buildings) * 7) % len(roof_colors)]
    f_color = fence_colors[(len(accepted_buildings) * 3) % len(fence_colors)]

    rel_pts = []
    for lx, lz in zip(lxs, lzs):
        rel_pts.append([round(lx, 2), round(lz, 2)])

    accepted_buildings.append({
        'id': f'kalay-area-1-bld-{len(accepted_buildings)+1}',
        'osmId': item['osm_id'],
        'osmType': item['osm_type'],
        'name': item['name'],
        'lon': round(item['lon'], 7),
        'lat': round(item['lat'], 7),
        'u': round(cu, 2),
        'v': round(cv, 2),
        'x': round(cx, 2),
        'z': round(cz, 2),
        'width': round(house_w, 2),
        'depth': round(house_l, 2),
        'height': round(h_height, 2),
        'area': round(item['area'], 1),
        'wallColor': w_color,
        'roofColor': r_color,
        'rotation': round(yaw, 4),
        'houseLength': round(house_l, 2),
        'houseWidth': round(house_w, 2),
        'houseZOffset': -0.4,
        'wallHeight': round(wall_h, 2),
        'roofHeight': round(roof_h, 2),
        'compoundWidth': round(comp_w, 2),
        'compoundDepth': round(comp_d, 2),
        'fenceSideHalf': round(side_half, 2),
        'fenceBackHalf': round(back_half, 2),
        'fenceFrontHalf': round(front_half, 2),
        'gateWidth': round(gate_w, 2),
        'fenceColor': f_color,
        'polygonPoints': [[round(p[0], 2), round(p[1], 2)] for p in world_pts],
        'relativePoints': rel_pts
    })

print(f"Accepted non-overlapping, road-clear buildings: {len(accepted_buildings)}")

# Generate TypeScript code
out_dir = 'src/data/wards/kalayArea1'
os.makedirs(out_dir, exist_ok=True)

# 1. kalayArea1Data.ts
data_ts = f"""import {{ toWorld }} from '../myothar/area5.ts';

export interface KalayArea1Road {{
  id: string;
  highway: string;
  ref: string;
  name: string;
  width: number;
  uvPoints: [number, number][];
  worldPoints: [number, number][];
}}

export const kalayArea1Meta = {{
  id: 'kalay-area-1',
  name: 'ကလေးမြို့ နယ်မြေ (၁)',
  shortName: 'နယ်မြေ (၁)',
  englishName: 'Kalay Myo Area 1',
  township: 'ကလေးမြို့နယ်',
  region: 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  description: 'ကလေးမြို့ နယ်မြေ (၁) — မြို့သာရပ်ကွက် အလယ် မြောက်ဘက်၊ နန်းကလိန်ချောင်းနှင့် တံတားကြီးဘေးရှိ လူနေရပ်ကွက်နှင့် AH1 အာရှလမ်းမကြီး',
  coordinates: {{ lat: 23.1735, lng: 94.0665 }},
  spawn: toWorld(0.0, -1250.0),
  bounds: {{
    minU: {min(b_us):.1f},
    maxU: {max(b_us):.1f},
    minV: {min(b_vs):.1f},
    maxV: {max(b_vs):.1f},
    minX: {min(b_xs):.1f},
    maxX: {max(b_xs):.1f},
    minZ: {min(b_zs):.1f},
    maxZ: {max(b_zs):.1f},
  }},
}};

/**
 * နန်းကလိန်ချောင်း (Nankalein Creek)
 * မြို့သာရပ်ကွက် အလယ် နှင့် ကလေးမြို့ နယ်မြေ (၁) ကြားတွင်
 * AH1 မိန်းလမ်းမကြီးကို ကန့်လန့်ဖြတ် စီးဆင်းသော ချောင်းကြီး
 */
export const nankaleinCreek = {{
  id: 'nankalein-chaung',
  name: 'နန်းကလိန်ချောင်း',
  englishName: 'Nankalein Creek',
  waterWidth: 18.0,
  trenchWidth: 26.0,
  waterDepth: 1.6,
  waterY: 0.08,
  trenchBottomY: -1.2,
  uvPoints: {json.dumps(nankalein_uv_points, indent=2)},
  worldPoints: {json.dumps(nankalein_world_points, indent=2)},
}};

/**
 * နန်းကလိန်ချောင်း တံတားကြီး (Nankalein Big Bridge)
 * AH1 အာရှလမ်းမကြီး ပေါ်တွင် နန်းကလိန်ချောင်းကို ဖြတ်သန်းထားသော ကွန်ကရစ် တံတားကြီး
 */
export const nankaleinBridge = {{
  id: 'nankalein-bridge',
  name: 'နန်းကလိန်ချောင်း တံတားကြီး',
  englishName: 'Nankalein Bridge (AH1)',
  u: 0.0,
  v: -1175.0,
  x: toWorld(0.0, -1175.0).x,
  z: toWorld(0.0, -1175.0).z,
  length: 34.0,  // v direction (from -1158 to -1192)
  width: 15.0,   // u direction (12m roadway + 2x 1.5m pedestrian sidewalks)
  roadWidth: 12.0,
  walkwayWidth: 1.5,
  deckY: 0.28,
  curbY: 0.38,
  railingY: 0.95,
  rotation: Math.PI / 4,
}};

export const kalayArea1Boundary = {{
  uvPoints: {json.dumps(boundary_uv_points, indent=2)},
  worldPoints: {json.dumps(boundary_world_points, indent=2)},
}};

export const kalayArea1Roads: KalayArea1Road[] = {json.dumps(roads, indent=2)};

export const kalayArea1Trees = [
  {{ id: 'a1-t1', x: toWorld(-12, -1190).x, z: toWorld(-12, -1190).z, radius: 4 }},
  {{ id: 'a1-t2', x: toWorld(14, -1190).x, z: toWorld(14, -1190).z, radius: 4 }},
  {{ id: 'a1-t3', x: toWorld(-14, -1220).x, z: toWorld(-14, -1220).z, radius: 4.5 }},
  {{ id: 'a1-t4', x: toWorld(15, -1220).x, z: toWorld(15, -1220).z, radius: 4.5 }},
  {{ id: 'a1-t5', x: toWorld(-15, -1260).x, z: toWorld(-15, -1260).z, radius: 4 }},
  {{ id: 'a1-t6', x: toWorld(15, -1260).x, z: toWorld(15, -1260).z, radius: 4 }},
  {{ id: 'a1-t7', x: toWorld(-15, -1300).x, z: toWorld(-15, -1300).z, radius: 4.5 }},
  {{ id: 'a1-t8', x: toWorld(15, -1300).x, z: toWorld(15, -1300).z, radius: 4.5 }},
  {{ id: 'a1-t9', x: toWorld(-14, -1350).x, z: toWorld(-14, -1350).z, radius: 4 }},
  {{ id: 'a1-t10', x: toWorld(14, -1350).x, z: toWorld(14, -1350).z, radius: 4 }},
  {{ id: 'a1-t11', x: toWorld(-14, -1400).x, z: toWorld(-14, -1400).z, radius: 4.5 }},
  {{ id: 'a1-t12', x: toWorld(14, -1400).x, z: toWorld(14, -1400).z, radius: 4.5 }},
  {{ id: 'a1-t13', x: toWorld(-15, -1450).x, z: toWorld(-15, -1450).z, radius: 4 }},
  {{ id: 'a1-t14', x: toWorld(15, -1450).x, z: toWorld(15, -1450).z, radius: 4 }},
  // Riverbank trees along Nankalein creek
  {{ id: 'a1-cr-1', x: toWorld(-40, -1186).x, z: toWorld(-40, -1186).z, radius: 5 }},
  {{ id: 'a1-cr-2', x: toWorld(-80, -1188).x, z: toWorld(-80, -1188).z, radius: 5.5 }},
  {{ id: 'a1-cr-3', x: toWorld(-150, -1189).x, z: toWorld(-150, -1189).z, radius: 5 }},
  {{ id: 'a1-cr-4', x: toWorld(40, -1164).x, z: toWorld(40, -1164).z, radius: 5 }},
  {{ id: 'a1-cr-5', x: toWorld(90, -1163).x, z: toWorld(90, -1163).z, radius: 5.5 }},
  {{ id: 'a1-cr-6', x: toWorld(180, -1162).x, z: toWorld(180, -1162).z, radius: 5 }},
];
"""

with open(os.path.join(out_dir, 'kalayArea1Data.ts'), 'w', encoding='utf-8') as f:
    f.write(data_ts)
print("Wrote kalayArea1Data.ts")

# 2. kalayArea1Buildings.ts
bld_ts = f"""export interface KalayArea1BuildingData {{
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
}}

export const kalayArea1Buildings: KalayArea1BuildingData[] = {json.dumps(accepted_buildings, indent=2)};
"""

with open(os.path.join(out_dir, 'kalayArea1Buildings.ts'), 'w', encoding='utf-8') as f:
    f.write(bld_ts)
print("Wrote kalayArea1Buildings.ts")

# 3. index.ts
idx_ts = """export * from './kalayArea1Data.ts';
export * from './kalayArea1Buildings.ts';
"""
with open(os.path.join(out_dir, 'index.ts'), 'w', encoding='utf-8') as f:
    f.write(idx_ts)
print("Wrote index.ts")

print("All Kalay Area 1 data files re-generated with ZERO overlaps and road clearance!")
