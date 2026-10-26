// Materials for the estate.
//
// Every construction element carries its schedule in vertex attributes:
//   aBuild = (inStart, inEnd, outStart, outEnd)  in scroll progress
//   aRise  = 0..1 along the element's build direction (bottom → top, or along a pour)
//   aGround = world height of the ground the element stands on
// One shared uniform (uP, the timeline) then decides, per fragment, how much of each
// element exists. Walls rise course by course, slabs pour across their rebar,
// formwork comes down top-first. It is a pure function of progress, so scrolling
// backwards un-builds the estate exactly.

import * as THREE from 'three'

export function createTimelineUniforms() {
  return { uP: { value: 0 } }
}

// GLSL shared by colour and depth passes.
const BUILD_VERTEX_PARS = /* glsl */ `
  attribute vec4 aBuild;
  attribute float aRise;
  attribute float aGround;
  varying vec4 vBuild;
  varying float vRise;
  varying float vAbove;
`

const BUILD_VERTEX = /* glsl */ `
  vBuild = aBuild;
  vRise = aRise;
  vAbove = (modelMatrix * vec4(transformed, 1.0)).y - aGround;
`

const BUILD_FRAGMENT_PARS = /* glsl */ `
  uniform float uP;
  varying vec4 vBuild;
  varying float vRise;
  varying float vAbove;
  float buildSpan(float a, float b) { return clamp((uP - a) / max(b - a, 1e-4), 0.0, 1.0); }
`

// Discard what has not been built yet (or has already been removed).
const BUILD_DISCARD = /* glsl */ `
  float bIn = buildSpan(vBuild.x, vBuild.y);
  float bOut = buildSpan(vBuild.z, vBuild.w);
  float bLimit = min(bIn, 1.0 - bOut);
  if (bLimit <= 0.0 || vRise > bLimit + 1e-4) discard;
  float bFresh = (1.0 - smoothstep(0.0, 0.07, bLimit - vRise)) * (1.0 - step(0.999, bIn));
`

// World-space triplanar mapping (texture scale is identical on every merged part).
const TRI_VERTEX_PARS = /* glsl */ `
  varying vec3 vTriPos;
  varying vec3 vTriNormal;
`
const TRI_VERTEX = /* glsl */ `
  vTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vTriNormal = normalize(mat3(modelMatrix) * objectNormal);
`
const TRI_FRAGMENT_PARS = /* glsl */ `
  uniform sampler2D uTriMap;
  uniform float uTriScale;
  uniform float uBump;
  varying vec3 vTriPos;
  varying vec3 vTriNormal;
  vec4 triSample(vec3 p, vec3 n) {
    vec3 w = pow(abs(n), vec3(5.0));
    w /= (w.x + w.y + w.z);
    vec3 tp = p * uTriScale;
    return texture2D(uTriMap, tp.zy) * w.x + texture2D(uTriMap, tp.xz) * w.y + texture2D(uTriMap, tp.xy) * w.z;
  }
  // Bump from the albedo's luminance, using screen-space derivatives.
  vec3 bumpFromHeight(vec3 surfPos, vec3 surfNormal, float h, float scale) {
    vec3 sx = dFdx(surfPos);
    vec3 sy = dFdy(surfPos);
    vec3 r1 = cross(sy, surfNormal);
    vec3 r2 = cross(surfNormal, sx);
    float det = dot(sx, r1);
    vec2 dh = vec2(dFdx(h), dFdy(h)) * scale;
    vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
    vec3 n = abs(det) * surfNormal - grad;
    float len = length(n);
    // Degenerate derivatives (grazing angles) would give NaN, which bloom spreads across the frame.
    return len > 1e-8 && abs(det) > 1e-10 ? n / len : surfNormal;
  }
`

/**
 * A MeshStandardMaterial with the build reveal and (optionally) triplanar texturing.
 *  map + metresPerTile → world-space triplanar albedo
 *  wet → fresh concrete darkens and glosses near the pour front
 *  cap → back faces render as a flat cut face (no hollow interiors while rising)
 */
