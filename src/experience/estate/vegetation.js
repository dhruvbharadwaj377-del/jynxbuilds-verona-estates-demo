// Trees and grass. All instanced; every instance has a growth window (aGrow) so
// planting and clearing are deterministic functions of scroll progress.

import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { growthDepthMaterial, growthPatch } from './materials.js'
import { gradedHeight, naturalHeight, NEVER, siteInfo, SITE } from './plan.js'
import { leafCardTexture } from './textures.js'
import { fbm, mulberry32, yieldToMain } from './util.js'

const ALWAYS = [-2, -1.9, NEVER, NEVER]

// ---------------------------------------------------------------------------
// Species geometry: trunk + a crown of alpha-tested leaf cards
// ---------------------------------------------------------------------------

function crownCards({ cards, center, radius, size, seed, flatten = 1 }) {
  const rnd = mulberry32(seed)
  const parts = []
  const c = new THREE.Vector3(...center)
  for (let i = 0; i < cards; i++) {
    // Points in an ellipsoid shell, biased outwards so the silhouette is full.
    const u = rnd() * 2 - 1
    const a = rnd() * Math.PI * 2
    const r = Math.pow(rnd(), 0.35)
    const s = Math.sqrt(1 - u * u)
    const p = new THREE.Vector3(Math.cos(a) * s * radius[0] * r, u * radius[1] * r * flatten, Math.sin(a) * s * radius[2] * r).add(c)
    const g = new THREE.PlaneGeometry(size * (0.8 + rnd() * 0.5), size * (0.8 + rnd() * 0.5))
    g.rotateX(rnd() * Math.PI)
    g.rotateY(rnd() * Math.PI * 2)
    g.rotateZ((rnd() - 0.5) * 0.8)
    g.translate(p.x, p.y, p.z)
    // Shading normals point away from the crown centre: the canopy reads as a volume.
    const n = p.clone().sub(c).normalize().multiplyScalar(0.75).add(new THREE.Vector3(0, 0.45, 0)).normalize()
    const nor = g.attributes.normal
    for (let k = 0; k < nor.count; k++) nor.setXYZ(k, n.x, n.y, n.z)
    parts.push(g)
  }
  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}

function trunk({ height, r0, r1, lean = 0, branches = 0, seed = 1 }) {
  const rnd = mulberry32(seed)
  const parts = []
  const t = new THREE.CylinderGeometry(r1, r0, height, 7, 3)
  t.translate(0, height / 2, 0)
  if (lean) t.rotateZ(lean)
  parts.push(t)
  for (let i = 0; i < branches; i++) {
    const len = height * (0.35 + rnd() * 0.25)
    const b = new THREE.CylinderGeometry(r1 * 0.45, r1 * 0.8, len, 5)
    b.translate(0, len / 2, 0)
    b.rotateZ(0.6 + rnd() * 0.5)
    b.rotateY(rnd() * Math.PI * 2)
    b.translate(0, height * (0.55 + rnd() * 0.3), 0)
    parts.push(b)
  }
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()))
  parts.forEach((g) => g.dispose())
  return merged
}

// A solid inner canopy: keeps the tree's mass readable from the air, where
// alpha-tested cards thin out in the texture's lower mip levels.
function crownCore({ center, radius, flatten = 1 }, seed) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('uv').deleteAttribute('normal'))
  const rnd = mulberry32(seed)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  const bumps = Array.from({ length: 7 }, () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize())
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    let k = 0.82
    for (const b of bumps) k += Math.max(0, v.dot(b) - 0.55) * 0.5
    v.multiplyScalar(k)
    pos.setXYZ(i, v.x * radius[0] * 0.56 + center[0], v.y * radius[1] * 0.54 * flatten + center[1], v.z * radius[2] * 0.56 + center[2])
  }
  g.computeVertexNormals()
  return g
}

