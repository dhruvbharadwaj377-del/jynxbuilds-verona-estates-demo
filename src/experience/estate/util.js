// Small deterministic helpers shared by the estate modules.

export const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (t) => t * t * (3 - 2 * t)

// 0 → 1 while p travels from a to b (eased). The basis of every scroll-driven change.
export const span = (p, a, b) => smooth(clamp01((p - a) / Math.max(b - a, 1e-6)))

// Seeded PRNG so the estate is identical on every visit.
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Value noise + fBm, used for terrain and placement variation.
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function noise2(x, z) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = smooth(xf)
  const v = smooth(zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1
}

export function fbm(x, z, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, z * f)
    f *= 2.03
    amp *= 0.5
  }
  return sum
}

// Signed distance from (x, z) to an axis-aligned rectangle (negative inside).
export function rectDistance(x, z, cx, cz, hw, hd) {
  const dx = Math.abs(x - cx) - hw
  const dz = Math.abs(z - cz) - hd
  const ox = Math.max(dx, 0)
  const oz = Math.max(dz, 0)
  return Math.hypot(ox, oz) + Math.min(Math.max(dx, dz), 0)
}

// Yield to the main thread between heavy build steps so the page stays responsive.
export const yieldToMain = () =>
  new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 40 })
    else setTimeout(resolve, 0)
  })