export function buildMaterial(uniforms, opts = {}) {
  const {
    map = null,
    metresPerTile = 2,
    bump = 0.6,
    wet = 0,
    cap = true,
    contact = 0.55,
    uv = false,
    ...standard
  } = opts
  const material = new THREE.MeshStandardMaterial({ side: cap ? THREE.DoubleSide : THREE.FrontSide, ...standard })
  if (uv && map) material.map = map
  const tri = Boolean(map) && !uv
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uP = uniforms.uP
    shader.uniforms.uWet = { value: wet }
    shader.uniforms.uContact = { value: contact }
    if (tri) {
      shader.uniforms.uTriMap = { value: map }
      shader.uniforms.uTriScale = { value: 1 / metresPerTile }
      shader.uniforms.uBump = { value: bump }
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BUILD_VERTEX_PARS}\n${tri ? TRI_VERTEX_PARS : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${BUILD_VERTEX}\n${tri ? TRI_VERTEX : ''}`)
    let frag = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${BUILD_FRAGMENT_PARS}\nuniform float uWet;\nuniform float uContact;\n${tri ? TRI_FRAGMENT_PARS : ''}`,
      )
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${BUILD_DISCARD}`)
    if (tri) {
      frag = frag
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          vec4 triTex = triSample(vTriPos, vTriNormal);
          diffuseColor *= triTex;
          float triLum = dot(triTex.rgb, vec3(0.299, 0.587, 0.114));`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor * mix(1.15, 0.85, triLum), 0.03, 1.0);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
          // Fade the albedo bump with distance to avoid shimmering on far surfaces.
          float bumpFade = 1.0 - smoothstep(18.0, 90.0, length(vViewPosition));
          if (bumpFade > 0.0) normal = bumpFromHeight(-vViewPosition, normal, triLum, uBump * 0.02 * bumpFade);`,
        )
    }
    frag = frag
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        // A rising wall or pouring slab shows its solid cut face, not its hollow inside.
        if (!gl_FrontFacing) normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        diffuseColor.rgb *= 1.0 - bFresh * uWet * 0.38;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, bFresh * uWet);`,
      )
      .replace(
        '#include <aomap_fragment>',
        /* glsl */ `#include <aomap_fragment>
        // Ground-contact occlusion: soft darkening where walls and plinths meet the ground.
        float contactAO = mix(1.0 - uContact, 1.0, smoothstep(0.0, 0.9, vAbove));
        reflectedLight.indirectDiffuse *= contactAO;
        reflectedLight.indirectSpecular *= mix(1.0, contactAO, 0.6);
        reflectedLight.directDiffuse *= mix(1.0, contactAO, 0.35);`,
      )
    shader.fragmentShader = frag
  }
  material.customProgramCacheKey = () => `build-${tri ? 'tri' : 'plain'}-${uv ? 'uv' : 'nouv'}`
  return material
}

// Shadow-pass twin: the same reveal, so unbuilt parts cast no shadow.
export function buildDepthMaterial(uniforms) {
  const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uP = uniforms.uP
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BUILD_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${BUILD_VERTEX}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${BUILD_FRAGMENT_PARS}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${BUILD_DISCARD}`)
  }
  material.customProgramCacheKey = () => 'build-depth'
  return material
}

// ---------------------------------------------------------------------------
// Growth for instanced vegetation: aGrow = (growStart, growEnd, cutStart, cutEnd)
// ---------------------------------------------------------------------------

const GROW_VERTEX = /* glsl */ `
  float gIn = clamp((uP - aGrow.x) / max(aGrow.y - aGrow.x, 1e-4), 0.0, 1.0);
  float gOut = clamp((uP - aGrow.z) / max(aGrow.w - aGrow.z, 1e-4), 0.0, 1.0);
  float gScale = gIn * gIn * (3.0 - 2.0 * gIn) * (1.0 - gOut);
  transformed *= gScale;
`

// fade: [near, far] metres — shrink instances away with camera distance (grass), so
// tufts never read as dark scribbles in aerial views.
export function growthPatch(material, uniforms, key, { fade = null } = {}) {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    shader.uniforms.uP = uniforms.uP
    const fadeCode = fade
      ? `float gDist = length((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz - cameraPosition);
         transformed *= 1.0 - smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, gDist);`
      : ''
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aGrow;\nuniform float uP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GROW_VERTEX}\n${fadeCode}`)
  }
  material.customProgramCacheKey = () => `grow-${key}`
  return material
}

export function growthDepthMaterial(uniforms, { map = null, alphaTest = 0 } = {}) {
  const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest, side: THREE.DoubleSide })
  return growthPatch(material, uniforms, `depth-${map ? 'alpha' : 'solid'}`)
}

// ---------------------------------------------------------------------------
// Terrain: meadow → cleared soil → excavation → finished lawn, all in one surface
// ---------------------------------------------------------------------------

