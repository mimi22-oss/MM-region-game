import json, math

with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

polys = [f for f in data['features'] if f['geometry']['type'] == 'Polygon']

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

cleaned = []
for i, p in enumerate(polys):
    coords = p['geometry']['coordinates'][0]
    wpts = [uv_to_world(*geo_to_uv(c[0], c[1])) for c in coords]
    cx = sum(pt[0] for pt in wpts[:-1]) / (len(wpts) - 1)
    cz = sum(pt[1] for pt in wpts[:-1]) / (len(wpts) - 1)
    
    # Area
    n = len(wpts)
    area = 0.0
    for k in range(n - 1):
        area += (wpts[k][0] * wpts[k+1][1] - wpts[k+1][0] * wpts[k][1])
    area = abs(area) / 2.0
    
    props = p.get('properties', {})
    is_osm = 'id' in p or props.get('source') != 'generated'
    cleaned.append({
        'idx': i,
        'cx': cx,
        'cz': cz,
        'area': area,
        'is_osm': is_osm,
        'poly': p,
        'wpts': wpts
    })

print(f"Total raw: {len(cleaned)}")

# Deduplicate centroids closer than 3.5m (favor real OSM over generated, or larger area)
deduped = []
for c in cleaned:
    # check if any existing item in deduped is closer than 3.5m
    is_dup = False
    for d in deduped:
        dist = math.hypot(c['cx'] - d['cx'], c['cz'] - d['cz'])
        if dist < 3.5:
            is_dup = True
            # if c is real OSM and d is generated, replace d
            if c['is_osm'] and not d['is_osm']:
                deduped.remove(d)
                deduped.append(c)
            break
    if not is_dup:
        deduped.append(c)

print(f"After deduplication (<3.5m): {len(deduped)}")
