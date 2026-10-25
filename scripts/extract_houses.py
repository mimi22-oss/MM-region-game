import sys
from PIL import Image
import numpy as np
from scipy import ndimage

sys.stdout.reconfigure(encoding='utf-8')

im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)

# Building color detection
# Main building fill: R in [205, 225], G in [210, 228], B in [220, 235]
building_mask = (
    (arr[:, :, 0] >= 200) & (arr[:, :, 0] <= 226) &
    (arr[:, :, 1] >= 208) & (arr[:, :, 1] <= 230) &
    (arr[:, :, 2] >= 220) & (arr[:, :, 2] <= 238)
)

labeled_array, num_features = ndimage.label(building_mask)
print(f"Initial raw building candidate blobs: {num_features}")

# Filter blobs by size (a building is typically between 15 pixels and 1500 pixels)
buildings = []
for i in range(1, num_features + 1):
    ys, xs = np.where(labeled_array == i)
    area = len(xs)
    if 15 <= area <= 1500:
        min_x, max_x = xs.min(), xs.max()
        min_y, max_y = ys.min(), ys.max()
        w = max_x - min_x + 1
        h = max_y - min_y + 1
        aspect = max(w, h) / max(min(w, h), 1)
        if aspect <= 4.0: # Buildings are roughly rectangular
            buildings.append({
                'id': i,
                'cx': float(xs.mean()),
                'cy': float(ys.mean()),
                'w_px': float(w),
                'h_px': float(h),
                'area_px': area
            })

print(f"Validated building footprints: {len(buildings)}")

# Print a few samples
for b in buildings[:10]:
    print(f"  Building {b['id']}: center=({b['cx']:.1f}, {b['cy']:.1f}), size=({b['w_px']}x{b['h_px']}), area={b['area_px']}")
