// Procedural material textures, painted into canvases at startup.
//
// Every texture tiles seamlessly (periodic noise), so world-space triplanar mapping
// can repeat it across the whole estate. Colour textures carry the real albedo;
// materials keep their colour at white unless a tint is wanted.

import * as THREE from 'three'
import { mulberry32 } from './util.js'

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d', { willReadFrequently: true }) }
}

function toTexture(c, { color = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

// Periodic value noise on a lattice of `period` cells, so it tiles exactly.
function periodicNoise(seed) {
  const rnd = mulberry32(seed)
  const table = new Float32Array(256 * 256)
  for (let i = 0; i < table.length; i++) table[i] = rnd()
  return (x, y, period) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const x0 = ((xi % period) + period) % period
    const y0 = ((yi % period) + period) % period
    const x1 = (x0 + 1) % period
    const y1 = (y0 + 1) % period
    const a = table[y0 * 256 + x0]
    const b = table[y0 * 256 + x1]
    const c = table[y1 * 256 + x0]
    const d = table[y1 * 256 + x1]
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v
  }
}

// Fill a canvas pixel by pixel. fn(u, v) returns [r, g, b] (0..255) or [r, g, b, a].
function paint(size, fn, h = size) {
  const { c, ctx } = makeCanvas(size, h)
  const img = ctx.createImageData(size, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < size; x++) {
      const px = fn(x / size, y / h, x, y)
      const i = (y * size + x) * 4
      d[i] = px[0]
      d[i + 1] = px[1]
      d[i + 2] = px[2]
      d[i + 3] = px.length > 3 ? px[3] : 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { c, ctx }
}

function fbmP(n, u, v, base, octaves) {
  let s = 0
  let a = 0.5
  let p = base
  for (let i = 0; i < octaves; i++) {
    s += a * n(u * p, v * p, p)
    a *= 0.5
    p *= 2
  }
  return s / (1 - Math.pow(0.5, octaves))
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)
const tone = (rgb, k) => [clamp255(rgb[0] * k), clamp255(rgb[1] * k), clamp255(rgb[2] * k)]

// ---------------------------------------------------------------------------
// Architectural surfaces
// ---------------------------------------------------------------------------

// Board-formed structural concrete: cool grey, cloudy, with pores and panel joints.
export function concreteTexture() {
  const n = periodicNoise(11)
  const g = periodicNoise(12)
  const rnd = mulberry32(13)
  const { c, ctx } = paint(512, (u, v) => {
    const cloud = fbmP(n, u, v, 4, 5)
    const grain = g(u * 128, v * 128, 128)
    const k = 0.86 + cloud * 0.22 + (grain - 0.5) * 0.08
    return tone([168, 166, 160], k)
  })
  // pores
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(60, 58, 54, ${0.15 + rnd() * 0.3})`
    ctx.beginPath()
    ctx.arc(rnd() * 512, rnd() * 512, 0.5 + rnd() * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  // formwork panel joints and tie holes (tile = 2.4 m, panels 1.2 m)
  ctx.fillStyle = 'rgba(70, 68, 64, 0.32)'
  for (const p of [0, 256]) {
    ctx.fillRect(p, 0, 1.5, 512)
    ctx.fillRect(0, p, 512, 1.5)
  }
  for (const x of [64, 192, 320, 448])
    for (const y of [64, 192, 320, 448]) {
      ctx.beginPath()
      ctx.arc(x, y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  return toTexture(c)
}

// Concrete masonry units with recessed mortar joints (tile = 1.76 m × 1.72 m: 4 × 8 blocks).
export function blockTexture() {
  const n = periodicNoise(21)
  const rnd = mulberry32(22)
  const { c, ctx } = paint(512, (u, v) => {
    const k = 0.84 + fbmP(n, u, v, 8, 4) * 0.2
    return tone([150, 148, 142], k)
  })
  const bw = 128
  const bh = 64
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? bw / 2 : 0
    for (let x = -off; x < 512; x += bw) {
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'}, ${rnd() * 0.06})`
      ctx.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4)
    }
  }
  ctx.fillStyle = 'rgba(90, 88, 84, 0.85)'
  for (let row = 0; row < 8; row++) {
    ctx.fillRect(0, row * bh, 512, 3)
    const off = row % 2 ? bw / 2 : 0
    for (let x = -off; x < 512; x += bw) ctx.fillRect(x, row * bh, 3, bh)
  }
  return toTexture(c)
}

