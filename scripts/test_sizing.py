import json, math

with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

polys = [f for f in data['features'] if f['geometry']['type'] == 'Polygon']
lines = [f for f in data['features'] if f['geometry']['type'] == 'LineString']

kanbale_lon = 94.064442
kanbale_lat = 23.163868
kanbale_u = 160.0
kanbale_v = -252.0
m_per_deg_lat = 110750.0
m_per_deg_lon = 102280.0
angle = 0.052
cosA = math.cos(angle)
sinA = math.sin(angle)

def uv_to_world(u, v):
    return u * cosA + v * sinA, -u * sinA + v * cosA

def geo_to_uv(lon, lat):
    u = kanbale_u + (lon - kanbale_lon) * m_per_deg_lon
    v = kanbale_v - (lat - kanbale_lat) * m_per_deg_lat
    return u, v

road_segments = []
for r in lines:
    coords = r['geometry']['coordinates']
    wpts = [uv_to_world(*geo_to_uv(c[0], c[1])) for c in coords]
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
    return min_dist, math.atan2(vx, vz) # yaw angle: +Z faces road

# Deduplicate raw polygons
raw_items = []
for i, p in enumerate(polys):
    coords = p['geometry']['coordinates'][0]
    wpts = [uv_to_world(*geo_to_uv(c[0], c[1])) for c in coords]
    cx = sum(pt[0] for pt in wpts[:-1]) / (len(wpts) - 1)
    cz = sum(pt[1] for pt in wpts[:-1]) / (len(wpts) - 1)
    props = p.get('properties', {})
    is_osm = 'id' in p or props.get('source') != 'generated'
    raw_items.append({'cx': cx, 'cz': cz, 'is_osm': is_osm, 'poly': p, 'wpts': wpts, 'props': props})

deduped = []
for item in raw_items:
    dup = False
    for d in deduped:
        if math.hypot(item['cx'] - d['cx'], item['cz'] - d['cz']) < 3.5:
            dup = True
            if item['is_osm'] and not d['is_osm']:
                deduped.remove(d)
                deduped.append(item)
            break
    if not dup:
        deduped.append(item)

print(f"Total deduped buildings: {len(deduped)}")

# Process each building
processed = []
for b_idx, item in enumerate(deduped):
    wpts = item['wpts']
    cx = item['cx']
    cz = item['cz']
    dist_road, yaw = closest_road_dir(cx, cz)
    
    # Project vertices to local frame (Z forward, X lateral)
    cosY = math.cos(yaw)
    sinY = math.sin(yaw)
    lxs = []
    lzs = []
    for pt in wpts[:-1]:
        dx = pt[0] - cx
        dz = pt[1] - cz
        lx = dx * cosY - dz * sinY
        lz = dx * sinY + dz * cosY
        lxs.append(lx)
        lzs.append(lz)
        
    span_x = max(lxs) - min(lxs)
    span_z = max(lzs) - min(lzs)
    center_lx = (min(lxs) + max(lxs)) / 2.0
    center_lz = (min(lzs) + max(lzs)) / 2.0
    
    # World compound center
    comp_cx = cx + center_lx * cosY + center_lz * sinY
    comp_cz = cz - center_lx * sinY + center_lz * cosY
    
    # Compound bounds with padding/inset from parcel edge
    comp_w = max(min(span_x - 0.6, 14.0), 6.5)
    comp_d = max(min(span_z - 0.6, 16.0), 7.5)
    
    # House bounds inside compound
    house_w = max(min(comp_w - 2.0, 5.8), 3.8)
    house_d = max(min(comp_d - 2.8, 7.0), 4.4)
    
    # House local offset: shifted slightly to the back to leave front yard
    house_local_z = -(comp_d - house_d) * 0.25
    
    processed.append({
        'cx': comp_cx,
        'cz': comp_cz,
        'yaw': yaw,
        'compW': comp_w,
        'compD': comp_d,
        'houseW': house_w,
        'houseD': house_d,
        'houseZ': house_local_z
    })

print("Sample processed building 0:")
print(processed[0])

# Check overlaps between houses
house_overlaps = 0
for i in range(len(processed)):
    p1 = processed[i]
    for j in range(i+1, len(processed)):
        p2 = processed[j]
        cdist = math.hypot(p1['cx'] - p2['cx'], p1['cz'] - p2['cz'])
        # Conservative bounding radius
        r1 = math.hypot(p1['houseW']/2, p1['houseD']/2)
        r2 = math.hypot(p2['houseW']/2, p2['houseD']/2)
        if cdist < (r1 + r2) * 0.75: # potential overlap
            house_overlaps += 1

print(f"House potential overlaps: {house_overlaps} (was over 570 overlapping in raw)")
