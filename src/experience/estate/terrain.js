// One continuous ground surface for the whole world: dense across the estate,
// widening progressively out to the far hills (a tensor-product grid, so there are
// no seams). Each vertex carries its own clearing, grading, excavation and turf
// schedule from the master plan.

import * as THREE from 'three'
import { naturalHeight, NEVER, siteInfo, SITE } from './plan.js'
import { yieldToMain } from './util.js'

// Grid lines: 1 m spacing inside [a, b], then growing steps out to ±extent.
function gridLines(a, b, step, extent, growth) {
  const inner = []
  for (let v = a; v <= b + 1e-6; v += step) inner.push(v)
  const lo = []
  const hi = []
  let s = step
  let v = a
  while (v > -extent) {
    s *= growth
    v -= s
    lo.unshift(Math.max(v, -extent))
  }
  s = step
  v = b
  while (v < extent) {
    s *= growth
    v += s
    hi.push(Math.min(v, extent))
  }
  return [...lo, ...inner, ...hi]
}

export async function buildTerrain(material, { dense = 1 } = {}) {
  const step = dense
  const xs = gridLines(SITE.x0 - 26, SITE.x1 + 26, step, 2600, 1.12)
  const zs = gridLines(SITE.z0 - 22, SITE.z1 + 40, step, 2600, 1.12)
  const nx = xs.length
  const nz = zs.length
  const count = nx * nz
  const position = new Float32Array(count * 3)
  const clear = new Float32Array(count)
  const lawn = new Float32Array(count)
  const grade = new Float32Array(count * 3)
  const dig = new Float32Array(count * 4)
  const inSite = (x, z) => x > SITE.x0 - 24 && x < SITE.x1 + 24 && z > SITE.z0 - 20 && z < SITE.z1 + 38

  for (let j = 0; j < nz; j++) {
    const z = zs[j]
    for (let i = 0; i < nx; i++) {
      const x = xs[i]
      const k = j * nx + i
      position[k * 3] = x
      position[k * 3 + 2] = z
      if (inSite(x, z)) {
        const s = siteInfo(x, z)
        position[k * 3 + 1] = s.natural
        clear[k] = s.clear
        lawn[k] = s.lawn
        grade.set(s.grade, k * 3)
        dig.set(s.dig, k * 4)
      } else {
        position[k * 3 + 1] = naturalHeight(x, z)
        clear[k] = NEVER
        lawn[k] = NEVER
        grade.set([NEVER, NEVER, 0], k * 3)
        dig.set([NEVER, NEVER, NEVER, 0], k * 4)
      }
    }
    if (j % 40 === 0) await yieldToMain()
  }

  const index = new Uint32Array((nx - 1) * (nz - 1) * 6)
  let n = 0
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i
      const b = a + 1
      const c = a + nx
      const d = c + 1
      index[n++] = a
      index[n++] = c
      index[n++] = b
      index[n++] = b
      index[n++] = c
      index[n++] = d
    }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(position, 3))
  g.setAttribute('aClear', new THREE.BufferAttribute(clear, 1))
  g.setAttribute('aLawn', new THREE.BufferAttribute(lawn, 1))
  g.setAttribute('aGrade', new THREE.BufferAttribute(grade, 3))
  g.setAttribute('aDig', new THREE.BufferAttribute(dig, 4))
  g.setIndex(new THREE.BufferAttribute(index, 1))
  g.computeVertexNormals()
  g.computeBoundingSphere()

  const mesh = new THREE.Mesh(g, material)
  mesh.name = 'terrain'
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.frustumCulled = false
  return mesh
}
