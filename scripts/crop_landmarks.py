import sys
from PIL import Image
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)

# Let's inspect crops of key areas:
crops = [
    ("high_school", 380, 390, 560, 450),
    ("sayar_khant", 300, 520, 500, 580),
    ("natmyaung_text", 600, 550, 780, 610),
    ("ngwe_tharafu", 680, 630, 860, 700),
    ("kyaw_energy", 500, 900, 700, 970),
    ("japan_gyi", 1100, 60, 1300, 140),
]

for name, x1, y1, x2, y2 in crops:
    c = im.crop((x1, y1, x2, y2))
    c.save(f"scripts/{name}.png")
    print(f"Saved scripts/{name}.png ({x2-x1}x{y2-y1})")
