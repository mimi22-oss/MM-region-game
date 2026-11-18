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
  reportSubscriptionScreenDistance,
  type SubscriptionTriggerSource,
  useSubscriptionShop,
} from '../game/subscriptionShop';
import { useRegionFrame as useFrame } from './RegionActivity';

export interface SubscriptionBillboardProps {
  config?: SubscriptionBillboardConfig;
  variant?: 'billboard' | 'tv' | 'monitor';
  position?: [number, number, number];
  rotation?: [number, number, number];
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

/** Default Wall Billboard CanvasTexture */
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

/** 75-inch Smart TV Widescreen CanvasTexture */
function createSmartTvSubscriptionTexture(title: string, subtitle: string, url: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#070d19');
    bg.addColorStop(0.5, '#0f1a30');
    bg.addColorStop(1, '#080c16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Ambient glow highlights
    const glow1 = ctx.createRadialGradient(w * 0.82, h * 0.2, 10, w * 0.82, h * 0.2, 320);
    glow1.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    glow1.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, w, h);

    const glow2 = ctx.createRadialGradient(w * 0.15, h * 0.8, 10, w * 0.15, h * 0.8, 280);
    glow2.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
    glow2.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, w, h);

    // Subtle TV screen border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 16, 16, w - 32, h - 32, 20);
    ctx.stroke();

