import { useEffect, useRef, useState } from 'react'
import './App.css'
import EstateExperience from './experience/EstateExperience.jsx'
import SitePlan from './experience/SitePlan.jsx'

const IMG = '/Images'

const residences = [
  {
    no: '01',
    title: 'VÉRONA HEIGHTS',
    location: 'Golf Course Road / Gurugram',
    type: 'PRIVATE RESIDENCES',
    image: `${IMG}/property-01.jpg`,
  },
  {
    no: '02',
    title: 'THE VILLAS',
    location: 'South Delhi / New Delhi',
    type: 'SIGNATURE VILLAS',
    image: `${IMG}/property-02.jpg`,
  },
  {
    no: '03',
    title: 'VERONA ONE',
    location: 'Sector 54 / Gurugram',
    type: 'SKY RESIDENCES',
    image: `${IMG}/property-03.jpg`,
  },
]

const amenities = [
  'Private arrival',
  'Infinity pool',
  'Residents club',
  'Wellness studio',
  'Landscaped gardens',
  '24h concierge',
]

// Views of the estate, captured from the same 3D model as the film
// (scripts/capture-gallery.mjs). Each has a 1x and 2x width.
const STILLS = {
  aerial: {
    src: 'estate-aerial',
    widths: [1200, 2400],
    ratio: [16, 9],
    caption: 'The estate at golden hour',
    alt: 'Aerial view of the VÉRONA estate at golden hour: flat-roofed villas, gardens and pools along one avenue, ringed by woodland.',
  },
  hero: {
    src: 'hero-dusk',
    widths: [1200, 2400],
    ratio: [16, 9],
    caption: 'The principal villa, at dusk',
    alt: 'The principal villa at dusk, its glazed ground floor and upper rooms lit behind a clipped hedge and a specimen tree.',
  },
  fins: {
    src: 'oak-fins',
    widths: [750, 1500],
    ratio: [3, 4],
    caption: 'Oak fins over the upper floor',
    alt: 'Close view of vertical oak fins shading upper-floor glazing, above the ground-floor terrace in evening light.',
  },
  pool: {
    src: 'pool-terrace',
    widths: [1000, 2000],
    ratio: [4, 3],
    caption: 'Pool terrace, west light',
    alt: 'A villa seen across its pool and stone terrace in low evening sun.',
  },
  avenue: {
    src: 'avenue',
    widths: [750, 1500],
    ratio: [3, 4],
    caption: 'The cypress avenue',
    alt: 'The estate road at golden hour, lined with cypress trees, street lights and footpaths.',
  },
  garden: {
    src: 'garden-dusk',
    widths: [1000, 2000],
    ratio: [4, 3],
    caption: 'Garden elevation, dusk',
    alt: 'The garden side of the principal villa at dusk: oak fins over lit rooms and a long terrace.',
  },
  club: {
    src: 'club-dusk',
    widths: [1200, 2400],
    ratio: [16, 9],
    caption: 'The residents’ club',
    alt: 'The residents’ club, a long glazed pavilion with its pool, lit at dusk.',
  },
  foundations: {
    src: 'foundations',
    widths: [1000, 2000],
    ratio: [4, 3],
    caption: 'A ground slab, poured over its reinforcement',
    alt: 'A villa’s ground-floor slab during the pour: finished concrete beside the steel reinforcement mat, framed by timber edge formwork.',
  },
}

const GALLERY = ['aerial', 'garden', 'fins', 'pool', 'avenue']

function Still({ still, sizes, className = '', loading = 'lazy' }) {
  const [small, large] = still.widths
  return (
    <img
      className={className}
      src={`${IMG}/estate/${still.src}-${small}.webp`}
      srcSet={`${IMG}/estate/${still.src}-${small}.webp ${small}w, ${IMG}/estate/${still.src}-${large}.webp ${large}w`}
      sizes={sizes}
      width={still.ratio[0] * 100}
      height={still.ratio[1] * 100}
      alt={still.alt}
      loading={loading}
      decoding="async"
    />
  )
}

