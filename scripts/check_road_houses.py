import json
import math

with open('scripts/natmyaung_all_real_houses.json') as f:
    houses = json.load(f)

# Natmyaung road plots currently:
# AH1 highway: u=0, v in [4110, 4330] -> x=2983.99, z=2983.99, w=10, d=220, rot=pi/4
# EW lanes: at various v values
# In UV space:
# AH1 is along u=0, spanning v from 4110 to 4330.
# The EW lanes are perpendicular to AH1, spanning u from -60 to 60.

# Let's check how many houses have |u| < 4.0 (i.e. on AH1 highway)
on_ah1 = [h for h in houses if abs(h['u']) < 3.5]
print(f"Houses directly on AH1 (|u| < 3.5m): {len(on_ah1)}")

# In Nat Myaung 1.png, AH1 in pixel space:
# Kyaw energy at (570, 930), High school at (440, 420).
# In geo space, AH1 is not strictly north-south; it has a slight angle.
# Let's inspect where the road pixels are in Nat Myaung 1.png!
