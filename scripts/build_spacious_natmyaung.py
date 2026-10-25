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
        "type": "office",
        "storeys": 2
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
        "type": "school",
        "storeys": 1
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
        "type": "school",
        "storeys": 2
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
        "type": "monastery",
        "storeys": 1
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
        "type": "clinic",
        "storeys": 1
    },
    {
        "id": "natmyaung-kyaw-energy",
        "name": "ကျော်အင်နာဂျီ စက်သုံးဆီအရောင်းဆိုင် (Kyaw Energy)",
        "u": 18.0,
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
        "type": "office",
        "storeys": 1
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
        "type": "house",
        "storeys": 2
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
        "type": "office",
        "storeys": 1
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
        "type": "office",
        "storeys": 1
    }
]

# Pond center
pond_u, pond_v, pond_radius = 82.0, 4235.0, 16.0

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
            if math.hypot(u - lm['u'], v - lm['v']) < 12.0:
                too_close_landmark = True
                break
        if too_close_landmark:
            continue
        candidate_slots.append((u, v))

# We need exactly 436 residential houses
assert len(candidate_slots) >= 436, f"Not enough slots: {len(candidate_slots)}"
selected_slots = candidate_slots[:436]

wall_colors = [
    '#f5ede1', '#e3d5c1', '#d6c7b0', '#dfd5c6', '#5c432d',
    '#e8e1d5', '#ede5d8', '#ccbda8', '#d0c3b0', '#f2ece4'
]

roof_colors = [
    '#8c3a2b', '#3b6d8c', '#a65342', '#627c85', '#a39a85',
    '#4b6b55', '#964332', '#4a607a', '#7d3c2e', '#556b2f'
]

# Build landmark objects
landmarks = []
for lm in landmarks_defs:
    x, z = to_world(lm['u'], lm['v'])
    lm_full = dict(lm)
    lm_full['x'] = x
    lm_full['z'] = z
    landmarks.append(lm_full)

bldgs = list(landmarks)
houses_list = []

for lm in landmarks:
    houses_list.append({
        "id": lm["id"],
        "name": lm["name"],
        "x": lm["x"],
        "z": lm["z"],
        "width": lm["width"],
        "depth": lm["depth"],
        "color": lm["wallColor"],
        "roof": lm["roofColor"],
        "rotation": lm["rotation"]
    })

for idx, (u, v) in enumerate(selected_slots, 1):
    hid = f"natmyaung-house-{idx}"
    hname = f"နတ်မြောင်း အိမ်အမှတ် ({idx})"
    w = 7.0 if idx % 3 != 0 else 7.5
    d = 6.0 if idx % 2 != 0 else 6.5
    wall_col = wall_colors[(idx * 7) % len(wall_colors)]
    roof_col = roof_colors[(idx * 11) % len(roof_colors)]
    x, z = to_world(u, v)
    
    bldg_entry = {
        "id": hid,
        "name": hname,
        "u": round(u, 2),
        "v": round(v, 2),
        "x": x,
        "z": z,
        "width": w,
        "depth": d,
        "houseWidth": w,
        "houseLength": d,
        "rotation": round(rot_base, 6),
        "wallColor": wall_col,
        "roofColor": roof_col,
        "area": round(w * d, 1),
        "isLandmark": False,
        "type": "house",
        "storeys": 2
    }
    bldgs.append(bldg_entry)
    
    house_entry = {
        "id": hid,
        "name": hname,
        "x": x,
        "z": z,
        "width": w,
        "depth": d,
        "color": wall_col,
        "rotation": round(rot_base, 6),
        "roof": roof_col
    }
    houses_list.append(house_entry)

print(f"Total buildings: {len(bldgs)}, total houses: {len(houses_list)}")

ts_buildings = """import type { House } from '../../types.ts';
import { toWorld } from './natmyaungData.ts';

export interface NatmyaungBuildingData {
  id: string;
  osmId?: string | number;
  name: string;
  u: number;
  v: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  houseWidth: number;
  houseLength: number;
  rotation: number;
  wallColor: string;
  roofColor: string;
  area: number;
  isLandmark: boolean;
  type: string;
  storeys?: number;
}

/**
 * နတ်မြောင်းကျေးရွာ အဆောက်အအုံများနှင့် လူနေအိမ်များ စာရင်း
 * အိမ်ခြေ ၄၄၅ လုံးကို မြန်မာ့ရိုးရာ ၂ ထပ်အိမ်များအဖြစ် အကွာအဝေး (၁၀ မှ ၁၄ မီတာ) တညီတညွတ်တည်း ကျယ်ဝန်းစွာ တည်ဆောက်ထားပါသည်။
 */
export const natmyaungBuildings: NatmyaungBuildingData[] = """ + json.dumps(bldgs, indent=2, ensure_ascii=False) + """;

/**
 * Collision System အတွက် နတ်မြောင်း လူနေအိမ်များနှင့် အဆောက်အအုံများ
 */
export const natmyaungHouses: House[] = """ + json.dumps(houses_list, indent=2, ensure_ascii=False) + """;
"""

with open('src/data/villages/natmyaung/natmyaungBuildings.ts', 'w', encoding='utf-8') as f:
    f.write(ts_buildings)

print("Saved src/data/villages/natmyaung/natmyaungBuildings.ts")
