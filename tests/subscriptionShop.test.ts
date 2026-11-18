import test from 'node:test';
import assert from 'node:assert/strict';
import { toWorld } from '../src/data/ward.ts';
import {
  COMPUTER_SUBSCRIPTION_CONFIG,
  DEFAULT_SUBSCRIPTION_BILLBOARD,
  SMART_TV_SUBSCRIPTION_CONFIG,
  SUBSCRIPTION_WEBSITE_URL,
  computeSubscriptionBillboardWorldPose,
} from '../src/data/subscriptionBillboard.ts';
import {
  canInteractAtDistance,
  closeSubscriptionShop,
  distanceToBillboardXZ,
  getSubscriptionShopState,
  isAllowedShopUrl,
  markBillboardPointerConsumed,
  openSubscriptionShop,
  registerBillboardTapHandler,
  reportSubscriptionScreenDistance,
  resetSubscriptionShopForTests,
  setSubscriptionPlayerDistance,
  setSubscriptionShopUrl,
  tryCenterClickSubscriptionBillboard,
  tryTapSubscriptionBillboard,
  wasBillboardClickRecentlyConsumed,
} from '../src/game/subscriptionShop.ts';

test('Subscription billboard coordinate conversion matches target Farmhouse wall location', () => {
  const targetU = -76.161;
  const targetV = 270.693;
  const targetWorld = toWorld(targetU, targetV);
  assert.ok(Math.abs(targetWorld.x - 137.555) < 0.01);
  assert.ok(Math.abs(targetWorld.z - 245.263) < 0.01);

  const pose = computeSubscriptionBillboardWorldPose(DEFAULT_SUBSCRIPTION_BILLBOARD);
  // Inner face of Farmhouse back wall (lz=-5.0, depth=0.24) is at lz=-4.88.
  // Panel depth=0.06 centered at lz=-4.85 sits flush at lz=-4.88 without embedding or floating.
  const backFaceLocalZ =
    DEFAULT_SUBSCRIPTION_BILLBOARD.localOffset.z - DEFAULT_SUBSCRIPTION_BILLBOARD.size.depth * 0.5;
  assert.ok(Math.abs(backFaceLocalZ - -4.88) < 1e-6);

  // Horizontal span [lx - width/2, lx + width/2] sits clear of back window [-4.45,-2.55] and TV [+1.30,+3.90].
  const halfW = DEFAULT_SUBSCRIPTION_BILLBOARD.size.width * 0.5;
  const minLx = DEFAULT_SUBSCRIPTION_BILLBOARD.localOffset.x - halfW;
  const maxLx = DEFAULT_SUBSCRIPTION_BILLBOARD.localOffset.x + halfW;
  assert.ok(minLx > -2.55, `Expected minLx (${minLx}) right of window edge (-2.55)`);
  assert.ok(maxLx < 1.3, `Expected maxLx (${maxLx}) left of TV console edge (1.30)`);

  // Distance from requested player reference position (137.555, 245.263) is well inside 5m interaction radius.
  const distToPromptRef = distanceToBillboardXZ(pose.x, pose.z, 137.555, 245.263);
  assert.ok(distToPromptRef < 1.0, `Expected <1m from prompt spot, got ${distToPromptRef}`);
  assert.ok(pose.y > 0.2 && pose.y < 3.0);

  const customPose = computeSubscriptionBillboardWorldPose({
    ...DEFAULT_SUBSCRIPTION_BILLBOARD,
    worldOverride: { x: 10, y: 2.1, z: -4, rotationY: 0.5 },
  });
  assert.equal(customPose.x, 10);
  assert.equal(customPose.y, 2.1);
  assert.equal(customPose.z, -4);
  assert.equal(customPose.rotationY, 0.5);
});

test('Subscription shop state open/close lifecycle and duplicate open guards', () => {
  resetSubscriptionShopForTests();
  assert.equal(getSubscriptionShopState().isOpen, false);
  assert.equal(getSubscriptionShopState().url, SUBSCRIPTION_WEBSITE_URL);

  assert.equal(openSubscriptionShop('billboard-click'), true);
  assert.equal(getSubscriptionShopState().isOpen, true);
  assert.equal(getSubscriptionShopState().lastTriggerSource, 'billboard-click');
  assert.equal(getSubscriptionShopState().openCount, 1);

  // Duplicate open while already open is ignored
  assert.equal(openSubscriptionShop('keyboard'), false);
  assert.equal(getSubscriptionShopState().openCount, 1);

  assert.equal(closeSubscriptionShop(), true);
  assert.equal(getSubscriptionShopState().isOpen, false);
  assert.equal(closeSubscriptionShop(), false);
});

