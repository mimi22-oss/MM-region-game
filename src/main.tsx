import { RideControls } from './components/RideControls';
import { CarControls } from './components/CarControls';
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
import { Town } from "./components/Town";
import { WorldLoading } from "./components/WorldLoading";
import type { WorldLoadingState } from "./game/regionLoading";

import {
  Player,
  MIN_ZOOM,
  MAX_ZOOM,
  type TeleportTarget,
} from "./components/Player";
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
  const [sceneLoading, setSceneLoading] = useState<WorldLoadingState>({
    blocking: true,
    required: [{ id: "myothar", name: ward.name, phase: "queued" }],
    downloads: [],
  });
  const [sceneFailed, setSceneFailed] = useState(false);
  const sceneError = useCallback(() => setSceneFailed(true), []);
  const loading = sceneLoading.blocking || sceneFailed;
  const [rideStatus,setRideStatus]=useState<RideStatus>({riding:false,near:false,kmh:0,notice:'',lives:3,crashed:false});
  const [carStatus,setCarStatus]=useState<CarStatus>({driving:false,near:false,kmh:0,gear:0,rpm:850,clutch:false,notice:'',steering:0,canSummon:false,summonStatus:'idle',first:false});
  const carUpdate=useCallback((next:CarStatus)=>setCarStatus(old=>old.driving===next.driving&&old.near===next.near&&old.kmh===next.kmh&&old.gear===next.gear&&old.rpm===next.rpm&&old.clutch===next.clutch&&old.steering===next.steering&&old.notice===next.notice&&old.canSummon===next.canSummon&&old.summonStatus===next.summonStatus&&old.first===next.first?old:next),[]);
  const [rideLimit,setRideLimit]=useState(60),[braking,setBraking]=useState(false),[accelerating,setAccelerating]=useState(false),[dismountRequest,setDismountRequest]=useState(0);
  const rideUpdate=useCallback((next:RideStatus)=>setRideStatus(old=>old.riding===next.riding&&old.near===next.near&&old.kmh===next.kmh&&old.notice===next.notice&&old.lives===next.lives&&old.crashed===next.crashed?old:next),[]);

  const [character, setCharacter] = useState<CharacterKind>(savedCharacter);
  const chooseCharacter = (kind: CharacterKind) => {
    if(rideStatus.riding||carStatus.driving)return;
    setCharacter(kind);
    try {
      localStorage.setItem(CHARACTER_STORAGE_KEY, kind);
    } catch {}
  };
  const mobileInput = useRef(createMobileInput());
  useEffect(() => {
    if (!loading) return;
    if (document.pointerLockElement) document.exitPointerLock();
    resetMobileInput(mobileInput.current);
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
      if (loading) return;
      if (e.code === "Escape") {
        setMapOpen(false);
        setSettingsOpen(false);
        setSceneActive(false);
      }
      if (e.code === "KeyN" && !e.repeat) {
        setNight((v) => !v);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [loading]);
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
      } else setZoom(6);
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
            <Player
              speedLimit={rideLimit} braking={braking} accelerating={accelerating} dismountRequest={dismountRequest} onRideStatus={rideUpdate} controlsBlocked={settingsOpen || loading} loading={loading}
              onCarStatus={carUpdate}
              character={character}
              navigationRequest={navigationRequest}
              onNavigationResult={navigationResult}
              mobileInput={mobileInput}
              mapOpen={mapOpen}
              topDown={topDown}
              zoom={zoom}
              teleportTarget={teleportTarget}
              onMode={setFirst}
              onTopDown={setTopDown}
              onZoom={setZoom}
              onLock={handleLock}
              onPosition={position}
              onViewPosition={viewPosition}
            />
          </Canvas>
        </SceneError>
      </div>
      {rideStatus.crashed && (
        <div className="ride-crash-banner" role="alert">
          <span className="ride-crash-icon">💥</span>
          <div className="ride-crash-text">
            <strong>{rideStatus.lives === 0 ? "ဆိုင်ကယ် ပျက်စီးသွားပါပြီ!" : "တိုက်မိပါပြီ!"}</strong>
            <span>
              {rideStatus.lives === 0
                ? "အသက် (Life) ၃ ခုလုံး ကုန်သွားသဖြင့် အစသို့ ပြန်လည်စတင်ပါမည်…"
                : `အသက် ၁ ခု လျော့သွားပါသည် (ကျန်ရှိ: ${rideStatus.lives} ❤️)`}
            </span>
          </div>
        </div>
      )}
      {!mapOpen&&!settingsOpen&&<RideControls status={rideStatus} limit={rideLimit} onLimit={setRideLimit} onBrake={setBraking} onAccelerate={setAccelerating} onDismount={()=>{setBraking(false);setAccelerating(false);setDismountRequest(n=>n+1)}}/>}
      {!mapOpen&&!settingsOpen&&!loading&&<CarControls status={carStatus}/>}
      <MobileControls
        key={navigationRequest?.seq ?? 0}
        input={mobileInput}
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
            aria-label="ဇာတ်ကောင်ကို ဤမြင်ကွင်းအလယ်သို့ ရွှေ့ပြောင်းမည်"
            title="ဇာတ်ကောင်ကို ဤမြင်ကွင်းအလယ်သို့ ရွှေ့ပြောင်းမည်"
            onClick={() => navigate("teleport")}
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

      {!mapOpen && homeGuidance(pos.x, pos.z) && (
        <div className="home-guidance" role="status" aria-live="polite">
          <span className="home-guidance-pill">🏡 အိမ်လမ်းညွှန်</span>
          <span className="home-guidance-text">
            {homeGuidance(pos.x, pos.z)}
          </span>
        </div>
      )}
      <header>
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
            <CharacterPicker value={character} onChange={chooseCharacter} disabled={rideStatus.riding||carStatus.driving}/>
            <RobotLocationPanel
              x={pos.x}
              z={pos.z}
              yaw={robotYaw}
              characterLabel={character === "robot" ? "စက်ရုပ်" : "ကာတွန်း"}
            />
            <div className="guide-item">
              <div className="guide-header">
                <strong>အသုံးပြုနည်း လမ်းညွှန်</strong>
                <div className="badge">
                  <span /> မြေပုံလေ့လာခြင်း · {currentLoc.label}{" "}
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
      {!welcomeDismissed && !mapOpen && !topDown && !rideStatus.riding && !carStatus.driving && (
        <section className="welcome" aria-label="ကြိုဆိုပါသည်">
          <div className="welcome-actions">
            <button
              type="button"
              className="welcome-btn welcome-btn-greet"
              onClick={() => {
                setWelcomeDismissed(true);
                setArrivalToast({
                  id: "greet",
                  label: "မင်္ဂလာပါ",
                  title: "မင်္ဂလာပါ · ကလေးမြို့သို့ ကြိုဆိုပါသည်",
                  subtitle: "Kalaymyo 3D Virtual Prototype",
                });
                window.setTimeout(() => setArrivalToast(null), 3000);
              }}
            >
              မင်္ဂလာပါ
            </button>
            <button
              type="button"
              className="welcome-btn welcome-btn-tour"
              onClick={() => {
                setWelcomeDismissed(true);
                setSettingsOpen(true);
              }}
            >
              လျှောက်လည်ကြမယ်
            </button>
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
          </div>
        </section>
      )}
      {locked && <div className="crosshair">+</div>}
      {/* <aside className={mapOpen?"map map-expanded":"map"} aria-label="Ward plan" onClick={()=>{if(!mapOpen){if(document.pointerLockElement)document.exitPointerLock();setSettingsOpen(false);setMapOpen(true);}}}>
  <button type="button" className="map-toggle" aria-expanded={mapOpen} onClick={e=>{e.stopPropagation();if(document.pointerLockElement)document.exitPointerLock();setSettingsOpen(false);setMapOpen(v=>!v);}}>{mapOpen?`✕ ပိတ်ရန် · WARD PLAN (${currentLoc.label})`:`📍 ${currentLoc.label} ↗`}<b>မြောက် ↖</b></button>
  {mapOpen&&<div className="map-jump-bar" aria-label="နယ်မြေနှင့် ရွာများသို့ တိုက်ရိုက်သွားရန်">
   <span>နယ်မြေ / ရွာ ရွေး၍ 3D Scene သို့ သွားရန် —</span>
   {MAP_DESTINATIONS.map(d=><button key={d.id} type="button" className={currentLoc.id===d.id?"map-jump-btn map-jump-btn-active":"map-jump-btn"} onClick={e=>{e.stopPropagation();handleSelectLocation(d.id);}}>📍 {d.label} ↗</button>)}
  </div>}
  <svg viewBox={`${-ward.size/2-5} ${-ward.size/2-5} ${ward.size+10} ${ward.size+10}`} aria-label="မြို့သာရပ်ကွက် မြေပုံ">
   <rect x={-ward.size/2} y={-ward.size/2} width={ward.size} height={ward.size} fill="#92a36b"/>
   {mapOpen&&!mobileQuality&&<Suspense fallback={null}><KalayWardsPlan labels={mapOpen} onSelectLocation={handleSelectLocation}/>
   <KalayVillagesPlan labels={mapOpen} onSelectLocation={handleSelectLocation}/></Suspense>}
   {(!mapOpen||mobileQuality)&&MAP_DESTINATIONS.map(d=><g key={d.id} onClick={e=>{e.stopPropagation();handleSelectLocation(d.id)}} style={{cursor:'pointer'}}>
    <circle cx={d.x} cy={d.z} r={55} fill="#2563a6"/>
    {mapOpen&&<text x={d.x+70} y={d.z} fontSize={65} fill="#173d35">{d.label}</text>}
   </g>)}
   <circle cx={pos.x} cy={pos.z} r="4" fill="#fff4b3" stroke="#173d35" strokeWidth="2"/>
  </svg>
  <small>{ward.currentArea} · သာစည် · ချင်းဆိုင် · ဇင်းကလင်း · ထိုမာ · သာယာကုန်း · ထောက်ကြန့် · ကြာအင်း</small>
  {mapOpen&&<p className="map-help">မြေပုံပေါ်ရှိ သက်ဆိုင်ရာ ရပ်ကွက် / ရွာကို တိုက်ရိုက်နှိပ်၍ 3D မြင်ကွင်းသို့ သွားနိုင်ပါသည် · Esc ပိတ်ရန်</p>}
 </aside> */}
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
