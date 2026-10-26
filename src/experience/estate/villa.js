// Procedural contemporary villa, built in the correct construction order.
//
// All geometry is authored in the building's local frame (metres): ground-floor slab top
// at y = 0, entrance side towards +z. Every part is stamped with a time window taken
// from the building's schedule (plan.js), so the sequence is:
//   setting-out → footings → hardcore → rebar → slab pour → columns → props & decking →
//   upper slabs → strike formwork → blockwork → cladding → frames → glazing → timber →
//   coping → pool finishes → landscaping.

import * as THREE from 'three'
import { frameMatrix } from './batch.js'
import { gradedHeight, localToWorld } from './plan.js'
import { mulberry32 } from './util.js'

const GF_TOP = 3.05 // underside of first slab
const SLAB1 = [3.05, 3.4]
const UF_TOP = 6.35
const ROOF = [6.35, 6.7]

// Evenly spaced positions between a and b, at most `step` apart.
function stations(a, b, step) {
  const n = Math.max(1, Math.round(Math.abs(b - a) / step))
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n)
}

// Stagger a set of items across a window: item k of n gets its own sub-window.
function stagger(win, k, n, overlap = 3) {
  const [a, b] = win
  const len = (b - a) / (n + overlap - 1)
  return [a + k * len, a + (k + overlap) * len]
}

