import re

with open('src/data/wards/myothar/center/myotharCenterBuildings.ts', 'r', encoding='utf-8') as f:
    content = f.read()

b_texts = re.findall(r'\{\s*"id":\s*"([^"]+)",\s*"osmId":\s*(\d+).*?"u":\s*(-?[\d.]+),\s*"v":\s*(-?[\d.]+)', content, re.DOTALL)
myothar_west = [float(m[3]) for m in b_texts if float(m[2]) < -300]
print(f'Myothar buildings with U < -300: {len(myothar_west)}')
if myothar_west:
    print('V range:', min(myothar_west), 'to', max(myothar_west))
