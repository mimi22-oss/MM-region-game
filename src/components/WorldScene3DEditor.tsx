import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent as ReactDragEvent,
} from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DoubleSide, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { Town } from './Town';
import { Asset3DInstance } from './Asset3DRenderer';
import {
  getAssetDefinition,
  searchAssets,
  type AssetCategory,
  type AssetDefinition,
} from '../game/assetRegistry';
import {
  REGIONS,
  loadRegionLayout,
  loadRegionLayoutAsync,
  regionCenter,
  saveRegionLayout,
} from '../game/editorRegions';
import { downloadLayout, type LayoutFeature, type Point2, type WorldLayout } from '../game/worldLayout';
import {
  canCreateMapFeature,
  canDeleteMapFeature,
  canEditMapFeature,
  createMapAccessContext,
  filterPermittedLayoutChanges,
  getActiveAuthoritySession,
  resolveCurrentMapAccessContext,
  subscribeAuthoritySession,
  type MapAccessContext,
} from '../game/mapPermissions';
import {
  EDITOR_QUICK_JUMPS,
  compassDegToRotationRad,
  createDrawnPathFeature,
  createFeatureFromAsset,
  deleteFeatureFromLayout,
  duplicateFeatureInLayout,
  featureAnchorXZ,
  moveFeatureInLayout,
  patchFeatureInLayout,
  rotateFeatureByDegrees,
  rotateFeatureCardinal,
  rotationRadToCompassDeg,
  type DrawPathCategory,
} from '../game/scene3dEditorOps';
import { sceneGround } from '../game/groundSurface';
import type { WorldLoadingState } from '../game/regionLoading';
import './WorldScene3DEditor.css';

type EditorMode = 'select' | 'place' | 'draw';

interface CameraFlyRequest {
  x: number;
  y: number;
  z: number;
  distance: number;
  seq: number;
}

interface HoverHit {
  x: number;
  y: number;
  z: number;
}

const CATEGORY_ICONS: Record<AssetCategory, string> = {
  buildings: '🏛️',
  nature: '⛰️',
  infrastructure: '🌉',
  furniture: '🪑',
  vehicles: '🏍️',
  cultural: '⛩️',
};

const QUICK_PALETTE_GROUPS: Array<{ id: 'all' | 'monastery' | AssetCategory; label: string }> = [
  { id: 'all', label: 'အားလုံး' },
  { id: 'monastery', label: '🛕 ဘုန်းကြီးကျောင်း/စေတီ' },
  { id: 'buildings', label: '🏠 အိမ်/အဆောက်အဦ' },
  { id: 'infrastructure', label: '🌉 တံတား/အခြေခံ' },
  { id: 'nature', label: '⛰️ တောင်/သစ်ပင်' },
  { id: 'furniture', label: '🪑 ပစ္စည်း/ပရိဘောဂ' },
  { id: 'cultural', label: '⛩️ ရိုးရာ/သင်္ချိုင်း' },
  { id: 'vehicles', label: '🏍️ ယာဉ်များ' },
];

const _raycaster = new Raycaster();
const _ndc = new Vector2();
const _planeHit = new Vector3();
const _groundPlane = new Plane(new Vector3(0, 1, 0), 0);

/**
 * Inside-Canvas Camera + Raycast + Direct 3D Manipulation Controller.
 * Keeps `camera.userData.viewFocus` synced so `<StreamedWorld>` inside `<Town>`
 * streams the exact live ward/village/monastery/mountain you are editing!
 */
