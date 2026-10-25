import json

with open('scripts/extracted_houses.json') as f:
    all_houses = json.load(f)

with open('scripts/natmyaung_real_houses.json') as f:
    boundary_houses = json.load(f)

print(f"Total extracted: {len(all_houses)}")
print(f"Inside boundary: {len(boundary_houses)}")

# Check houses in eastern cluster (u > 80, 4180 <= v <= 4270)
east_cluster = [h for h in all_houses if h['u'] > 75 and 4180 <= h['v'] <= 4270]
print(f"East cluster houses: {len(east_cluster)}")

# Let's see if we should combine boundary_houses + east_cluster
combined = list(boundary_houses)
existing_keys = set((round(h['u'], 1), round(h['v'], 1)) for h in combined)

added_east = 0
for h in east_cluster:
    key = (round(h['u'], 1), round(h['v'], 1))
    if key not in existing_keys:
        # Check minimum distance
        too_close = False
        for ex in combined:
            if ((h['u'] - ex['u'])**2 + ((h['v'] - ex['v']))**2)**0.5 < 3.2:
                too_close = True
                break
        if not too_close:
            combined.append(h)
            added_east += 1

print(f"Added {added_east} houses from east cluster. Total now: {len(combined)}")

with open('scripts/natmyaung_all_real_houses.json', 'w') as f:
    json.dump(combined, f, indent=2)
