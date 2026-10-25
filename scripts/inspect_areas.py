import json

with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

polys = [f for f in data['features'] if f['geometry']['type'] == 'Polygon']

areas = []
for p in polys:
    coords = p['geometry']['coordinates'][0]
    n = len(coords)
    area = 0.0
    for i in range(n - 1):
        x0 = coords[i][0] * 102280.0
        z0 = coords[i][1] * 110750.0
        x1 = coords[i+1][0] * 102280.0
        z1 = coords[i+1][1] * 110750.0
        area += (x0 * z1 - x1 * z0)
    area = abs(area) / 2.0
    areas.append(area)

print(f"Total: {len(areas)}")
print(f"Area < 15 m^2: {sum(1 for a in areas if a < 15)}")
print(f"Area 15-30 m^2: {sum(1 for a in areas if 15 <= a < 30)}")
print(f"Area 30-70 m^2: {sum(1 for a in areas if 30 <= a < 70)}")
print(f"Area 70-150 m^2: {sum(1 for a in areas if 70 <= a < 150)}")
print(f"Area > 150 m^2: {sum(1 for a in areas if a >= 150)}")
print(f"Min area: {min(areas):.1f}, Max area: {max(areas):.1f}, Median: {sorted(areas)[len(areas)//2]:.1f}")
