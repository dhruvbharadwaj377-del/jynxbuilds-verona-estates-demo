// Construction machinery: properly articulated (every moving part pivots on its parent),
// and moved along explicit routes whose timing comes from the master plan.
// Positions and poses are pure functions of progress, so reversing works.

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BUILDINGS, driveHeight, ENTRY, excavatorStation, localToWorld, machineVisits } from './plan.js'
import { clamp01, lerp, smooth } from './util.js'

function makeMaterials() {
  return {
    paint: new THREE.MeshStandardMaterial({ color: '#d9a21b', roughness: 0.42, metalness: 0.15 }),
    paintDark: new THREE.MeshStandardMaterial({ color: '#2c2c2a', roughness: 0.6, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: '#77736c', roughness: 0.45, metalness: 0.75 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1b1b1a', roughness: 0.92 }),
    glass: new THREE.MeshStandardMaterial({ color: '#1d2a30', roughness: 0.06, metalness: 0.6, envMapIntensity: 1.6 }),
    white: new THREE.MeshStandardMaterial({ color: '#e9e7e1', roughness: 0.4, metalness: 0.1 }),
    drum: new THREE.MeshStandardMaterial({ color: '#d8d4cb', roughness: 0.35, metalness: 0.35 }),
  }
}

function rbox(w, h, d, r = 0.05) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
}

function add(parent, geo, mat, [x, y, z] = [0, 0, 0], rot) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  if (rot) m.rotation.set(...rot)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

// Merge the meshes of each rigid part by material (one draw call per material per
// moving part), recursing into child groups so the articulation is preserved.
function mergeRigid(group) {
  const byMaterial = new Map()
  for (const child of [...group.children]) {
    if (child.isMesh) {
      child.updateMatrix()
      const g = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(child.matrix)
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
      if (!byMaterial.has(child.material)) byMaterial.set(child.material, [])
      byMaterial.get(child.material).push(g)
      group.remove(child)
    } else if (child.isGroup) mergeRigid(child)
  }
  for (const [material, list] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(list), material)
    list.forEach((g) => g.dispose())
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}

// ---------------------------------------------------------------------------
// Excavator (≈20 t class). Forward is local +z.
// ---------------------------------------------------------------------------

function excavator(M) {
  const root = new THREE.Group()
  // Undercarriage: two tracks with grousers
  for (const s of [-1, 1]) {
    add(root, rbox(0.62, 0.9, 4.4, 0.3), M.rubber, [s * 1.2, 0.45, 0])
    add(root, rbox(0.4, 0.5, 3.4, 0.12), M.paintDark, [s * 1.2, 0.55, 0])
    for (let i = 0; i < 18; i++) add(root, new THREE.BoxGeometry(0.64, 0.05, 0.09), M.steel, [s * 1.2, 0.905, -2.0 + i * 0.235])
  }
  add(root, rbox(1.9, 0.5, 2.2, 0.08), M.paintDark, [0, 0.85, 0])
  // Slewing house
  const house = new THREE.Group()
  house.position.set(0, 1.1, 0)
  root.add(house)
  add(house, rbox(2.6, 1.05, 3.4, 0.12), M.paint, [0, 0.55, -0.35])
  add(house, rbox(2.5, 0.8, 0.9, 0.2), M.paintDark, [0, 0.55, -2.15]) // counterweight
  add(house, rbox(0.95, 1.55, 1.25, 0.08), M.paint, [-0.75, 1.6, 0.75]) // cab
  add(house, new THREE.BoxGeometry(0.85, 1.05, 0.04), M.glass, [-0.75, 1.75, 1.39])
  add(house, new THREE.BoxGeometry(0.04, 1.0, 1.0), M.glass, [-1.23, 1.75, 0.75])
  add(house, new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), M.steel, [0.7, 1.35, -1.2]) // exhaust
  // Boom pivots on the house; stick on the boom; bucket on the stick.
  const boom = new THREE.Group()
  boom.position.set(0.25, 1.05, 1.05)
  house.add(boom)
  const boomLen = 5.4
  const boomA = add(boom, rbox(0.5, 0.62, 3.1, 0.08), M.paint, [0, 0.95, 1.35], [-0.62, 0, 0])
  const boomB = add(boom, rbox(0.46, 0.56, 2.8, 0.08), M.paint, [0, 1.6, 3.95], [0.3, 0, 0])
  void boomA
  void boomB
  add(boom, new THREE.CylinderGeometry(0.09, 0.09, 2.4, 8), M.steel, [0, 0.35, 1.1], [-1.05, 0, 0]) // ram
  const stick = new THREE.Group()
  stick.position.set(0, 1.18, boomLen)
  boom.add(stick)
  add(stick, rbox(0.38, 0.48, 2.9, 0.07), M.paint, [0, 0, 1.3])
  add(stick, new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8), M.steel, [0, 0.42, 0.6], [Math.PI / 2, 0, 0])
  const bucket = new THREE.Group()
  bucket.position.set(0, 0, 2.75)
  stick.add(bucket)
  const shell = new THREE.CylinderGeometry(0.62, 0.62, 1.15, 14, 1, false, 0, Math.PI * 1.15)
  shell.rotateZ(Math.PI / 2)
  add(bucket, shell, M.steel, [0, -0.35, 0.25], [0, 0, 0])
  for (let i = 0; i < 5; i++) add(bucket, new THREE.BoxGeometry(0.08, 0.05, 0.22), M.steel, [-0.46 + i * 0.23, -0.95, 0.62])
  return { root, house, boom, stick, bucket }
}