const SPECIES = {
  oak: {
    trunk: { height: 4.2, r0: 0.3, r1: 0.16, branches: 4, seed: 3 },
    crown: { cards: 110, center: [0, 6.2, 0], radius: [3.6, 2.8, 3.6], size: 2.1, seed: 4 },
    leaf: { seed: 5, rx: 4, ry: 8, count: 460, palette: [[58, 84, 36], [76, 102, 44], [44, 66, 30], [90, 108, 52]] },
    core: '#33482a',
    bark: '#5a4a3c',
  },
  pine: {
    trunk: { height: 8.5, r0: 0.32, r1: 0.18, branches: 3, seed: 6 },
    crown: { cards: 64, center: [0, 10.4, 0], radius: [5, 1.7, 5], size: 2.4, seed: 7, flatten: 0.9 },
    leaf: { seed: 8, rx: 1.6, ry: 10, count: 520, palette: [[48, 72, 38], [60, 86, 44], [38, 58, 32]] },
    core: '#2e4429',
    bark: '#6a4f3c',
  },
  olive: {
    trunk: { height: 1.9, r0: 0.2, r1: 0.12, branches: 3, lean: 0.12, seed: 9 },
    crown: { cards: 36, center: [0, 3, 0], radius: [2.1, 1.4, 2.1], size: 1.4, seed: 10 },
    leaf: { seed: 11, rx: 2, ry: 7, count: 480, palette: [[112, 124, 92], [92, 108, 80], [134, 144, 110]] },
    core: '#5a6648',
    bark: '#6e6152',
  },
  cypress: {
    trunk: { height: 1.2, r0: 0.16, r1: 0.12, seed: 12 },
    crown: { cards: 46, center: [0, 5.4, 0], radius: [0.85, 4.6, 0.85], size: 1.15, seed: 13 },
    leaf: { seed: 14, rx: 2.4, ry: 4.4, count: 560, palette: [[30, 52, 30], [40, 64, 36], [24, 42, 26]] },
    core: '#22381f',
    bark: '#4a3c30',
  },
}

function speciesMeshes(kind, items, uniforms, disposables) {
  const sp = SPECIES[kind]
  const crownGeo = crownCards(sp.crown)
  const coreGeo = crownCore(sp.crown, sp.crown.seed + 50)
  const trunkGeo = trunk(sp.trunk)
  const leafMap = leafCardTexture(sp.leaf)
  const leafMat = growthPatch(
    new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: 0.32, side: THREE.DoubleSide, roughness: 0.82, color: '#ffffff' }),
    uniforms,
    `leaf-${kind}`,
  )
  const barkMat = growthPatch(new THREE.MeshStandardMaterial({ color: sp.bark, roughness: 0.95 }), uniforms, 'bark')
  const coreMat = growthPatch(new THREE.MeshStandardMaterial({ color: sp.core, roughness: 1, envMapIntensity: 0.2 }), uniforms, 'core')
  disposables.push(crownGeo, coreGeo, trunkGeo, leafMap, leafMat, barkMat, coreMat)

  const grow = new Float32Array(items.length * 4)
  const tint = new THREE.Color()
  const rnd = mulberry32(items.length + kind.length)
  const crowns = new THREE.InstancedMesh(crownGeo, leafMat, items.length)
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, items.length)
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, items.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.rot)
    m.compose(new THREE.Vector3(it.x, it.y - 0.05, it.z), q, new THREE.Vector3(it.s, it.s * (0.92 + rnd() * 0.16), it.s))
    crowns.setMatrixAt(i, m)
    trunks.setMatrixAt(i, m)
    cores.setMatrixAt(i, m)
    tint.setRGB(0.86 + rnd() * 0.24, 0.88 + rnd() * 0.2, 0.84 + rnd() * 0.2)
    crowns.setColorAt(i, tint)
    cores.setColorAt(i, tint)
    grow.set(it.grow ? [it.grow[0], it.grow[1], NEVER, NEVER] : ALWAYS, i * 4)
  })
  for (const mesh of [crowns, trunks, cores]) {
    mesh.geometry = mesh.geometry.clone()
    mesh.geometry.setAttribute('aGrow', new THREE.InstancedBufferAttribute(grow, 4))
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.frustumCulled = false
    disposables.push(mesh.geometry)
  }
  crowns.customDepthMaterial = growthDepthMaterial(uniforms, { map: leafMap, alphaTest: 0.45 })
  trunks.customDepthMaterial = growthDepthMaterial(uniforms)
  cores.customDepthMaterial = trunks.customDepthMaterial
  disposables.push(crowns.customDepthMaterial, trunks.customDepthMaterial)
  return [trunks, cores, crowns]
}

