# 08 — Phase 5 Authoritative Multiplayer, Interest Management, Ghost Encounter & Combat Report

Date: 2026-11-16
Phase: **Phase 5 (Completed — Stop Gate Before Phase 6)**

---

## 1. Architecture & Implementation Summary

1. **Authoritative V2 Contracts (`shared/contracts/simulation.ts`, `shared/contracts/index.ts`, `shared/network.ts`)**:
   - Defined `AUTHORITATIVE_WORLD_ROOM` (`town-authoritative-v2`, `AUTHORITATIVE_PROTOCOL_VERSION = 2`), `WORLD_CELL_SIZE_M = 128`, `DEFAULT_INTEREST_RADIUS_M = 140`, `WORLD_TICK_RATE_HZ = 20` (`50 ms` tick), `PLAYER_MOVEMENT_LIMITS` (`walkMps: 3.2`, `runMps: 9.5`, `maxStepSec: 0.25`), `AUTHORITATIVE_HOME_SAFE_ZONE` (`174.891, 183.666`, radius `18`, retreat buffer `5`), `WAREHOUSE_GHOST_ENCOUNTER` (`35.149, 36.176`, max HP `120`), and `COMBAT_ABILITIES` (`light-strike`: 24 dmg / 650ms cd / 3.4m / 15 stamina; `ward-pulse`: 40 dmg / 1800ms cd / 6.5m / 30 stamina).
   - Enforced strict trust-boundary parsers (`parseJoinAuthoritativeOptions`, `parseMoveIntentPayload`, `parseCombatStrikePayload`, `parseClientIntentEnvelope`) rejecting client `x/y/z`, `damage`, `hp`, `role`, `isAdmin`, `speed`, and unexpected fields.

2. **HMAC Session Auth & Permission Boundary (`server/auth.ts`, `server/server.ts`, `src/game/mapPermissions.ts`)**:
   - Implemented HMAC-SHA256 signed session tokens (`issueSessionToken`, `verifySessionToken`, timing-safe signature validation, expiration checks) and guest `POST /auth/token` endpoint strictly issuing `'player'` roles regardless of client-supplied role fields.
   - Wired `setActiveAuthoritySession` + `resolveCurrentMapAccessContext` across `MapPortalPage.tsx` and `WardVillageEditor.tsx`: client `'admin'` defaults in `localStorage` or URL query parameters are automatically stripped to `'user'` when connected in `'server-authoritative'` mode unless the signed server token claims `'admin'`.

3. **Spatial Interest Management, Ghost Encounter & Combat (`server/interestManager.ts`, `server/worldSimulation.ts`, `server/TownAuthoritativeRoom.ts`)**:
   - Built `SpatialInterestGrid` (`WORLD_CELL_SIZE_M = 128`) partitioning players and the Warehouse Ghost encounter into cells and filtering per-client `'world-snapshot'` and `combatEvents` strictly inside `DEFAULT_INTEREST_RADIUS_M = 140m` (zero distant entity leakage over the wire).
   - Built `WorldSimulation` managing server movement reconciliation (unit vector validation + rolling per-second distance cap), Warehouse Ghost chase/grab/retreat AI enforcing `AUTHORITATIVE_HOME_SAFE_ZONE` on the server, reconnect reservation (`onDrop` / `allowReconnection` / `onReconnect` / `onLeave`), and server-authoritative combat (distance check, cooldown, stamina, PvP safe-zone protection, Ghost banishment, and safe-home KO respawn).

4. **Client Integration & Rollback Flag (`src/multiplayer/session.ts`, `src/multiplayer/MultiplayerPanel.tsx`, `src/multiplayer/RemotePlayers.tsx`, `src/components/Player.tsx`, `src/main.tsx`)**:
   - Preserved legacy `TownPresenceRoom` (`town-presence-v1`, `PROTOCOL_VERSION = 1`) untouched.
   - Added `VITE_MULTIPLAYER_MODE` / `?mpMode=presence-v1|authoritative-v2` + panel selector to toggle back cleanly to `presence-v1` while leaving offline single-player completely unchanged.

---

## 2. Measured Load Test & Verification Results

