import json
import math

with open('scripts/natmyaung_safe_houses.json') as f:
    houses = json.load(f)

# Sort houses by (v, u)
houses.sort(key=lambda h: (h['v'], h['u']))

# Deduplicate or nudge
final_houses = []
for h in houses:
    too_close = False
    for fh in final_houses:
        d = math.hypot(h['u'] - fh['u'], h['v'] - fh['v'])
        if d < 2.8:
            too_close = True
            break
    if not too_close:
        final_houses.append(h)

print(f"Houses after 2.8m mutual clearance: {len(final_houses)}")

# Let's verify road clearance:
ah1_u = 0.0
ew_lanes_v = [4140, 4162, 4184, 4206, 4228, 4250, 4272, 4294, 4316]
ns_lanes_u = [-26, 54]

violations = 0
for h in final_houses:
    if abs(h['u'] - ah1_u) < 5.8:
        violations += 1
    for nsu in ns_lanes_u:
        if abs(h['u'] - nsu) < 4.5:
            violations += 1
    for ew in ew_lanes_v:
        if abs(h['v'] - ew) < 4.5:
            violations += 1

print(f"Road clearance violations: {violations}")

with open('scripts/natmyaung_final_houses.json', 'w') as f:
    json.dump(final_houses, f, indent=2)
