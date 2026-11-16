import { Suspense, lazy, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  canOpenMapTool,
  createMapAccessContext,
  getActiveAuthoritySession,
  getStoredMapRole,
  resolveCurrentMapAccessContext,
  setStoredMapRole,
  subscribeAuthoritySession,
  type MapPortalTool,
  type MapRole,
} from '../game/mapPermissions';
import { PLAYER_OWNER } from '../game/homeAccess';
import './MapPortalPage.css';

const WardVillageEditor = lazy(() => import('./WardVillageEditor'));
const MapSelectionTool = lazy(() => import('./MapSelectionTool'));

function readInitialTool(): MapPortalTool | null {
  try {
    const tool = new URLSearchParams(window.location.search).get('tool');
    if (tool === 'editor' || tool === 'geojson') return tool;
  } catch {
    // Ignore URL parse errors
  }
  return null;
}

export default function MapPortalPage() {
  const [role, setRole] = useState<MapRole>(() => getStoredMapRole());
  const [activeTool, setActiveTool] = useState<MapPortalTool | null>(() => readInitialTool());
  const authority = useSyncExternalStore(
    subscribeAuthoritySession,
    getActiveAuthoritySession,
    getActiveAuthoritySession,
  );

  const accessContext = useMemo(
    () => resolveCurrentMapAccessContext(createMapAccessContext(role, PLAYER_OWNER)),
    [role, authority.mode, authority.serverRole],
  );

  const isAdmin = accessContext.role === 'admin';
  const canGeoJson = canOpenMapTool('geojson', accessContext);

  const handleSelectRole = (nextRole: MapRole) => {
    setRole(nextRole);
    setStoredMapRole(nextRole);
  };

  const selectTool = (tool: MapPortalTool | null) => {
    setActiveTool(tool);
    try {
      const url = new URL(window.location.href);
      if (tool) {
        url.searchParams.set('tool', tool);
      } else {
        url.searchParams.delete('tool');
      }
      window.history.replaceState(null, '', url.toString());
    } catch {
      // Ignore history API errors
    }
  };

  useEffect(() => {
    const prevTitle = document.title;
    document.title =
      activeTool === 'editor'
        ? '2D Map & 3D Asset Editor | MM Region Game'
        : activeTool === 'geojson'
          ? 'နယ်မြေဝိုက်ရွေး · GeoJSON | MM Region Game'
          : 'Map Studio (/map) | MM Region Game';
    return () => {
      document.title = prevTitle;
    };
  }, [activeTool]);

  return (
    <div className="map-portal-root">
      <header className="map-portal-topbar">
        <div className="map-portal-brand">
          <span className="map-portal-brand-badge" aria-hidden="true">🗺️</span>
          <div>
            <h1 className="map-portal-brand-title">Myanmar Town · Map & Studio (/map)</h1>
            <p className="map-portal-brand-sub">
              {isAdmin
                ? 'Admin Mode — 2D/3D မြေပုံနှင့် GeoJSON အားလုံး ပြုပြင်နိုင်သည်'
                : 'User Mode — မိမိအိမ်ကိုသာ ပြုပြင်နိုင်ပြီး ကျန်အရာများကို ကြည့်ရှုရန်သာ'}
            </p>
          </div>
        </div>

        <nav className="map-portal-nav" aria-label="Map Studio Navigation">
          {activeTool !== null && (
            <button
              type="button"
              className="map-portal-nav-btn"
              onClick={() => selectTool(null)}
            >
              ← Tool ရွေးရန်
            </button>
          )}
          <button
            type="button"
            className={`map-portal-nav-btn ${activeTool === 'editor' ? 'active' : ''}`}
            onClick={() => selectTool('editor')}
          >
            🗺️ 2D Map &amp; 3D Editor
          </button>
          <button
            type="button"
            className={`map-portal-nav-btn ${activeTool === 'geojson' ? 'active' : ''}`}
            disabled={!canGeoJson}
            title={
              canGeoJson
                ? 'နယ်မြေဝိုက်ရွေး · GeoJSON ထုတ်ယူရန်'
                : 'Admin သာ ဝင်ရောက်နိုင်ပါသည်'
            }
            onClick={() => canGeoJson && selectTool('geojson')}
          >
            📐 နယ်မြေဝိုက်ရွေး · GeoJSON {!canGeoJson && '🔒'}
          </button>

          <div className="map-portal-role-box" role="group" aria-label="Access Role">
            <span className="map-portal-role-label">Role:</span>
            <button
              type="button"
              className={`map-portal-role-btn ${isAdmin ? 'active-admin' : ''}`}
              aria-pressed={isAdmin}
              onClick={() => handleSelectRole('admin')}
            >
              🛡️ Admin
            </button>
            <button
              type="button"
              className={`map-portal-role-btn ${!isAdmin ? 'active-user' : ''}`}
              aria-pressed={!isAdmin}
              onClick={() => handleSelectRole('user')}
            >
              👤 User (Own Home)
            </button>
          </div>

          <a href="/" className="map-portal-home-link">
            🏡 3D ဂိမ်းသို့
          </a>
        </nav>
      </header>

      {activeTool === null && (
        <main className="map-portal-hub">
          <div className="map-portal-hub-inner">
            <div className="map-portal-intro">
              <h2>မြေပုံနှင့် ပြုပြင်ရေး စာမျက်နှာ (/map)</h2>
              <p>
                အောက်ပါ Tool များထဲမှ လိုအပ်သည့်တစ်ခုကို ရွေးချယ်ဖွင့်လှစ်နိုင်ပါသည်။
                အသုံးပြုသူ (User) သည် မိမိပိုင်အိမ်ကိုသာ ပြုပြင်နိုင်ပြီး
                လမ်း၊ ရပ်ကွက်နှင့် အခြားအဆောက်အဦများကို Admin ကသာ ပြုပြင်နိုင်ပါသည်။
              </p>
            </div>

            <div className={`map-portal-role-banner ${isAdmin ? 'is-admin' : ''}`}>
              <div>
                <strong>
                  {isAdmin
                    ? '🛡️ လက်ရှိအဆင့်: Admin Mode'
                    : '👤 လက်ရှိအဆင့်: User Mode (မိမိအိမ်သာ ပြုပြင်ခွင့်)'}
                </strong>
                <div>
                  {isAdmin
                    ? 'မြေပုံတစ်ခုလုံး၊ လမ်းများ၊ အဆောက်အဦများနှင့် GeoJSON Tools အားလုံးကို ပြုပြင်နိုင်ပါသည်။'
                    : '2D Map Editor ထဲတွင် မိမိအိမ် (Farmhouse) ကိုသာ ရွှေ့ပြောင်း/အရောင်ပြောင်း/Save လုပ်နိုင်ပါမည်။ ကျန်အရာများ Read-Only ဖြစ်ပါသည်။'}
                </div>
              </div>
              <span>အပေါ်ဘားမှ Role ပြောင်း၍ စမ်းသပ်နိုင်ပါသည်</span>
            </div>

            <section className="map-portal-cards" aria-label="ရွေးချယ်နိုင်သော Tool များ">
              <article className="map-portal-card">
                <div>
                  <div className="map-portal-card-head">
                    <span className="map-portal-card-icon" aria-hidden="true">🗺️</span>
                    <span
                      className={`map-portal-pill ${
                        isAdmin ? 'map-portal-pill-admin' : 'map-portal-pill-user'
                      }`}
                    >
                      {isAdmin ? 'Admin: Full Edit' : 'User: Own Home Only'}
                    </span>
                  </div>
                  <h3>2D Map &amp; 3D Asset Editor</h3>
                  <p>
                    ရပ်ကွက်၊ ကျေးရွာမြေပုံများနှင့် 3D အဆောက်အဦများကို 2D မြေပုံပေါ်တွင်
                    စစ်ဆေးပြုပြင်နိုင်သော စနစ်ဖြစ်ပါသည်။
                  </p>
                  <ul className="map-portal-card-list">
                    {isAdmin ? (
                      <>
                        <li>ရပ်ကွက်/ရွာ အားလုံး၏ အိမ်၊ လမ်း၊ သစ်ပင်များကို ပြင်ဆင်နိုင်သည်</li>
                        <li>3D Asset အသစ်ထည့်ခြင်း၊ ဖျက်ခြင်း၊ Import/Export ပြုလုပ်နိုင်သည်</li>
                      </>
                    ) : (
                      <>
                        <li>မြို့/ရွာ မြေပုံတစ်ခုလုံးကို ကြည့်ရှုစစ်ဆေးနိုင်သည် (Read-Only)</li>
                        <li>မိမိပိုင်အိမ် (Own Home) ကိုသာ နေရာ/ထောင့်/အရောင် ပြင်ဆင်နိုင်သည်</li>
                      </>
                    )}
                  </ul>
                </div>
                <button
                  type="button"
                  className="map-portal-card-cta"
                  onClick={() => selectTool('editor')}
                >
                  🗺️ 2D Map &amp; 3D Asset Editor ဖွင့်ရန် →
                </button>
              </article>

              <article className={`map-portal-card ${!canGeoJson ? 'locked' : ''}`}>
                <div>
                  <div className="map-portal-card-head">
                    <span className="map-portal-card-icon" aria-hidden="true">📐</span>
                    <span className="map-portal-pill map-portal-pill-admin">
                      Admin Only {!canGeoJson && '🔒'}
                    </span>
                  </div>
                  <h3>နယ်မြေဝိုက်ရွေး · GeoJSON ထုတ်ယူရန်</h3>
                  <p>
                    အိမ်၊ အဆောက်အဦ၊ ဌာန၊ ရေလမ်း၊ သစ်ပင် ဖြည့်လိုသည့်နေရာကို မြေပုံပေါ်မှာ
                    ဝိုက်ရွေးပြီး GeoJSON နှင့် AI Prompt ထုတ်ယူရန် ဖြစ်ပါသည်။
                  </p>
                  <ul className="map-portal-card-list">
                    <li>Polygon နှင့် LineString (မြစ်/ချောင်း/မြောင်း) ဆွဲထုတ်နိုင်သည်</li>
                    <li>Admin များအတွက်သာ ဖွင့်ပေးထားသော Map Data Tool ဖြစ်ပါသည်</li>
                  </ul>
                </div>
                <button
                  type="button"
                  className="map-portal-card-cta"
                  disabled={!canGeoJson}
                  onClick={() => selectTool('geojson')}
                >
                  {canGeoJson
                    ? '📐 နယ်မြေဝိုက်ရွေး · GeoJSON ဖွင့်ရန် →'
                    : '🔒 Admin သာ ဖွင့်နိုင်ပါသည်'}
                </button>
              </article>
            </section>
          </div>
        </main>
      )}

      {activeTool === 'editor' && (
        <div className="map-portal-workspace">
          <Suspense fallback={<div className="map-portal-loading" role="status">2D Map Editor ဖွင့်နေသည်…</div>}>
            <WardVillageEditor
              initialCenter={{ x: 0, z: 0 }}
              accessContext={accessContext}
            />
          </Suspense>
        </div>
      )}

      {activeTool === 'geojson' && (
        canGeoJson ? (
          <div className="map-portal-workspace">
            <Suspense fallback={<div className="map-portal-loading" role="status">မြေပုံဝိုက်ရွေးစနစ် ဖွင့်နေသည်…</div>}>
              <MapSelectionTool
                embedded
                focus={{ x: 0, z: 0 }}
                onClose={() => selectTool(null)}
              />
            </Suspense>
          </div>
        ) : (
          <div className="map-portal-guard">
            <div className="map-portal-guard-box">
              <h2>🔒 Admin Access Required</h2>
              <p>
                နယ်မြေဝိုက်ရွေး · GeoJSON ထုတ်ယူသည့် Tool ကို Admin ကသာ အသုံးပြုနိုင်ပါသည်။
                User အနေဖြင့် 2D Map Editor ထဲတွင် မိမိအိမ်ကိုသာ ပြုပြင်နိုင်ပါသည်။
              </p>
              <button
                type="button"
                className="map-portal-card-cta"
                onClick={() => selectTool('editor')}
              >
                🗺️ 2D Map Editor (Own Home) သို့ သွားရန်
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
