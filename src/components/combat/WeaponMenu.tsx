import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react';
import {
  SWORD_DAMAGE,
  getActiveMissionWeapon,
  isZombieGunUnlockedState,
  selectMissionWeapon,
  useThreeGhostsMission,
  type ThreeGhostsProgress,
} from '../../game/missions/threeGhostsMission';
import {useZombieForestMission} from '../../game/missions/zombieForestMission';

type WeaponValue = '' | 'ghost-sword' | 'zombie-gun';

interface WeaponOption {
  value: WeaponValue;
  weapon: ThreeGhostsProgress['equippedWeapon'];
  myanmarName: string;
  englishName: string;
  subtitle: string;
  badges: readonly string[];
}

const WEAPON_OPTIONS: readonly WeaponOption[] = [
  {
    value: '',
    weapon: null,
    myanmarName: 'လက်ဗလာ',
    englishName: 'Unarmed',
    subtitle: 'သာမန် စူးစမ်းလေ့လာမုဒ်',
    badges: [],
  },
  {
    value: 'ghost-sword',
    weapon: 'ghost-sword',
    myanmarName: 'သရဲဓား',
    englishName: 'Ghost Sword',
    subtitle: 'ဓားခုတ်တိုက်ခိုက်ရေး · 6-Hit Combo',
    badges: [`${SWORD_DAMAGE} DMG`, 'မစ်ရှင်ဆု'],
  },
  {
    value: 'zombie-gun',
    weapon: 'zombie-gun',
    myanmarName: 'သေနတ်',
    englishName: 'Tactical Gun',
    subtitle: 'အဝေးပစ်သေနတ် · Zombie မစ်ရှင်ဆု',
    badges: [`${SWORD_DAMAGE} DMG`, 'Zombie 13 ဆု'],
  },
];

function SwordTriggerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19.5 4.5 14 10l-4 4-3.5-3.5L12 5l7.5-.5Z" />
      <path d="M8.5 12.5 5 16" />
      <path d="M6.5 10.5 13.5 17.5" />
      <path d="M4.5 19.5 7 17" />
      <circle cx="4.2" cy="19.8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UnarmedIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 11V6a2 2 0 0 0-4 0v4" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.3 16a2 2 0 0 1 2.8-2.8L8 15" />
    </svg>
  );
}

function GhostSwordArtwork() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ghostSwordBladeGrad" x1="20" y1="3" x2="7" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8e7ff" />
          <stop offset="52%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path
        d="M20.4 3.6c-.4 2.8-1.9 5.5-4.3 7.9l-5 5-2.6-2.6 5-5c2.4-2.4 5.1-3.9 6.9-5.3Z"
        fill="url(#ghostSwordBladeGrad)"
        stroke="#f5d0fe"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path d="M17.2 6.8 11.4 12.6" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
      <path
        d="M6.4 11.4 12.6 17.6"
        stroke="#f5c26b"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M8.5 15.5 5 19" stroke="#d9a441" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="4.3" cy="19.7" r="1.6" fill="#c084fc" stroke="#fde68a" strokeWidth="1" />
    </svg>
  );
}

function TacticalGunArtwork() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7h15l2 2v3h-5l-1.5 2H10l-1.5 6H4.5l1.2-6H3V7Z"
        fill="#475569"
        stroke="#cbd5e1"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M18 9h3" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11.2" cy="12.2" r="1.1" fill="#facc15" />
    </svg>
  );
}