// Mature woodland around the estate (present from the first frame), plus a few
// existing trees kept inside the site where no work happens.
function woodland(count, seed) {
  const rnd = mulberry32(seed)
  const items = { oak: [], pine: [] }
  let tries = 0
  while (items.oak.length + items.pine.length < count && tries < count * 20) {
    tries++
    const x = (rnd() * 2 - 1) * 520
    const z = -560 + rnd() * 1060
    const dx = Math.max(SITE.x0 - 14 - x, x - SITE.x1 - 14, 0)
    const dz = Math.max(SITE.z0 - 14 - z, z - SITE.z1 - 30, 0)
    const d = Math.hypot(dx, dz)
    if (d <= 0) continue
    // Denser in belts near the site, thinning with distance; clear of the approach road.
    if (Math.abs(x) < 16 && z > SITE.z1) continue
    const cluster = Math.max(0, fbm(x * 0.012 + 4.1, z * 0.012 - 2.3, 3) + 0.15) * 2.2
    const density = (Math.exp(-d / 160) * 0.8 + 0.1) * Math.min(1, cluster)
    if (rnd() > density) continue
    const kind = rnd() < 0.36 ? 'pine' : 'oak'
    items[kind].push({ x, z, y: naturalHeight(x, z), s: 0.85 + rnd() * 0.55, rot: rnd() * Math.PI * 2 })
  }
  return items
}

// ---------------------------------------------------------------------------
// Grass tufts
// ---------------------------------------------------------------------------

function tuftGeometry({ blades, height, spread, seed, base, tip }) {
  const rnd = mulberry32(seed)
  const pos = []
  const col = []
  const nor = []
  const cBase = new THREE.Color(base)
  const cTip = new THREE.Color(tip)
  for (let i = 0; i < blades; i++) {
    const a = rnd() * Math.PI * 2
    const r = rnd() * spread
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const w = 0.012 + rnd() * 0.01
    const h = height * (0.6 + rnd() * 0.6)
    const lean = (rnd() - 0.5) * 0.35
    const px = -Math.sin(a) * w
    const pz = Math.cos(a) * w
    const tx = x + Math.cos(a) * lean * h
    const tz = z + Math.sin(a) * lean * h
    pos.push(x - px, 0, z - pz, x + px, 0, z + pz, tx, h, tz)
    const k = 0.85 + rnd() * 0.3
    for (const c of [cBase, cBase, cTip]) col.push(c.r * k, c.g * k, c.b * k)
    for (let v = 0; v < 3; v++) nor.push(0, 1, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return g
}

// Where grass is worth drawing: the estate and its immediate surroundings,
// densest where the camera comes down to ground level.
const FOCUS = [
  { x: -24, z: 58, r: 26, w: 3 }, // foundations shot (W1)
  { x: 0, z: -98, r: 30, w: 3.5 }, // final arrival (hero villa)
  { x: 18, z: 4, r: 30, w: 1.5 }, // facade track (E2)
]

async function grassTufts(uniforms, counts, disposables) {
  const rnd = mulberry32(77)
  const meadow = []
  const lawn = []
  const sample = () => {
    if (rnd() < 0.55) {
      const f = FOCUS[Math.floor(rnd() * FOCUS.length)]
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(rnd()) * f.r
      return [f.x + Math.cos(a) * r, f.z + Math.sin(a) * r]
    }
    return [SITE.x0 - 20 + rnd() * (SITE.x1 - SITE.x0 + 40), SITE.z0 - 20 + rnd() * (SITE.z1 - SITE.z0 + 50)]
  }
  let tries = 0
  while ((meadow.length < counts.meadow || lawn.length < counts.lawn) && tries < (counts.meadow + counts.lawn) * 4) {
    tries++
    const [x, z] = sample()
    const s = siteInfo(x, z)
    if (s.hard && s.lawn === 9) continue
    if (meadow.length < counts.meadow && (s.clear !== NEVER || rnd() < 0.6)) {
      // Wild grass stays until its ground is cleared or regraded (never floating or buried).
      const cut = Math.min(s.clear, Math.abs(s.grade[2]) > 0.05 ? s.grade[0] : NEVER)
      meadow.push({ x, z, y: s.natural, grow: [-2, -1.9, cut === NEVER ? NEVER : cut - 0.004, cut === NEVER ? NEVER : cut + 0.012] })
    }
    if (s.lawn !== NEVER && lawn.length < counts.lawn) {
      const y = s.natural + s.grade[2]
      lawn.push({ x: x + 0.3, z: z + 0.2, y, grow: [s.lawn + 0.006, s.lawn + 0.024, NEVER, NEVER] })
    }
    if (tries % 4000 === 0) await yieldToMain()
  }

  // Tufts are bucketed into spatial chunks: each chunk is frustum-culled, and switched off
  // entirely beyond GRASS_RANGE, so aerial views never pay for grass they cannot resolve.
  const CELL = 40
  const make = (items, base, key) => {
    const mat = growthPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), uniforms, key, { fade: [38, 64] })
    disposables.push(base, mat)
    const buckets = new Map()
    for (const it of items) {
      const k = `${Math.floor(it.x / CELL)}|${Math.floor(it.z / CELL)}`
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k).push(it)
    }
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const chunks = []
    for (const list of buckets.values()) {
      const geo = base.clone()
      const mesh = new THREE.InstancedMesh(geo, mat, list.length)
      const grow = new Float32Array(list.length * 4)
      list.forEach((it, i) => {
        q.setFromAxisAngle(up, rnd() * Math.PI * 2)
        const s = 0.7 + rnd() * 0.7
        m.compose(new THREE.Vector3(it.x, it.y - 0.02, it.z), q, new THREE.Vector3(s, s * (0.8 + rnd() * 0.5), s))
        mesh.setMatrixAt(i, m)
        grow.set(it.grow, i * 4)
      })
      geo.setAttribute('aGrow', new THREE.InstancedBufferAttribute(grow, 4))
      mesh.receiveShadow = true
      mesh.castShadow = false
      mesh.computeBoundingSphere()
      mesh.userData.grassChunk = true
      disposables.push(geo)
      chunks.push(mesh)
    }
    return chunks
  }
  return [
    ...make(meadow, tuftGeometry({ blades: 14, height: 0.32, spread: 0.16, seed: 3, base: '#5c6a30', tip: '#b8b075' }), 'meadow'),
    ...make(lawn, tuftGeometry({ blades: 14, height: 0.11, spread: 0.12, seed: 4, base: '#4a6a2a', tip: '#8fae52' }), 'lawn'),
  ]
}

