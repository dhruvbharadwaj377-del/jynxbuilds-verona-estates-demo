// The VÉRONA estate, built in code with Three.js.
//
// Loaded lazily (dynamic import) so three.js never touches the initial bundle.
// Construction is spread over idle slices with a progress callback, shaders are
// compiled up front (compileAsync) and every timeline stage is rendered once before
// the canvas is revealed, so nothing compiles mid-scroll. Rendering is on demand:
// frames are drawn only while the damped progress is still settling.

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { createAtmosphere } from './estate/atmosphere.js'
import { Batch, clearGeometryCache } from './estate/batch.js'
import { fitFov, sampleCamera } from './estate/camera.js'
import { buildMachines } from './estate/machines.js'
import { buildDepthMaterial, buildMaterial, createTimelineUniforms, terrainMaterial } from './estate/materials.js'
import { BUILDINGS, LANE, laneLevel, ROAD, WORKS } from './estate/plan.js'
import { buildSite } from './estate/site.js'
import { buildTerrain } from './estate/terrain.js'
import * as T from './estate/textures.js'
import { buildVegetation } from './estate/vegetation.js'
import { buildVilla } from './estate/villa.js'
import { clamp01, lerp, span, yieldToMain } from './estate/util.js'

// Cinematic grade, applied after tone mapping (display-referred).
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uWarmth: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uWarmth;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // gentle filmic S-curve
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.16);
      // split tone: warm highlights, cool shadows
      c += vec3(0.022, 0.01, -0.018) * smoothstep(0.45, 1.0, l) * (1.0 + uWarmth);
      c += vec3(-0.01, 0.0, 0.016) * (1.0 - smoothstep(0.0, 0.42, l));
      // vignette
      vec2 q = vUv - 0.5;
      q.x *= uRes.x / uRes.y;
      c *= mix(0.8, 1.0, smoothstep(0.98, 0.3, length(q)));
      // static fine grain breaks up banding in the sky
      float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      c += g * 0.01;
      gl_FragColor = vec4(c, 1.0);
    }`,
}

const WARMUP = [0.0, 0.16, 0.3, 0.44, 0.6, 0.72, 0.84, 0.93, 1.0]

export async function createEstateScene({ canvas, quality = 'high', onProgress, onContextLost }) {
  const high = quality === 'high'
  const report = (f, label) => onProgress?.(clamp01(f), label)
  const disposables = []
  const track = (...items) => {
    disposables.push(...items)
    return items[0]
  }

  // ---------------- Renderer ----------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // MSAA happens in the composer's render target
    alpha: false,
    powerPreference: high ? 'high-performance' : 'default',
    stencil: false,
  })
  const isWebGL2 = renderer.capabilities.isWebGL2
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = true

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 4000)
  const uniforms = createTimelineUniforms()
  report(0.04, 'Preparing materials')
  await yieldToMain()

  // ---------------- Textures & materials ----------------
  const tex = {}
  const textureSteps = [
    ['concrete', T.concreteTexture],
    ['block', T.blockTexture],
    ['travertine', T.travertineTexture],
    ['render', T.renderTexture],
    ['timber', T.timberTexture],
    ['plywood', T.plywoodTexture],
    ['paver', T.paverTexture],
    ['mosaic', T.mosaicTexture],
    ['asphalt', T.asphaltTexture],
    ['gravel', T.gravelTexture],
    ['soil', T.soilTexture],
    ['meadow', T.meadowTexture],
    ['lawn', T.lawnTexture],
    ['hedge', T.hedgeTexture],
    ['interior', () => T.interiorTexture(3)],
    ['water', T.waterNormalTexture],
  ]
  for (let i = 0; i < textureSteps.length; i++) {
    const [key, make] = textureSteps[i]
    tex[key] = track(make())
    tex[key].anisotropy = Math.min(high ? 8 : 4, renderer.capabilities.getMaxAnisotropy())
    report(0.04 + (i / textureSteps.length) * 0.22, 'Preparing materials')
    await yieldToMain()
  }

  const depth = track(buildDepthMaterial(uniforms))
  const M = (opts) => track(buildMaterial(uniforms, opts))
  const mats = {
    concrete: M({ map: tex.concrete, metresPerTile: 2.4, roughness: 0.82, wet: 1, bump: 0.8 }),
    block: M({ map: tex.block, metresPerTile: 1.76, roughness: 0.9 }),
    stone: M({ map: tex.travertine, metresPerTile: 2.4, roughness: 0.58, bump: 0.5 }),
    render: M({ map: tex.render, metresPerTile: 3, roughness: 0.86, bump: 0.25 }),
    timber: M({ map: tex.timber, metresPerTile: 1.92, roughness: 0.55, bump: 0.6 }),
    formwork: M({ map: tex.plywood, metresPerTile: 2.4, roughness: 0.7 }),
    paver: M({ map: tex.paver, metresPerTile: 2.4, roughness: 0.72, bump: 0.5 }),
    coping: M({ map: tex.travertine, metresPerTile: 1.2, roughness: 0.5 }),
    tile: M({ map: tex.mosaic, metresPerTile: 0.8, roughness: 0.18, bump: 0.3 }),
    asphalt: M({ map: tex.asphalt, metresPerTile: 3, roughness: 0.9, bump: 0.5 }),
    gravel: M({ map: tex.gravel, metresPerTile: 1.6, roughness: 0.96, bump: 0.9 }),
    hedge: M({ map: tex.hedge, metresPerTile: 1.2, roughness: 0.92, bump: 1.2, contact: 0.3 }),
    hoarding: M({ map: tex.render, metresPerTile: 3, color: '#3d4a40', roughness: 0.6 }),
    cabin: M({ map: tex.render, metresPerTile: 3, color: '#dcd8cc', roughness: 0.5 }),
    metal: M({ color: '#1e1e1f', roughness: 0.34, metalness: 0.75 }),
    rebar: M({ color: '#6e4a33', roughness: 0.62, metalness: 0.55, contact: 0.2 }),
    prop: M({ color: '#a5aaad', roughness: 0.38, metalness: 0.85, contact: 0.2 }),
    paint: M({ color: '#f2eee6', roughness: 0.5, contact: 0 }),
    crane: M({ color: '#e1a91f', roughness: 0.48, metalness: 0.35, contact: 0 }),
    bronze: M({ color: '#7d5b37', roughness: 0.38, metalness: 0.85, contact: 0 }),
    glass: M({ color: '#26323a', roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, envMapIntensity: 2.2, contact: 0 }),
    interior: M({ uv: true, map: tex.interior, color: '#2a2018', emissive: '#ffffff', emissiveMap: tex.interior, emissiveIntensity: 0.3, roughness: 0.9, contact: 0 }),
    lamp: M({ color: '#f3ead8', emissive: '#ffcf8f', emissiveIntensity: 0, roughness: 0.4, contact: 0 }),
  }
  const B = {}
  for (const [key, material] of Object.entries(mats)) B[key] = new Batch(key, material, depth)

  // ---------------- Buildings & site ----------------
  const planted = []
  const pools = []
  for (let i = 0; i < BUILDINGS.length; i++) {
    const v = buildVilla(BUILDINGS[i], B)
    planted.push(...v.trees)
    pools.push(...v.pools)
    report(0.26 + (i / BUILDINGS.length) * 0.24, 'Raising the estate')
    await yieldToMain()
  }
  const site = buildSite(B, uniforms, { crane: mats.crane, depth })
  planted.push(...site.trees)
  for (const m of site.meshes) scene.add(m)
  scene.traverse((o) => o.geometry && disposables.push(o.geometry))

  const noShadow = new Set(['glass', 'interior', 'lamp', 'paint', 'tile'])
  for (const [key, batch] of Object.entries(B)) {
    const mesh = batch.toMesh({ castShadow: !noShadow.has(key) })
    if (!mesh) continue
    if (key === 'glass') mesh.renderOrder = 2
    mesh.frustumCulled = false
    scene.add(mesh)
    disposables.push(mesh.geometry)
  }
  clearGeometryCache()
  report(0.55, 'Shaping the land')
  await yieldToMain()

  // ---------------- Terrain ----------------
  const ground = track(
    terrainMaterial(
      uniforms,
      { meadow: tex.meadow, soil: tex.soil, lawn: tex.lawn, gravel: tex.gravel },
      { plots: BUILDINGS.map((b) => b.plotRect), road: { halfWidth: ROAD.halfWidth, z0: ROAD.z0, cz: ROAD.circle.z, r: ROAD.circle.r } },
    ),
  )
  const terrain = await buildTerrain(ground, { dense: high ? 1 : 2 })
  scene.add(terrain)
  disposables.push(terrain.geometry)
  report(0.68, 'Planting')

  // Existing country lane outside the gate (present throughout)
  {
    const lane = new Batch('lane', mats.asphalt, depth)
    for (let z = LANE.z0; z < LANE.z1; z += 4) {
      const y0 = laneLevel(z)
      const y1 = laneLevel(z + 4)
      const g = new THREE.BoxGeometry(LANE.halfWidth * 2, 0.6, 4.05)
      g.translate(0, -0.3, 2)
      const m = new THREE.Matrix4().makeTranslation(0, (y0 + y1) / 2 + 0.02, z).multiply(new THREE.Matrix4().makeRotationX(-Math.atan2(y1 - y0, 4)))
      lane.add(g, m, { in: [-2, -1.9], ground: y0 })
      g.dispose()
    }
    const laneMesh = lane.toMesh({ castShadow: false })
    laneMesh.frustumCulled = false
    scene.add(laneMesh)
    disposables.push(laneMesh.geometry)
  }

  // ---------------- Vegetation, water, machines ----------------
  const vegetation = await buildVegetation({ uniforms, planted, quality })
  for (const m of vegetation.meshes) scene.add(m)
  report(0.8, 'Bringing in the machines')
  await yieldToMain()

  const waterMat = track(
    new THREE.MeshStandardMaterial({
      color: '#4f9fa6',
      roughness: 0.05,
      metalness: 0.05,
      normalMap: tex.water,
      normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true,
      opacity: 0.86,
      envMapIntensity: 1.8,
    }),
  )
  tex.water.repeat.set(0.35, 0.35)
  const waterMeshes = pools.map((pool) => {
    const g = track(new THREE.PlaneGeometry(pool.x1 - pool.x0 - 0.04, pool.z1 - pool.z0 - 0.04))
    g.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(g, waterMat)
    mesh.matrixAutoUpdate = false
    mesh.receiveShadow = true
    mesh.userData = pool
    scene.add(mesh)
    return mesh
  })
  const waterLocal = new THREE.Matrix4()
  function updateWater(p) {
    for (const mesh of waterMeshes) {
      const pool = mesh.userData
      const f = span(p, pool.fill[0], pool.fill[1])
      mesh.visible = f > 0.002
      if (!mesh.visible) continue
      waterLocal.makeTranslation((pool.x0 + pool.x1) / 2, lerp(pool.bottom + 0.02, pool.top, f), (pool.z0 + pool.z1) / 2)
      mesh.matrix.multiplyMatrices(pool.frame, waterLocal)
      mesh.matrixWorldNeedsUpdate = true
    }
  }

  const machines = buildMachines()
  scene.add(machines.group)
  report(0.86, 'Lighting')
  await yieldToMain()

  // ---------------- Light & post ----------------
  const atmosphere = createAtmosphere({ renderer, scene, quality })
  atmosphere.buildEnvMaps()

  const size = new THREE.Vector2(1, 1)
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isWebGL2 ? (high ? 4 : 2) : 0 })
  const composer = new EffectComposer(renderer, rt)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = high ? new UnrealBloomPass(new THREE.Vector2(1, 1), 0.0, 0.35, 1.6) : null
  if (bloom) composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const grade = new ShaderPass(GradeShader)
  composer.addPass(grade)

  // ---------------- State & frame ----------------
  const state = { progress: 0, target: 0, active: true, frame: 0, last: 0, width: 1, height: 1, ready: false }
  const camPos = new THREE.Vector3()
  const camLook = new THREE.Vector3()
  const updaters = [...site.update]

  function apply(p) {
    uniforms.uP.value = p
    const designFov = sampleCamera(p, camPos, camLook)
    camera.position.copy(camPos)
    camera.lookAt(camLook)
    const fov = fitFov(designFov, state.width / state.height)
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    atmosphere.update(p, camera, camLook)
    const dusk = span(p, WORKS.dusk[0], WORKS.dusk[1])
    mats.interior.emissiveIntensity = lerp(0.35, 2.4, dusk)
    mats.lamp.emissiveIntensity = lerp(0, 8, dusk)
    mats.glass.opacity = lerp(0.38, 0.26, dusk) // reflections give way to the lit rooms
    if (bloom) {
      bloom.strength = lerp(0.0, 0.32, dusk)
      bloom.enabled = dusk > 0.001 // no cost until the lights come on
    }
    grade.uniforms.uWarmth.value = span(p, 0.8, 0.93)
    machines.update(p)
    vegetation.update(camera)
    for (const u of updaters) u(p)
    updateWater(p)
  }

  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
  if (debug) renderer.info.autoReset = false // count every pass of a frame, not just the last

  function render() {
    apply(state.progress)
    if (debug) renderer.info.reset()
    composer.render()
  }

  function tick(now) {
    state.frame = 0
    if (!state.active || !state.ready) return
    const dt = Math.min((now - (state.last || now)) / 1000, 0.1)
    state.last = now
    state.progress += (state.target - state.progress) * (1 - Math.exp(-dt * 4.5))
    const settled = Math.abs(state.target - state.progress) < 2e-5
    if (settled) {
      state.progress = state.target
      state.last = 0
    }
    render()
    if (!settled) state.frame = requestAnimationFrame(tick)
  }

  function invalidate() {
    if (!state.frame && state.active && state.ready) state.frame = requestAnimationFrame(tick)
  }

  function resize(width, height) {
    state.width = Math.max(1, width)
    state.height = Math.max(1, height)
    camera.aspect = state.width / state.height
    camera.updateProjectionMatrix()
    renderer.setSize(state.width, state.height, false)
    renderer.getDrawingBufferSize(size)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(state.width, state.height)
    grade.uniforms.uRes.value.set(size.x, size.y)
    if (state.ready) render()
  }

  const onLost = (event) => {
    event.preventDefault()
    state.active = false
    onContextLost?.()
  }
  canvas.addEventListener('webglcontextlost', onLost)

  // ---------------- Compile & warm up ----------------
  report(0.9, 'Compiling')
  apply(0)
  try {
    await renderer.compileAsync(scene, camera)
  } catch {
    // Older browsers: shaders compile on first render instead.
  }
  for (let i = 0; i < WARMUP.length; i++) {
    apply(WARMUP[i])
    composer.render()
    report(0.92 + (i / WARMUP.length) * 0.08, 'Compiling')
    await yieldToMain()
  }

  if (debug) window.__verona = { renderer, scene, camera, state }

  return {
    start(progress) {
      state.progress = state.target = clamp01(progress)
      state.ready = true
      render()
      report(1, 'Ready')
    },
    setProgress(value, { instant = false } = {}) {
      state.target = clamp01(value)
      if (instant) state.progress = state.target
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
    get info() {
      return renderer.info
    },
    dispose() {
      state.active = false
      if (state.frame) cancelAnimationFrame(state.frame)
      canvas.removeEventListener('webglcontextlost', onLost)
      atmosphere.dispose()
      vegetation.dispose()
      machines.dispose()
      composer.dispose()
      rt.dispose()
      bloom?.dispose()
      for (const d of disposables) d?.dispose?.()
      renderer.dispose()
      if (debug) delete window.__verona
    },
  }
}
