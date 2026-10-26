// Sky, sun, fog and reflections, all keyed to scroll progress: dawn over untouched land,
// clear daylight through construction, golden hour for the reveal, blue hour for the handoff.

import * as THREE from 'three'
import { clamp01, lerp, smooth } from './util.js'

const C = (hex) => new THREE.Color(hex)

// Lighting keyframes. elev/azim in degrees (azimuth 0 = from +z/south, 90 = from +x/east).
const KEYS = [
  { p: 0.0, elev: 9, azim: 112, sun: C('#ffc28c'), sunI: 3.0, top: C('#5a82bc'), hor: C('#f0cfa8'), fog: C('#dcc9b0'), hemi: 0.42, exp: 0.95, near: 260, far: 2600, cloud: 0.55 },
  { p: 0.12, elev: 21, azim: 122, sun: C('#ffe0ba'), sunI: 3.6, top: C('#4b7cc2'), hor: C('#dfd6c8'), fog: C('#d0ccc2'), hemi: 0.5, exp: 0.92, near: 280, far: 2600, cloud: 0.5 },
  { p: 0.45, elev: 48, azim: 160, sun: C('#fff3e2'), sunI: 4.0, top: C('#4479c4'), hor: C('#c9dae8'), fog: C('#c6d2dc'), hemi: 0.55, exp: 0.9, near: 300, far: 2800, cloud: 0.45 },
  { p: 0.72, elev: 30, azim: 232, sun: C('#ffe6c4'), sunI: 3.8, top: C('#477abd'), hor: C('#d9d6cb'), fog: C('#cfcabe'), hemi: 0.52, exp: 0.92, near: 290, far: 2700, cloud: 0.5 },
  { p: 0.86, elev: 11, azim: 250, sun: C('#ffb874'), sunI: 4.3, top: C('#58709f'), hor: C('#f2b47e'), fog: C('#dcae8c'), hemi: 0.72, exp: 1.08, near: 260, far: 2400, cloud: 0.6 },
  { p: 0.93, elev: 2.5, azim: 258, sun: C('#ff9460'), sunI: 2.0, top: C('#34406c'), hor: C('#e3966e'), fog: C('#9a7a7a'), hemi: 0.42, exp: 1.2, near: 220, far: 2100, cloud: 0.65 },
  { p: 1.0, elev: -3, azim: 262, sun: C('#ff8250'), sunI: 0.25, top: C('#1c2850'), hor: C('#6a5f7c'), fog: C('#4a4860'), hemi: 0.42, exp: 1.55, near: 180, far: 1800, cloud: 0.55 },
]

function sampleKeys(p, out) {
  let i = 0
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = smooth(clamp01((p - a.p) / (b.p - a.p)))
  for (const k of ['elev', 'azim', 'sunI', 'hemi', 'exp', 'near', 'far', 'cloud']) out[k] = lerp(a[k], b[k], t)
  for (const k of ['sun', 'top', 'hor', 'fog']) (out[k] ??= new THREE.Color()).lerpColors(a[k], b[k], t)
  return out
}

