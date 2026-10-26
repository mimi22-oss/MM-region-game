import json
import math
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

kanbale_lon = 94.068471
kanbale_lat = 23.168500
kanbale_u = 0.0
kanbale_v = -740.0
m_per_deg_lat = 111320.0
m_per_deg_lon = 111320.0 * math.cos(23.160308 * math.pi / 180)

def geo_to_uv(lon, lat):
    u = kanbale_u + (lon - kanbale_lon) * m_per_deg_lon
    v = kanbale_v - (lat - kanbale_lat) * m_per_deg_lat
    return round(u, 2), round(v, 2)

with open('src/data/wards/myothar/center/myotharCenterBuildings.ts', 'r', encoding='utf-8') as f:
    content = f.read()

b_texts = re.findall(r'\{\s*"id":\s*"([^"]+)",\s*"osmId":\s*(\d+).*?"u":\s*(-?[\d.]+),\s*"v":\s*(-?[\d.]+)', content, re.DOTALL)
myothar_b = [(m[0], int(m[1]), float(m[2]), float(m[3])) for m in b_texts]

with open('map/kalay-area-1-osm.geojson', 'r', encoding='utf-8') as f:
    area1_osm = json.load(f)

new_buildings = []
for feat in area1_osm['features']:
    if feat['geometry']['type'] == 'Polygon':
        ring = feat['geometry']['coordinates'][0]
        avg_lon = sum(p[0] for p in ring[:-1]) / (len(ring) - 1)
        avg_lat = sum(p[1] for p in ring[:-1]) / (len(ring) - 1)
        u, v = geo_to_uv(avg_lon, avg_lat)
        # Check if already in myothar center: within 6m of any myothar building
        overlap = any(math.hypot(u - mb[2], v - mb[3]) < 6.0 for mb in myothar_b)
        if not overlap:
            new_buildings.append((u, v, feat))

print(f'New unique Area 1 buildings: {len(new_buildings)}')

bands = {}
for u, v, feat in new_buildings:
    band_u = round(u / 50.0) * 50
    if band_u not in bands:
        bands[band_u] = []
    bands[band_u].append((u, v))

print('New Area 1 southern boundary across U bands:')
for b_u in sorted(bands.keys()):
    vs = [item[1] for item in bands[b_u]]
    max_v = max(vs)
    print(f'  U ~ {b_u:4d}m: {len(vs):2d} buildings, southern-most V = {max_v:.1f}')
