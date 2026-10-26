import json
import math
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/data/wards/kalayArea1/kalayArea1Buildings.ts', 'r', encoding='utf-8') as f:
    content = f.read()

import re
b_texts = re.findall(r'\{\s*"id":\s*"([^"]+)".*?"u":\s*(-?[\d.]+),\s*"v":\s*(-?[\d.]+).*?"x":\s*(-?[\d.]+),\s*"z":\s*(-?[\d.]+).*?"width":\s*(-?[\d.]+),\s*"depth":\s*(-?[\d.]+).*?"compoundWidth":\s*(-?[\d.]+),\s*"compoundDepth":\s*(-?[\d.]+)', content, re.DOTALL)
print(f'Current Area 1 buildings: {len(b_texts)}')

# Check how many are close to AH1 (|u| < 10)
ah1_encroach = [b for b in b_texts if abs(float(b[1])) < 9.0]
print(f'Buildings encroaching AH1 (|u| < 9m): {len(ah1_encroach)}')
for b in ah1_encroach[:5]:
    print(' ', b[0], 'u=', b[1], 'v=', b[2])

# Check pairwise distance between buildings
close_pairs = 0
pts = [(b[0], float(b[3]), float(b[4]), float(b[7]), float(b[8])) for b in b_texts]
for i in range(len(pts)):
    for j in range(i + 1, len(pts)):
        d = math.hypot(pts[i][1] - pts[j][1], pts[i][2] - pts[j][2])
        # Compare center distance with half compound dimensions
        min_safe = (pts[i][3] + pts[j][3]) / 4 + (pts[i][4] + pts[j][4]) / 4
        if d < 5.0:
            close_pairs += 1

print(f'Buildings within 5m of another building: {close_pairs}')
