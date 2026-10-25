import sys
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)
h, w, _ = arr.shape

# Black/dark grey text mask (Google Maps text is usually #333333 or #3c4043)
# R, G, B are close to each other and < 90
text_mask = (arr[:, :, 0] < 90) & (arr[:, :, 1] < 90) & (arr[:, :, 2] < 90) & \
            (np.abs(arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)) < 15) & \
            (np.abs(arr[:, :, 1].astype(int) - arr[:, :, 2].astype(int)) < 15)

from scipy import ndimage
labeled, num_features = ndimage.label(text_mask)
slices = ndimage.find_objects(labeled)

text_clusters = []
for i, s in enumerate(slices):
    if s is None: continue
    sub = (labeled[s] == (i + 1))
    area = sub.sum()
    if 25 <= area <= 5000:
        ys, xs = np.where(sub)
        min_x, max_x = s[1].start, s[1].stop
        min_y, max_y = s[0].start, s[0].stop
        text_clusters.append({
            'bbox': [min_x, min_y, max_x, max_y],
            'center': [float(xs.mean() + min_x), float(ys.mean() + min_y)],
            'area': int(area),
            'w': max_x - min_x,
            'h': max_y - min_y
        })

# Merge nearby text clusters
merged = []
for c in text_clusters:
    found = False
    for m in merged:
        # if bounding boxes are close (within 20 px)
        if not (c['bbox'][0] > m['bbox'][2] + 20 or c['bbox'][2] < m['bbox'][0] - 20 or
                c['bbox'][1] > m['bbox'][3] + 15 or c['bbox'][3] < m['bbox'][1] - 15):
            m['bbox'] = [
                min(m['bbox'][0], c['bbox'][0]),
                min(m['bbox'][1], c['bbox'][1]),
                max(m['bbox'][2], c['bbox'][2]),
                max(m['bbox'][3], c['bbox'][3])
            ]
            m['area'] += c['area']
            found = True
            break
    if not found:
        merged.append(c.copy())

print(f"Found {len(merged)} potential text label regions:")
# Sort by area descending
merged.sort(key=lambda x: x['area'], reverse=True)
for i, m in enumerate(merged[:25]):
    print(f"Label {i+1}: bbox={m['bbox']}, area={m['area']}")