function Scene3DController({
  flyRequest,
  mode,
  draggingFeatureId,
  placingAssetDef,
  placingRotation,
  drawCategory,
  drawPoints,
  drawWidth,
  drawElevation,
  features,
  selectedId,
  onSelectFeature,
  onStartDragFeature,
  onDragMoveFeature,
  onEndDragFeature,
  onPlaceAt,
  onDrawAddPoint,
  onHoverChange,
  dropAssetRef,
  onDropAssetComplete,
  snapRequestRef,
  onSnapResult,
}: {
  flyRequest: CameraFlyRequest | null;
  mode: EditorMode;
  draggingFeatureId: string | null;
  placingAssetDef: AssetDefinition | null;
  placingRotation: number;
  drawCategory: DrawPathCategory;
  drawPoints: Point2[];
  drawWidth: number;
  drawElevation: number;
  features: LayoutFeature[];
  selectedId: string | null;
  onSelectFeature: (id: string | null) => void;
  onStartDragFeature: (id: string) => void;
  onDragMoveFeature: (id: string, x: number, y: number, z: number) => void;
  onEndDragFeature: () => void;
  onPlaceAt: (x: number, y: number, z: number) => void;
  onDrawAddPoint: (pt: Point2, y: number) => void;
  onHoverChange: (hit: HoverHit | null) => void;
  dropAssetRef: React.MutableRefObject<{ assetId: string; clientX: number; clientY: number } | null>;
  onDropAssetComplete: (assetId: string, x: number, y: number, z: number) => void;
  snapRequestRef: React.MutableRefObject<{ featureId: string; x: number; z: number } | null>;
  onSnapResult: (featureId: string, y: number) => void;
}) {
  const { camera, gl, scene, clock } = useThree();
  const controlsRef = useRef<ThreeOrbitControls | null>(null);
  const keysRef = useRef(new Set<string>());
  const [hoverHit, setHoverHit] = useState<HoverHit | null>(null);
  const hoverThrottleRef = useRef(0);
  const draggingRef = useRef<string | null>(null);
  draggingRef.current = draggingFeatureId;

  // Initialize OrbitControls
  useEffect(() => {
    camera.position.set(187.1 + 26, 28, -55.2 + 34);
    const controls = new ThreeOrbitControls(camera, gl.domElement);
    controls.target.set(187.1, 1.5, -55.2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 1.5;
    controls.maxDistance = 1200;
    controls.panSpeed = 1.15;
    controls.zoomSpeed = 1.2;
    controlsRef.current = controls;
    camera.userData.viewFocus = { x: controls.target.x, z: controls.target.z };
    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  // Smooth fly to requested landmark or region
  useEffect(() => {
    if (!flyRequest || !controlsRef.current) return;
    const c = controlsRef.current;
    c.target.set(flyRequest.x, flyRequest.y, flyRequest.z);
    camera.position.set(
      flyRequest.x + flyRequest.distance * 0.62,
      flyRequest.y + Math.max(8, flyRequest.distance * 0.58),
      flyRequest.z + flyRequest.distance * 0.68,
    );
    c.update();
    camera.userData.viewFocus = { x: flyRequest.x, z: flyRequest.z };
  }, [flyRequest, camera]);

  // Pause OrbitControls while actively dragging a 3D object
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = draggingFeatureId === null;
    }
  }, [draggingFeatureId]);

  // WASD / Arrow smooth fly navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select')) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        keysRef.current.add(e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  /** Raycasts screen (clientX, clientY) onto the REAL 3D scene surface (monastery floor, ground, mountain, bridge). */
  const raycastWorldPoint = useCallback(
    (clientX: number, clientY: number): HoverHit | null => {
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      _raycaster.setFromCamera(_ndc, camera);

      const hits = _raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let skip = false;
        let obj: typeof hit.object | null = hit.object;
        while (obj) {
          if (
            obj.userData?.editorGizmo ||
            obj.name.startsWith('editor-gizmo') ||
            obj.name.startsWith('editor-preview') ||
            obj.type === 'Line' ||
            obj.type === 'Points'
          ) {
            skip = true;
            break;
          }
          obj = obj.parent;
        }
        if (skip) continue;
        return { x: hit.point.x, y: Math.max(0, hit.point.y), z: hit.point.z };
      }

      if (_raycaster.ray.intersectPlane(_groundPlane, _planeHit)) {
        const g = sceneGround(scene, clock.elapsedTime);
        const gy = g.height(_planeHit.x, _planeHit.z);
        return { x: _planeHit.x, y: gy, z: _planeHit.z };
      }
      return null;
    },
    [camera, gl, scene, clock],
  );

  // Pointer listeners on canvas for live preview, drag-to-move, click-to-place, and drag-to-draw
  useEffect(() => {
    const dom = gl.domElement;
    let pointerDownPos: { x: number; y: number } | null = null;
    let drawDragStart: HoverHit | null = null;

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (draggingRef.current) {
        const hit = raycastWorldPoint(e.clientX, e.clientY);
        if (hit) {
          onDragMoveFeature(draggingRef.current, hit.x, hit.y, hit.z);
          setHoverHit(hit);
          onHoverChange(hit);
        }
        return;
      }
      if (mode === 'place' || mode === 'draw') {
        if (now - hoverThrottleRef.current < 28) return;
        hoverThrottleRef.current = now;
        const hit = raycastWorldPoint(e.clientX, e.clientY);
        setHoverHit(hit);
        onHoverChange(hit);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      if (mode === 'draw') {
        drawDragStart = raycastWorldPoint(e.clientX, e.clientY);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (draggingRef.current) {
        onEndDragFeature();
        pointerDownPos = null;
        return;
      }
      if (e.button !== 0 || !pointerDownPos) return;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      pointerDownPos = null;

      if (mode === 'place' && moveDist < 7) {
        const hit = raycastWorldPoint(e.clientX, e.clientY);
        if (hit) onPlaceAt(hit.x, hit.y, hit.z);
      } else if (mode === 'draw') {
        const hit = raycastWorldPoint(e.clientX, e.clientY);
        if (!hit) return;
        if (moveDist >= 18 && drawDragStart) {
          // Drag & Draw: instant 2-point span from press to release!
          onDrawAddPoint({ x: drawDragStart.x, z: drawDragStart.z }, drawDragStart.y);
          onDrawAddPoint({ x: hit.x, z: hit.z }, hit.y);
        } else if (moveDist < 8) {
          onDrawAddPoint({ x: hit.x, z: hit.z }, hit.y);
        }
        drawDragStart = null;
      }
    };

    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, mode, raycastWorldPoint, onDragMoveFeature, onEndDragFeature, onPlaceAt, onDrawAddPoint, onHoverChange]);

  // Process pending HTML5 Drag & Drop or Snap-to-Ground inside useFrame + fly camera
  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const controls = controlsRef.current;
    if (controls) {
      // WASD / Arrow camera pan relative to camera yaw
      const keys = keysRef.current;
      const fwd = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      if (fwd !== 0 || right !== 0) {
        const dist = camera.position.distanceTo(controls.target);
        const speed = Math.max(12, Math.min(180, dist * 0.95)) * dt;
        const dir = new Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0;
        if (dir.lengthSq() > 1e-4) dir.normalize();
        const side = new Vector3(-dir.z, 0, dir.x);
        const move = dir.multiplyScalar(fwd * speed).add(side.multiplyScalar(right * speed));
        controls.target.add(move);
        camera.position.add(move);
      }
      controls.update();
      camera.userData.viewFocus = { x: controls.target.x, z: controls.target.z };
    }

    // Handle HTML5 Drag & Drop directly onto the 3D scene
    if (dropAssetRef.current) {
      const pending = dropAssetRef.current;
      dropAssetRef.current = null;
      const hit = raycastWorldPoint(pending.clientX, pending.clientY);
      if (hit) {
        onDropAssetComplete(pending.assetId, hit.x, hit.y, hit.z);
      }
    }

    // Handle "Snap to Ground" request
    if (snapRequestRef.current) {
      const req = snapRequestRef.current;
      snapRequestRef.current = null;
      const g = sceneGround(scene, clock.elapsedTime);
      const y = g.height(req.x, req.z);
      onSnapResult(req.featureId, y);
    }
  });

  // Only show lightweight 3D interactive handles for features near the current camera focus (keeps 60fps smooth!)
  const visibleHandles = useMemo(() => {
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? { x: 187, z: -55 };
    return features.filter((f) => {
      if (f.id === selectedId || f.isCustomPlaced || !f.metadata?.authored) return true;
      const a = featureAnchorXZ(f);
      return Math.hypot(a.x - focus.x, a.z - focus.z) < 220;
    });
  }, [features, selectedId, camera]);

  const selectedFeature = useMemo(
    () => features.find((f) => f.id === selectedId) ?? null,
    [features, selectedId],
  );

  return (
    <>
      {/* 1. Interactive 3D Selection Handles & Drag Hitboxes for All Editable Objects */}
      <group name="editor-gizmo-handles" userData={{ editorGizmo: true }}>
        {visibleHandles.map((f) => {
          const anchor = featureAnchorXZ(f);
          const isSel = f.id === selectedId;
          const isCustom = f.isCustomPlaced || !f.metadata?.authored;
          const def = getAssetDefinition(f.assetId);
          const w = f.dimensions?.width ?? def?.defaultDimensions.width ?? f.width ?? 4;
          const d = f.dimensions?.depth ?? def?.defaultDimensions.depth ?? 4;
          const radius = Math.max(0.9, Math.min(18, Math.max(w, d) * 0.52));
          const y = (f.elevationY ?? 0) + 0.16;

          const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
            if (mode !== 'select') return;
            e.stopPropagation();
            onSelectFeature(f.id);
            if (isSel) {
              onStartDragFeature(f.id);
            }
          };

          const handleClick = (e: ThreeEvent<MouseEvent>) => {
            if (mode !== 'select') return;
            e.stopPropagation();
            onSelectFeature(f.id);
          };

          return (
            <group
              key={f.id}
              position={[anchor.x, y, anchor.z]}
              userData={{ editorGizmo: true }}
            >
              {/* Subtle ground pick disc (bright cyan when selected, emerald for custom placed, amber dot for existing authored) */}
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerDown={handlePointerDown}
                onClick={handleClick}
                userData={{ editorGizmo: true }}
              >
                <ringGeometry args={[isSel ? radius * 0.86 : Math.min(radius, 1.4) * 0.55, isSel ? radius * 1.06 : Math.min(radius, 1.4), 28]} />
                <meshBasicMaterial
                  color={isSel ? '#38bdf8' : isCustom ? '#10b981' : '#f59e0b'}
                  transparent
                  opacity={isSel ? 0.92 : isCustom ? 0.5 : 0.25}
                  side={DoubleSide}
                  depthWrite={false}
                />
              </mesh>
              {/* Invisible center grab disc so small props (alms bowl, table, chair) are super easy to click & drag */}
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.04, 0]}
                onPointerDown={handlePointerDown}
                onClick={handleClick}
                userData={{ editorGizmo: true }}
              >
                <circleGeometry args={[Math.max(0.85, Math.min(radius, 4.5)), 16]} />
                <meshBasicMaterial transparent opacity={0.01} depthWrite={false} side={DoubleSide} />
              </mesh>
            </group>
          );
        })}

        {/* Selected Object Front Orientation Arrow (shows exact N/E/S/W facing in 3D!) */}
        {selectedFeature && (() => {
          const anchor = featureAnchorXZ(selectedFeature);
          const def = getAssetDefinition(selectedFeature.assetId);
          const span = Math.max(
            2.2,
            Math.min(18, Math.max(selectedFeature.dimensions?.width ?? def?.defaultDimensions.width ?? 4, selectedFeature.dimensions?.depth ?? def?.defaultDimensions.depth ?? 4) * 0.72),
          );
          const rot = selectedFeature.rotation ?? 0;
          const y = (selectedFeature.elevationY ?? 0) + 0.35;
          return (
            <group
              position={[anchor.x, y, anchor.z]}
              rotation={[0, rot, 0]}
              userData={{ editorGizmo: true }}
            >
              {/* Arrow shaft pointing to local -Z (North when rot = 0) */}
              <mesh position={[0, 0, -span * 0.55]} userData={{ editorGizmo: true }}>
                <boxGeometry args={[0.24, 0.14, span * 1.1]} />
                <meshBasicMaterial color="#fbbf24" />
              </mesh>
              {/* Arrowhead cone */}
              <mesh
                position={[0, 0, -span * 1.15]}
                rotation={[-Math.PI / 2, 0, 0]}
                userData={{ editorGizmo: true }}
              >
                <coneGeometry args={[0.62, 1.35, 8]} />
                <meshBasicMaterial color="#f59e0b" />
              </mesh>
            </group>
          );
        })()}
      </group>

      {/* 2. Live 3D Ghost Preview while Placing or Dragging from Palette */}
      {mode === 'place' && placingAssetDef && hoverHit && (
        <group name="editor-preview-ghost" userData={{ editorGizmo: true }}>
          <Asset3DInstance
            assetId={placingAssetDef.assetId}
            position={[hoverHit.x, hoverHit.y, hoverHit.z]}
            rotation={placingRotation}
            scale={placingAssetDef.defaultScale}
            dimensions={placingAssetDef.defaultDimensions}
            color={placingAssetDef.defaultColor}
            roofColor={placingAssetDef.defaultRoofColor}
            selected
          />
          {/* Orientation indicator on ghost preview */}
          <group
            position={[hoverHit.x, hoverHit.y + 0.35, hoverHit.z]}
            rotation={[0, placingRotation, 0]}
            userData={{ editorGizmo: true }}
          >
            <mesh position={[0, 0, -2.2]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.45, 1.1, 8]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        </group>
      )}

      {/* 3. Live 3D Preview while Drag & Drawing a Bridge / Road / Canal */}
      {mode === 'draw' && (drawPoints.length > 0 || hoverHit) && (
        <group name="editor-preview-draw" userData={{ editorGizmo: true }}>
          {drawPoints.map((pt, idx) => (
            <mesh key={idx} position={[pt.x, drawElevation + 0.45, pt.z]} userData={{ editorGizmo: true }}>
              <sphereGeometry args={[0.55, 12, 12]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          ))}
          {hoverHit && (
            <mesh position={[hoverHit.x, drawElevation + 0.45, hoverHit.z]} userData={{ editorGizmo: true }}>
              <sphereGeometry args={[0.45, 12, 12]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
          )}
          {(() => {
            const previewPts = hoverHit ? [...drawPoints, { x: hoverHit.x, z: hoverHit.z }] : drawPoints;
            if (previewPts.length < 2) return null;
            return previewPts.slice(0, -1).map((a, i) => {
              const b = previewPts[i + 1];
              const dx = b.x - a.x;
              const dz = b.z - a.z;
              const len = Math.hypot(dx, dz);
              if (len < 0.2) return null;
              const yaw = Math.atan2(dx, dz);
              const color = drawCategory === 'bridge' ? '#38bdf8' : drawCategory === 'canal' ? '#22d3ee' : '#fbbf24';
              return (
                <mesh
                  key={`seg-${i}`}
                  position={[(a.x + b.x) / 2, drawElevation + 0.25, (a.z + b.z) / 2]}
                  rotation={[0, yaw, 0]}
                  userData={{ editorGizmo: true }}
                >
                  <boxGeometry args={[drawWidth, 0.35, len]} />
                  <meshBasicMaterial color={color} transparent opacity={0.55} />
                </mesh>
              );
            });
          })()}
        </group>
      )}
    </>
  );
}

