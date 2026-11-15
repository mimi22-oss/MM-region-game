import { useRef, useState, type ReactNode } from 'react';
import { AppearanceSettings } from './AppearanceSettings';
import { CharacterPicker, type CharacterKind } from './CharacterPicker';
import { EnvironmentSettings } from './EnvironmentSettings';
import { IntroSettingsPanel } from './IntroOverlay';
import { RobotLocationPanel } from './RobotLocationPanel';
import {
  isFestivalActive,
  useFestivalConfiguration,
} from '../festivals/FestivalConfiguration';
import {
  setCharacterRendererMode,
  useCharacterRendererMode,
} from '../game/characterRenderer';
import {
  TIME_PERIODS,
  type EnvironmentPreferences,
  type TimeMode,
  type TimePeriod,
} from '../game/environmentTime';
import { useIntroSettings } from '../game/IntroSettings';
import type { DetectedLocation } from '../game/locationDetect';

type TileIconId =
  | 'human'
  | 'robot'
  | 'outfit'
  | 'map'
  | 'waypoints'
  | 'aerial'
  | 'zoomIn'
  | 'zoomOut'
  | 'dayNight'
  | 'moon'
  | 'soundOn'
  | 'soundOff'
  | 'drone'
  | 'lantern'
  | 'introConfig'
  | 'engine3d'
  | 'book'
  | 'help';

type DetailSectionId =
  | 'appearance'
  | 'environment'
  | 'festival'
  | 'intro'
  | 'location'
  | 'controls';

interface MenuTile {
  id: string;
  label: string;
  icon: TileIconId;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  title?: string;
  sectionTarget?: DetailSectionId;
  onClick: () => void;
}

export interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  character: CharacterKind;
  onChooseCharacter: (kind: CharacterKind) => void;
  characterLocked: boolean;
  carLocked: boolean;
  pos: { x: number; z: number };
  robotYaw: number;
  currentLoc: DetectedLocation;
  wardSize: number;
  environment: {
    preferences: EnvironmentPreferences;
    setPreferences: (value: EnvironmentPreferences) => void;
    choose: (mode: TimeMode) => void;
    cycle: () => void;
    now: Date;
    period: TimePeriod;
  };
  topDown: boolean;
  zoom: number;
  onToggleTopDown: () => void;
  onStepZoom: (dir: number) => void;
  onOpenMap: () => void;
  onOpenGuide: () => void;
  onReplayIntro: () => void;
}

const INTRO_MODE_BADGES: Record<string, string> = {
  'every-entry': 'Every',
  'first-entry': '1st',
  'travel-entry': 'Travel',
  off: 'Off',
};