const GRASS_RANGE = 70

export async function buildVegetation({ uniforms, planted, quality }) {
  const disposables = []
  const high = quality === 'high'
  const wood = woodland(high ? 1100 : 420, 31)
  // Trees retained inside the site: only where the ground is never disturbed.
  const rnd = mulberry32(41)
  for (let i = 0; i < 60 && wood.oak.length < 2000; i++) {
    const x = SITE.x0 + 4 + rnd() * (SITE.x1 - SITE.x0 - 8)
    const z = SITE.z0 + 4 + rnd() * (SITE.z1 - SITE.z0 - 8)
    const s = siteInfo(x, z)
    if (s.clear !== NEVER || s.lawn !== NEVER || s.hard) continue
    wood.oak.push({ x, z, y: s.natural, s: 1 + rnd() * 0.3, rot: rnd() * 6.28 })
  }
  await yieldToMain()
  const byKind = { oak: [...wood.oak], pine: [...wood.pine], olive: [], cypress: [] }
  for (const t of planted) byKind[t.kind].push({ ...t, y: t.y ?? gradedHeight(t.x, t.z) })
  const meshes = []
  for (const kind of Object.keys(byKind)) {
    if (!byKind[kind].length) continue
    meshes.push(...speciesMeshes(kind, byKind[kind], uniforms, disposables))
    await yieldToMain()
  }
  const grass = await grassTufts(uniforms, high ? { meadow: 42000, lawn: 30000 } : { meadow: 12000, lawn: 9000 }, disposables)
  meshes.push(...grass)
  const centre = new THREE.Vector3()
  return {
    meshes,
    update(camera) {
      for (const chunk of grass) {
        centre.copy(chunk.boundingSphere.center)
        chunk.visible = centre.distanceTo(camera.position) - chunk.boundingSphere.radius < GRASS_RANGE
      }
    },
    dispose() {
      for (const d of disposables) d.dispose?.()
    },
  }
}