/**
 * ============================================================================
 * Real-Time 3D WYSIWYG World Scene Editor (`/map?tool=editor`)
 * ============================================================================
 * Edits the ACTUAL live 3D Myanmar Town world (`<Town />` + `<DynamicWorldObjects />`)
 * directly in 3D with full CRUD, Drag & Drop, Drag & Draw, and N/E/S/W Rotation.
 */
export default function WorldScene3DEditor({
  accessContext,
  onSwitchTo2D,
}: {
  accessContext?: MapAccessContext;
  onSwitchTo2D?: () => void;
}) {
  const authority = useSyncExternalStore(
    subscribeAuthoritySession,
    getActiveAuthoritySession,
    getActiveAuthoritySession,
  );
  const access = useMemo(
    () => resolveCurrentMapAccessContext(accessContext ?? createMapAccessContext('admin')),
    [accessContext, authority.mode, authority.serverRole],
  );
  const isAdmin = access.role === 'admin';

  const [region, setRegion] = useState('myothar');
  const [layout, setLayout] = useState<WorldLayout>(() => loadRegionLayout('myothar'));
  const [history, setHistory] = useState<WorldLayout[]>([]);
  const [future, setFuture] = useState<WorldLayout[]>([]);
  const [autoSave, setAutoSave] = useState(true);
  const [dirty, setDirty] = useState(false);

  // Editor tools & selection
  const [mode, setMode] = useState<EditorMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingFeatureId, setDraggingFeatureId] = useState<string | null>(null);
  const [placingAssetId, setPlacingAssetId] = useState<string | null>('furniture:round-dining-table');
  const [placingRotation, setPlacingRotation] = useState(0);
  const [drawCategory, setDrawCategory] = useState<DrawPathCategory>('bridge');
  const [drawPoints, setDrawPoints] = useState<Point2[]>([]);
  const [drawWidth, setDrawWidth] = useState(8);
  const [drawElevation, setDrawElevation] = useState(2.8);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);

  // Palette search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [paletteGroup, setPaletteGroup] = useState<'all' | 'monastery' | AssetCategory>('all');
  const [dayMinute, setDayMinute] = useState(780);
  const [hoverCoords, setHoverCoords] = useState<HoverHit | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    '3D Real-Time Editor အဆင်သင့်ဖြစ်ပါပြီ · Component များကို ဆွဲချ (Drag & Drop) သို့မဟုတ် နှိပ်၍ ပြင်ဆင်နိုင်သည်',
  );
  const [loadingState, setLoadingState] = useState<WorldLoadingState>({
    blocking: true,
    required: [],
    downloads: [],
  });

  // Camera fly & drop refs
  const [flyRequest, setFlyRequest] = useState<CameraFlyRequest | null>(null);
  const dropAssetRef = useRef<{ assetId: string; clientX: number; clientY: number } | null>(null);
  const snapRequestRef = useRef<{ featureId: string; x: number; z: number } | null>(null);
  const dragSnapshotSavedRef = useRef(false);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Load region layout asynchronously (supports streamed Kanbale & all authored regions)
  useEffect(() => {
    let cancelled = false;
    const syncLayout = loadRegionLayout(region);
    setLayout(syncLayout);
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
    setDirty(false);
    void loadRegionLayoutAsync(region).then((loaded) => {
      if (!cancelled) setLayout(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [region]);

  const commitLayout = useCallback(
    (nextRaw: WorldLayout, note?: string, pushHistory = true) => {
      const prev = layoutRef.current;
      const filtered = filterPermittedLayoutChanges(nextRaw, prev, access);
      if (filtered.blockedCount > 0 && !isAdmin) {
        setStatusMessage('👤 User Mode တွင် မိမိပိုင်အိမ်ကိုသာ ပြုပြင်နိုင်ပါသည်');
      }
      const next = filtered.layout;
      if (pushHistory) {
        setHistory((h) => [...h.slice(-39), prev]);
        setFuture([]);
      }
      layoutRef.current = next;
      setLayout(next);
      if (autoSave) {
        saveRegionLayout(region, next);
        setDirty(false);
      } else {
        setDirty(true);
      }
      if (note) setStatusMessage(note);
    },
    [access, isAdmin, autoSave, region],
  );

  const handleSaveNow = useCallback(() => {
    saveRegionLayout(region, layoutRef.current);
    setDirty(false);
    setStatusMessage('💾 ပြင်ဆင်ချက်များကို တကယ့် Site 3D တွင် သိမ်းဆည်းပြီးပါပြီ');
  }, [region]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [layoutRef.current, ...f.slice(0, 39)]);
    setHistory((h) => h.slice(0, -1));
    layoutRef.current = prev;
    setLayout(prev);
    if (autoSave) saveRegionLayout(region, prev);
    else setDirty(true);
    setStatusMessage('↩️ Undo ပြုလုပ်ပြီးပါပြီ');
  }, [history, autoSave, region]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h.slice(-39), layoutRef.current]);
    setFuture((f) => f.slice(1));
    layoutRef.current = next;
    setLayout(next);
    if (autoSave) saveRegionLayout(region, next);
    else setDirty(true);
    setStatusMessage('↪️ Redo ပြုလုပ်ပြီးပါပြီ');
  }, [future, autoSave, region]);

  const selectedFeature = useMemo(
    () => layout.features.find((f) => f.id === selectedId) ?? null,
    [layout.features, selectedId],
  );
  const canEditSelected = selectedFeature ? canEditMapFeature(selectedFeature, access) : false;
  const canDeleteSelected = selectedFeature ? canDeleteMapFeature(selectedFeature, access) : false;

  const placingAssetDef = useMemo(
    () => getAssetDefinition(placingAssetId ?? undefined) ?? null,
    [placingAssetId],
  );

  const filteredAssets = useMemo(() => {
    if (paletteGroup === 'monastery') {
      return searchAssets(searchQuery).filter((a) =>
        a.tags.some((t) =>
          ['monastery', 'pagoda', 'stupa', 'zayat', 'alms', 'shrine', 'scripture', 'meditation', 'mat', 'rice', 'cauldron', 'tiffin', 'jar', 'ဘုန်းကြီးကျောင်း', 'စေတီ'].includes(t),
        ),
      );
    }
    return searchAssets(searchQuery, paletteGroup === 'all' ? undefined : paletteGroup);
  }, [searchQuery, paletteGroup]);

  // Custom / recently placed items listed in Outliner for quick access & deletion
  const customFeatures = useMemo(
    () => layout.features.filter((f) => f.isCustomPlaced || !f.metadata?.authored).slice().reverse(),
    [layout.features],
  );

  const flyTo = useCallback((x: number, y: number, z: number, distance = 42, targetRegion?: string) => {
    if (targetRegion && targetRegion !== region) {
      setRegion(targetRegion);
    }
    setFlyRequest({ x, y, z, distance, seq: Date.now() });
  }, [region]);

  // Place new component at exact 3D hit coordinates
  const placeAssetAt = useCallback(
    (assetId: string, x: number, y: number, z: number) => {
      if (!canCreateMapFeature(access)) {
        setStatusMessage('🔒 Admin Mode တွင်သာ Component အသစ် ထည့်သွင်းနိုင်ပါသည်');
        return;
      }
      const def = getAssetDefinition(assetId);
      if (!def) return;
      const nextFeature = createFeatureFromAsset(def, x, z, y, placingRotation);
      commitLayout(
        { ...layoutRef.current, features: [...layoutRef.current.features, nextFeature] },
        `✅ "${nextFeature.name}" ကို (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) တွင် ထည့်သွင်းပြီးပါပြီ`,
      );
      setSelectedId(nextFeature.id);
    },
    [access, placingRotation, commitLayout],
  );

  const handlePlaceClick = useCallback(
    (x: number, y: number, z: number) => {
      if (!placingAssetId) return;
      placeAssetAt(placingAssetId, x, y, z);
    },
    [placingAssetId, placeAssetAt],
  );

  // Drag & Draw Bridges / Roads / Canals
  const handleDrawAddPoint = useCallback(
    (pt: Point2, y: number) => {
      if (!canCreateMapFeature(access)) {
        setStatusMessage('🔒 Admin Mode တွင်သာ တံတား/လမ်း အသစ် ဆွဲနိုင်ပါသည်');
        return;
      }
      setDrawPoints((prev) => {
        if (prev.length === 0 && drawCategory === 'bridge') {
          setDrawElevation(Number(Math.max(y, 2.2).toFixed(1)));
        }
        return [...prev, pt];
      });
    },
    [access, drawCategory],
  );

  const handleFinishDraw = useCallback(() => {
    if (drawPoints.length < 2) {
      setStatusMessage('အနည်းဆုံး အမှတ် ၂ မှတ် ရွေးပြီးမှ Finish နှိပ်ပါ');
      return;
    }
    const created = createDrawnPathFeature(drawCategory, drawPoints, drawWidth, drawElevation);
    commitLayout(
      { ...layoutRef.current, features: [...layoutRef.current.features, created] },
      `✅ ${created.name} (${drawPoints.length} မှတ်) ကို 3D တွင် တည်ဆောက်ပြီးပါပြီ`,
    );
    setDrawPoints([]);
    setSelectedId(created.id);
    setMode('select');
  }, [drawPoints, drawCategory, drawWidth, drawElevation, commitLayout]);

  // Direct 3D drag-to-move on selected object
  const handleStartDrag = useCallback(
    (id: string) => {
      const target = layoutRef.current.features.find((f) => f.id === id);
      if (!target || !canEditMapFeature(target, access)) return;
      dragSnapshotSavedRef.current = false;
      setDraggingFeatureId(id);
    },
    [access],
  );

  const handleDragMove = useCallback(
    (id: string, x: number, y: number, z: number) => {
      if (!dragSnapshotSavedRef.current) {
        dragSnapshotSavedRef.current = true;
        setHistory((h) => [...h.slice(-39), layoutRef.current]);
        setFuture([]);
      }
      const next = moveFeatureInLayout(layoutRef.current, id, x, z, y);
      layoutRef.current = next;
      setLayout(next);
    },
    [],
  );

  const handleEndDrag = useCallback(() => {
    setDraggingFeatureId(null);
    if (dragSnapshotSavedRef.current) {
      dragSnapshotSavedRef.current = false;
      if (autoSave) {
        saveRegionLayout(region, layoutRef.current);
        setDirty(false);
        setStatusMessage('✅ နေရာရွှေ့ပြောင်းပြီး တကယ့် 3D တွင် သိမ်းဆည်းပြီးပါပြီ');
      } else {
        setDirty(true);
      }
    }
  }, [autoSave, region]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedFeature || !canDeleteSelected) return;
    const next = deleteFeatureFromLayout(layoutRef.current, selectedFeature.id);
    commitLayout(next, `🗑️ "${selectedFeature.name}" ကို ဖျက်လိုက်ပါပြီ`);
    setSelectedId(null);
  }, [selectedFeature, canDeleteSelected, commitLayout]);

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedFeature || !canCreateMapFeature(access)) return;
    const { layout: next, duplicatedId } = duplicateFeatureInLayout(layoutRef.current, selectedFeature.id, 3, 3);
    commitLayout(next, `📋 "${selectedFeature.name}" ကို ပွားပြီးပါပြီ`);
    if (duplicatedId) setSelectedId(duplicatedId);
  }, [selectedFeature, access, commitLayout]);

  // Keyboard shortcuts: Q/E rotate, Delete remove, Ctrl+Z/Y Undo/Redo, Ctrl+D Duplicate, Esc Cancel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && canDeleteSelected) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key.toLowerCase() === 'q') {
        if (mode === 'place') setPlacingRotation((r) => r + Math.PI / 12);
        else if (selectedId && canEditSelected) {
          commitLayout(rotateFeatureByDegrees(layoutRef.current, selectedId, -15), '↺ -15° လှည့်ပြီး');
        }
      } else if (e.key.toLowerCase() === 'e') {
        if (mode === 'place') setPlacingRotation((r) => r - Math.PI / 12);
        else if (selectedId && canEditSelected) {
          commitLayout(rotateFeatureByDegrees(layoutRef.current, selectedId, 15), '↻ +15° လှည့်ပြီး');
        }
      } else if (e.key === 'Escape') {
        setDrawPoints([]);
        setMode('select');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, selectedId, canEditSelected, canDeleteSelected, handleUndo, handleRedo, handleDuplicateSelected, handleDeleteSelected, commitLayout]);

  // HTML5 Drag & Drop onto 3D viewport
  const handleViewportDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOverCanvas) setDragOverCanvas(true);
  };

  const handleViewportDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverCanvas(false);
    const assetId = e.dataTransfer.getData('application/x-mm-asset') || e.dataTransfer.getData('text/plain');
    if (assetId && getAssetDefinition(assetId)) {
      dropAssetRef.current = { assetId, clientX: e.clientX, clientY: e.clientY };
    }
  };

  const selectedAnchor = selectedFeature ? featureAnchorXZ(selectedFeature) : null;
  const selectedCompassDeg = selectedFeature ? rotationRadToCompassDeg(selectedFeature.rotation ?? 0) : 0;
  const selectedUniformScale = selectedFeature
    ? Array.isArray(selectedFeature.scale)
      ? selectedFeature.scale[0]
      : (selectedFeature.scale ?? 1)
    : 1;

  const handleSceneError = useCallback(() => {
    setStatusMessage('3D Scene ပြန်လည်ချိတ်ဆက်နေသည်…');
  }, []);

  return (
    <div className="scene3d-studio">
      {/* Top Action & Navigation Toolbar */}
      <div className="scene3d-toolbar">
        <div className="scene3d-toolbar-group">
          <button
            type="button"
            className={`scene3d-btn ${mode === 'select' ? 'active' : ''}`}
            onClick={() => { setMode('select'); setDrawPoints([]); }}
            title="3D ပေါ်တွင် နှိပ်၍ ရွေးချယ်/ဆွဲရွှေ့ရန်"
          >
            ✋ ရွေး / ရွှေ့ (Select &amp; Drag)
          </button>
          <button
            type="button"
            className={`scene3d-btn ${mode === 'place' ? 'active' : ''}`}
            disabled={!isAdmin}
            onClick={() => { setMode('place'); setDrawPoints([]); }}
            title="Component အသစ်ကို 3D ပေါ်တွင် နှိပ်ချရန်"
          >
            📦 ချထည့် (Place)
          </button>
          <button
            type="button"
            className={`scene3d-btn ${mode === 'draw' ? 'active' : ''}`}
            disabled={!isAdmin}
            onClick={() => { setMode('draw'); setDrawPoints([]); }}
            title="တံတား၊ လမ်း၊ ရေမြောင်းများကို ဆွဲချတည်ဆောက်ရန်"
          >
            ✏️ ဆွဲချ (Draw တံတား/လမ်း)
          </button>
        </div>

        {/* Quick Jump to Monastery / Town / Mountains + Region Selector */}
        <div className="scene3d-toolbar-group">
          <select
            className="scene3d-select"
            aria-label="နေရာအမြန်သွားရန်"
            defaultValue=""
            onChange={(e) => {
              const spot = EDITOR_QUICK_JUMPS.find((j) => j.id === e.target.value);
              if (spot) flyTo(spot.x, spot.y, spot.z, spot.distance, spot.regionId);
              e.target.value = '';
            }}
          >
            <option value="" disabled>📍 နေရာအမြန်သွားရန်…</option>
            {EDITOR_QUICK_JUMPS.map((spot) => (
              <option key={spot.id} value={spot.id}>
                {spot.icon} {spot.labelMm}
              </option>
            ))}
          </select>

          <select
            className="scene3d-select"
            aria-label="ရပ်ကွက်/ကျေးရွာ"
            value={region}
            onChange={(e) => {
              const nextRegion = e.target.value;
              setRegion(nextRegion);
              const center = regionCenter(nextRegion, { x: 0, z: 0 });
              flyTo(center.x, 1.5, center.z, 90);
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <button
            type="button"
            className="scene3d-btn"
            onClick={() => setDayMinute((m) => (m === 780 ? 1140 : 780))}
            title="နေ့/ည မြင်ကွင်းပြောင်းရန်"
          >
            {dayMinute === 780 ? '☀️ နေ့' : '🌙 ည'}
          </button>
        </div>

        {/* Undo / Redo / Auto-Save / Export / 2D Blueprint Toggle */}
        <div className="scene3d-toolbar-group">
          <button type="button" className="scene3d-btn" disabled={history.length === 0} onClick={handleUndo}>
            ↩️ Undo
          </button>
          <button type="button" className="scene3d-btn" disabled={future.length === 0} onClick={handleRedo}>
            ↪️ Redo
          </button>
          <button
            type="button"
            className={`scene3d-btn ${autoSave ? 'primary' : ''}`}
            onClick={() => setAutoSave((v) => !v)}
            title="ပြင်ဆင်တိုင်း တကယ့် Site 3D တွင် အလိုအလျောက် သိမ်းဆည်းမည်"
          >
            {autoSave ? '⚡ Auto-Save ON' : '⚡ Auto-Save OFF'}
          </button>
          {!autoSave && (
            <button type="button" className="scene3d-btn primary" onClick={handleSaveNow}>
              💾 Save {dirty ? '*' : ''}
            </button>
          )}
          <button
            type="button"
            className="scene3d-btn"
            onClick={() => downloadLayout(layout)}
            title="Layout JSON ထုတ်ယူရန်"
          >
            📥 JSON
          </button>
          {onSwitchTo2D && (
            <button
              type="button"
              className="scene3d-btn"
              onClick={onSwitchTo2D}
              title="2D Blueprint မြေပုံကြည့်ရန်"
            >
              🗺️ 2D Blueprint
            </button>
          )}
        </div>
      </div>

      {/* Main 3-Column Studio Body */}
      <div className="scene3d-body">
        {/* LEFT PANEL: All Reusable 3D Components (Drag & Drop or Click-to-Place) */}
        <aside className="scene3d-palette" aria-label="3D Component Library">
          <div className="scene3d-panel-header">
            <h2 className="scene3d-panel-title">
              <span>🧩 3D Components</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{filteredAssets.length} ခု</span>
            </h2>
            <input
              type="search"
              className="scene3d-search"
              placeholder="ရှာရန် (ဉပမာ- ဘုန်းကြီးကျောင်း၊ တံတား၊ တောင်၊ သပိတ်)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="scene3d-cats">
              {QUICK_PALETTE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`scene3d-cat-chip ${paletteGroup === g.id ? 'active' : ''}`}
                  onClick={() => setPaletteGroup(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="scene3d-palette-hint">
              💡 ကတ်ကို <strong>3D မြင်ကွင်းထဲ ဆွဲချ (Drag &amp; Drop)</strong> သို့မဟုတ် နှိပ်ရွေးပြီး 3D ပေါ်တွင် ချထည့်နိုင်ပါသည်။ (`Q`/`E` ဖြင့် လှည့်ပါ)
            </div>
          </div>

          <div className="scene3d-asset-list">
            {filteredAssets.map((asset) => {
              const isPicked = mode === 'place' && placingAssetId === asset.assetId;
              return (
                <button
                  key={asset.assetId}
                  type="button"
                  draggable={isAdmin}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-mm-asset', asset.assetId);
                    e.dataTransfer.setData('text/plain', asset.assetId);
                    e.dataTransfer.effectAllowed = 'copy';
                    setPlacingAssetId(asset.assetId);
                  }}
                  onClick={() => {
                    setPlacingAssetId(asset.assetId);
                    if (isAdmin) setMode('place');
                    setStatusMessage(`📦 "${asset.nameMm}" ကို ရွေးထားသည် — 3D နေရာကို နှိပ်၍ ချထည့်ပါ (Q/E လှည့်)`);
                  }}
                  className={`scene3d-asset-card ${isPicked ? 'selected' : ''}`}
                  title={asset.description}
                >
                  <div className="scene3d-asset-badge">
                    <span>{CATEGORY_ICONS[asset.category]}</span>
                    <span
                      className="scene3d-asset-swatch"
                      style={{ background: asset.defaultColor ?? asset.footprint.color }}
                    />
                  </div>
                  <div className="scene3d-asset-name">{asset.nameMm}</div>
                  <div className="scene3d-asset-dim">
                    {asset.defaultDimensions.width}×{asset.defaultDimensions.depth}m
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER PANEL: Live 3D WYSIWYG World Scene Canvas */}
        <div
          className={`scene3d-viewport ${dragOverCanvas ? 'drag-over' : ''}`}
          onDragOver={handleViewportDragOver}
          onDragLeave={() => setDragOverCanvas(false)}
          onDrop={handleViewportDrop}
        >
          {/* Floating Live Mode & Coordinates Pill */}
          <div className="scene3d-hud-top">
            <div className="scene3d-hud-pill">
              <span>
                {mode === 'select'
                  ? '✋ နှိပ်၍ရွေး / ဖိဆွဲ၍ရွှေ့ · WASD ဖြင့် ကင်မရာရွှေ့'
                  : mode === 'place'
                    ? `📦 ချထည့်မည်: ${placingAssetDef?.nameMm ?? ''} (${rotationRadToCompassDeg(placingRotation)}°)`
                    : `✏️ ဆွဲချမည်: ${drawCategory === 'bridge' ? 'တံတား' : drawCategory === 'road' ? 'လမ်း' : 'ရေမြောင်း'} (${drawPoints.length} မှတ်)`}
              </span>
            </div>
            {hoverCoords && (
              <div className="scene3d-hud-pill">
                <span>
                  X: {hoverCoords.x.toFixed(1)} · Y: {hoverCoords.y.toFixed(1)} · Z: {hoverCoords.z.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Drag & Draw Control Bar (Bridges, Roads, Canals) */}
          {mode === 'draw' && (
            <div className="scene3d-draw-bar">
              {(['bridge', 'road', 'canal'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`scene3d-btn ${drawCategory === cat ? 'active' : ''}`}
                  onClick={() => {
                    setDrawCategory(cat);
                    setDrawWidth(cat === 'bridge' ? 8 : cat === 'canal' ? 4 : 6);
                    setDrawElevation(cat === 'bridge' ? 2.8 : 0);
                  }}
                >
                  {cat === 'bridge' ? '🌉 တံတား' : cat === 'road' ? '🛣️ လမ်း' : '🌊 ရေမြောင်း'}
                </button>
              ))}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                အကျယ်:
                <input
                  type="number"
                  min={2}
                  max={24}
                  step={0.5}
                  value={drawWidth}
                  onChange={(e) => setDrawWidth(Number(e.target.value) || 6)}
                  className="scene3d-input"
                  style={{ width: 54 }}
                />
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                အမြင့် Y:
                <input
                  type="number"
                  min={0}
                  max={1400}
                  step={0.5}
                  value={drawElevation}
                  onChange={(e) => setDrawElevation(Number(e.target.value) || 0)}
                  className="scene3d-input"
                  style={{ width: 60 }}
                />
              </label>
              <button
                type="button"
                className="scene3d-btn primary"
                disabled={drawPoints.length < 2}
                onClick={handleFinishDraw}
              >
                ✓ ပြီးပြီ ({drawPoints.length})
              </button>
              <button
                type="button"
                className="scene3d-btn"
                onClick={() => setDrawPoints([])}
              >
                ✕ ဖျက်
              </button>
            </div>
          )}

          {loadingState.blocking && (
            <div className="scene3d-loading-badge">
              ⏳ 3D မြို့ပြမြင်ကွင်းအစစ်ကို တင်နေသည်…
            </div>
          )}

          <Canvas
            shadows
            dpr={[1, 1.5]}
            camera={{ fov: 50, near: 0.4, far: 14000, position: [213, 28, -21] }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <Suspense fallback={null}>
              <Town
                minute={dayMinute}
                paused
                soundEnabled={false}
                onLoadingChange={setLoadingState}
                onSceneError={handleSceneError}
              />
              <Scene3DController
                flyRequest={flyRequest}
                mode={mode}
                draggingFeatureId={draggingFeatureId}
                placingAssetDef={placingAssetDef}
                placingRotation={placingRotation}
                drawCategory={drawCategory}
                drawPoints={drawPoints}
                drawWidth={drawWidth}
                drawElevation={drawElevation}
                features={layout.features}
                selectedId={selectedId}
                onSelectFeature={setSelectedId}
                onStartDragFeature={handleStartDrag}
                onDragMoveFeature={handleDragMove}
                onEndDragFeature={handleEndDrag}
                onPlaceAt={handlePlaceClick}
                onDrawAddPoint={handleDrawAddPoint}
                onHoverChange={setHoverCoords}
                dropAssetRef={dropAssetRef}
                onDropAssetComplete={placeAssetAt}
                snapRequestRef={snapRequestRef}
                onSnapResult={(fid, y) => {
                  commitLayout(patchFeatureInLayout(layoutRef.current, fid, { elevationY: Number(y.toFixed(3)) }), `📍 မြေပြင်အမြင့် Y=${y.toFixed(2)}m သို့ ကပ်ပြီးပါပြီ`);
                }}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* RIGHT PANEL: Real-Time Inspector (Rotate N/E/S/W, Move X/Y/Z, Resize, Recolor, CRUD) */}
        <aside className="scene3d-inspector" aria-label="Real-Time 3D Object Inspector">
          <div className="scene3d-panel-header">
            <h2 className="scene3d-panel-title">
              <span>🛠️ ပြင်ဆင်ရန် (Inspector)</span>
              {selectedFeature && (
                <button
                  type="button"
                  className="scene3d-btn"
                  style={{ padding: '2px 7px', fontSize: 11 }}
                  onClick={() => {
                    if (selectedAnchor) {
                      flyTo(selectedAnchor.x, (selectedFeature.elevationY ?? 0) + 2, selectedAnchor.z, 24);
                    }
                  }}
                >
                  🎯 ကြည့်ရန်
                </button>
              )}
            </h2>
          </div>

          <div className="scene3d-inspector-scroll">
            {selectedFeature && selectedAnchor ? (
              <>
                {/* Name & Asset Type */}
                <section className="scene3d-section">
                  <h3 className="scene3d-section-title">အမည်နှင့် အမျိုးအစား</h3>
                  <label className="scene3d-field">
                    အမည် (Name)
                    <input
                      type="text"
                      className="scene3d-input"
                      disabled={!canEditSelected}
                      value={selectedFeature.name}
                      onChange={(e) =>
                        commitLayout(patchFeatureInLayout(layout, selectedFeature.id, { name: e.target.value }))
                      }
                    />
                  </label>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    ID: <code>{selectedFeature.assetId ?? selectedFeature.kind}</code>
                  </div>
                </section>

                {/* Cardinal Rotation: North / East / South / West + Fine Angle */}
                <section className="scene3d-section">
                  <h3 className="scene3d-section-title">🧭 အရှေ့/အနောက်/တောင်/မြောက် လှည့်ရန်</h3>
                  <div className="scene3d-compass-grid">
                    <div />
                    <button
                      type="button"
                      disabled={!canEditSelected}
                      className={`scene3d-compass-btn ${selectedCompassDeg === 0 ? 'active' : ''}`}
                      onClick={() =>
                        commitLayout(rotateFeatureCardinal(layout, selectedFeature.id, 'north'), '⬆️ မြောက်ဘက် (0°) လှည့်ပြီး')
                      }
                    >
                      ⬆️ မြောက် (N)
                    </button>
                    <div />

                    <button
                      type="button"
                      disabled={!canEditSelected}
                      className={`scene3d-compass-btn ${selectedCompassDeg === 270 ? 'active' : ''}`}
                      onClick={() =>
                        commitLayout(rotateFeatureCardinal(layout, selectedFeature.id, 'west'), '⬅️ အနောက်ဘက် (270°) လှည့်ပြီး')
                      }
                    >
                      ⬅️ အနောက် (W)
                    </button>
                    <div className="scene3d-compass-center">{selectedCompassDeg}°</div>
                    <button
                      type="button"
                      disabled={!canEditSelected}
                      className={`scene3d-compass-btn ${selectedCompassDeg === 90 ? 'active' : ''}`}
                      onClick={() =>
                        commitLayout(rotateFeatureCardinal(layout, selectedFeature.id, 'east'), '➡️ အရှေ့ဘက် (90°) လှည့်ပြီး')
                      }
                    >
                      ➡️ အရှေ့ (E)
                    </button>

                    <div />
                    <button
                      type="button"
                      disabled={!canEditSelected}
                      className={`scene3d-compass-btn ${selectedCompassDeg === 180 ? 'active' : ''}`}
                      onClick={() =>
                        commitLayout(rotateFeatureCardinal(layout, selectedFeature.id, 'south'), '⬇️ တောင်ဘက် (180°) လှည့်ပြီး')
                      }
                    >
                      ⬇️ တောင် (S)
                    </button>
                    <div />
                  </div>

                  <div className="scene3d-field-row-2" style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="scene3d-btn"
                      disabled={!canEditSelected}
                      onClick={() => commitLayout(rotateFeatureByDegrees(layout, selectedFeature.id, -15))}
                    >
                      ↺ -15°
                    </button>
                    <button
                      type="button"
                      className="scene3d-btn"
                      disabled={!canEditSelected}
                      onClick={() => commitLayout(rotateFeatureByDegrees(layout, selectedFeature.id, 15))}
                    >
                      ↻ +15°
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={359}
                    disabled={!canEditSelected}
                    value={selectedCompassDeg}
                    onChange={(e) =>
                      commitLayout(
                        patchFeatureInLayout(layout, selectedFeature.id, {
                          rotation: compassDegToRotationRad(Number(e.target.value)),
                        }),
                      )
                    }
                  />
                </section>

                {/* Exact Position X / Y / Z + Floor Elevation Presets */}
                <section className="scene3d-section">
                  <h3 className="scene3d-section-title">📍 နေရာနှင့် အမြင့် (X / Y / Z)</h3>
                  <div className="scene3d-field-row">
                    <label className="scene3d-field">
                      X (m)
                      <input
                        type="number"
                        step={0.5}
                        disabled={!canEditSelected}
                        className="scene3d-input"
                        value={Number(selectedAnchor.x.toFixed(2))}
                        onChange={(e) =>
                          commitLayout(moveFeatureInLayout(layout, selectedFeature.id, Number(e.target.value) || 0, selectedAnchor.z))
                        }
                      />
                    </label>
                    <label className="scene3d-field">
                      Y အမြင့် (m)
                      <input
                        type="number"
                        step={0.25}
                        disabled={!canEditSelected}
                        className="scene3d-input"
                        value={Number((selectedFeature.elevationY ?? 0).toFixed(2))}
                        onChange={(e) =>
                          commitLayout(
                            patchFeatureInLayout(layout, selectedFeature.id, {
                              elevationY: Number(e.target.value) || 0,
                            }),
                          )
                        }
                      />
                    </label>
                    <label className="scene3d-field">
                      Z (m)
                      <input
                        type="number"
                        step={0.5}
                        disabled={!canEditSelected}
                        className="scene3d-input"
                        value={Number(selectedAnchor.z.toFixed(2))}
                        onChange={(e) =>
                          commitLayout(moveFeatureInLayout(layout, selectedFeature.id, selectedAnchor.x, Number(e.target.value) || 0))
                        }
                      />
                    </label>
                  </div>
                  <div className="scene3d-field-row">
                    <button
                      type="button"
                      className="scene3d-btn"
                      disabled={!canEditSelected}
                      onClick={() => {
                        snapRequestRef.current = {
                          featureId: selectedFeature.id,
                          x: selectedAnchor.x,
                          z: selectedAnchor.z,
                        };
                      }}
                    >
                      ⬇️ မြေကပ်
                    </button>
                    <button
                      type="button"
                      className="scene3d-btn"
                      disabled={!canEditSelected}
                      onClick={() =>
                        commitLayout(patchFeatureInLayout(layout, selectedFeature.id, { elevationY: 0.48 }), '1F ကြမ်းခင်း (Y=0.48m)')
                      }
                    >
                      1F (0.5m)
                    </button>
                    <button
                      type="button"
                      className="scene3d-btn"
                      disabled={!canEditSelected}
                      onClick={() =>
                        commitLayout(patchFeatureInLayout(layout, selectedFeature.id, { elevationY: 4.05 }), '2F အပေါ်ထပ် (Y=4.05m)')
                      }
                    >
                      2F (4.0m)
                    </button>
                  </div>
                </section>

                {/* Dimensions, Scale & Colors */}
                <section className="scene3d-section">
                  <h3 className="scene3d-section-title">📐 အရွယ်အစားနှင့် အရောင်</h3>
                  <div className="scene3d-field-row">
                    <label className="scene3d-field">
                      အကျယ် W
                      <input
                        type="number"
                        min={0.3}
                        step={0.5}
                        disabled={!canEditSelected}
                        className="scene3d-input"
                        value={selectedFeature.dimensions?.width ?? selectedFeature.width ?? 6}
                        onChange={(e) => {
                          const w = Math.max(0.3, Number(e.target.value) || 1);
                          commitLayout(
                            patchFeatureInLayout(layout, selectedFeature.id, {
                              width: selectedFeature.points.length >= 2 ? w : selectedFeature.width,
                              dimensions: {
                                width: w,
                                depth: selectedFeature.dimensions?.depth ?? 6,
                                height: selectedFeature.dimensions?.height,
                              },
                            }),
                          );
                        }}
                      />
                    </label>
                    <label className="scene3d-field">
                      အရှည် D
                      <input
                        type="number"
                        min={0.3}
                        step={0.5}
                        disabled={!canEditSelected}
                        className="scene3d-input"
                        value={selectedFeature.dimensions?.depth ?? 6}
                        onChange={(e) => {
                          const d = Math.max(0.3, Number(e.target.value) || 1);
                          commitLayout(
                            patchFeatureInLayout(layout, selectedFeature.id, {
                              dimensions: {
                                width: selectedFeature.dimensions?.width ?? 6,
                                depth: d,
                                height: selectedFeature.dimensions?.height,
                              },
                            }),
                          );
                        }}
                      />
                    </label>
                    <label className="scene3d-field">
                      Scale ({selectedUniformScale.toFixed(1)}x)
                      <input
                        type="number"
                        min={0.2}
                        max={6}
                        step={0.1}
                        disabled={!canEditSelected}
                        className="scene3d-input"
                        value={Number(selectedUniformScale.toFixed(2))}
                        onChange={(e) =>
                          commitLayout(
                            patchFeatureInLayout(layout, selectedFeature.id, {
                              scale: Math.max(0.2, Math.min(6, Number(e.target.value) || 1)),
                            }),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="scene3d-field-row-2">
                    <label className="scene3d-field">
                      အရောင် (Primary)
                      <input
                        type="color"
                        disabled={!canEditSelected}
                        className="scene3d-color-input"
                        value={selectedFeature.color || '#baa892'}
                        onChange={(e) =>
                          commitLayout(patchFeatureInLayout(layout, selectedFeature.id, { color: e.target.value }))
                        }
                      />
                    </label>
                    <label className="scene3d-field">
                      အမိုး/ဘေးအရောင်
                      <input
                        type="color"
                        disabled={!canEditSelected}
                        className="scene3d-color-input"
                        value={selectedFeature.roofColor || '#8f1f24'}
                        onChange={(e) =>
                          commitLayout(patchFeatureInLayout(layout, selectedFeature.id, { roofColor: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                </section>

                {/* CRUD Duplicate & Delete */}
                <div className="scene3d-field-row-2">
                  <button
                    type="button"
                    className="scene3d-btn"
                    disabled={!isAdmin}
                    onClick={handleDuplicateSelected}
                  >
                    📋 ပွားမည် (Duplicate)
                  </button>
                  <button
                    type="button"
                    className="scene3d-btn danger"
                    disabled={!canDeleteSelected}
                    onClick={handleDeleteSelected}
                  >
                    🗑️ ဖျက်မည် (Delete)
                  </button>
                </div>
              </>
            ) : (
              <div className="scene3d-section">
                <h3 className="scene3d-section-title">အသုံးပြုပုံ (Real-Time 3D CRUD)</h3>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.65, color: '#cbd5e1' }}>
                  <li><strong>အသစ်ထည့် (Drag &amp; Drop):</strong> ဘယ်ဘက်မှ မည်သည့် Component မဆို 3D မြင်ကွင်းထဲ ဆွဲချပါ။</li>
                  <li><strong>တံတား/လမ်း ဆွဲချ (Draw):</strong> <code>✏️ ဆွဲချ</code> နှိပ်ပြီး 3D ပေါ်တွင် ဖိဆွဲ သို့မဟုတ် အမှတ်ချပါ။</li>
                  <li><strong>ရွှေ့/လှည့်/ဖျက်:</strong> 3D ပေါ်ရှိ ပစ္စည်းကို နှိပ်ရွေးပြီး ဖိဆွဲရွှေ့၊ <strong>N/E/S/W</strong> လှည့်၊ <code>Delete</code> ဖျက်ပါ။</li>
                  <li><strong>ဘုန်းကြီးကျောင်းတွင်း:</strong> အပေါ်ဘားမှ <code>🛕 မြို့သာ ဘုန်းကြီးကျောင်း</code> သို့ သွားပြီး 1F/2F ပစ္စည်းများ ထပ်ဖြည့်/ဖျက်နိုင်ပါသည်။</li>
                </ul>
              </div>
            )}

            {/* Outliner of Custom-Placed 3D Components in this Region */}
            <section className="scene3d-section">
              <h3 className="scene3d-section-title">
                📦 ထည့်သွင်းထားသော 3D ပစ္စည်းများ ({customFeatures.length})
              </h3>
              {customFeatures.length === 0 ? (
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  အသစ်ထည့်ထားသော ပစ္စည်း မရှိသေးပါ။ ဘယ်ဘက်မှ ဆွဲချထည့်သွင်းပါ။
                </div>
              ) : (
                <div className="scene3d-item-list">
                  {customFeatures.map((item) => {
                    const a = featureAnchorXZ(item);
                    return (
                      <div
                        key={item.id}
                        className={`scene3d-item-row ${item.id === selectedId ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedId(item.id);
                          setMode('select');
                          flyTo(a.x, (item.elevationY ?? 0) + 1.5, a.z, 22);
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            className="scene3d-btn danger"
                            style={{ padding: '2px 6px', fontSize: 10.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              commitLayout(
                                deleteFeatureFromLayout(layoutRef.current, item.id),
                                `🗑️ "${item.name}" ကို ဖျက်လိုက်ပါပြီ`,
                              );
                              if (selectedId === item.id) setSelectedId(null);
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </aside>
      </div>

      {/* Footer Status */}
      <footer className="scene3d-footer">
        <div>{statusMessage}</div>
        <div>
          Region: <strong>{region}</strong> · Total: <strong>{layout.features.length}</strong> · Custom:{' '}
          <strong>{customFeatures.length}</strong> · Deleted: <strong>{layout.deletedSourceIds?.length ?? 0}</strong>
        </div>
      </footer>
    </div>
  );
}
