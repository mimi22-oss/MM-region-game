import sys
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)

# Look for red dotted line: High R, lower G and B
# e.g. R > 180, G < 80, B < 80
red_mask = (arr[:, :, 0] > 180) & (arr[:, :, 1] < 70) & (arr[:, :, 2] < 70)
y_indices, x_indices = np.where(red_mask)

print(f"Red pixels found: {len(x_indices)}")
if len(x_indices) > 0:
    min_x, max_x = x_indices.min(), x_indices.max()
    min_y, max_y = y_indices.min(), y_indices.max()
    print(f"Red boundary pixel bounding box: X=[{min_x}, {max_x}], Y=[{min_y}, {max_y}]")
    print(f"Width: {max_x - min_x}, Height: {max_y - min_y}")

# Let's inspect the text or features by sampling known coordinates
# High School: အထက-နတ်မြောင်း
# Sayar Khant Home
# Natmyaung center
# Ngwe Tharafu: ငွေသရဖူ
# Kyaw Energy
# Japan Gyi
