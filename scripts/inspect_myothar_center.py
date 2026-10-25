import json
import math
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Kanbale origin in game
kanbale_lon = 94.064442
kanbale_lat = 23.163868
kanbale_u = 160.0
kanbale_v = -252.0

m_per_deg_lat = 111320.0
m_per_deg_lon = 111320.0 * math.cos(23.160308 * math.pi / 180)

def geo_to_uv(lon, lat):
    u = kanbale_u + (lon - kanbale_lon) * m_per_deg_lon
    v = kanbale_v - (lat - kanbale_lat) * m_per_deg_lat
    return u, v

angle = math.pi / 4

with open('map/myanmar-custom-labels (1).geojson', 'r', encoding='utf-8') as f:
    cl = json.load(f)

print('=== CUSTOM LABELS IN UV & WORLD (x, z) ===')
for feat in cl['features']:
    props = feat['properties']
    lon, lat = feat['geometry']['coordinates']
    u, v = geo_to_uv(lon, lat)
    x = u * math.cos(angle) + v * math.sin(angle)
    z = -u * math.sin(angle) + v * math.cos(angle)
    print(f"  {props.get('name')}: lon={lon:.6f}, lat={lat:.6f} -> u={u:7.1f}, v={v:7.1f} -> x={x:7.1f}, z={z:7.1f}")
