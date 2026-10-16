// Scroll-controlled architectural film.
//
// The film switches on only when a manifest exists at
// src/experience/film/verona-film.json (see ASSET_CREATION.md). The manifest
// is picked up at build time, so a site without the film makes no requests
// for missing media at all.

import { chapters } from './chapters.js'

const found = import.meta.glob('./film/verona-film.json', { eager: true, import: 'default' })
const rawManifest = Object.values(found)[0] ?? null

const BASE = import.meta.env.BASE_URL || '/'
const resolve = (path) => (/^(https?:)?\/\//.test(path) ? path : BASE + String(path).replace(/^\//, ''))

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function validateSources(sources, label) {
  if (!sources || typeof sources !== 'object' || typeof sources.desktop !== 'string') {
    throw new Error(`${label}.desktop must be a video path`)
  }
  return {
    desktop: resolve(sources.desktop),
    mobile: typeof sources.mobile === 'string' ? resolve(sources.mobile) : null,
    poster: typeof sources.poster === 'string' ? resolve(sources.poster) : null,
  }
}

function validate(raw) {
  if (!raw || raw.version !== 1) throw new Error('expected "version": 1')

  const duration = Number(raw.duration)
  if (!(duration > 0)) throw new Error('"duration" must be a positive number of seconds')

  // One timestamp per chapter, strictly increasing, inside the film
  const marks = chapters.map((chapter) => {
    const t = Number(raw.chapters?.[chapter.id])
    if (!Number.isFinite(t)) throw new Error(`missing chapters.${chapter.id}`)
    return Math.min(Math.max(t, 0), duration)
  })
  for (let i = 1; i < marks.length; i++) {
    if (marks[i] <= marks[i - 1]) throw new Error('chapter timestamps must increase')
  }

  const dusk = validateSources(raw.sources, 'sources')
  const night = raw.night ? validateSources(raw.night, 'night') : null

  // Optional feature-point positions against the footage, as fractions of
  // the video frame at that chapter's timestamp. Only ids that exist in
  // chapters.js are accepted, so notes always come from one source of truth.
  const hotspots = {}
  for (const chapter of chapters) {
    for (const hotspot of chapter.hotspots) {
      const p = raw.hotspots?.[hotspot.id]
      if (p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) {
        hotspots[hotspot.id] = { x: p.x, y: p.y, chapter: chapter.id }
      }
    }
  }

  return { duration, marks, dusk, night, hotspots }
}

export const filmManifest = (() => {
  if (!rawManifest) return null
  try {
    return validate(rawManifest)
  } catch (error) {
    console.warn(`[VÉRONA] Film manifest ignored: ${error.message}`)
    return null
  }
})()

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

// The whole film is fetched into memory before it is shown. Scrubbing a
// fully-buffered file is fast and predictable; scrubbing over the network
// stalls on every range request.
export async function fetchFilm(url, { signal, onProgress, stallMs = 15000 } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort)

  let watchdog = 0
  const arm = () => {
    clearTimeout(watchdog)
    watchdog = setTimeout(abort, stallMs)
  }

  try {
    arm()
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    // A missing file on an SPA host often comes back as index.html with 200
    const type = response.headers.get('content-type') || ''
    if (!/^(video\/|application\/octet-stream)/.test(type)) {
      throw new Error(`unexpected content type "${type || 'none'}"`)
    }

    const total = Number(response.headers.get('content-length')) || 0
    if (!response.body) {
      const blob = await response.blob()
      onProgress?.(1)
      return URL.createObjectURL(blob)
    }

    const reader = response.body.getReader()
    const parts = []
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
      loaded += value.byteLength
      arm()
      if (total) onProgress?.(Math.min(loaded / total, 1))
    }
    onProgress?.(1)
    return URL.createObjectURL(new Blob(parts, { type: type.startsWith('video/') ? type : 'video/mp4' }))
  } finally {
    clearTimeout(watchdog)
    signal?.removeEventListener('abort', abort)
  }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

