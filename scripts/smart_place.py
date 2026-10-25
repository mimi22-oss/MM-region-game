import json
import math

with open('scripts/natmyaung_all_real_houses.json') as f:
    houses = json.load(f)

# Sort houses by (v, u)
houses.sort(key=lambda h: (h['v'], h['u']))

ah1_u = 0.0
ew_lanes_v = [4140, 4162, 4184, 4206, 4228, 4250, 4272, 4294, 4316]
ns_lanes_u = [-26, 54]

min_dist_ah1 = 6.0
min_dist_lane = 4.6

placed = []
for h in houses:
    u = h['u']
    v = h['v']
    
    # Nudge away from AH1
    if abs(u - ah1_u) < min_dist_ah1:
        u = ah1_u + (min_dist_ah1 + 0.4 if u >= 0 else -(min_dist_ah1 + 0.4))
        
    # Nudge away from NS lanes
    for nsu in ns_lanes_u:
        if abs(u - nsu) < min_dist_lane:
            u = nsu + (min_dist_lane + 0.3 if u >= nsu else -(min_dist_lane + 0.3))
            
    # Nudge away from EW lanes
    for ew in ew_lanes_v:
        if abs(v - ew) < min_dist_lane:
            v = ew + (min_dist_lane + 0.3 if v >= ew else -(min_dist_lane + 0.3))
            
    # Try current position or small u offsets (+- 1.4m, +- 2.8m)
    best_u, best_v = u, v
    found_spot = False
    for du in [0, 1.4, -1.4, 2.8, -2.8, 4.2, -4.2]:
        cand_u = u + du
        cand_v = v
        # Ensure road clearance for candidate
        if abs(cand_u - ah1_u) < min_dist_ah1: continue
        if any(abs(cand_u - nsu) < min_dist_lane for nsu in ns_lanes_u): continue
        if any(abs(cand_v - ew) < min_dist_lane for ew in ew_lanes_v): continue
        
        # Check distance to already placed houses
        collision = False
        for p in placed:
            if math.hypot(cand_u - p['u'], cand_v - p['v']) < 2.6:
                collision = True
                break
        if not collision:
            best_u, best_v = cand_u, cand_v
            found_spot = True
            break
            
    if found_spot:
        angle = math.pi / 4
        cosA = math.cos(angle)
        sinA = math.sin(angle)
        x = best_u * cosA + best_v * sinA
        z = -best_u * sinA + best_v * cosA
        h_copy = dict(h)
        h_copy['u'] = round(best_u, 2)
        h_copy['v'] = round(best_v, 2)
        h_copy['x'] = round(x, 2)
        h_copy['z'] = round(z, 2)
        placed.append(h_copy)

print(f"Successfully placed {len(placed)} houses out of {len(houses)}!")
with open('scripts/natmyaung_final_houses.json', 'w') as f:
    json.dump(placed, f, indent=2)
