// Estate infrastructure and temporary works: road build-up, kerbs, verges, footpaths,
// street lighting, the entrance, hoarding, the contractor's compound and the tower crane.

import * as THREE from 'three'
import { Batch } from './batch.js'
import { BUILDINGS, gradedHeight, naturalHeight, NEVER, ROAD, roadLevel, SITE, WORKS } from './plan.js'
import { span } from './util.js'

// A thin slab following the road's long section: top, bottom and side faces.
function roadStrip(x0, x1, zFrom, zTo, top, thickness, step = 2) {
  const zs = []
  const n = Math.max(1, Math.round(Math.abs(zTo - zFrom) / step))
  for (let i = 0; i <= n; i++) zs.push(zFrom + ((zTo - zFrom) * i) / n)
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  // Quad a-b-c-d (a/b first edge, c/d second); winding is fixed to face `normal`.
  const quad = (a, b, c, d, normal) => {
    const base = pos.length / 3
    for (const v of [a, b, c, d]) {
      pos.push(...v)
      nor.push(...normal)
      uv.push(0, 0)
    }
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const e2 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const cx = e1[1] * e2[2] - e1[2] * e2[1]
    const cy = e1[2] * e2[0] - e1[0] * e2[2]
    const cz = e1[0] * e2[1] - e1[1] * e2[0]
    const facing = cx * normal[0] + cy * normal[1] + cz * normal[2] >= 0
    if (facing) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }
  for (let i = 0; i < zs.length - 1; i++) {
    const za = zs[i]
    const zb = zs[i + 1]
    const ya = top(za)
    const yb = top(zb)
    quad([x0, ya, za], [x1, ya, za], [x0, yb, zb], [x1, yb, zb], [0, 1, 0])
    // sides
    quad([x0, ya - thickness, za], [x0, ya, za], [x0, yb - thickness, zb], [x0, yb, zb], [-1, 0, 0])
    quad([x1, ya, za], [x1, ya - thickness, za], [x1, yb, zb], [x1, yb - thickness, zb], [1, 0, 0])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

function flatRing(inner, outer, segments = 64) {
  const g = new THREE.RingGeometry(inner, outer, segments, 1)
  g.rotateX(-Math.PI / 2)
  return g
}

// Driveway crossings on the spine: footpaths, trees and lights leave a gap there.
function driveCrossings() {
  return BUILDINGS.filter((b) => !b.hero).map((b) => ({ side: Math.sign(b.cx), z: b.driveRect.cz, half: b.driveRect.hd + 1.4 }))
}

function blocked(crossings, side, z, pad = 0) {
  return crossings.some((c) => c.side === side && Math.abs(z - c.z) < c.half + pad)
}

export function buildSite(B, uniforms, materials) {
  const at = (win, extra = {}) => ({ in: win, ...extra })
  const crossings = driveCrossings()
  const C = ROAD.circle
  const spineTo = C.z + 6
  const roadTop = (z) => roadLevel(z)
  const out = { trees: [], lamps: [], meshes: [], update: [] }

  // ---------------- Survey: centreline stakes ----------------
  for (let z = ROAD.z0 - 4; z > C.z; z -= 12) {
    const y = naturalHeight(0, z)
    const win = [0.03 + ((ROAD.z0 - z) / 260) * 0.03, 0.045 + ((ROAD.z0 - z) / 260) * 0.03]
    const gone = [WORKS.roadGrade[0] + ((ROAD.z0 - z) / 260) * 0.06, WORKS.roadGrade[0] + ((ROAD.z0 - z) / 260) * 0.06 + 0.006]
    B.timber.box(null, [-0.04, y - 0.5, z - 0.04], [0.04, y + 0.7, z + 0.04], at(win, { out: gone, ground: y }))
    B.paint.box(null, [-0.05, y + 0.58, z - 0.05], [0.05, y + 0.68, z + 0.05], at(win, { out: gone, ground: y }))
  }

  // ---------------- Road build-up ----------------
  // Subbase: crushed stone over the whole corridor, laid from the entrance northwards.
  const sub = WORKS.subbase
  const subSpine = [sub[0], sub[1] - 0.012]
  B.gravel.add(roadStrip(-ROAD.pathOuter, ROAD.pathOuter, ROAD.z0 + 2, spineTo, (z) => roadTop(z) - 0.06, 0.3), new THREE.Matrix4(), at(subSpine, { axis: 'z', dir: -1, ground: roadTop(0) }))
  const yC = roadLevel(C.z)
  const ringSub = flatRing(ROAD.island, C.r + 2.6)
  B.gravel.add(ringSub, new THREE.Matrix4().makeTranslation(C.x, yC - 0.06, C.z), at([sub[1] - 0.014, sub[1]], { axis: 'z', dir: -1, ground: yC }))

  // Kerbs
  for (const s of [-1, 1]) {
    const x = s * ROAD.halfWidth
    B.coping.add(roadStrip(Math.min(x, x + s * 0.18), Math.max(x, x + s * 0.18), ROAD.z0 + 2, spineTo + 3, (z) => roadTop(z) + 0.12, 0.4), new THREE.Matrix4(), at(WORKS.kerbs, { axis: 'z', dir: -1, ground: roadTop(0) }))
  }
  const islandKerb = new THREE.CylinderGeometry(ROAD.island + 0.18, ROAD.island + 0.18, 0.3, 48, 1, true)
  B.coping.add(islandKerb, new THREE.Matrix4().makeTranslation(C.x, yC + 0.02, C.z), at([WORKS.kerbs[1] - 0.006, WORKS.kerbs[1]], { ground: yC }))
  const outerKerb = new THREE.CylinderGeometry(C.r + 0.1, C.r + 0.1, 0.3, 64, 1, true)
  B.coping.add(outerKerb, new THREE.Matrix4().makeTranslation(C.x, yC + 0.02, C.z), at([WORKS.kerbs[1] - 0.006, WORKS.kerbs[1]], { ground: yC }))

  // Asphalt: the paving front advances along the spine, then round the circle.
  const asp = WORKS.asphalt
  B.asphalt.add(roadStrip(-ROAD.halfWidth, ROAD.halfWidth, ROAD.z0 + 2, spineTo, (z) => roadTop(z) + 0.02, 0.1), new THREE.Matrix4(), at([asp[0], asp[1] - 0.008], { axis: 'z', dir: -1, ground: roadTop(0) }))
  B.asphalt.add(flatRing(ROAD.island + 0.2, C.r), new THREE.Matrix4().makeTranslation(C.x, yC + 0.02, C.z), at([asp[1] - 0.01, asp[1]], { axis: 'z', dir: -1, ground: yC }))

  // Footpaths (pavers), interrupted by driveways
  for (const s of [-1, 1]) {
    let zStart = ROAD.z0 + 2
    const stops = crossings.filter((c) => c.side === s).sort((a, b) => b.z - a.z)
    const runs = []
    for (const c of stops) {
      runs.push([zStart, c.z + c.half])
      zStart = c.z - c.half
    }
    runs.push([zStart, spineTo + 3])
    for (const [za, zb] of runs) {
      if (za - zb < 1) continue
      const x0 = s > 0 ? ROAD.verge : -ROAD.pathOuter
      const x1 = s > 0 ? ROAD.pathOuter : -ROAD.verge
      const f = (ROAD.z0 - za) / (ROAD.z0 - spineTo)
      const win = [WORKS.paths[0] + f * 0.025, WORKS.paths[0] + f * 0.025 + 0.014]
      B.paver.add(roadStrip(x0, x1, za, zb, (z) => roadTop(z) + 0.1, 0.25), new THREE.Matrix4(), at(win, { axis: 'z', dir: -1, ground: roadTop(za) }))
    }
  }

  // ---------------- Avenue: cypress and street lights in the verge ----------------
  const vergeX = (ROAD.halfWidth + ROAD.verge) / 2
  let lightIndex = 0
  for (let z = ROAD.z0 - 8; z > spineTo + 4; z -= 13) {
    for (const s of [-1, 1]) {
      if (blocked(crossings, s, z, 1.5)) continue
      const x = s * vergeX
      const y = roadTop(z) + 0.1
      const isLight = (Math.round((ROAD.z0 - z) / 13) + (s > 0 ? 1 : 0)) % 2 === 0
      const f = (ROAD.z0 - z) / (ROAD.z0 - spineTo)
      if (isLight) {
        const win = [WORKS.streetLights[0] + f * 0.02, WORKS.streetLights[0] + f * 0.02 + 0.008]
        B.metal.box(null, [x - 0.07, y, z - 0.07], [x + 0.07, y + 5.6, z + 0.07], at(win, { ground: y }))
        B.metal.box(null, [x - s * 1.1, y + 5.5, z - 0.06], [x + s * 0.05, y + 5.62, z + 0.06], at([win[1] - 0.002, win[1]], { ground: y, axis: 'x' }))
        B.lamp.box(null, [x - s * 1.15 - 0.22, y + 5.42, z - 0.12], [x - s * 1.15 + 0.22, y + 5.5, z + 0.12], at([win[1] - 0.001, win[1]], { ground: y }))
        out.lamps.push(new THREE.Vector3(x - s * 1.15, y + 5.4, z))
        lightIndex++
      } else {
        out.trees.push({ x, z, y, s: 0.9 + ((z * 7.31) % 1 + 1) % 1 * 0.25, rot: z, kind: 'cypress', grow: [WORKS.avenue[0] + f * 0.03, WORKS.avenue[0] + f * 0.03 + 0.02] })
      }
    }
  }
  // Specimen olive on the island: low enough to keep the view down the avenue to the hero villa
  out.trees.push({ x: C.x, z: C.z, y: yC, s: 1.35, rot: 0.4, kind: 'olive', grow: [WORKS.avenue[1] - 0.02, WORKS.avenue[1]] })

  // ---------------- Entrance ----------------
  const gz = ROAD.z0 - 22
  for (const s of [-1, 1]) {
    const x0 = s * (ROAD.pathOuter + 1)
    const x1 = s * (ROAD.pathOuter + 14)
    const y = roadTop(gz)
    B.stone.box(null, [Math.min(x0, x1), y - 0.4, gz - 0.35], [Math.max(x0, x1), y + 2.2, gz + 0.35], at(WORKS.gate, { ground: y, axis: 'x', dir: s }), { bevel: 0.015 })
    B.coping.box(null, [Math.min(x0, x1) - 0.05, y + 2.2, gz - 0.4], [Math.max(x0, x1) + 0.05, y + 2.28, gz + 0.4], at([WORKS.gate[1] - 0.006, WORKS.gate[1]], { ground: y }))
    // Bronze name plate on the west wall
    if (s < 0) B.bronze.box(null, [x0 - 6.5, y + 0.9, gz + 0.35], [x0 - 1.5, y + 1.6, gz + 0.4], at([WORKS.gate[1], WORKS.gate[1] + 0.006], { ground: y }))
  }

  // ---------------- Hoarding around the site ----------------
  const hoard = WORKS.hoarding
  const perimeter = []
  const addRun = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(len / 3))
    for (let i = 0; i < n; i++) {
      const t0 = i / n
      const t1 = (i + 1) / n
      perimeter.push([ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1])
    }
  }
  const gap = ROAD.pathOuter + 1.5
  addRun(-gap, SITE.z1, SITE.x0, SITE.z1)
  addRun(SITE.x0, SITE.z1, SITE.x0, SITE.z0)
  addRun(SITE.x0, SITE.z0, SITE.x1, SITE.z0)
  addRun(SITE.x1, SITE.z0, SITE.x1, SITE.z1)
  addRun(SITE.x1, SITE.z1, gap, SITE.z1)
  perimeter.forEach(([ax, az, bx, bz], k) => {
    const f = k / perimeter.length
    const inWin = [hoard.in[0] + f * (hoard.in[1] - hoard.in[0] - 0.006), hoard.in[0] + f * (hoard.in[1] - hoard.in[0] - 0.006) + 0.006]
    const outWin = [hoard.out[0] + f * 0.024, hoard.out[0] + f * 0.024 + 0.006]
    const y = Math.min(naturalHeight(ax, az), naturalHeight(bx, bz))
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az)
    const lo = [Math.min(ax, bx), y - 0.2, Math.min(az, bz)]
    const hi = [Math.max(ax, bx), y + 2.4, Math.max(az, bz)]
    if (alongX) {
      lo[2] -= 0.03
      hi[2] += 0.03
    } else {
      lo[0] -= 0.03
      hi[0] += 0.03
    }
    B.hoarding.box(null, lo, hi, at(inWin, { out: outWin, ground: y }))
    B.metal.box(null, [ax - 0.05, y - 0.2, az - 0.05], [ax + 0.05, y + 2.5, az + 0.05], at(inWin, { out: outWin, ground: y }))
  })

  // ---------------- Contractor's compound ----------------
  const cab = WORKS.cabins
  const cy = gradedHeight(cab.rect.cx, cab.rect.cz)
  const cabins = [
    [cab.rect.cx - 6, cab.rect.cz - 2, 0],
    [cab.rect.cx + 1, cab.rect.cz - 2, 0],
    [cab.rect.cx - 6, cab.rect.cz - 2, 2.75],
  ]
  cabins.forEach(([x, z, lift], k) => {
    const win = [cab.in[0] + k * 0.006, cab.in[0] + k * 0.006 + 0.01]
    const outWin = [cab.out[0] + (2 - k) * 0.005, cab.out[0] + (2 - k) * 0.005 + 0.01]
    B.cabin.box(null, [x, cy + lift, z], [x + 6, cy + lift + 2.6, z + 2.5], at(win, { out: outWin, ground: cy }), { bevel: 0.03 })
    for (const wx of [x + 1, x + 3.6]) B.glass.box(null, [wx, cy + lift + 1, z + 2.5], [wx + 1.4, cy + lift + 2, z + 2.53], at([win[1] - 0.002, win[1]], { out: outWin, ground: cy }))
  })

  // ---------------- Tower crane ----------------
  const cr = WORKS.crane
  const cbase = gradedHeight(cr.x, cr.z)
  const MAST = 40
  const S = 0.8 // half the mast section
  B.concrete.box(null, [cr.x - 3, cbase - 1.2, cr.z - 3], [cr.x + 3, cbase + 0.3, cr.z + 3], at([cr.mast[0] - 0.012, cr.mast[0]], { out: [cr.mastOut[1], cr.mastOut[1] + 0.008], ground: cbase }))
  const mastRange = [cbase + 0.3, cbase + MAST]
  const mastWin = { in: cr.mast, out: cr.mastOut, ground: cbase, range: mastRange }
  for (const [dx, dz] of [[-S, -S], [S, -S], [S, S], [-S, S]])
    B.crane.box(null, [cr.x + dx - 0.07, cbase + 0.3, cr.z + dz - 0.07], [cr.x + dx + 0.07, cbase + MAST, cr.z + dz + 0.07], { ...mastWin, ground: cbase })
  for (let y = 0.3; y < MAST; y += 2) {
    for (const [ax, az, bx, bz] of [[-S, -S, S, -S], [S, -S, S, S], [S, S, -S, S], [-S, S, -S, -S]]) {
      const mx = (ax + bx) / 2
      const mz = (az + bz) / 2
      const along = Math.abs(bx - ax) > 0.1 ? 'x' : 'z'
      const half = [along === 'x' ? S : 0.04, 0.04, along === 'z' ? S : 0.04]
      // horizontal
      B.crane.box(null, [cr.x + mx - half[0], cbase + y - 0.04, cr.z + mz - half[2]], [cr.x + mx + half[0], cbase + y + 0.04, cr.z + mz + half[2]], mastWin)
      // diagonal brace
      const diag = new THREE.BoxGeometry(along === 'x' ? 2.4 : 0.06, 0.06, along === 'z' ? 2.4 : 0.06)
      const m = new THREE.Matrix4()
        .makeTranslation(cr.x + mx, cbase + y + 1, cr.z + mz)
        .multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(along === 'x' ? 0 : 1, 0, along === 'x' ? 1 : 0), Math.atan2(2, 1.6) * (along === 'x' ? 1 : -1)))
      B.crane.add(diag, m, mastWin)
    }
  }

  // Slewing part: its own batch so it can rotate about the mast.
  const JIB = 46
  const CJ = 13
  const slewMat = materials.crane
  const slew = new Batch('crane-slew', slewMat, materials.depth)
  const jibWin = { in: cr.jib, out: cr.jibOut, ground: cbase, axis: 'x', range: [-0.5, JIB] }
  const counterWin = { ...jibWin, range: [-CJ, 0], dir: -1 }
  const headWin = { in: cr.jib, out: cr.jibOut, ground: cbase }
  slew.box(null, [-1.1, 0, -1.1], [1.1, 1.2, 1.1], headWin)
  slew.box(null, [0.6, 1.2, 0.6], [2.4, 3.4, 2.2], headWin) // cab
  for (const z of [-0.6, 0.6]) slew.box(null, [-0.5, 1.2, z - 0.06], [JIB, 1.32, z + 0.06], jibWin)
  slew.box(null, [-0.5, 2.6, -0.06], [JIB * 0.9, 2.7, 0.06], jibWin)
  for (let x = 0; x < JIB; x += 2.2) {
    slew.box(null, [x, 1.2, -0.62], [x + 0.08, 2.65, -0.54], jibWin)
    slew.box(null, [x, 1.2, 0.54], [x + 0.08, 2.65, 0.62], jibWin)
  }
  for (const z of [-0.6, 0.6]) slew.box(null, [-CJ, 1.2, z - 0.07], [0, 1.34, z + 0.07], counterWin)
  slew.box(null, [-CJ + 0.4, 0.2, -1], [-CJ + 3.4, 2.6, 1], counterWin) // counterweights
  slew.box(null, [-0.3, 1.2, -0.3], [0.3, 8, 0.3], headWin) // tower head
  // Hook block hangs from a trolley; it moves along the jib with progress.
  const trolley = new Batch('crane-trolley', slewMat, materials.depth)
  const hookWin = { in: [cr.jib[1] - 0.004, cr.jib[1]], out: [cr.jibOut[0] - 0.004, cr.jibOut[0]], ground: cbase }
  trolley.box(null, [-0.6, 0.9, -0.7], [0.6, 1.2, 0.7], hookWin)
  trolley.box(null, [-0.015, -16, -0.015], [0.015, 0.9, 0.015], hookWin)
  trolley.box(null, [-0.3, -16.8, -0.3], [0.3, -16, 0.3], hookWin)
  const slewMesh = slew.toMesh()
  const trolleyMesh = trolley.toMesh()
  const head = new THREE.Group()
  head.position.set(cr.x, cbase + MAST, cr.z)
  head.add(slewMesh, trolleyMesh)
  out.meshes.push(head)
  out.update.push((p) => {
    // Slew between lifts; trolley travels in and out. Smooth, deterministic functions of p.
    const work = span(p, cr.jib[1], cr.jibOut[0])
    head.rotation.y = 0.6 + work * Math.PI * 5.2 + Math.sin(work * 37) * 0.25
    trolleyMesh.position.x = 14 + 18 * (0.5 + 0.5 * Math.sin(work * 23))
  })
  out.crane = { x: cr.x, z: cr.z, base: cbase, top: cbase + MAST + 8, jib: JIB }
  return out
}

export { NEVER }
