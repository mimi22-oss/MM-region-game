import json
import math

with open('scripts/natmyaung_real_houses.json') as f:
    houses = json.load(f)

print(f"Loaded {len(houses)} houses.")

# Let's inspect the distribution of houses in (u, v)
u_coords = [h['u'] for h in houses]
v_coords = [h['v'] for h in houses]
print(f"U range: {min(u_coords):.1f} .. {max(u_coords):.1f}")
print(f"V range: {min(v_coords):.1f} .. {max(v_coords):.1f}")

# Group houses into wards/quarters based on coordinates:
# 1. Japan Gyi Quarter (u > 60, v < 4170)
# 2. High School & West Quarter (u < 0, v < 4210)
# 3. Sayar Khant & SW Quarter (u < 0, v >= 4210)
# 4. Village Center (0 <= u <= 60, 4170 <= v <= 4230)
# 5. North Central (0 <= u <= 60, v < 4170)
# 6. Ngwe Tharafu & South Quarter (v > 4230)

quarters = {
    'အထက ရပ်ကွက်': 0,
    'ဂျပန်ကြီး ရပ်ကွက်': 0,
    'ရွာလယ် ဗဟိုရပ်ကွက်': 0,
    'ငွေသရဖူ ရပ်ကွက်': 0,
    'ဆရာခန့်နှင့် အနောက်ပိုင်းရပ်ကွက်': 0,
    'မြောက်ပိုင်း ရပ်ကွက်': 0
}

for h in houses:
    u, v = h['u'], h['v']
    if u > 60 and v < 4180:
        quarters['ဂျပန်ကြီး ရပ်ကွက်'] += 1
    elif u < 0 and v < 4210:
        quarters['အထက ရပ်ကွက်'] += 1
    elif u < 0 and v >= 4210:
        quarters['ဆရာခန့်နှင့် အနောက်ပိုင်းရပ်ကွက်'] += 1
    elif v < 4170:
        quarters['မြောက်ပိုင်း ရပ်ကွက်'] += 1
    elif v > 4235:
        quarters['ငွေသရဖူ ရပ်ကွက်'] += 1
    else:
        quarters['ရွာလယ် ဗဟိုရပ်ကွက်'] += 1

print("\nQuarter distribution:")
for q, count in quarters.items():
    print(f"  - {q}: {count} houses")
