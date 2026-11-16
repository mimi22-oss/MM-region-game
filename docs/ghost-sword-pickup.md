# Automatic sword pickup

The unlocked football-field sword is collected immediately within 3.2m by a living player on foot. The E key, two-second hold and 20m ghost-clearance gate no longer apply. Three unique encounters still unlock the sword. Existing saved progress, HP, combat and vehicle unlocks are preserved.

The sword disappears from the field and attaches to the actual right hand. Boy/Girl GLBs, procedural humans and the robot are supported. Equipment follows animation, normalizes inherited scale, hides while riding/dead, survives leaving the mission scene, and restores after reload. Field/equipment instances share one cached asset and have a procedural fallback. Searches are throttled and do not cause per-frame React state changes.

Modified: src/game/missions/threeGhostsMission.ts; src/components/ThreeGhostsMissionScene.tsx; src/components/Player.tsx; src/components/ProceduralHuman.tsx; src/components/RobotCharacter.tsx; src/components/ThreeGhostsMissionHud.tsx; src/components/GhostDevMap.tsx; tests/ghostMissionRuntime.test.ts; docs/ghost-mission-v2-runtime.md.

Added: src/game/missions/ghostSwordAttachment.ts; src/components/GhostSwordModel.tsx; src/components/HeldGhostSword.tsx; tests/fixtures/ghostSwordPickup.html and .tsx; scripts/checkGhostSwordPickup.mjs; this report.

Validation: npm run test:ghost-mission passed 31/31; real-renderer browser checks passed all four characters with zero runtime exceptions, automatic pickup, range/lock rejection, nearby ghosts, hand parenting, scene unmount and reload persistence. npm run build passed TypeScript and Vite; existing chunk-size warning remains. Production Dev Map exclusion passed all 32 JS files. git diff --check passed. Evidence/screenshots: artifacts/ghost-sword-pickup/.

Android update is incomplete: cap copy failed with ENOSPC (C: free space 0), so no new APK was built. Temporary browser profile cleanup was rejected by automatic approval review as blocked by policy. The existing APK is the earlier revision. The generated Android web directory may contain a partial copy: free disk space and rerun npx cap copy android successfully before the next native build. Physical Android/touch-controller testing was not performed. Browser tests use real renderers with a proxy player transform. This remains the existing local mission, not new server-authoritative inventory.