// Drives a paused <video> by seeking. Only one seek is ever in flight; while
// it resolves, newer targets simply replace the pending one, so fast scrolling
// or reversing never queues up a backlog of stale frames.
export function createFilmPlayer({ video, fps = 30, onFrame, onSlow, onError }) {
  const frame = 1 / fps
  const state = {
    target: 0,
    shown: 0,
    requested: -1,
    seeking: false,
    seekStart: 0,
    active: true,
    raf: 0,
    last: 0,
    samples: [],
  }

  const onSeeked = () => {
    state.seeking = false
    const latency = performance.now() - state.seekStart
    state.samples.push(latency)
    if (state.samples.length > 16) state.samples.shift()
    // Consistently slow decoding makes scrubbing judder (~10 fps or worse);
    // hand over to the 3D view instead. Measured in Chrome on a test clip:
    // GOP-15 ≈ 13 ms per seek, a default long-GOP export ≈ 120 ms.
    if (state.samples.length >= 12) {
      const avg = state.samples.reduce((a, b) => a + b, 0) / state.samples.length
      if (avg > 100) {
        console.warn(
          `[VÉRONA] Film seeks average ${Math.round(avg)} ms. If this happens on fast hardware, ` +
            're-encode with a short keyframe interval (see ASSET_CREATION.md).',
        )
        onSlow?.(avg)
      }
    }
    onFrame?.(video.currentTime)
    // Chain straight into the next seek rather than waiting a frame
    pump()
    wake()
  }
  const onVideoError = () => onError?.(video.error)

  video.addEventListener('seeked', onSeeked)
  video.addEventListener('error', onVideoError)

  function pump() {
    if (state.seeking || Math.abs(state.shown - state.requested) < frame * 0.5) return
    state.requested = state.shown
    state.seeking = true
    state.seekStart = performance.now()
    video.currentTime = state.shown
  }

  function tick(now) {
    state.raf = 0
    if (!state.active) return
    const dt = Math.min((now - (state.last || now)) / 1000, 0.1)
    state.last = now

    // Gentle inertia: the picture glides to the scroll position rather than
    // snapping, which also smooths out coarse wheel steps.
    state.shown += (state.target - state.shown) * (1 - Math.exp(-dt * 7))
    if (Math.abs(state.target - state.shown) < frame * 0.25) state.shown = state.target

    pump()

    // A seek that never resolves (seen in testing with some encodes) would
    // otherwise freeze the picture for good, since no further seeks are sent.
    if (state.seeking && performance.now() - state.seekStart > 2500) {
      state.active = false
      console.warn('[VÉRONA] Film seek stalled; falling back.')
      onError?.(new Error('seek stalled'))
      return
    }

    const settled = state.shown === state.target && !state.seeking && state.requested === state.shown
    if (settled) {
      state.last = 0
      return
    }
    state.raf = requestAnimationFrame(tick)
  }

  function wake() {
    if (!state.raf && state.active) state.raf = requestAnimationFrame(tick)
  }

  return {
    setTime(time, { instant = false } = {}) {
      state.target = Math.max(0, Math.min(time, (video.duration || time) - 0.001))
      if (instant) state.shown = state.target
      wake()
    },
    setActive(active) {
      state.active = active
      if (active) wake()
      else if (state.raf) {
        cancelAnimationFrame(state.raf)
        state.raf = 0
        state.last = 0
      }
    },
    // Swap to another grade of the same film without losing the position
    swapSource(src) {
      const at = state.shown
      state.seeking = false
      state.requested = -1
      video.src = src
      video.addEventListener(
        'loadeddata',
        () => {
          state.shown = at
          wake()
        },
        { once: true },
      )
    },
    get time() {
      return state.shown
    },
    get target() {
      return state.target
    },
    dispose() {
      state.active = false
      if (state.raf) cancelAnimationFrame(state.raf)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onVideoError)
    },
  }
}

// Wait until a <video> can show frames; rejects on decode / load errors.
export function primeVideo(video, src, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onFail)
      signal?.removeEventListener('abort', onAbort)
    }
    const onReady = () => {
      cleanup()
      // iOS Safari only paints seeked frames once the element has played;
      // a muted play/pause is allowed without a gesture and primes it.
      if (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))) {
        video.play().then(() => video.pause(), () => {})
      }
      resolve()
    }
    const onFail = () => {
      cleanup()
      reject(video.error || new Error('video failed to load'))
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('aborted', 'AbortError'))
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', onFail)
    signal?.addEventListener('abort', onAbort)
    video.src = src
    video.load()
  })
}

// Map a point given as a fraction of the video frame to stage pixels,
// accounting for object-fit: cover cropping.
export function coverPoint(point, video, width, height) {
  const vw = video.videoWidth || 16
  const vh = video.videoHeight || 9
  const scale = Math.max(width / vw, height / vh)
  const dw = vw * scale
  const dh = vh * scale
  const x = (width - dw) / 2 + point.x * dw
  const y = (height - dh) / 2 + point.y * dh
  return { x, y, visible: x > 12 && x < width - 12 && y > 72 && y < height - 12 }
}
