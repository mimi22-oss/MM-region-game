import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  CatBehaviorController,
  type CatState,
  CAT_SPOTS,
  localToWorld,
} from '../game/cat/catBehavior.ts';
import { playCatMeow } from '../game/cat/catAudio.ts';
import { homeAccess } from '../game/homeAccess.ts';

const CAT_MODEL_PATH = `${import.meta.env.BASE_URL}models/cat_animated_all.glb`.replace(/\/+/g, '/');

type BadgeMode = 'far' | 'near' | 'petting';

function createBadgeTexture(mode: BadgeMode): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 96);
    // Background pill
    if (mode === 'petting') {
      ctx.fillStyle = 'rgba(219, 39, 119, 0.92)';
      ctx.strokeStyle = '#f472b6';
    } else if (mode === 'near') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = '#34d399';
    }
    ctx.lineWidth = 4;

    const x = 6, y = 6, w = 244, h = 84, r = 22;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'petting') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('❤️ Purring... (E)', 128, 34);
      ctx.fillStyle = '#fbcfe8';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('ချစ်စနိုး ပွတ်သပ်နေသည်', 128, 66);
    } else if (mode === 'near') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('🐾 Pet (E)', 128, 34);
      ctx.fillStyle = '#bae6fd';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('ပွတ်သပ်ပေးရန် နှိပ်ပါ', 128, 66);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.fillText('🐱 ကြောင်လေး', 128, 48);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const badgeTextures: Partial<Record<BadgeMode, THREE.CanvasTexture>> = {};

function getBadgeTexture(mode: BadgeMode): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.Texture() as THREE.CanvasTexture;
  }
  if (!badgeTextures[mode]) {
    badgeTextures[mode] = createBadgeTexture(mode);
  }
  return badgeTextures[mode]!;
}

let catGltfPromise: Promise<GLTF> | null = null;
function loadCatGltf(): Promise<GLTF> {
  if (!catGltfPromise) {
    const loader = new GLTFLoader();
    catGltfPromise = loader.loadAsync(CAT_MODEL_PATH).catch((err) => {
      catGltfPromise = null;
      throw err;
    });
  }
  return catGltfPromise;
}

