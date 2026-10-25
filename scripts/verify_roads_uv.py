import json
import math

with open('scripts/natmyaung_all_real_houses.json') as f:
    houses = json.load(f)

# Rotation angle is Math.PI / 4
angle = math.pi / 4
cosA = math.cos(angle)
sinA = math.sin(angle)

def to_uv(x, z):
    u = x * cosA - z * sinA
    v = x * sinA + z * cosA
    return u, v

def to_world(u, v):
    x = u * cosA + v * sinA
    z = -u * sinA + v * cosA
    return x, z

# In natmyaungRoadPlots:
# AH1 is along u=0 (in world coords: x = v*sinA, z = v*cosA)
# The EW lanes are along v = [4130, 4152, 4174, 4196, 4218, 4240, 4262, 4284, 4306]
# Let's inspect the current RoadPlots from natmyaungRoads.ts
# In natmyaungRoads.ts:
# natmyaungRoadPlots has:
# AH1 highway: x=2983.99, z=2983.99, width=10.0, depth=220.0, rot=pi/4
# Since rot=pi/4 and width < depth: line is from (x-s*d/2, z-c*d/2) to (x+s*d/2, z+c*d/2)
# Here s = sin(pi/4), c = cos(pi/4).
# So AH1 runs along world (x, z) where x=z, which corresponds to u=0, v from 4110 to 4330!
# And EW lane k:
# x=2945.10 + (k-1)*15.556, z=2909.74 + (k-1)*15.556
# Since width=120, depth=5, horizontal=true:
# d = (c*w/2, -s*w/2). So it runs along (x+t, z-t), which corresponds to constant v, varying u from -60 to +60!
# Each lane is separated by Delta x = Delta z = 15.556m in world, which is Delta v = 22.0m in UV!
# Specifically:
# Lane 1: v = 4140
# Lane 2: v = 4162
# Lane 3: v = 4184
# Lane 4: v = 4206
# Lane 5: v = 4228
# Lane 6: v = 4250
# Lane 7: v = 4272
# Lane 8: v = 4294
# Lane 9: v = 4316
# NS East lane: u = 54, v in [4140, 4316]
# NS West lane: u = -26, v in [4250, 4316]

# Let's verify this exact correspondence:
print("UV check:")
for i, v_val in enumerate([4140, 4162, 4184, 4206, 4228, 4250, 4272, 4294, 4316], 1):
    w = to_world(0, v_val)
    print(f"Lane {i}: v={v_val} -> world x={w[0]:.2f}, z={w[1]:.2f}")

# And AH1:
w_ah1 = to_world(0, 4220)
print(f"AH1 center: v=4220 -> world x={w_ah1[0]:.2f}, z={w_ah1[1]:.2f}")
