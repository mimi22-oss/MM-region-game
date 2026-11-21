import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { kalayVillages, ward } from '../src/data/ward.ts';
import { myotharCenterBuildings } from '../src/data/wards/myothar/center/myotharCenterBuildings.ts';
import { kalayArea1Buildings } from '../src/data/wards/kalayArea1/kalayArea1Buildings.ts';

const unique = (items) => new Map(items.map((x) => [x.id, x])).size;
const regions = [
  { ...ward, id: 'myothar', houses: [...ward.houses, ...myotharCenterBuildings, ...kalayArea1Buildings] },
  ...kalayVillages,
].map((r) => ({
  id: r.id,
  streamed: Boolean(r.streamed),
  buildings: unique(r.houses),
  roads: unique(r.roads),
  fields: unique([...(r.fields ?? []), ...(r.bundedFields ?? []), ...(r.separationFields ?? [])]),
  trees: unique([...(r.trees ?? []), ...(r.largeTrees ?? []), ...(r.farmTrees ?? [])]),
}));

const streamedDatasets = [];
for (const metaPath of [
  'src/data/sitharFieldDataset.json',
  'src/data/kanbaleDataset.json',
  'src/data/tharsiZombieForestDataset.json',
  'src/data/weipulaChinVillageDataset.json',
]) {
  try {
    const config = JSON.parse(await readFile(metaPath, 'utf8'));
    const manifestRel = String(config.manifest ?? '').replace(/^\/+/, '');
    const manifest = JSON.parse(await readFile(join('public', manifestRel), 'utf8'));
    streamedDatasets.push({
      dataset: manifest.dataset,
      regionId: manifest.regionId ?? config.regionId ?? undefined,
      schemaVersion: manifest.schemaVersion,
      version: manifest.version,
      tiles: manifest.tiles.length,
      featureCount: manifest.featureCount,
      maxTileBytes: Math.max(0, ...manifest.tiles.map((t) => t.bytes)),
    });
  } catch {
    // Ignore missing optional streamed dataset
  }
}

console.log(
  JSON.stringify(
    {
      architecture: 'hybrid eager legacy + versioned spatial chunks',
      regions,
      totalEagerFeatures: regions.reduce((n, r) => n + r.buildings + r.roads + r.fields + r.trees, 0),
      streamedDatasets,
      newDataPath: 'scripts/mapTiles.mjs -> public/map/<dataset>/<version>/manifest.json -> openMapDataset',
      note: 'Tile/JSON budgets bound streamed dataset residency; this audit does not measure browser FPS, GPU or total JS heap.',
    },
    null,
    2,
  ),
);
