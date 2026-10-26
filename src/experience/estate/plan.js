// The VÉRONA estate master plan: one coordinated world shared by every stage.
//
// World units are metres. +x is east, +z is south (towards the site entrance), y is up.
// Every construction element takes its timing from this file, so the terrain,
// the buildings, the machinery and the camera always agree with each other.

import { clamp01, fbm, lerp, rectDistance, smooth } from './util.js'

// ---------------------------------------------------------------------------
// Story windows (scroll progress 0..1)
// ---------------------------------------------------------------------------

export const SEG = {
  land: [0, 0.1],
  prep: [0.1, 0.24],
  foundations: [0.24, 0.38],
  structure: [0.38, 0.54],
  architecture: [0.54, 0.69],
  landscape: [0.69, 0.84],
  reveal: [0.84, 0.965],
  handoff: [0.965, 1],
}

export const NEVER = 9 // a time that is never reached: "not yet" / "never removed"

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export const SITE = { x0: -66, x1: 66, z0: -146, z1: 152 }
// Carriageway |x| ≤ 4, planted verge 4–5.6, footpath 5.6–7.6.
export const ROAD = { halfWidth: 4, verge: 5.6, pathOuter: 7.6, z0: 172, z1: -78, circle: { x: 0, z: -86, r: 13 }, island: 5 }

// Natural ground before any work: a gentle south-facing slope with soft undulation,
// rising into wooded hills well beyond the site boundary.
export function naturalHeight(x, z) {
  const r = Math.hypot(x, z + 10)
  const hills = smooth(clamp01((r - 210) / 520)) * (46 + 34 * fbm(x * 0.0021 + 3.1, z * 0.0021 - 1.7, 4))
  return 0.022 * -z + 1.5 * fbm(x * 0.0085, z * 0.0085, 4) + 0.35 * fbm(x * 0.05, z * 0.05, 2) + hills
}

// Finished road level along the spine: smoothed, so the carriageway reads as engineered.
const roadCache = new Map()
export function roadLevel(z) {
  const zc = Math.round(Math.min(Math.max(z, ROAD.circle.z), ROAD.z0) * 4) / 4
  const hit = roadCache.get(zc)
  if (hit !== undefined) return hit
  const level = roadLevelUncached(zc)
  roadCache.set(zc, level)
  return level
}

