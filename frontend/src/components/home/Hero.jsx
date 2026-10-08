import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import photos from '../../data/photos.json'
import { building } from '../../lib/prerender'
import { copies } from '../ui/Photo'
import HeroThread from './HeroThread'
import './home.css'

// Background slides: the cities our members are heading to. The first photo is the page's main picture,
// so it loads alone; the next two join once the page has finished loading, and the rest as the show moves on.
// Phones get an upright crop, so they are not sent a wide photo to show a narrow strip of it.
// Each city also brings up a question from that country's community in the card beside the headline.
const SLIDES = [
  { src: '/images/slide-london.jpg', city: 'London', country: 'uk' },
  { src: '/images/slide-newyork.jpg', city: 'New York', country: 'usa' },
  { src: '/images/slide-toronto.jpg', city: 'Toronto', country: 'canada' },
  { src: '/images/slide-sydney.jpg', city: 'Sydney', country: 'australia' },
  { src: '/images/slide-dublin.jpg', city: 'Dublin', country: 'ireland' },
  { src: '/images/slide-berlin.jpg', city: 'Berlin', country: 'germany' },
]
const COUNTRIES = SLIDES.map((s) => s.country)
const INTERVAL = 3000      // the photo changes every 3 seconds
const CARD_INTERVAL = 6500 // the question card types its answer, then needs time to be read

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function AskBar() {
  const navigate = useNavigate()
  const submit = (e) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q').trim()
    navigate(q ? `/ai?q=${encodeURIComponent(q)}` : '/ai')
  }
  return (
    <form className="askbar" action="/ai" onSubmit={submit} role="search" aria-label="Ask TYM AI">
      <label htmlFor="askbar-q" className="askbar-label">Ask TYM AI</label>
      <input id="askbar-q" name="q" placeholder="How much money do I need for a UK student visa?" autoComplete="off" />
      <button className="btn btn-light btn-sm">Ask <ArrowUpRight size={15} aria-hidden /></button>
    </form>
  )
}

export default function Hero() {
  const [index, setIndex] = useState(0)
  const [card, setCard] = useState(0)
  const [mounted, setMounted] = useState(1)
  const [loaded, setLoaded] = useState({ 0: true })
  const [paused, setPaused] = useState(false) // pointing at, or tabbing to, the dots holds the photo
  const next = (index + 1) % SLIDES.length

  // The show waits for the next photo to arrive: it never fades to a half-downloaded picture
  useEffect(() => {
    if (building || paused || prefersReducedMotion() || !loaded[next]) return
    const t = setTimeout(() => setIndex(next), INTERVAL)
    return () => clearTimeout(t)
  }, [index, paused, loaded[next]])

  useEffect(() => {
    if (building) return undefined
    const more = () => setMounted((m) => Math.max(m, 3))
    if (document.readyState === 'complete') return more()
    window.addEventListener('load', more, { once: true })
    return () => window.removeEventListener('load', more)
  }, [])

  useEffect(() => {
    if (building || prefersReducedMotion()) return
    const t = setTimeout(() => setCard((card + 1) % SLIDES.length), CARD_INTERVAL)
    return () => clearTimeout(t)
  }, [card])

  useEffect(() => {
    if (index > 0) setMounted((m) => Math.max(m, index + 3))
  }, [index])

  const show = (i) => { setIndex(i); setCard(i) } // picking a dot brings up that city's photo and question

  return (
    <section className="hero dark" aria-label="Welcome">
      <div className="hero-bg" aria-hidden>
        {SLIDES.slice(0, mounted).map((s, i) => (
          <picture key={s.src}>
            <source media="(max-width: 720px)" type="image/avif" srcSet={copies(s.src, photos[s.src].tall, 't')} sizes="100vw" />
            <source type="image/avif" srcSet={copies(s.src, photos[s.src].widths)} sizes="(max-aspect-ratio: 1/1) 160vw, 100vw" />
            <img src={s.src} alt="" className={i === index ? 'is-active' : ''} fetchpriority={i === 0 ? 'high' : 'low'}
              decoding={i === 0 ? 'sync' : 'async'} onLoad={() => setLoaded((l) => ({ ...l, [i]: true }))} />
          </picture>
        ))}
      </div>

      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="hero-eyebrow">Study abroad community</p>
          <h1>We guide you to the future.</h1>
          <p className="hero-sub">A free space where young people aged 18 to 32 come together on studying abroad: seek advice, share experiences, or talk about what is on your mind.</p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-light">
              Join the community <span className="btn-arrow" aria-hidden><ArrowUpRight size={15} /></span>
            </Link>
            <Link to="/community" className="hero-link">Explore community <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </div>
        <HeroThread countries={COUNTRIES} active={card} />
      </div>

      <div className="container hero-foot">
        <AskBar />
        <div className={`hero-slides${paused ? ' is-paused' : ''}`} role="tablist" aria-label="Background photo"
          style={{ '--slide-ms': `${INTERVAL}ms` }}
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
          {SLIDES.map((s, i) => (
            <button key={s.city} role="tab" aria-selected={i === index} aria-label={s.city} onClick={() => show(i)}
              className={i === index ? 'is-active' : ''}>
              <span className="hero-slide-bar"><span key={index} /></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
