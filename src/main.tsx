import {BalloonControls} from './components/BalloonControls';
import {emptyBalloonStatus,clearBalloonInput,type BalloonStatus} from './game/balloonRide';
import {LifeMeter} from './components/LifeMeter';
import {AppearanceSettings} from './components/AppearanceSettings';
import { RideControls } from './components/RideControls';
import { CarControls } from './components/CarControls';
import { GuideDialog } from './components/GuideDialog';
import type { CarStatus } from './game/carRide';
import type { RideStatus } from './game/motorcycleRide';
import { RobotLocationPanel } from "./components/RobotLocationPanel";
import {
  CharacterPicker,
  savedCharacter,
  CHARACTER_STORAGE_KEY,
  type CharacterKind,
} from "./components/CharacterPicker";
import { homeGuidance } from "./game/homeAccess";
import { FrameBudget } from "./components/FrameBudget";
import { mobileQuality } from "./game/sceneBudget";
import { MobileControls } from "./components/MobileControls";
import { createMobileInput, resetMobileInput } from "./game/mobileInput";
import React, {
  Component,
  lazy,
  Suspense,
  memo,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
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
import "./style.css";

const KalayWardsPlan = lazy(() =>
  import("./components/wards").then((m) => ({ default: m.KalayWardsPlan })),
);
const MapSelectionTool = lazy(() => import('./components/MapSelectionTool'));
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
  componentDidCatch() {
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
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  const [first, setFirst] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pos, setPos] = useState(ward.spawn);
  const [robotYaw, setRobotYaw] = useState(ward.spawnYaw);
  const [viewPos, setViewPos] = useState(ward.spawn);
  const viewPosition = useCallback(
    (x: number, z: number) =>
      setViewPos((p) => (p.x === x && p.z === z ? p : { x, z })),
    [],
  );
  const [mapOpen, setMapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [sceneActive, setSceneActive] = useState(false);
  const [topDown, setTopDown] = useState(false);
  const [zoom, setZoom] = useState(ward.spawnZoom);
  const [night, setNight] = useState(false);
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
  const [teleportPin, setTeleportPin] = useState<TeleportPin | null>(null);
  const [teleportScreenPos, setTeleportScreenPos] = useState<ScreenPosition | null>(null);
  const [teleportDragging, setTeleportDragging] = useState(false);

  const handleToggleTeleportMode = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setTeleportMode((prev) => {
      const next = !prev;
      if (!next) {
        setTeleportPin(null);
        setTeleportScreenPos(null);
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
  const prevLocKey = useRef(`${currentLoc.id}:${currentLoc.subArea ?? ""}`);

  useEffect(() => {
    const key = `${currentLoc.id}:${currentLoc.subArea ?? ""}`;
    if (prevLocKey.current === key) return;
    prevLocKey.current = key;
    setArrivalToast(currentLoc);
    const timer = window.setTimeout(() => setArrivalToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [currentLoc]);

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
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (selectionOpen) return;
      if (loading) return;
      if (e.code === "Escape") {
        setMapOpen(false);
        setSettingsOpen(false);
        setSceneActive(false);
        setTeleportMode(false);
        setTeleportPin(null);
        setTeleportScreenPos(null);
      }
      if (e.code === "KeyN" && !e.repeat) {
        setNight((v) => !v);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [loading, selectionOpen]);
  const position = useCallback((x: number, z: number, yaw?: number) => {
    setPos((previous) =>
      previous.x === x && previous.z === z ? previous : { x, z },
    );
    if (yaw !== undefined) setRobotYaw(yaw);
  }, []);
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
  return (
    <main className={night ? "night-mode" : ""}>
      <div className="game-content" inert={loading}>
      <div
        className="scene-wrap"
        onClick={() => {
          if (!mapOpen && !loading) {
            setSceneActive(true);
            setSettingsOpen(false);
          }
        }}
      >
        <SceneError onError={sceneError}>
          <Canvas
            frameloop={visible ? loading ? "demand" : "always" : "never"}
            shadows={!mobileQuality}
            gl={{
              logarithmicDepthBuffer: true,
              antialias: !mobileQuality,
              powerPreference: "default",
            }}
            camera={{ position: [0, 5, 33], fov: 65, near: 0.1, far: 9000 }}
            dpr={mobileQuality ? 1 : [1, 1.25]}
          >
            <FrameBudget />
            <Town night={night} destination={teleportTarget} paused={loading} onLoadingChange={setSceneLoading} onSceneError={sceneError} />
            <TeleportPicker
              active={teleportMode}
              pin={teleportPin}
              onPickPin={setTeleportPin}
              onScreenPos={setTeleportScreenPos}
              onDraggingChange={setTeleportDragging}
            />
            <Player
              speedLimit={rideLimit} braking={braking} accelerating={accelerating} dismountRequest={dismountRequest} onRideStatus={rideUpdate} controlsBlocked={settingsOpen || loading || guideOpen || selectionOpen} loading={loading}
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
            />
            <MapLabelsProjection host={mapLabelsHost} enabled={!loading && !mapOpen && !first} />
          </Canvas>
        </SceneError>
        <MapLabelsOverlay host={mapLabelsHost} hidden={loading || mapOpen || first} />
      </div>
      {!loading && !rideStatus.riding && !carStatus.driving && <div className="player-life"><LifeMeter lives={rideStatus.lives}/></div>}
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
      {!balloonStatus.riding&&!mapOpen&&!settingsOpen&&<RideControls status={rideStatus} limit={rideLimit} onLimit={setRideLimit} onBrake={setBraking} onAccelerate={setAccelerating} onDismount={()=>{setBraking(false);setAccelerating(false);setDismountRequest(n=>n+1)}}/>}
      {!balloonStatus.riding&&!mapOpen&&!settingsOpen&&!loading&&<CarControls status={carStatus}/>}
      <BalloonControls status={balloonStatus} paused={mapOpen||settingsOpen||loading} onTopView={toggleTopDown} onZoom={direction=>setZoom(v=>Math.max(6,Math.min(3600,v*(direction>0?1.4:1/1.4))))}/>
      <MobileControls
        key={navigationRequest?.seq ?? 0}
        input={mobileInput}
        flying={balloonStatus.riding}
        canJump={!balloonStatus.riding && character === "cartoon" && !rideStatus.riding && !carStatus.driving && !rideStatus.crashed}
        disabled={mapOpen || settingsOpen || loading || carStatus.driving}
        onInteract={activateMobile}
      />
      {!mapOpen && !settingsOpen && (
        <div
          className="location-actions"
          onPointerDown={(e) => e.stopPropagation()}
        >
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
          {navigationNotice && <p role="status">{navigationNotice}</p>}
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

      {!mapOpen && displayedGuidance && (
        <div className="home-guidance" role="status" aria-live="polite">
          <span className="home-guidance-pill">🏡 အိမ်လမ်းညွှန်</span>
          <span className="home-guidance-text">{displayedGuidance}</span>
        </div>
      )}
      <header>
        <h1 style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
          MM Region Game - မြန်မာဒေသ 3D ဂိမ်း
        </h1>
        {/* <span className="eyebrow">EXPLORE MYANMAR · 📍 {currentLoc.subArea ?? currentLoc.label}</span> */}
        {/* <h1>{currentLoc.title}</h1> */}
        {/* <p>{currentLoc.subtitle}</p> */}
      </header>
      {arrivalToast && !mapOpen && (
        <div className="location-toast" role="status" aria-live="polite">
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
      <div className="settings-wrap">
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
            setSettingsOpen((v) => !v);
          }}
        >
          ⚙
        </button>
        {settingsOpen && (
          <section
            className="settings-menu"
            aria-label="အသုံးပြုနည်း လမ်းညွှန်"
          >
            <CharacterPicker value={character} onChange={chooseCharacter} disabled={rideStatus.riding||carStatus.driving||balloonStatus.riding}/>
            <AppearanceSettings kind={character} onKindChange={chooseCharacter} characterLocked={rideStatus.riding||carStatus.driving||balloonStatus.riding} carLocked={carStatus.driving}/>
            <RobotLocationPanel
              x={pos.x}
              z={pos.z}
              yaw={robotYaw}
              characterLabel={character === "robot" ? "စက်ရုပ်" : "ကာတွန်း"}
            />
            <div className="robot-location-panel map-selection-launch">
              <button type="button" className="robot-location-toggle" onClick={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setSceneActive(false);
                setSelectionOpen(true);
              }}>နယ်မြေဝိုက်ရွေး · GeoJSON ထုတ်ယူရန် ↗</button>
              <p>အိမ်၊ အဆောက်အဦ၊ ဌာန၊ သစ်ပင် ဖြည့်လိုသည့်နေရာကို မြေပုံပေါ်မှာ ဝိုက်ရွေးပါ။</p>
            </div>
            <div className="guide-item">
              <div className="guide-header">
                <strong>အသုံးပြုနည်း လမ်းညွှန်</strong>
                <div className="badge">
                  <span /> မြေပုံ · {currentLoc.label}{" "}
                  <b>
                    {ward.size} × {ward.size} မီတာ
                  </b>
                </div>
              </div>
              <div
                className="time-controls"
                aria-label="နေ့ခင်းနှင့် ညချမ်း အလင်းရောင် ထိန်းချုပ်မှုများ"
              >
                <div className="time-header">
                  <span className="time-title">
                    အချိန်ကာလ ရွေးချယ်မှု
                  </span>
                  <span className="time-status-pill">
                    {night ? "🌙 ညချမ်း" : "☀️ နေ့ခင်း"}
                  </span>
                </div>
                <div className="time-btn-row">
                  <button
                    type="button"
                    className={!night ? "time-btn time-btn-active" : "time-btn"}
                    onClick={() => setNight(false)}
                    title="နေ့ခင်း အလင်းရောင်"
                  >
                    <span className="time-icon">☀️</span>
                    <span>နေ့ခင်း</span>
                  </button>
                  <button
                    type="button"
                    className={night ? "time-btn time-btn-active" : "time-btn"}
                    onClick={() => setNight(true)}
                    title="ညချမ်း လရောင်နှင့် မီးရောင်များ"
                  >
                    <span className="time-icon">🌙</span>
                    <span>ညချမ်း</span>
                  </button>
                </div>
              </div>
              <div className="cam-controls" aria-label="3D ကင်မရာ ထိန်းချုပ်မှုများ">
                <button
                  type="button"
                  className="cam-btn"
                  onClick={() => {
                    if (document.pointerLockElement) document.exitPointerLock();
                    setSettingsOpen(false);
                    setGuideOpen(true);
                  }}
                >
                  📖 အသုံးပြုနည်း လမ်းညွှန် ↗
                </button>
                <button
                  type="button"
                  className="cam-btn"
                  onClick={() => {
                    if (document.pointerLockElement) document.exitPointerLock();
                    setSettingsOpen(false);
                    setMapOpen(true);
                  }}
                >
                  ရပ်ကွက်မြေပုံ ↗
                </button>
                <button
                  type="button"
                  className={topDown ? "cam-btn cam-btn-active" : "cam-btn"}
                  aria-pressed={topDown}
                  onClick={toggleTopDown}
                >
                  {topDown
                    ? "✓ ကောင်းကင်တည့်တည့်"
                    : "ကောင်းကင်တည့်တည့် (T)"}
                </button>
                <div className="cam-zoom-row">
                  <button
                    type="button"
                    className="cam-btn"
                    onClick={() => stepZoom(-1)}
                    title="Zoom ချဲ့မည်"
                  >
                    ＋ Zoom ချဲ့မည်
                  </button>
                  <button
                    type="button"
                    className="cam-btn"
                    onClick={() => stepZoom(1)}
                    title="Zoom ချုံ့မည်"
                  >
                    － Zoom ချုံ့မည်
                  </button>
                </div>
              </div>
              <ul className="guide-list desktop-guide">
                <li>
                  <kbd>N</kbd>
                  <span>နေ့ခင်း / ညချမ်း အလင်းရောင်</span>
                </li>
                <li>
                  <kbd>W A S D / ↑ ↓ ← →</kbd>
                  <span>လမ်းလျှောက် / မြေပုံရွှေ့ရန်</span>
                </li>
                <li>
                  <kbd>Shift + Drag</kbd>
                  <span>မြေပုံကို ဆွဲရွှေ့ရန်</span>
                </li>
                <li>
                  <kbd>Shift</kbd>
                  <span>အမြန်ပြေးရန်</span>
                </li>
                <li>
                  <kbd>Space</kbd>
                  <span>လူဇာတ်ကောင် ခုန်ရန် · ပြေးရင်းခုန်လျှင် ပိုဝေးရောက်မည်</span>
                </li>
                <li>
                  <kbd>Scroll</kbd>
                  <span>Zoom အဝင် / အထွက်</span>
                </li>
                <li>
                  <kbd>T</kbd>
                  <span>ကောင်းကင်တည့်တည့် ကြည့်ရန်</span>
                </li>
                <li>
                  <kbd>V</kbd>
                  <span>မြင်ကွင်းပြောင်းရန်</span>
                </li>
                <li>
                  <kbd>R</kbd>
                  <span>မူလနေရာ (အစသို့)</span>
                </li>
                <li>
                  <kbd>Esc</kbd>
                  <span>Mouse လွှတ်ရန် / ပိတ်ရန်</span>
                </li>
              </ul>
              <p className="mobile-guide">
                ဘယ်ဘက်ဆွဲ၍ ၃၆၀° လှည့်ပါ · ညာဘက်ဖိ၍ ပြေးပါ · ညာဘက်ဆွဲ၍ ကြည့်ပါ
                · လက်နှစ်ချောင်းဖြင့် Zoom ချဲ့/ချုံ့ပါ · လက်နှစ်ချောင်းဆွဲ၍ ခရီးသွားပါ
              </p>
            </div>
          </section>
        )}
      </div>
      {!welcomeDismissed && !mapOpen && !topDown && !rideStatus.riding && !carStatus.driving && !guideOpen && (
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
      {selectionOpen && <Suspense fallback={<div className="selection-loading" role="status">မြေပုံဖွင့်နေသည်…</div>}><MapSelectionTool focus={viewPos} onClose={() => setSelectionOpen(false)} /></Suspense>}
      <aside
        className={mapOpen ? "map map-expanded" : "map"}
        aria-label="Ward plan"
        onClick={() => {
          if (!mapOpen) {
            if (document.pointerLockElement) document.exitPointerLock();
            setSettingsOpen(false);
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
            setMapOpen((v) => !v);
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
                    : "map-jump-btn"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectLocation(d.id);
                }}
              >
                📍 {d.label} ↗
              </button>
            ))}
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
          <circle
            cx={pos.x}
            cy={pos.z}
            r={mapOpen ? "35" : "120"}
            fill="#fff4b3"
            stroke="#173d35"
            strokeWidth={mapOpen ? "8" : "24"}
          />
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
      </aside>
      <footer>
        {/* <span><span className="footer-location">📍 {currentLoc.subArea ?? currentLoc.label} · </span>{topDown ? 'ကောင်းကင်တည့်တည့်' : first ? 'ပထမလူ မြင်ကွင်း' : 'တတိယလူ မြင်ကွင်း'} · Zoom {Math.round(zoom)} မီတာ · {pos.x.toFixed(1)}, {pos.z.toFixed(1)} မီတာ</span> */}
      </footer>
      </div>
      <WorldLoading state={sceneLoading} sceneFailed={sceneFailed} />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
