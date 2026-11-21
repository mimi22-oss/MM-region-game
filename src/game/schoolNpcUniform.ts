import { BufferGeometry, Float32BufferAttribute } from 'three';
import { joinNpcGeometry, npcCroppedHairGeometry, npcEllipsoid, npcProfile, npcScalpHair, npcTiedHairGeometry } from './npcAnatomy.ts';

export const schoolShirtGeometry = npcProfile([
  [-.235, 0, 0], [-.234, .142, .096], [-.2, .158, .111], [-.07, .166, .114],
  [.084, .188, .122], [.159, .205, .116], [.197, .181, .107],
  [.228, .104, .081], [.25, .057, .058], [.251, 0, 0],
], 20);

export const schoolCollarGeometry = (() => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    -.054, .239, .035, -.015, .204, .085, -.069, .132, .115, -.096, .192, .093,
    .054, .239, .035, .015, .204, .085, .069, .132, .115, .096, .192, .093,
  ], 3));
  geometry.setIndex([0, 3, 2, 0, 2, 1, 4, 6, 7, 4, 5, 6]);
  geometry.computeVertexNormals();
  return geometry;
})();

export const schoolShortSleeveGeometry = npcProfile([
  [-.207, 0, 0], [-.204, .049, .048], [-.18, .05, .047], [-.09, .056, .051],
  [-.011, .061, .054], [.026, .048, .045], [.046, 0, 0],
]);

export const schoolUpperArmGeometry = npcProfile([
  [-.264, 0, 0], [-.255, .037, .036], [-.199, .041, .04], [-.162, .045, .043], [-.15, 0, 0],
]);

export const schoolForearmGeometry = npcProfile([
  [-.238, 0, 0], [-.233, .024, .024], [-.185, .026, .026], [-.11, .033, .031],
  [-.044, .04, .036], [.015, .037, .034], [.036, 0, 0],
]);

export const schoolThighGeometry = npcProfile([
  [-.41, 0, 0], [-.384, .043, .041], [-.31, .052, .052], [-.19, .064, .066],
  [-.045, .07, .081], [.035, .068, .081], [.075, 0, 0],
]);

export const schoolShortsGeometry = npcProfile([
  [-.293, 0, 0], [-.293, .063, .062], [-.269, .065, .064], [-.13, .072, .077],
  [.01, .079, .088], [.05, .072, .074], [.075, 0, 0],
]);

const shortsWaist = npcProfile([
  [-.077, 0, 0], [-.068, .162, .106], [.074, .157, .113], [.121, .151, .105], [.122, 0, 0],
]);

const pleatedSkirt = npcProfile([
  [-.444, 0, 0], [-.443, .226, .206, 0, .01, .075], [-.414, .223, .202, 0, .008, .075],
  [-.21, .19, .161, 0, 0, .055], [-.07, .171, .128, 0, 0, .022],
  [.074, .157, .113], [.121, .151, .105], [.122, 0, 0],
], 40);

export const schoolSeatedSkirtGeometry = (() => {
  const geometry = pleatedSkirt.clone();
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y >= .07) continue;
    const bend = Math.min(1, (.07 - y) / .27);
    const angle = 1.41 * bend * bend * (3 - 2 * bend);
    const z = positions.getZ(i) * (1 - .37 * bend);
    positions.setY(i, y * Math.cos(angle) + z * Math.sin(angle));
    positions.setZ(i, z * Math.cos(angle) - y * Math.sin(angle));
  }
  geometry.computeVertexNormals();
  return geometry;
})();

const teacherLongyi = npcProfile([
  [-.658, 0, 0], [-.657, .177, .151], [-.629, .179, .153], [-.31, .185, .145],
  [-.09, .176, .127], [.074, .157, .113], [.121, .151, .105], [.122, 0, 0],
], 22);

const teacherHtamein = npcProfile([
  [-.648, 0, 0], [-.647, .163, .14], [-.62, .164, .141], [-.34, .171, .139],
  [-.098, .177, .131], [.074, .157, .113], [.121, .151, .105], [.122, 0, 0],
], 22);

const partedHair = npcScalpHair(angle => .055 + .018 * Math.cos(angle * 2.8), -.074);
const braidedHair = joinNpcGeometry([
  npcTiedHairGeometry.clone(),
  ...[-1, 1].map(side => npcProfile([
    [-.287, 0, 0, side * .122, -.017], [-.274, .014, .016, side * .124, -.023],
    [-.244, .018, .018, side * .128, -.041], [-.211, .022, .022, side * .128, -.051],
    [-.17, .023, .023, side * .122, -.068], [-.12, .026, .025, side * .116, -.080],
    [-.064, .03, .026, side * .106, -.08], [-.026, 0, 0, side * .104, -.081],
  ], 10)),
]);

const bunHair = joinNpcGeometry([
  npcTiedHairGeometry.clone(),
  npcEllipsoid(0, -.025, -.151, .073, .058, .054),
]);

export const schoolUniforms = {
  'student-boy': { hair: npcCroppedHairGeometry, bottoms: shortsWaist, width: .93, headSize: 1.04 },
  'student-girl': { hair: braidedHair, bottoms: pleatedSkirt, width: .89, headSize: 1.04 },
  'teacher-man': { hair: partedHair, bottoms: teacherLongyi, width: 1.05, headSize: .98 },
  'teacher-woman': { hair: bunHair, bottoms: teacherHtamein, width: .95, headSize: .97 },
};

export const SCHOOL_NPC_HIP_Y = .78;
export const SCHOOL_NPC_KNEE_Y = -.38;
export const SCHOOL_NPC_SHOE_Y = -.4;
export const SCHOOL_NPC_ELBOW_Y = -.247;
export const SCHOOL_NPC_WRIST_Y = -.23;