function roadLevelUncached(zc) {
  let sum = 0
  for (let i = -3; i <= 3; i++) sum += naturalHeight(0, zc + i * 6)
  return sum / 7 + 0.05
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

// rot turns the building's local +z (its entrance side) to face the road.
const FACE_EAST = Math.PI / 2
const FACE_WEST = -Math.PI / 2

// o: schedule offset, so buildings progress at different rates.
// dig: the excavation window, set by the machine that digs the plot.
const RAW = [
  { id: 'W1', cx: -36, cz: 54, rot: FACE_EAST, W: 19, D: 12.5, flip: 1, o: 0, dig: [0.145, 0.175], machine: 'exA' },
  { id: 'E1', cx: 36, cz: 54, rot: FACE_WEST, W: 18, D: 12, flip: -1, o: 0.006, dig: [0.145, 0.175], machine: 'exB' },
  { id: 'W2', cx: -36, cz: 4, rot: FACE_EAST, W: 20, D: 13, flip: -1, o: 0.016, dig: [0.183, 0.212], machine: 'exA' },
  { id: 'H', cx: 0, cz: -120, rot: 0, W: 23, D: 14, flip: 1, o: 0.022, dig: [0.183, 0.212], machine: 'exB', hero: true },
  { id: 'E2', cx: 36, cz: 4, rot: FACE_WEST, W: 18.5, D: 12.5, flip: 1, o: 0.03, dig: [0.219, 0.246], machine: 'exB' },
  { id: 'W3', cx: -36, cz: -46, rot: FACE_EAST, W: 18, D: 12, flip: 1, o: 0.034, dig: [0.219, 0.246], machine: 'exA' },
  { id: 'CL', cx: 38, cz: 108, rot: FACE_WEST, W: 26, D: 11, flip: -1, o: 0.026, dig: [0.15, 0.18], machine: 'exC', club: true },
  { id: 'E3', cx: 36, cz: -46, rot: FACE_WEST, W: 19, D: 12.5, flip: -1, o: 0.04, dig: [0.188, 0.222], machine: 'exC' },
]

// Base task windows for a building with o = 0. Order is the build order.
const TASKS = {
  setout: [0.055, 0.09],
  clear: [0.11, 0.14],
  grade: [0.125, 0.155],
  footings: [0.222, 0.255],
  fill: [0.252, 0.27],
  rebar0: [0.268, 0.3],
  pour0: [0.302, 0.338],
  backfill: [0.338, 0.352],
  poolShell: [0.33, 0.37],
  colsGF: [0.38, 0.408],
  form1: [0.404, 0.42],
  rebar1: [0.418, 0.43],
  pour1: [0.43, 0.455],
  colsUF: [0.455, 0.478],
  form2: [0.474, 0.486],
  rebar2: [0.484, 0.493],
  pour2: [0.493, 0.512],
  strike: [0.515, 0.538],
  block: [0.54, 0.578],
  frames: [0.57, 0.594],
  interior: [0.58, 0.592],
  glass: [0.59, 0.632],
  stone: [0.578, 0.618],
  render: [0.585, 0.624],
  timber: [0.612, 0.645],
  coping: [0.632, 0.652],
  tiles: [0.638, 0.662],
  walls: [0.69, 0.718],
  deck: [0.696, 0.724],
  drive: [0.708, 0.734],
  lawn: [0.718, 0.756],
  hedges: [0.728, 0.762],
  trees: [0.732, 0.782],
  water: [0.735, 0.77],
  lights: [0.758, 0.778],
}

export function localToWorld(b, lx, lz) {
  const c = Math.cos(b.rot)
  const s = Math.sin(b.rot)
  return [b.cx + lx * c + lz * s, b.cz - lx * s + lz * c]
}

// Local rectangle → world axis-aligned rectangle (rotations are multiples of 90°).
export function worldRect(b, x0, x1, z0, z1) {
  const [ax, az] = localToWorld(b, x0, z0)
  const [bx, bz] = localToWorld(b, x1, z1)
  return { cx: (ax + bx) / 2, cz: (az + bz) / 2, hw: Math.abs(bx - ax) / 2, hd: Math.abs(bz - az) / 2 }
}

function layout(raw) {
  const { W, D, flip } = raw
  const upperW = raw.club ? 0 : Math.round(W * 0.72)
  const cant = raw.club ? 0 : 3.5
  // Upper volume slides sideways to cantilever past the ground floor by `cant` metres.
  const ux1 = flip > 0 ? W / 2 + cant : -W / 2 + upperW - cant
  const upper = raw.club ? null : { x0: ux1 - upperW, x1: ux1, z0: -D / 2 - 0.8, z1: D / 2 - 1.8 }
  const poolLen = raw.club ? 18 : raw.hero ? 16 : 13
  const px0 = flip > 0 ? -W / 2 : W / 2 - poolLen
  const pool = raw.hero
    ? { x0: W / 2 + 2, x1: W / 2 + 6, z0: D / 2 - 2, z1: D / 2 + 14 } // reflecting pool beside the drive
    : { x0: px0, x1: px0 + poolLen, z0: -D / 2 - 10, z1: -D / 2 - 5.5 }
  // Local z of the carriageway edge (side plots face the spine; the hero villa faces the circle).
  const roadLocalZ = raw.hero ? ROAD.circle.z - ROAD.circle.r - raw.cz : Math.abs(raw.cx) - ROAD.halfWidth
  const entranceX = flip > 0 ? -W / 2 + 4 : W / 2 - 4
  return { upper, pool, cant, roadLocalZ, entranceX }
}

export const BUILDINGS = RAW.map((raw) => {
  const level = Math.round(naturalHeight(raw.cx, raw.cz) * 2) / 2
  const L = layout(raw)
  const t = {}
  for (const [k, [a, b]] of Object.entries(TASKS)) t[k] = [a + raw.o, b + raw.o]
  t.dig = raw.dig
  const b = { ...raw, ...L, level, t, plot: { x0: -24, x1: 24, z0: -raw.D / 2 - 14, z1: L.roadLocalZ } }
  b.pit = worldRect(b, -raw.W / 2 - 1.4, raw.W / 2 + 1.4, -raw.D / 2 - 1.4, raw.D / 2 + 1.4)
  b.footprint = worldRect(b, -raw.W / 2 - 0.4, raw.W / 2 + 0.4, -raw.D / 2 - 0.4, raw.D / 2 + 0.4)
  b.poolRect = worldRect(b, L.pool.x0 - 0.6, L.pool.x1 + 0.6, L.pool.z0 - 0.6, L.pool.z1 + 0.6)
  b.plotRect = worldRect(b, b.plot.x0, b.plot.x1, b.plot.z0, b.plot.z1)
  // Working zone: only this is stripped and graded. Gardens keep their meadow until turfed.
  b.workRect = worldRect(
    b,
    Math.min(-raw.W / 2, L.pool.x0) - 4,
    Math.max(raw.W / 2 + (L.upper ? L.cant : 0), L.pool.x1) + 4,
    Math.min(-raw.D / 2, L.pool.z0) - 4,
    raw.D / 2 + 6,
  )
  b.deckRect = raw.hero
    ? worldRect(b, -raw.W / 2, raw.W / 2, -raw.D / 2 - 4, -raw.D / 2)
    : worldRect(b, L.pool.x0 - 1, L.pool.x1 + 1, L.pool.z0 - 1.2, -raw.D / 2)
  b.driveRect = worldRect(b, L.entranceX - 2.4, L.entranceX + 2.4, raw.D / 2, L.roadLocalZ)
  return b
})

export const HERO = BUILDINGS.find((b) => b.hero)

// ---------------------------------------------------------------------------
// Site-wide works
// ---------------------------------------------------------------------------

export const WORKS = {
  hoarding: { in: [0.082, 0.108], out: [0.8, 0.83] },
  cabins: { in: [0.088, 0.112], out: [0.8, 0.83], rect: { cx: -24, cz: 136, hw: 9, hd: 7 } },
  roadGrade: [0.108, 0.19], // grading front travels from the entrance to the circle
  subbase: [0.13, 0.215],
  kerbs: [0.688, 0.718],
  asphalt: [0.702, 0.752],
  paths: [0.72, 0.758],
  streetLights: [0.748, 0.776],
  avenue: [0.745, 0.795],
  gate: [0.7, 0.74],
  crane: { mast: [0.358, 0.384], jib: [0.383, 0.395], jibOut: [0.652, 0.664], mastOut: [0.662, 0.688], x: -13, z: -21 },
  // Interior and landscape lights switch on through the reveal (dusk).
  dusk: [0.86, 0.95],
}

// Road grading front: the corridor is shaped from the entrance northwards.
function roadGradeStart(z) {
  const f = clamp01((ROAD.z0 - z) / (ROAD.z0 - ROAD.circle.z + 20))
  return lerp(WORKS.roadGrade[0], WORKS.roadGrade[1] - 0.02, f)
}

function inRoadCorridor(x, z, pad) {
  if (z <= ROAD.z0 + 4 && z >= ROAD.circle.z && Math.abs(x) <= ROAD.pathOuter + pad) return true
  return Math.hypot(x - ROAD.circle.x, z - ROAD.circle.z) <= ROAD.circle.r + 2.5 + pad
}

function rectContains(r, x, z, pad = 0) {
  return Math.abs(x - r.cx) <= r.hw + pad && Math.abs(z - r.cz) <= r.hd + pad
}

// Everything the ground needs to know at one point. Used for terrain vertices,
// grass placement and anything else that sits on the ground.
export function siteInfo(x, z) {
  const natural = naturalHeight(x, z)
  const info = {
    natural,
    clear: NEVER, // grass → bare soil
    lawn: NEVER, // soil → finished lawn
    grade: [NEVER, NEVER, 0], // [start, end, delta]
    dig: [NEVER, NEVER, NEVER, 0], // [start, end, backfillStart, depth]
    hard: false, // permanently covered by building, road or paving
    building: null,
  }

  // Road corridor and its verges
  const roadWeight = 1 - smooth(clamp01((Math.abs(x) - (ROAD.pathOuter + 3)) / 7))
  const nearCircle = Math.hypot(x - ROAD.circle.x, z - ROAD.circle.z) - (ROAD.circle.r + 2.5)
  const circleWeight = 1 - smooth(clamp01((nearCircle - 3) / 7))
  const corridorWeight = z >= ROAD.circle.z - 4 && z <= ROAD.z0 + 6 ? Math.max(roadWeight, circleWeight) : circleWeight
  let target = natural
  let weight = 0
  if (corridorWeight > 0) {
    target = roadLevel(z <= ROAD.circle.z ? ROAD.circle.z : z)
    weight = corridorWeight
  }

  for (const b of BUILDINGS) {
    if (rectDistance(x, z, b.plotRect.cx, b.plotRect.cz, b.plotRect.hw, b.plotRect.hd) <= 0) info.building = b
    const d = rectDistance(x, z, b.workRect.cx, b.workRect.cz, b.workRect.hw, b.workRect.hd)
    if (d > 8) continue
    const w = 1 - smooth(clamp01(d / 8))
    if (w > weight) {
      target = lerp(target, b.level, w / Math.max(w + weight, 1e-6))
      weight = w
    }
  }

  if (weight > 0.001) {
    const delta = (target - natural) * weight
    const b = info.building
    const start = b ? b.t.grade[0] : roadGradeStart(z)
    const end = b ? b.t.grade[1] : start + 0.03
    info.grade = [start, end, delta]
  }

  const inRoad = inRoadCorridor(x, z, 0)
  const inVerge = inRoadCorridor(x, z, 5)
  if (inVerge) {
    info.clear = Math.min(info.clear, roadGradeStart(z) - 0.008)
    if (!inRoad) info.lawn = WORKS.paths[1]
  }
  if (inRoad) info.hard = true
  // The turning circle's central island is planted.
  if (Math.hypot(x - ROAD.circle.x, z - ROAD.circle.z) < ROAD.island) {
    info.hard = false
    info.lawn = WORKS.paths[1]
  }

  const b = info.building
  if (b) {
    const workDist = rectDistance(x, z, b.workRect.cx, b.workRect.cz, b.workRect.hw, b.workRect.hd)
    if (workDist < 2) info.clear = Math.min(info.clear, b.t.clear[0] + 0.02 * clamp01(Math.abs(x - b.cx) / 30))
    if (rectContains(b.driveRect, x, z, 0.3)) info.clear = Math.min(info.clear, b.t.drive[0] - 0.012)
    const hardscape =
      rectContains(b.footprint, x, z, 0.2) ||
      rectContains(b.poolRect, x, z, 0.2) ||
      rectContains(b.deckRect, x, z, 0.1) ||
      rectContains(b.driveRect, x, z, 0.1)
    if (hardscape) info.hard = true
    else info.lawn = b.t.lawn[0] + 0.015 * clamp01(rectDistance(x, z, b.footprint.cx, b.footprint.cz, b.footprint.hw, b.footprint.hd) / 18)

    // Excavation: the house pit (backfilled around the slab) and the pool basin (kept).
    const pd = rectDistance(x, z, b.pit.cx, b.pit.cz, b.pit.hw, b.pit.hd)
    if (pd < 1.4) {
      const depth = 1.0 * (1 - smooth(clamp01((pd + 0.3) / 1.7)))
      const inFootprint = rectContains(b.footprint, x, z, -0.2)
      info.dig = [b.t.dig[0], b.t.dig[1], inFootprint ? NEVER : b.t.backfill[0], depth]
    }
    const qd = rectDistance(x, z, b.poolRect.cx, b.poolRect.cz, b.poolRect.hw - 0.6, b.poolRect.hd - 0.6)
    if (qd < 1.2 && !b.hero) {
      const depth = 1.7 * (1 - smooth(clamp01((qd + 0.2) / 1.4)))
      if (depth > info.dig[3]) info.dig = [b.t.dig[0] + 0.006, b.t.dig[1], NEVER, depth]
    }
  }

  // Contractor's compound by the entrance: cleared, then restored to lawn.
  if (rectContains(WORKS.cabins.rect, x, z, 3)) {
    info.clear = Math.min(info.clear, WORKS.cabins.in[0] - 0.01)
    info.lawn = WORKS.cabins.out[1] + 0.005
  }
  // Tower crane base
  const cr = WORKS.crane
  if (Math.hypot(x - cr.x, z - cr.z) < 6) {
    info.clear = Math.min(info.clear, cr.mast[0] - 0.02)
    if (!info.hard) info.lawn = Math.max(info.lawn === NEVER ? 0 : info.lawn, cr.mastOut[1] + 0.03)
  }

  if (info.lawn !== NEVER && info.clear === NEVER) info.clear = info.lawn - 0.04
  return info
}

// Final finished ground height (after grading, before any pits).
export function gradedHeight(x, z) {
  const s = siteInfo(x, z)
  return s.natural + s.grade[2]
}

// ---------------------------------------------------------------------------
// Machinery routes
// ---------------------------------------------------------------------------

// Where an excavator stands to dig a plot: on the road side of the pit, facing it.
export function excavatorStation(b) {
  const lz = b.D / 2 + 4.2
  const [x, z] = localToWorld(b, 0, lz)
  const heading = b.rot + Math.PI // faces the pit (local -z)
  return { x, z, heading, y: b.level }
}

// Each machine visits its plots in order. Between visits it drives along the road.
export function machineVisits(machine) {
  return BUILDINGS.filter((b) => b.machine === machine).sort((a, b) => a.dig[0] - b.dig[0])
}

// Vehicles arrive along the existing country lane south of the gate, from beyond the haze.
export const LANE = { z0: ROAD.z0, z1: 760, halfWidth: 2.8 }
export const ENTRY = { z: 640 }

const laneCache = new Map()
export function laneLevel(z) {
  const zc = Math.round(z)
  const hit = laneCache.get(zc)
  if (hit !== undefined) return hit
  let sum = 0
  for (let i = -4; i <= 4; i++) sum += naturalHeight(0, zc + i * 5)
  // Blend into the estate road at the gate.
  const t = clamp01((zc - ROAD.z0) / 30)
  const level = lerp(roadLevel(ROAD.z0), sum / 9 + 0.12, t)
  laneCache.set(zc, level)
  return level
}

// Ground height a vehicle drives on at (x, z).
export function driveHeight(x, z) {
  if (z > ROAD.z0) return laneLevel(z) + 0.02
  if (Math.abs(x) <= ROAD.halfWidth + 0.5 && z >= ROAD.circle.z) return roadLevel(z) + 0.02
  return gradedHeight(x, z)
}
