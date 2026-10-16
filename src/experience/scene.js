// Procedural VÉRONA residence, built with plain Three.js.
//
// This module is loaded lazily (dynamic import) so three.js never touches the
// initial bundle. It renders on demand: frames are only drawn while the camera,
// pointer or lighting mood is still settling, and nothing runs while the
// section is offscreen.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ---------------------------------------------------------------------------
// Palette — mirrors the site's ink / cream / bronze tokens
// ---------------------------------------------------------------------------

const MOODS = {
  dusk: {
    skyTop: new THREE.Color('#1a2440'),
    skyHorizon: new THREE.Color('#d98d68'),
    sunGlow: new THREE.Color('#ffb27a'),
    sunStrength: 0.85,
    fog: new THREE.Color('#5d4f5c'),
    hemi: 0.95,
    key: new THREE.Color('#ffd2a8'),
    keyIntensity: 1.5,
    interior: 1.0,
    lamps: 22,
    city: 0.55,
    stars: 0,
    exposure: 1.0,
  },
  night: {
    skyTop: new THREE.Color('#05070f'),
    skyHorizon: new THREE.Color('#1c2236'),
    sunGlow: new THREE.Color('#3a4670'),
    sunStrength: 0.15,
    fog: new THREE.Color('#121626'),
    hemi: 0.32,
    key: new THREE.Color('#90a8dd'),
    keyIntensity: 0.55,
    interior: 1.5,
    lamps: 34,
    city: 1,
    stars: 0.9,
    exposure: 1.12,
  },
}

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (t) => t * t * (3 - 2 * t)

// Seeded random so the composition is identical on every visit.
function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------

function canvasTexture(width, height, draw, { srgb = true, repeat } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
  }
  texture.anisotropy = 4
  return texture
}

function travertineTexture(rand) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#d9ccb6'
      ctx.fillRect(0, 0, w, h)
      // Horizontal veining, the signature of cut travertine
      for (let i = 0; i < 60; i++) {
        const y = rand() * h
        ctx.fillStyle = `rgba(${150 + rand() * 40}, ${130 + rand() * 30}, ${100 + rand() * 20}, ${0.03 + rand() * 0.06})`
        ctx.fillRect(rand() * w * 0.5, y, w * (0.3 + rand() * 0.7), 1 + rand() * 2)
      }
      // Stone coursing
      ctx.fillStyle = 'rgba(90, 76, 60, 0.12)'
      for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 1)
      for (let y = 0; y < h; y += 64) {
        const offset = (y / 64) % 2 ? 0 : 64
        for (let x = offset; x < w; x += 128) ctx.fillRect(x, y, 1, 64)
      }
    },
    { repeat: [1, 1] },
  )
}

function pavingTexture(rand) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      const tile = 64
      for (let y = 0; y < h; y += tile) {
        for (let x = 0; x < w; x += tile) {
          const v = 200 + rand() * 14
          ctx.fillStyle = `rgb(${v}, ${v - 8}, ${v - 20})`
          ctx.fillRect(x, y, tile, tile)
        }
      }
      ctx.fillStyle = 'rgba(60, 50, 40, 0.35)'
      for (let i = 0; i <= w; i += tile) {
        ctx.fillRect(i, 0, 1, h)
        ctx.fillRect(0, i, w, 1)
      }
    },
    { repeat: [1, 1] },
  )
}

function interiorTexture(rand) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#f2b277')
    g.addColorStop(0.2, '#c9773a')
    g.addColorStop(0.7, '#8c4a1e')
    g.addColorStop(1, '#4a2410')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // Timber slat wall
    for (let x = 0; x < w; x += 6) {
      ctx.fillStyle = `rgba(80, 40, 10, ${0.08 + rand() * 0.08})`
      ctx.fillRect(x, 0, 1, h)
    }
    // Wall washer pools of light
    for (let i = 0; i < 6; i++) {
      const cx = (i + 0.5) * (w / 6)
      const r = ctx.createRadialGradient(cx, 0, 0, cx, 0, h * 0.9)
      r.addColorStop(0, 'rgba(255, 214, 160, 0.4)')
      r.addColorStop(1, 'rgba(255, 214, 160, 0)')
      ctx.fillStyle = r
      ctx.fillRect(0, 0, w, h)
    }
  })
}

