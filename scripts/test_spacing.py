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

raw_items = []
for i, p in enumerate(polys):
    coords = p['geometry']['coordinates'][0]
    wpts = [uv_to_world(*geo_to_uv(c[0], c[1])) for c in coords]
    cx = sum(pt[0] for pt in wpts[:-1]) / (len(wpts) - 1)
    cz = sum(pt[1] for pt in wpts[:-1]) / (len(wpts) - 1)
    props = p.get('properties', {})
    is_osm = 'id' in p or props.get('source') != 'generated'
    raw_items.append({'cx': cx, 'cz': cz, 'is_osm': is_osm, 'poly': p, 'wpts': wpts, 'props': props})

for min_spacing in [3.5, 4.5, 5.5, 6.0, 7.0]:
    deduped = []
    for item in raw_items:
        dup = False
        for d in deduped:
            if math.hypot(item['cx'] - d['cx'], item['cz'] - d['cz']) < min_spacing:
                dup = True
                if item['is_osm'] and not d['is_osm']:
                    deduped.remove(d)
                    deduped.append(item)
                break
        if not dup:
            deduped.append(item)
    print(f"Min spacing: {min_spacing}m -> Remaining buildings: {len(deduped)}")
