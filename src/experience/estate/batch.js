// Merges many construction parts into a single mesh per material, stamping each
// vertex with its build schedule (see materials.js). An eight-building estate
// renders in a few dozen draw calls this way.

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { NEVER } from './plan.js'

const AXES = { x: 0, y: 1, z: 2 }
const tmp = new THREE.Vector3()
const nrm = new THREE.Vector3()
const normalMatrix = new THREE.Matrix3()

// Geometry templates are cached by size, so repeated parts cost nothing to generate.
const roundedCache = new Map()
function roundedBox(w, h, d, radius) {
  const r = Math.min(radius, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`
  let g = roundedCache.get(key)
  if (!g) {
    g = r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d)
    roundedCache.set(key, g)
  }
  return g
}

export function clearGeometryCache() {
  for (const g of roundedCache.values()) g.dispose()
  roundedCache.clear()
}

export class Batch {
  constructor(name, material, depthMaterial = null) {
    this.name = name
    this.material = material
    this.depthMaterial = depthMaterial
    this.position = []
    this.normal = []
    this.uv = []
    this.build = []
    this.rise = []
    this.ground = []
    this.index = []
    this.vertexCount = 0
  }

  /**
   * Add a geometry (in its own local space) placed by `matrix`.
   * when: { in: [a, b], out?: [c, d], axis?: 'x'|'y'|'z', dir?: 1|-1, ground?: number,
   *         range?: [lo, hi] }  range: measure the build direction in world space across
   *         a whole assembly (e.g. a crane mast) instead of this part's own extent.
   */
  add(geometry, matrix, when) {
    const pos = geometry.attributes.position
    const nor = geometry.attributes.normal
    const uv = geometry.attributes.uv
    const axis = AXES[when.axis ?? 'y']
    const dir = when.dir ?? 1
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const range = when.range
    const min = range ? range[0] : geometry.boundingBox.min.getComponent(axis)
    const size = Math.max((range ? range[1] : geometry.boundingBox.max.getComponent(axis)) - min, 1e-6)
    const [i0, i1] = when.in
    const [o0, o1] = when.out ?? [NEVER, NEVER]
    const ground = when.ground ?? -1000
    normalMatrix.getNormalMatrix(matrix)
    const base = this.vertexCount
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i)
      let r = range ? 0 : (tmp.getComponent(axis) - min) / size
      tmp.applyMatrix4(matrix)
      if (range) r = Math.min(1, Math.max(0, (tmp.getComponent(axis) - min) / size))
      if (dir < 0) r = 1 - r
      nrm.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize()
      this.position.push(tmp.x, tmp.y, tmp.z)
      this.normal.push(nrm.x, nrm.y, nrm.z)
      if (uv) this.uv.push(uv.getX(i), uv.getY(i))
      else this.uv.push(0, 0)
      this.build.push(i0, i1, o0, o1)
      this.rise.push(r)
      this.ground.push(ground)
    }
    if (geometry.index) {
      const idx = geometry.index.array
      for (let i = 0; i < idx.length; i++) this.index.push(base + idx[i])
    } else {
      for (let i = 0; i < pos.count; i++) this.index.push(base + i)
    }
    this.vertexCount += pos.count
  }

  /** Axis-aligned box between two corners in `frame` space (a Matrix4), optionally bevelled. */
  box(frame, [x0, y0, z0], [x1, y1, z1], when, { bevel = 0 } = {}) {
    const w = Math.abs(x1 - x0)
    const h = Math.abs(y1 - y0)
    const d = Math.abs(z1 - z0)
    if (w < 1e-4 || h < 1e-4 || d < 1e-4) return
    const g = bevel ? roundedBox(w, h, d, bevel) : roundedBox(w, h, d, 0)
    const m = new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    this.add(g, frame ? new THREE.Matrix4().multiplyMatrices(frame, m) : m, when)
  }

  get empty() {
    return this.vertexCount === 0
  }

  toMesh({ castShadow = true, receiveShadow = true } = {}) {
    if (this.empty) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('aBuild', new THREE.Float32BufferAttribute(this.build, 4))
    g.setAttribute('aRise', new THREE.Float32BufferAttribute(this.rise, 1))
    g.setAttribute('aGround', new THREE.Float32BufferAttribute(this.ground, 1))
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.index, 1) : new THREE.Uint16BufferAttribute(this.index, 1))
    g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, this.material)
    mesh.name = this.name
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    if (this.depthMaterial) mesh.customDepthMaterial = this.depthMaterial
    // The arrays are no longer needed once uploaded.
    this.position = this.normal = this.uv = this.build = this.rise = this.ground = this.index = []
    return mesh
  }
}

// A building's frame: world position + rotation about y. Local +z is the entrance side.
export function frameMatrix(x, y, z, rotY) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(1, 1, 1),
  )
}
