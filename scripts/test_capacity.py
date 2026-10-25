import json
import math

rot_base = math.pi / 4
cosA = math.cos(rot_base)
sinA = math.sin(rot_base)

def to_world(u, v):
    return round(u * cosA + v * sinA, 2), round(-u * sinA + v * cosA, 2)

# Load existing boundary polygon
with open('map/Natmyaung-boundary.geojson', encoding='utf-8') as f:
    bnd = json.load(f)
geo_poly = bnd['features'][0]['geometry']['coordinates'][0]

# Let's check lane positions in V:
# Spaced by ~22m to 24m:
# lanes at v = [4096, 4122, 4148, 4174, 4200, 4226, 4252, 4278, 4304, 4330] (10 lanes)
# Inside each block between lanes, there are 2 rows:
# base_v + 7.5, and base_v + 17.0
# Distance between the two rows = 9.5m
# Distance from rows to lanes = 7.5m and 5.0m
lanes_v = [4096, 4122, 4148, 4174, 4200, 4226, 4252, 4278, 4304, 4330]

rows_v = []
for lv in lanes_v[:-1]:
    rows_v.append(lv + 7.5)
    rows_v.append(lv + 17.0)

print(f"Number of V rows: {len(rows_v)}")

# Columns in U:
# AH1 is at u = 0. Safe AH1 distance: houses at |u| >= 14m
# West columns:
# u = -16, -28, -42, -56, -70, -84, -98, -112, -126, -140
west_cols = [-16, -28, -42, -56, -70, -84, -98, -112, -126, -140]
# East columns:
# u = 16, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168, 182
east_cols = [16, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168, 182]

print(f"West cols: {len(west_cols)}, East cols: {len(east_cols)}")
total_slots = len(rows_v) * (len(west_cols) + len(east_cols))
print(f"Total available slots: {total_slots}")