export function WeaponMenu() {
  const mission = useThreeGhostsMission();
  const zombieMission = useZombieForestMission();
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const swordUnlocked = mission.completed && mission.swordCollected;
  const gunUnlocked =
    swordUnlocked &&
    (zombieMission.gunUnlocked || isZombieGunUnlockedState());
  const activeWeapon = getActiveMissionWeapon();
  const equippedValue: WeaponValue =
    activeWeapon === 'zombie-gun'
      ? 'zombie-gun'
      : activeWeapon === 'ghost-sword'
        ? 'ghost-sword'
        : '';
  const isSwordEquipped = equippedValue === 'ghost-sword' || equippedValue === 'zombie-gun';

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelWidth = Math.min(284, Math.max(220, vw - 24));
    const estimatedHeight = 252;
    const gap = 10;

    let left = rect.left - panelWidth - gap;
    if (left < 12) {
      left = rect.right + gap;
    }
    if (left + panelWidth > vw - 12) {
      left = Math.max(12, vw - panelWidth - 12);
    }

    let top = rect.top - 8;
    if (top + estimatedHeight > vh - 14) {
      top = Math.max(12, vh - estimatedHeight - 14);
    }
    if (top < 12) top = 12;

    setPopoverStyle({
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(panelWidth)}px`,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handleResize = () => updatePopoverPosition();

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, updatePopoverPosition]);

  if (!swordUnlocked) return null;

  const visibleOptions = WEAPON_OPTIONS.filter(
    opt =>
      (opt.value !== 'ghost-sword' || swordUnlocked) &&
      (opt.value !== 'zombie-gun' || gunUnlocked),
  );
  const activeOption = visibleOptions.find(opt => opt.value === equippedValue) ?? WEAPON_OPTIONS[0];

  const handleToggle = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setOpen(prev => !prev);
  };

  const handleSelect = (weapon: ThreeGhostsProgress['equippedWeapon']) => {
    selectMissionWeapon(weapon);
  };

  return (
    <div
      ref={rootRef}
      className={
        isSwordEquipped
          ? 'weapon-menu weapon-menu-equipped'
          : 'weapon-menu'
      }
    >
      {/* Hidden accessible native select preserved for keyboard/automation compatibility */}
      <select
        className="weapon-menu-native-select"
        aria-label="Weapon"
        tabIndex={-1}
        value={equippedValue}
        onChange={event =>
          selectMissionWeapon(
            event.currentTarget.value === 'zombie-gun'
              ? 'zombie-gun'
              : event.currentTarget.value === 'ghost-sword'
                ? 'ghost-sword'
                : null,
          )
        }
      >
        <option value="">လက်ဗလာ</option>
        <option value="ghost-sword">သရဲဓား</option>
        {gunUnlocked && <option value="zombie-gun">သေနတ်</option>}
      </select>

      <button
        ref={triggerRef}
        type="button"
        className={
          open
            ? 'weapon-menu-trigger weapon-menu-trigger-open'
            : isSwordEquipped
              ? 'weapon-menu-trigger weapon-menu-trigger-armed'
              : 'weapon-menu-trigger'
        }
        aria-label={`လက်နက်ရွေးချယ်ရန် (${activeOption.myanmarName})`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`လက်နက် · ${activeOption.myanmarName}`}
        onClick={handleToggle}
      >
        <SwordTriggerIcon />
        {isSwordEquipped && (
          <span className="weapon-menu-active-dot" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          className="weapon-menu-popover"
          role="dialog"
          aria-label="လက်နက်ရွေးချယ်ရန်"
          style={popoverStyle}
        >
          <div className="weapon-menu-header">
            <div className="weapon-menu-title-group">
              <span className="weapon-menu-crest" aria-hidden="true">
                <SwordTriggerIcon />
              </span>
              <div>
                <strong className="weapon-menu-title">လက်နက်တိုက်</strong>
                <span className="weapon-menu-subtitle">WEAPON ARMORY</span>
              </div>
            </div>

            <div className="weapon-menu-header-right">
              <span
                className={
                  isSwordEquipped
                    ? 'weapon-status-pill is-armed'
                    : 'weapon-status-pill'
                }
              >
                {activeOption.myanmarName}
              </span>
              <button
                type="button"
                className="weapon-menu-close"
                aria-label="လက်နက်မီနူး ပိတ်မည်"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="weapon-card-list" role="radiogroup" aria-label="Weapon options">
            {visibleOptions.map(option => {
              const selected = equippedValue === option.value;
              const isGhostSword = option.value === 'ghost-sword';
              const isZombieGun = option.value === 'zombie-gun';
              return (
                <button
                  key={option.value || 'unarmed'}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={[
                    'weapon-card',
                    isGhostSword || isZombieGun ? 'weapon-card-sword' : 'weapon-card-unarmed',
                    selected ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleSelect(option.weapon)}
                >
                  <span className="weapon-card-icon" aria-hidden="true">
                    {isZombieGun ? (
                      <TacticalGunArtwork />
                    ) : isGhostSword ? (
                      <GhostSwordArtwork />
                    ) : (
                      <UnarmedIcon />
                    )}
                  </span>

                  <span className="weapon-card-body">
                    <span className="weapon-card-top">
                      <strong className="weapon-card-name">{option.myanmarName}</strong>
                      <span className="weapon-card-en">{option.englishName}</span>
                    </span>
                    <span className="weapon-card-desc">{option.subtitle}</span>
                    {option.badges.length > 0 && (
                      <span className="weapon-card-badges">
                        {option.badges.map(badge => (
                          <span key={badge} className="weapon-card-badge">
                            {badge}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>

                  <span className="weapon-card-check" aria-hidden="true">
                    {selected ? (
                      <span className="weapon-card-check-dot">✓</span>
                    ) : (
                      <span className="weapon-card-radio-ring" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="weapon-menu-footer">
            {equippedValue === 'zombie-gun' ? (
              <>
                <span className="weapon-keycap">F</span>
                <span>သေနတ်ပစ်ခတ်ရန် (Shoot Zombie / Ghost)</span>
              </>
            ) : equippedValue === 'ghost-sword' ? (
              <>
                <span className="weapon-keycap">F</span>
                <span>ဓားခုတ် Combo ·</span>
                <span className="weapon-keycap">Shift+F</span>
                <span>Heavy Slash</span>
              </>
            ) : (
              <span>သရဲဓား သို့မဟုတ် သေနတ်ကို ရွေးချယ်၍ တိုက်ခိုက်ရေးမုဒ် ဖွင့်နိုင်ပါသည်</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
