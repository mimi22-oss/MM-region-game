import { angle } from "../data/ward.ts";
import { tharSiVillage } from "../data/villages/index.ts";
import { toLocalUV, detectLocation } from "./locationDetect.ts";
const anchor = toLocalUV(tharSiVillage.x, tharSiVillage.z);
const geo = tharSiVillage.coordinates!;
/** Stable local tangent approximation, not surveyed GPS or device geolocation. */
export function robotLocation(x: number, z: number, yaw: number) {
  const { u, v } = toLocalUV(x, z),
    bearing = (((((angle - yaw) * 180) / Math.PI) % 360) + 360) % 360;
  const direction = [
    "North",
    "North-East",
    "East",
    "South-East",
    "South",
    "South-West",
    "West",
    "North-West",
  ][Math.round(bearing / 45) % 8];
  return {
    x,
    z,
    u,
    v,
    latitude: geo.lat - (v - anchor.v) / 111320,
    longitude:
      geo.lng + (u - anchor.u) / (111320 * Math.cos((geo.lat * Math.PI) / 180)),
    bearing,
    direction,
    yaw,
    place: detectLocation(x, z),
  };
}
export function locationCopyText(x: number, z: number, yaw: number) {
  const p = robotLocation(x, z, yaw);
  return [
    "Robot location: " + (p.place.subArea ?? p.place.label),
    "Latitude (approx): " + p.latitude.toFixed(7),
    "Longitude (approx): " + p.longitude.toFixed(7),
    "Scene X/Z (m): " + p.x.toFixed(3) + ", " + p.z.toFixed(3),
    "Local U/V (m): " + p.u.toFixed(3) + ", " + p.v.toFixed(3),
    "Facing: " + p.direction + " (" + p.bearing.toFixed(1) + " deg)",
    "Robot yaw (rad): " + p.yaw.toFixed(6),
    "Geo reference: Thar Si village; approximate, not GPS. Use scene X/Z or local U/V for exact scene edits.",
  ].join("\n");
}
