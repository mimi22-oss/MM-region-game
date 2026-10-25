import { natmyaungRoadPlots } from './src/data/villages/natmyaung/natmyaungRoads.ts';
import { buildRoadGraph } from './src/game/robotRoutes.ts';
import fs from 'fs';

const houses = JSON.parse(fs.readFileSync('./scripts/natmyaung_all_real_houses.json', 'utf8'));

// Check how many houses collide with the road corridors
// Each road has center line from a to b.
// If a house bounding box intersects a segment within road_width/2 + house_size/2,
// then the road sample points might fall inside the house!

console.log(`Checking ${houses.length} houses against ${natmyaungRoadPlots.length} roads`);
