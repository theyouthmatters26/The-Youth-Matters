import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Check, HeartHandshake, Wallet } from 'lucide-react'
import { FormError, SubmitButton } from '../../components/auth/fields'
import { countries } from '../../data/sample'
import { api } from '../../lib/api'
import { useMeta } from '../../lib/meta'

const BENEFITS = [
  [CalendarClock, 'Your hours, your price', 'Choose the weekly hours that suit you, in your own time zone, and what a session costs.'],
  [Wallet, 'Paid before you meet', 'Students pay upfront through Razorpay when they book, so there is nothing to chase.'],
  [HeartHandshake, 'Help someone like you', 'You remember how confusing your own move was. A single hour can save someone months.'],
]
const LOOK_FOR = [
  'You study at, or recently graduated from, a university abroad',
  'You are 18 or older and can verify your identity with a photo ID',
  'You can show proof of enrolment or your degree',
  'You reply to bookings and messages within a day',
  'You give honest answers, including "check the official page" when you are not sure',
]
const STEPS = [
  ['Apply', 'Tell us about your course and your own move abroad.'],
  ['Short call', 'A quick video call with someone from our team.'],
  ['Verification', 'We check your ID and your proof of enrolment or degree.'],
  ['Go live', 'Set your weekly hours and price. Students can book you straight away.'],
]

export default function MentorApply() {
  useMeta({ title: 'Become a TYM mentor', description: 'Studying abroad or recently graduated? Mentor students heading where you went: set your own hours and price, and get paid upfront through Razorpay.', path: '/mentors/register' })
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      await api('/contact', {
        method: 'POST',
        body: {
          name: f.name, email: f.email, topic: 'Mentor application', message: f.message,
          details: { University: f.university, Course: f.course, Country: f.country, 'Graduation year': f.year, LinkedIn: f.linkedin },
        },
      })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">TYM Mentors · Apply</p>
        <h1>Help the next student get there</h1>
        <p>Mentors are current students and recent graduates of universities abroad. You share what you learned the hard way, on a one-to-one video call.</p>
      </header>

      <ul className="apply-benefits">
        {BENEFITS.map(([Icon, title, text]) => (
          <li key={title}><Icon size={22} aria-hidden /><strong>{title}</strong><p>{text}</p></li>
        ))}
      </ul>

      <div className="apply-grid">
        <div className="apply-info">
          <section>
            <h2 className="display">What we look for</h2>
            <ul className="apply-list">{LOOK_FOR.map((t) => <li key={t}><Check size={16} aria-hidden /> {t}</li>)}</ul>
          </section>
          <section>
            <h2 className="display">How it works</h2>
            <ol className="apply-steps">
              {STEPS.map(([title, text], i) => <li key={title}><span className="mono">0{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}
            </ol>
          </section>
        </div>

        {sent ? (
          <div className="card card-pad stack apply-form" role="status">
            <h2 className="display" style={{ fontSize: 'var(--step-3)' }}>Application sent</h2>
            <p className="muted">Thank you. Someone from our team will email you within a week about a short call.</p>
            <Link to="/mentors" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }}>Meet our mentors</Link>
          </div>
        ) : (
          <form className="card card-pad stack apply-form" onSubmit={submit}>
            <h2 className="display" style={{ fontSize: 'var(--step-2)' }}>Apply to mentor</h2>
            <div className="grid-2">
              <div className="field"><label htmlFor="a-name">Full name</label><input id="a-name" name="name" className="input" autoComplete="name" required minLength={2} /></div>
              <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" name="email" type="email" className="input" autoComplete="email" required /></div>
            </div>
            <div className="field"><label htmlFor="a-uni">University</label><input id="a-uni" name="university" className="input" required placeholder="University of Leeds" /></div>
            <div className="field"><label htmlFor="a-course">Course</label><input id="a-course" name="course" className="input" required placeholder="MSc Data Science" /></div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="a-country">Country</label>
                <select id="a-country" name="country" className="select">{countries.map((c) => <option key={c.slug}>{c.name}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="a-year">Graduation year</label><input id="a-year" name="year" type="number" min="2015" max="2032" className="input" required /></div>
            </div>
            <div className="field"><label htmlFor="a-link">LinkedIn <span className="faint">Optional</span></label><input id="a-link" name="linkedin" type="url" className="input" placeholder="https://www.linkedin.com/in/..." /></div>
            <div className="field">
              <label htmlFor="a-msg">What would you help students with?</label>
              <textarea id="a-msg" name="message" className="textarea" required minLength={10} maxLength={2000}
                placeholder="For example: SOP reviews, CAS and visa files, finding housing in Leeds." />
            </div>
            <FormError>{error}</FormError>
            <SubmitButton busy={busy} busyText="Sending">Send application</SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