function renderTileSvgContent(icon: TileIconId): ReactNode {
  switch (icon) {
    case 'human':
      return (
        <>
          <circle cx="12" cy="7" r="3.4" />
          <path d="M5.5 20c.8-4 3.4-6 6.5-6s5.7 2 6.5 6" />
        </>
      );
    case 'robot':
      return (
        <>
          <path d="M12 3v3" />
          <circle cx="12" cy="2.5" r="1" fill="currentColor" stroke="none" />
          <rect x="5.5" y="6.5" width="13" height="10" rx="3" />
          <circle cx="9.5" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
          <path d="M9 20h6M3.5 11.5h2M18.5 11.5h2" />
        </>
      );
    case 'outfit':
      return (
        <path d="M8.5 4.5 12 6.5l3.5-2 4 3.2-2.2 3.2-1.8-1v9.6h-7V9.9l-1.8 1-2.2-3.2Z" />
      );
    case 'map':
      return (
        <>
          <path d="M3.5 6.2 9 4l6 2.2 5.5-2v13.6L15 20l-6-2.2-5.5 2V6.2Z" />
          <path d="M9 4v13.8M15 6.2V20" />
        </>
      );
    case 'waypoints':
      return (
        <>
          <circle cx="6.5" cy="16.5" r="2.2" />
          <circle cx="12" cy="6.5" r="2.2" />
          <circle cx="17.5" cy="15.5" r="2.2" />
          <path d="M7.7 14.6 10.8 8.4M13.3 8.3l3.1 5.3" />
        </>
      );
    case 'aerial':
      return (
        <>
          <path d="M4 8.5a2 2 0 0 1 2-2h2.2l1.4-2h4.8l1.4 2H18a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z" />
          <circle cx="12" cy="12.8" r="3.2" />
        </>
      );
    case 'zoomIn':
      return (
        <>
          <circle cx="10.8" cy="10.8" r="6" />
          <path d="M15.4 15.4 20 20M10.8 8.2v5.2M8.2 10.8h5.2" />
        </>
      );
    case 'zoomOut':
      return (
        <>
          <circle cx="10.8" cy="10.8" r="6" />
          <path d="M15.4 15.4 20 20M8.2 10.8h5.2" />
        </>
      );
    case 'dayNight':
      return (
        <>
          <path d="M9.5 6.2V4M4.2 11.5H2M5.7 7.7 4.2 6.2M13.3 7.7l1.5-1.5" />
          <path d="M6.2 13.5a3.6 3.6 0 0 1 6.7-1.6" />
          <path d="M17.5 11.8a3.8 3.8 0 0 1-4.8 4.8 3.8 3.8 0 1 0 4.8-4.8Z" />
        </>
      );
    case 'moon':
      return (
        <path
          d="M16.8 14.9A6.6 6.6 0 0 1 9.1 7.2a6.6 6.6 0 1 0 7.7 7.7Z"
          fill="currentColor"
          stroke="none"
        />
      );
    case 'soundOn':
      return (
        <>
          <path d="M5 10v4h3.5l4.5 3.6V6.4L8.5 10H5Z" fill="currentColor" />
          <path d="M16.2 9.2a4 4 0 0 1 0 5.6M18.6 7a7 7 0 0 1 0 10" />
        </>
      );
    case 'soundOff':
      return (
        <>
          <path d="M4.5 10v4H8l4.5 3.6V6.4L8 10H4.5Z" />
          <path d="m16 9.5 4 5M20 9.5l-4 5" />
        </>
      );
    case 'drone':
      return (
        <>
          <rect x="9.5" y="10" width="5" height="4" rx="1.4" />
          <path d="M6 7.5 9.5 10.5M18 7.5l-3.5 3M6 16.5l3.5-3M18 16.5l-3.5-3" />
          <circle cx="5.2" cy="7" r="2.2" />
          <circle cx="18.8" cy="7" r="2.2" />
          <circle cx="5.2" cy="17" r="2.2" />
          <circle cx="18.8" cy="17" r="2.2" />
        </>
      );
    case 'lantern':
      return (
        <>
          <path d="M12 3v2M9 5.5h6l1.5 3.5-1.5 6H9L7.5 9 9 5.5Z" />
          <path d="M9.5 15h5M12 15v3.5M10 19.5h4" />
        </>
      );
    case 'introConfig':
      return (
        <>
          <rect x="4" y="5.5" width="16" height="13" rx="2.5" />
          <path d="m10.2 9.5 5 2.5-5 2.5V9.5Z" fill="currentColor" stroke="none" />
        </>
      );
    case 'engine3d':
      return (
        <>
          <path d="m12 3.5 7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7L12 3.5Z" />
          <path d="m4.5 7.7 7.5 4.3 7.5-4.3M12 12v8.5" />
        </>
      );
    case 'book':
      return (
        <>
          <path d="M4 5.5h5.8a2.2 2.2 0 0 1 2.2 2.2v11.8a2 2 0 0 0-2-1.5H4V5.5ZM20 5.5h-5.8A2.2 2.2 0 0 0 12 7.7v11.8a2 2 0 0 1 2-1.5H20V5.5Z" />
        </>
      );
    case 'help':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.4a2.5 2.5 0 0 1 4.7 1.1c0 1.6-2.3 2.1-2.3 3.5" />
          <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
  }
}

