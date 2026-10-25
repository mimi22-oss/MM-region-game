import json
import math

with open('scripts/natmyaung_all_real_houses.json') as f:
    houses = json.load(f)

dists = []
for i, h in enumerate(houses):
    min_d = float('inf')
    for j, o in enumerate(houses):
        if i == j: continue
        d = math.hypot(h['u'] - o['u'], h['v'] - o['v'])
        if d < min_d: min_d = d
    dists.append(min_d)

print(f"Total houses: {len(houses)}")
print(f"Min neighbor distance: {min(dists):.2f}m")
print(f"Average neighbor distance: {sum(dists)/len(dists):.2f}m")
print(f"Houses with min distance < 4m: {sum(1 for d in dists if d < 4.0)}")
print(f"Houses with min distance < 5m: {sum(1 for d in dists if d < 5.0)}")
print(f"Houses with min distance < 6m: {sum(1 for d in dists if d < 6.0)}")
