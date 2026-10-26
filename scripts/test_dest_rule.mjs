import assert from 'node:assert/strict';
import { detectLocation, MAP_DESTINATIONS, toLocalUV } from '../src/game/locationDetect.ts';

const dest = MAP_DESTINATIONS.find(d => d.id === 'kanbale-rice-mill');
console.log('Current kanbale-rice-mill destination:', dest);
const loc = detectLocation(dest.x, dest.z);
console.log('Detected location at destination:', loc);
assert.equal(loc.id, dest.id);
console.log('Assertion passed for current!');
