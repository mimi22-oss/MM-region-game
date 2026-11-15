import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Raycaster, Vector3, type Object3D } from 'three';
import { ward } from '../data/ward.ts';
import { createCameraObstructionQuery } from '../game/cameraObstruction.ts';
import { sceneGround } from '../game/groundSurface.ts';
import { createIntroCameraPath, type IntroCameraPath } from '../game/IntroCameraPath.ts';
import {
  completeIntro,
  getIntroState,
  stepIntro,
  useIntroState,
} from '../game/IntroStateMachine.ts';
import { mobileQuality } from '../game/sceneBudget.ts';

function smoothstep(x: number, edge0: number, edge1: number): number {
  const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Owns R3F camera transform + streaming `camera.userData.viewFocus` during the drone intro,
 * enforces live terrain and building clearance, and hands off seamlessly to `Player`.
 */
export function CinematicIntroController() {
  const intro = useIntroState();
  const { camera, scene, invalidate } = useThree();

  const pathEntry = useRef<{ runId: number; path: IntroCameraPath } | null>(null);
  const avatarRef = useRef<Object3D | null>(null);
  const tmpPos = useRef(new Vector3());
  const tmpLook = useRef(new Vector3());
  const tmpFocus = useRef({ x: ward.spawn.x, z: ward.spawn.z });
  const tmpOffset = useRef(new Vector3());
  const ray = useRef(new Raycaster());
  const downRay = useRef(new Raycaster());
  const downOrigin = useRef(new Vector3());
  const downDir = useMemo(() => new Vector3(0, -1, 0), []);
  const cameraObstruction = useMemo(createCameraObstructionQuery, []);

  useLayoutEffect(() => {
    if (!intro.active || !intro.target) {
      pathEntry.current = null;
      avatarRef.current = null;
      return;
    }

    if (pathEntry.current?.runId !== intro.runId) {
      const ground = sceneGround(scene, 0);
      const origin =
        intro.originX !== null && intro.originZ !== null
          ? { x: intro.originX, z: intro.originZ }
          : null;

      const path = createIntroCameraPath(intro.target, {
        townCenter: { x: ward.spawn.x, z: ward.spawn.z },
        origin,
        sampleSurfaceHeight: (x, z) => ground.height(x, z),
        mobile: mobileQuality,
        reducedMotion: intro.reducedMotion,
      });

      pathEntry.current = { runId: intro.runId, path };
      avatarRef.current = scene.getObjectByName('player-avatar') ?? null;

      path.evaluate(
        intro.progress,
        tmpPos.current,
        tmpLook.current,
        tmpFocus.current,
        (x, z) => ground.height(x, z),
      );
      camera.position.copy(tmpPos.current);
      camera.lookAt(tmpLook.current);
      camera.userData.viewFocus = tmpFocus.current;
      invalidate();
    }
  }, [intro.active, intro.runId, intro.target, intro.originX, intro.originZ, intro.reducedMotion, camera, scene, invalidate]);

  useFrame(({ camera: frameCamera, scene: frameScene, clock }, delta) => {
    const state = getIntroState();
    if (!state.active || !state.target) return;

    let entry = pathEntry.current;
    const ground = sceneGround(frameScene, clock.elapsedTime);
    const groundHeight = (x: number, z: number) => ground.height(x, z);

    if (!entry || entry.runId !== state.runId) {
      const origin =
        state.originX !== null && state.originZ !== null
          ? { x: state.originX, z: state.originZ }
          : null;
      const path = createIntroCameraPath(state.target, {
        townCenter: { x: ward.spawn.x, z: ward.spawn.z },
        origin,
        sampleSurfaceHeight: groundHeight,
        mobile: mobileQuality,
        reducedMotion: state.reducedMotion,
      });
      entry = { runId: state.runId, path };
      pathEntry.current = entry;
      avatarRef.current = frameScene.getObjectByName('player-avatar') ?? null;
    }

    const step = stepIntro(delta);
    entry.path.evaluate(
      step.progress,
      tmpPos.current,
      tmpLook.current,
      tmpFocus.current,
      groundHeight,
    );

    const playerAvatar = avatarRef.current ?? (avatarRef.current = frameScene.getObjectByName('player-avatar') ?? null);

    // Clear building roofs/canopies cleanly during descent & flyover before final reveal.
    if (!state.reducedMotion && step.progress >= 0.42 && step.progress < 0.92) {
      const roofProbeCeiling = tmpPos.current.y + 42;
      downOrigin.current.set(tmpPos.current.x, roofProbeCeiling, tmpPos.current.z);
      downRay.current.set(downOrigin.current, downDir);
      downRay.current.far = 44;
      const roofHit = cameraObstruction(downRay.current, frameScene, playerAvatar, false, null);
      if (roofHit) {
        const hitTopY = roofProbeCeiling - roofHit.distance;
        const localGround = groundHeight(tmpPos.current.x, tmpPos.current.z);
        if (hitTopY > localGround + 1.2) {
          const liftWeight = 1 - smoothstep(step.progress, 0.84, 0.92);
          const safeRoofFloor = hitTopY + 5.5;
          if (safeRoofFloor > tmpPos.current.y) {
            tmpPos.current.y = MathUtils.lerp(tmpPos.current.y, safeRoofFloor, liftWeight);
          }
        }
      }
    }

    // Match Player.tsx final obstruction pull-in smoothly during reveal -> handoff.
    const obstructionBlend = smoothstep(step.progress, 0.88, 0.98);
    if (obstructionBlend > 0.001 && state.target.distance <= 10 && state.target.pitch > -0.85) {
      tmpOffset.current.copy(tmpPos.current).sub(tmpLook.current);
      const dist = tmpOffset.current.length();
      if (dist > 1e-5) {
        tmpOffset.current.multiplyScalar(1 / dist);
        ray.current.set(tmpLook.current, tmpOffset.current);
        ray.current.far = dist;
        const hit = cameraObstruction(ray.current, frameScene, playerAvatar, false, null);
        if (hit) {
          const safeDist = Math.max(0.15, hit.distance - 0.3);
          const blendedDist = MathUtils.lerp(dist, safeDist, obstructionBlend);
          tmpPos.current.copy(tmpLook.current).addScaledVector(tmpOffset.current, blendedDist);
        }
      }
    }

    frameCamera.position.copy(tmpPos.current);
    frameCamera.lookAt(tmpLook.current);
    frameCamera.userData.viewFocus = tmpFocus.current;

    if (step.reachedEnd) {
      pathEntry.current = null;
      completeIntro();
    }
  }, -2);

  return null;
}
