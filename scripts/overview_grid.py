from PIL import Image

im = Image.open('map/Nat Myaung1.png').convert('RGB')
w, h = im.size

# Let's save a 3x3 grid overview or find where non-background non-road non-house pixels are
# Specifically, text colors or pin colors
# Let's check 6 zones across the village:
# 1. Top-Left (NW)
# 2. Top-Center (N)
# 3. Top-Right (NE)
# 4. Mid-Left (W)
# 5. Mid-Center (Central)
# 6. Mid-Right (E)
# 7. Bot-Left (SW)
# 8. Bot-Center (S)
# 9. Bot-Right (SE)

step_x = w // 3
step_y = h // 3

for i in range(3):
    for j in range(3):
        x1 = j * step_x
        y1 = i * step_y
        x2 = min((j + 1) * step_x, w)
        y2 = min((i + 1) * step_y, h)
        patch = im.crop((x1, y1, x2, y2))
        patch.thumbnail((400, 300))
        patch.save(f"scripts/patch_{i}_{j}.png")

print("Saved 3x3 grid patches.")