export function sunDirection(elev, azim, out = new THREE.Vector3()) {
  const e = THREE.MathUtils.degToRad(elev)
  const a = THREE.MathUtils.degToRad(azim)
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize()
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color('#4a4b3e') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uCloud: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uGround, uSunDir, uSunColor;
      uniform float uCloud;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.62, h), 0.7));
        float s = max(dot(d, uSunDir), 0.0);
        // Mie-like glow around the sun, stronger near the horizon
        col += uSunColor * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.5) * (1.0 - smoothstep(0.0, 0.6, h) * 0.5);
        // Sun disc
        col += uSunColor * smoothstep(0.99955, 0.99985, s) * 8.0 * step(-0.01, uSunDir.y + 0.02);
        // Thin high clouds, projected onto a dome
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 1.6;
          float c = smoothstep(0.5, 0.85, fbm(uv + vec2(3.1, 1.7))) * uCloud;
          c *= smoothstep(0.0, 0.18, h);
          vec3 lit = mix(uHorizon * 1.05, uSunColor * 1.2 + 0.15, pow(s, 3.0) * 0.8 + 0.2);
          col = mix(col, lit, c * 0.7);
        }
        col = mix(col, mix(uHorizon, uGround, 0.55), smoothstep(0.0, -0.08, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

export function createAtmosphere({ renderer, scene, quality }) {
  const high = quality === 'high'
  const state = {}

  // Sky dome (follows the camera)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMaterial())
  sky.scale.setScalar(2400)
  sky.frustumCulled = false
  sky.renderOrder = -10
  scene.add(sky)

  scene.fog = new THREE.Fog('#cfcabf', 160, 1500)

  const hemi = new THREE.HemisphereLight('#c7d8f2', '#56513f', 0.7)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight('#ffffff', 3)
  sun.castShadow = true
  const mapSize = high ? 3072 : 2048
  sun.shadow.mapSize.set(mapSize, mapSize)
  sun.shadow.bias = -0.00025
  sun.shadow.normalBias = 0.035
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 900
  scene.add(sun, sun.target)

  // Environment for reflections: the sky itself plus soft "lightformer" panels,
  // captured into PMREM at a few points along the timeline (Toran uses the same idea).
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial())
  envScene.add(envSky)
  const panel = (color, intensity, pos, scale) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.scale.set(...scale)
    m.lookAt(0, 0, 0)
    envScene.add(m)
    return m
  }
  const groundPanel = panel('#5d5a45', 0.6, [0, -6, 0], [30, 30, 1])
  const keyPanel = panel('#ffe4c0', 2.2, [6, 4, 5], [6, 3, 1])
  const envTargets = []
  const envPoints = [0.0, 0.3, 0.62, 0.84, 0.92, 1.0]
  const tmpState = {}
  const tmpDir = new THREE.Vector3()

  function applySkyUniforms(u, s) {
    u.uTop.value.copy(s.top)
    u.uHorizon.value.copy(s.hor)
    u.uSunColor.value.copy(s.sun).multiplyScalar(Math.max(0.2, Math.min(1, s.sunI / 2.5)))
    sunDirection(s.elev, s.azim, u.uSunDir.value)
    u.uCloud.value = s.cloud
  }

  function buildEnvMaps() {
    for (const p of envPoints) {
      sampleKeys(p, tmpState)
      applySkyUniforms(envSky.material.uniforms, tmpState)
      sunDirection(tmpState.elev, tmpState.azim, tmpDir)
      keyPanel.position.copy(tmpDir).multiplyScalar(8)
      keyPanel.lookAt(0, 0, 0)
      keyPanel.material.color.copy(tmpState.sun).multiplyScalar(0.8 * Math.max(0.15, tmpState.sunI / 3))
      groundPanel.material.color.set('#5d5a45').multiplyScalar(0.25 + 0.35 * Math.min(1, tmpState.sunI / 3))
      envTargets.push(pmrem.fromScene(envScene, 0.02))
    }
  }

  const focus = new THREE.Vector3()
  const lightSpace = new THREE.Matrix4()
  const inv = new THREE.Matrix4()
  const tmp = new THREE.Vector3()
  let envIndex = -1

  function update(p, camera, target) {
    sampleKeys(p, state)
    applySkyUniforms(sky.material.uniforms, state)
    sky.position.copy(camera.position)
    scene.fog.color.copy(state.fog)
    scene.fog.near = state.near
    scene.fog.far = state.far
    hemi.intensity = state.hemi
    hemi.color.copy(state.top).lerp(new THREE.Color('#ffffff'), 0.45)
    sun.color.copy(state.sun)
    sun.intensity = state.sunI
    renderer.toneMappingExposure = state.exp

    // Shadow frustum follows what the camera is looking at, sized to the view distance,
    // and snaps to shadow-map texels so edges do not crawl while the camera moves.
    const dist = camera.position.distanceTo(target)
    const size = THREE.MathUtils.clamp(dist * 0.85, 26, 230)
    sunDirection(Math.max(state.elev, 3), state.azim, tmp)
    focus.copy(target)
    lightSpace.lookAt(tmp, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0))
    inv.copy(lightSpace).invert()
    focus.applyMatrix4(inv)
    const texel = (size * 2) / mapSize
    focus.x = Math.round(focus.x / texel) * texel
    focus.y = Math.round(focus.y / texel) * texel
    focus.applyMatrix4(lightSpace)
    sun.target.position.copy(focus)
    sun.position.copy(focus).addScaledVector(tmp, 400)
    sun.target.updateMatrixWorld()
    const cam = sun.shadow.camera
    if (cam.right !== size) {
      cam.left = -size
      cam.right = size
      cam.top = size
      cam.bottom = -size
      cam.far = 900
      cam.updateProjectionMatrix()
    }

    // Reflections: nearest captured environment.
    let best = 0
    for (let i = 1; i < envPoints.length; i++) if (Math.abs(envPoints[i] - p) < Math.abs(envPoints[best] - p)) best = i
    if (best !== envIndex && envTargets[best]) {
      envIndex = best
      scene.environment = envTargets[best].texture
    }
    scene.environmentIntensity = lerp(0.62, 0.45, smooth(clamp01((p - 0.86) / 0.12)))
    return state
  }

  return {
    sun,
    update,
    buildEnvMaps,
    dispose() {
      for (const t of envTargets) t.dispose()
      pmrem.dispose()
      sky.geometry.dispose()
      sky.material.dispose()
      envScene.traverse((o) => {
        o.geometry?.dispose()
        o.material?.dispose()
      })
    },
  }
}
