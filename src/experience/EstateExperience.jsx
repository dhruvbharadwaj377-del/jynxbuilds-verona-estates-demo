import { useCallback, useEffect, useRef, useState } from 'react'
import SitePlan from './SitePlan.jsx'
import { LAST, stageAt, stages } from './stages.js'
import './experience.css'

// Scroll distance of the journey in viewport heights (the section is one viewport taller).
// The construction story needs room to breathe.
const SCROLL_VH = 1200
const VIEW_LABELS = { '3d': '3D', plan: 'Plan' }

// ---------------------------------------------------------------------------
// Capability checks (run after first paint, never during render)
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
  if (new URLSearchParams(window.location.search).has('nowebgl')) return null
  if (navigator.connection?.saveData) return null
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return null
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return null // the estate needs WebGL2 (float render targets, MSAA)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return null
  }
  const forced = new URLSearchParams(window.location.search).get('quality')
  if (forced === 'low' || forced === 'high') return forced
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = window.innerWidth < 820
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4
  return coarse || small || fewCores || lowMemory ? 'low' : 'high'
}

// 'auto' | '3d' | 'plan'
function readPreference() {
  try {
    const stored = window.localStorage.getItem('verona:view')
    if (stored === '3d' || stored === 'plan') return stored
    // Earlier versions stored 'photo' (now the plan) or 'film' (retired).
    if (stored === 'photo') return 'plan'
    return 'auto'
  } catch {
    return 'auto'
  }
}