export function CatCompanion() {
  const groupRef = useRef<THREE.Group>(null);
  const badgeRef = useRef<THREE.Group>(null);
  const controller = useMemo(() => new CatBehaviorController('friendly'), []);
  const [activeState, setActiveState] = useState<CatState>(controller.state);
  const [isNearPlayer, setIsNearPlayer] = useState(false);
  const [petting, setPetting] = useState(false);
  const [loadedModel, setLoadedModel] = useState<{
    scene: THREE.Group;
    mixer: THREE.AnimationMixer;
    actions: Record<string, THREE.AnimationAction>;
  } | null>(null);

  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // Load and clone cat model
  useEffect(() => {
    let unmounted = false;
    loadCatGltf().then((gltf) => {
      if (unmounted) return;
      const cloned = clone(gltf.scene) as THREE.Group;
      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
        }
        if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
          child.frustumCulled = false;
        }
      });

      const mixer = new THREE.AnimationMixer(cloned);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const clip of gltf.animations) {
        actions[clip.name] = mixer.clipAction(clip);
      }

      setLoadedModel({ scene: cloned, mixer, actions });
    }).catch((err) => {
      console.warn('[CatCompanion] Failed to load model:', err);
    });

    return () => {
      unmounted = true;
    };
  }, []);

  // Smooth animation clip transitions based on activeState
  const switchAnimation = useCallback(
    (nextState: CatState) => {
      if (!loadedModel) return;
      const { actions } = loadedModel;

      let clipName = 'Idle';
      let loopMode: THREE.AnimationActionLoopStyles = THREE.LoopRepeat;
      let loopCount = Infinity;

      switch (nextState) {
        case 'SLEEPING':
          clipName = 'Sleep';
          break;
        case 'WAKING':
          clipName = 'WakeUp';
          loopMode = THREE.LoopOnce;
          loopCount = 1;
          break;
        case 'STRETCHING':
          clipName = 'Stretch';
          loopMode = THREE.LoopOnce;
          loopCount = 1;
          break;
        case 'WALKING':
        case 'FOLLOWING':
          clipName = 'Walk';
          break;
        case 'RUNNING':
          clipName = 'Run';
          break;
        case 'SITTING':
          clipName = 'Sit';
          break;
        case 'SIT_LOOK_UP':
          clipName = 'SitLookUp';
          break;
        case 'RUBBING':
          clipName = 'Rub';
          break;
        case 'PETTING':
          clipName = 'Petting';
          break;
        case 'GROOMING':
          clipName = 'Groom';
          break;
        case 'PLAYING':
          clipName = 'Play';
          break;
        case 'EATING':
          clipName = 'Eat';
          break;
        case 'LYING_DOWN':
          clipName = 'LieDown';
          loopMode = THREE.LoopOnce;
          loopCount = 1;
          break;
        case 'IDLE':
        default:
          clipName = 'Idle';
          break;
      }

      const nextAction = actions[clipName] ?? actions['Idle'];
      if (!nextAction || nextAction === currentActionRef.current) return;

      const prevAction = currentActionRef.current;
      currentActionRef.current = nextAction;

      nextAction.reset();
      nextAction.setLoop(loopMode, loopCount);
      nextAction.clampWhenFinished = loopMode === THREE.LoopOnce;

      if (prevAction) {
        prevAction.crossFadeTo(nextAction, 0.28, true);
        nextAction.play();
      } else {
        nextAction.fadeIn(0.2).play();
      }
    },
    [loadedModel]
  );

  useEffect(() => {
    switchAnimation(activeState);
  }, [activeState, switchAnimation]);

  // Petting interaction toggle
  const togglePetting = useCallback(() => {
    setPetting((prev) => {
      const next = !prev;
      controller.isPettingActive = next;
      if (next) {
        playCatMeow('chirp', 0.6);
      } else {
        playCatMeow('soft', 0.45);
      }
      return next;
    });
  }, [controller]);

  // Keyboard shortcut listener ('E') for petting when player is near
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && isNearPlayer) {
        togglePetting();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNearPlayer, togglePetting]);

  // Temp vectors for frame loop calculations
  const playerWorldVec = useRef(new THREE.Vector3());
  const playerObjRef = useRef<THREE.Object3D | null>(null);

  useFrame((rootState, delta) => {
    const dt = Math.min(delta, 0.1);

    // Update animation mixer
    if (loadedModel) {
      loadedModel.mixer.update(dt);
    }

    // Locate player in scene
    if (!playerObjRef.current || !playerObjRef.current.parent) {
      playerObjRef.current = rootState.scene.getObjectByName('player-avatar') ?? null;
    }

    let px = homeAccess.x;
    let pz = homeAccess.z;

    if (playerObjRef.current) {
      playerObjRef.current.getWorldPosition(playerWorldVec.current);
      if (Number.isFinite(playerWorldVec.current.x) && Number.isFinite(playerWorldVec.current.z)) {
        px = playerWorldVec.current.x;
        pz = playerWorldVec.current.z;
      }
    }

    // Distance in world coordinates between cat and player
    const catWorld = localToWorld(controller.lx, controller.lz);
    const distWorld = Math.hypot(px - catWorld.x, pz - catWorld.z);
    const near = distWorld < 2.5;
    if (near !== isNearPlayer) {
      setIsNearPlayer(near);
      if (!near && petting) {
        setPetting(false);
        controller.isPettingActive = false;
      }
    }

    // Update simulation controller
    controller.update(dt, px, pz);

    // Sync animation state
    if (controller.state !== activeState) {
      setActiveState(controller.state);
    }

    // Update 3D Group Transform (local to farmhouse)
    if (groupRef.current) {
      groupRef.current.position.set(controller.lx, controller.y, controller.lz);
      groupRef.current.rotation.y = controller.rotationY;
    }

    // Update interactive floating badge (billboarding toward active camera)
    if (badgeRef.current) {
      badgeRef.current.position.y = 0.58 + Math.sin(rootState.clock.elapsedTime * 3) * 0.035;
      badgeRef.current.quaternion.copy(rootState.camera.quaternion);
    }
  });

  const badgeMode: BadgeMode = petting ? 'petting' : isNearPlayer ? 'near' : 'far';

  return (
    <group name="cat-companion-system">
      {/* 3D Cat Model Instance */}
      <group
        ref={groupRef}
        position={[controller.lx, controller.y, controller.lz]}
        rotation={[0, controller.rotationY, 0]}
        scale={[0.62, 0.62, 0.62]}
        onClick={(e) => {
          e.stopPropagation();
          togglePetting();
        }}
        onPointerOver={() => {
          if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
        }}
      >
        {loadedModel && <primitive object={loadedModel.scene} />}

        {/* Floating 3D Cat Title / Petting Badge */}
        <group
          ref={badgeRef}
          position={[0, 0.58, 0]}
          onClick={(e) => {
            e.stopPropagation();
            togglePetting();
          }}
        >
          <mesh>
            <planeGeometry args={isNearPlayer ? [0.44, 0.165] : [0.32, 0.12]} />
            <meshBasicMaterial
              map={getBadgeTexture(badgeMode)}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* Cat Feeding Station near the kitchen annex */}
      <group
        name="cat-feeding-station"
        position={[CAT_SPOTS.kitchenBowls.lx, 0.165, CAT_SPOTS.kitchenBowls.lz]}
      >
        {/* Food Bowl */}
        <mesh position={[-0.16, 0.035, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.09, 0.07, 16]} />
          <meshStandardMaterial color="#f87171" roughness={0.3} />
        </mesh>
        {/* Kibble Pellets */}
        <mesh position={[-0.16, 0.062, 0]}>
          <cylinderGeometry args={[0.088, 0.088, 0.015, 12]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>

        {/* Water Bowl */}
        <mesh position={[0.16, 0.035, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.09, 0.07, 16]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.3} />
        </mesh>
        {/* Clean Water Surface */}
        <mesh position={[0.16, 0.062, 0]}>
          <cylinderGeometry args={[0.088, 0.088, 0.015, 12]} />
          <meshStandardMaterial color="#0284c7" metalness={0.1} roughness={0.1} transparent opacity={0.8} />
        </mesh>
      </group>

      {/* Cat Toy (Colorful Yarn Ball) in the Yard Garden */}
      <group
        name="cat-yarn-toy"
        position={[CAT_SPOTS.yardGarden.lx, 0.06, CAT_SPOTS.yardGarden.lz]}
      >
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#ec4899" roughness={0.8} />
        </mesh>
        {/* Yarn strand */}
        <mesh position={[0.05, -0.05, 0.04]} rotation={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
          <meshStandardMaterial color="#f472b6" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