export function buildVilla(b, B) {
  const F = frameMatrix(b.cx, b.level, b.cz, b.rot)
  const t = b.t
  const W = b.W
  const D = b.D
  const hw = W / 2
  const hd = D / 2
  const up = b.upper
  const g = b.level // world ground level of the platform
  const rnd = mulberry32(b.id.charCodeAt(0) * 31 + b.id.charCodeAt(b.id.length - 1))
  const out = { pools: [], trees: [], lamps: [] }
  const at = (win, extra = {}) => ({ in: win, ground: g, ...extra })

  // Ground level relative to the platform at a local point (for drives, walls, hedges).
  const groundAt = (lx, lz) => {
    const [x, z] = localToWorld(b, lx, lz)
    return gradedHeight(x, z) - g
  }

  // ---------------- Setting-out: pegs and string lines ----------------
  const pegOut = [t.dig[0], t.dig[0] + 0.01]
  const corners = [
    [-hw - 1, -hd - 1],
    [hw + 1, -hd - 1],
    [hw + 1, hd + 1],
    [-hw - 1, hd + 1],
  ]
  corners.forEach(([x, z], i) => {
    const win = stagger(t.setout, i, 4, 2)
    B.timber.box(F, [x - 0.04, -0.8, z - 0.04], [x + 0.04, 0.75, z + 0.04], { ...at(win), out: pegOut })
    const [nx, nz] = corners[(i + 1) % 4]
    const along = Math.abs(nx - x) > Math.abs(nz - z) ? 'x' : 'z'
    B.paint.box(
      F,
      [Math.min(x, nx), 0.55, Math.min(z, nz)],
      [Math.max(x, nx) + (along === 'z' ? 0.012 : 0), 0.562, Math.max(z, nz) + (along === 'x' ? 0.012 : 0)],
      { ...at([win[1], win[1] + 0.01]), axis: along, out: pegOut },
    )
  })

  // ---------------- Footings and hardcore ----------------
  const gridX = stations(-hw + 0.2, hw - 0.2, 6.2)
  const gridZ = [-hd + 0.2, 0, hd - 0.2]
  const footings = []
  for (const z of [-hd + 0.2, hd - 0.2, 0]) footings.push(['x', z])
  for (const x of gridX) footings.push(['z', x])
  footings.forEach(([dir, c], k) => {
    const win = stagger(t.footings, k, footings.length)
    const a = dir === 'x' ? [-hw, -1.0, c - 0.35] : [c - 0.35, -1.0, -hd]
    const c2 = dir === 'x' ? [hw, -0.35, c + 0.35] : [c + 0.35, -0.35, hd]
    B.concrete.box(F, a, c2, { ...at(win), axis: dir })
  })
  B.gravel.box(F, [-hw + 0.1, -0.99, -hd + 0.1], [hw - 0.1, -0.42, hd - 0.1], at(t.fill))

  // Slab-edge formwork: stands while rebar and concrete go in, struck after.
  const edgeOut = [t.pour0[1] + 0.004, t.pour0[1] + 0.014]
  for (const [a, c] of [
    [[-hw - 0.36, -0.4, -hd - 0.36], [hw + 0.36, 0.05, -hd - 0.3]],
    [[-hw - 0.36, -0.4, hd + 0.3], [hw + 0.36, 0.05, hd + 0.36]],
    [[-hw - 0.36, -0.4, -hd - 0.36], [-hw - 0.3, 0.05, hd + 0.36]],
    [[hw + 0.3, -0.4, -hd - 0.36], [hw + 0.36, 0.05, hd + 0.36]],
  ])
    B.formwork.box(F, a, c, { ...at([t.fill[1] - 0.004, t.rebar0[0]]), out: edgeOut })

  // ---------------- Rebar mat, laid bar by bar, then the pour ----------------
  function rebarMat(x0, x1, z0, z1, y, win, spacing) {
    const xs = stations(x0 + 0.15, x1 - 0.15, spacing)
    const zs = stations(z0 + 0.15, z1 - 0.15, spacing)
    const n = xs.length + zs.length
    let k = 0
    for (const z of zs) B.rebar.box(F, [x0 + 0.1, y, z - 0.012], [x1 - 0.1, y + 0.024, z + 0.012], { ...at(stagger(win, k++, n, 6)), axis: 'x' })
    for (const x of xs) B.rebar.box(F, [x - 0.012, y + 0.026, z0 + 0.1], [x + 0.012, y + 0.05, z1 - 0.1], { ...at(stagger(win, k++, n, 6)), axis: 'z' })
  }
  rebarMat(-hw - 0.3, hw + 0.3, -hd - 0.3, hd + 0.3, -0.22, t.rebar0, 0.45)
  B.concrete.box(F, [-hw - 0.3, -0.35, -hd - 0.3], [hw + 0.3, 0, hd + 0.3], { ...at(t.pour0), axis: 'x', dir: b.flip }, { bevel: 0.02 })

  // ---------------- Pool shell (cast with the foundations) ----------------
  const P = b.pool
  const poolDepth = b.hero ? 0 : -1.45
  const rim = b.hero ? 0.32 : 0.02
  if (b.hero) {
    B.concrete.box(F, [P.x0, -0.05, P.z0], [P.x1, 0.03, P.z1], at(t.poolShell))
  } else {
    B.concrete.box(F, [P.x0 - 0.25, poolDepth - 0.25, P.z0 - 0.25], [P.x1 + 0.25, poolDepth, P.z1 + 0.25], { ...at(t.poolShell), axis: 'x' })
  }
  const poolWalls = [
    [[P.x0 - 0.25, poolDepth, P.z0 - 0.25], [P.x1 + 0.25, rim, P.z0]],
    [[P.x0 - 0.25, poolDepth, P.z1], [P.x1 + 0.25, rim, P.z1 + 0.25]],
    [[P.x0 - 0.25, poolDepth, P.z0], [P.x0, rim, P.z1]],
    [[P.x1, poolDepth, P.z0], [P.x1 + 0.25, rim, P.z1]],
  ]
  poolWalls.forEach(([a, c], k) => B.concrete.box(F, a, c, at(stagger(t.poolShell, k + 1, 5, 2))))
  // Mosaic lining and stone coping
  const tileIn = 0.02
  B.tile.box(F, [P.x0, poolDepth, P.z0], [P.x1, poolDepth + tileIn, P.z1], { ...at(t.tiles), axis: 'x' })
  for (const [a, c] of [
    [[P.x0, poolDepth, P.z0], [P.x1, rim - 0.04, P.z0 + tileIn]],
    [[P.x0, poolDepth, P.z1 - tileIn], [P.x1, rim - 0.04, P.z1]],
    [[P.x0, poolDepth, P.z0], [P.x0 + tileIn, rim - 0.04, P.z1]],
    [[P.x1 - tileIn, poolDepth, P.z0], [P.x1, rim - 0.04, P.z1]],
  ])
    B.tile.box(F, a, c, at(t.tiles))
  for (const [a, c] of [
    [[P.x0 - 0.45, rim, P.z0 - 0.45], [P.x1 + 0.45, rim + 0.05, P.z0]],
    [[P.x0 - 0.45, rim, P.z1], [P.x1 + 0.45, rim + 0.05, P.z1 + 0.45]],
    [[P.x0 - 0.45, rim, P.z0], [P.x0, rim + 0.05, P.z1]],
    [[P.x1, rim, P.z0], [P.x1 + 0.45, rim + 0.05, P.z1]],
  ])
    B.coping.box(F, a, c, at(t.coping), { bevel: 0.012 })
  out.pools.push({
    frame: F,
    x0: P.x0,
    x1: P.x1,
    z0: P.z0,
    z1: P.z1,
    bottom: poolDepth + tileIn,
    top: rim - 0.07,
    fill: t.water,
  })

  // ---------------- Structure ----------------
  // Columns, ground floor
  const gfCols = []
  for (const x of gridX) for (const z of gridZ) gfCols.push([x, z])
  gfCols.forEach(([x, z], k) =>
    B.concrete.box(F, [x - 0.18, 0, z - 0.18], [x + 0.18, GF_TOP, z + 0.18], at(stagger(t.colsGF, k, gfCols.length, 4)), { bevel: 0.012 }),
  )

  // First slab spans the ground floor and the cantilevered upper volume.
  const s1 = {
    x0: Math.min(-hw - 0.3, up ? up.x0 : Infinity),
    x1: Math.max(hw + 0.3, up ? up.x1 : -Infinity),
    z0: Math.min(-hd - 0.3, up ? up.z0 : Infinity),
    z1: hd + 0.3,
  }
  function propsAndDeck(x0, x1, z0, z1, yBase, yTop, win, outWin) {
    const xs = stations(x0 + 0.4, x1 - 0.4, 1.6)
    const zs = stations(z0 + 0.4, z1 - 0.4, 1.6)
    let k = 0
    const n = xs.length * zs.length
    for (const x of xs)
      for (const z of zs)
        B.prop.box(F, [x - 0.03, yBase, z - 0.03], [x + 0.03, yTop - 0.06, z + 0.03], { ...at([win[0], win[0] + (win[1] - win[0]) * 0.6].map((v, i) => v + (i ? 0 : (k++ / n) * (win[1] - win[0]) * 0.3))), out: outWin })
    B.formwork.box(F, [x0, yTop - 0.06, z0], [x1, yTop, z1], { ...at([win[0] + (win[1] - win[0]) * 0.5, win[1]]), axis: 'x', out: outWin })
  }
  const strikeTop = [t.strike[0] + 0.012, t.strike[1]]
  const strikeBottom = [t.strike[0], t.strike[1] - 0.008]
  propsAndDeck(s1.x0, s1.x1, s1.z0, s1.z1, 0, SLAB1[0], t.form1, strikeBottom)
  rebarMat(s1.x0, s1.x1, s1.z0, s1.z1, SLAB1[0] + 0.12, t.rebar1, 0.55)
  B.concrete.box(F, [s1.x0, SLAB1[0], s1.z0], [s1.x1, SLAB1[1], s1.z1], { ...at(t.pour1), axis: 'x', dir: -b.flip }, { bevel: 0.025 })

  if (up) {
    const ux = stations(up.x0 + 0.25, up.x1 - 0.25, 6)
    const uCols = []
    for (const x of ux) for (const z of [up.z0 + 0.25, up.z1 - 0.25]) uCols.push([x, z])
    uCols.forEach(([x, z], k) =>
      B.concrete.box(F, [x - 0.17, SLAB1[1], z - 0.17], [x + 0.17, UF_TOP, z + 0.17], at(stagger(t.colsUF, k, uCols.length, 4)), { bevel: 0.012 }),
    )
    const r = { x0: up.x0 - 0.5, x1: up.x1 + 0.5, z0: up.z0 - 0.5, z1: up.z1 + 0.5 }
    propsAndDeck(up.x0, up.x1, up.z0, up.z1, SLAB1[1], ROOF[0], t.form2, strikeTop)
    rebarMat(r.x0, r.x1, r.z0, r.z1, ROOF[0] + 0.12, t.rebar2, 0.6)
    B.concrete.box(F, [r.x0, ROOF[0], r.z0], [r.x1, ROOF[1], r.z1], { ...at(t.pour2), axis: 'x', dir: b.flip }, { bevel: 0.025 })
  }

  // ---------------- Envelope ----------------
  // A facade is a run of segments along one edge: 'solid' (blockwork + skin) or 'glass'.
  // side: which local axis the wall runs along, and where its outer face is.
  let glassIndex = 0
  const glassCount = 40
  function facade({ along, at: c, outward, from, to, y0, y1, segments, skin }) {
    const T = 0.24
    const inner = c - outward * T
    const box = (batch, a0, a1, d0, d1, ya, yb, when, opts) => {
      const lo = Math.min(d0, d1)
      const hi = Math.max(d0, d1)
      if (along === 'x') batch.box(F, [a0, ya, lo], [a1, yb, hi], when, opts)
      else batch.box(F, [lo, ya, a0], [hi, yb, a1], when, opts)
    }
    for (const [s0, s1, kind] of segments(from, to)) {
      if (kind === 'solid') {
        box(B.block, s0, s1, c, inner, y0, y1, at(t.block))
        const skinWin = skin === 'stone' ? t.stone : t.render
        const skinBatch = skin === 'stone' ? B.stone : B.render
        box(skinBatch, s0, s1, c, c + outward * (skin === 'stone' ? 0.05 : 0.025), y0, y1, at(skinWin))
      } else {
        // Frames first, then a glass panel per bay, then the room behind.
        const bays = stations(s0, s1, 2.6)
        for (let i = 0; i < bays.length; i++) {
          box(B.metal, bays[i] - 0.035, bays[i] + 0.035, c - outward * 0.02, c - outward * 0.14, y0, y1, at(t.frames))
          if (i < bays.length - 1) {
            const win = stagger(t.glass, glassIndex++ % glassCount, glassCount, 5)
            box(B.glass, bays[i] + 0.035, bays[i + 1] - 0.035, c - outward * 0.07, c - outward * 0.09, y0 + 0.06, y1 - 0.04, { ...at(win), axis: 'y' })
          }
        }
        box(B.metal, s0, s1, c - outward * 0.02, c - outward * 0.14, y0, y0 + 0.06, at(t.frames))
        box(B.metal, s0, s1, c - outward * 0.02, c - outward * 0.14, y1 - 0.06, y1, at(t.frames))
        // Room interior: a lit plane set back from the glazing, plus the floor finish.
        const depth = 3.6
        const rooms = stations(s0 + 0.1, s1 - 0.1, 6.5)
        for (let i = 0; i < rooms.length - 1; i++)
          box(B.interior, rooms[i], rooms[i + 1], c - outward * depth, c - outward * (depth + 0.02), y0 + 0.02, y1 - 0.02, at(t.interior))
      }
    }
  }
  const solid = (a, b2) => [[a, b2, 'solid']]
  const glass = (a, b2) => [[a, b2, 'glass']]

  // Ground floor
  const ex = b.entranceX
  facade({
    along: 'x', at: hd, outward: 1, from: -hw, to: hw, y0: 0, y1: GF_TOP, skin: 'stone',
    // The hero villa opens its ground floor to the arrival court; the others keep a private stone front.
    segments: b.hero
      ? (a, c) => [[a, a + 1.2, 'solid'], [a + 1.2, c - 1.2, 'glass'], [c - 1.2, c, 'solid']]
      : (a, c) => [[a, ex - 1.7, 'solid'], [ex - 1.7, ex + 1.7, 'glass'], [ex + 1.7, c, 'solid']].map(([s, e, k]) => [Math.min(s, e), Math.max(s, e), k]).filter(([s, e]) => e - s > 0.3),
  })
  facade({
    along: 'x', at: -hd, outward: -1, from: -hw, to: hw, y0: 0, y1: GF_TOP, skin: 'render',
    segments: (a, c) => [[a, a + 0.7, 'solid'], [a + 0.7, c - 0.7, 'glass'], [c - 0.7, c, 'solid']],
  })
  facade({ along: 'z', at: -hw, outward: -1, from: -hd + 0.24, to: hd - 0.24, y0: 0, y1: GF_TOP, skin: b.flip > 0 ? 'render' : 'stone', segments: solid })
  facade({
    along: 'z', at: hw, outward: 1, from: -hd + 0.24, to: hd - 0.24, y0: 0, y1: GF_TOP, skin: 'render',
    segments: b.club ? glass : solid,
  })

  if (up) {
    facade({ along: 'x', at: up.z0, outward: -1, from: up.x0, to: up.x1, y0: SLAB1[1], y1: UF_TOP, skin: 'render', segments: (a, c) => [[a, a + 0.5, 'solid'], [a + 0.5, c - 0.5, 'glass'], [c - 0.5, c, 'solid']] })
    facade({
      along: 'x', at: up.z1, outward: 1, from: up.x0, to: up.x1, y0: SLAB1[1], y1: UF_TOP, skin: 'render',
      segments: (a, c) => [[a, a + (c - a) * 0.18, 'solid'], [a + (c - a) * 0.18, a + (c - a) * 0.62, 'glass'], [a + (c - a) * 0.62, c, 'solid']],
    })
    // The cantilevered end is fully glazed; the other end is solid.
    const cantEnd = b.flip > 0 ? up.x1 : up.x0
    const otherEnd = b.flip > 0 ? up.x0 : up.x1
    facade({ along: 'z', at: cantEnd, outward: b.flip, from: up.z0 + 0.24, to: up.z1 - 0.24, y0: SLAB1[1], y1: UF_TOP, skin: 'render', segments: glass })
    facade({ along: 'z', at: otherEnd, outward: -b.flip, from: up.z0 + 0.24, to: up.z1 - 0.24, y0: SLAB1[1], y1: UF_TOP, skin: 'render', segments: solid })

    // Oak fins shading the garden glazing
    const fins = stations(up.x0 + 0.6, up.x1 - 0.6, 0.55)
    fins.forEach((x, k) =>
      B.timber.box(F, [x - 0.03, SLAB1[1] + 0.02, up.z0 - 0.42], [x + 0.03, UF_TOP - 0.02, up.z0 - 0.14], at(stagger(t.timber, k, fins.length, 6)), { bevel: 0.008 }),
    )
  }

  // Oak soffit under every overhang of the first slab, with downlights.
  const soffits = []
  if (s1.x0 < -hw - 0.31) soffits.push([s1.x0, -hw, s1.z0, s1.z1])
  if (s1.x1 > hw + 0.31) soffits.push([hw, s1.x1, s1.z0, s1.z1])
  soffits.push([-hw, hw, hd, s1.z1])
  if (s1.z0 < -hd - 0.31) soffits.push([-hw, hw, s1.z0, -hd])
  soffits.forEach(([x0, x1, z0, z1]) => {
    B.timber.box(F, [x0, SLAB1[0] - 0.04, z0], [x1, SLAB1[0], z1], { ...at(t.timber), axis: 'x' })
    for (const x of stations(x0 + 0.6, x1 - 0.6, 2.2))
      for (const z of stations(z0 + 0.3, z1 - 0.3, 2.2)) B.lamp.box(F, [x - 0.06, SLAB1[0] - 0.05, z - 0.06], [x + 0.06, SLAB1[0] - 0.04, z + 0.06], at(t.lights))
  })

  // Parapets and stone coping on the roofs
  function parapet(x0, x1, z0, z1, y) {
    const h = 0.55
    const edges = [
      [[x0, y, z0], [x1, y + h, z0 + 0.22]],
      [[x0, y, z1 - 0.22], [x1, y + h, z1]],
      [[x0, y, z0], [x0 + 0.22, y + h, z1]],
      [[x1 - 0.22, y, z0], [x1, y + h, z1]],
    ]
    for (const [a, c] of edges) {
      B.block.box(F, a, c, at(t.block))
      B.render.box(F, [a[0] - 0.02, a[1], a[2] - 0.02], [c[0] + 0.02, c[1], c[2] + 0.02], at(t.render))
      B.coping.box(F, [a[0] - 0.05, y + h, a[2] - 0.05], [c[0] + 0.05, y + h + 0.06, c[2] + 0.05], at(t.coping), { bevel: 0.01 })
    }
  }
  if (up) parapet(up.x0 - 0.5, up.x1 + 0.5, up.z0 - 0.5, up.z1 + 0.5, ROOF[1])
  else parapet(s1.x0, s1.x1, s1.z0, s1.z1, SLAB1[1])

  // ---------------- Landscape ----------------
  // Terrace around the pool (or behind the house for the hero villa)
  const deck = (x0, x1, z0, z1) => B.paver.box(F, [x0, -0.04, z0], [x1, 0.05, z1], { ...at(t.deck), axis: 'x' })
  if (b.hero) {
    deck(-hw, hw, -hd - 4, -hd - 0.3)
    deck(P.x0 - 1.2, P.x0 - 0.45, P.z0, P.z1)
  } else {
    deck(P.x0 - 1.2, P.x1 + 1.2, P.z1 + 0.45, -hd - 0.3)
    deck(P.x0 - 1.2, P.x1 + 1.2, P.z0 - 1.6, P.z0 - 0.45)
    deck(P.x0 - 1.2, P.x0 - 0.45, P.z0 - 0.45, P.z1 + 0.45)
    deck(P.x1 + 0.45, P.x1 + 1.2, P.z0 - 0.45, P.z1 + 0.45)
  }

  // Driveway: pavers laid from the road towards the house, following the ground.
  const driveSteps = stations(hd + 0.3, b.roadLocalZ + 0.5, 2)
  for (let i = 0; i < driveSteps.length - 1; i++) {
    const za = driveSteps[i]
    const zb = driveSteps[i + 1]
    const y = Math.max(groundAt(ex, (za + zb) / 2), -0.6)
    const win = stagger(t.drive, driveSteps.length - 2 - i, driveSteps.length - 1, 3)
    B.paver.box(F, [ex - 2.4, y - 0.12, za], [ex + 2.4, y + 0.05, zb + 0.02], at(win))
    // Bollard lights along the drive
    if (i % 2 === 0)
      for (const s of [-1, 1]) {
        const x = ex + s * 2.9
        B.metal.box(F, [x - 0.07, y, (za + zb) / 2 - 0.07], [x + 0.07, y + 0.75, (za + zb) / 2 + 0.07], at(t.lights))
        B.lamp.box(F, [x - 0.075, y + 0.6, (za + zb) / 2 - 0.075], [x + 0.075, y + 0.68, (za + zb) / 2 + 0.075], at(t.lights))
      }
  }

  // Boundary walls (stone) along the plot sides, stepping with the ground
  for (const x of [b.plot.x0 + 0.2, b.plot.x1 - 0.2]) {
    const steps = stations(b.plot.z0 + 0.5, b.roadLocalZ - 4.6, 3)
    for (let i = 0; i < steps.length - 1; i++) {
      const za = steps[i]
      const zb = steps[i + 1]
      const y = groundAt(x, (za + zb) / 2)
      B.stone.box(F, [x - 0.16, y - 0.5, za], [x + 0.16, y + 1.15, zb], at(stagger(t.walls, i, steps.length, 4)), { bevel: 0.01 })
      B.coping.box(F, [x - 0.2, y + 1.15, za], [x + 0.2, y + 1.2, zb], at(stagger(t.walls, i + 1, steps.length, 4)))
    }
  }

  // Clipped hedges along the street edge, either side of the drive
  for (const [a, c] of [
    [b.plot.x0 + 0.6, ex - 3.4],
    [ex + 3.4, b.plot.x1 - 0.6],
  ]) {
    const segs = stations(Math.min(a, c), Math.max(a, c), 3)
    for (let i = 0; i < segs.length - 1; i++) {
      const z = b.roadLocalZ - 4.4
      const y = groundAt((segs[i] + segs[i + 1]) / 2, z)
      B.hedge.box(F, [segs[i], y - 0.3, z - 0.45], [segs[i + 1], y + 1.15, z + 0.45], at(stagger(t.hedges, i, segs.length, 4)), { bevel: 0.15 })
    }
  }

  // Garden trees: olives on the terrace side and a specimen tree by the entrance
  const treeSpots = [
    [P.x0 - 4 * b.flip, P.z0 - 3],
    [P.x1 + 3.5 * b.flip, P.z0 - 4.5],
    [hw + 4.5, -hd - 3],
    [ex + 5.5, hd + 7],
    [-ex * 0.6, b.roadLocalZ - 6],
  ]
  treeSpots.forEach(([lx, lz], k) => {
    const [x, z] = localToWorld(b, lx, lz)
    const win = stagger(t.trees, k, treeSpots.length, 3)
    out.trees.push({ x, z, y: gradedHeight(x, z), s: 0.85 + rnd() * 0.35, rot: rnd() * Math.PI * 2, kind: k === 3 ? 'oak' : 'olive', grow: win })
  })

  out.anchor = new THREE.Vector3(b.cx, b.level, b.cz)
  return out
}
