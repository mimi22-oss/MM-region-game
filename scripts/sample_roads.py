import sys
from PIL import Image
import numpy as np

im = Image.open('map/Nat Myaung1.png').convert('RGB')
arr = np.array(im)

print("Sample at (500, 700):", arr[700, 500])
print("Sample at (440, 350):", arr[350, 440])
print("Sample at (700, 400):", arr[400, 700])
print("Sample at (800, 300):", arr[300, 800])
print("Sample background at (200, 200):", arr[200, 200])
