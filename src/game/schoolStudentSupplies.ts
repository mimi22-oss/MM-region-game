import { BoxGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, type BufferGeometry } from 'three';
import { joinNpcGeometry, npcHandGeometry, npcProfile } from './npcAnatomy.ts';

export const NOTEBOOK_DEPTH = .19;
export const NOTEBOOK_PAGE_Y = .017;
export const PEN_NIB = [-.022, -.083, -.033] as const;

export const schoolSuppliesMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: .79 });

function colorGeometry(geometry: BufferGeometry, color: string) {
  const { r, g, b } = new Color(color);
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = r;
    colors[i + 1] = g;
    colors[i + 2] = b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.deleteAttribute('uv');
  return geometry;
}

function notebookPart(x: number, y: number, z: number, width: number, height: number, depth: number, color: string) {
  return colorGeometry(new BoxGeometry(width, height, depth).translate(x, y, z), color);
}

export const schoolNotebookGeometry = joinNpcGeometry([
  notebookPart(0, .0025, 0, .232, .005, NOTEBOOK_DEPTH, '#315785'),
  ...[-1, 1].flatMap(side => [
    notebookPart(side * .057, .0105, 0, .109, .013, .181, '#fff3dc'),
    ...Array.from({ length: 7 }, (_, line) =>
      notebookPart(side * .057, NOTEBOOK_PAGE_Y, -.066 + line * .022, .095, .0005, .0014, '#9eacc3'),
    ),
  ]),
  notebookPart(0, .011, 0, .004, .008, .181, '#c8b8a1'),
]);

export const schoolPenGeometry = joinNpcGeometry([
  colorGeometry(npcProfile([[0, 0, 0], [.012, .004, .004], [.025, .004, .004]], 8), '#313942'),
  colorGeometry(npcProfile([[.023, .0042, .0042], [.036, .0052, .0052], [.126, .0052, .0052], [.134, 0, 0]], 8), '#2352a2'),
  colorGeometry(npcProfile([[.032, .005, .005], [.035, .0055, .0055], [.06, .0055, .0055], [.061, .005, .005]], 8), '#172a4b'),
]).rotateX(.8).rotateZ(.19).translate(...PEN_NIB);

export const schoolWritingHandGeometry = (() => {
  const geometry = npcHandGeometry.clone();
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const curl = Math.max(0, (-y - .025) / .064);
    positions.setY(i, y + curl * curl * .027);
    positions.setZ(i, positions.getZ(i) - curl * .032);
    if (positions.getX(i) > .026) positions.setX(i, positions.getX(i) - curl * .014);
  }
  geometry.computeVertexNormals();
  return geometry;
})();