// One dig cycle: dig → lift → swing to the spoil side → dump → return. c in [0, 1).
const POSES = [
  // [c, swing, boom, stick, bucket]
  [0.0, 0.0, 0.55, 0.65, 0.4],
  [0.3, 0.0, 0.32, 1.25, 1.55],
  [0.42, 0.0, -0.2, 1.05, 1.6],
  [0.58, 1.35, -0.25, 0.85, 1.6],
  [0.72, 1.35, -0.1, 0.55, -0.5],
  [0.88, 0.5, 0.2, 0.6, 0.0],
  [1.0, 0.0, 0.55, 0.65, 0.4],
]
function pose(c) {
  let i = 0
  while (i < POSES.length - 2 && c > POSES[i + 1][0]) i++
  const a = POSES[i]
  const b = POSES[i + 1]
  const t = smooth(clamp01((c - a[0]) / (b[0] - a[0])))
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t)]
}

// ---------------------------------------------------------------------------
// Trucks. Forward is local +z.
// ---------------------------------------------------------------------------

function wheels(parent, M, xs, zs, r = 0.52) {
  const g = new THREE.CylinderGeometry(r, r, 0.42, 18)
  g.rotateZ(Math.PI / 2)
  const hub = new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.44, 10)
  hub.rotateZ(Math.PI / 2)
  for (const z of zs)
    for (const x of xs) {
      add(parent, g, M.rubber, [x, r, z])
      add(parent, hub, M.steel, [x, r, z])
    }
}

function dumpTruck(M) {
  const root = new THREE.Group()
  add(root, rbox(1.9, 0.45, 7.6, 0.06), M.paintDark, [0, 0.95, 0])
  add(root, rbox(2.45, 2.2, 1.9, 0.14), M.white, [0, 2.05, 2.85]) // cab
  add(root, new THREE.BoxGeometry(2.1, 0.9, 0.04), M.glass, [0, 2.45, 3.81])
  add(root, rbox(2.5, 1.55, 5.2, 0.08), M.paint, [0, 2.05, -1.0]) // tipper body
  add(root, rbox(2.2, 0.35, 4.8, 0.2), M.rubber, [0, 2.88, -1.0]) // load of spoil (dark)
  wheels(root, M, [-1.05, 1.05], [2.8, -0.9, -2.4])
  return { root }
}

