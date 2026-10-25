import json, math

with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

polys = [f for f in data['features'] if f['geometry']['type'] == 'Polygon']

# kanbale anchor constants
kanbale_lon = 94.064442
kanbale_lat = 23.163868
kanbale_u = 160.0
kanbale_v = -252.0
m_per_deg_lat = 110750.0
m_per_deg_lon = 102280.0
angle = 0.052

def geo_to_uv(lon, lat):
    u = kanbale_u + (lon - kanbale_lon) * m_per_deg_lon
    v = kanbale_v - (lat - kanbale_lat) * m_per_deg_lat
    return u, v

cosA = math.cos(angle)
sinA = math.sin(angle)

def uv_to_world(u, v):
    x = u * cosA + v * sinA
    z = -u * sinA + v * cosA
    return x, z

print(f"Sample building polygons:")
for i in [1, 2, 3, 4, 5, 20, 50, 100]:
    p = polys[i]
    coords = p['geometry']['coordinates'][0]
    wpts = [uv_to_world(*geo_to_uv(c[0], c[1])) for c in coords]
    cx = sum(pt[0] for pt in wpts[:-1]) / (len(wpts) - 1)
    cz = sum(pt[1] for pt in wpts[:-1]) / (len(wpts) - 1)
    # Distances from centroid to vertices
    rads = [math.hypot(pt[0] - cx, pt[1] - cz) for pt in wpts[:-1]]
    print(f"Building {i}: centroid=({cx:.1f}, {cz:.1f}), max_radius={max(rads):.1f}m, min_radius={min(rads):.1f}m")
