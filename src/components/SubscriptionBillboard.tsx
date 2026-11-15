import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  DEFAULT_SUBSCRIPTION_BILLBOARD,
  type SubscriptionBillboardConfig,
} from '../data/subscriptionBillboard';
import {
  canInteractAtDistance,
  distanceToBillboardXZ,
  getSubscriptionShopState,
  markBillboardPointerConsumed,
  openSubscriptionShop,
  registerBillboardTapHandler,
  setSubscriptionPlayerDistance,
  type SubscriptionTriggerSource,
  useSubscriptionShop,
} from '../game/subscriptionShop';
import { useRegionFrame as useFrame } from './RegionActivity';

interface SubscriptionBillboardProps {
  config?: SubscriptionBillboardConfig;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function createSubscriptionBillboardTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#091326');
    bg.addColorStop(0.5, '#112240');
    bg.addColorStop(1, '#0b182e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const glowTopRight = ctx.createRadialGradient(w * 0.84, h * 0.16, 20, w * 0.84, h * 0.16, 360);
    glowTopRight.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    glowTopRight.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glowTopRight;
    ctx.fillRect(0, 0, w, h);

    const glowBottomLeft = ctx.createRadialGradient(w * 0.18, h * 0.86, 20, w * 0.18, h * 0.86, 320);
    glowBottomLeft.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    glowBottomLeft.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = glowBottomLeft;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, 22, 22, w - 44, h - 44, 28);
    ctx.stroke();

