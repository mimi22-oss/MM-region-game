import json, math

with open('map/myothar-center-combined.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

polys = [f for f in data['features'] if f['geometry']['type'] == 'Polygon']
lines = [f for f in data['features'] if f['geometry']['type'] == 'LineString']

kanbale_lon = 94.064442
kanbale_lat = 23.163868
kanbale_u = 160.0
kanbale_v = -252.0
m_per_deg_lat = 110750.0
m_per_deg_lon = 102280.0
angle = 0.052
cosA = math.cos(angle)
sinA = math.sin(angle)

def uv_to_world(u, v):
    return u * cosA + v * sinA, -u * sinA + v * cosA

def geo_to_uv(lon, lat):
    u = kanbale_u + (lon - kanbale_lon) * m_per_deg_lon
    v = kanbale_v - (lat - kanbale_lat) * m_per_deg_lat
    return u, v

# Extract roads world points
road_segments = []
for r in lines:
    coords = r['geometry']['coordinates']
    wpts = [uv_to_world(*geo_to_uv(c[0], c[1])) for c in coords]
    for i in range(len(wpts)-1):
        road_segments.append((wpts[i], wpts[i+1]))

print(f"Total road segments: {len(road_segments)}")

def dist_point_to_segment(px, pz, p1, p2):
    x1, z1 = p1
    x2, z2 = p2
    dx = x2 - x1
    dz = z2 - z1
    l2 = dx*dx + dz*dz
    if l2 == 0:
        return math.hypot(px - x1, pz - z1), (x1, z1)
    t = max(0.0, min(1.0, ((px - x1)*dx + (pz - z1)*dz) / l2))
    proj_x = x1 + t*dx
    proj_z = z1 + t*dz
    return math.hypot(px - proj_x, pz - proj_z), (proj_x, proj_z)

def closest_road_dir(cx, cz):
    min_dist = 1e9
    best_proj = (cx, cz)
    for p1, p2 in road_segments:
        d, proj = dist_point_to_segment(cx, cz, p1, p2)
        if d < min_dist:
            min_dist = d
            best_proj = proj
    # Vector from center to nearest road
    vx = best_proj[0] - cx
    vz = best_proj[1] - cz
    return min_dist, math.atan2(vz, vx) # angle towards road

print("Testing road direction for Building 1:")
d, ang = closest_road_dir(404.5, -906.3)
print(f"Distance to road: {d:.1f}m, angle: {math.degrees(ang):.1f} deg")
