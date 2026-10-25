import json, math, sys
sys.stdout.reconfigure(encoding='utf-8')

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

print("Inspect pair (750, 853):")
print("750:", polys[750].get('properties'), polys[750]['geometry']['coordinates'][0][:3])
print("853:", polys[853].get('properties'), polys[853]['geometry']['coordinates'][0][:3])

print("\nInspect pair (5, 1078):")
print("5:", polys[5].get('properties'), polys[5]['geometry']['coordinates'][0][:3])
print("1078:", polys[1078].get('properties'), polys[1078]['geometry']['coordinates'][0][:3])

# Count how many pairs have centroids < 3m apart
close_pairs = 0
for i in range(len(polys)):
    c1 = polys[i]['geometry']['coordinates'][0]
    cx1 = sum(c[0] for c in c1[:-1]) / (len(c1)-1)
    cy1 = sum(c[1] for c in c1[:-1]) / (len(c1)-1)
    for j in range(i+1, len(polys)):
        c2 = polys[j]['geometry']['coordinates'][0]
        cx2 = sum(c[0] for c in c2[:-1]) / (len(c2)-1)
        cy2 = sum(c[1] for c in c2[:-1]) / (len(c2)-1)
        dist = math.hypot((cx1 - cx2)*102280, (cy1 - cy2)*110750)
        if dist < 3.0:
            close_pairs += 1

print(f"\nPairs with centroid distance < 3.0m: {close_pairs}")
