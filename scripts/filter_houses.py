import json

with open('map/Natmyaung-boundary.geojson', encoding='utf-8') as f:
    bnd = json.load(f)

poly = bnd['features'][0]['geometry']['coordinates'][0]

def point_in_poly(x, y, poly):
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

with open('scripts/extracted_houses.json') as f:
    houses = json.load(f)

inside_houses = []
for h in houses:
    if point_in_poly(h['lon'], h['lat'], poly):
        inside_houses.append(h)

print(f"Houses strictly inside boundary: {len(inside_houses)} (out of {len(houses)})")

# Deduplicate houses that are too close (merge within 3.2m)
filtered = []
for h in inside_houses:
    too_close = False
    for ex in filtered:
        dist = ((h['u'] - ex['u'])**2 + (h['v'] - ex['v'])**2)**0.5
        if dist < 3.2:
            too_close = True
            break
    if not too_close:
        filtered.append(h)

print(f"Houses after minimum distance (3.2m) deduplication: {len(filtered)}")

with open('scripts/natmyaung_real_houses.json', 'w') as f:
    json.dump(filtered, f, indent=2)
