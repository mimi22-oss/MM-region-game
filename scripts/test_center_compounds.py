import json, math, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

polys = [f for f in data['features'] if f['geometry']['type'] == 'Polygon']
lines = [f for f in data['features'] if f['geometry']['type'] == 'LineString']
points = [f for f in data['features'] if f['geometry']['type'] == 'Point']

kanbale_lon = 94.064442
kanbale_lat = 23.163868
kanbale_u = 160.0
kanbale_v = -252.0
m_per_deg_lat = 111320.0
m_per_deg_lon = 111320.0 * math.cos(23.160308 * math.pi / 180) # ~102354.72
angle = math.pi / 4
cosA = math.cos(angle)
sinA = math.sin(angle)

def geo_to_uv(lon, lat):
    u = kanbale_u + (lon - kanbale_lon) * m_per_deg_lon
    v = kanbale_v - (lat - kanbale_lat) * m_per_deg_lat
    return u, v

def uv_to_world(u, v):
    x = u * cosA + v * sinA
    z = -u * sinA + v * cosA
    return x, z

def geo_to_world(lon, lat):
    return uv_to_world(*geo_to_uv(lon, lat))

road_segments = []
for r in lines:
    coords = r['geometry']['coordinates']
    wpts = [geo_to_world(c[0], c[1]) for c in coords]
    for i in range(len(wpts)-1):
        road_segments.append((wpts[i], wpts[i+1]))

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
    for p1, p2 in road_segments:
        d, proj = dist_point_to_segment(cx, cz, p1, p2)
        if d < min_dist:
            min_dist = d
            best_proj = proj
    vx = best_proj[0] - cx
    vz = best_proj[1] - cz
    # Return distance and angle towards road (Three.js Y-rotation where +Z faces road)
    return min_dist, math.atan2(vx, vz)

print(f"Total polygons: {len(polys)}, Total road segments: {len(road_segments)}")

# Collect POI locations so we NEVER filter out landmark buildings
poi_locs = [geo_to_world(pt['geometry']['coordinates'][0], pt['geometry']['coordinates'][1]) for pt in points]

# Raw buildings
raw_buildings = []
for i, p in enumerate(polys):
    coords = p['geometry']['coordinates'][0]
    wpts = [geo_to_world(c[0], c[1]) for c in coords]
    cx = sum(pt[0] for pt in wpts[:-1]) / (len(wpts) - 1)
    cz = sum(pt[1] for pt in wpts[:-1]) / (len(wpts) - 1)
    
    # Check if close to POI
    is_poi = any(math.hypot(cx - px, cz - pz) < 15.0 for px, pz in poi_locs)
    
    props = p.get('properties', {})
    is_osm = 'id' in p or props.get('source') != 'generated'
    raw_buildings.append({
        'idx': i,
        'cx': cx,
        'cz': cz,
        'is_poi': is_poi,
        'is_osm': is_osm,
        'poly': p,
        'wpts': wpts,
        'props': props
    })

# Deduplication with priority: POIs > Real OSM > Area
# Use 4.5m - 5.0m threshold
deduped = []
for b in raw_buildings:
    dup = False
    for d in deduped:
        dist = math.hypot(b['cx'] - d['cx'], b['cz'] - d['cz'])
        if dist < 4.8:
            dup = True
            # if b is POI and d is not, swap
            if b['is_poi'] and not d['is_poi']:
                deduped.remove(d)
                deduped.append(b)
            # if b is OSM and d is not (and neither is POI), swap
            elif b['is_osm'] and not d['is_osm'] and not d['is_poi']:
                deduped.remove(d)
                deduped.append(b)
            break
    if not dup:
        deduped.append(b)

print(f"Deduped buildings count: {len(deduped)}")