function windowsTexture(rand) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    const cols = 8
    const rows = 40
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() > 0.68) continue
        const warm = rand() > 0.25
        ctx.fillStyle = warm
          ? `rgba(255, ${170 + rand() * 60}, ${90 + rand() * 60}, ${0.4 + rand() * 0.6})`
          : `rgba(180, 210, 255, ${0.3 + rand() * 0.4})`
        ctx.fillRect(c * (w / cols) + 3, r * (h / rows) + 2, w / cols - 6, h / rows - 3)
      }
    }
  })
}

function glowTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255, 255, 255, 1)')
    g.addColorStop(0.2, 'rgba(255, 220, 170, 0.6)')
    g.addColorStop(1, 'rgba(255, 200, 140, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

// ---------------------------------------------------------------------------
// Sky dome
// ---------------------------------------------------------------------------

function createSky() {
  const uniforms = {
    topColor: { value: MOODS.dusk.skyTop.clone() },
    horizonColor: { value: MOODS.dusk.skyHorizon.clone() },
    glowColor: { value: MOODS.dusk.sunGlow.clone() },
    glowStrength: { value: MOODS.dusk.sunStrength },
    glowDir: { value: new THREE.Vector3(-0.55, 0.02, -0.83).normalize() },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 glowColor;
      uniform float glowStrength;
      uniform vec3 glowDir;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
        float sun = max(dot(normalize(vec3(vDir.x, max(vDir.y, 0.0), vDir.z)), glowDir), 0.0);
        col += glowColor * pow(sun, 6.0) * glowStrength * (1.0 - h);
        // below horizon fades into the valley haze
        col = mix(col, horizonColor * 0.55, smoothstep(0.0, -0.12, vDir.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material)
  mesh.renderOrder = -1
  return { mesh, uniforms }
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export function createEstateScene({ canvas, chapters, quality = 'high', onRender, onContextLost }) {
  const high = quality === 'high'
  const rand = seeded(7)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: high,
    alpha: false,
    powerPreference: high ? 'high-performance' : 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = high
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(MOODS.dusk.fog.clone(), 90, 1100)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envTarget.texture
  scene.environmentIntensity = 0.28
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1800)

  // ---------------- Materials ----------------

  const travertineMap = travertineTexture(rand)
  const stone = new THREE.MeshStandardMaterial({ color: '#efe4d2', map: travertineMap, roughness: 0.82 })
  const stoneMap2 = pavingTexture(rand)
  stoneMap2.repeat.set(5, 4)
  const paving = new THREE.MeshStandardMaterial({ color: '#cfc6b8', map: stoneMap2, roughness: 0.62 })
  const darkStone = new THREE.MeshStandardMaterial({ color: '#3a342d', roughness: 0.9 })
  const wood = new THREE.MeshStandardMaterial({
    color: '#9a6238',
    roughness: 0.55,
    emissive: new THREE.Color('#5a2a0c'),
    emissiveIntensity: 0.35,
  })
  const frame = new THREE.MeshStandardMaterial({ color: '#221d18', roughness: 0.4, metalness: 0.6 })
  const glass = new THREE.MeshStandardMaterial({
    color: '#2b3236',
    roughness: 0.04,
    metalness: 0.95,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    envMapIntensity: 1.6,
  })
  const interiorMap = interiorTexture(rand)
  const interior = new THREE.MeshStandardMaterial({
    color: '#000',
    emissive: '#ffffff',
    emissiveMap: interiorMap,
    emissiveIntensity: MOODS.dusk.interior,
    roughness: 1,
  })
  const floorWarm = new THREE.MeshStandardMaterial({
    color: '#7a5636',
    roughness: 0.35,
    emissive: '#4a250c',
    emissiveIntensity: 0.6,
  })
  const furniture = new THREE.MeshStandardMaterial({ color: '#2c241d', roughness: 0.8 })
  const linen = new THREE.MeshStandardMaterial({ color: '#e9dcc6', roughness: 0.9, emissive: '#5a3a1c', emissiveIntensity: 0.4 })
  // HDR colour so lamps stay luminous after tone mapping
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf94').multiplyScalar(2.2) })
  const lawn = new THREE.MeshStandardMaterial({ color: '#202d1c', roughness: 1 })
  const foliage = new THREE.MeshStandardMaterial({ color: '#25361f', roughness: 0.9, flatShading: true })
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4b3b2d', roughness: 0.95 })
  const water = new THREE.MeshStandardMaterial({
    color: '#0e4e5c',
    emissive: '#178f9e',
    emissiveIntensity: 0.42,
    roughness: 0.06,
    metalness: 0.25,
    envMapIntensity: 1.2,
  })

  const disposables = [travertineMap, stoneMap2, interiorMap]

  // ---------------- Helpers ----------------

  const root = new THREE.Group()
  scene.add(root)

  // Box from min/max corners — reads like a plan drawing, easy to reason about
  function box(material, [x0, y0, z0], [x1, y1, z1], { cast = true, receive = true, parent = root } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material)
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    mesh.castShadow = cast && high
    mesh.receiveShadow = receive && high
    parent.add(mesh)
    return mesh
  }

  function plane(material, width, height, position, rotationY = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    mesh.position.set(...position)
    mesh.rotation.y = rotationY
    root.add(mesh)
    return mesh
  }

  const glowMap = glowTexture()
  disposables.push(glowMap)
  const glowMaterials = []
  function glow(position, size, color = '#ffc98c', opacity = 0.75) {
    const material = new THREE.SpriteMaterial({
      map: glowMap,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    })
    material.userData.baseOpacity = opacity
    glowMaterials.push(material)
    const sprite = new THREE.Sprite(material)
    sprite.position.set(...position)
    sprite.scale.setScalar(size)
    root.add(sprite)
    return sprite
  }

  // ---------------- Site ----------------

  // Garden lawn, set below the terrace plinth
  const lawnMesh = new THREE.Mesh(new THREE.CircleGeometry(75, 48), lawn)
  lawnMesh.rotation.x = -Math.PI / 2
  lawnMesh.position.y = -0.6
  lawnMesh.receiveShadow = high
  root.add(lawnMesh)

  // Valley floor far below: makes the site read as elevated
  const valley = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({ color: '#141712', roughness: 1 }),
  )
  valley.rotation.x = -Math.PI / 2
  valley.position.y = -16
  root.add(valley)

  // Terrace plinth, built around the pool basin
  box(paving, [-16, -0.6, -7], [11, 0, 5])
  box(paving, [-2, -0.6, 5], [11, 0, 9.6])
  box(paving, [-16, -0.6, 5], [-15.6, 0, 9.6])
  box(darkStone, [-15.6, -1.2, 5], [-2, -0.7, 9.6], { cast: false })
  const pool = box(water, [-15.6, -0.72, 5], [-2, -0.08, 9.6], { cast: false })
  pool.receiveShadow = false
  // Catch trough below the vanishing edge
  box(darkStone, [-15.6, -0.6, 9.6], [-2, -0.3, 10.2], { cast: false })
  for (let x = -14.5; x < -2; x += 3.2) glow([x, -0.25, 9.3], 1.6, '#7fe4ef', 0.35)

  // Arrival steps and path from the garden
  box(paving, [3.9, -0.6, 9.6], [7.1, -0.2, 10.6])
  box(paving, [3.9, -0.6, 10.6], [7.1, -0.4, 11.6])
  const paverGeo = new THREE.BoxGeometry(2.6, 0.12, 0.85)
  const pavers = new THREE.InstancedMesh(paverGeo, paving, 14)
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < 14; i++) {
    m4.makeTranslation(5.5 + Math.sin(i * 0.45) * 0.25, -0.55, 12.4 + i * 1.15)
    pavers.setMatrixAt(i, m4)
  }
  pavers.receiveShadow = high
  root.add(pavers)

  // Bollards lining the path
  const bollardGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8)
  const bollards = new THREE.InstancedMesh(bollardGeo, frame, 12)
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const x = 5.5 + side * 2 + Math.sin(i * 1.15) * 0.25
      const z = 12.6 + i * 2.6
      m4.makeTranslation(x, -0.25, z)
      bollards.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4)
      glow([x, 0.12, z], 1.25, '#ffcf96', 0.85)
    }
  }
  root.add(bollards)

  // ---------------- Architecture ----------------

  // Ground floor glass pavilion: x[-8, 6], z[-5, 3.5]
  box(floorWarm, [-8, 0, -5], [6, 0.06, 3.5], { cast: false })
  plane(interior, 14, 3.35, [-1, 1.73, -4.85])
  // Side return walls catch light too
  plane(interior, 8.5, 3.35, [-7.9, 1.73, -0.75], Math.PI / 2)

  // Glazing and mullions
  plane(glass, 14, 3.34, [-1, 1.73, 3.5])
  plane(glass, 8.5, 3.34, [-8, 1.73, -0.75], -Math.PI / 2)
  for (let x = -8; x <= 6.01; x += 2.8) box(frame, [x - 0.04, 0.06, 3.46], [x + 0.04, 3.4, 3.56])
  box(frame, [-8, 0.06, 3.46], [6, 0.12, 3.56])

  // Pavilion furniture — silhouettes give the glass real depth
  box(furniture, [-6.6, 0.06, -0.6], [-3.2, 0.5, 0.4])
  box(furniture, [-6.6, 0.06, -1.3], [-3.2, 0.9, -0.6])
  box(linen, [-5.6, 0.06, 1.0], [-4.2, 0.35, 2.0])
  box(furniture, [0.6, 0.06, -1.6], [4.2, 0.78, -0.4])
  box(darkStone, [0.8, 0.06, -3.9], [4.0, 0.95, -3.0])
  for (let i = 0; i < 3; i++) {
    const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8), lampMat)
    pendant.position.set(1.4 + i * 1.0, 2.25, -1)
    root.add(pendant)
    glow([1.4 + i * 1.0, 2.25, -1], 0.75, '#ffd3a0', 0.55)
  }
  // Artwork on the slatted wall
  box(darkStone, [-4.4, 1.0, -4.84], [-2.2, 2.6, -4.78], { cast: false })

  // Stone core: the solid anchor, x[6, 10.4], z[-6, 5.4]
  box(stone, [6, 0, -6], [10.4, 8.4, 5.4])
  // Deep-set entrance in the core
  box(darkStone, [7.0, 0, 5.38], [8.8, 3.1, 5.42], { cast: false })
  glow([7.9, 3.25, 5.6], 1.2, '#ffd8a6', 0.7)

  // Upper suite: cantilevered box x[-11, 6], z[-4, 5]
  const slabMats = [stone, stone, stone, wood, stone, stone] // -y face is the timber soffit
  const slab = new THREE.Mesh(new THREE.BoxGeometry(17, 0.42, 9), slabMats)
  slab.position.set(-2.5, 3.61, 0.5)
  slab.castShadow = high
  slab.receiveShadow = high
  root.add(slab)

  box(stone, [-11, 7.2, -4], [6, 7.65, 5]) // roof
  box(stone, [-11, 3.82, -4], [-10.55, 7.2, 5]) // west end wall
  box(stone, [5.55, 3.82, -4], [6, 7.2, 5]) // east end wall
  box(stone, [-10.55, 3.82, -4], [5.55, 7.2, -3.6]) // rear wall

  plane(interior, 16, 3.36, [-2.5, 5.5, -3.55])
  box(floorWarm, [-10.55, 3.82, -3.6], [5.55, 3.86, 4.55], { cast: false })
  plane(glass, 16.1, 3.36, [-2.5, 5.5, 4.6])
  for (let x = -10.55; x <= 5.56; x += 2.3) box(frame, [x - 0.035, 3.84, 4.56], [x + 0.035, 7.2, 4.66])

  // Suite interior
  box(linen, [-5.2, 3.86, -2.8], [-2.4, 4.42, -0.4])
  box(wood, [-5.4, 3.86, -3.55], [-2.2, 5.1, -3.3])
  box(furniture, [1.2, 3.86, -1.2], [2.4, 4.4, 0.0])

  // Recessed downlights in the timber soffit
  const downlights = []
  for (let x = -10.2; x <= 5; x += 1.9) downlights.push([x, 4.1])
  for (let z = -3; z <= 2.6; z += 1.9) downlights.push([-9.5, z])
  const discGeo = new THREE.CircleGeometry(0.09, 12)
  const discs = new THREE.InstancedMesh(discGeo, lampMat, downlights.length)
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  downlights.forEach(([x, z], i) => {
    m4.compose(new THREE.Vector3(x, 3.385, z), q, new THREE.Vector3(1, 1, 1))
    discs.setMatrixAt(i, m4)
    if (i % 2 === 0) glow([x, 3.3, z], 0.9, '#ffd6a4', 0.6)
  })
  root.add(discs)

  // Roof terrace lip glow
  glow([-2.5, 7.75, 4.8], 0.6, '#ffd6a4', 0)

  // ---------------- Landscape ----------------

  // Palms: two instanced meshes (trunks + crowns) for the whole garden
  const palmSpots = [
    [-20, -5, 9.5],
    [-22.5, 1.5, 8.2],
    [14, -4.5, 10],
    [16.5, 2.5, 8.4],
    [-5, -11.5, 9],
    [3.5, -12.5, 10.5],
    [11, -10, 8],
    [-14, -11, 7.6],
    [-27, 13, 9],
    [21, 9, 7.2],
  ]
  const palmCount = high ? palmSpots.length : 6
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1, 6)
  trunkGeo.translate(0, 0.5, 0)
  const frondParts = []
  for (let i = 0; i < 9; i++) {
    const frond = new THREE.ConeGeometry(0.32, 3.4, 4, 1)
    frond.scale(1, 1, 0.18)
    frond.translate(0, 1.7, 0)
    frond.rotateZ(-Math.PI / 2 - 0.35 - (i % 2) * 0.25)
    frond.rotateY((i / 9) * Math.PI * 2)
    frondParts.push(frond)
  }
  const crownGeo = mergeGeometries(frondParts)
  frondParts.forEach((g) => g.dispose())
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount)
  const crowns = new THREE.InstancedMesh(crownGeo, foliage, palmCount)
  const up = new THREE.Vector3()
  for (let i = 0; i < palmCount; i++) {
    const [x, z, h] = palmSpots[i]
    const lean = new THREE.Euler((rand() - 0.5) * 0.18, 0, (rand() - 0.5) * 0.18)
    const rot = new THREE.Quaternion().setFromEuler(lean)
    m4.compose(new THREE.Vector3(x, -0.6, z), rot, new THREE.Vector3(1, h, 1))
    trunks.setMatrixAt(i, m4)
    up.set(0, h, 0).applyQuaternion(rot).add(new THREE.Vector3(x, -0.6, z))
    const crownRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0))
    m4.compose(up, crownRot, new THREE.Vector3(1, 1, 1).multiplyScalar(0.9 + rand() * 0.3))
    crowns.setMatrixAt(i, m4)
  }
  trunks.castShadow = crowns.castShadow = high
  root.add(trunks, crowns)

  // Shrubs and garden uplights
  const shrubCount = high ? 46 : 22
  const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), foliage, shrubCount)
  for (let i = 0; i < shrubCount; i++) {
    let x
    let z
    const band = i % 3
    if (band === 0) {
      // along the path
      x = 5.5 + (rand() > 0.5 ? 1 : -1) * (3 + rand() * 2.5)
      z = 12 + rand() * 15
    } else if (band === 1) {
      // west lawn, beside the pool (kept clear of the terrace camera)
      x = -17.5 - rand() * 6
      z = -4 + rand() * 12
    } else {
      // perimeter planting behind and beside the house
      const a = rand() * Math.PI * 2
      const r = 19 + rand() * 9
      x = Math.cos(a) * r
      z = Math.sin(a) * r * 0.7 - 3
    }
    const s = 0.5 + rand() * 0.9
    m4.compose(
      new THREE.Vector3(x, -0.6 + s * 0.45, z),
      new THREE.Quaternion(),
      new THREE.Vector3(s * 1.3, s * 0.8, s * 1.3),
    )
    shrubs.setMatrixAt(i, m4)
    if (band === 0 && i % 2 === 0) glow([x, -0.2, z], 1.4, '#ffd28f', 0.35)
  }
  shrubs.castShadow = high
  shrubs.receiveShadow = high
  root.add(shrubs)

  // ---------------- The city beyond ----------------

  const windowMap = windowsTexture(rand)
  disposables.push(windowMap)
  const towerMat = new THREE.MeshStandardMaterial({
    color: '#14161c',
    roughness: 0.6,
    emissive: '#ffffff',
    emissiveMap: windowMap,
    emissiveIntensity: 0.9,
  })
  const towerCount = high ? 150 : 70
  const towerGeo = new THREE.BoxGeometry(1, 1, 1)
  towerGeo.translate(0, 0.5, 0)
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount)
  for (let i = 0; i < towerCount; i++) {
    // A skyline arc behind and to the left of the house
    const a = -Math.PI * 0.95 + rand() * Math.PI * 0.75
    const r = 430 + rand() * 330
    const w = 8 + rand() * 12
    const h = 10 + Math.pow(rand(), 2.2) * 52
    m4.compose(
      new THREE.Vector3(Math.cos(a) * r, -16, Math.sin(a) * r),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0)),
      new THREE.Vector3(w, h, w * (0.6 + rand() * 0.6)),
    )
    towers.setMatrixAt(i, m4)
  }
  root.add(towers)

  // Scattered city lights on the valley floor
  const lightCount = high ? 1600 : 700
  const cityPositions = new Float32Array(lightCount * 3)
  for (let i = 0; i < lightCount; i++) {
    const a = -Math.PI * 1.05 + rand() * Math.PI * 0.95
    const r = 90 + Math.pow(rand(), 0.7) * 420
    cityPositions[i * 3] = Math.cos(a) * r
    cityPositions[i * 3 + 1] = -15.5
    cityPositions[i * 3 + 2] = Math.sin(a) * r
  }
  const cityGeo = new THREE.BufferGeometry()
  cityGeo.setAttribute('position', new THREE.BufferAttribute(cityPositions, 3))
  const cityMat = new THREE.PointsMaterial({
    color: '#ffc685',
    size: 2.4,
    map: glowMap,
    transparent: true,
    opacity: MOODS.dusk.city,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  root.add(new THREE.Points(cityGeo, cityMat))

  // Distant ridge line
  const ridgeGeo = new THREE.PlaneGeometry(1600, 120, 160, 1)
  const ridgePos = ridgeGeo.attributes.position
  for (let i = 0; i < ridgePos.count; i++) {
    if (ridgePos.getY(i) > 0) {
      const x = ridgePos.getX(i)
      ridgePos.setY(
        i,
        20 + Math.sin(x * 0.006) * 28 + Math.sin(x * 0.021 + 1.3) * 12 + Math.sin(x * 0.07) * 3,
      )
    } else {
      ridgePos.setY(i, -40)
    }
  }
  ridgeGeo.computeVertexNormals()
  const ridge = new THREE.Mesh(ridgeGeo, new THREE.MeshBasicMaterial({ color: '#2a2833' }))
  ridge.position.set(-160, -16, -840)
  ridge.rotation.y = 0.35
  root.add(ridge)

  // Stars (fade in for the night mood)
  const starCount = high ? 900 : 400
  const starPositions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const a = rand() * Math.PI * 2
    const y = 0.15 + rand() * 0.85
    const r = Math.sqrt(1 - y * y)
    starPositions.set([Math.cos(a) * r * 850, y * 850, Math.sin(a) * r * 850], i * 3)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMat = new THREE.PointsMaterial({
    color: '#dfe6ff',
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  })
  scene.add(new THREE.Points(starGeo, starMat))

  const sky = createSky()
  scene.add(sky.mesh)

  // ---------------- Lighting ----------------

  const hemi = new THREE.HemisphereLight('#9fb3d9', '#2a2018', MOODS.dusk.hemi)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(MOODS.dusk.key, MOODS.dusk.keyIntensity)
  key.position.set(-30, 22, 24)
  key.target.position.set(0, 2, 0)
  if (high) {
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -30
    key.shadow.camera.right = 30
    key.shadow.camera.top = 24
    key.shadow.camera.bottom = -18
    key.shadow.camera.near = 5
    key.shadow.camera.far = 90
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    key.shadow.radius = 4
  }
  scene.add(key, key.target)

  // Warm practical light spilling from inside — the emotional core of the shot
  const lamps = []
  const lampSpots = high
    ? [
        [-4, 2.6, 0.5, 12],
        [2.5, 2.6, 0, 12],
        [-3, 6.4, 0, 12],
        [-4, 3.1, 6.5, 14],
      ]
    : [[-1, 2.8, 4.5, 16]]
  for (const [x, y, z, distance] of lampSpots) {
    const lamp = new THREE.PointLight('#ffb36a', MOODS.dusk.lamps, distance, 2)
    lamp.position.set(x, y, z)
    scene.add(lamp)
    lamps.push(lamp)
  }

  // ---------------- Camera path ----------------

  const posCurve = new THREE.CatmullRomCurve3(
    chapters.map((c) => new THREE.Vector3(...c.camera.position)),
    false,
    'centripetal',
  )
  const targetCurve = new THREE.CatmullRomCurve3(
    chapters.map((c) => new THREE.Vector3(...c.camera.target)),
    false,
    'centripetal',
  )
  const segments = chapters.length - 1

  // Hold each chapter's framing for a moment before travelling on, so the
  // camera "arrives" at each view while the text is being read.
  function pathParam(progress) {
    const f = clamp01(progress) * segments
    const i = Math.min(Math.floor(f), segments - 1)
    const local = f - i
    const travel = smooth(clamp01((local - 0.18) / 0.64))
    return (i + travel) / segments
  }

  // ---------------- State & loop ----------------

  const state = {
    progress: 0,
    progressTarget: 0,
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
    mood: 0,
    moodTarget: 0,
    active: true,
    frame: 0,
    last: 0,
    width: 1,
    height: 1,
    portrait: false,
  }

  const camPos = new THREE.Vector3()
  const camTarget = new THREE.Vector3()
  const right = new THREE.Vector3()
  const camUp = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const tmpColor = new THREE.Color()

  function applyMood(t) {
    const a = MOODS.dusk
    const b = MOODS.night
    sky.uniforms.topColor.value.copy(a.skyTop).lerp(b.skyTop, t)
    sky.uniforms.horizonColor.value.copy(a.skyHorizon).lerp(b.skyHorizon, t)
    sky.uniforms.glowColor.value.copy(a.sunGlow).lerp(b.sunGlow, t)
    sky.uniforms.glowStrength.value = lerp(a.sunStrength, b.sunStrength, t)
    scene.fog.color.copy(a.fog).lerp(b.fog, t)
    hemi.intensity = lerp(a.hemi, b.hemi, t)
    key.color.copy(tmpColor.copy(a.key).lerp(b.key, t))
    key.intensity = lerp(a.keyIntensity, b.keyIntensity, t)
    interior.emissiveIntensity = lerp(a.interior, b.interior, t)
    for (const lamp of lamps) lamp.intensity = lerp(a.lamps, b.lamps, t) * (high ? 1 : 1.6)
    cityMat.opacity = lerp(a.city, b.city, t)
    towerMat.emissiveIntensity = lerp(0.55, 1.1, t)
    starMat.opacity = lerp(a.stars, b.stars, t)
    for (const m of glowMaterials) m.opacity = m.userData.baseOpacity * lerp(0.85, 1.15, t)
    renderer.toneMappingExposure = lerp(a.exposure, b.exposure, t)
  }

  function updateCamera() {
    const p = pathParam(state.progress)
    posCurve.getPoint(p, camPos)
    targetCurve.getPoint(p, camTarget)

    // Portrait screens: step back along the view axis so the house still fits
    if (state.portrait) {
      forward.subVectors(camPos, camTarget)
      camPos.addScaledVector(forward, 0.45)
    }

    camera.position.copy(camPos)
    camera.lookAt(camTarget)

    // Pointer parallax in the camera's own frame — a gentle head movement
    if (state.pointer.lengthSq() > 1e-6) {
      right.setFromMatrixColumn(camera.matrix, 0)
      camUp.setFromMatrixColumn(camera.matrix, 1)
      camera.position.addScaledVector(right, state.pointer.x * 0.9)
      camera.position.addScaledVector(camUp, state.pointer.y * 0.45)
      camera.lookAt(camTarget)
    }
  }

  function render() {
    updateCamera()
    renderer.render(scene, camera)
    if (onRender) onRender(project, state.progress)
  }

  function project(position) {
    tmp.set(position[0], position[1], position[2]).project(camera)
    return {
      x: (tmp.x * 0.5 + 0.5) * state.width,
      y: (-tmp.y * 0.5 + 0.5) * state.height,
      visible: tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05,
    }
  }

  function tick(now) {
    state.frame = 0
    if (!state.active) return
    const dt = Math.min((now - (state.last || now)) / 1000, 0.1)
    state.last = now

    // Frame-rate independent damping
    const kProgress = 1 - Math.exp(-dt * 5)
    const kPointer = 1 - Math.exp(-dt * 3)
    const kMood = 1 - Math.exp(-dt * 2.5)

    state.progress += (state.progressTarget - state.progress) * kProgress
    state.pointer.lerp(state.pointerTarget, kPointer)
    state.mood += (state.moodTarget - state.mood) * kMood
    applyMood(state.mood)
    render()

    const settled =
      Math.abs(state.progressTarget - state.progress) < 1e-4 &&
      state.pointer.distanceToSquared(state.pointerTarget) < 1e-6 &&
      Math.abs(state.moodTarget - state.mood) < 1e-3

    if (settled) {
      state.progress = state.progressTarget
      state.pointer.copy(state.pointerTarget)
      state.mood = state.moodTarget
      state.last = 0
      applyMood(state.mood)
      render()
      return
    }
    state.frame = requestAnimationFrame(tick)
  }

  function invalidate() {
    if (!state.frame && state.active) state.frame = requestAnimationFrame(tick)
  }

  function resize(width, height) {
    state.width = Math.max(1, width)
    state.height = Math.max(1, height)
    const aspect = state.width / state.height
    state.portrait = aspect < 0.85
    camera.aspect = aspect
    camera.fov = aspect < 0.85 ? 50 : aspect < 1.3 ? 42 : 35
    // On portrait screens the chapter text sits in the lower half, so shift
    // the optical centre up to keep the subject in the visible area.
    if (state.portrait) camera.setViewOffset(state.width, state.height, 0, state.height * 0.16, state.width, state.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    renderer.setSize(state.width, state.height, false)
    render()
  }

  // ---------------- Context loss ----------------

  const onLost = (event) => {
    event.preventDefault()
    state.active = false
    if (onContextLost) onContextLost()
  }
  canvas.addEventListener('webglcontextlost', onLost)

  applyMood(0)

  return {
    setProgress(value, { instant = false } = {}) {
      state.progressTarget = clamp01(value)
      if (instant) state.progress = state.progressTarget
      invalidate()
    },
    setPointer(x, y) {
      state.pointerTarget.set(x, y)
      invalidate()
    },
    setMood(value, { instant = false } = {}) {
      state.moodTarget = value
      if (instant) {
        state.mood = value
        applyMood(value)
      }
      invalidate()
    },
    setActive(active) {
      state.active = active
      if (active) invalidate()
      else if (state.frame) {
        cancelAnimationFrame(state.frame)
        state.frame = 0
        state.last = 0
      }
    },
    resize,
    render,
    dispose() {
      state.active = false
      if (state.frame) cancelAnimationFrame(state.frame)
      canvas.removeEventListener('webglcontextlost', onLost)
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material?.dispose?.()
      })
      for (const texture of disposables) texture.dispose()
      envTarget.dispose()
      renderer.dispose()
    },
  }
}
