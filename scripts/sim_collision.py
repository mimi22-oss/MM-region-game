import math

# We can simulate the exact buildRoadGraph and collision logic
rot = math.pi / 4
cosA = math.cos(rot)
sinA = math.sin(rot)

def to_world(u, v):
    return u * cosA + v * sinA, -u * sinA + v * cosA

def to_uv(x, z):
    return x * cosA - z * sinA, x * sinA + z * cosA

# Road plots:
# AH1: u = 0, v in [4090, 4340], width = 10, depth = 250, rot = pi/4, main = True
# 9 EW lanes: v in [4122, 4148, 4174, 4200, 4226, 4252, 4278, 4304, 4330], width = 380, depth = 5, rot = pi/4, main = False

PLAYER_RADIUS = 0.4

def house_blocks(x, z, h):
    dx = x - h['x']
    dz = z - h['z']
    c = math.cos(h['rotation'])
    s = math.sin(h['rotation'])
    lx = dx * c - dz * s
    lz = dx * s + dz * c
    return abs(lx) <= h['width'] / 2 + PLAYER_RADIUS and abs(lz) <= h['depth'] / 2 + PLAYER_RADIUS

print("Verification helper loaded.")
