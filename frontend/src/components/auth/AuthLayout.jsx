import { Check } from 'lucide-react'
import Photo from '../ui/Photo'
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
        <Photo src="/images/hero-students.jpg" sizes="(max-width: 900px) 1px, 50vw" />
        <div className="auth-aside-body">{aside}</div>
      </aside>
    </div>
  )
}

export function MemberQuote() {
  return (
    <figure className="auth-quote">
      <blockquote>
        Ask about your CAS at midnight. Wake up to answers from students who have already been through it.
      </blockquote>
      <dl className="auth-facts">
        <div><dt>18+</dt><dd>every member is age-checked</dd></div>
        <div><dt>6</dt><dd>countries, each with its own community</dd></div>
      </dl>
    </figure>
  )
}

const PROMISES = [
  ['Everyone here is 18 or over', 'We read your date of birth from your ID, so nobody can simply type one in.'],
  ['Done in a few seconds', 'Take a photo of your passport, driving licence or national ID, or upload one.'],
  ['Your ID is never stored', 'We read the date of birth and discard the photo. Nothing is shared with anyone.'],
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
