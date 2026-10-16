import { useCallback, useEffect, useRef, useState } from 'react'
import { chapters, hotspotIndex } from './chapters.js'
import { coverPoint, createFilmPlayer, fetchFilm, filmManifest, primeVideo } from './film.js'
import { filmTimeAt } from './timeline.js'
import './experience.css'

const LAST = chapters.length - 1
const VIEW_LABELS = { film: 'Film', '3d': '3D', photo: 'Photos' }

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
  if (saveData()) return null
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return null

  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = window.innerWidth < 820
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4
  return coarse || small || fewCores || lowMemory ? 'low' : 'high'
}

function saveData() {
  return Boolean(navigator.connection?.saveData)
}

// Lighter film encode for phones and small screens, when one is supplied
function prefersMobileFilm() {
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.innerWidth < 820 ||
    (navigator.deviceMemory && navigator.deviceMemory < 4)
  )
}

// 'auto' | 'film' | '3d' | 'photo'
function readPreference() {
  try {
    const stored = window.localStorage.getItem('verona:view')
    if (stored) return stored
    // Earlier versions stored a plain 3D on/off switch
    return window.localStorage.getItem('verona:3d') === 'off' ? 'photo' : 'auto'
  } catch {
    return 'auto'
  }
}

function writePreference(view) {
  try {
    window.localStorage.setItem('verona:view', view)
  } catch {
    // Storage unavailable (private mode) — the choice still applies for this visit.
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EstateExperience() {
  const sectionRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const blockRefs = useRef([])
  const hotspotRefs = useRef({})
  const filmHotspotRefs = useRef({})
  const sceneRef = useRef(null)
  const playerRef = useRef(null)
  const filmUrls = useRef({})
  const activeRef = useRef(0)

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)')

  const [quality] = useState(detectQuality)
  const [filmAllowed] = useState(() => Boolean(filmManifest) && !saveData())
  const [preference, setPreference] = useState(readPreference)
  const [failed, setFailed] = useState({ film: false, '3d': false })
  const [readyView, setReadyView] = useState(null)
  const [filmProgress, setFilmProgress] = useState(0)
  const [notice, setNotice] = useState(null)
  const [active, setActive] = useState(0)
  const [mood, setMood] = useState('dusk')
  const [selectedHotspot, setOpenHotspot] = useState(null)

  // ----- Which view to show -----
  // Film is the hero when its asset exists. The procedural 3D scene takes
  // over when the film is missing, fails, decodes too slowly, or when reduced
  // motion is requested; photography is the final fallback.
  const canShow = {
    film: filmAllowed && !failed.film,
    '3d': Boolean(quality) && !failed['3d'],
    photo: true,
  }
  const autoOrder = reducedMotion ? ['3d', 'film', 'photo'] : ['film', '3d', 'photo']
  const order = preference === 'auto' ? autoOrder : [preference, ...autoOrder.filter((v) => v !== preference)]
  const view = order.find((v) => canShow[v]) ?? 'photo'
  const viewOptions = ['film', '3d', 'photo'].filter((v) => canShow[v])

  // 'loading' → media is being prepared (poster shown meanwhile)
  // 'ready'   → film or 3D is live
  // 'still'   → photography
  const mode = view === 'photo' ? 'still' : readyView === view ? 'ready' : 'loading'
  // Read when the film starts, without restarting the download on change
  const moodRef = useRef(mood)
  useEffect(() => {
    moodRef.current = mood
  }, [mood])

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
      const player = playerRef.current
      if (player) {
        // Reduced motion: cut between chapter frames instead of scrubbing
        if (reducedMotion) player.setTime(filmManifest.marks[chapter], { instant: true })
        else player.setTime(filmTimeAt(progress, filmManifest.marks))
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

  // Feature points over the footage: shown only while the film rests on the
  // exact frame they were placed against.
  const positionFilmHotspots = useCallback(() => {
    const video = videoRef.current
    const stage = stageRef.current
    const player = playerRef.current
    if (!video || !stage || !player || !filmManifest) return
    const { width, height } = stage.getBoundingClientRect()
    const chapterIndex = activeRef.current
    const resting = Math.abs(player.time - filmManifest.marks[chapterIndex]) < 0.12
    for (const [id, point] of Object.entries(filmManifest.hotspots)) {
      const el = filmHotspotRefs.current[id]
      if (!el) continue
      const p = coverPoint(point, video, width, height)
      const show = resting && point.chapter === chapters[chapterIndex].id && p.visible
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
      if (el.dataset.visible !== String(show)) el.dataset.visible = String(show)
    }
  }, [])

  // ----- Film lifecycle -----

  useEffect(() => {
    if (view !== 'film') return undefined

    const video = videoRef.current
    const controller = new AbortController()
    let player = null
    let resizeObserver = null
    let visibilityObserver = null
    let lastPercent = -1

    const fail = (reason, error) => {
      if (controller.signal.aborted) return
      controller.abort()
      if (error) console.warn('[VÉRONA] Film unavailable, falling back.', error)
      setNotice(reason === 'slow' ? 'Film was slow on this device — switched view' : 'Film unavailable — switched view')
      setFailed((f) => ({ ...f, film: true }))
    }

    const start = async () => {
      try {
        const grade = moodRef.current === 'night' && filmManifest.night ? 'night' : 'dusk'
        const sources = filmManifest[grade]
        const src = (prefersMobileFilm() && sources.mobile) || sources.desktop
        const url = await fetchFilm(src, {
          signal: controller.signal,
          onProgress: (p) => {
            const percent = Math.floor(p * 100)
            if (percent !== lastPercent) {
              lastPercent = percent
              setFilmProgress(percent)
            }
          },
        })
        filmUrls.current[grade] = url
        if (controller.signal.aborted) return

        await primeVideo(video, url, { signal: controller.signal })

        player = createFilmPlayer({
          video,
          onFrame: positionFilmHotspots,
          onSlow: () => fail('slow'),
          onError: (error) => fail('error', error),
        })
        playerRef.current = player

        const progress = readProgress()
        const chapter = Math.round(progress * LAST)
        player.setTime(reducedMotion ? filmManifest.marks[chapter] : filmTimeAt(progress, filmManifest.marks), {
          instant: true,
        })

        resizeObserver = new ResizeObserver(positionFilmHotspots)
        resizeObserver.observe(stageRef.current)
        visibilityObserver = new IntersectionObserver(([entry]) => player.setActive(entry.isIntersecting))
        visibilityObserver.observe(sectionRef.current)

        setReadyView('film')
      } catch (error) {
        if (error?.name !== 'AbortError' || !controller.signal.aborted) fail('error', error)
      }
    }

    // Paint the poster and the page first, then start the download.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 600 })
      : window.setTimeout(start, 150)

    return () => {
      controller.abort()
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      player?.dispose()
      playerRef.current = null
      if (video) {
        video.removeAttribute('src')
        video.load()
      }
      for (const url of Object.values(filmUrls.current)) URL.revokeObjectURL(url)
      filmUrls.current = {}
      setReadyView((v) => (v === 'film' ? null : v))
    }
  }, [view, positionFilmHotspots, readProgress, reducedMotion])

  // Dusk / Night for the film: only offered when a matching night grade of
  // the same footage exists; swapped in place at the same timestamp.
  useEffect(() => {
    if (readyView !== 'film' || !filmManifest.night) return undefined
    const grade = mood === 'night' ? 'night' : 'dusk'
    const player = playerRef.current
    const video = videoRef.current
    if (!player || !video) return undefined
    const cached = filmUrls.current[grade]
    if (cached) {
      if (video.src !== cached) player.swapSource(cached)
      return undefined
    }
    const controller = new AbortController()
    const sources = filmManifest[grade]
    fetchFilm((prefersMobileFilm() && sources.mobile) || sources.desktop, { signal: controller.signal })
      .then((url) => {
        filmUrls.current[grade] = url
        if (!controller.signal.aborted) player.swapSource(url)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.warn('[VÉRONA] Night grade unavailable.', error)
        setNotice('Night grade unavailable')
        setMood('dusk')
      })
    return () => controller.abort()
  }, [mood, readyView])

  // ----- 3D lifecycle -----

  useEffect(() => {
    if (view !== '3d') return undefined

    let cancelled = false
    let scene = null
    let resizeObserver = null
    let visibilityObserver = null

    const fail = () => {
      if (cancelled) return
      sceneRef.current?.dispose()
      sceneRef.current = null
      setNotice('3D unavailable — showing photography')
      setFailed((f) => ({ ...f, '3d': true }))
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

        setReadyView('3d')
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
      setReadyView((v) => (v === '3d' ? null : v))
    }
  }, [view, quality, positionHotspots, readProgress, reducedMotion])

  // Mood (3D)
  useEffect(() => {
    sceneRef.current?.setMood(mood === 'night' ? 1 : 0, { instant: reducedMotion })
  }, [mood, readyView, reducedMotion])

  // Pointer parallax (3D only — the film's camera is the director's)
  useEffect(() => {
    if (readyView !== '3d' || !finePointer || reducedMotion) return undefined
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
  }, [readyView, finePointer, reducedMotion])

  const goToChapter = (index) => {
    blockRefs.current[index]?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const chooseView = (next) => {
    writePreference(next)
    setPreference(next)
    setNotice(null)
    setOpenHotspot(null)
  }

  const live3D = readyView === '3d' && view === '3d'
  const liveFilm = readyView === 'film' && view === 'film'
  const moodAvailable = live3D || (liveFilm && Boolean(filmManifest.night))

  // Film feature points mount once the film is live; place them straight
  // away rather than waiting for the next seek (the first one may already
  // have resolved), and again whenever the chapter changes.
  useEffect(() => {
    if (liveFilm) positionFilmHotspots()
  }, [liveFilm, active, positionFilmHotspots])
  const feature = openHotspot ? hotspotIndex[openHotspot] : null
  const poster = (view === 'film' && filmManifest?.[mood === 'night' && filmManifest.night ? 'night' : 'dusk'].poster) || chapters[0].still

  return (
    <section
      ref={sectionRef}
      className={`estate estate--${mode} estate--view-${view} estate--${mood}`}
      aria-label="VÉRONA residence walkthrough"
    >
      {/* ================= STAGE (sticky) ================= */}

      <div ref={stageRef} className="estate-stage">
        <div className="estate-stills" aria-hidden="true">
          {chapters.map((chapter, index) => {
            // Outside the photographic view only the poster is kept, so the
            // chapter photos are never downloaded alongside the film or 3D.
            if (mode !== 'still' && index !== 0) return null
            return (
              <img
                key={chapter.id}
                src={index === 0 ? poster : chapter.still}
                alt=""
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'auto'}
                loading={index === 0 ? 'eager' : 'lazy'}
                className={(mode === 'still' ? index === active : true) ? 'is-active' : ''}
              />
            )
          })}
        </div>

        {view === 'film' && (
          <video
            ref={videoRef}
            className="estate-video"
            muted
            playsInline
            preload="none"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            aria-hidden="true"
          />
        )}

        {view === '3d' && (
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
          {liveFilm &&
            Object.keys(filmManifest.hotspots).map((id) => (
              <button
                key={id}
                ref={(el) => {
                  filmHotspotRefs.current[id] = el
                }}
                type="button"
                className={`hotspot ${openHotspot === id ? 'is-open' : ''}`}
                data-visible="false"
                tabIndex={-1}
                onClick={() => setOpenHotspot(openHotspot === id ? null : id)}
              >
                <span className="hotspot-dot" />
                <span className="hotspot-label">{hotspotIndex[id].label}</span>
              </button>
            ))}
          {live3D &&
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
            {mode === 'loading' && view === 'film' && (
              <span className="estate-loading">Loading film {filmProgress > 0 ? `${filmProgress}%` : ''}</span>
            )}
            {mode === 'loading' && view === '3d' && <span className="estate-loading">Preparing 3D view</span>}
            {mode !== 'loading' && notice && <span>{notice}</span>}
            {mode === 'still' && !notice && viewOptions.length === 1 && <span>Photographic view</span>}
          </div>

          {moodAvailable && (
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

          {viewOptions.length > 1 && (
            <div className="estate-mood estate-views" role="group" aria-label="View">
              {viewOptions.map((value) => (
                <button key={value} type="button" aria-pressed={view === value} onClick={() => chooseView(value)}>
                  {VIEW_LABELS[value]}
                </button>
              ))}
            </div>
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
