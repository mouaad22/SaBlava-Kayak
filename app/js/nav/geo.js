// nav/geo.js — Geolocation utilities for on-water navigation.
//
// All coordinate pairs are [longitude, latitude] (GeoJSON / Mapbox convention).
// Distance is always in metres unless the function name says otherwise.

import { KAYAK_SPEED_KMH } from "../config.js";

/** Earth radius in metres (WGS-84 mean). */
const R = 6_371_000;

/**
 * Haversine great-circle distance between two [lng, lat] coordinates.
 * @param {[number, number]} a — [lng, lat]
 * @param {[number, number]} b — [lng, lat]
 * @returns {number} distance in metres
 */
export function haversineM([lng1, lat1], [lng2, lat2]) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine distance in kilometres.
 * @param {[number, number]} a
 * @param {[number, number]} b
 * @returns {number} km
 */
export function haversineKm(a, b) {
  return haversineM(a, b) / 1000;
}

/**
 * Total path distance across an array of [lng, lat] waypoints.
 * @param {Array<[number, number]>} pts
 * @returns {number} metres
 */
export function totalPathM(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineM(pts[i - 1], pts[i]);
  return d;
}

/**
 * Total path distance in kilometres.
 * @param {Array<[number, number]>} pts
 * @returns {number} km
 */
export function totalPathKm(pts) {
  return totalPathM(pts) / 1000;
}

/**
 * Estimated paddling time for a given distance.
 * @param {number} km
 * @param {number} [speedKmh] — defaults to config value
 * @returns {number} hours (fractional)
 */
export function estimatedHours(km, speedKmh = KAYAK_SPEED_KMH) {
  return km / speedKmh;
}

/**
 * Initial bearing (0–360°, clockwise from north) from point A to point B.
 * @param {[number, number]} from — [lng, lat]
 * @param {[number, number]} to   — [lng, lat]
 * @returns {number} degrees 0–360
 */
export function bearingDeg([lng1, lat1], [lng2, lat2]) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Cardinal direction string for a bearing.
 * @param {number} deg — 0–360
 * @returns {"N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"}
 */
export function cardinalDir(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Start watching the device's GPS position.
 * @param {(pos: GeolocationPosition) => void} onUpdate
 * @param {(err: GeolocationPositionError) => void} onError
 * @returns {() => void} clearWatch function
 */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError({ code: 2, message: "Geolocation not supported" });
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(onUpdate, onError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5_000,
  });
  return () => navigator.geolocation.clearWatch(id);
}