// plan: { plots: [{ cx, cz, hw, hd }], road: { halfWidth, z0, cz, r } } for the land-stage overlay
export function terrainMaterial(uniforms, { meadow, soil, lawn, gravel }, plan) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 })
  const plots = plan.plots.map((r) => new THREE.Vector4(r.cx, r.cz, r.hw, r.hd))
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uP: uniforms.uP,
      uMeadow: { value: meadow },
      uSoil: { value: soil },
      uLawn: { value: lawn },
      uGravel: { value: gravel },
      uPlots: { value: plots },
      uRoad: { value: new THREE.Vector4(plan.road.halfWidth, plan.road.z0, plan.road.cz, plan.road.r) },
    })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uP;
        attribute float aClear;
        attribute float aLawn;
        attribute vec3 aGrade;
        attribute vec4 aDig;
        varying float vClear;
        varying float vLawn;
        varying float vDisturb;
        varying float vDepth;
        varying vec3 vWorld;
        float tSpan(float a, float b) { float t = clamp((uP - a) / max(b - a, 1e-4), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float graded = aGrade.z * tSpan(aGrade.x, aGrade.y);
        float dug = aDig.w * (tSpan(aDig.x, aDig.y) - tSpan(aDig.z, aDig.z + 0.014));
        transformed.y += graded - dug;
        vClear = aClear;
        vLawn = aLawn;
        vDisturb = clamp(abs(aGrade.z) * tSpan(aGrade.x, aGrade.y) * 0.6 + dug * 1.5, 0.0, 1.0);
        vDepth = dug;
        vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uP;
        uniform sampler2D uMeadow;
        uniform sampler2D uSoil;
        uniform sampler2D uLawn;
        uniform sampler2D uGravel;
        uniform vec4 uPlots[${plots.length}];
        uniform vec4 uRoad;
        varying float vClear;
        varying float vLawn;
        varying float vDisturb;
        varying float vDepth;
        varying vec3 vWorld;
        float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm2(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.07; a *= 0.5; } return s; }
        float tSpanF(float a, float b) { float t = clamp((uP - a) / max(b - a, 1e-4), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
        float rectEdge(vec2 p, vec4 r) {
          vec2 d = abs(p - r.xy) - r.zw;
          return abs(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0));
        }
        // The master plan, set out on the land before any work: plot lines and road alignment.
        float planLines(vec2 p) {
          float d = 1e5;
          for (int i = 0; i < ${plots.length}; i++) d = min(d, rectEdge(p, uPlots[i]));
          float onSpine = step(uRoad.z, p.y) * step(p.y, uRoad.y);
          d = min(d, mix(1e5, abs(abs(p.x) - uRoad.x), onSpine));
          d = min(d, abs(length(p - vec2(0.0, uRoad.z)) - uRoad.w));
          float dash = step(0.35, fract((p.x + p.y) * 0.25));
          return (1.0 - smoothstep(0.25, 0.75, d)) * mix(0.55, 1.0, dash);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 wp = vWorld.xz;
        float macro = fbm2(wp * 0.018);
        float micro = fbm2(wp * 0.21);
        // Two scales of the same texture plus macro tint: no visible tiling from the air.
        vec3 meadowCol = mix(texture2D(uMeadow, wp / 7.0).rgb, texture2D(uMeadow, wp / 29.0 + 0.37).rgb, 0.45);
        meadowCol *= mix(vec3(0.86, 0.9, 0.8), vec3(1.12, 1.06, 0.88), macro);
        vec3 soilCol = mix(texture2D(uSoil, wp / 5.0).rgb, texture2D(uSoil, wp / 23.0 + 0.2).rgb, 0.35);
        soilCol *= mix(0.86, 1.08, micro) * (1.0 - clamp(vDepth, 0.0, 1.0) * 0.32);
        vec3 lawnCol = texture2D(uLawn, wp / 6.0).rgb * mix(0.92, 1.06, macro);
        // Clearing and turf laying advance with a slightly irregular edge.
        float edge = (micro - 0.5) * 0.012;
        float cleared = tSpanF(vClear + edge, vClear + 0.018 + edge);
        float turfed = tSpanF(vLawn + edge, vLawn + 0.02 + edge);
        vec3 ground = mix(meadowCol, soilCol, max(cleared, vDisturb) * (1.0 - turfed));
        ground = mix(ground, lawnCol, turfed);
        // Compacted, slightly gravelly ground where machines work.
        ground = mix(ground, texture2D(uGravel, wp / 4.0).rgb * 0.9, cleared * (1.0 - turfed) * 0.18);
        diffuseColor.rgb *= ground;
        float planFade = tSpanF(0.012, 0.045) * (1.0 - tSpanF(0.1, 0.135));
        if (planFade > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.6, 1.45, 1.2), planLines(wp) * planFade * 0.8);
        float wetSoil = cleared * (1.0 - turfed);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.82, wetSoil * 0.4);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        // Where grading or excavation has moved the ground, derive the normal from the moved surface.
        vec3 movedC = cross(dFdx(-vViewPosition), dFdy(-vViewPosition));
        float movedL = length(movedC);
        if (movedL > 1e-8) normal = normalize(mix(normal, movedC / movedL, smoothstep(0.02, 0.25, vDisturb)));`,
      )
  }
  material.customProgramCacheKey = () => 'terrain'
  return material
}