function SettingsTileIcon({ icon }: { icon: TileIconId }) {
  return (
    <svg
      className="settings-tile-svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {renderTileSvgContent(icon)}
    </svg>
  );
}

/**
 * Full-panel icon-grid settings modal with smooth scrollable detailed sections.
 * Preserves existing child controls (appearance, environment, festival, intro, location, guide).
 */
export function SettingsMenu({
  open,
  onClose,
  character,
  onChooseCharacter,
  characterLocked,
  carLocked,
  pos,
  robotYaw,
  currentLoc,
  wardSize,
  environment,
  topDown,
  zoom,
  onToggleTopDown,
  onStepZoom,
  onOpenMap,
  onOpenGuide,
  onReplayIntro,
}: SettingsMenuProps) {
  const [focusedSection, setFocusedSection] = useState<DetailSectionId | null>(null);
  const festivalConfig = useFestivalConfiguration();
  const introSettings = useIntroSettings();
  const rendererMode = useCharacterRendererMode();

  const bodyRef = useRef<HTMLDivElement>(null);
  const appearanceRef = useRef<HTMLDivElement>(null);
  const environmentRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const periodMeta = TIME_PERIODS.find((p) => p.id === environment.period);
  const festivalActive = isFestivalActive(festivalConfig, environment.now);
  const isNight = environment.period === 'night' || environment.period === 'evening';

  const scrollToSection = (section: DetailSectionId) => {
    setFocusedSection(section);
    const refMap: Record<DetailSectionId, HTMLElement | null> = {
      appearance: appearanceRef.current,
      environment: environmentRef.current,
      festival:
        (environmentRef.current?.querySelector('.environment-festival-section') as HTMLElement | null) ??
        environmentRef.current,
      intro: introRef.current,
      location: locationRef.current,
      controls: controlsRef.current,
    };
    refMap[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const tiles: MenuTile[] = [
    {
      id: 'character-cartoon',
      label: 'ကာတွန်းလူ',
      icon: 'human',
      active: character === 'cartoon',
      disabled: characterLocked,
      badge: character === 'cartoon' ? 'သုံးနေ' : undefined,
      onClick: () => onChooseCharacter('cartoon'),
    },
    {
      id: 'character-robot',
      label: 'စက်ရုပ်',
      icon: 'robot',
      active: character === 'robot',
      disabled: characterLocked,
      badge: character === 'robot' ? 'သုံးနေ' : undefined,
      onClick: () => onChooseCharacter('robot'),
    },
    {
      id: 'open-map',
      label: 'မြေပုံ',
      icon: 'map',
      onClick: onOpenMap,
    },
    {
      id: 'gps-location',
      label: 'တည်နေရာ · GPS',
      icon: 'waypoints',
      active: focusedSection === 'location',
      sectionTarget: 'location',
      onClick: () => scrollToSection('location'),
    },
    {
      id: 'appearance',
      label: 'အဝတ်နှင့် ပုံစံ',
      icon: 'outfit',
      active: focusedSection === 'appearance',
      sectionTarget: 'appearance',
      onClick: () => scrollToSection('appearance'),
    },
    {
      id: 'top-down',
      label: 'ကောင်းကင်မြင်ကွင်း',
      icon: 'aerial',
      active: topDown,
      badge: topDown ? 'ON' : undefined,
      onClick: onToggleTopDown,
    },
    {
      id: 'zoom-in',
      label: 'Zoom ချဲ့မည်',
      icon: 'zoomIn',
      badge: `${Math.round(zoom)}m`,
      onClick: () => onStepZoom(-1),
    },
    {
      id: 'zoom-out',
      label: 'Zoom ချုံ့မည်',
      icon: 'zoomOut',
      onClick: () => onStepZoom(1),
    },
    {
      id: 'time-mode',
      label: 'နေ့ရော ညရော',
      icon: 'dayNight',
      active: environment.preferences.mode === 'auto' || focusedSection === 'environment',
      badge: environment.preferences.mode === 'auto' ? 'Auto' : periodMeta?.label,
      onClick: () => scrollToSection('environment'),
    },
    {
      id: 'night-toggle',
      label: isNight ? 'နေ့ခင်း ပြောင်းမည်' : 'ညဘက် ပြောင်းမည်',
      icon: 'moon',
      active: isNight,
      onClick: () => environment.choose(isNight ? 'day' : 'night'),
    },
    {
      id: 'sound-toggle',
      label: environment.preferences.sound ? 'အသံ ဖွင့်ထား' : 'အသံ ပိတ်ထား',
      icon: environment.preferences.sound ? 'soundOn' : 'soundOff',
      active: environment.preferences.sound,
      badge: environment.preferences.sound
        ? `${Math.round(environment.preferences.volume * 100)}%`
        : 'OFF',
      onClick: () =>
        environment.setPreferences({
          ...environment.preferences,
          sound: !environment.preferences.sound,
        }),
    },
    {
      id: 'festival',
      label: 'တန်ဆောင်တိုင် ပွဲတော်',
      icon: 'lantern',
      active: festivalActive || focusedSection === 'festival',
      badge: festivalActive ? 'Active' : undefined,
      onClick: () => scrollToSection('festival'),
    },
    {
      id: 'intro-replay',
      label: 'Drone Intro ဖွင့်',
      icon: 'drone',
      onClick: onReplayIntro,
    },
    {
      id: 'intro-settings',
      label: 'မိတ်ဆက် ဆက်တင်',
      icon: 'introConfig',
      active: focusedSection === 'intro',
      badge: INTRO_MODE_BADGES[introSettings.mode] ?? introSettings.mode,
      onClick: () => scrollToSection('intro'),
    },
    {
      id: 'char-engine',
      label: '3D Engine',
      icon: 'engine3d',
      active: rendererMode === 'code',
      badge: rendererMode === 'code' ? 'Code' : 'GLB',
      onClick: () => setCharacterRendererMode(rendererMode === 'glb' ? 'code' : 'glb'),
    },
    {
      id: 'controls-list',
      label: 'ခလုတ် မှတ်တမ်း',
      icon: 'book',
      active: focusedSection === 'controls',
      onClick: () => scrollToSection('controls'),
    },
    {
      id: 'guide-dialog',
      label: 'ကစားနည်း · လမ်းညွှန်',
      icon: 'help',
      onClick: onOpenGuide,
    },
  ];

  return (
    <div
      className="settings-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="settings-menu"
        role="dialog"
        aria-modal="true"
        aria-label="အသုံးပြုနည်း လမ်းညွှန်နှင့် မီနူး"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="settings-menu-trim" aria-hidden="true" />
        <div className="settings-menu-header">
          <div className="settings-menu-title-group">
            <h2>မီနူး</h2>
            <span className="settings-location-pill">
              <span className="settings-location-dot" />
              {currentLoc.label} · {wardSize} × {wardSize} မီတာ
            </span>
          </div>
          <div className="settings-menu-header-actions">
            <button
              type="button"
              className={`settings-header-pill${environment.preferences.sound ? ' is-selected' : ''}`}
              onClick={() =>
                environment.setPreferences({
                  ...environment.preferences,
                  sound: !environment.preferences.sound,
                })
              }
            >
              {environment.preferences.sound ? '🔊 အသံဖွင့်' : '🔇 အသံပိတ်'}
            </button>
            <button
              type="button"
              className={`settings-header-pill${topDown ? ' is-selected' : ''}`}
              onClick={onToggleTopDown}
            >
              {topDown ? '✓ ကောင်းကင်မြင်ကွင်း' : `${periodMeta?.icon ?? '☀️'} ${periodMeta?.label ?? ''}`}
            </button>
            <button
              type="button"
              className="settings-menu-close"
              aria-label="မီနူး ပိတ်မည်"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="settings-menu-body" ref={bodyRef}>
          <div className="settings-icon-grid" role="group" aria-label="အမြန် မီနူးခလုတ်များ">
            {tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                disabled={tile.disabled}
                className={`settings-tile${tile.active ? ' is-active' : ''}`}
                aria-pressed={tile.active}
                title={tile.title ?? tile.label}
                onClick={tile.onClick}
              >
                {tile.badge && <span className="settings-tile-badge">{tile.badge}</span>}
                <span className="settings-tile-icon">
                  <SettingsTileIcon icon={tile.icon} />
                </span>
                <span className="settings-tile-label">{tile.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-details-divider">
            <span>အသေးစိတ် ဆက်တင်များ (အောက်သို့ Scroll ဆွဲကြည့်နိုင်ပါသည်)</span>
          </div>

          <div className="settings-details-grid">
            <div
              ref={appearanceRef}
              className={`settings-detail-card${focusedSection === 'appearance' ? ' is-focused' : ''}`}
            >
              <CharacterPicker
                value={character}
                onChange={onChooseCharacter}
                disabled={characterLocked}
              />
              <AppearanceSettings
                kind={character}
                onKindChange={onChooseCharacter}
                characterLocked={characterLocked}
                carLocked={carLocked}
              />
            </div>

            <div
              ref={environmentRef}
              className={`settings-detail-card${
                focusedSection === 'environment' || focusedSection === 'festival' ? ' is-focused' : ''
              }`}
            >
              <EnvironmentSettings
                value={environment.preferences}
                onChange={environment.setPreferences}
                onChoose={environment.choose}
                now={environment.now}
                period={environment.period}
              />
            </div>

            <div
              ref={introRef}
              className={`settings-detail-card${focusedSection === 'intro' ? ' is-focused' : ''}`}
            >
              <IntroSettingsPanel onReplay={onReplayIntro} />
            </div>

            <div
              ref={locationRef}
              className={`settings-detail-card${focusedSection === 'location' ? ' is-focused' : ''}`}
            >
              <RobotLocationPanel
                x={pos.x}
                z={pos.z}
                yaw={robotYaw}
                characterLabel={character === 'robot' ? 'စက်ရုပ်' : 'ကာတွန်း'}
              />
              <div className="cam-controls" aria-label="3D ကင်မရာ ထိန်းချုပ်မှုများ">
                <button type="button" className="cam-btn" onClick={onOpenGuide}>
                  📖 အသုံးပြုနည်း လမ်းညွှန် ↗
                </button>
                <button type="button" className="cam-btn" onClick={onOpenMap}>
                  🗺 ရပ်ကွက်မြေပုံ ↗
                </button>
                <button
                  type="button"
                  className={topDown ? 'cam-btn cam-btn-active' : 'cam-btn'}
                  aria-pressed={topDown}
                  onClick={onToggleTopDown}
                >
                  {topDown ? '✓ ကောင်းကင်တည့်တည့်' : 'ကောင်းကင်တည့်တည့် (T)'}
                </button>
                <div className="cam-zoom-row">
                  <button
                    type="button"
                    className="cam-btn"
                    onClick={() => onStepZoom(-1)}
                    title="Zoom ချဲ့မည်"
                  >
                    ＋ Zoom ချဲ့မည်
                  </button>
                  <button
                    type="button"
                    className="cam-btn"
                    onClick={() => onStepZoom(1)}
                    title="Zoom ချုံ့မည်"
                  >
                    － Zoom ချုံ့မည်
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={controlsRef}
              className={`settings-detail-card settings-detail-card-wide${
                focusedSection === 'controls' ? ' is-focused' : ''
              }`}
            >
              <div className="guide-header">
                <strong>⌨ ကစားနည်းနှင့် ခလုတ်လမ်းညွှန်</strong>
                <div className="badge">
                  <span /> မြေပုံ · {currentLoc.label}{' '}
                  <b>
                    {wardSize} × {wardSize} မီတာ
                  </b>
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
          </div>
        </div>
      </section>
    </div>
  );
}
