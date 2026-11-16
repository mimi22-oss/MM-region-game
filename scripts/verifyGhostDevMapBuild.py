"""Verify the actual web output and, optionally, its packaged Android assets."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

forbidden = [b'GhostDevMap', 'GHOST DEV MAP — LIVE'.encode(),
             b'mm-ghost-debug-positions', b'GUARD ESTIMATE (no live entity)', b'APPROXIMATE SPAWN']
files = list(Path('dist/assets').rglob('*.js'))
assert files, 'Build dist first'
for file in files:
    data = file.read_bytes()
    assert not any(marker in data or marker in str(file).encode() for marker in forbidden), str(file)
result = {'webJsFiles': len(files), 'developerMapExcluded': True}
if len(sys.argv) > 1:
    with zipfile.ZipFile(sys.argv[1]) as apk:
        names = apk.namelist()
        js = [n for n in names if n.startswith('assets/public/') and n.endswith('.js')]
        assert js, 'No bundled JavaScript in APK'
        for name in js:
            assert not any(marker in apk.read(name) or marker in name.encode() for marker in forbidden), name
        for file in files:
            name = 'assets/public/' + file.relative_to('dist').as_posix()
            assert name in names, f'Missing current build: {name}'
            assert hashlib.sha256(apk.read(name)).digest() == hashlib.sha256(file.read_bytes()).digest(), name
        result.update(androidJsFiles=len(js), androidMatchesCurrentBuild=True, apk=sys.argv[1])
print(json.dumps(result))
