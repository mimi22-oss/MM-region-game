from PIL import Image

im = Image.open('map/Nat Myaung1.png').convert('RGB')
c = im.crop((380, 390, 620, 470))
c.save("scripts/high_school_full.png")