function writePreference(view) {
  try {
    window.localStorage.setItem('verona:view', view)
  } catch {
    // Storage unavailable (private mode): the choice still applies for this visit.
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstateExperience() {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const activeRef = useRef(0)

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  // Read by the 3D start-up without rebuilding the scene when the preference changes.
  const reducedRef = useRef(reducedMotion)
  useEffect(() => {
    reducedRef.current = reducedMotion
  }, [reducedMotion])

  const [quality, setQuality] = useState(undefined) // undefined = not checked yet
  const [preference, setPreference] = useState(readPreference)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState({ f: 0, label: 'Preparing' })
  const [notice, setNotice] = useState(null)
  const [active, setActive] = useState(0)

  // Decide the tier after the first paint, so WebGL never delays the page.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setQuality(detectQuality()))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const can3D = Boolean(quality) && !failed
  const view = quality === undefined ? 'plan' : preference === 'plan' || !can3D ? 'plan' : '3d'
  const viewOptions = can3D ? ['3d', 'plan'] : ['plan']
  const live = view === '3d' && ready

  // ----- Scroll → progress -----

  const readProgress = useCallback(() => {
    const section = sectionRef.current
    if (!section) return 0
    const rect = section.getBoundingClientRect()
    const range = rect.height - window.innerHeight
    if (range <= 0) return 0
    return Math.min(1, Math.max(0, -rect.top / range))
  }, [])

  const pushProgress = useCallback(
    (progress, instant = false) => {
      const index = stageAt(progress)
      const scene = sceneRef.current
      if (scene) {
        if (reducedMotion) scene.setProgress(stages[index].rest, { instant: true })
        else scene.setProgress(progress, { instant })
      }
    },
    [reducedMotion],
  )

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const progress = readProgress()
      const index = stageAt(progress)
      if (index !== activeRef.current) {
        activeRef.current = index
        setActive(index)
      }
      // Per-frame visuals go straight to CSS, never through React state.
      const section = sectionRef.current
      if (section) {
        section.style.setProperty('--estate-progress', progress.toFixed(4))
        const handoff = Math.min(1, Math.max(0, (progress - 0.986) / 0.014))
        section.style.setProperty('--estate-handoff', handoff.toFixed(3))
      }
      pushProgress(progress)
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
  }, [readProgress, pushProgress])

  // `?p=0.42` jumps straight to a point in the journey (used for checkpoint screenshots).
  useEffect(() => {
    const jump = new URLSearchParams(window.location.search).get('p')
    if (jump === null || Number.isNaN(parseFloat(jump))) return
    history.scrollRestoration = 'manual'
    const section = sectionRef.current
    const top = section.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, top + Math.min(1, Math.max(0, parseFloat(jump))) * (section.offsetHeight - window.innerHeight))
  }, [])

  // ----- 3D lifecycle -----

  useEffect(() => {
    if (view !== '3d') return undefined

    let cancelled = false
    let scene = null
    let resizeObserver = null
    let visibilityObserver = null

    const fail = (reason) => {
      if (cancelled) return
      sceneRef.current?.dispose()
      sceneRef.current = null
      setNotice(reason)
      setFailed(true)
    }

    const start = async () => {
      try {
        const { createEstateScene } = await import('./scene.js')
        if (cancelled || !canvasRef.current) return
        const stage = stageRef.current
        scene = await createEstateScene({
          canvas: canvasRef.current,
          quality,
          onProgress: (f, label) => {
            if (!cancelled) setLoading({ f, label })
          },
          onContextLost: () => fail('The 3D view was interrupted, so the plan is shown instead'),
        })
        if (cancelled) {
          scene.dispose()
          return
        }
        const rect = stage.getBoundingClientRect()
        scene.resize(rect.width, rect.height)
        const progress = readProgress()
        scene.start(reducedRef.current ? stages[stageAt(progress)].rest : progress)
        sceneRef.current = scene

        resizeObserver = new ResizeObserver(([entry]) => {
          const { width, height } = entry.contentRect
          scene.resize(width, height)
        })
        resizeObserver.observe(stage)
        // Stop drawing entirely when the estate is offscreen
        visibilityObserver = new IntersectionObserver(([entry]) => scene.setActive(entry.isIntersecting))
        visibilityObserver.observe(sectionRef.current)
        setReady(true)
      } catch (error) {
        console.warn('[VÉRONA] 3D view unavailable, showing the plan instead.', error)
        fail('3D is unavailable on this device, so the plan is shown instead')
      }
    }

    // Paint the page and the plan first, then build the estate.
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 200)

    return () => {
      cancelled = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      scene?.dispose()
      sceneRef.current = null
      setReady(false)
    }
  }, [view, quality, readProgress])

  // Reduced motion toggled while live: re-sync to the current stage.
  useEffect(() => {
    if (sceneRef.current) pushProgress(readProgress(), true)
  }, [reducedMotion, pushProgress, readProgress, ready])

  const goToStage = (index) => {
    const section = sectionRef.current
    if (!section) return
    const top = section.getBoundingClientRect().top + window.scrollY
    const range = section.offsetHeight - window.innerHeight
    const p = index === 0 ? 0 : stages[index].range[0] + (stages[index].range[1] - stages[index].range[0]) * 0.18
    window.scrollTo({ top: top + p * range, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const chooseView = (next) => {
    writePreference(next)
    setPreference(next)
    setNotice(null)
    if (next === '3d') setFailed(false)
  }

  const mode = view === 'plan' ? 'plan' : live ? 'ready' : 'loading'

  return (
    <section
      ref={sectionRef}
      className={`estate estate--${mode}`}
      aria-label="The VÉRONA estate, from untouched land to finished homes"
    >
      {/* ================= STAGE (sticky) ================= */}

      <div ref={stageRef} className="estate-stage">
        <div className="estate-plan">
          <SitePlan stage={active} />
        </div>

        {view === '3d' && <canvas ref={canvasRef} className="estate-canvas" aria-hidden="true" />}

        <div className="estate-scrim" aria-hidden="true" />

        {/* Stage rail */}
        <nav className="estate-rail" aria-label="Estate stages">
          <ol>
            {stages.map((stage, index) => (
              <li key={stage.id}>
                <button
                  type="button"
                  className={index === active ? 'is-active' : ''}
                  aria-current={index === active ? 'step' : undefined}
                  onClick={() => goToStage(index)}
                >
                  <span>{stage.label}</span>
                  <i aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Loading and view controls */}
        <div className="estate-controls">
          <div className="estate-status" role="status">
            {mode === 'loading' && (
              <span className="estate-loading">
                {loading.label} <b>{Math.round(loading.f * 100)}%</b>
              </span>
            )}
            {mode !== 'loading' && notice && <span>{notice}</span>}
          </div>
          {viewOptions.length > 1 && (
            <div className="estate-toggle" role="group" aria-label="View">
              {viewOptions.map((value) => (
                <button key={value} type="button" aria-pressed={view === value} onClick={() => chooseView(value)}>
                  {VIEW_LABELS[value]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="estate-meter" aria-hidden="true">
          <i />
        </div>

        {/* Handoff: the final frame dissolves into the page below */}
        <div className="estate-handoff" aria-hidden="true">
          <span>V</span>
        </div>
      </div>

      {/* ================= TRACK (scrolling content) ================= */}

      <div className="estate-track">
        {stages.map((stage, index) => {
          // Each block spans exactly its stage's scroll window, so a stage's copy is on screen
          // while that stage plays; the last block adds the final viewport.
          const span = (stage.range[1] - stage.range[0]) * SCROLL_VH + (index === LAST ? 100 : 0)
          const height = `calc(${span.toFixed(1)} * 1svh)`
          const isActive = active === index
          if (index === 0)
            return (
              <div key={stage.id} className={`estate-block estate-intro ${isActive ? 'is-active' : ''}`} style={{ height }}>
                <div className="estate-intro-inner">
                  <div className="estate-intro-meta">
                    <span>A fictional estate</span>
                    <span>Eight homes</span>
                  </div>

                  <div className="estate-intro-main">
                    <div className="estate-kicker">
                      <span className="estate-kicker-line" />
                      <span>From untouched land</span>
                    </div>

                    <h1>VÉRONA</h1>

                    <div className="estate-intro-row">
                      <p className="estate-statement">
                        Homes
                        <br />
                        <i>that rise above.</i>
                      </p>

                      <div className="estate-intro-actions">
                        <button type="button" className="estate-btn estate-btn--solid" onClick={() => goToStage(1)}>
                          <span>Watch it rise</span>
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
              </div>
            )
          if (index === LAST)
            return (
              <div key={stage.id} className={`estate-block estate-closing ${isActive ? 'is-active' : ''}`} style={{ height }}>
                <div className="estate-closing-inner">
                  <p className="estate-card-eyebrow">Private viewings</p>
                  <h2>
                    Choose your
                    <br />
                    <i>place in it.</i>
                  </h2>
                  <div className="estate-intro-actions">
                    <a href="#residences" className="estate-btn estate-btn--solid">
                      <span>Explore the residences</span>
                      <b aria-hidden="true">↓</b>
                    </a>
                    <a href="#enquire" className="estate-btn">
                      <span>Book a private viewing</span>
                      <b aria-hidden="true">↗</b>
                    </a>
                  </div>
                </div>
              </div>
            )
          return (
            <div
              key={stage.id}
              id={index === 1 ? 'walkthrough' : undefined}
              className={`estate-block estate-chapter estate-chapter--${index % 2 ? 'left' : 'right'} ${isActive ? 'is-active' : ''}`}
              style={{ height }}
            >
              <article className="estate-card">
                <p className="estate-card-eyebrow">{stage.eyebrow}</p>
                <h2>
                  {stage.title[0]}
                  <br />
                  <i>{stage.title[1]}</i>
                </h2>
                <p className="estate-card-copy">{stage.copy}</p>
                <ul className="estate-card-facts">
                  {stage.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
                <span className="estate-card-index" aria-hidden="true">
                  {stage.index} / 06
                </span>
              </article>
            </div>
          )
        })}
      </div>
    </section>
  )
}