    // Top Status Header
    // Smart TV App badge
    drawRoundedRect(ctx, 36, 32, 270, 42, 21);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(58, 53, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('📺 SMART TV APP · LIVE', 74, 54);

    // URL Center Pill
    drawRoundedRect(ctx, 326, 32, 380, 42, 21);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '600 16px monospace, system-ui, sans-serif';
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.fillText('subscription-app-nine-phi.vercel.app', 516, 54);

    // Online Badge Right
    drawRoundedRect(ctx, w - 216, 32, 180, 42, 21);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(w - 188, 53, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'left';
    ctx.fillText('ONLINE SHOP', w - 172, 54);

    // Main Store Hero
    drawRoundedRect(ctx, 36, 96, 92, 92, 20);
    const iconGrad = ctx.createLinearGradient(36, 96, 128, 188);
    iconGrad.addColorStop(0, '#0284c7');
    iconGrad.addColorStop(1, '#059669');
    ctx.fillStyle = iconGrad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    drawRoundedRect(ctx, 58, 124, 48, 42, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(82, 124, 14, Math.PI, 0, false);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 50px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, 148, 134);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('Instant Myanmar Digital Accounts, AI Tools & Streaming Licenses', 150, 178);

    // 4 TV App Category Cards
    const tvCards = [
      { category: 'AI & PRO', title: 'ChatGPT Plus', price: 'MMK 58,000', tag: 'Fast Delivery', color: '#38bdf8' },
      { category: 'STREAMING', title: 'YouTube Premium', price: 'MMK 12,000', tag: 'Ad-Free + Music', color: '#f43f5e' },
      { category: 'CREATIVE', title: 'Canva Pro Team', price: 'MMK 15,000', tag: 'Full Brand Kit', color: '#a855f7' },
      { category: 'ACCOUNTS', title: 'Telegram & VPN', price: 'Direct Order', tag: 'Live Portal', color: '#eab308' },
    ];

    const cardW = 222;
    const cardGap = 20;
    const startX = 36;
    tvCards.forEach((card, idx) => {
      const cx = startX + idx * (cardW + cardGap);
      const cy = 210;
      drawRoundedRect(ctx, cx, cy, cardW, 252, 18);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();

      drawRoundedRect(ctx, cx + 16, cy + 16, 110, 26, 13);
      ctx.fillStyle = card.color;
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.category, cx + 71, cy + 30);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(card.title, cx + 16, cy + 86);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '800 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(card.price, cx + 16, cy + 128);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 16px system-ui, -apple-system, sans-serif';
      ctx.fillText(card.tag, cx + 16, cy + 166);

      drawRoundedRect(ctx, cx + 16, cy + 196, cardW - 32, 38, 12);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('View Details ▸', cx + cardW * 0.5, cy + 216);
    });

    // TV Bottom Remote Bar
    const ctaGrad = ctx.createLinearGradient(36, 484, w - 36, 546);
    ctaGrad.addColorStop(0, '#0284c7');
    ctaGrad.addColorStop(0.5, '#0ea5e9');
    ctaGrad.addColorStop(1, '#0d9488');
    drawRoundedRect(ctx, 36, 484, w - 72, 64, 18);
    ctx.fillStyle = ctaGrad;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 25px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▶ CLICK / TAP SMART TV OR PRESS [E] TO OPEN FULL STORE', w * 0.5, 518);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** 27-inch Curved PC Desktop Browser CanvasTexture */
function createComputerMonitorSubscriptionTexture(title: string, subtitle: string, url: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 595;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;

    // Browser Window Frame & Content Background
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, w, h);

    // Browser Titlebar
    ctx.fillStyle = '#0b1326';
    ctx.fillRect(0, 0, w, 44);

    // Window controls
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(28, 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(48, 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(68, 22, 6, 0, Math.PI * 2);
    ctx.fill();

    // Active Browser Tab
    drawRoundedRect(ctx, 94, 8, 310, 36, 10);
    ctx.fillStyle = '#172544';
    ctx.fill();
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#67e8f9';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️ Subscription Shop · Digital Store', 114, 26);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText('×', 382, 26);

    ctx.fillStyle = '#64748b';
    ctx.font = '20px system-ui';
    ctx.fillText('+', 418, 25);

    // Browser Navigation & Address Bar
    ctx.fillStyle = '#111e38';
    ctx.fillRect(0, 44, w, 48);

    ctx.font = 'bold 20px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('←', 30, 68);
    ctx.fillText('→', 62, 68);
    ctx.fillText('⟳', 94, 68);

    // Address Bar Field
    drawRoundedRect(ctx, 126, 50, w - 246, 36, 18);
    ctx.fillStyle = '#070b14';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', 152, 68);

    ctx.font = '600 16px monospace, system-ui';
    ctx.fillStyle = '#f1f5f9';
    ctx.textAlign = 'left';
    ctx.fillText(url, 176, 68);

    ctx.font = '16px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('⭐', w - 90, 68);
    ctx.fillText('👤', w - 50, 68);

    // Website Page Content Area
    // Navbar
    ctx.fillStyle = '#0d172c';
    ctx.fillRect(0, 92, w, 52);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 144);
    ctx.lineTo(w, 144);
    ctx.stroke();

    ctx.font = '800 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ Subscription Link', 32, 118);

    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('AI Tools', 300, 118);
    ctx.fillText('Streaming', 400, 118);
    ctx.fillText('Accounts', 510, 118);
    ctx.fillText('Support', 610, 118);

    drawRoundedRect(ctx, w - 160, 102, 128, 32, 8);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Online Portal', w - 96, 118);

    // Hero Headline
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('Premium Accounts & AI Subscriptions', 32, 186);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('Direct MMK Delivery · ChatGPT Plus, YouTube Premium, Canva Pro & Tools', 32, 220);

    // 3 Web Store Cards
    const pcCards = [
      { name: 'ChatGPT Plus (1 Mo)', price: 'MMK 58,000', tag: 'Private Shared / Personal', color: '#0ea5e9' },
      { name: 'YouTube Premium', price: 'MMK 12,000', tag: 'Ad-Free + Music Premium', color: '#ef4444' },
      { name: 'Canva Pro Team', price: 'MMK 15,000', tag: 'Brand Kit + AI Generator', color: '#8b5cf6' },
    ];

    const cWidth = 300;
    const cGap = 28;
    const cStartX = 32;
    pcCards.forEach((c, idx) => {
      const cx = cStartX + idx * (cWidth + cGap);
      const cy = 250;
      drawRoundedRect(ctx, cx, cy, cWidth, 230, 14);
      ctx.fillStyle = '#111e38';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawRoundedRect(ctx, cx, cy, cWidth, 6, 3);
      ctx.fillStyle = c.color;
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(c.name, cx + 18, cy + 45);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '800 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(c.price, cx + 18, cy + 90);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(c.tag, cx + 18, cy + 130);

      drawRoundedRect(ctx, cx + 18, cy + 164, cWidth - 36, 44, 10);
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Order Now ▸', cx + cWidth * 0.5, cy + 187);
    });

    // Web Footer CTA Bar
    const ctaGrad = ctx.createLinearGradient(32, 505, w - 32, 570);
    ctaGrad.addColorStop(0, '#0369a1');
    ctaGrad.addColorStop(1, '#0f766e');
    drawRoundedRect(ctx, 32, 505, w - 64, 65, 14);
    ctx.fillStyle = ctaGrad;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLICK / TAP SCREEN TO ENTER SUBSCRIPTION WEB APP ↗', w * 0.5, 539);
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
  variant = 'billboard',
  position,
  rotation,
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

  const screenTexture = useMemo(() => {
    if (variant === 'tv') {
      return createSmartTvSubscriptionTexture(config.title, config.subtitle, config.url);
    }
    if (variant === 'monitor') {
      return createComputerMonitorSubscriptionTexture(config.title, config.subtitle, config.url);
    }
    return createSubscriptionBillboardTexture(config.title, config.subtitle);
  }, [config.subtitle, config.title, config.url, variant]);

  useEffect(() => {
    return () => {
      screenTexture.dispose();
    };
  }, [screenTexture]);

  useEffect(() => {
    return () => {
      reportSubscriptionScreenDistance(config.id, null, config.interactionDistanceM);
    };
  }, [config.id, config.interactionDistanceM]);

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
        reportSubscriptionScreenDistance(config.id, dist, config.interactionDistanceM);
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
    reportSubscriptionScreenDistance(config.id, dist, config.interactionDistanceM);
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

  // TV Variant: Fit into 75-inch Smart TV frame
  if (variant === 'tv') {
    return (
      <group
        ref={rootRef}
        name={config.id}
        position={position ?? [config.localOffset.x, config.localOffset.y, config.localOffset.z]}
        rotation={rotation ?? [0, config.localRotationY, 0]}
        userData={{ dynamic: true, interactiveKind: 'subscription-billboard', screenVariant: 'tv' }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <mesh position={[0, 0, 0]} userData={{ dynamic: true }}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={screenTexture} color={screenTint} toneMapped={false} />
        </mesh>
        {highlighted && (
          <mesh position={[0, 0, -0.001]} userData={{ dynamic: true }}>
            <planeGeometry args={[width + 0.04, height + 0.04]} />
            <meshBasicMaterial color={ledColor} toneMapped={false} />
          </mesh>
        )}
      </group>
    );
  }

  // Monitor Variant: Fit into 27-inch PC desktop monitor
  if (variant === 'monitor') {
    return (
      <group
        ref={rootRef}
        name={config.id}
        position={position ?? [config.localOffset.x, config.localOffset.y, config.localOffset.z]}
        rotation={rotation ?? [0, config.localRotationY, 0]}
        userData={{ dynamic: true, interactiveKind: 'subscription-billboard', screenVariant: 'monitor' }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <mesh position={[0, 0, 0]} userData={{ dynamic: true }}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={screenTexture} color={screenTint} toneMapped={false} />
        </mesh>
        {highlighted && (
          <mesh position={[0, 0, -0.001]} userData={{ dynamic: true }}>
            <planeGeometry args={[width + 0.024, height + 0.024]} />
            <meshBasicMaterial color={ledColor} toneMapped={false} />
          </mesh>
        )}
      </group>
    );
  }

  // Billboard Variant: Wall-mounted digital display
  const bezelPad = 0.08;
  const backZ = -depth * 0.5 + 0.012;
  const frontZ = depth * 0.5 + 0.002;
  const railThickness = 0.035;

  return (
    <group
      ref={rootRef}
      name={config.id}
      position={position ?? [config.localOffset.x, config.localOffset.y, config.localOffset.z]}
      rotation={rotation ?? [0, config.localRotationY, 0]}
      userData={{ dynamic: true, interactiveKind: 'subscription-billboard', screenVariant: 'billboard' }}
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