### Staged Load Test (`npm run server:loadtest` -> `scripts/benchmarkServerLoad.mjs`)
- **Stage 5A (Authenticated Movement + Spatial Interest + Warehouse Ghost Encounter, Combat OFF)**:
  - **64 synthetic bots (`200` ticks @ 20 Hz, `50 ms` budget)**: `avgTickMs: 0.464 ms`, `p95TickMs: 0.427 ms`, `maxTickMs: 25.293 ms`, `12,800` filtered snapshots built, **`76.19%` fan-out reduction** (`15` visible peers/observer vs `63` naive).
  - **32 real Colyseus WebSocket clients (`3,000 ms`, 4 spatial clusters)**: `1,872` snapshots delivered, `avgVisiblePeersPerSnapshot: 6.567`, server `avgTickMs: 0.137 ms`, `67` ticks reached.
- **Stage 5B (With Authoritative Combat Active)**:
  - **64 synthetic bots (`200` ticks @ 20 Hz, `50 ms` budget)**: `avgTickMs: 0.072 ms`, `p95TickMs: 0.146 ms`, `maxTickMs: 1.69 ms`, `108` combat events, **`74.968%` fan-out reduction**.
  - **32 real Colyseus WebSocket clients (`3,000 ms`, 4 spatial clusters)**: `1,915` snapshots delivered, `avgVisiblePeersPerSnapshot: 6.786`, server `avgTickMs: 0.053 ms`, `48` combat fan-out events, `19` out-of-range remote strike attempts rejected cleanly.

### Full Test, Audit & Build Suite (Run After Final Edits)
- **`npm run server:check`** (`tsc -p server/tsconfig.json`): **passed** (`exit 0`).
- **`npm run test:multiplayer`**: **18 / 18 passed** (`0` failed, `4,599.30 ms`), covering both `tests/multiplayer.test.ts` (`presence-v1`) and `tests/phase5Multiplayer.test.ts` (token verification, role downgrading, spatial wire isolation, movement/damage tamper rejection, impossible hit rejection, cooldown/stamina enforcement, server home protection, Ghost banishment, PvP respawn, and `presence-v1` rollback).
- **`npm test`**: **311 / 311 passed** (`0` failed, `0` skipped, `45,633.26 ms`).
- **`npm run map:audit`**: **passed** (`exit 0`, `4,973` eager features, `kanbale` streamed).
- **`npm run build` + `ota:manifest` + `ota:verify`**: **passed** (`433 modules`, `main-CvFaibYB.js` `2,198.58 kB` / gzip `490.66 kB`, `119` assets, `otaPublishable=true`).

> **Scope Notes:** Real multiplayer traffic was measured on loopback `127.0.0.1` WebSocket transport under synthetic/bot loads; WAN cellular latency jitter, physical device UI multiplayer walkthroughs, and multi-process Redis Colyseus presence horizontal scaling remain out of scope for Phase 5. Note also that the APK compiled in Phase 4 should be re-synced/rebuilt if distributing client Phase 5 UI inside Android APK, or web OTA assets synced once native compatibility allows.

---

## 3. Changed Files, Rollback & Gate

- **Added**: `shared/contracts/simulation.ts`, `server/auth.ts`, `server/interestManager.ts`, `server/worldSimulation.ts`, `server/TownAuthoritativeRoom.ts`, `scripts/benchmarkServerLoad.mjs`, `tests/phase5Multiplayer.test.ts`, `docs/architecture/08-phase5-multiplayer-combat-report.md`.
- **Modified**: `shared/contracts/index.ts`, `shared/network.ts`, `server/state.ts`, `server/server.ts`, `src/game/mapPermissions.ts`, `src/components/MapPortalPage.tsx`, `src/components/WardVillageEditor.tsx`, `src/multiplayer/session.ts`, `src/multiplayer/MultiplayerPanel.tsx`, `src/multiplayer/RemotePlayers.tsx`, `src/components/Player.tsx`, `src/main.tsx`, `package.json`.
- **Rollback**: Set `VITE_MULTIPLAYER_MODE=presence-v1` (or pass `?mpMode=presence-v1` / switch UI Mode dropdown to `Presence v1 (Rollback)`) to connect strictly to the original read-only `TownPresenceRoom` while leaving single-player offline mode untouched.
- **Next Gate**: Stop after Phase 5 and request explicit user approval before starting **Phase 6 (Marketplace, Shops, Inventory, Orders & Delivery Vertical Slice)**.
