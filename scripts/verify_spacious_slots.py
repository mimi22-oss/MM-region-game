import json
import math

rot_base = math.pi / 4
cosA = math.cos(rot_base)
sinA = math.sin(rot_base)

def to_world(u, v):
    return round(u * cosA + v * sinA, 2), round(-u * sinA + v * cosA, 2)

landmarks_defs = [
    {
        "id": "natmyaung-admin-office",
        "name": "နတ်မြောင်း ကျေးရွာ အုပ်ချုပ်ရေးမှူးရုံး",
        "u": 20.0,
        "v": 4195.0,
        "width": 11.0,
        "depth": 7.0,
        "houseWidth": 11.0,
        "houseLength": 7.0,
        "rotation": 2.356194490192345,
        "wallColor": "#ece6d8",
        "roofColor": "#3b6d8c",
        "area": 77.0,
        "isLandmark": True,
        "type": "office"
    },
    {
        "id": "natmyaung-primary-school",
        "name": "နတ်မြောင်း အခြေခံပညာ မူလတန်းကျောင်း",
        "u": 72.0,
        "v": 4195.0,
        "width": 16.0,
        "depth": 7.0,
        "houseWidth": 16.0,
        "houseLength": 7.0,
        "rotation": 0.7853981633974483,
        "wallColor": "#f0ede1",
        "roofColor": "#8b3a2b",
        "area": 112.0,
        "isLandmark": True,
        "type": "school"
    },
    {
        "id": "natmyaung-high-school",
        "name": "အထက-နတ်မြောင်း (အခြေခံပညာ အထက်တန်းကျောင်း)",
        "u": -14.0,
        "v": 4172.0,
        "width": 18.0,
        "depth": 8.5,
        "houseWidth": 18.0,
        "houseLength": 8.5,
        "rotation": 0.7853981633974483,
        "wallColor": "#f5f2eb",
        "roofColor": "#2d5475",
        "area": 153.0,
        "isLandmark": True,
        "type": "school"
    },
    {
        "id": "natmyaung-monastery",
        "name": "နတ်မြောင်း ရွာလယ်ဓမ္မာရုံနှင့် ဘုန်းတော်ကြီးကျောင်း",
        "u": 78.0,
        "v": 4175.0,
        "width": 14.0,
        "depth": 10.0,
        "houseWidth": 14.0,
        "houseLength": 10.0,
        "rotation": 0.7853981633974483,
        "wallColor": "#d4a373",
        "roofColor": "#936639",
        "area": 140.0,
        "isLandmark": True,
        "type": "monastery"
    },
    {
        "id": "natmyaung-clinic",
        "name": "နတ်မြောင်း ကျေးလက်ကျန်းမာရေးဌာနခွဲ (ဆေးပေးခန်း)",
        "u": -18.0,
        "v": 4235.0,
        "width": 9.5,
        "depth": 6.5,
        "houseWidth": 9.5,
        "houseLength": 6.5,
        "rotation": 2.356194490192345,
        "wallColor": "#e8e8e4",
        "roofColor": "#457b9d",
        "area": 61.75,
        "isLandmark": True,
        "type": "clinic"
    },
    {
        "id": "natmyaung-kyaw-energy",
        "name": "ကျော်အင်နာဂျီ စက်သုံးဆီအရောင်းဆိုင် (Kyaw Energy)",
        "u": 16.0,
        "v": 4285.0,
        "width": 11.5,
        "depth": 7.5,
        "houseWidth": 11.5,
        "houseLength": 7.5,
        "rotation": 0.7853981633974483,
        "wallColor": "#fafafa",
        "roofColor": "#1d4ed8",
        "area": 86.25,
        "isLandmark": True,
        "type": "office"
    },
    {
        "id": "natmyaung-sayar-khant",
        "name": "ဆရာခန့် နေအိမ် (Sayar Khant Home)",
        "u": -27.0,
        "v": 4208.0,
        "width": 8.5,
        "depth": 7.5,
        "houseWidth": 8.5,
        "houseLength": 7.5,
        "rotation": 0.7853981633974483,
        "wallColor": "#5c432d",
        "roofColor": "#a65342",
        "area": 63.75,
        "isLandmark": True,
        "type": "house"
    },
    {
        "id": "natmyaung-ngwe-tharafu",
        "name": "ငွေသရဖူ ကုန်စုံဆိုင် (Ngwe Tharafu Store)",
        "u": 42.0,
        "v": 4230.0,
        "width": 9.0,
        "depth": 7.0,
        "houseWidth": 9.0,
        "houseLength": 7.0,
        "rotation": 0.7853981633974483,
        "wallColor": "#e2e8f0",
        "roofColor": "#ea580c",
        "area": 63.0,
        "isLandmark": True,
        "type": "office"
    },
    {
        "id": "natmyaung-japan-gyi",
        "name": "ဂျပန်ကြီး အထင်ကရနေရာ (Japan Gyi)",
        "u": 118.0,
        "v": 4120.0,
        "width": 10.0,
        "depth": 8.0,
        "houseWidth": 10.0,
        "houseLength": 8.0,
        "rotation": 0.7853981633974483,
        "wallColor": "#e5e7eb",
        "roofColor": "#475569",
        "area": 80.0,
        "isLandmark": True,
        "type": "office"
    }
]

# Pond center
pond_u, pond_v, pond_radius = 82.0, 4235.0, 16.0

# Generate candidate house slots:
lanes_v = [4122, 4148, 4174, 4200, 4226, 4252, 4278, 4304, 4330]

rows_v = [4110.0]
for lv in lanes_v[:-1]:
    rows_v.append(lv + 7.5)
    rows_v.append(lv + 17.5)
rows_v.append(4340.0)

west_cols = [-18, -32, -46, -60, -74, -88, -102, -116, -130, -144, -158, -172]
east_cols = [18, 32, 46, 60, 74, 88, 102, 116, 130, 144, 158, 172, 186, 200, 214]
all_cols = west_cols + east_cols

candidate_slots = []
for v in rows_v:
    for u in all_cols:
        # Check pond clearance
        if math.hypot(u - pond_u, v - pond_v) < pond_radius + 4.0:
            continue
        # Check landmark clearances
        too_close_landmark = False
        for lm in landmarks_defs:
            if math.hypot(u - lm['u'], v - lm['v']) < 11.0:
                too_close_landmark = True
                break
        if too_close_landmark:
            continue
        candidate_slots.append((u, v))

print(f"Candidate spacious slots available: {len(candidate_slots)}")
# We need exactly 436 residential houses:
assert len(candidate_slots) >= 436, f"Not enough slots: {len(candidate_slots)}"
selected_slots = candidate_slots[:436]

# Verify distances among all placed houses (including landmarks):
all_placed = list(landmarks_defs)
for u, v in selected_slots:
    all_placed.append({"u": u, "v": v, "id": "res"})

min_dist = float('inf')
closest_pair = None
for i in range(len(all_placed)):
    for j in range(i + 1, len(all_placed)):
        d = math.hypot(all_placed[i]['u'] - all_placed[j]['u'], all_placed[i]['v'] - all_placed[j]['v'])
        if d < min_dist:
            min_dist = d
            closest_pair = (all_placed[i]['id'], all_placed[j]['id'])

print(f"Minimum distance between any two buildings: {min_dist:.2f} meters! (Pair: {closest_pair})")
