import { Check } from 'lucide-react'
import './auth.css'

// Two tiles side by side: the form on white, a photograph on black with something human on it.
// The photo tile steps aside on small screens so the form gets the whole width.
export default function AuthLayout({ kicker, title, subtitle, aside = <MemberQuote />, children }) {
  return (
    <div className="container auth">
      <section className="auth-main">
        <div className="auth-inner">
          <header className="auth-head">
            {kicker && <p className="auth-kicker">{kicker}</p>}
            <h1>{title}</h1>
            {subtitle && <p className="auth-sub">{subtitle}</p>}
          </header>
          {children}
        </div>
      </section>
      <aside className="auth-aside dark">
        <img src="/images/hero-students.jpg" alt="" />
        <div className="auth-aside-body">{aside}</div>
      </aside>
    </div>
  )
}

export function MemberQuote() {
  return (
    <figure className="auth-quote">
      <blockquote>
        “I asked about my CAS at midnight. By breakfast, three people who had been through it had answered.”
      </blockquote>
      <figcaption>
        <strong>Aisha Khan</strong>
        <span>MSc Marketing, University of Leeds</span>
      </figcaption>
      <dl className="auth-facts">
        <div><dt>12,480</dt><dd>members heading to the UK</dd></div>
        <div><dt>6</dt><dd>countries with mentors</dd></div>
      </dl>
    </figure>
  )
}

const PROMISES = [
  ['Everyone here is 18 or over', 'We read your date of birth from your ID, so nobody can simply type one in.'],
  ['A quick selfie proves it is you', 'It is matched to your ID photo by our own system. Nothing is shared with anyone.'],
  ['Your ID is deleted once you are verified', 'We keep the date of birth, not the document.'],
]

export function WhyWeCheck() {
  return (
    <div className="auth-why">
      <p className="auth-why-title">Why every member is verified</p>
      <ol>
        {PROMISES.map(([title, text]) => (
          <li key={title}>
            <span aria-hidden><Check size={14} /></span>
            <div><strong>{title}</strong><p>{text}</p></div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function Steps({ steps, current }) {
  return (
    <ol className="steps" aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-current' : undefined}
          aria-current={i === current ? 'step' : undefined}>
          <span className="steps-bar" aria-hidden />
          {s}
        </li>
      ))}
    </ol>
  )
}
