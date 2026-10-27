# Myanmar Town map work

For adding, changing, moving or deleting map/GeoJSON data, or investigating map scale and loading, use the repository skill `.agents/skills/map-data-management/SKILL.md`. It is the default map-data agent workflow. Use `.agents/skills/map-location-pipeline/SKILL.md` for spatial alignment, village geometry, roads, terrain and visual verification.

Keep new bulk map data out of eager TypeScript barrels (`ward.ts`, `villages/index.ts`) and global arrays. Use the bounded JSON tile path described in `docs/map-data-management.md`; existing small authored metadata can remain while individual legacy regions migrate. Do not silently replace detailed landmarks with generic boxes to meet a performance budget.

Every new streamed geometry adapter must register AND release its collision, walkable surfaces, labels and traffic data with its tile lifetime. Never create bot routes by connecting unrelated polygon bounding-box centres. Preserve per-region projection/scales and cross-border road continuity.

For map changes run the relevant tests, `npm run map:audit`, and `npm run build`. Use `npm test` when changing shared streaming/physics. Report data/cache scale tests separately from browser/device FPS. No claimed universal lag-free guarantee.

Respect concurrent working-tree changes. Do not regenerate entire villages from source just to move a small feature. Keep authored overrides in separate modules that generators import, as with `sithar/separationFields.ts`.