test('Subscription shop validates safe URLs and enforces distance options', () => {
  resetSubscriptionShopForTests();

  assert.equal(isAllowedShopUrl('https://subscription-app-nine-phi.vercel.app/'), true);
  assert.equal(isAllowedShopUrl('http://127.0.0.1:4199/shop'), true);
  assert.equal(isAllowedShopUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedShopUrl('data:text/html,<h1>x</h1>'), false);

  assert.equal(openSubscriptionShop('billboard-click', 'javascript:alert(1)'), false);
  assert.equal(getSubscriptionShopState().isOpen, false);

  setSubscriptionShopUrl('javascript:alert(2)');
  assert.equal(getSubscriptionShopState().url, SUBSCRIPTION_WEBSITE_URL);

  setSubscriptionPlayerDistance(4.2, 5);
  assert.equal(getSubscriptionShopState().isNearBillboard, true);
  assert.equal(getSubscriptionShopState().playerDistanceM, 4.2);

  setSubscriptionPlayerDistance(6.4, 5);
  assert.equal(getSubscriptionShopState().isNearBillboard, false);
  assert.equal(canInteractAtDistance(6.4, { interactionDistanceM: 5, maxClickDistanceM: 22, enforceDistance: false }), true);
  assert.equal(canInteractAtDistance(6.4, { interactionDistanceM: 5, maxClickDistanceM: 22, enforceDistance: true }), false);
  assert.equal(canInteractAtDistance(4.9, { interactionDistanceM: 5, maxClickDistanceM: 22, enforceDistance: true }), true);
});

test('Subscription billboard tap and crosshair handlers prevent duplicate pointer-lock click', () => {
  resetSubscriptionShopForTests();

  const unregister = registerBillboardTapHandler((x, y, center) => {
    if (center) return openSubscriptionShop('crosshair-click');
    if (x >= 100 && x <= 200 && y >= 50 && y <= 150) {
      return openSubscriptionShop('mobile-tap');
    }
    return false;
  });

  // Tap outside billboard does not trigger or suppress click
  assert.equal(tryTapSubscriptionBillboard(10, 10), false);
  assert.equal(wasBillboardClickRecentlyConsumed(150, 1000), false);

  // Tap on billboard triggers open and sets pointer-consumed timestamp
  assert.equal(tryTapSubscriptionBillboard(150, 100), true);
  assert.equal(getSubscriptionShopState().isOpen, true);
  assert.equal(getSubscriptionShopState().lastTriggerSource, 'mobile-tap');

  markBillboardPointerConsumed(1000);
  assert.equal(wasBillboardClickRecentlyConsumed(150, 1050), true);
  assert.equal(wasBillboardClickRecentlyConsumed(150, 1300), false);

  closeSubscriptionShop();
  assert.equal(tryCenterClickSubscriptionBillboard(), true);
  assert.equal(getSubscriptionShopState().lastTriggerSource, 'crosshair-click');

  unregister();
  resetSubscriptionShopForTests();
});

test('Smart TV and Computer screen billboard configurations compute valid poses and multi-screen distances', () => {
  resetSubscriptionShopForTests();

  // Validate URLs match the requested subscription app URL
  assert.equal(SMART_TV_SUBSCRIPTION_CONFIG.url, 'https://subscription-app-nine-phi.vercel.app/');
  assert.equal(COMPUTER_SUBSCRIPTION_CONFIG.url, 'https://subscription-app-nine-phi.vercel.app/');

  // World poses compute properly inside Farmhouse geometry
  const tvPose = computeSubscriptionBillboardWorldPose(SMART_TV_SUBSCRIPTION_CONFIG);
  assert.ok(Number.isFinite(tvPose.x) && Number.isFinite(tvPose.y) && Number.isFinite(tvPose.z));
  assert.equal(tvPose.y, 1.55);
  assert.ok(tvPose.rotationY > 0);

  const pcPose = computeSubscriptionBillboardWorldPose(COMPUTER_SUBSCRIPTION_CONFIG);
  assert.ok(Number.isFinite(pcPose.x) && Number.isFinite(pcPose.y) && Number.isFinite(pcPose.z));
  assert.equal(pcPose.y, 1.22);
  assert.ok(pcPose.rotationY > 0);

  // Multi-screen proximity distance resolution picks minimum across active displays
  reportSubscriptionScreenDistance('smart-tv', 6.5, 5);
  assert.equal(getSubscriptionShopState().isNearBillboard, false);
  assert.equal(getSubscriptionShopState().playerDistanceM, 6.5);

  // When player moves closer to the computer monitor (e.g. 2.1m), it activates proximity
  reportSubscriptionScreenDistance('computer-monitor', 2.1, 4);
  assert.equal(getSubscriptionShopState().isNearBillboard, true);
  assert.equal(getSubscriptionShopState().playerDistanceM, 2.1);

  // When computer screen is cleared, falls back to TV distance
  reportSubscriptionScreenDistance('computer-monitor', null);
  assert.equal(getSubscriptionShopState().isNearBillboard, false);
  assert.equal(getSubscriptionShopState().playerDistanceM, 6.5);

  resetSubscriptionShopForTests();
  assert.equal(getSubscriptionShopState().playerDistanceM, null);
});
