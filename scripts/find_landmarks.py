import sys
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)

# Look for icons or text colors
# High school graduation icon: dark blue / dark circle
# Sayar Khant Home: blue lock icon (Google Maps home/private icon)
# Kyaw Energy: blue gas station icon
# Japan Gyi: dark grey landmark icon with circle
# Ngwe Tharafu: blue shopping bag icon
# Natmyaung: red text around x=625..724, y=574..591

print(f"Natmyaung text center: X=675, Y=582")

# Gas station icon (Kyaw Energy): near AH1 around bottom
# Blue color: R < 100, G < 150, B > 180
blue_mask = (arr[:, :, 2] > 180) & (arr[:, :, 0] < 100) & (arr[:, :, 1] < 150)
by, bx = np.where(blue_mask)
print(f"Total blue icon pixels: {len(bx)}")

# Cluster blue pixels into distinct points
from collections import defaultdict
clusters = []
for x, y in zip(bx, by):
    found = False
    for c in clusters:
        if abs(c['x'] - x) < 30 and abs(c['y'] - y) < 30:
            c['points'].append((x, y))
            found = True
            break
    if not found:
        clusters.append({'x': x, 'y': y, 'points': [(x, y)]})

print("Blue icon clusters found:")
for i, c in enumerate(clusters):
    pts = c['points']
    avg_x = sum(p[0] for p in pts) / len(pts)
    avg_y = sum(p[1] for p in pts) / len(pts)
    print(f"  Cluster {i+1}: ({avg_x:.1f}, {avg_y:.1f}) count={len(pts)}")
