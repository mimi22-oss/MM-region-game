import { homeBoundaryDistance } from '../game/playerHomeProtection';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Quaternion, Vector3, type Object3D } from 'three';
import { area5 } from '../data/wards/myothar/area5.ts';
import { sourceIsEdited } from '../game/worldEdits.ts';
import { GHOST_WAREHOUSE_ANCHOR, useGhostDevSettings } from '../game/ghostConfig.ts';
import { GHOST_IDS, useThreeGhostsMission } from '../game/missions/threeGhostsMission.ts';
import { periodAtMinute, type TimeMode } from '../game/environmentTime.ts';
import { gameAudio } from '../game/gameAudio.ts';
import {
  DEFAULT_HAUNTED_ZONE_CONFIG,
  hauntedGain,
  type HauntedZoneConfig,
} from '../game/audio/GhostAudioEventScheduler.ts';
import {
  warehouseZoneDistance,
  type WarehouseGeometry,
} from '../game/audio/warehouseSoundOrigins.ts';
import {
  WarehouseHorrorLoopPlayer,
  isWarehouseHorrorAudioActive,
} from '../game/audio/WarehouseHorrorLoopPlayer.ts';
import { setWarehouseZoneDiagnostics } from '../game/audio/horrorAudioDiagnostics.ts';

export interface HauntedWarehouseAudioZoneProps {
  enabled: boolean;
  minute: number;
  timeMode: TimeMode;
  soundEnabled: boolean;
  soundVolume?: number;
  paused?: boolean;
  seed?: number;
  config?: HauntedZoneConfig;
  occlusion?: boolean;
  onDiagnostics?: (value: {
    sources: number;
    nodes: number;
    disposed: boolean;
    band: string;
    bedMode?: string;
    preloaded?: boolean;
    inZone?: boolean;
    distanceM?: number;
  }) => void;
}

const APPROACH_PRELOAD_DISTANCE_M = 95;

/**
 * Haunted Warehouse Audio Zone (`ဂိုဒေါင်ထဲ စဝင်တာနဲ့ arctsound-horror-576085 loop ဖွင့်ပေးခြင်း`)
 * Replaces all procedural/code-generated warehouse beds and random sound effects with
 * a single clean sampled horror track loop as soon as the player enters Warehouse Row.
 */
export function HauntedWarehouseAudioZone({
  enabled,
  minute,
  timeMode,
  soundEnabled,
  soundVolume = 1,
  paused = false,
  config = DEFAULT_HAUNTED_ZONE_CONFIG,
  onDiagnostics,
}: HauntedWarehouseAudioZoneProps) {
  const devSettings = useGhostDevSettings();
  const missionProgress = useThreeGhostsMission();
  const hasLivingGhosts = GHOST_IDS.some((id) => missionProgress.hp[id] > 0);
  const period = timeMode === 'auto' ? periodAtMinute(minute) : timeMode;
  const ambienceAllowed = isWarehouseHorrorAudioActive({
    enabled,
    minute,
    timeMode,
    soundEnabled,
    soundVolume,
    paused,
    forceActive: devSettings.forceActive,
    hasLivingGhosts,
  });
  const loopPlayerRef = useRef<WarehouseHorrorLoopPlayer | null>(null);
  const buildingsRef = useRef<WarehouseGeometry[]>([]);
  const scratch = useMemo(
    () => ({
      position: new Vector3(),
      forward: new Vector3(),
      up: new Vector3(),
      rotation: new Quaternion(),
      player: new Vector3(),
    }),
    [],
  );
  const player = useRef<Object3D | null>(null);
  const elapsed = useRef(0);
  const inZoneRef = useRef(false);

  useEffect(() => {
    const detach = gameAudio.attach();
    buildingsRef.current = area5.warehouses.filter((w) => !sourceIsEdited(w.id));
    loopPlayerRef.current = new WarehouseHorrorLoopPlayer();
    return () => {
      loopPlayerRef.current?.dispose();
      loopPlayerRef.current = null;
      setWarehouseZoneDiagnostics({
        band: 'outside',
        inZone: false,
        preloaded: false,
        distanceM: null,
        period,
        bedMode: 'inactive',
        sources: 0,
        nodes: 0,
        disposed: true,
      });
      detach();
    };
  }, []);

  useFrame(({ camera, scene }, dt) => {
    const loopPlayer = loopPlayerRef.current;
    if (!loopPlayer) return;

    camera.getWorldPosition(scratch.position);
    camera.getWorldQuaternion(scratch.rotation);
    scratch.forward.set(0, 0, -1).applyQuaternion(scratch.rotation);
    scratch.up.set(0, 1, 0).applyQuaternion(scratch.rotation);
    gameAudio.listener(
      scratch.position.x,
      scratch.position.y,
      scratch.position.z,
      scratch.forward.x,
      scratch.forward.y,
      scratch.forward.z,
      scratch.up.x,
      scratch.up.y,
      scratch.up.z,
    );

    elapsed.current += Math.min(dt, 0.25);
    if (elapsed.current < 0.1) return;
    const step = elapsed.current;
    elapsed.current = 0;

    if (!player.current?.parent) player.current = scene.getObjectByName('player-avatar') ?? null;
    if (player.current) player.current.getWorldPosition(scratch.player);
    else scratch.player.copy(scratch.position);

    const distance = warehouseZoneDistance(
      scratch.player.x,
      scratch.player.z,
      GHOST_WAREHOUSE_ANCHOR,
      buildingsRef.current,
    );

    if (ambienceAllowed && distance <= APPROACH_PRELOAD_DISTANCE_M) {
      loopPlayer.preload();
    }

    const audioRunning = !document.hidden && gameAudio.context?.state === 'running';
    const ambienceRunning = ambienceAllowed && audioRunning;

    if (!ambienceRunning || distance > config.distances[0] + config.hysteresis) {
      inZoneRef.current = false;
    } else if (distance <= config.distances[0]) {
      inZoneRef.current = true;
    }

    const homeDist = homeBoundaryDistance(scratch.player.x, scratch.player.z);
    const homeIntensity = homeDist <= 0 ? 0 : Math.max(0.1, Math.min(1, homeDist / 20));
    const zoneGain = (0.35 + 0.65 * hauntedGain(distance, config.distances[0])) * homeIntensity;
    const diag = loopPlayer.update(
      ambienceRunning && inZoneRef.current && homeIntensity > 0,
      zoneGain * 0.85,
      step,
    );

    const band = inZoneRef.current ? 'ambience' : 'outside';
    setWarehouseZoneDiagnostics({
      band,
      inZone: inZoneRef.current,
      preloaded: loopPlayer.isPreloaded,
      distanceM: Number.isFinite(distance) ? Math.round(distance * 10) / 10 : null,
      period,
      bedMode: diag.bedMode,
      sources: diag.sources,
      nodes: diag.nodes,
      disposed: diag.disposed,
    });
    onDiagnostics?.({
      ...diag,
      band,
      preloaded: loopPlayer.isPreloaded,
      inZone: inZoneRef.current,
      distanceM: distance,
    });
  });

  useEffect(() => {
    if (!ambienceAllowed) {
      loopPlayerRef.current?.update(false, 0, 0.2);
      inZoneRef.current = false;
    }
  }, [ambienceAllowed]);

  return null;
}
