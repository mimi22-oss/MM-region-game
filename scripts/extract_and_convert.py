import sys
import json
import math
from PIL import Image
import numpy as np
from scipy import ndimage

sys.stdout.reconfigure(encoding='utf-8')

im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)

# Transformation parameters from pixel to geo
# Pixel bounds of red boundary: X=[220, 1305], Y=[6, 1079]
# Geo bounds: Lon=[94.035773, 94.046201], Lat=[23.003935, 23.014414]
px_min_x, px_max_x = 220, 1305
px_min_y, px_max_y = 6, 1079
geo_min_lon, geo_max_lon = 94.035773, 94.046201
geo_min_lat, geo_max_lat = 23.003935, 23.014414

dlon_per_px = (geo_max_lon - geo_min_lon) / (px_max_x - px_min_x)
dlat_per_px = (geo_max_lat - geo_min_lat) / (px_max_y - px_min_y)

def px_to_geo(px, py):
    lon = geo_min_lon + (px - px_min_x) * dlon_per_px
    lat = geo_max_lat - (py - px_min_y) * dlat_per_px
    return lon, lat

# In natmyaungData.ts:
# NATMYAUNG_GEO_ORIGIN = { lon: 94.0385, lat: 23.0085 }
# NATMYAUNG_LOCAL_ANCHOR = { u: 0.0, v: 4220.0 }
# NATMYAUNG_SCALE = 0.18
# METERS_PER_DEG_LAT = 111320.0 * 0.18 = 20037.6
# METERS_PER_DEG_LON = 102450.0 * 0.18 = 18441.0
GEO_ORIGIN_LON = 94.0385
GEO_ORIGIN_LAT = 23.0085
U_ANCHOR = 0.0
V_ANCHOR = 4220.0
METERS_PER_DEG_LAT = 20037.6
METERS_PER_DEG_LON = 18441.0

angle = math.pi / 4
cosA = math.cos(angle)
sinA = math.sin(angle)

def geo_to_uv(lon, lat):
    u = U_ANCHOR + (lon - GEO_ORIGIN_LON) * METERS_PER_DEG_LON
    v = V_ANCHOR - (lat - GEO_ORIGIN_LAT) * METERS_PER_DEG_LAT
    return round(u, 2), round(v, 2)

def to_world(u, v):
    x = u * cosA + v * sinA
    z = -u * sinA + v * cosA
    return round(x, 2), round(z, 2)

# Extract building blobs
building_mask = (
    (arr[:, :, 0] >= 200) & (arr[:, :, 0] <= 226) &
    (arr[:, :, 1] >= 208) & (arr[:, :, 1] <= 230) &
    (arr[:, :, 2] >= 220) & (arr[:, :, 2] <= 238)
)

labeled_array, num_features = ndimage.label(building_mask)
slices = ndimage.find_objects(labeled_array)

extracted_houses = []
for i, s in enumerate(slices):
    if s is None: continue
    sub = (labeled_array[s] == (i + 1))
    area = sub.sum()
    if 18 <= area <= 1200:
        ys, xs = np.where(sub)
        cx = float(s[1].start + xs.mean())
        cy = float(s[0].start + ys.mean())
        w_px = float(xs.max() - xs.min() + 1)
        h_px = float(ys.max() - ys.min() + 1)
        aspect = max(w_px, h_px) / max(min(w_px, h_px), 1)
        if aspect <= 3.5:
            lon, lat = px_to_geo(cx, cy)
            u, v = geo_to_uv(lon, lat)
            world = to_world(u, v)
            extracted_houses.append({
                'px': round(cx, 1),
                'py': round(cy, 1),
                'w_px': round(w_px, 1),
                'h_px': round(h_px, 1),
                'lon': round(lon, 7),
                'lat': round(lat, 7),
                'u': u,
                'v': v,
                'x': world[0],
                'z': world[1],
                'area_px': int(area)
            })

print(f"Total extracted houses: {len(extracted_houses)}")
print(f"U bounds: {min(h['u'] for h in extracted_houses)} .. {max(h['u'] for h in extracted_houses)}")
print(f"V bounds: {min(h['v'] for h in extracted_houses)} .. {max(h['v'] for h in extracted_houses)}")

with open('scripts/extracted_houses.json', 'w') as f:
    json.dump(extracted_houses, f, indent=2)
