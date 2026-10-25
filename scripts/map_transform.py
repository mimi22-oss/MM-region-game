import json
import sys
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

with open('map/Natmyaung-boundary.geojson', encoding='utf-8') as f:
    bnd = json.load(f)

geo_coords = bnd['features'][0]['geometry']['coordinates'][0]
print(f"Geo boundary points: {len(geo_coords)}")

# Let's inspect the dotted red boundary in image
im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)

# Dotted boundary line mask
mask = (arr[:, :, 0] > 180) & (arr[:, :, 1] > 50) & (arr[:, :, 1] < 120) & (arr[:, :, 2] > 50) & (arr[:, :, 2] < 120)
y_idx, x_idx = np.where(mask)

px_min_x, px_max_x = int(x_idx.min()), int(x_idx.max())
px_min_y, px_max_y = int(y_idx.min()), int(y_idx.max())

lons = [c[0] for c in geo_coords]
lats = [c[1] for c in geo_coords]
geo_min_lon, geo_max_lon = min(lons), max(lons)
geo_min_lat, geo_max_lat = min(lats), max(lats)

print(f"Pixel bounds: X=[{px_min_x}, {px_max_x}] (span={px_max_x - px_min_x}), Y=[{px_min_y}, {px_max_y}] (span={px_max_y - px_min_y})")
print(f"Geo bounds: Lon=[{geo_min_lon:.6f}, {geo_max_lon:.6f}], Lat=[{geo_min_lat:.6f}, {geo_max_lat:.6f}]")

dlon_per_px = (geo_max_lon - geo_min_lon) / (px_max_x - px_min_x)
dlat_per_px = (geo_max_lat - geo_min_lat) / (px_max_y - px_min_y)
print(f"Degrees Lon per pixel: {dlon_per_px:.8f}")
print(f"Degrees Lat per pixel: {dlat_per_px:.8f}")