function mixerTruck(M) {
  const root = new THREE.Group()
  add(root, rbox(1.9, 0.45, 7.8, 0.06), M.paintDark, [0, 0.95, 0])
  add(root, rbox(2.45, 2.2, 1.9, 0.14), M.white, [0, 2.05, 2.95])
  add(root, new THREE.BoxGeometry(2.1, 0.9, 0.04), M.glass, [0, 2.45, 3.91])
  const drum = new THREE.Group()
  drum.position.set(0, 2.55, -1.0)
  drum.rotation.x = -0.2
  root.add(drum)
  const body = new THREE.LatheGeometry(
    [
      [0.2, -2.8],
      [0.9, -2.2],
      [1.2, -0.8],
      [1.15, 0.6],
      [0.75, 1.9],
      [0.35, 2.4],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    20,
  )
  body.rotateX(Math.PI / 2)
  add(drum, body, M.drum)
  // Spiral fins make the rotation visible
  for (let i = 0; i < 10; i++) add(drum, new THREE.BoxGeometry(0.05, 0.08, 0.7), M.paintDark, [Math.cos(i * 0.9) * 1.17, Math.sin(i * 0.9) * 1.17, -1.7 + i * 0.36], [0, 0, i * 0.9])
  add(root, rbox(0.5, 0.25, 1.6, 0.06), M.steel, [0, 1.35, -4.3], [0.5, 0, 0]) // chute
  wheels(root, M, [-1.05, 1.05], [2.9, -1.0, -2.5])
  return { root, drum }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Key = { p, x, z }. Heading follows the direction of travel; machines are parked
// (keys with `face`) facing a set direction.
function sampleRoute(keys, p, out) {
  if (p <= keys[0].p) return Object.assign(out, keys[0], { moving: false, segment: -1 })
  const last = keys[keys.length - 1]
  if (p >= last.p) return Object.assign(out, last, { moving: false, segment: keys.length })
  let i = 0
  while (p > keys[i + 1].p) i++
  const a = keys[i]
  const b = keys[i + 1]
  const t = smooth(clamp01((p - a.p) / (b.p - a.p)))
  out.x = lerp(a.x, b.x, t)
  out.z = lerp(a.z, b.z, t)
  const dx = b.x - a.x
  const dz = b.z - a.z
  const moving = Math.hypot(dx, dz) > 0.01
  out.moving = moving
  out.segment = i
  out.face = moving ? Math.atan2(dx, dz) : (b.face ?? a.face ?? 0)
  return out
}

// Drive from (ax, az) to (bx, bz) via the lane at x = lane: out of the plot, along the road, into the plot.
function legs(keys, from, to, lane, p0, p1) {
  const pts = [
    [lane, from.z],
    [lane, to.z],
    [to.x, to.z],
  ]
  if (Math.abs(from.x - lane) < 0.5) pts.shift()
  const lens = []
  let prev = [from.x, from.z]
  for (const pt of pts) {
    lens.push(Math.hypot(pt[0] - prev[0], pt[1] - prev[1]))
    prev = pt
  }
  const total = lens.reduce((s, v) => s + v, 0) || 1
  let acc = 0
  pts.forEach((pt, i) => {
    acc += lens[i]
    keys.push({ p: p0 + (p1 - p0) * (acc / total), x: pt[0], z: pt[1] })
  })
}

function excavatorRoute(machine, lane) {
  const visits = machineVisits(machine)
  const start = { x: lane, z: ENTRY.z }
  const keys = [{ p: 0, x: start.x, z: start.z, face: Math.PI }]
  let cur = start
  let first = true
  const digs = []
  for (const b of visits) {
    const st = excavatorStation(b)
    const p0 = first ? b.dig[0] - 0.032 : keys[keys.length - 1].p + 0.002
    legs(keys, cur, st, lane, p0, b.dig[0] - 0.002)
    keys[keys.length - 1].face = st.heading
    keys.push({ p: b.dig[1], x: st.x, z: st.z, face: st.heading })
    digs.push([b.dig[0], b.dig[1]])
    cur = st
    first = false
  }
  const lastP = keys[keys.length - 1].p
  legs(keys, cur, { x: lane, z: ENTRY.z }, lane, lastP + 0.004, lastP + 0.04)
  return { keys, digs }
}

// A truck that parks beside a plot for a window and otherwise stays off-site.
function visitRoute(b, local, win, lane, travel = 0.026) {
  const [x, z] = localToWorld(b, local[0], local[1])
  const face = b.rot + Math.PI // nose towards the house
  const keys = [{ p: 0, x: lane, z: ENTRY.z, face: Math.PI }]
  legs(keys, { x: lane, z: ENTRY.z }, { x, z }, lane, win[0] - travel, win[0])
  keys[keys.length - 1].face = face
  keys.push({ p: win[1], x, z, face })
  legs(keys, { x, z }, { x: lane, z: ENTRY.z }, lane, win[1] + 0.003, win[1] + 0.003 + travel)
  return keys
}

export function buildMachines() {
  const M = makeMaterials()
  const group = new THREE.Group()
  group.name = 'machines'
  const units = []
  const tmp = {}

  const place = (unit, p) => {
    sampleRoute(unit.keys, p, tmp)
    const offsite = tmp.z > ENTRY.z - 40
    unit.obj.root.visible = !offsite
    if (offsite) return tmp
    unit.obj.root.position.set(tmp.x, driveHeight(tmp.x, tmp.z), tmp.z)
    unit.obj.root.rotation.y = tmp.face ?? 0
    return tmp
  }

  // Excavators: one per side of the road, plus a third for the clubhouse and E3.
  for (const [id, lane] of [
    ['exA', -2],
    ['exB', 2],
    ['exC', 2.2],
  ]) {
    const obj = excavator(M)
    mergeRigid(obj.root)
    const { keys, digs } = excavatorRoute(id, lane)
    const unit = { obj, keys }
    unit.update = (p) => {
      place(unit, p)
      const dig = digs.find(([a, b]) => p >= a && p <= b)
      let c = 0
      let active = 0
      if (dig) {
        const t = (p - dig[0]) / (dig[1] - dig[0])
        c = (t * 7) % 1
        active = smooth(clamp01(t * 12)) * smooth(clamp01((1 - t) * 12))
      }
      const [swing, boom, stick, bucket] = pose(c)
      obj.house.rotation.y = swing * active
      obj.boom.rotation.x = lerp(-0.35, boom, active) // travel pose: boom raised, bucket tucked
      obj.stick.rotation.x = lerp(1.2, stick, active)
      obj.bucket.rotation.x = lerp(1.4, bucket, active)
    }
    group.add(obj.root)
    units.push(unit)
  }

  // Dump truck working with excavator A at W1 (beside the pit, clear of the boom's swing).
  const W1 = BUILDINGS.find((b) => b.id === 'W1')
  {
    const obj = dumpTruck(M)
    mergeRigid(obj.root)
    const local = [7, W1.D / 2 + 3.5]
    const unit = { obj, keys: visitRoute(W1, local, [W1.dig[0] + 0.002, W1.dig[1]], -2.6, 0.03) }
    unit.update = (p) => place(unit, p)
    group.add(obj.root)
    units.push(unit)
  }

  // Concrete mixers for the featured pours.
  const H = BUILDINGS.find((b) => b.hero)
  const E2 = BUILDINGS.find((b) => b.id === 'E2')
  const mixers = [
    // Parked beyond the slab's far (north) end, so it reads behind the pour from the road-side camera.
    [W1, -2.6, (b) => visitRoute(b, [b.W / 2 + 5, b.D / 2 - 2], [b.t.pour0[0] - 0.004, b.t.pour0[1] + 0.002], -2.6)],
    // Before the island exists the circle is open ground, so the mixer drives straight across it.
    [H, 2.6, (b) => visitRoute(b, [b.entranceX, b.D / 2 + 5.5], [b.t.pour0[0] - 0.004, b.t.pour0[1] + 0.002], 2.6, 0.03)],
    [E2, 2.6, (b) => visitRoute(b, [b.entranceX, b.D / 2 + 5.5], [b.t.pour1[0] - 0.006, b.t.pour1[1] + 0.03], 2.6)],
  ]
  for (const [b, , route] of mixers) {
    const obj = mixerTruck(M)
    mergeRigid(obj.root)
    const unit = { obj, keys: route(b) }
    unit.update = (p) => {
      place(unit, p)
      obj.drum.rotation.z = p * 900
    }
    group.add(obj.root)
    units.push(unit)
  }

  const geometries = new Set()
  group.traverse((o) => o.geometry && geometries.add(o.geometry))

  return {
    group,
    units,
    update(p) {
      for (const u of units) u.update(p)
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of Object.values(M)) m.dispose()
    },
  }
}
