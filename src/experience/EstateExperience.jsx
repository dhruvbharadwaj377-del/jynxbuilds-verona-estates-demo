import { useCallback, useEffect, useRef, useState } from 'react'
import { chapters, hotspotIndex } from './chapters.js'
import './experience.css'

const LAST = chapters.length - 1

// ---------------------------------------------------------------------------
// Capability checks
// ---------------------------------------------------------------------------

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Returns null when 3D should not run at all, otherwise a quality tier.
function detectQuality() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return null
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return null
  }
  const connection = navigator.connection
  if (connection?.saveData) return null
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return null

  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = window.innerWidth < 820
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4
  return coarse || small || fewCores || lowMemory ? 'low' : 'high'
}

function readPreference() {
  try {
    return window.localStorage.getItem('verona:3d') !== 'off'
  } catch {
    return true
  }
}

function writePreference(on) {
  try {
    window.localStorage.setItem('verona:3d', on ? 'on' : 'off')
  } catch {
    // Storage unavailable (private mode) — the toggle still works for this visit.
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstateExperience() {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const blockRefs = useRef([])
  const hotspotRefs = useRef({})
  const sceneRef = useRef(null)
  const activeRef = useRef(0)

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')

  const [quality] = useState(detectQuality)
  const [enabled, setEnabled] = useState(readPreference)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [active, setActive] = useState(0)
  const [mood, setMood] = useState('dusk')
  const [selectedHotspot, setOpenHotspot] = useState(null)

  // Why the photographic view is showing, if it is
  const stillReason = !quality ? 'unsupported' : status === 'error' ? 'error' : !enabled ? 'off' : null
  // 'loading' → 3D is being prepared (photographic poster shown meanwhile)
  // 'ready'   → 3D is live
  // 'still'   → photographic fallback (unsupported, failed, or switched off)
  const mode = stillReason ? 'still' : status

  // A feature card only stays open while its chapter is on screen
  const openHotspot =
    selectedHotspot && hotspotIndex[selectedHotspot].chapter === chapters[active].id
      ? selectedHotspot
      : null

  // ----- Scroll → progress -----

  const readProgress = useCallback(() => {
    const section = sectionRef.current
    if (!section) return 0
    const rect = section.getBoundingClientRect()
    const range = rect.height - window.innerHeight
    if (range <= 0) return 0
    return Math.min(1, Math.max(0, -rect.top / range))
  }, [])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const progress = readProgress()
      const chapter = Math.round(progress * LAST)
      if (chapter !== activeRef.current) {
        activeRef.current = chapter
        setActive(chapter)
      }
      const scene = sceneRef.current
      if (scene) {
        if (reducedMotion) scene.setProgress(chapter / LAST, { instant: true })
        else scene.setProgress(progress)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [readProgress, reducedMotion])

  useEffect(() => {
    if (!openHotspot) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpenHotspot(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openHotspot])

  // ----- Hotspot projection (runs after every rendered frame, no React work) -----

  const positionHotspots = useCallback((project, progress) => {
    const position = progress * LAST
    chapters.forEach((chapter, index) => {
      const arrived = Math.abs(position - index) < 0.2
      for (const hotspot of chapter.hotspots) {
        const el = hotspotRefs.current[hotspot.id]
        if (!el) continue
        const point = project(hotspot.position)
        const show = arrived && point.visible
        el.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`
        if (el.dataset.visible !== String(show)) el.dataset.visible = String(show)
      }
    })
  }, [])

  // ----- 3D lifecycle -----

  useEffect(() => {
    if (!enabled || !quality) return undefined

    let cancelled = false
    let scene = null
    let resizeObserver = null
    let visibilityObserver = null

    const fail = () => {
      if (cancelled) return
      sceneRef.current?.dispose()
      sceneRef.current = null
      setStatus('error')
    }

    const start = async () => {
      try {
        const { createEstateScene } = await import('./scene.js')
        if (cancelled || !canvasRef.current) return
        scene = createEstateScene({
          canvas: canvasRef.current,
          chapters,
          quality,
          onRender: positionHotspots,
          onContextLost: fail,
        })
        sceneRef.current = scene

        const stage = stageRef.current
        const rect = stage.getBoundingClientRect()
        scene.resize(rect.width, rect.height)

        const progress = readProgress()
        const chapter = Math.round(progress * LAST)
        scene.setProgress(reducedMotion ? chapter / LAST : progress, { instant: true })

        resizeObserver = new ResizeObserver(([entry]) => {
          const { width, height } = entry.contentRect
          scene.resize(width, height)
        })
        resizeObserver.observe(stage)

        // Stop drawing entirely when the walkthrough is offscreen
        visibilityObserver = new IntersectionObserver(([entry]) => {
          scene.setActive(entry.isIntersecting)
        })
        visibilityObserver.observe(sectionRef.current)

        setStatus('ready')
      } catch (error) {
        console.warn('[VÉRONA] 3D view unavailable, showing photography instead.', error)
        fail()
      }
    }

    // Let the page paint its photographic poster first, then build the scene.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 900 })
      : window.setTimeout(start, 200)

    return () => {
      cancelled = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      scene?.dispose()
      sceneRef.current = null
    }
  }, [enabled, quality, positionHotspots, readProgress, reducedMotion])

  // Mood
  useEffect(() => {
    sceneRef.current?.setMood(mood === 'night' ? 1 : 0, { instant: reducedMotion })
  }, [mood, mode, reducedMotion])

  // Pointer parallax (desktop, motion allowed)
  useEffect(() => {
    if (mode !== 'ready' || !finePointer || reducedMotion) return undefined
    const onMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = (event.clientY / window.innerHeight) * 2 - 1
      sceneRef.current?.setPointer(x, -y)
    }
    const onLeave = () => sceneRef.current?.setPointer(0, 0)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      sceneRef.current?.setPointer(0, 0)
    }
  }, [mode, finePointer, reducedMotion])

  const goToChapter = (index) => {
    blockRefs.current[index]?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const toggle3D = () => {
    const next = !enabled
    writePreference(next)
    setEnabled(next)
    setStatus('loading')
    setOpenHotspot(null)
  }

  const live = mode === 'ready'
  const feature = openHotspot ? hotspotIndex[openHotspot] : null

  return (
    <section
      ref={sectionRef}
      className={`estate estate--${mode} estate--${mood}`}
      aria-label="VÉRONA residence walkthrough"
    >
      {/* ================= STAGE (sticky) ================= */}

      <div ref={stageRef} className="estate-stage">
        <div className="estate-stills" aria-hidden="true">
          {chapters.map((chapter, index) => {
            // While 3D is live only the poster is kept, to avoid loading every photo.
            if (mode !== 'still' && index !== 0) return null
            return (
              <img
                key={chapter.id}
                src={chapter.still}
                alt=""
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'auto'}
                loading={index === 0 ? 'eager' : 'lazy'}
                className={(mode === 'still' ? index === active : true) ? 'is-active' : ''}
              />
            )
          })}
        </div>

        {enabled && (
          <canvas
            ref={canvasRef}
            className="estate-canvas"
            aria-hidden="true"
          />
        )}

        <div className="estate-scrim" aria-hidden="true" />

        {/* Hotspots, positioned imperatively from the 3D camera. They are a
            pointer shortcut: keyboard and screen-reader users get the same
            features, in reading order, from each chapter's "In this view" list. */}
        <div className="estate-hotspots" aria-hidden="true">
          {live &&
            chapters.flatMap((chapter) =>
              chapter.hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  ref={(el) => {
                    hotspotRefs.current[hotspot.id] = el
                  }}
                  type="button"
                  className={`hotspot ${openHotspot === hotspot.id ? 'is-open' : ''}`}
                  data-visible="false"
                  tabIndex={-1}
                  onClick={() => setOpenHotspot(openHotspot === hotspot.id ? null : hotspot.id)}
                >
                  <span className="hotspot-dot" />
                  <span className="hotspot-label">{hotspot.label}</span>
                </button>
              )),
            )}
        </div>

        {/* Chapter rail */}
        <nav className="estate-rail" aria-label="Walkthrough chapters">
          <ol>
            {chapters.map((chapter, index) => (
              <li key={chapter.id}>
                <button
                  type="button"
                  className={index === active ? 'is-active' : ''}
                  aria-current={index === active ? 'step' : undefined}
                  onClick={() => goToChapter(index)}
                >
                  <span>{chapter.label}</span>
                  <i aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Feature card (opened from a hotspot or the chapter list) */}
        <div
          id="estate-feature"
          className="estate-feature"
          data-side={active % 2 ? 'right' : 'left'}
          aria-live="polite"
        >
          {feature && (
            <div className="estate-feature-card">
              <span>In this view</span>
              <h3>{feature.label}</h3>
              <p>{feature.detail}</p>
              <button type="button" onClick={() => setOpenHotspot(null)}>
                Close <b aria-hidden="true">×</b>
              </button>
            </div>
          )}
        </div>

        {/* View controls */}
        <div className="estate-controls">
          <div className="estate-status" role="status">
            {mode === 'loading' && <span className="estate-loading">Preparing 3D view</span>}
            {mode === 'still' && stillReason === 'unsupported' && <span>Photographic view</span>}
            {mode === 'still' && stillReason === 'error' && <span>3D unavailable — photographic view</span>}
          </div>

          {live && (
            <div className="estate-mood" role="group" aria-label="Lighting">
              {['dusk', 'night'].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mood === value}
                  onClick={() => setMood(value)}
                >
                  {value === 'dusk' ? 'Dusk' : 'Night'}
                </button>
              ))}
            </div>
          )}

          {stillReason !== 'unsupported' && stillReason !== 'error' && (
            <button type="button" className="estate-toggle" aria-pressed={enabled} onClick={toggle3D}>
              {enabled ? '3D on' : '3D off'}
            </button>
          )}
        </div>
      </div>

      {/* ================= TRACK (scrolling content) ================= */}

      <div className="estate-track">
        {/* Intro / hero */}
        <div
          ref={(el) => {
            blockRefs.current[0] = el
          }}
          className={`estate-block estate-intro ${active === 0 ? 'is-active' : ''}`}
        >
          <div className="estate-intro-meta">
            <span>Gurugram</span>
            <span>New Delhi</span>
            <span>Concept residence / Interactive</span>
          </div>

          <div className="estate-intro-main">
            <div className="estate-kicker">
              <span className="estate-kicker-line" />
              <span>The art of living</span>
            </div>

            <h1>VÉRONA</h1>

            <div className="estate-intro-row">
              <p className="estate-statement">
                Homes
                <br />
                <i>that rise above.</i>
              </p>

              <div className="estate-intro-actions">
                <button type="button" className="estate-btn estate-btn--solid" onClick={() => goToChapter(1)}>
                  <span>Walk through the residence</span>
                  <b aria-hidden="true">↓</b>
                </button>
                <a href="#enquire" className="estate-btn">
                  <span>Private enquiry</span>
                  <b aria-hidden="true">↗</b>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Chapters */}
        {chapters.slice(1, LAST).map((chapter, i) => {
          const index = i + 1
          return (
            <div
              key={chapter.id}
              id={index === 1 ? 'walkthrough' : undefined}
              ref={(el) => {
                blockRefs.current[index] = el
              }}
              className={`estate-block estate-chapter estate-chapter--${index % 2 ? 'left' : 'right'} ${
                active === index ? 'is-active' : ''
              }`}
            >
              <article className="estate-card">
                <p className="estate-card-eyebrow">{chapter.eyebrow}</p>
                <h2>
                  {chapter.title[0]}
                  <br />
                  <i>{chapter.title[1]}</i>
                </h2>
                <p className="estate-card-copy">{chapter.copy}</p>

                <div className="estate-card-features">
                  <span>In this view</span>
                  <ul>
                    {chapter.hotspots.map((hotspot) => (
                      <li key={hotspot.id}>
                        <button
                          type="button"
                          aria-expanded={openHotspot === hotspot.id}
                          aria-controls="estate-feature"
                          onClick={() => setOpenHotspot(openHotspot === hotspot.id ? null : hotspot.id)}
                        >
                          {hotspot.label}
                          <b aria-hidden="true">+</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <span className="estate-card-index" aria-hidden="true">
                  {chapter.index} / 04
                </span>
              </article>
            </div>
          )
        })}

        {/* Closing */}
        <div
          ref={(el) => {
            blockRefs.current[LAST] = el
          }}
          className={`estate-block estate-closing ${active === LAST ? 'is-active' : ''}`}
        >
          <div className="estate-closing-inner">
            <p className="estate-card-eyebrow">Private viewings</p>
            <h2>
              Walk it
              <br />
              <i>before it&rsquo;s built.</i>
            </h2>
            <p className="estate-card-copy">
              Every VÉRONA residence can be explored like this — room by room, at the hour you
              would live in it. Then see it in person.
            </p>
            <div className="estate-intro-actions">
              <a href="#residences" className="estate-btn estate-btn--solid">
                <span>Explore the collection</span>
                <b aria-hidden="true">↓</b>
              </a>
              <a href="#enquire" className="estate-btn">
                <span>Book a private viewing</span>
                <b aria-hidden="true">↗</b>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
