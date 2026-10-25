import json
import math

rot_base = math.pi / 4
cosA = math.cos(rot_base)
sinA = math.sin(rot_base)

def to_world(u, v):
    return round(u * cosA + v * sinA, 2), round(-u * sinA + v * cosA, 2)

# Landmarks with spacious positions matching tests and locationDetect:
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
        "u": -12.0,
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

# We need 436 residential houses to make 445 total buildings
# Roads layout:
# EW lanes at v = [4140, 4162, 4184, 4206, 4228, 4250, 4272, 4294, 4316]
# 9 lanes give 8 blocks between lanes, plus north and south fringes.
# Each block has 2 rows:
# Row 1: baseV + 7.0
# Row 2: baseV + 15.0
# Total rows across 9 blocks = 18 rows!
# Let's define the row v positions:
v_rows = []
for base_v in [4118, 4140, 4162, 4184, 4206, 4228, 4250, 4272, 4294, 4316]:
    v_rows.append(base_v + 7.0)
    v_rows.append(base_v + 15.0)

print(f"Total V rows: {len(v_rows)}")

# Columns along U:
# West of AH1 (u < -10):
# spacing: 14m apart
west_u_cols = [-18, -32, -46, -60, -74, -88, -102, -116, -130, -144, -158, -172] # 12 cols
# East of AH1 (u > 10):
# spacing: 14m apart
east_u_cols = [18, 32, 46, 60, 74, 88, 102, 116, 130, 144, 158, 172, 186, 200]  # 14 cols

print(f"West cols: {len(west_u_cols)}, East cols: {len(east_u_cols)}")
print(f"Total possible slots = {len(v_rows) * (len(west_u_cols) + len(east_u_cols))} = {20 * 26} = 520 slots")
