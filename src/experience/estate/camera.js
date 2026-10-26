// The camera's choreography: one continuous move through the estate.
//
// Keys are placed at scroll progress values; position and target follow centripetal
// Catmull-Rom curves, and progress is mapped onto the curve with a monotone cubic
// (Fritsch–Carlson), so the move passes exactly through every key with no velocity
// jumps. Same technique as Toran's camera/path.ts.

import * as THREE from 'three'
import { lerp } from './util.js'

const BASE_FOV = 36

export const CAMERA_KEYS = [
  // 1 · Untouched land: dawn, high over the country lane
  { p: 0.0, pos: [-128, 74, 196], look: [-4, 0, 6], fov: 34 },
  { p: 0.075, pos: [-112, 64, 168], look: [-6, 0, 10], fov: 34 },
  // 2 · Site preparation: descend as the machines arrive and the ground is shaped
  { p: 0.135, pos: [-104, 58, 150], look: [-14, 0, 42], fov: 34 },
  { p: 0.195, pos: [-64, 26, 94], look: [-30, 0, 50] },
  { p: 0.245, pos: [-32, 9.5, 84], look: [-34, 0, 52], fov: 38 },
  // 3 · Foundations: ground level beside the first villa, rebar then the pour
  { p: 0.29, pos: [-14.5, 2.3, 68], look: [-33, -0.4, 53], fov: 40 },
  { p: 0.335, pos: [-13, 1.9, 58], look: [-34, -0.2, 47], fov: 40 },
  // 4 · Structure: crane up past the frames
  { p: 0.378, pos: [-6, 7, 40], look: [-30, 1.5, 28] },
  { p: 0.425, pos: [4, 22, 18], look: [-22, 5, -6] },
  { p: 0.485, pos: [-8, 46, 34], look: [14, 3, -58], fov: 38 },
  // 5 · Architecture: down to a facade being enclosed
  { p: 0.535, pos: [22, 12, 32], look: [36, 3, 6] },
  { p: 0.585, pos: [12, 4.6, 26], look: [33, 3, 12], fov: 40 },
  { p: 0.64, pos: [11, 4.2, -4], look: [34, 3.4, 16], fov: 40 },
  // 6 · Landscape & infrastructure: rise to follow the paving front
  { p: 0.69, pos: [14, 30, 72], look: [-4, 0, 30] },
  { p: 0.745, pos: [-30, 48, 152], look: [0, 0, 60], fov: 36 },
  { p: 0.8, pos: [72, 72, 62], look: [-5, 0, -20] },
  // 7 · Reveal: golden hour wide, then aerial-to-ground down the avenue
  { p: 0.86, pos: [122, 122, 142], look: [0, 0, -30], fov: 34 },
  // Down the centre of the avenue (cypress crowns are < 1 m from the verge line, 4.8 m off-axis)
  { p: 0.905, pos: [0, 40, -16], look: [0, 2, -108], fov: 36 },
  { p: 0.94, pos: [4, 12, -62], look: [-1, 3, -115], fov: 38 },
  // 8 · Arrival and handoff: on the circle's east side, the island oak behind the camera
  { p: 0.975, pos: [8.5, 2.3, -95], look: [-2.5, 3.6, -118], fov: 40 },
  { p: 1.0, pos: [7.8, 2.1, -97.5], look: [-2.5, 3.7, -119], fov: 40 },
]

const posCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal')
const lookCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal')

const xs = CAMERA_KEYS.map((k) => k.p)
const ys = CAMERA_KEYS.map((_, i) => i / (CAMERA_KEYS.length - 1))
const tangents = (() => {
  const n = xs.length
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x))
  const m = new Array(n)
  m[0] = 0
  m[n - 1] = 0
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])
  return m
})()

function progressToU(p) {
  if (p <= xs[0]) return 0
  const last = xs.length - 1
  if (p >= xs[last]) return 1
  let i = 0
  while (p > xs[i + 1]) i++
  const h = xs[i + 1] - xs[i]
  const t = (p - xs[i]) / h
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * tangents[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * tangents[i + 1]
}

/** Camera position and target at progress p. Returns the vertical FOV designed for 16:9. */
export function sampleCamera(p, outPos, outLook) {
  const u = progressToU(p)
  posCurve.getPoint(u, outPos)
  lookCurve.getPoint(u, outLook)
  const f = u * (CAMERA_KEYS.length - 1)
  const i = Math.min(Math.floor(f), CAMERA_KEYS.length - 2)
  return lerp(CAMERA_KEYS[i].fov ?? BASE_FOV, CAMERA_KEYS[i + 1].fov ?? BASE_FOV, f - i)
}

/** Keep the designed horizontal framing on narrow screens, within a limit for portrait phones. */
export function fitFov(designFov, aspect) {
  const design = 16 / 9
  if (aspect >= design) return designFov
  const h = 2 * Math.atan(Math.tan((designFov * Math.PI) / 360) * design)
  const v = (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI
  return Math.min(v, 72)
}
