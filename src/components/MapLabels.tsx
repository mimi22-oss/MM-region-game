import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { worldMapLabels } from '../data/mapLabels';
import { layoutMapLabels, type ProjectedLabel } from '../game/mapLabels';
import { sceneGround } from '../game/groundSurface';

type LabelHost = RefObject<HTMLDivElement | null>;
export function MapLabelsOverlay({ host, hidden }: { host: LabelHost; hidden: boolean }) {
 return <div ref={host} className="world-map-labels" hidden={hidden} aria-hidden="true">
  {worldMapLabels.map(label => <div key={label.id} data-map-label={label.id} className={`world-map-label world-map-label--${label.kind}`}>
   {label.kind === 'place' && <span className="world-map-label-dot" />}
   <span>{label.name}</span>
  </div>)}
 </div>;
}

/** Project after Player's camera update. No extra scene renders, text textures or per-frame React state. */
export function MapLabelsProjection({ host, enabled }: { host: LabelHost; enabled: boolean }) {
 const state = useRef({ point: new Vector3(), direction: new Vector3(), nextLayout: 0, nextGround: 0,
  selected: new Set<string>(), heights: new Map<string, number>(), elements: new Map<string, HTMLDivElement>() });
 useFrame(({ camera, scene, size, clock }) => {
  const root = host.current;
  if (!root) return;
  const s = state.current, now = clock.elapsedTime;
  camera.getWorldDirection(s.direction);
  // Also works when the user tilts/zooms manually, not only with the sky-view button.
  const aerial = enabled && s.direction.y < -0.3 && camera.position.y > 18;
  root.style.visibility = aerial ? 'visible' : 'hidden';
  if (!aerial) { s.nextLayout = 0; return; }
  if (!s.elements.size) root.querySelectorAll<HTMLDivElement>('[data-map-label]').forEach(element => s.elements.set(element.dataset.mapLabel!, element));
  const refresh = now >= s.nextLayout;
  if (now >= s.nextGround) {
   const ground = sceneGround(scene, now);
   for (const label of worldMapLabels) s.heights.set(label.id, ground.height(label.x, label.z) + 3);
   s.nextGround = now + 2;
  }
  camera.updateMatrixWorld();
  const candidates: ProjectedLabel[] = [];
  for (const label of worldMapLabels) {
   const element = s.elements.get(label.id);
   if (!element || (!refresh && !s.selected.has(label.id))) continue;
   s.point.set(label.x, s.heights.get(label.id) ?? 3, label.z);
   const distance = s.point.distanceTo(camera.position);
   s.point.project(camera);
   const visible = s.point.z >= -1 && s.point.z <= 1 && Math.abs(s.point.x) <= 1 && Math.abs(s.point.y) <= 1 && distance < (label.kind === 'area' ? 8500 : 4200);
   if (!visible) { element.style.visibility = 'hidden'; continue; }
   const x = (s.point.x + 1) * size.width / 2, y = (1 - s.point.y) * size.height / 2;
   element.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
   if (refresh) candidates.push({ id: label.id, x, y, width: element.offsetWidth, height: element.offsetHeight, priority: label.priority });
  }
  if (refresh) {
   s.selected = new Set(layoutMapLabels(candidates, size.width, size.height, size.width < 600 ? 18 : 36).map(label => label.id));
   for (const [id, element] of s.elements) element.style.visibility = s.selected.has(id) ? 'inherit' : 'hidden';
   s.nextLayout = now + 0.12;
  }
 });
 return null;
}