// Honed travertine: warm, horizontally veined, with natural pitting and fine panel joints.
export function travertineTexture() {
  const n = periodicNoise(31)
  const vn = periodicNoise(32)
  const rnd = mulberry32(33)
  const { c, ctx } = paint(512, (u, v) => {
    const cloud = fbmP(n, u, v, 3, 4)
    const vein = Math.pow(Math.abs(Math.sin((v * 22 + fbmP(vn, u, v, 4, 3) * 3.5) * Math.PI)), 6)
    const k = 0.9 + cloud * 0.14 - vein * 0.07
    return tone([226, 210, 186], k)
  })
  for (let i = 0; i < 700; i++) {
    const x = rnd() * 512
    const y = rnd() * 512
    ctx.fillStyle = `rgba(150, 122, 92, ${0.18 + rnd() * 0.25})`
    ctx.beginPath()
    ctx.ellipse(x, y, 1 + rnd() * 4, 0.5 + rnd() * 1.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // 1.2 m × 0.6 m panels (tile = 2.4 m)
  ctx.fillStyle = 'rgba(120, 100, 78, 0.35)'
  for (let y = 0; y < 512; y += 128) ctx.fillRect(0, y, 512, 1.2)
  for (let y = 0; y < 512; y += 128) {
    const off = (y / 128) % 2 ? 128 : 0
    for (let x = off; x < 512; x += 256) ctx.fillRect(x, y, 1.2, 128)
  }
  return toTexture(c)
}

// Smooth mineral render: almost white, with a faint trowelled cloudiness.
export function renderTexture() {
  const n = periodicNoise(41)
  const g = periodicNoise(42)
  const { c } = paint(256, (u, v) => {
    const k = 0.95 + fbmP(n, u, v, 3, 4) * 0.06 + (g(u * 64, v * 64, 64) - 0.5) * 0.025
    return tone([238, 234, 226], k)
  })
  return toTexture(c)
}

// Oiled oak cladding boards, 12 cm wide, running vertically (tile = 1.92 m).
export function timberTexture() {
  const n = periodicNoise(51)
  const rnd = mulberry32(52)
  const boards = 16
  const tints = Array.from({ length: boards }, () => 0.82 + rnd() * 0.3)
  const { c } = paint(512, (u, v) => {
    const b = Math.floor(u * boards)
    const local = u * boards - b
    const grain = Math.sin((v * 40 + n(local * 3, v * 6 + b * 1.7, 64) * 4) * Math.PI * 2) * 0.5 + 0.5
    const k = tints[b] * (0.9 + grain * 0.14 + fbmP(n, u, v, 8, 3) * 0.08)
    const joint = local < 0.035 || local > 0.965 ? 0.45 : 1
    return tone([158, 110, 70], k * joint)
  })
  return toTexture(c)
}

// Plywood formwork faces, sheet joints every 1.2 m (tile = 2.4 m).
export function plywoodTexture() {
  const n = periodicNoise(61)
  const { c, ctx } = paint(256, (u, v) => {
    const k = 0.88 + fbmP(n, u * 3, v, 4, 4) * 0.2
    return tone([196, 132, 74], k)
  })
  ctx.fillStyle = 'rgba(70, 40, 20, 0.5)'
  ctx.fillRect(0, 0, 256, 2)
  ctx.fillRect(0, 128, 256, 2)
  ctx.fillRect(0, 0, 2, 256)
  ctx.fillRect(128, 0, 2, 256)
  return toTexture(c)
}

// Large-format stone pavers, 0.6 m square (tile = 2.4 m).
export function paverTexture() {
  const n = periodicNoise(71)
  const rnd = mulberry32(72)
  const { c, ctx } = paint(512, (u, v) => {
    const k = 0.9 + fbmP(n, u, v, 6, 4) * 0.14
    return tone([206, 198, 184], k)
  })
  for (let y = 0; y < 512; y += 128)
    for (let x = 0; x < 512; x += 128) {
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,250,240' : '90,80,70'}, ${rnd() * 0.08})`
      ctx.fillRect(x, y, 128, 128)
    }
  ctx.fillStyle = 'rgba(80, 74, 66, 0.6)'
  for (let p = 0; p < 512; p += 128) {
    ctx.fillRect(p, 0, 2, 512)
    ctx.fillRect(0, p, 512, 2)
  }
  return toTexture(c)
}

// Glass mosaic pool tiles, 2.5 cm, sea-green with variation (tile = 0.8 m).
export function mosaicTexture() {
  const rnd = mulberry32(81)
  const { c, ctx } = makeCanvas(256)
  ctx.fillStyle = '#c9d6d2'
  ctx.fillRect(0, 0, 256, 256)
  const s = 8
  for (let y = 0; y < 256; y += s)
    for (let x = 0; x < 256; x += s) {
      const k = rnd()
      const col = k < 0.55 ? [64, 150, 160] : k < 0.85 ? [92, 176, 182] : [40, 118, 138]
      const j = 0.9 + rnd() * 0.2
      ctx.fillStyle = `rgb(${col[0] * j}, ${col[1] * j}, ${col[2] * j})`
      ctx.fillRect(x + 1, y + 1, s - 1, s - 1)
    }
  return toTexture(c)
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

export function asphaltTexture() {
  const n = periodicNoise(91)
  const g = periodicNoise(92)
  const { c } = paint(512, (u, v) => {
    const agg = g(u * 220, v * 220, 220)
    const k = 0.85 + fbmP(n, u, v, 4, 4) * 0.25 + (agg > 0.72 ? 0.35 : agg < 0.2 ? -0.2 : 0)
    return tone([58, 58, 60], k)
  })
  return toTexture(c)
}

export function gravelTexture() {
  const g = periodicNoise(101)
  const n = periodicNoise(102)
  const { c } = paint(512, (u, v) => {
    const stone = g(u * 140, v * 140, 140)
    const k = 0.7 + stone * 0.55 + fbmP(n, u, v, 4, 3) * 0.12
    return tone([142, 134, 122], k)
  })
  return toTexture(c)
}

export function soilTexture() {
  const n = periodicNoise(111)
  const g = periodicNoise(112)
  const { c } = paint(512, (u, v) => {
    const clods = Math.pow(g(u * 90, v * 90, 90), 2)
    const k = 0.72 + fbmP(n, u, v, 4, 5) * 0.4 + clods * 0.25
    return tone([128, 96, 70], k)
  })
  return toTexture(c)
}

// Wild meadow: mixed greens and dry straw at blade scale.
export function meadowTexture() {
  const n = periodicNoise(121)
  const g = periodicNoise(122)
  const h = periodicNoise(123)
  const { c } = paint(512, (u, v) => {
    const patch = fbmP(n, u, v, 4, 4)
    const blade = g(u * 256, v * 96, 256) * 0.6 + g(u * 160, v * 300, 160) * 0.4
    const dry = Math.max(0, h(u * 6, v * 6, 6) - 0.45) * 1.6
    const base = [
      84 + dry * 64 + blade * 26,
      108 + dry * 44 + blade * 32,
      54 + dry * 24 + blade * 10,
    ]
    return tone(base, 0.72 + patch * 0.34 + (blade - 0.5) * 0.3)
  })
  return toTexture(c)
}

// Finished lawn: denser, greener, with soft mowing stripes (tile = 6 m, stripes 1.5 m).
export function lawnTexture() {
  const g = periodicNoise(131)
  const n = periodicNoise(132)
  const { c } = paint(512, (u, v) => {
    const blade = g(u * 300, v * 120, 300) * 0.55 + g(u * 180, v * 340, 180) * 0.45
    const stripe = Math.floor(u * 4) % 2 ? 1.03 : 0.97
    const k = (0.78 + fbmP(n, u, v, 4, 3) * 0.22 + (blade - 0.5) * 0.34) * stripe
    return tone([74, 118, 46], k)
  })
  return toTexture(c)
}

// Clipped hedge face: dense small leaves.
export function hedgeTexture() {
  const rnd = mulberry32(141)
  const { c, ctx } = makeCanvas(256)
  ctx.fillStyle = '#20331a'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 3200; i++) {
    const l = 0.6 + rnd() * 0.7
    ctx.fillStyle = `rgb(${46 * l}, ${78 * l}, ${34 * l})`
    const x = rnd() * 256
    const y = rnd() * 256
    for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      ctx.beginPath()
      ctx.ellipse(x + dx, y + dy, 2 + rnd() * 2.5, 1.2 + rnd() * 1.4, rnd() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return toTexture(c)
}

// ---------------------------------------------------------------------------
// Foliage cards (alpha-tested)
// ---------------------------------------------------------------------------

// A spray of leaves on a transparent card. `shape` controls the leaf proportions.
export function leafCardTexture({ seed = 1, count = 170, rx = 3.2, ry = 8, palette = [[60, 92, 40], [82, 114, 50], [40, 66, 30]] } = {}) {
  const rnd = mulberry32(seed)
  const S = 256
  const { c, ctx } = makeCanvas(S)
  ctx.clearRect(0, 0, S, S)
  // twigs
  ctx.strokeStyle = 'rgba(70, 54, 36, 0.9)'
  ctx.lineWidth = 2
  for (let i = 0; i < 7; i++) {
    ctx.beginPath()
    ctx.moveTo(S / 2, S * 0.95)
    ctx.quadraticCurveTo(S / 2 + (rnd() - 0.5) * 60, S * 0.6, S / 2 + (rnd() - 0.5) * 180, S * (0.15 + rnd() * 0.5))
    ctx.stroke()
  }
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd()) * S * 0.44
    const x = S / 2 + Math.cos(a) * r
    const y = S / 2 + Math.sin(a) * r * 0.9
    const p = palette[Math.floor(rnd() * palette.length)]
    const l = 0.75 + rnd() * 0.5
    ctx.fillStyle = `rgb(${p[0] * l}, ${p[1] * l}, ${p[2] * l})`
    ctx.beginPath()
    ctx.ellipse(x, y, rx * (0.7 + rnd() * 0.6), ry * (0.7 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  // Keep the card's alpha solid in its lower mip levels: average coverage, not holes.
  const img = ctx.getImageData(0, 0, S, S)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 40 ? 255 : 0
  ctx.putImageData(img, 0, 0)
  const t = toTexture(c, { repeat: false })
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

// ---------------------------------------------------------------------------
// Interiors, water, glow
// ---------------------------------------------------------------------------

// A furnished room seen through glazing: warm walls, timber floor, ceiling light, furniture.
// The texture stores the lit appearance; the material scales it from day to dusk.
export function interiorTexture(seed = 1) {
  const rnd = mulberry32(seed)
  const W = 512
  const H = 256
  const { c, ctx } = makeCanvas(W, H)
  const wall = ctx.createLinearGradient(0, 0, 0, H)
  wall.addColorStop(0, '#f1d3a8')
  wall.addColorStop(0.55, '#c79a6a')
  wall.addColorStop(1, '#6e4a2c')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, H)
  // ceiling cove light
  const cove = ctx.createLinearGradient(0, 0, 0, 40)
  cove.addColorStop(0, 'rgba(255, 236, 200, 0.95)')
  cove.addColorStop(1, 'rgba(255, 236, 200, 0)')
  ctx.fillStyle = cove
  ctx.fillRect(0, 0, W, 40)
  // pools of light from downlights
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (W / 6) + (rnd() - 0.5) * 20
    const g = ctx.createRadialGradient(x, 30, 0, x, 30, 120)
    g.addColorStop(0, 'rgba(255, 226, 180, 0.55)')
    g.addColorStop(1, 'rgba(255, 226, 180, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  // timber floor
  ctx.fillStyle = '#5a3b22'
  ctx.fillRect(0, H * 0.8, W, H * 0.2)
  // art, shelving and furniture silhouettes
  ctx.fillStyle = '#3a2a1e'
  ctx.fillRect(W * 0.08 + rnd() * 30, H * 0.5, 150, 54) // sofa
  ctx.fillRect(W * 0.08 + rnd() * 30, H * 0.42, 150, 14)
  ctx.fillStyle = '#2a1e16'
  ctx.fillRect(W * 0.62, H * 0.56, 120, 10) // dining table
  ctx.fillRect(W * 0.64, H * 0.58, 6, 52)
  ctx.fillRect(W * 0.62 + 108, H * 0.58, 6, 52)
  ctx.fillStyle = '#8c6a4c'
  ctx.fillRect(W * 0.4, H * 0.22, 70, 50) // artwork
  ctx.fillStyle = '#1f1712'
  for (let i = 0; i < 4; i++) ctx.fillRect(W * 0.86, H * (0.2 + i * 0.13), 60, 4) // shelving
  // pendant lights
  for (const x of [W * 0.66, W * 0.72, W * 0.78]) {
    const g = ctx.createRadialGradient(x, H * 0.36, 0, x, H * 0.36, 26)
    g.addColorStop(0, 'rgba(255, 240, 210, 1)')
    g.addColorStop(1, 'rgba(255, 220, 170, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 30, H * 0.36 - 30, 60, 60)
  }
  const t = toTexture(c)
  t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

// Tileable normal map of gentle water ripples.
export function waterNormalTexture() {
  const n = periodicNoise(151)
  const S = 256
  const height = new Float32Array(S * S)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) height[y * S + x] = fbmP(n, x / S, y / S, 6, 4)
  const { c } = paint(S, (u, v, x, y) => {
    const hL = height[y * S + ((x - 1 + S) % S)]
    const hR = height[y * S + ((x + 1) % S)]
    const hD = height[((y - 1 + S) % S) * S + x]
    const hU = height[((y + 1) % S) * S + x]
    const nx = (hL - hR) * 3
    const ny = (hD - hU) * 3
    const nz = 1
    const l = Math.hypot(nx, ny, nz)
    return [((nx / l) * 0.5 + 0.5) * 255, ((ny / l) * 0.5 + 0.5) * 255, ((nz / l) * 0.5 + 0.5) * 255]
  })
  return toTexture(c, { color: false })
}

export function glowTexture() {
  const S = 128
  const { c, ctx } = makeCanvas(S)
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.1, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.14)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