function SectionHead({ index, label, tone }) {
  return (
    <div className={`section-head ${tone ? `section-head--${tone}` : ''}`}>
      <span>{index}</span>
      <i aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

// A gallery image that opens the viewer. The image itself is the button.
function GalleryFigure({ id, sizes, onOpen, className = '' }) {
  const still = STILLS[id]
  const n = GALLERY.indexOf(id) + 1
  return (
    <figure className={`gallery-figure ${className}`}>
      <button type="button" className="gallery-open" onClick={() => onOpen(id)} aria-label={`View larger: ${still.caption}`}>
        <Still still={still} sizes={sizes} />
      </button>
      <figcaption>
        <span>{still.caption}</span>
        <span>{String(n).padStart(2, '0')}</span>
      </figcaption>
    </figure>
  )
}

// Full-screen viewer on the native <dialog>: Escape closes it, focus returns to the
// image that opened it, and the arrow keys move through the set.
function Lightbox({ openId, onClose, onMove }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (openId && !dialog.open) dialog.showModal()
    if (!openId && dialog.open) dialog.close()
  }, [openId])

  const still = openId ? STILLS[openId] : null
  const index = openId ? GALLERY.indexOf(openId) : 0

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label="Estate gallery"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') onMove(1)
        if (event.key === 'ArrowLeft') onMove(-1)
      }}
    >
      {still && (
        <figure className="lightbox-figure">
          <img
            src={`${IMG}/estate/${still.src}-${still.widths[1]}.webp`}
            width={still.ratio[0] * 100}
            height={still.ratio[1] * 100}
            alt={still.alt}
          />
          <figcaption>
            <span>{still.caption}</span>
            <span>
              {String(index + 1).padStart(2, '0')} / {String(GALLERY.length).padStart(2, '0')}
            </span>
          </figcaption>
        </figure>
      )}
      <div className="lightbox-controls">
        <button type="button" onClick={() => onMove(-1)} aria-label="Previous image">
          ←
        </button>
        <button type="button" onClick={() => onMove(1)} aria-label="Next image">
          →
        </button>
        <button type="button" className="lightbox-close" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </dialog>
  )
}

