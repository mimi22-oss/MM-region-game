import json, math

with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

polys = [f for f in data['features'] if f['geometry']['type'] == 'Polygon']

centroids = []
for i, p in enumerate(polys):
    coords = p['geometry']['coordinates'][0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    cx = (sum(lons) / len(coords)) * 102280.0
    cz = (sum(lats) / len(coords)) * 110750.0
    w = (max(lons) - min(lons)) * 102280.0
    d = (max(lats) - min(lats)) * 110750.0
    centroids.append((cx, cz, w, d, i))

print("Checking distance to closest neighbor:")
gap_counts = {"<1m": 0, "1-3m": 0, "3-5m": 0, "5-10m": 0, ">10m": 0}
min_gaps = []

for i in range(len(centroids)):
    cx1, cz1, w1, d1, _ = centroids[i]
    min_dist = 1e9
    min_gap = 1e9
    for j in range(len(centroids)):
        if i == j: continue
        cx2, cz2, w2, d2, _ = centroids[j]
        center_dist = math.hypot(cx1 - cx2, cz1 - cz2)
        # Approximate edge-to-edge gap
        edge_gap = center_dist - (max(w1, d1) + max(w2, d2)) / 2
        if center_dist < min_dist:
            min_dist = center_dist
            min_gap = edge_gap
    
    if min_gap < 1.0:
        gap_counts["<1m"] += 1
    elif min_gap < 3.0:
        gap_counts["1-3m"] += 1
    elif min_gap < 5.0:
        gap_counts["3-5m"] += 1
    elif min_gap < 10.0:
        gap_counts["5-10m"] += 1
    else:
        gap_counts[">10m"] += 1
    min_gaps.append(min_gap)

print("Gap distribution:", gap_counts)
print(f"Average edge gap: {sum(min_gaps)/len(min_gaps):.2f}m")
