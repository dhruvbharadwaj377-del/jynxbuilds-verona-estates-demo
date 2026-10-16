import { useEffect, useState } from 'react'
import './App.css'
import EstateExperience from './experience/EstateExperience.jsx'

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

function App() {
  const [menu, setMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [interest, setInterest] = useState('')
  const [enquiry, setEnquiry] = useState(null)

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

  const closeMenu = () => setMenu(false)

  return (
    <div className="verona">

      {/* ================= NAV ================= */}

      <header className={`nav ${scrolled ? 'nav--solid' : ''}`}>
        <a href="#top" className="nav-logo" onClick={closeMenu}>
          <span className="nav-logo-symbol">V</span>
          <span>VÉRONA</span>
        </a>

        <nav className="nav-links" aria-label="Primary">
          <a href="#walkthrough">Walkthrough</a>
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

          <a href="#walkthrough" onClick={closeMenu}>
            <span>01</span>
            Walkthrough
            <b>↗</b>
          </a>

          <a href="#residences" onClick={closeMenu}>
            <span>02</span>
            Residences
            <b>↗</b>
          </a>

          <a href="#philosophy" onClick={closeMenu}>
            <span>03</span>
            Philosophy
            <b>↗</b>
          </a>

          <a href="#experience" onClick={closeMenu}>
            <span>04</span>
            Experience
            <b>↗</b>
          </a>

          <a href="#address" onClick={closeMenu}>
            <span>05</span>
            The Address
            <b>↗</b>
          </a>

          <a href="#enquire" onClick={closeMenu}>
            <span>06</span>
            Private Enquiry
            <b>↗</b>
          </a>
        </nav>
      </div>

      <main id="top">

        {/* ================= HERO + 3D WALKTHROUGH ================= */}

        <EstateExperience />

        {/* ================= OPENING STATEMENT ================= */}

        <section className="manifesto">

          <div className="manifesto-top">
            <span>01 / 06</span>
            <span>THE VÉRONA STANDARD</span>
          </div>

          <div className="manifesto-grid">

            <div className="manifesto-title">
              <p className="eyebrow">A DIFFERENT STANDARD</p>

              <h2>
                We create
                <br />
                <i>places</i>
                <br />
                worth coming
                <br />
                <i>home to.</i>
              </h2>
            </div>

            <div className="manifesto-copy">
              <div className="copy-number">01</div>

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
                <span>↗</span>
              </a>
            </div>

          </div>

          <div className="manifesto-bottom">
            <span>ARCHITECTURE</span>
            <span>FORM</span>
            <span>LIGHT</span>
            <span>MATERIAL</span>
            <span>SPACE</span>
          </div>

        </section>

        {/* ================= FULL BLEED DETAIL ================= */}

        <section className="cinema-image">
          <img src={`${IMG}/detail.jpg`} alt="Architectural detail" loading="lazy" decoding="async" />

          <div className="cinema-overlay" />

          <div className="cinema-caption">
            <span>THE LANGUAGE OF MATERIAL</span>
            <span>02 / 06</span>
          </div>

          <div className="cinema-word">
            FORM
          </div>
        </section>

        {/* ================= RESIDENCES ================= */}

        <section id="residences" className="collection">

          <div className="collection-heading">

            <div className="collection-index">
              <span>02 / 06</span>
              <span>THE COLLECTION</span>
            </div>

            <div className="collection-title">
              <p className="eyebrow">PRIVATE RESIDENCES</p>

              <h2>
                Made for
                <br />
                <i>living.</i>
              </h2>
            </div>

            <p className="collection-intro">
              Three distinct expressions of the VÉRONA philosophy. Each one
              conceived as a complete world of its own.
            </p>

          </div>

          <div className="residence-stack">

            {residences.map((residence, index) => (
              <article
                className={`residence residence--${index + 1}`}
                key={residence.no}
              >

                <div className="residence-number">
                  {residence.no}
                </div>

                <a
                  href="#enquire"
                  className="residence-image"
                  onClick={() => setInterest(residence.title)}
                  aria-label={`Enquire about ${residence.title}`}
                >
                  <img src={residence.image} alt="" loading="lazy" />

                  <div className="residence-hover" aria-hidden="true">
                    <span>ENQUIRE</span>
                    <strong>↗</strong>
                  </div>
                </a>

                <div className="residence-details">

                  <div className="residence-title">
                    <span>{residence.type}</span>
                    <h3>{residence.title}</h3>
                    <p>{residence.location}</p>
                  </div>

                  <div className="residence-side">
                    <span>VÉRONA / {residence.no}</span>
                    <a
                      href="#enquire"
                      className="residence-link"
                      onClick={() => setInterest(residence.title)}
                    >
                      ENQUIRE ↗
                    </a>
                  </div>

                </div>

              </article>
            ))}

          </div>

        </section>

        {/* ================= BIG TYPOGRAPHY BREAK ================= */}

        <section className="type-break">

          <div className="type-break-small">
            <span>THE VÉRONA IDEA</span>
            <span>MMXXIV</span>
          </div>

          <h2>
            <span>Luxury</span>
            <i>is</i>
            <span>space.</span>
          </h2>

          <div className="type-break-bottom">
            <span>QUIET / CONSIDERED / TIMELESS</span>
            <span>03 / 06</span>
          </div>

        </section>

        {/* ================= PHILOSOPHY ================= */}

        <section id="philosophy" className="philosophy">

          <div className="philosophy-photo">
            <img src={`${IMG}/living-room.jpg`} alt="Luxury VÉRONA interior" loading="lazy" decoding="async" />

            <div className="photo-index">
              <span>03</span>
              <span>INTERIORS</span>
            </div>
          </div>

          <div className="philosophy-panel">

            <div className="panel-top">
              <span>03 / 06</span>
              <span>THE PHILOSOPHY</span>
            </div>

            <div className="panel-main">

              <p className="eyebrow">QUIET LUXURY</p>

              <h2>
                Less
                <br />
                <i>noise.</i>
                <br />
                More
                <br />
                <i>life.</i>
              </h2>

              <p className="panel-copy">
                We believe the most luxurious spaces are the ones that allow
                life to take centre stage.
              </p>

            </div>

            <div className="panel-stats">

              <div>
                <strong>01</strong>
                <span>THOUGHTFUL<br />ARCHITECTURE</span>
              </div>

              <div>
                <strong>02</strong>
                <span>TIMELESS<br />MATERIALS</span>
              </div>

              <div>
                <strong>03</strong>
                <span>EFFORTLESS<br />LIVING</span>
              </div>

            </div>

          </div>

        </section>

        {/* ================= INTERIOR EDITORIAL ================= */}

        <section className="editorial">

          <div className="editorial-head">
            <span>04 / 06</span>
            <p className="eyebrow">THE INTERIORS</p>
            <span>SPACES WITH SOUL</span>
          </div>

          <div className="editorial-layout">

            <div className="editorial-main">
              <img src={`${IMG}/bedroom.jpg`} alt="VÉRONA bedroom" loading="lazy" decoding="async" />

              <div className="editorial-label">
                <span>01</span>
                <strong>THE PRIVATE QUARTERS</strong>
              </div>
            </div>

            <div className="editorial-copy">
              <p>
                Rooms designed around the way you actually live.
              </p>

              <span>
                WARM MATERIALS / NATURAL LIGHT / RESTRAINT
              </span>
            </div>

            <div className="editorial-small">
              <img src={`${IMG}/kitchen.jpg`} alt="VÉRONA kitchen" loading="lazy" decoding="async" />

              <div className="editorial-label">
                <span>02</span>
                <strong>THE KITCHEN</strong>
              </div>
            </div>

          </div>

        </section>

        {/* ================= EXPERIENCE ================= */}

        <section id="experience" className="experience">

          <div className="experience-image">
            <img src={`${IMG}/pool.jpg`} alt="VÉRONA infinity pool" loading="lazy" decoding="async" />

            <div className="experience-image-word">
              EXPERIENCE
            </div>
          </div>

          <div className="experience-content">

            <div className="experience-top">
              <span>05 / 06</span>
              <span>BEYOND THE RESIDENCE</span>
            </div>

            <div className="experience-heading">

              <p className="eyebrow">THE EXPERIENCE</p>

              <h2>
                Every
                <br />
                <i>moment,</i>
                <br />
                considered.
              </h2>

              <p>
                A private world of spaces designed to make everyday life feel
                extraordinary without ever demanding attention.
              </p>

            </div>

            <div className="amenity-list">

              {amenities.map((item, index) => (
                <div className="amenity-row" key={item}>
                  <span>0{index + 1}</span>
                  <strong>{item}</strong>
                  <span>↗</span>
                </div>
              ))}

            </div>

          </div>

        </section>

        {/* ================= IMAGE TRIPTYCH ================= */}

        <section className="triptych">

          <div>
            <img src={`${IMG}/clubhouse.jpg`} alt="VÉRONA clubhouse" loading="lazy" decoding="async" />
            <span>THE CLUBHOUSE</span>
          </div>

          <div>
            <img src={`${IMG}/amenity.jpg`} alt="VÉRONA gardens" loading="lazy" decoding="async" />
            <span>THE GARDENS</span>
          </div>

          <div>
            <img src={`${IMG}/location.jpg`} alt="VÉRONA location" loading="lazy" decoding="async" />
            <span>THE ADDRESS</span>
          </div>

        </section>

        {/* ================= ADDRESS ================= */}

        <section id="address" className="address">

          <div className="address-content">

            <div className="address-top">
              <span>06 / 06</span>
              <span>THE ADDRESS</span>
            </div>

            <div className="address-main">

              <p className="eyebrow">POSITIONED WITH INTENT</p>

              <h2>
                The city
                <br />
                <i>at your door.</i>
              </h2>

              <p className="address-copy">
                VÉRONA places you within the capital's most sought-after
                corridors — close to the places that matter, yet removed
                enough to feel entirely your own.
              </p>

            </div>

            <div className="address-locations">

              <div>
                <span>01</span>
                <p>GURUGRAM</p>
                <strong>Golf Course Road</strong>
              </div>

              <div>
                <span>02</span>
                <p>NEW DELHI</p>
                <strong>South Delhi</strong>
              </div>

            </div>

          </div>

          <div className="address-photo">
            <img src={`${IMG}/location.jpg`} alt="Gurugram skyline" loading="lazy" decoding="async" />

            <div className="address-marker">
              <span>V</span>
            </div>

            <div className="address-photo-caption">
              <span>THE CAPITAL / INDIA</span>
              <span>28°27′N 77°04′E</span>
            </div>
          </div>

        </section>

        {/* ================= FINAL CTA ================= */}

        <section id="enquire" className="final-cta">

          <img src={`${IMG}/hero.jpg`} alt="" loading="lazy" decoding="async" />

          <div className="final-overlay" />

          <div className="final-content">

            <div className="final-intro">
              <p className="eyebrow">PRIVATE VIEWINGS</p>

              <h2>
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
                <h3>Your enquiry is ready.</h3>
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

        <div className="footer-giant">
          VÉRONA
        </div>

        <div className="footer-grid">

          <div className="footer-brand">
            <div className="footer-symbol">V</div>
            <span>VÉRONA ESTATES</span>
          </div>

          <div className="footer-column">
            <span>EXPLORE</span>
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
          concept demo. Residences, locations, imagery and the 3D residence are
          illustrative and do not represent real listings.
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