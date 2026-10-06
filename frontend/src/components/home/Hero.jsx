import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import HeroThread from './HeroThread'
import './home.css'

// Background slides: the cities our members are heading to. Only current + next are mounted,
// so the first paint downloads one photo instead of six.
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
const INTERVAL = 6500

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function AskBar() {
  const navigate = useNavigate()
  const submit = (e) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q').trim()
    navigate(q ? `/ai?q=${encodeURIComponent(q)}` : '/ai')
  }
  return (
    <form className="askbar" onSubmit={submit} role="search" aria-label="Ask TYM AI">
      <label htmlFor="askbar-q" className="askbar-label">Ask TYM AI</label>
      <input id="askbar-q" name="q" placeholder="How much money do I need for a UK student visa?" autoComplete="off" />
      <button className="btn btn-light btn-sm">Ask <ArrowUpRight size={15} aria-hidden /></button>
    </form>
  )
}

export default function Hero() {
  const [index, setIndex] = useState(0)
  const [mounted, setMounted] = useState(2)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setTimeout(() => setIndex((index + 1) % SLIDES.length), INTERVAL)
    return () => clearTimeout(t)
  }, [index])

  useEffect(() => {
    setMounted((m) => Math.max(m, index + 2))
  }, [index])

  return (
    <section className="hero dark" aria-label="Welcome">
      <div className="hero-bg" aria-hidden>
        {SLIDES.slice(0, mounted).map((s, i) => (
          <img key={s.src} src={s.src} alt="" className={i === index ? 'is-active' : ''}
            fetchpriority={i === 0 ? 'high' : 'low'} decoding="async" />
        ))}
      </div>

      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="hero-eyebrow">Study abroad community</p>
          <h1>Every question before you go, answered by someone who went.</h1>
          <p className="hero-sub">Honest answers on visas, money and housing from students who made the move last year.</p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-light">
              Join the community <span className="btn-arrow" aria-hidden><ArrowUpRight size={15} /></span>
            </Link>
            <Link to="/community" className="hero-link">Explore community <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </div>
        <HeroThread countries={COUNTRIES} active={index} />
      </div>

      <div className="container hero-foot">
        <AskBar />
        <div className="hero-slides" role="tablist" aria-label="Background destination">
          {SLIDES.map((s, i) => (
            <button key={s.city} role="tab" aria-selected={i === index} onClick={() => setIndex(i)}
              className={i === index ? 'is-active' : ''}>
              <span className="hero-slide-bar"><span key={index} /></span>
              {s.city}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
