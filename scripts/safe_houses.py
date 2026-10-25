import json
import math

with open('scripts/natmyaung_all_real_houses.json') as f:
    houses = json.load(f)

# Roads in UV:
ah1_u = 0.0
ew_lanes_v = [4140, 4162, 4184, 4206, 4228, 4250, 4272, 4294, 4316]
ns_lanes_u = [-26, 54]

# Minimum safe distance from road centerlines
min_dist_ah1 = 6.2  # AH1 width is 10m, centerline to edge is 5m
min_dist_lane = 4.8 # EW lanes width 5m, centerline to edge is 2.5m

nudged_count = 0
adjusted_houses = []

for h in houses:
    u = h['u']
    v = h['v']
    
    # Check AH1
    if abs(u - ah1_u) < min_dist_ah1:
        nudged_count += 1
        if u >= 0:
            u = ah1_u + min_dist_ah1 + 0.5
        else:
            u = ah1_u - min_dist_ah1 - 0.5
            
    # Check NS lanes
    for nsu in ns_lanes_u:
        if abs(u - nsu) < min_dist_lane:
            nudged_count += 1
            if u >= nsu:
                u = nsu + min_dist_lane + 0.3
            else:
                u = nsu - min_dist_lane - 0.3
                
    # Check EW lanes
    for ew_v in ew_lanes_v:
        if abs(v - ew_v) < min_dist_lane:
            nudged_count += 1
            if v >= ew_v:
                v = ew_v + min_dist_lane + 0.3
            else:
                v = ew_v - min_dist_lane - 0.3
                
    angle = math.pi / 4
    cosA = math.cos(angle)
    sinA = math.sin(angle)
    x = u * cosA + v * sinA
    z = -u * sinA + v * cosA
    
    h_copy = dict(h)
    h_copy['u'] = round(u, 2)
    h_copy['v'] = round(v, 2)
    h_copy['x'] = round(x, 2)
    h_copy['z'] = round(z, 2)
    adjusted_houses.append(h_copy)

# Verify mutual separation
print(f"Total houses: {len(adjusted_houses)}, nudged: {nudged_count}")
too_close = 0
for i in range(len(adjusted_houses)):
    for j in range(i + 1, len(adjusted_houses)):
        d = math.hypot(adjusted_houses[i]['x'] - adjusted_houses[j]['x'],
                       adjusted_houses[i]['z'] - adjusted_houses[j]['z'])
        if d < 2.5:
            too_close += 1

print(f"Pairs with distance < 2.5m: {too_close}")

with open('scripts/natmyaung_safe_houses.json', 'w') as f:
    json.dump(adjusted_houses, f, indent=2)
