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

centroids = []
for i, p in enumerate(polys):
    coords = p['geometry']['coordinates'][0]
    wpts = [uv_to_world(*geo_to_uv(c[0], c[1])) for c in coords]
    cx = sum(pt[0] for pt in wpts[:-1]) / (len(wpts) - 1)
    cz = sum(pt[1] for pt in wpts[:-1]) / (len(wpts) - 1)
    centroids.append((cx, cz, i, wpts))

# Find 10 closest pairs
pairs = []
for i in range(len(centroids)):
    for j in range(i + 1, len(centroids)):
        dist = math.hypot(centroids[i][0] - centroids[j][0], centroids[i][1] - centroids[j][1])
        pairs.append((dist, i, j))

pairs.sort()
print("Top 10 closest pairs of buildings:")
for dist, i, j in pairs[:10]:
    print(f"Dist {dist:.2f}m between #{i} and #{j}")