function App() {
  const [menu, setMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [interest, setInterest] = useState('')
  const [enquiry, setEnquiry] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [preview, setPreview] = useState(0)
  const sentRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menu])

  // After sending, move focus to the confirmation so it is announced and reachable.
  useEffect(() => {
    if (enquiry) sentRef.current?.focus()
  }, [enquiry])

  const closeMenu = () => setMenu(false)

  const moveViewer = (step) =>
    setViewing((id) => {
      if (!id) return id
      const i = GALLERY.indexOf(id)
      return GALLERY[(i + step + GALLERY.length) % GALLERY.length]
    })

  return (
    <div className="verona">

      {/* ================= NAV ================= */}

      <header className={`nav ${scrolled ? 'nav--solid' : ''}`}>
        <a href="#top" className="nav-logo" onClick={closeMenu}>
          <span className="nav-logo-symbol">V</span>
          <span>VÉRONA</span>
        </a>

        <nav className="nav-links" aria-label="Primary">
          <a href="#walkthrough">The Estate</a>
          <a href="#gallery">Gallery</a>
          <a href="#residences">Residences</a>
          <a href="#philosophy">Philosophy</a>
          <a href="#experience">Experience</a>
          <a href="#address">Address</a>
        </nav>

        <a href="#enquire" className="nav-enquire">
          PRIVATE ENQUIRY
          <span>↗</span>
        </a>

        <button
          className={`menu-toggle ${menu ? 'is-open' : ''}`}
          onClick={() => setMenu(!menu)}
          aria-label={menu ? 'Close menu' : 'Open menu'}
          aria-expanded={menu}
          aria-controls="mobile-nav"
        >
          <span />
          <span />
        </button>
      </header>

      {/* ================= MOBILE MENU ================= */}

      <div
        id="mobile-nav"
        className={`mobile-nav ${menu ? 'mobile-nav--open' : ''}`}
        inert={!menu}
      >
        <nav className="mobile-nav-inner" aria-label="Mobile">
          <p className="mobile-nav-kicker">VÉRONA ESTATES / 2026</p>

          {[
            ['#walkthrough', 'The Estate'],
            ['#gallery', 'Gallery'],
            ['#residences', 'Residences'],
            ['#philosophy', 'Philosophy'],
            ['#experience', 'Experience'],
            ['#address', 'The Address'],
            ['#enquire', 'Private Enquiry'],
          ].map(([href, label], i) => (
            <a key={href} href={href} onClick={closeMenu}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {label}
              <b>↗</b>
            </a>
          ))}
        </nav>
      </div>

      <main id="top">

        {/* ================= HERO: THE ESTATE FILM ================= */}

        <EstateExperience />

        {/* ================= PROLOGUE: continues from the film's cream handoff ================= */}

        <section className="prologue" aria-labelledby="prologue-title">
          <div className="prologue-thread" aria-hidden="true" />

          <p className="eyebrow prologue-kicker">The VÉRONA standard</p>

          <div className="prologue-grid">
            <h2 id="prologue-title">
              We create <i>places</i>
              <br />
              worth coming <i>home to.</i>
            </h2>

            <div className="prologue-copy">
              <p className="large-copy">
                VÉRONA is a collection of residences shaped by architecture,
                light and an uncompromising attention to detail.
              </p>

              <p>
                Not designed to follow a moment. Designed to belong to one.
                Every residence begins with the same belief — that luxury is
                not what you add, but what you leave room for.
              </p>

              <a href="#philosophy" className="under-link">
                <span>Discover our philosophy</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <ul className="prologue-words" aria-label="Principles">
            <li>Architecture</li>
            <li>Form</li>
            <li>Light</li>
            <li>Material</li>
            <li>Space</li>
          </ul>
        </section>

        {/* ================= GALLERY ================= */}

        <section id="gallery" className="gallery" aria-labelledby="gallery-title">
          <div className="gallery-head">
            <SectionHead index="01" label="Gallery" />
            <h2 id="gallery-title">
              The estate,
              <br />
              <i>in its own light.</i>
            </h2>
            <p>
              Seven villas and a residents’ club on one landscape, seen at
              golden hour and as the lights come on.
            </p>
          </div>

          <GalleryFigure id="aerial" className="gallery-figure--wide" sizes="100vw" onOpen={setViewing} />

          <div className="gallery-row gallery-row--a">
            <GalleryFigure id="garden" className="g-hero" sizes="(max-width: 760px) 100vw, 62vw" onOpen={setViewing} />
            <GalleryFigure id="fins" className="g-fins" sizes="(max-width: 760px) 100vw, 24vw" onOpen={setViewing} />
          </div>

          <div className="gallery-row gallery-row--b">
            <p className="gallery-note">
              One architectural language — travertine, mineral render, oak and
              glass — repeated with care, never copied, from plot to plot.
            </p>
            <GalleryFigure id="pool" className="g-pool" sizes="(max-width: 760px) 100vw, 56vw" onOpen={setViewing} />
          </div>

          <div className="gallery-row gallery-row--c">
            <GalleryFigure id="avenue" className="g-avenue" sizes="(max-width: 760px) 100vw, 30vw" onOpen={setViewing} />
            <p className="gallery-note gallery-note--arrival">
              <span className="eyebrow">Arrival</span>
              The road is surfaced from the gate inwards; a cypress avenue and
              lit footpaths lead every resident home.
            </p>
          </div>

          <p className="gallery-credit">
            Computer-generated views of the VÉRONA concept estate, taken from the
            same model as the film above. Illustrative only.
          </p>
        </section>

        <Lightbox openId={viewing} onClose={() => setViewing(null)} onMove={moveViewer} />

        {/* ================= RESIDENCES ================= */}

        <section id="residences" className="collection" aria-labelledby="collection-title">
          <div className="collection-head">
            <SectionHead index="02" label="The Collection" tone="light" />
            <h2 id="collection-title">
              Made for <i>living.</i>
            </h2>
            <p>
              Three distinct expressions of the VÉRONA philosophy. Each one
              conceived as a complete world of its own.
            </p>
          </div>

          <div className="collection-body">
            <div className="collection-preview" aria-hidden="true">
              {residences.map((residence, index) => (
                <img
                  key={residence.no}
                  src={residence.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={index === preview ? 'is-active' : ''}
                />
              ))}
            </div>

            <ol className="collection-list">
              {residences.map((residence, index) => (
                <li key={residence.no} className={index === preview ? 'is-active' : ''}>
                  <a
                    href="#enquire"
                    className="collection-item"
                    onClick={() => setInterest(residence.title)}
                    onMouseEnter={() => setPreview(index)}
                    onFocus={() => setPreview(index)}
                    aria-label={`Enquire about ${residence.title}, ${residence.type.toLowerCase()}, ${residence.location}`}
                  >
                    <img className="collection-inline" src={residence.image} alt="" loading="lazy" decoding="async" />
                    <span className="collection-no">{residence.no}</span>
                    <span className="collection-title">{residence.title}</span>
                    <span className="collection-meta">
                      <span>{residence.type}</span>
                      <span>{residence.location}</span>
                    </span>
                    <span className="collection-cta" aria-hidden="true">
                      Enquire <b>↗</b>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ================= PHILOSOPHY ================= */}

        <section id="philosophy" className="philosophy" aria-labelledby="philosophy-title">
          <div className="philosophy-quote">
            <SectionHead index="03" label="The VÉRONA Idea" />
            <p className="philosophy-pull">
              Luxury <i>is</i> space.
            </p>
            <span className="philosophy-tag">Quiet / Considered / Timeless</span>
          </div>

          <div className="philosophy-grid">
            <figure className="philosophy-figure">
              <Still still={STILLS.foundations} sizes="(max-width: 760px) 100vw, 46vw" />
              <figcaption>{STILLS.foundations.caption}</figcaption>
            </figure>

            <div className="philosophy-text">
              <p className="eyebrow">Quiet luxury</p>
              <h2 id="philosophy-title">
                Less <i>noise.</i>
                <br />
                More <i>life.</i>
              </h2>
              <p className="philosophy-copy">
                We believe the most luxurious spaces are the ones that allow
                life to take centre stage.
              </p>

              <ol className="principles">
                <li>
                  <span>01</span>
                  Thoughtful architecture
                </li>
                <li>
                  <span>02</span>
                  Timeless materials
                </li>
                <li>
                  <span>03</span>
                  Effortless living
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* ================= INTERIORS ================= */}

        <section className="interiors" aria-labelledby="interiors-title">
          <div className="interiors-text">
            <SectionHead index="04" label="The Interiors" />
            <h2 id="interiors-title">
              Spaces <i>with soul.</i>
            </h2>
            <p>Rooms designed around the way you actually live.</p>
            <span className="interiors-tag">Warm materials / Natural light / Restraint</span>
            <p className="interiors-credit">
              Interior mood imagery, illustrating the direction. Not photographs of the residences.
            </p>
          </div>

          <figure className="interiors-a">
            <img src={`${IMG}/living-room.jpg`} alt="Interior mood: a living room in warm timber and soft evening light." loading="lazy" decoding="async" width="736" height="589" />
            <figcaption>Living</figcaption>
          </figure>
          <figure className="interiors-b">
            <img src={`${IMG}/bedroom.jpg`} alt="Interior mood: a bedroom with warm, low lighting and natural textiles." loading="lazy" decoding="async" width="736" height="1307" />
            <figcaption>Private quarters</figcaption>
          </figure>
          <figure className="interiors-c">
            <img src={`${IMG}/kitchen.jpg`} alt="Interior mood: a kitchen in stone and dark timber." loading="lazy" decoding="async" width="736" height="1104" />
            <figcaption>The kitchen</figcaption>
          </figure>
        </section>

        {/* ================= EXPERIENCE ================= */}

        <section id="experience" className="experience" aria-labelledby="experience-title">
          <figure className="experience-figure">
            <Still still={STILLS.club} sizes="(max-width: 760px) 100vw, 58vw" />
            <figcaption>{STILLS.club.caption}</figcaption>
          </figure>

          <div className="experience-text">
            <SectionHead index="05" label="Beyond the Residence" tone="light" />
            <h2 id="experience-title">
              Every <i>moment,</i>
              <br />
              considered.
            </h2>
            <p>
              A private world of spaces designed to make everyday life feel
              extraordinary without ever demanding attention.
            </p>

            <ul className="amenity-list">
              {amenities.map((item, index) => (
                <li key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= ADDRESS ================= */}

        <section id="address" className="address" aria-labelledby="address-title">
          <div className="address-text">
            <SectionHead index="06" label="The Address" />
            <h2 id="address-title">
              The city
              <br />
              <i>at your door.</i>
            </h2>
            <p className="address-copy">
              VÉRONA places you within the capital's most sought-after
              corridors — close to the places that matter, yet removed
              enough to feel entirely your own.
            </p>

            <dl className="address-locations">
              <div>
                <dt>Gurugram</dt>
                <dd>Golf Course Road</dd>
              </div>
              <div>
                <dt>New Delhi</dt>
                <dd>South Delhi</dd>
              </div>
            </dl>
          </div>

          <figure className="address-plan">
            <div className="address-plan-frame">
              <SitePlan stage={7} />
            </div>
            <figcaption>
              <span>The estate master plan</span>
              <span>The capital / India · 28°27′N 77°04′E</span>
            </figcaption>
          </figure>
        </section>

        {/* ================= FINAL CTA ================= */}

        <section id="enquire" className="final-cta" aria-labelledby="enquire-title">

          <Still still={STILLS.hero} sizes="100vw" className="final-image" />

          <div className="final-overlay" />

          <div className="final-content">

            <div className="final-intro">
              <p className="eyebrow">Private viewings</p>

              <h2 id="enquire-title">
                Begin your
                <br />
                <i>next chapter.</i>
              </h2>

              <p>
                Tell us which residence you would like to see, and how you
                would like to see it.
              </p>
            </div>

            {enquiry ? (
              <div className="enquiry enquiry--sent" role="status">
                <p className="eyebrow">THANK YOU{enquiry.name ? `, ${enquiry.name.toUpperCase()}` : ''}</p>
                <h3 ref={sentRef} tabIndex={-1}>Your enquiry is ready.</h3>
                <p>
                  VÉRONA is a concept demo by JynxBuilds, so nothing has been
                  sent. On a live site this would go straight to the sales
                  team.
                </p>
                <button type="button" className="final-button" onClick={() => setEnquiry(null)}>
                  <span>START AGAIN</span>
                  <strong aria-hidden="true">↺</strong>
                </button>
              </div>
            ) : (
              <form
                className="enquiry"
                onSubmit={(event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  setEnquiry({ name: String(data.get('name') || '').trim().split(' ')[0] })
                }}
              >
                <div className="enquiry-row">
                  <label>
                    <span>Name</span>
                    <input name="name" type="text" autoComplete="name" required />
                  </label>
                  <label>
                    <span>Email</span>
                    <input name="email" type="email" autoComplete="email" required />
                  </label>
                </div>

                <label>
                  <span>Residence</span>
                  <select
                    name="residence"
                    value={interest}
                    onChange={(event) => setInterest(event.target.value)}
                  >
                    <option value="">Not sure yet</option>
                    {residences.map((residence) => (
                      <option key={residence.no} value={residence.title}>
                        {residence.title} — {residence.location}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend>Viewing</legend>
                  <label className="enquiry-choice">
                    <input type="radio" name="viewing" value="in-person" defaultChecked />
                    <span>In person</span>
                  </label>
                  <label className="enquiry-choice">
                    <input type="radio" name="viewing" value="guided-3d" />
                    <span>Guided 3D walkthrough</span>
                  </label>
                </fieldset>

                <button type="submit" className="final-button">
                  <span>REQUEST A PRIVATE VIEWING</span>
                  <strong aria-hidden="true">↗</strong>
                </button>

                <p className="enquiry-note">
                  Concept demo — this form does not send any data.
                </p>
              </form>
            )}

          </div>

          <div className="final-corner final-corner--left">
            VÉRONA ESTATES
          </div>

          <div className="final-corner final-corner--right">
            GURUGRAM / NEW DELHI
          </div>

        </section>

      </main>

      {/* ================= FOOTER ================= */}

      <footer className="footer">

        <div className="footer-giant" aria-hidden="true">
          VÉRONA
        </div>

        <div className="footer-grid">

          <div className="footer-brand">
            <div className="footer-symbol" aria-hidden="true">V</div>
            <span>VÉRONA ESTATES</span>
          </div>

          <div className="footer-column">
            <span>EXPLORE</span>
            <a href="#gallery">Gallery</a>
            <a href="#residences">Residences</a>
            <a href="#philosophy">Philosophy</a>
            <a href="#experience">Experience</a>
            <a href="#address">Address</a>
          </div>

          <div className="footer-column">
            <span>LOCATIONS</span>
            <p>Gurugram</p>
            <p>New Delhi</p>
          </div>

          <div className="footer-column">
            <span>CONTACT</span>
            <a href="#enquire">
              Private Enquiry
            </a>
            <a href="#top">Back to top ↑</a>
          </div>

        </div>

        <p className="footer-disclaimer">
          VÉRONA Estates is a fictional brand created by JynxBuilds as a
          concept demo. Residences, locations, imagery and the 3D estate are
          illustrative and do not represent real listings or a real development.
        </p>

        <div className="footer-bottom">
          <span>© 2026 VÉRONA ESTATES — CONCEPT</span>
          <span>NOT A REAL DEVELOPMENT</span>
          <span>BUILT TO BE SEEN — JYNXBUILDS</span>
        </div>

      </footer>

    </div>
  )
}

export default App