    // Header badge
    drawRoundedRect(ctx, 56, 52, 336, 48, 24);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(84, 76, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#bae6fd';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DIGITAL STORE · LIVE WEB', 104, 77);

    // Status pill top-right
    drawRoundedRect(ctx, w - 260, 52, 204, 48, 24);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
    ctx.stroke();
    ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#6ee7b7';
    ctx.textAlign = 'center';
    ctx.fillText('ONLINE SHOP', w - 158, 77);

    // Storefront icon tile
    drawRoundedRect(ctx, 56, 134, 108, 108, 24);
    const iconGrad = ctx.createLinearGradient(56, 134, 164, 242);
    iconGrad.addColorStop(0, '#0ea5e9');
    iconGrad.addColorStop(1, '#2563eb');
    ctx.fillStyle = iconGrad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    drawRoundedRect(ctx, 82, 168, 56, 48, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(110, 168, 16, Math.PI, 0, false);
    ctx.stroke();

    // Main title & subtitle
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 62px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, 190, 174);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(subtitle, 192, 226);

    // Divider
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(56, 272);
    ctx.lineTo(w - 56, 272);
    ctx.stroke();

    // Category cards
    const cards = [
      { label: 'AI & WORK', name: 'Pro Tools', tag: 'Instant Access', accent: '#38bdf8' },
      { label: 'STREAMING', name: 'Media Plans', tag: 'MMK Checkout', accent: '#34d399' },
      { label: 'ACCOUNTS', name: 'Orders & Login', tag: 'Live Portal', accent: '#fbbf24' },
    ];
    const cardW = 282;
    const cardGap = 33;
    const startX = 56;
    cards.forEach((card, i) => {
      const cx = startX + i * (cardW + cardGap);
      const cy = 302;
      drawRoundedRect(ctx, cx, cy, cardW, 176, 20);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = card.accent;
      drawRoundedRect(ctx, cx + 22, cy + 22, 128, 30, 15);
      ctx.fill();
      ctx.fillStyle = '#082f49';
      ctx.font = '800 16px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.label, cx + 86, cy + 38);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 30px system-ui, -apple-system, sans-serif';
      ctx.fillText(card.name, cx + 22, cy + 96);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(card.tag, cx + 22, cy + 138);
    });

    // Bottom CTA button bar
    const ctaGrad = ctx.createLinearGradient(56, 512, w - 56, 592);
    ctaGrad.addColorStop(0, '#0284c7');
    ctaGrad.addColorStop(1, '#0d9488');
    drawRoundedRect(ctx, 56, 512, w - 112, 80, 22);
    ctx.fillStyle = ctaGrad;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 32px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLICK / TAP TO OPEN SUBSCRIPTION SHOP  ▸', w * 0.5, 553);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function SubscriptionBillboard({
  config = DEFAULT_SUBSCRIPTION_BILLBOARD,
}: SubscriptionBillboardProps) {
  const { camera, gl, scene } = useThree();
  const rootRef = useRef<THREE.Group>(null);
  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const worldPosRef = useRef(new THREE.Vector3());
  const forwardRef = useRef(new THREE.Vector3(0, 0, 1));
  const playerPosRef = useRef(new THREE.Vector3());
  const camDeltaRef = useRef(new THREE.Vector3());
  const sampleTimerRef = useRef(0.25);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const [hovered, setHovered] = useState(false);
  const shop = useSubscriptionShop();

  const screenTexture = useMemo(
    () => createSubscriptionBillboardTexture(config.title, config.subtitle),
    [config.title, config.subtitle],
  );

  useEffect(() => {
    return () => {
      screenTexture.dispose();
    };
  }, [screenTexture]);

  useEffect(() => {
    return () => {
      setSubscriptionPlayerDistance(null, config.interactionDistanceM);
    };
  }, [config.interactionDistanceM]);

  useEffect(() => {
    const activeCursor = hovered && !shop.isOpen ? 'pointer' : '';
    gl.domElement.style.cursor = activeCursor;
    return () => {
      if (gl.domElement.style.cursor === 'pointer') {
        gl.domElement.style.cursor = '';
      }
    };
  }, [gl, hovered, shop.isOpen]);

  const computeDistanceFromPlayerOrCamera = useCallback(() => {
    const group = rootRef.current;
    if (!group) return getSubscriptionShopState().playerDistanceM;
    group.getWorldPosition(worldPosRef.current);

    if (!playerObjRef.current || !playerObjRef.current.parent) {
      playerObjRef.current = scene.getObjectByName('player-avatar') ?? null;
    }

    if (playerObjRef.current) {
      playerObjRef.current.getWorldPosition(playerPosRef.current);
      return distanceToBillboardXZ(
        playerPosRef.current.x,
        playerPosRef.current.z,
        worldPosRef.current.x,
        worldPosRef.current.z,
      );
    }

    const focus = camera.userData?.viewFocus as { x?: number; z?: number } | undefined;
    if (focus && typeof focus.x === 'number' && typeof focus.z === 'number') {
      return distanceToBillboardXZ(focus.x, focus.z, worldPosRef.current.x, worldPosRef.current.z);
    }

    return getSubscriptionShopState().playerDistanceM;
  }, [camera, scene]);

  const tryOpenFromBillboard = useCallback(
    (source: SubscriptionTriggerSource): boolean => {
      if (getSubscriptionShopState().isOpen) return false;
      const dist = computeDistanceFromPlayerOrCamera();
      if (dist !== null) {
        setSubscriptionPlayerDistance(dist, config.interactionDistanceM);
      }
      if (!canInteractAtDistance(dist, config)) {
        return false;
      }
      markBillboardPointerConsumed();
      return openSubscriptionShop(source, config.url, config.title);
    },
    [computeDistanceFromPlayerOrCamera, config],
  );

  const isCameraFacingFront = useCallback(() => {
    const group = rootRef.current;
    if (!group) return true;
    group.getWorldPosition(worldPosRef.current);
    forwardRef.current.set(0, 0, 1).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()));
    camDeltaRef.current.subVectors(camera.position, worldPosRef.current);
    return camDeltaRef.current.dot(forwardRef.current) > -0.25;
  }, [camera]);

  useEffect(() => {
    return registerBillboardTapHandler((clientX, clientY, isCenterCrosshair, sourceOverride) => {
      const group = rootRef.current;
      if (!group || getSubscriptionShopState().isOpen) return false;
      if (!isCameraFacingFront()) return false;

      if (isCenterCrosshair) {
        ndc.set(0, 0);
      } else {
        const rect = gl.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return false;
        }
        ndc.set(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1,
        );
      }

      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(group, true);
      if (hits.length === 0) return false;

      return tryOpenFromBillboard(
        sourceOverride ?? (isCenterCrosshair ? 'crosshair-click' : 'mobile-tap'),
      );
    });
  }, [camera, gl, isCameraFacingFront, ndc, raycaster, tryOpenFromBillboard]);

  useFrame((_, delta) => {
    sampleTimerRef.current += delta;
    if (sampleTimerRef.current < 0.12) return;
    sampleTimerRef.current = 0;

    const dist = computeDistanceFromPlayerOrCamera();
    setSubscriptionPlayerDistance(dist, config.interactionDistanceM);
  });

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
  }, []);

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
  }, []);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta > 8) return;
      if (!isCameraFacingFront()) return;
      tryOpenFromBillboard('billboard-click');
    },
    [isCameraFacingFront, tryOpenFromBillboard],
  );

  const highlighted = (hovered || shop.isNearBillboard) && !shop.isOpen;
  const trimColor = hovered ? '#38bdf8' : highlighted ? '#0ea5e9' : '#1e293b';
  const ledColor = hovered ? '#7dd3fc' : highlighted ? '#22d3ee' : '#0284c7';
  const screenTint = hovered ? '#ffffff' : '#f1f5f9';

  const { width, height, depth } = config.size;
  const bezelPad = 0.08;
  const backZ = -depth * 0.5 + 0.012;
  const frontZ = depth * 0.5 + 0.002;
  const railThickness = 0.035;

  return (
    <group
      ref={rootRef}
      name={config.id}
      position={[config.localOffset.x, config.localOffset.y, config.localOffset.z]}
      rotation={[0, config.localRotationY, 0]}
      userData={{ dynamic: true, interactiveKind: 'subscription-billboard' }}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Brushed aluminum backing panel mounted flush against wall */}
      <mesh position={[0, 0, backZ]} userData={{ dynamic: true }}>
        <boxGeometry args={[width + bezelPad, height + bezelPad, depth * 0.65]} />
        <meshStandardMaterial color={trimColor} roughness={0.38} metalness={0.55} />
      </mesh>

      {/* Top & bottom accent LED trim strips (material only, zero pointLight) */}
      <mesh position={[0, (height + bezelPad) * 0.5 - railThickness * 0.4, 0.01]} userData={{ dynamic: true }}>
        <boxGeometry args={[width + bezelPad * 0.6, railThickness * 0.65, depth * 0.7]} />
        <meshBasicMaterial color={ledColor} toneMapped={false} />
      </mesh>
      <mesh position={[0, -(height + bezelPad) * 0.5 + railThickness * 0.4, 0.01]} userData={{ dynamic: true }}>
        <boxGeometry args={[width + bezelPad * 0.6, railThickness * 0.65, depth * 0.7]} />
        <meshBasicMaterial color={ledColor} toneMapped={false} />
      </mesh>

      {/* Wall mounting brackets top & bottom */}
      {[-width * 0.34, width * 0.34].map((bx, idx) => (
        <mesh key={idx} position={[bx, 0, -depth * 0.45]} userData={{ dynamic: true }}>
          <boxGeometry args={[0.07, height * 0.74, 0.024]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
        </mesh>
      ))}

      {/* Front digital display screen with static memoized CanvasTexture */}
      <mesh position={[0, 0, frontZ]} userData={{ dynamic: true }}>
        <planeGeometry args={[width - 0.03, height - 0.03]} />
        <meshBasicMaterial map={screenTexture} color={screenTint} toneMapped={false} />
      </mesh>
    </group>
  );
}
