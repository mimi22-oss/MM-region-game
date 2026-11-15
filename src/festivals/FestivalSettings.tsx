import {
  ALL_FESTIVAL_ZONES,
  TAZAUNGDAING_START_DATE,
  TAZAUNGDAING_END_DATE,
  isFestivalActive,
  resetFestivalConfiguration,
  setFestivalEnabled,
  updateFestivalConfiguration,
  useFestivalConfiguration,
} from './FestivalConfiguration.ts';
import { listFestivalPlugins } from './FestivalRegistry.ts';
import {
  setQualityPresetMode,
  useQualityPreset,
  useQualityPresetMode,
  type QualityPresetMode,
} from '../game/qualityPreset.ts';

export function FestivalSettings({ now = new Date() }: { now?: Date }) {
  const config = useFestivalConfiguration();
  const qualityMode = useQualityPresetMode();
  const activeQuality = useQualityPreset();
  const plugins = listFestivalPlugins();
  const activePlugin =
    plugins.find((p) => p.id === config.activeFestivalId) ?? plugins[0];
  const active = isFestivalActive(
    config,
    now,
    activePlugin?.startDate ?? TAZAUNGDAING_START_DATE,
    activePlugin?.endDate ?? TAZAUNGDAING_END_DATE,
  );

  return (
    <div
      className="environment-festival-section"
      aria-label="တန်ဆောင်တိုင် ပွဲတော် ဆက်တင်"
      style={{
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <strong style={{ fontSize: '13px' }}>
          🏮 {activePlugin?.myanmarName ?? 'တန်ဆောင်တိုင် မီးထွန်းပွဲတော်'}
        </strong>
        <span
          className="time-status-pill"
          style={{
            fontSize: '11px',
            background: active
              ? 'rgba(255, 167, 52, 0.22)'
              : 'rgba(255, 255, 255, 0.08)',
            color: active ? '#ffd07b' : 'rgba(255,255,255,0.7)',
          }}
        >
          {active ? 'Active · ပွဲတော်ဖွင့်ထားသည်' : 'Disabled · ပိတ်ထားသည်'}
        </span>
      </div>

      <small
        style={{
          display: 'block',
          color: 'rgba(255,255,255,0.68)',
          fontSize: '11px',
          marginBottom: '8px',
        }}
      >
        ပွဲတော်ကာလ: {TAZAUNGDAING_START_DATE} မှ {TAZAUNGDAING_END_DATE} အထိ
      </small>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <button
          type="button"
          className={`time-btn${config.scheduleMode === 'auto' ? ' time-btn-active' : ''}`}
          aria-pressed={config.scheduleMode === 'auto'}
          onClick={() => updateFestivalConfiguration({ scheduleMode: 'auto' })}
          style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}
        >
          📅 Auto (15–24 Nov 2026)
        </button>
        <button
          type="button"
          className={`time-btn${config.scheduleMode === 'manual' ? ' time-btn-active' : ''}`}
          aria-pressed={config.scheduleMode === 'manual'}
          onClick={() =>
            updateFestivalConfiguration({
              scheduleMode: 'manual',
              enabled: active,
            })
          }
          style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}
        >
          🔧 Manual Admin
        </button>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: '12.5px',
          fontWeight: 500,
          marginBottom: '8px',
        }}
      >
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setFestivalEnabled(e.target.checked)}
        />
        <span>မီးပုံးပျံပွဲတော်နှင့် မီးထွန်းအလှဆင်မှု ဖွင့်မည်</span>
      </label>

      {active && (
        <div
          style={{
            display: 'grid',
            gap: '8px',
            padding: '8px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.22)',
            fontSize: '12px',
          }}
        >
          <label style={{ display: 'grid', gap: '4px' }}>
            <span>📍 ပွဲတော်နယ်မြေ (Festival Zone)</span>
            <select
              aria-label="ပွဲတော်နယ်မြေ ရွေးချယ်ရန်"
              value={config.activeZoneId}
              onChange={(e) =>
                updateFestivalConfiguration({ activeZoneId: e.target.value })
              }
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                background: 'rgba(20, 32, 40, 0.92)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
                fontSize: '12px',
              }}
            >
              <option value="all">
                မြို့နယ်နှင့် ကျေးရွာအားလုံး (All 10 Zones)
              </option>
              {ALL_FESTIVAL_ZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.myanmarName} ({zone.name})
                </option>
              ))}
              <option value="custom">သတ်မှတ်နယ်မြေ (Custom Zone)</option>
            </select>
          </label>

          {config.activeZoneId === 'custom' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '6px',
              }}
            >
              <label style={{ display: 'grid', gap: '2px', fontSize: '11px' }}>
                <span>Center X</span>
                <input
                  type="number"
                  value={Math.round(config.customZone.x)}
                  onChange={(e) =>
                    updateFestivalConfiguration({
                      customZone: {
                        ...config.customZone,
                        x: Number(e.target.value) || 0,
                      },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'rgba(20,32,40,0.9)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: '2px', fontSize: '11px' }}>
                <span>Center Z</span>
                <input
                  type="number"
                  value={Math.round(config.customZone.z)}
                  onChange={(e) =>
                    updateFestivalConfiguration({
                      customZone: {
                        ...config.customZone,
                        z: Number(e.target.value) || 0,
                      },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'rgba(20,32,40,0.9)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: '2px', fontSize: '11px' }}>
                <span>Radius (m)</span>
                <input
                  type="number"
                  min={40}
                  max={800}
                  value={Math.round(config.customZone.spreadRadius)}
                  onChange={(e) =>
                    updateFestivalConfiguration({
                      customZone: {
                        ...config.customZone,
                        spreadRadius: Number(e.target.value) || 240,
                      },
                    })
                  }
                  style={{
                    width: '100%',
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'rgba(20,32,40,0.9)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                />
              </label>
            </div>
          )}

          <label className="environment-volume" style={{ fontSize: '11.5px' }}>
            <span>ဇုန်တစ်ခုလျှင် မီးပုံးပျံအရေအတွက်</span>
            <output>{config.balloonsPerZone}</output>
            <input
              aria-label="ဇုန်တစ်ခုလျှင် မီးပုံးပျံအရေအတွက်"
              type="range"
              min={16}
              max={400}
              step={8}
              value={config.balloonsPerZone}
              onChange={(e) =>
                updateFestivalConfiguration({
                  balloonsPerZone: Number(e.target.value),
                })
              }
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '11.5px',
            }}
          >
            <input
              type="checkbox"
              checked={config.decorationsEnabled}
              onChange={(e) =>
                updateFestivalConfiguration({
                  decorationsEnabled: e.target.checked,
                })
              }
            />
            <span>မြေပြင် ပွဲတော်မီးပုံးတိုင်များနှင့် အလှဆင်မီးပုံးပျံများ ပြမည်</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '11.5px',
            }}
          >
            <input
              type="checkbox"
              checked={config.allowDaytimePreview}
              onChange={(e) =>
                updateFestivalConfiguration({
                  allowDaytimePreview: e.target.checked,
                })
              }
            />
            <span>နေ့ခင်းဘက်တွင်ပါ မီးပုံးပျံလွှင့်တင်ပွဲ စမ်းသပ်ကြည့်မည်</span>
          </label>

          <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px' }}>
            <span>Quality Preset ({activeQuality.label})</span>
            <select
              aria-label="Quality Preset"
              value={qualityMode}
              onChange={(e) => setQualityPresetMode(e.target.value as QualityPresetMode)}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: '6px',
                background: 'rgba(20,32,40,0.9)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
                fontSize: '12px',
              }}
            >
              <option value="auto">Auto (Device)</option>
              <option value="mobile">Mobile</option>
              <option value="low">Low</option>
              <option value="medium">Balanced (Desktop)</option>
              <option value="high">High (Desktop)</option>
            </select>
          </label>

          <button
            type="button"
            className="time-btn"
            onClick={() => resetFestivalConfiguration(now)}
            style={{ fontSize: '11px', padding: '4px 8px', marginTop: '2px' }}
          >
            ↺ ပွဲတော် မူလဆက်တင်သို့ ပြန်ထားမည်
          </button>
        </div>
      )}
    </div>
  );
}

export default FestivalSettings;
