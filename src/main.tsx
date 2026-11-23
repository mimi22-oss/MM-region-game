import {WeaponMenu} from './components/combat/WeaponMenu';
import { ThreeGhostsMissionHud } from './components/ThreeGhostsMissionHud';
import {GhostGameOver} from './components/GhostGameOver';
import { MissionVictoryDialog } from './components/MissionVictoryDialog';
import { RabbitCarrotCelebrationHud } from './components/RabbitCarrotCelebration';
import '@fontsource/noto-sans-myanmar/400.css';
import '@fontsource/noto-sans-myanmar/600.css';
import '@fontsource/noto-sans-myanmar/700.css';
import {
  loadGameSave,
  scheduleGameSave,
  flushGameSave,
  type GameSaveData,
} from './game/gameSave';
import { registerAndroidLifecycle } from './services/androidLifecycle';
import { useEnvironmentTime } from './components/EnvironmentSettings';
import { ActionMenu } from './components/ActionMenu';
import { MultiplayerSession } from './multiplayer/session';
import { MultiplayerPanel } from './multiplayer/MultiplayerPanel';
import { RemotePlayers } from './multiplayer/RemotePlayers';
import { EnvironmentAudio } from './components/EnvironmentAudio';
import { AudioDiagnosticsPanel } from './components/AudioDiagnosticsPanel';
import { GhostAiDebugOverlay } from './components/GhostAiDebugOverlay';
import { BalloonControls } from './components/BalloonControls';
import { emptyBalloonStatus, clearBalloonInput, type BalloonStatus } from './game/balloonRide';
import {
  HORSE_LOCKED_MESSAGE,
  getHorseRideStatusSnapshot,
  subscribeHorseRide,
  triggerHorseDismountButton,
  triggerHorseMountButton,
} from './game/horseRide';
import { useThreeGhostsMission } from './game/missions/threeGhostsMission';
import { isHorseRidingUnlocked, useZombieForestMission } from './game/missions/zombieForestMission';
import { isVehicleWaitingPickupLocked, useVehicleWaiting } from './game/vehicleWaiting';
import {LifeMeter} from './components/LifeMeter';
import { GhostRadar } from './components/GhostRadar';
import { RideControls } from './components/RideControls';
import { CarControls } from './components/CarControls';
import { GuideDialog } from './components/GuideDialog';
import {
  SubscriptionProximityPrompt,
  SubscriptionShopDialog,
} from './components/SubscriptionShopDialog';
import {
  closeSubscriptionShop,
  getSubscriptionShopState,
  openSubscriptionShop,
  useSubscriptionShop,
} from './game/subscriptionShop';
import type { CarStatus } from './game/carRide';
import type { RideStatus } from './game/motorcycleRide';
import { SettingsMenu } from "./components/SettingsMenu";
import {
  savedCharacter,
  CHARACTER_STORAGE_KEY,
  type CharacterKind,
} from "./components/CharacterPicker";
import { homeGuidance } from "./game/homeAccess";
import {
  clearClassroomNotice,
  findNearestSchoolHall,
  getClassroomNoticeSnapshot,
  subscribeClassroomNotice,
} from "./game/schoolClassrooms";
import {
  effectiveSchoolMinute,
  formatSchoolClock12h,
  resolveSchoolPeriod,
  schoolPeriodLabelMy,
} from "./game/schoolSchedule";
import {
  TIME_PERIODS,
  areFootballPlayersVisibleAtMinute,
} from "./game/environmentTime";
import {
  findNearestFootballPitch,
  getFootballScoreboardSnapshot,
  subscribeFootballScoreboard,
} from "./game/footballMatch";
import {
  FOOTBALL_CAMERA_PRESETS,
  cycleFootballViewPreset,
  enterFootballView,
  exitFootballView,
  getFootballViewState,
  subscribeFootballView,
} from "./game/footballBroadcastCam";
import { FrameBudget } from "./components/FrameBudget";
import { CinematicIntroController } from "./components/CinematicIntroController";
import { IntroOverlay } from "./components/IntroOverlay";
import {
  getIntroSettings,
  isReducedMotionPreferred,
  resolveIntroBehavior,
  shouldPlayIntro,
  useIntroSettings,
} from "./game/IntroSettings";
import {
  getIntroState,
  isIntroHighAltitude,
  skipIntro,
  startIntro,
  useIntroState,
} from "./game/IntroStateMachine";
import { mobileQuality } from "./game/sceneBudget";
import { startupDiagnostics } from "./game/startupDiagnostics";
import { diagnosticConfig } from "./game/diagnosticMode";
import { MobileControls } from "./components/MobileControls";
import { BotFightControls } from "./components/BotFightControls";
import { createMobileInput, resetMobileInput } from "./game/mobileInput";
import { isNativeApp } from "./services/platform";
import { useFullscreen } from "./game/useFullscreen";
import React, {
  Component,
  lazy,
  Suspense,
  memo,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { MapLabelsOverlay, MapLabelsProjection } from './components/MapLabels';
import { Town } from "./components/Town";
import { WorldLoading } from "./components/WorldLoading";
import type { WorldLoadingState } from "./game/regionLoading";

import {
  Player,
  MIN_ZOOM,
  MAX_ZOOM,
  type TeleportTarget,
} from "./components/Player";
import {
  TeleportPicker,
  TeleportConfirmOverlay,
  type TeleportPin,
  type ScreenPosition,
} from "./components/TeleportPicker";
import { findTeleportSpot } from "./game/cameraNavigation";
import { canStand } from "./game/collision";
import { ward } from "./data/ward";
import {
  MAP_DESTINATIONS,
  detectLocation,
  type DetectedLocation,
} from "./game/locationDetect";
import { syncAllWorldEdits } from "./game/worldEditsSync";
import {
  getGhostEncounterInteraction,
  useActiveGhostZones,
  useGhostThreatActive,
} from "./game/ghostConfig";
import { isGhostDefeated } from "./game/missions/threeGhostsMission";
import type { GhostRuntimeEntry } from "./game/missions/ghostRuntimeRegistry";
import { installOfflineAssetInterceptor } from "./services/offlineAssetResolver";
import { otaCoordinator } from "./services/otaUpdater";
import {
  UpdateFloatingBanner,
  UpdateStatusDialog,
  UpdateTriggerButton,
  useOtaAttentionDot,
} from "./components/UpdateStatusPanel";
import {
  AndroidApkDownloadDialog,
  type AndroidApkDialogMode,
} from "./components/AndroidApkDownloadDialog";
import {
  shouldShowAndroidApkAutoPrompt,
  writeAndroidApkPromptDismissed,
} from "./game/androidApkDownload";
import "./style.css";

const normalizedPathname = window.location.pathname.replace(/\/+$/, '') || '/';
const is3DList = normalizedPathname === '/3dlist';
const isMapPortal = normalizedPathname === '/map';
if (!is3DList && !isMapPortal) syncAllWorldEdits();
const AssetLibraryPage = lazy(() => import('./components/AssetLibraryPage'));
const MapPortalPage = lazy(() => import('./components/MapPortalPage'));

const KalayWardsPlan = lazy(() =>
  import("./components/wards").then((m) => ({ default: m.KalayWardsPlan })),
);
const KalayVillagesPlan = lazy(() =>
  import("./components/villages").then((m) => ({
    default: m.KalayVillagesPlan,
  })),
);

class SceneError extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    startupDiagnostics.recordSceneError({
      error: String(error),
      stack: errorInfo?.componentStack,
    });
    this.props.onError();
  }
  render() {
    return this.state.failed ? (
      <div className="error">
        3D scene မဖွင့်နိုင်ပါ။ WebGL / hardware acceleration ဖွင့်ထားသော
        desktop browser ဖြင့် ပြန်စမ်းပါ။
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const { isSupported: fullscreenSupported, isFullscreen, toggleFullscreen } = useFullscreen();
  const [renderDpr,setRenderDpr]=useState(()=>mobileQuality?1:Math.max(1,Math.min(window.devicePixelRatio||1,1.25)));
  const [multiplayer] = useState(() => new MultiplayerSession());
  useEffect(() => () => multiplayer.leave(), [multiplayer]);
  const mpSnapshot = useSyncExternalStore(multiplayer.subscribe, multiplayer.getSnapshot);
  const isAuthoritativeOnline = mpSnapshot.mode === 'authoritative-v2' && mpSnapshot.status === 'connected';
  const mapLabelsHost = useRef<HTMLDivElement>(null);
  const [sceneLoading, setSceneLoading] = useState<WorldLoadingState>({
    blocking: true,
    required: [{ id: "myothar", name: ward.name, phase: "queued" }],
    downloads: [],
  });
  const [sceneFailed, setSceneFailed] = useState(false);
  const sceneError = useCallback(() => setSceneFailed(true), []);
  const loading = sceneLoading.blocking || sceneFailed;
  const [rideStatus,setRideStatus]=useState<RideStatus>({riding:false,near:false,kmh:0,notice:'',lives:3,crashed:false});
  const [balloonStatus,setBalloonStatus]=useState<BalloonStatus>(emptyBalloonStatus);
  const balloonUpdate=useCallback((next:BalloonStatus)=>setBalloonStatus(old=>old.riding===next.riding&&old.near===next.near&&old.altitude===next.altitude&&old.kmh===next.kmh&&old.grounded===next.grounded&&old.blocked===next.blocked&&old.autoCruise===next.autoCruise&&old.autoReturn===next.autoReturn&&old.returnDist===next.returnDist?old:next),[]);
  const [carStatus,setCarStatus]=useState<CarStatus>({driving:false,near:false,kmh:0,gear:0,rpm:850,clutch:false,notice:'',steering:0,canSummon:false,summonStatus:'idle',first:false,lives:3});
  const carUpdate=useCallback((next:CarStatus)=>setCarStatus(old=>old.driving===next.driving&&old.near===next.near&&old.kmh===next.kmh&&old.gear===next.gear&&old.rpm===next.rpm&&old.clutch===next.clutch&&old.steering===next.steering&&old.notice===next.notice&&old.canSummon===next.canSummon&&old.summonStatus===next.summonStatus&&old.first===next.first&&old.transmission===next.transmission&&old.automaticRange===next.automaticRange&&old.lives===next.lives?old:next),[]);
  const [rideLimit,setRideLimit]=useState(60),[braking,setBraking]=useState(false),[accelerating,setAccelerating]=useState(false),[dismountRequest,setDismountRequest]=useState(0);
  const rideUpdate=useCallback((next:RideStatus)=>setRideStatus(old=>old.riding===next.riding&&old.near===next.near&&old.kmh===next.kmh&&old.notice===next.notice&&old.lives===next.lives&&old.crashed===next.crashed&&old.impactMode===next.impactMode&&old.damage===next.damage?old:next),[]);

  const [character, setCharacter] = useState<CharacterKind>(savedCharacter);
  const chooseCharacter = (kind: CharacterKind) => {
    if(rideStatus.riding||carStatus.driving||balloonStatus.riding)return;
    setCharacter(kind);
    try {
      localStorage.setItem(CHARACTER_STORAGE_KEY, kind);
    } catch {}
  };
  const mobileInput = useRef(createMobileInput());
  useEffect(() => {
    if (!loading) return;
    if (document.pointerLockElement) document.exitPointerLock();
    resetMobileInput(mobileInput.current);clearBalloonInput();
    setBraking(false);
    setAccelerating(false);
  }, [loading]);
  const activateMobile = useCallback(() => setSceneActive(true), []);
  const saveBounds = useMemo(
    () => ({ halfWorldSize: ward.size / 2, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }),
    [],
  );
  const [initialSave] = useState<GameSaveData | null>(() => loadGameSave(saveBounds));
  const initialSpawn = useMemo(
    () => (initialSave ? { x: initialSave.x, z: initialSave.z } : { x: ward.spawn.x, z: ward.spawn.z }),
    [initialSave],
  );
  const initialYaw = initialSave?.yaw ?? ward.spawnYaw;
  const currentLocIdRef = useRef(initialSave?.areaId ?? ward.id);
  const latestSaveRef = useRef<Omit<GameSaveData, 'version' | 'savedAt'>>({
    x: initialSpawn.x,
    z: initialSpawn.z,
    yaw: initialYaw,
    pitch: initialSave?.pitch ?? -0.12,
    zoom: initialSave?.zoom ?? ward.spawnZoom,
    topDown: initialSave?.topDown ?? false,
    first: initialSave?.first ?? false,
    areaId: initialSave?.areaId ?? ward.id,
  });

  const handleSaveSnapshot = useCallback(
    (snap: { x: number; z: number; yaw: number; pitch: number; zoom: number; topDown: boolean; first: boolean }) => {
      latestSaveRef.current = {
        ...snap,
        areaId: currentLocIdRef.current,
      };
      scheduleGameSave(latestSaveRef.current, saveBounds);
    },
    [saveBounds],
  );

  const flushSaveNow = useCallback(() => {
    flushGameSave(latestSaveRef.current, saveBounds);
  }, [saveBounds]);

  const [docVisible, setDocVisible] = useState(!document.hidden);
  const [appActive, setAppActive] = useState(true);
  const [webglLost, setWebglLost] = useState(false);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const visible = docVisible && appActive;

  useEffect(() => {
    const changed = () => {
      const next = !document.hidden;
      setDocVisible(next);
      if (!next) {
        flushSaveNow();
      } else {
        try {
          invalidateRef.current?.();
        } catch {}
      }
    };
    const onPageHide = () => flushSaveNow();
    document.addEventListener("visibilitychange", changed);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", changed);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [flushSaveNow]);

  const [first, setFirst] = useState(initialSave?.first ?? false);
  const [locked, setLocked] = useState(false);
  const [pos, setPos] = useState(initialSpawn);
  const [robotYaw, setRobotYaw] = useState(initialYaw);
  const [viewPos, setViewPos] = useState(initialSpawn);
  const robotYawRef = useRef(initialYaw);
  const posRef = useRef({ x: initialSpawn.x, z: initialSpawn.z });
  const viewPosRef = useRef({ x: initialSpawn.x, z: initialSpawn.z });
  const settingsOpenRef = useRef(false);
  const mapOpenRef = useRef(false);
  const guideOpenRef = useRef(false);
  const actionMenuOpenRef = useRef(false);
  const teleportModeRef = useRef(false);
  const hudMenuOpenRef = useRef(false);
  const updatesOpenRef = useRef(false);
  const [mapOpen, setMapOpen] = useState(false);
  mapOpenRef.current = mapOpen;
  const [settingsOpen, setSettingsOpen] = useState(false);
  settingsOpenRef.current = settingsOpen;
  const [updatesOpen, setUpdatesOpen] = useState(false);
  updatesOpenRef.current = updatesOpen;
  const [hudMenuOpen, setHudMenuOpen] = useState(false);
  hudMenuOpenRef.current = hudMenuOpen;
  const otaNeedsAttention = useOtaAttentionDot();
  const [apkDialog, setApkDialog] = useState<{ open: boolean; mode: AndroidApkDialogMode }>({
    open: false,
    mode: "manual",
  });
  const autoApkPromptCheckedRef = useRef(false);
  const ghostThreatActive = useGhostThreatActive();
  const activeGhostZones = useActiveGhostZones();
  const activeGhostZoneIds = useMemo(
    () => new Set(activeGhostZones.map((zone) => zone.zoneId)),
    [activeGhostZones],
  );
  const [liveGhosts, setLiveGhosts] = useState<
    Array<{ id: string; x: number; z: number; active: boolean; state: string }>
  >([]);

  useEffect(() => {
    const handleGhostPositions = (e: Event) => {
      const detail = (e as CustomEvent<{
        player: { x: number; z: number; yaw?: number };
        ghosts: Partial<GhostRuntimeEntry>[];
      }>).detail;
      if (detail?.ghosts) {
        const live = detail.ghosts
          .filter(
            (g): g is Partial<GhostRuntimeEntry> & { x: number; z: number } =>
              typeof g.x === "number" &&
              typeof g.z === "number" &&
              Number.isFinite(g.x) &&
              Number.isFinite(g.z) &&
              !isGhostDefeated(g.id || "")
          )
          .map((g) => ({
            id: g.id || "ghost",
            x: g.x,
            z: g.z,
            active: !!g.active,
            state: g.state || "active",
          }));
        setLiveGhosts(live);
      }
    };
    window.addEventListener("mm-ghost-debug-positions", handleGhostPositions);
    return () => window.removeEventListener("mm-ghost-debug-positions", handleGhostPositions);
  }, []);
  const viewPosition = useCallback(
    (x: number, z: number) => {
      viewPosRef.current.x = x;
      viewPosRef.current.z = z;
      setViewPos((p) => {
        const dx = p.x - x;
        const dz = p.z - z;
        const thresholdSq = settingsOpenRef.current || mapOpenRef.current
          ? 1.44
          : mobileQuality
            ? 25
            : 6.25;
        if (dx * dx + dz * dz > thresholdSq) {
          return { x, z };
        }
        return p;
      });
    },
    [],
  );
  const [guideOpen, setGuideOpen] = useState(false);
  guideOpenRef.current = guideOpen;
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  actionMenuOpenRef.current = actionMenuOpen;
  const [sceneActive, setSceneActive] = useState(false);
  const [topDown, setTopDown] = useState(initialSave?.topDown ?? false);
  const [zoom, setZoom] = useState(initialSave?.zoom ?? ward.spawnZoom);
  const environment=useEnvironmentTime();
  const night=environment.period==='night'||environment.period==='evening';
  const intro = useIntroState();
  const subscriptionShop = useSubscriptionShop();

  useEffect(() => {
    if (loading || intro.active || autoApkPromptCheckedRef.current) return;
    autoApkPromptCheckedRef.current = true;
    if (shouldShowAndroidApkAutoPrompt()) {
      if (document.pointerLockElement) document.exitPointerLock();
      setApkDialog({ open: true, mode: "auto-prompt" });
    }
  }, [loading, intro.active]);

  useEffect(() => {
    if (subscriptionShop.isOpen) {
      flushSaveNow();
    }
  }, [subscriptionShop.isOpen, flushSaveNow]);

  const otaBootCheckedRef = useRef(false);

  useEffect(() => {
    const removeInterceptor = installOfflineAssetInterceptor(otaCoordinator.assetCache, () => otaCoordinator.getState().currentVersion);
    void otaCoordinator.initialize();
    return () => {
      removeInterceptor();
      otaCoordinator.dispose();
    };
  }, []);

  // Defer background update check until after initial 3D scene load completes, and never
  // auto-download large full-asset bundles (30+ MB) silently during Android WebGL startup.
  useEffect(() => {
    if (loading || otaBootCheckedRef.current) return;
    otaBootCheckedRef.current = true;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || !otaCoordinator.getState().online) return;
      void otaCoordinator.checkForUpdate().then((checked) => {
        const isSmallCodeDelta =
          checked.availableRelease?.bundleIncludesAssets !== true &&
          checked.totalDownloadBytes > 0 &&
          checked.totalDownloadBytes <= 5 * 1024 * 1024;
        if (
          !cancelled &&
          checked.phase === "update_available" &&
          checked.safety.safeToDownloadInBackground &&
          isSmallCodeDelta
        ) {
          void otaCoordinator.downloadAvailableUpdate();
        }
      });
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading]);

  useEffect(() => {
    otaCoordinator.setSafetyContext(
      {
        ghostThreatActive,
        ghostGrabActive: getGhostEncounterInteraction().active,
        ridingMotorcycle: rideStatus.riding,
        drivingCar: carStatus.driving,
        ridingBalloon: balloonStatus.riding,
        introActive: intro.active,
        sceneLoading: loading,
        activeModalBlocking: subscriptionShop.isOpen,
      },
      flushSaveNow,
    );
  }, [
    ghostThreatActive,
    rideStatus.riding,
    carStatus.driving,
    balloonStatus.riding,
    intro.active,
    loading,
    subscriptionShop.isOpen,
    flushSaveNow,
  ]);

  useEffect(() => {
    const dispose = registerAndroidLifecycle({
      onActiveChange: (isActive) => {
        setAppActive(isActive);
        if (isActive) {
          try {
            invalidateRef.current?.();
          } catch {}
        }
      },
      onBackgroundFlush: flushSaveNow,
      onBackButton: () => {
        if (getSubscriptionShopState().isOpen) {
          closeSubscriptionShop();
          return true;
        }
        if (guideOpenRef.current) {
          setGuideOpen(false);
          return true;
        }
        if (mapOpenRef.current) {
          setMapOpen(false);
          return true;
        }
        if (updatesOpenRef.current) {
          setUpdatesOpen(false);
          return true;
        }
        if (settingsOpenRef.current) {
          setSettingsOpen(false);
          return true;
        }
        if (actionMenuOpenRef.current) {
          setActionMenuOpen(false);
          return true;
        }
        if (hudMenuOpenRef.current) {
          setHudMenuOpen(false);
          return true;
        }
        if (getIntroState().active) {
          skipIntro();
          return true;
        }
        if (getFootballViewState().active) {
          exitFootballView();
          return true;
        }
        if (teleportModeRef.current) {
          setTeleportPin(null);
          setTeleportScreenPos(null);
          setTeleportMode(false);
          return true;
        }
        return false;
      },
    });
    return () => {
      dispose();
      canvasCleanupRef.current?.();
      canvasCleanupRef.current = null;
    };
  }, [flushSaveNow]);

  useEffect(() => {
    const onShopKeyDown = (e: KeyboardEvent) => {
      if (loading || mapOpen || settingsOpen || guideOpen || getIntroState().active) return;
      if (carStatus.driving || balloonStatus.riding || rideStatus.riding) return;
      if (getSubscriptionShopState().isOpen) return;
      if (e.code !== 'KeyE' || e.repeat) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input,select,textarea,[contenteditable="true"]')
      ) {
        return;
      }
      if (getSubscriptionShopState().isNearBillboard) {
        e.preventDefault();
        openSubscriptionShop('keyboard');
      }
    };
    window.addEventListener('keydown', onShopKeyDown);
    return () => window.removeEventListener('keydown', onShopKeyDown);
  }, [loading, mapOpen, settingsOpen, guideOpen, carStatus.driving, balloonStatus.riding, rideStatus.riding]);
  const introSettings = useIntroSettings();
  const vehicleWaiting = useVehicleWaiting();
  const classroomNotice = useSyncExternalStore(
    subscribeClassroomNotice,
    getClassroomNoticeSnapshot,
    getClassroomNoticeSnapshot,
  );
  const nearSchoolHall = useMemo(
    () => findNearestSchoolHall(viewPos.x, viewPos.z, 48) ?? findNearestSchoolHall(pos.x, pos.z, 48),
    [viewPos.x, viewPos.z, pos.x, pos.z],
  );
  const nearFootballPitch = useMemo(
    () => findNearestFootballPitch(viewPos.x, viewPos.z) ?? findNearestFootballPitch(pos.x, pos.z),
    [viewPos.x, viewPos.z, pos.x, pos.z],
  );
  const footballScoreboard = useSyncExternalStore(
    subscribeFootballScoreboard,
    getFootballScoreboardSnapshot,
    getFootballScoreboardSnapshot,
  );
  const footballView = useSyncExternalStore(
    subscribeFootballView,
    getFootballViewState,
    getFootballViewState,
  );
  useThreeGhostsMission();
  useZombieForestMission();
  const horseUnlocked = isHorseRidingUnlocked();
  const horseStatus = useSyncExternalStore(
    subscribeHorseRide,
    getHorseRideStatusSnapshot,
    getHorseRideStatusSnapshot,
  );
  const ridingHorse = horseStatus.phase === 'mounting' || horseStatus.phase === 'riding';
  const footballMatchActive = areFootballPlayersVisibleAtMinute(environment.minute);
  const showFootballScoreHud = Boolean(nearFootballPitch && footballMatchActive);
  const activeFootballScore = nearFootballPitch ? footballScoreboard[nearFootballPitch.id] : null;
  const charAtFootballPitch = useMemo(
    () => findNearestFootballPitch(pos.x, pos.z),
    [pos.x, pos.z],
  );
  const footballViewPitch = charAtFootballPitch ?? nearFootballPitch;

  // Automatically exit Football TV View if evening/night starts or overlays open
  useEffect(() => {
    if (footballView.active && (!footballMatchActive || mapOpen || settingsOpen || loading)) {
      exitFootballView();
    }
  }, [footballView.active, footballMatchActive, mapOpen, settingsOpen, loading]);
  const schoolClockMinute = effectiveSchoolMinute(environment.minute, environment.preferences.mode);
  const currentSchoolPeriod = resolveSchoolPeriod(environment.minute, environment.preferences.mode);
  const currentPeriodMeta = TIME_PERIODS.find((p) => p.id === environment.period);
  const classroomNoticeNearPlayer = useMemo(
    () =>
      Boolean(
        classroomNotice &&
          Math.hypot(pos.x - classroomNotice.hallX, pos.z - classroomNotice.hallZ) <= 36,
      ),
    [classroomNotice, pos.x, pos.z],
  );
  useEffect(() => {
    if (!classroomNotice) return;
    if (!classroomNoticeNearPlayer) {
      clearClassroomNotice();
      return;
    }
    const timer = window.setTimeout(() => clearClassroomNotice(), 2800);
    return () => window.clearTimeout(timer);
  }, [classroomNotice?.seq, classroomNoticeNearPlayer]);
  const entryIntroAttemptedRef = useRef(false);
  const [navigationRequest, setNavigationRequest] = useState<{
    action: "locate" | "teleport";
    seq: number;
  } | null>(null);
  const [navigationNotice, setNavigationNotice] = useState("");
  const navigationResult = useCallback(
    (success: boolean) =>
      setNavigationNotice(
        success
          ? ""
          : "ဤနေရာတွင် မြေပြင်ရှင်းလင်းမှု မရှိပါ။ လမ်းမ သို့မဟုတ် နေရာလွတ်သို့ ဆွဲရွှေ့ပြီး ပြန်လည် ကြိုးစားပါ။",
      ),
    [],
  );
  const navigate = (action: "locate" | "teleport") => {
    if (document.pointerLockElement) document.exitPointerLock();
    setNavigationNotice("");
    setNavigationRequest((previous) => ({
      action,
      seq: (previous?.seq ?? 0) + 1,
    }));
  };
  const [teleportTarget, setTeleportTarget] = useState<TeleportTarget | null>(
    null,
  );
  const [teleportMode, setTeleportMode] = useState(false);
  teleportModeRef.current = teleportMode;
  const [horseLockedNotice, setHorseLockedNotice] = useState(false);
  const prevNearLockedHorseRef = useRef(false);
  const prevHorseLockedSeqRef = useRef(horseStatus.lockedNoticeSeq);
  const nearHorseEligible =
    !intro.active &&
    !loading &&
    !mapOpen &&
    !settingsOpen &&
    !teleportMode &&
    !footballView.active &&
    !carStatus.driving &&
    !balloonStatus.riding &&
    !rideStatus.riding &&
    horseStatus.near &&
    horseStatus.phase === "idle";
  const nearLockedHorse = nearHorseEligible && !horseUnlocked;

  useEffect(() => {
    const enteredLocked = nearLockedHorse && !prevNearLockedHorseRef.current;
    const retriedLocked =
      nearLockedHorse && horseStatus.lockedNoticeSeq !== prevHorseLockedSeqRef.current;
    prevNearLockedHorseRef.current = nearLockedHorse;
    prevHorseLockedSeqRef.current = horseStatus.lockedNoticeSeq;
    if (horseUnlocked) {
      setHorseLockedNotice(false);
      return;
    }
    if (enteredLocked || retriedLocked) {
      setHorseLockedNotice(true);
    }
  }, [nearLockedHorse, horseUnlocked, horseStatus.lockedNoticeSeq]);

  useEffect(() => {
    if (!horseLockedNotice) return;
    const timer = window.setTimeout(() => setHorseLockedNotice(false), 2600);
    return () => window.clearTimeout(timer);
  }, [horseLockedNotice, horseStatus.lockedNoticeSeq]);
  const [teleportPin, setTeleportPin] = useState<TeleportPin | null>(null);
  const [teleportScreenPos, setTeleportScreenPos] = useState<ScreenPosition | null>(null);
  const [teleportDragging, setTeleportDragging] = useState(false);

  const handleToggleTeleportMode = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setTeleportMode((prev) => {
      const next = !prev;
      if (next) {
        setHudMenuOpen(false);
        setActionMenuOpen(false);
        resetMobileInput(mobileInput.current);
      } else {
        setTeleportPin(null);
        setTeleportScreenPos(null);
        setTeleportDragging(false);
      }
      return next;
    });
  };

  const handleConfirmTeleport = (pin: TeleportPin) => {
    if (document.pointerLockElement) document.exitPointerLock();
    const targetX = pin.safeX;
    const targetZ = pin.safeZ;
    setPos({ x: targetX, z: targetZ });
    setTeleportTarget({
      x: targetX,
      z: targetZ,
      seq: Date.now(),
    });
    setTeleportMode(false);
    setTeleportPin(null);
    setTeleportScreenPos(null);
    const loc = detectLocation(targetX, targetZ);
    setArrivalToast(loc);
    currentLocIdRef.current = loc.id;
    latestSaveRef.current = {
      ...latestSaveRef.current,
      x: targetX,
      z: targetZ,
      areaId: loc.id,
      topDown: false,
      first: false,
    };
    flushSaveNow();
  };

  const handleCancelTeleport = () => {
    setTeleportPin(null);
    setTeleportScreenPos(null);
    setTeleportMode(false);
  };

  const [arrivalToast, setArrivalToast] = useState<DetectedLocation | null>(
    null,
  );
  const currentLoc = useMemo(
    () => detectLocation(viewPos.x, viewPos.z),
    [viewPos.x, viewPos.z],
  );
  currentLocIdRef.current = currentLoc.id;
  const currentLocRef = useRef(currentLoc);
  currentLocRef.current = currentLoc;
  const currentLocKey = `${currentLoc.id}:${currentLoc.subArea ?? ""}`;
  const prevLocKey = useRef(currentLocKey);

  useEffect(() => {
    if (prevLocKey.current === currentLocKey) return;
    prevLocKey.current = currentLocKey;
    setArrivalToast(currentLocRef.current);
  }, [currentLocKey]);

  // Always auto-hide location-toast briefly (2.2s), including after teleport or continuous walking
  useEffect(() => {
    if (!arrivalToast) return;
    const timer = window.setTimeout(() => setArrivalToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [arrivalToast]);

  const rawGuidance = useMemo(
    () => homeGuidance(pos.x, pos.z),
    [pos.x, pos.z],
  );
  const [displayedGuidance, setDisplayedGuidance] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!rawGuidance) {
      setDisplayedGuidance(null);
      return;
    }
    setDisplayedGuidance(rawGuidance);
    const timer = window.setTimeout(() => {
      setDisplayedGuidance(null);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [rawGuidance]);

  const handleSelectLocation = useCallback((id: string) => {
    const dest = MAP_DESTINATIONS.find((d) => d.id === id);
    if (!dest) return;
    if (document.pointerLockElement) document.exitPointerLock();
    const originX = posRef.current.x;
    const originZ = posRef.current.z;
    setPos({ x: dest.x, z: dest.z });
    setMapOpen(false);
    setSettingsOpen(false);
    setFirst(false);
    setTopDown(false);
    setZoom(dest.distance);
    setTeleportTarget({
      x: dest.x,
      z: dest.z,
      yaw: dest.yaw,
      pitch: dest.pitch,
      distance: dest.distance,
      seq: Date.now(),
    });
    const settings = getIntroSettings();
    const behavior = resolveIntroBehavior("travel", settings, {
      diagnosticDisabled: diagnosticConfig.enabled,
    });
    if (behavior !== "skip") {
      setWelcomeDismissed(true);
      startIntro(
        {
          id: dest.id,
          label: dest.label,
          title: dest.title,
          subtitle: dest.subtitle,
          x: dest.x,
          z: dest.z,
          yaw: dest.yaw,
          pitch: dest.pitch,
          distance: dest.distance,
        },
        "travel",
        {
          durationSec: settings.durationSec,
          reducedMotion: behavior === "reduced-settle",
          originX,
          originZ,
        },
      );
    }
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.code === "Escape") {
        if (getSubscriptionShopState().isOpen) {
          closeSubscriptionShop();
          return;
        }
        if (getFootballViewState().active) {
          exitFootballView();
          return;
        }
        if (getIntroState().active) {
          skipIntro();
        }
        setMapOpen(false);
        setSettingsOpen(false);
        setUpdatesOpen(false);
        setActionMenuOpen(false);
        setHudMenuOpen(false);
        setSceneActive(false);
        setTeleportMode(false);
        setTeleportPin(null);
        setTeleportScreenPos(null);
      }
      if (getSubscriptionShopState().isOpen) return;
      if (e.code === "KeyN" && !e.repeat && !(e.target instanceof HTMLElement && e.target.closest('input,select,textarea,[contenteditable="true"]'))) {
        environment.cycle();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [loading, environment.cycle]);
  const position = useCallback((x: number, z: number, yaw?: number) => {
    posRef.current.x = x;
    posRef.current.z = z;
    if (yaw !== undefined) {
      const prevYaw = robotYawRef.current;
      robotYawRef.current = yaw;
      const yawThreshold = settingsOpenRef.current || mapOpenRef.current
        ? 0.035
        : mobileQuality
          ? 0.22
          : 0.1;
      if (settingsOpenRef.current || mapOpenRef.current || Math.abs(prevYaw - yaw) > yawThreshold) {
        setRobotYaw(yaw);
      }
    }
    setPos((previous) => {
      if (settingsOpenRef.current || mapOpenRef.current) {
        return previous.x === x && previous.z === z ? previous : { x, z };
      }
      const dx = previous.x - x;
      const dz = previous.z - z;
      const thresholdSq = mobileQuality ? 20.25 : 6.25;
      if (dx * dx + dz * dz > thresholdSq) {
        return { x, z };
      }
      return previous;
    });
  }, []);
  const handleMoveIntent = useCallback(
    (dx: number, dz: number, yaw: number, sprinting: boolean, dtMs: number) =>
      multiplayer.sendMoveIntent(dx, dz, yaw, sprinting, dtMs),
    [multiplayer],
  );
  const handleReconcilePlayer = useCallback(
    (x: number, z: number) => multiplayer.reconcileLocalPosition(x, z),
    [multiplayer],
  );
  const handleLock = useCallback((isLocked: boolean) => {
    setLocked(isLocked);
    setSceneActive(isLocked);
    if (isLocked) {
      setSettingsOpen(false);
      setWelcomeDismissed(true);
    }
  }, []);
  const toggleTopDown = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setTopDown((prev) => {
      const next = !prev;
      if (next) {
        setFirst(false);
        setZoom((z) => Math.max(z, 260));
      } else setZoom(balloonStatus.riding?24:6);
      return next;
    });
  };
  const stepZoom = (dir: number) => {
    setFirst(false);
    setZoom((z) => {
      const raw =
        dir > 0 ? Math.max(z + 2, z * 1.35) : Math.min(z - 1, z / 1.35);
      return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(raw * 10) / 10));
    });
  };
  const hideHud = locked || sceneActive;
  useLayoutEffect(() => {
    if (loading || entryIntroAttemptedRef.current) return;
    entryIntroAttemptedRef.current = true;
    const settings = getIntroSettings();
    const behavior = resolveIntroBehavior("entry", settings, {
      diagnosticDisabled: diagnosticConfig.enabled,
    });
    if (behavior === "skip") return;
    const startX = initialSpawn.x;
    const startZ = initialSpawn.z;
    const startYaw = initialYaw;
    const startPitch = initialSave?.pitch ?? -0.12;
    const startZoom = initialSave?.zoom ?? ward.spawnZoom;
    const spawnLoc = detectLocation(startX, startZ);
    setWelcomeDismissed(true);
    setFirst(false);
    setTopDown(false);
    setZoom(startZoom);
    startIntro(
      {
        id: spawnLoc.id,
        label: spawnLoc.label || ward.currentArea,
        title: spawnLoc.title || `${ward.currentArea}`,
        subtitle: spawnLoc.subArea ?? spawnLoc.subtitle,
        x: startX,
        z: startZ,
        yaw: startYaw,
        pitch: startPitch,
        distance: startZoom,
      },
      "entry",
      {
        durationSec: settings.durationSec,
        reducedMotion: behavior === "reduced-settle",
      },
    );
  }, [loading, initialSpawn, initialYaw, initialSave]);

  const handleReplayIntro = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    const px = posRef.current.x;
    const pz = posRef.current.z;
    const loc = detectLocation(px, pz);
    const settings = getIntroSettings();
    const reduced = settings.respectReducedMotion && isReducedMotionPreferred();
    setSettingsOpen(false);
    setMapOpen(false);
    setWelcomeDismissed(true);
    setFirst(false);
    setTopDown(false);
    startIntro(
      {
        id: loc.id,
        label: loc.label,
        title: loc.title,
        subtitle: loc.subArea ?? loc.subtitle,
        x: px,
        z: pz,
        yaw: robotYawRef.current,
        pitch: -0.14,
        distance: Math.min(12, Math.max(3, zoom)),
      },
      "entry",
      {
        durationSec: settings.durationSec,
        reducedMotion: reduced,
        originX: ward.spawn.x,
        originZ: ward.spawn.z,
      },
    );
  }, [zoom]);

  return (
    <main className={night ? "night-mode" : ""} data-time-period={environment.period}>
      <GhostGameOver/>
      <MissionVictoryDialog />
      {!loading && !intro.active && !mapOpen && !settingsOpen && (
        <RabbitCarrotCelebrationHud
          playerPosRef={posRef}
          playerYawRef={robotYawRef}
          onMountain={
            currentLoc.id === "taungphila" ||
            currentLoc.id === "western-highlands" ||
            currentLoc.id === "eastern-mountains" ||
            currentLoc.id === "weipula" ||
            currentLoc.id === "weipula-base" ||
            currentLoc.id === "weipula-village" ||
            currentLoc.id === "weipula-chin-village"
          }
        />
      )}
      {!loading && !intro.active && !nearSchoolHall && !showFootballScoreHud && <ThreeGhostsMissionHud />}
      {!loading && !intro.active && !mapOpen && !settingsOpen && showFootballScoreHud && nearFootballPitch && (
        <div
          className={
            activeFootballScore?.phase === "goal-celebration" && footballMatchActive
              ? "football-score-hud football-score-hud-goal"
              : "football-score-hud"
          }
          role="status"
          aria-live="polite"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="football-score-hud-head">
            <span className="football-score-hud-pitch">⚽ {nearFootballPitch.name}</span>
            <span
              className={
                footballMatchActive
                  ? "football-score-hud-badge football-score-hud-live"
                  : "football-score-hud-badge football-score-hud-rest"
              }
            >
              {footballMatchActive ? "● LIVE" : "🌙 ပွဲနား"}
            </span>
          </div>
          <div className="football-score-hud-board" aria-label="ဘောလုံးပွဲ ရမှတ်">
            <div className="football-score-team football-score-team-red">
              <span className="football-score-dot football-score-dot-red" aria-hidden="true" />
              <span className="football-score-name">အနီ</span>
              <strong className="football-score-num">{activeFootballScore?.goalsRed ?? 0}</strong>
            </div>
            <span className="football-score-sep" aria-hidden="true">:</span>
            <div className="football-score-team football-score-team-green">
              <strong className="football-score-num">{activeFootballScore?.goalsGreen ?? 0}</strong>
              <span className="football-score-name">အစိမ်း</span>
              <span className="football-score-dot football-score-dot-green" aria-hidden="true" />
            </div>
          </div>
          <div className="football-score-hud-status">
            {!footballMatchActive
              ? "ညနေ/ည ပွဲနားချိန် (မနက် 05:00 – နေ့ 04:29 ကစားသည်)"
              : activeFootballScore?.phase === "goal-celebration"
                ? `🎉 ဂိုးဝင်ပြီ! (${activeFootballScore.lastScorer === "red" ? "အနီအသင်း" : "အစိမ်းအသင်း"})`
                : activeFootballScore?.phase === "throw-in-pickup" || activeFootballScore?.phase === "throw-in"
                  ? "🙌 ဘောလုံးကောက် · ဘေးစည်းပစ်သွင်းနေသည်"
                  : activeFootballScore?.phase === "gk-pickup" ||
                      activeFootballScore?.phase === "gk-hold" ||
                      activeFootballScore?.phase === "gk-throw"
                    ? "🧤 ဂိုးသမား ဖမ်းပြီး ပစ်ပေးနေသည်"
                    : "⚽ ပွဲစဉ်ကစားနေသည် · အနီ vs အစိမ်း"}
          </div>
        </div>
      )}
      {!loading && !intro.active && !mapOpen && !settingsOpen && !showFootballScoreHud && nearSchoolHall && (
        <div
          className="school-time-hud"
          role="status"
          aria-live="polite"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="school-time-hud-top">
            <span className="school-time-hud-clock">
              🕒 {formatSchoolClock12h(schoolClockMinute)}
            </span>
            <span className="school-time-hud-mode">
              {environment.preferences.mode === "auto"
                ? `Auto · ${currentPeriodMeta?.icon ?? ""}`
                : `${currentPeriodMeta?.icon ?? ""} ${currentPeriodMeta?.label ?? ""}`}
            </span>
            <button
              type="button"
              className="school-time-hud-btn"
              onClick={() => environment.cycle()}
              title="အချိန်ပြောင်းရန် (N)"
            >
              ⏱ ပြောင်း (N)
            </button>
          </div>
          <div className="school-time-hud-meta">
            <span className="school-time-hud-period">
              {currentSchoolPeriod === "closed"
                ? "ကျောင်းပိတ်ချိန် (ကျောင်းသား/ဆရာ အားလုံး hide)"
                : schoolPeriodLabelMy(currentSchoolPeriod)}
            </span>
            <span className="school-time-hud-hall">
              {nearSchoolHall.dormRole === "teacher-dorm"
                ? "🏠 ဆရာ/ဆရာမ အဆောင် · "
                : nearSchoolHall.dormRole === "student-dorm"
                  ? "🏠 ကျောင်းသား/သူ အဆောင် · "
                  : "🏫 ပုံမှန်စာသင်ဆောင် · "}
              {nearSchoolHall.name}
            </span>
          </div>
        </div>
      )}
      <EnvironmentAudio period={environment.period} volume={environment.preferences.volume} enabled={environment.preferences.sound} active={visible&&!loading}/>
      <AudioDiagnosticsPanel />
      <GhostAiDebugOverlay />
      <div className="game-content" inert={loading}>
      <div
        className="scene-wrap"
        onClick={() => {
          if (!mapOpen && !loading && !getIntroState().active && !getSubscriptionShopState().isOpen) {
            setSceneActive(true);
            setSettingsOpen(false);
          }
        }}
      >
        <SceneError onError={sceneError}>
          <Canvas
            frameloop={visible ? "always" : "never"}
            shadows={!mobileQuality && !diagnosticConfig.disableShadows}
            gl={{
              logarithmicDepthBuffer: true,
              antialias: !mobileQuality,
              powerPreference: "default",
            }}
            camera={{ position: [0, 5, 33], fov: 65, near: 0.1, far: 14000 }}
            dpr={renderDpr}
            onCreated={({ gl, invalidate }) => {
              canvasCleanupRef.current?.();
              invalidateRef.current = invalidate;
              startupDiagnostics.record('canvas-init');
              startupDiagnostics.record('webgl-created', {
                dpr: gl.getPixelRatio(),
                maxAnisotropy: gl.capabilities.getMaxAnisotropy(),
              });
              const canvas = gl.domElement;
              const handleContextLost = (e: Event) => {
                e.preventDefault();
                console.warn('[WebGL] Context lost!');
                flushSaveNow();
                setWebglLost(true);
                startupDiagnostics.record('webgl-context-lost');
              };
              const handleContextRestored = () => {
                console.info('[WebGL] Context restored!');
                setWebglLost(false);
                invalidate();
                startupDiagnostics.record('webgl-context-restored');
              };
              canvas.addEventListener('webglcontextlost', handleContextLost, false);
              canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
              canvasCleanupRef.current = () => {
                canvas.removeEventListener('webglcontextlost', handleContextLost, false);
                canvas.removeEventListener('webglcontextrestored', handleContextRestored, false);
              };
            }}
          >
            <FrameBudget paused={loading || !visible} onDprChange={setRenderDpr}/>
            <RemotePlayers session={multiplayer} />
            <Town isAuthoritativeOnline={isAuthoritativeOnline} minute={environment.minute} timeMode={environment.preferences.mode} soundEnabled={environment.preferences.sound} soundVolume={environment.preferences.volume} destination={teleportTarget} paused={loading || !visible} onLoadingChange={setSceneLoading} onSceneError={sceneError} />
            <TeleportPicker
              active={teleportMode}
              pin={teleportPin}
              mobileInput={mobileInput}
              onPickPin={setTeleportPin}
              onScreenPos={setTeleportScreenPos}
              onDraggingChange={setTeleportDragging}
            />
            <CinematicIntroController />
            <Player
              minute={environment.minute}
              speedLimit={rideLimit} braking={braking} accelerating={accelerating} dismountRequest={dismountRequest} onRideStatus={rideUpdate} controlsBlocked={settingsOpen || loading || guideOpen || intro.active || subscriptionShop.isOpen || footballView.active || !visible} loading={loading}
              deferGlb={(loading && shouldPlayIntro("entry", introSettings, { diagnosticDisabled: diagnosticConfig.enabled }) && !(introSettings.respectReducedMotion && isReducedMotionPreferred())) || (intro.active && isIntroHighAltitude(intro))}
              onCarStatus={carUpdate}
              onBalloonStatus={balloonUpdate}
              character={character}
              navigationRequest={navigationRequest}
              onNavigationResult={navigationResult}
              mobileInput={mobileInput}
              mapOpen={mapOpen}
              topDown={topDown}
              zoom={zoom}
              teleportTarget={teleportTarget}
              teleportMode={teleportMode}
              teleportDragging={teleportDragging}
              onMode={setFirst}
              onTopDown={setTopDown}
              onZoom={setZoom}
              onLock={handleLock}
              onPosition={position}
              onViewPosition={viewPosition}
              initialSave={initialSave}
              onSaveSnapshot={handleSaveSnapshot}
              onMoveIntent={handleMoveIntent}
              reconcilePlayer={handleReconcilePlayer}
            />
            <MapLabelsProjection host={mapLabelsHost} enabled={!loading && !mapOpen && !first && !intro.active} />
          </Canvas>
        </SceneError>
        <MapLabelsOverlay host={mapLabelsHost} hidden={loading || mapOpen || first || intro.active} />
      </div>
      {!intro.active && !loading && !rideStatus.riding && !carStatus.driving && !balloonStatus.riding && (
        <>
          <div className="player-life"><LifeMeter lives={rideStatus.lives}/></div>
          {night && <GhostRadar />}
        </>
      )}
      {rideStatus.crashed && (rideStatus.damage??1)>0 && (
        <div className="ride-crash-banner" role="alert">
          <span className="ride-crash-icon">💥</span>
          <div className="ride-crash-text">
            <strong>{rideStatus.lives === 0 ? "Life ကုန်သွားပါပြီ" : "တိုက်မိပါပြီ!"}</strong>
            <span>
              {rideStatus.lives === 0
                ? "Life ကုန်သွားသဖြင့် အစသို့ ပြန်လည်စတင်ပါမည်…"
                : `Life ${rideStatus.damage??1} လျော့သွားပါသည် (ကျန်ရှိ: ${rideStatus.lives})`}
            </span>
          </div>
        </div>
      )}
      {!intro.active && !balloonStatus.riding&&!mapOpen&&!settingsOpen&&<RideControls status={rideStatus} limit={rideLimit} onLimit={setRideLimit} onBrake={setBraking} onAccelerate={setAccelerating} onDismount={()=>{setBraking(false);setAccelerating(false);setDismountRequest(n=>n+1)}}/>}
      {!intro.active && !balloonStatus.riding&&!mapOpen&&!settingsOpen&&!loading&&<CarControls status={carStatus}/>}
      <BalloonControls status={balloonStatus} paused={intro.active||mapOpen||settingsOpen||loading} onTopView={toggleTopDown} onZoom={direction=>setZoom(v=>Math.max(6,Math.min(3600,v*(direction>0?1.4:1/1.4))))}/>
      {!intro.active && <MobileControls
        key={navigationRequest?.seq ?? 0}
        input={mobileInput}
        flying={balloonStatus.riding}
        onFoot={!rideStatus.riding&&!carStatus.driving&&!rideStatus.crashed&&!ridingHorse}
        canJump={!balloonStatus.riding && character === "cartoon" && !rideStatus.riding && !carStatus.driving && !rideStatus.crashed}
        disabled={mapOpen || settingsOpen || loading || carStatus.driving || subscriptionShop.isOpen || teleportMode || footballView.active || !visible}
        onInteract={activateMobile}
      />}
      {!intro.active && (
        <BotFightControls
          disabled={
            mapOpen ||
            settingsOpen ||
            loading ||
            carStatus.driving ||
            rideStatus.riding ||
            balloonStatus.riding ||
            ridingHorse ||
            subscriptionShop.isOpen ||
            teleportMode ||
            footballView.active ||
            !visible
          }
          onInteract={activateMobile}
        />
      )}
      {webglLost && (
        <div className="webgl-recovery-banner" role="alert" aria-live="assertive">
          <span>Restoring 3D graphics context… Your position is saved.</span>
        </div>
      )}

      {/* Floating Confirmation Overlay for Teleport Target */}
      {teleportMode && teleportPin && teleportScreenPos && (
        <TeleportConfirmOverlay
          screenX={teleportScreenPos.x}
          screenY={teleportScreenPos.y}
          visible={teleportScreenPos.visible}
          pin={teleportPin}
          playerX={pos.x}
          playerZ={pos.z}
          playerYaw={robotYaw}
          onConfirm={handleConfirmTeleport}
          onCancel={handleCancelTeleport}
        />
      )}

      {/* Near-Horse Mount Button (unlocked only after Zombie Mission) */}
      {nearHorseEligible && horseUnlocked && (
          <button
            type="button"
            className="horse-ride-prompt"
            aria-label="မြင်းစီးမည် (E)"
            title="မြင်းစီးမည် (E)"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={() => triggerHorseMountButton()}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.8 6.4c-.6-.7-1.4-1.2-2.3-1.4l-.8-1.7c-.2-.4-.8-.4-1 .1l-.6 1.5c-1.7.3-3.2 1.2-4.3 2.5L9.5 9H6.2C4.5 9 3.2 10.3 3 12l-.5 3.4c-.1.5.3 1 .8 1h.9l.4-2.5c.1-.5.5-.9 1-.9h.7l-.9 6.2c-.1.5.3.8.8.8h1.1c.4 0 .8-.3.8-.7l.7-4.3h4.5l.6 4.3c.1.4.4.7.8.7h1.1c.5 0 .9-.4.8-.9l-.8-5.7c1.4-.7 2.4-2 2.7-3.6l1.4-.4c.6-.2 1-.8.9-1.4l-.2-1.6Z" />
            </svg>
            <span className="horse-ride-prompt-text">
              <strong>မြင်းစီးမည်</strong>
              <small>Horse · E</small>
            </span>
          </button>
        )}

      {/* Brief auto-hiding toast when approaching a horse before completing Zombie Mission */}
      {horseLockedNotice && !horseUnlocked && !intro.active && !loading && !mapOpen && !settingsOpen && (
        <div className="horse-locked-toast" role="status" aria-live="polite">
          <span aria-hidden="true">🐎</span>
          <span>{HORSE_LOCKED_MESSAGE}</span>
        </div>
      )}

      {/* Active Horse Riding Speed Pill (below ghost-hud-pill, or below location-toast while visible) & Dismount Button (left of Jump & Sprint) */}
      {!intro.active && !loading && !mapOpen && !settingsOpen && ridingHorse && (
        <>
          <div
            className={[
              "horse-ride-speed",
              (classroomNotice && classroomNoticeNearPlayer) || arrivalToast
                ? "horse-ride-speed-below-location"
                : "horse-ride-speed-below-ghost",
              showFootballScoreHud
                ? "horse-ride-speed-football"
                : nearSchoolHall
                  ? "horse-ride-speed-school"
                  : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
            aria-live="polite"
            aria-label="မြင်းစီး အမြန်နှုန်း"
          >
            🐎 {horseStatus.phase === "mounting" ? "တက်နေသည်…" : `${horseStatus.speedKmh} km/h`}
            {horseStatus.airborne ? " · ခုန်" : horseStatus.galloping ? " · ပြေး" : ""}
          </div>
          <button
            type="button"
            className="horse-ride-dismount"
            aria-label="မြင်းပေါ်မှ ဆင်းမည် (E)"
            title="မြင်းပေါ်မှ ဆင်းမည် (E)"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={() => triggerHorseDismountButton()}
          >
            <div className="horse-ride-dismount-inner">
              <svg
                className="horse-ride-dismount-icon"
                viewBox="0 0 64 64"
                width="36"
                height="36"
                fill="none"
                aria-hidden="true"
              >
                {/* Horse silhouette (standing profile) */}
                <path
                  d="M 52.5 23.5 L 48.2 19.2 L 46.8 14.8 L 44.3 18.2 C 40.6 19.3 37.8 22.1 35.8 25.8 L 23.5 26.8 C 19.4 27.1 16.5 29.8 15.6 33.6 L 12.6 39.2 C 11.8 40.6 13.6 41.9 14.9 40.8 L 17.8 38.2 L 17.5 52.5 C 17.5 53.7 18.4 54.5 19.5 54.5 L 21.3 54.5 C 22.3 54.5 23.1 53.7 23.2 52.6 L 24.4 41.5 L 36.2 41.5 L 37.5 52.6 C 37.6 53.7 38.4 54.5 39.5 54.5 L 41.3 54.5 C 42.4 54.5 43.3 53.6 43.2 52.5 L 42.4 38.8 C 45.4 36.8 47.4 33.4 48.2 29.2 L 52.4 27.8 C 53.9 27.3 54.2 25.0 52.5 23.5 Z"
                  fill="currentColor"
                />
                {/* Rider dismounting curved down-arrow from saddle to ground */}
                <path
                  d="M 30 22 C 29 12 18 10 11 16 C 7.5 19 6.5 24 6.5 31"
                  stroke="#38bdf8"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M 2.5 27.5 L 6.5 33.5 L 11.5 27.5"
                  stroke="#38bdf8"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Saddle accent */}
                <path
                  d="M 25.5 25.2 Q 30.5 28.5 35.2 25.2"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="horse-ride-dismount-label">ဆင်း</span>
            </div>
          </button>
        </>
      )}

      {/* Near-Character "Football View" button when arriving at any football pitch */}
      {!intro.active &&
        !loading &&
        !mapOpen &&
        !settingsOpen &&
        !teleportMode &&
        !footballView.active &&
        !carStatus.driving &&
        !balloonStatus.riding &&
        !rideStatus.riding &&
        footballMatchActive &&
        footballViewPitch && (
          <button
            type="button"
            className="football-view-prompt"
            aria-label="Football View (TV ကဲ့သို့ ဘောလုံးပွဲကြည့်မည်)"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={() => {
              if (document.pointerLockElement) document.exitPointerLock();
              resetMobileInput(mobileInput.current);
              enterFootballView(footballViewPitch.id, "tv");
            }}
          >
            <span className="football-view-prompt-icon" aria-hidden="true">📺</span>
            <span className="football-view-prompt-text">
              <strong>Football View</strong>
              <small>TV ကဲ့သို့ ပွဲကြည့်မည်</small>
            </span>
          </button>
        )}

      {/* Live TV Broadcast Control Bar while inside Football View */}
      {footballView.active && !loading && !mapOpen && !settingsOpen && (
        <div
          className="football-view-bar"
          role="region"
          aria-label="Football View TV ကင်မရာ ထိန်းချုပ်မှု"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="football-view-bar-angle"
            onClick={() => cycleFootballViewPreset()}
            title="ကင်မရာထောင့် ပြောင်းမည်"
          >
            {FOOTBALL_CAMERA_PRESETS.find((p) => p.id === footballView.preset)?.label ?? "📺 TV View"} · ပြောင်း
          </button>
          <button
            type="button"
            className="football-view-bar-exit"
            onClick={() => exitFootballView()}
            aria-label="Football View မှ ထွက်မည်"
          >
            ✕ ထွက်မည်
          </button>
        </div>
      )}

      <SubscriptionProximityPrompt
        shop={subscriptionShop}
        visible={
          !intro.active &&
          !mapOpen &&
          !settingsOpen &&
          !guideOpen &&
          !loading &&
          !carStatus.driving &&
          !balloonStatus.riding &&
          !rideStatus.riding
        }
      />
      {!intro.active && !mapOpen && displayedGuidance && (
        <div className="home-guidance" role="status" aria-live="polite">
          <span className="home-guidance-pill">🏡 အိမ်လမ်းညွှန်</span>
          <span className="home-guidance-text">{displayedGuidance}</span>
        </div>
      )}
      <MultiplayerPanel session={multiplayer} hidden={loading || hideHud || mapOpen || settingsOpen || intro.active} />
      <header>
        <h1 style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
          MM Region Game - မြန်မာဒေသ 3D ဂိမ်း
        </h1>
        {/* <span className="eyebrow">EXPLORE MYANMAR · 📍 {currentLoc.subArea ?? currentLoc.label}</span> */}
        {/* <h1>{currentLoc.title}</h1> */}
        {/* <p>{currentLoc.subtitle}</p> */}
      </header>
      {!intro.active && classroomNotice && classroomNoticeNearPlayer && !mapOpen && (
        <div
          className={
            showFootballScoreHud
              ? "location-toast location-toast-below-football"
              : nearSchoolHall
                ? "location-toast location-toast-below-school"
                : "location-toast"
          }
          role="status"
          aria-live="polite"
        >
          <span className="location-toast-icon">📚</span>
          <div className="location-toast-body">
            <strong>{classroomNotice.hallName}</strong>
            <span>{classroomNotice.message}</span>
          </div>
        </div>
      )}
      {!intro.active && arrivalToast && !(classroomNotice && classroomNoticeNearPlayer) && !mapOpen && (
        <div
          className={
            showFootballScoreHud
              ? "location-toast location-toast-below-football"
              : nearSchoolHall
                ? "location-toast location-toast-below-school"
                : "location-toast"
          }
          role="status"
          aria-live="polite"
        >
          <span className="location-toast-icon">📍</span>
          <div className="location-toast-body">
            <strong>{arrivalToast.title}</strong>
            <span>
              {arrivalToast.subArea &&
              arrivalToast.subArea !== arrivalToast.title
                ? arrivalToast.subArea
                : arrivalToast.subtitle}
            </span>
          </div>
        </div>
      )}
      {!intro.active && (
        <div
          className={settingsOpen ? "settings-wrap settings-wrap-open" : "settings-wrap"}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hudMenuOpen && !mapOpen && !settingsOpen && (
            <div className="hud-menu-items" role="group" aria-label="Menu actions">
              <div className="location-actions">
                <button
                  type="button"
                  aria-label="ကင်မရာကို မိမိဇာတ်ကောင်ရှိရာသို့ ပြန်ခေါ်မည်"
                  title="မိမိဇာတ်ကောင်ရှိရာသို့ ကင်မရာ ပြန်ခေါ်မည်"
                  onClick={() => navigate("locate")}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="7" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <path d="M12 1v4m0 14v4M1 12h4m14 0h4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={teleportMode ? "location-btn-active" : ""}
                  aria-label="Scene ပေါ်တွင် ထောက်၍ သွားလိုသည့်နေရာသို့ Teleport လုပ်မည်"
                  title={teleportMode ? "Teleport ရွေးချယ်မှု ပိတ်မည်" : "Scene ပေါ်တွင် ထောက်၍ သွားလိုသည့်နေရာသို့ Teleport လုပ်မည်"}
                  onClick={handleToggleTeleportMode}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 3v12m-4-4 4 4 4-4M6 14c-3 1-4 2-4 4 0 2 4 3 10 3s10-1 10-3c0-2-1-3-4-4" />
                  </svg>
                </button>
                <ActionMenu
                  open={actionMenuOpen}
                  onOpenChange={setActionMenuOpen}
                  character={character}
                  disabledReason={
                    balloonStatus.riding
                      ? "မီးပုံးပျံပေါ်မှ ဆင်းပြီးမှ အကကစားနိုင်ပါမည်။"
                      : carStatus.driving
                        ? "ကားမောင်းနေစဉ် အကကစား၍ မရပါ။"
                        : rideStatus.riding
                          ? "ဆိုင်ကယ်ပေါ်မှ ဆင်းပြီးမှ အကကစားနိုင်ပါမည်။"
                          : isVehicleWaitingPickupLocked(vehicleWaiting.state) || vehicleWaiting.state === "ENTERING_VEHICLE"
                            ? "ကားစောင့်နေစဉ် အကကစား၍ မရပါ။"
                            : null
                  }
                />
                {!isNativeApp() && fullscreenSupported && (
                  <button
                    type="button"
                    className={isFullscreen ? "location-btn-active" : ""}
                    aria-label={isFullscreen ? "မျက်နှာပြင်ပြည့် (Fullscreen) မှ ထွက်မည်" : "မျက်နှာပြင်ပြည့် (Fullscreen) ဖွင့်မည်"}
                    title={isFullscreen ? "မျက်နှာပြင်ပြည့် ပိတ်မည်" : "မျက်နှာပြင်ပြည့် (Fullscreen)"}
                    onClick={() => {
                      toggleFullscreen();
                    }}
                  >
                    {isFullscreen ? (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                      </svg>
                    ) : (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    )}
                  </button>
                )}
                {navigationNotice && <p role="status">{navigationNotice}</p>}
              </div>
              <WeaponMenu/>
              <UpdateTriggerButton
                active={updatesOpen}
                onClick={() => {
                  if (document.pointerLockElement) document.exitPointerLock();
                  setSettingsOpen(false);
                  setActionMenuOpen(false);
                  setHudMenuOpen(false);
                  setUpdatesOpen((v) => !v);
                }}
              />
              <button
                type="button"
                className={
                  settingsOpen ? "settings-btn settings-btn-active" : "settings-btn"
                }
                aria-label="အသုံးပြုနည်း လမ်းညွှန်နှင့် ဆက်တင်"
                aria-expanded={settingsOpen}
                title="အသုံးပြုနည်း လမ်းညွှန်နှင့် ဆက်တင်"
                onClick={() => {
                  if (document.pointerLockElement) document.exitPointerLock();
                  setUpdatesOpen(false);
                  setActionMenuOpen(false);
                  setHudMenuOpen(false);
                  setRobotYaw(robotYawRef.current);
                  setPos({ x: posRef.current.x, z: posRef.current.z });
                  setSettingsOpen(true);
                }}
              >
                ⚙
              </button>
            </div>
          )}
          {!mapOpen && !settingsOpen && (
            <button
              type="button"
              className={
                hudMenuOpen
                  ? "settings-btn hud-menu-btn settings-btn-active"
                  : "settings-btn hud-menu-btn"
              }
              aria-label={hudMenuOpen ? "မီနူး ပိတ်မည်" : "မီနူး ဖွင့်မည်"}
              aria-expanded={hudMenuOpen}
              title={hudMenuOpen ? "မီနူး ပိတ်မည်" : "မီနူး"}
              onClick={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setHudMenuOpen((v) => {
                  if (v) setActionMenuOpen(false);
                  return !v;
                });
              }}
            >
              {hudMenuOpen ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
              {!hudMenuOpen && otaNeedsAttention && (
                <span className="ota-trigger-dot" aria-hidden="true" />
              )}
            </button>
          )}
          <SettingsMenu
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          character={character}
          onChooseCharacter={chooseCharacter}
          characterLocked={rideStatus.riding || carStatus.driving || balloonStatus.riding}
          carLocked={carStatus.driving}
          pos={pos}
          robotYaw={robotYaw}
          currentLoc={currentLoc}
          wardSize={ward.size}
          environment={environment}
          topDown={topDown}
          zoom={zoom}
          onToggleTopDown={toggleTopDown}
          onStepZoom={stepZoom}
          onOpenMap={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setSettingsOpen(false);
            setPos({ x: posRef.current.x, z: posRef.current.z });
            setMapOpen(true);
          }}
          onOpenGuide={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setSettingsOpen(false);
            setGuideOpen(true);
          }}
          onReplayIntro={handleReplayIntro}
          onOpenApkDownload={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setApkDialog({ open: true, mode: "manual" });
          }}
        />
        </div>
      )}
      {!intro.active && !welcomeDismissed && !mapOpen && !topDown && !rideStatus.riding && !carStatus.driving && !guideOpen && (
        <section className="welcome" aria-label="ကြိုဆိုပါသည်">
          <div className="welcome-actions">
            <button
              type="button"
              className="welcome-btn welcome-btn-start"
              onClick={() => {
                setWelcomeDismissed(true);
                setSceneActive(true);
                document.querySelector("canvas")?.requestPointerLock();
              }}
            >
              စတင်မယ်
            </button>
            <button
              type="button"
              className="welcome-btn welcome-btn-guide"
              onClick={() => {
                setGuideOpen(true);
              }}
            >
              လမ်းညွှန်
            </button>
          </div>
        </section>
      )}
      <GuideDialog
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        onStart={() => {
          setGuideOpen(false);
          setWelcomeDismissed(true);
          setSceneActive(true);
          document.querySelector("canvas")?.requestPointerLock();
        }}
      />
      {locked && <div className="crosshair">+</div>}
      {!intro.active && <aside
        className={mapOpen ? "map map-expanded" : "map"}
        aria-label="Ward plan"
        onClick={() => {
          if (!mapOpen) {
            if (document.pointerLockElement) document.exitPointerLock();
            setSettingsOpen(false);
            setPos({ x: posRef.current.x, z: posRef.current.z });
            setMapOpen(true);
          }
        }}
      >
        <button
          type="button"
          className="map-toggle"
          aria-expanded={mapOpen}
          onClick={(e) => {
            e.stopPropagation();
            if (document.pointerLockElement) document.exitPointerLock();
            setSettingsOpen(false);
            setMapOpen((v) => {
              const next = !v;
              if (next) {
                setPos({ x: posRef.current.x, z: posRef.current.z });
                setRobotYaw(robotYawRef.current);
              }
              return next;
            });
          }}
        >
          {mapOpen ? (
            <span>✕ ပိတ်ရန် · ရပ်ကွက်နှင့် ကျေးရွာများ မြေပုံ ({currentLoc.label})</span>
          ) : (
            <span>📍 {currentLoc.label} ↗</span>
          )}
          <b>မြောက် ↖</b>
        </button>
        {mapOpen && (
          <div
            className="map-jump-bar"
            aria-label="နယ်မြေနှင့် ရွာများသို့ တိုက်ရိုက်သွားရန်"
          >
            <span>နယ်မြေ / ရွာ ရွေး၍ 3D Scene သို့ သွားရန် —</span>
            {MAP_DESTINATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={
                  currentLoc.id === d.id
                    ? "map-jump-btn map-jump-btn-active"
                    : activeGhostZoneIds.has(d.id)
                      ? "map-jump-btn map-jump-btn-haunted"
                      : "map-jump-btn"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectLocation(d.id);
                }}
              >
                {activeGhostZoneIds.has(d.id) ? "👻" : "📍"} {d.label} ↗
              </button>
            ))}
            <span className="map-haunt-note">
              {activeGhostZones.length > 0
                ? `🌙 ညအချိန် သရဲခြောက်ဇုန် — ${activeGhostZones.map((z) => z.zoneName.split("·")[0].trim()).join(" · ")}`
                : "🌙 သရဲမြင်လိုပါက ဆက်တင်မှ 🌙 ညအချိန်သို့ ပြောင်း၍ သိုလှောင်ရုံတန်း (AH1) သို့ သွားပါ"}
            </span>
          </div>
        )}
        <svg
          viewBox={`${-ward.size / 2 - 5} ${-ward.size / 2 - 5} ${ward.size + 10} ${ward.size + 10}`}
          aria-label="မြို့သာရပ်ကွက် မြေပုံ"
        >
          <rect
            x={-ward.size / 2}
            y={-ward.size / 2}
            width={ward.size}
            height={ward.size}
            fill="#92a36b"
          />
          {mapOpen && !mobileQuality && (
            <Suspense fallback={null}>
              <KalayWardsPlan
                labels={mapOpen}
                onSelectLocation={handleSelectLocation}
              />
              <KalayVillagesPlan
                labels={mapOpen}
                onSelectLocation={handleSelectLocation}
              />
            </Suspense>
          )}
          {(!mapOpen || mobileQuality) &&
            MAP_DESTINATIONS.map((d) => (
              <g
                key={d.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectLocation(d.id);
                }}
                style={{ cursor: "pointer" }}
              >
                <circle cx={d.x} cy={d.z} r={55} fill="#2563a6" />
                {mapOpen && (
                  <text
                    x={d.x + 70}
                    y={d.z}
                    fontSize={65}
                    fill="#173d35"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            ))}
          {/* Active Ghost Zones (Zone Area Indicators) */}
          {activeGhostZones.map((zone) => (
            <circle
              key={`ghost-zone:${zone.ghostId}:${zone.zoneId}`}
              cx={zone.x}
              cy={zone.z}
              r={mapOpen ? 46 : 115}
              fill="rgba(168, 85, 247, 0.24)"
              stroke="#c084fc"
              strokeWidth={mapOpen ? 8 : 20}
              pointerEvents="none"
            />
          ))}

          {/* Realtime Live Ghost Markers */}
          {liveGhosts.map((g, idx) => {
            const gr = mapOpen ? 38 : 110;
            const ghostColors = ["#c084fc", "#fbbf24", "#fb7185"];
            const color = ghostColors[idx % ghostColors.length];
            return (
              <g key={`live-ghost:${g.id}`} pointerEvents="none">
                {/* Glowing aura */}
                <circle
                  cx={g.x}
                  cy={g.z}
                  r={gr * 1.3}
                  fill={color}
                  opacity={0.35}
                />
                {/* Core dot */}
                <circle
                  cx={g.x}
                  cy={g.z}
                  r={gr * 0.75}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={mapOpen ? 4 : 12}
                />
                {/* Ghost emoji */}
                <text
                  x={g.x}
                  y={g.z + (mapOpen ? 12 : 36)}
                  fontSize={mapOpen ? 36 : 100}
                  textAnchor="middle"
                  style={{ userSelect: "none" }}
                >
                  👻
                </text>
                {mapOpen && (
                  <text
                    x={g.x}
                    y={g.z - gr - 8}
                    fontSize={26}
                    fontWeight="bold"
                    fill={color}
                    textAnchor="middle"
                    stroke="#091622"
                    strokeWidth={5}
                    paintOrder="stroke"
                  >
                    {`သရဲ-${idx + 1}`}
                  </text>
                )}
              </g>
            );
          })}

          {/* Realtime Player Marker with Head Direction Pointer */}
          {(() => {
            const pr = mapOpen ? 34 : 110;
            const headingDeg = (-robotYaw * 180) / Math.PI;
            return (
              <g pointerEvents="none">
                {/* Rotated group centered at (pos.x, pos.z) following head orientation */}
                <g transform={`translate(${pos.x}, ${pos.z}) rotate(${headingDeg})`}>
                  {/* Field of view / Vision cone (ရှေ့မြင်ကွင်း အလင်းရောင်ခြည်) */}
                  <path
                    d={`M 0 0 L ${-pr * 1.3} ${-pr * 2.5} A ${pr * 2.8} ${pr * 2.8} 0 0 1 ${pr * 1.3} ${-pr * 2.5} Z`}
                    fill="rgba(56, 189, 248, 0.35)"
                  />
                  {/* Direction pointer triangle pointing in head direction (ဦးခေါင်းလှည့်ရာ ဦးတည်ချက်မြှားခေါင်း) */}
                  <polygon
                    points={`0,${-pr * 1.85} ${-pr * 0.55},${-pr * 0.35} 0,${-pr * 0.75} ${pr * 0.55},${-pr * 0.35}`}
                    fill="#38bdf8"
                    stroke="#0f172a"
                    strokeWidth={mapOpen ? 3 : 9}
                  />
                  {/* Player outer glow */}
                  <circle
                    cx={0}
                    cy={0}
                    r={pr * 1.25}
                    fill="rgba(56, 189, 248, 0.25)"
                  />
                  {/* Player body circle */}
                  <circle
                    cx={0}
                    cy={0}
                    r={pr}
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth={mapOpen ? 5 : 16}
                  />
                  {/* Player inner face/core */}
                  <circle
                    cx={0}
                    cy={0}
                    r={pr * 0.52}
                    fill="#0284c7"
                  />
                  {/* Forward-facing eyes showing gaze direction */}
                  <circle cx={-pr * 0.22} cy={-pr * 0.22} r={pr * 0.16} fill="#ffffff" />
                  <circle cx={pr * 0.22} cy={-pr * 0.22} r={pr * 0.16} fill="#ffffff" />
                  <circle cx={-pr * 0.22} cy={-pr * 0.28} r={pr * 0.08} fill="#0369a1" />
                  <circle cx={pr * 0.22} cy={-pr * 0.28} r={pr * 0.08} fill="#0369a1" />
                </g>
                {/* Horizontal "YOU" label that remains unrotated for clarity */}
                <text
                  x={pos.x}
                  y={pos.z + pr * 1.55 + (mapOpen ? 18 : 55)}
                  fontSize={mapOpen ? 26 : 75}
                  fontWeight="bold"
                  fill="#0284c7"
                  textAnchor="middle"
                  stroke="#ffffff"
                  strokeWidth={mapOpen ? 4 : 12}
                  paintOrder="stroke"
                >
                  YOU
                </text>
              </g>
            );
          })()}
        </svg>
        <small>
          {ward.currentArea} · သာစည် · ချင်းဆိုင် · ဇင်းကလင်း · ထိုမာ ·
          သာယာကုန်း · ထောက်ကြန့် · ကြာအင်း · ကံပုလဲ · နတ်မြောင်း
        </small>
        {mapOpen && (
          <p className="map-help">
            မြေပုံပေါ်ရှိ သက်ဆိုင်ရာ ရပ်ကွက် / ရွာကို တိုက်ရိုက်နှိပ်၍ 3D
            မြင်ကွင်းသို့ သွားနိုင်ပါသည် · Esc ပိတ်ရန်
          </p>
        )}
      </aside>}
      <IntroOverlay hidden={loading || mapOpen} />
      <footer>
        {/* <span><span className="footer-location">📍 {currentLoc.subArea ?? currentLoc.label} · </span>{topDown ? 'ကောင်းကင်တည့်တည့်' : first ? 'ပထမလူ မြင်ကွင်း' : 'တတိယလူ မြင်ကွင်း'} · Zoom {Math.round(zoom)} မီတာ · {pos.x.toFixed(1)}, {pos.z.toFixed(1)} မီတာ</span> */}
      </footer>
      </div>
      <SubscriptionShopDialog
        isOpen={subscriptionShop.isOpen}
        url={subscriptionShop.url}
        title={subscriptionShop.title}
        onClose={closeSubscriptionShop}
        onBeforeOpenExternal={flushSaveNow}
      />
      <UpdateFloatingBanner
        hidden={loading || intro.active || mapOpen || settingsOpen || updatesOpen || apkDialog.open}
        onOpenUpdates={() => {
          if (document.pointerLockElement) document.exitPointerLock();
          setUpdatesOpen(true);
        }}
      />
      <UpdateStatusDialog
        open={updatesOpen}
        onClose={() => setUpdatesOpen(false)}
      />
      <AndroidApkDownloadDialog
        open={apkDialog.open}
        mode={apkDialog.mode}
        onClose={(dontShowAgain) => {
          if (apkDialog.mode === "auto-prompt" && dontShowAgain) {
            writeAndroidApkPromptDismissed(true);
          }
          setApkDialog((prev) => ({ ...prev, open: false }));
        }}
      />
      <WorldLoading state={sceneLoading} sceneFailed={sceneFailed} />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {is3DList ? (
      <Suspense fallback={<div>Loading 3D library…</div>}>
        <AssetLibraryPage />
      </Suspense>
    ) : isMapPortal ? (
      <Suspense fallback={<div className="selection-loading" role="status">မြေပုံစာမျက်နှာ ဖွင့်နေသည်…</div>}>
        <MapPortalPage />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
