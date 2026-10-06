import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Mail } from 'lucide-react'
import { FormError, SubmitButton } from '../../components/auth/fields'
import { api } from '../../lib/api'
import { useMeta } from '../../lib/meta'

const TOPICS = ['My account', 'Payments', 'Safety', 'Partnerships', 'Something else']
const ROUTES = [
  ['/mentors/register', 'Become a mentor', 'Apply to mentor students heading where you went.'],
  ['/help-safety', 'Report a safety issue', 'Something wrong in a chat or a post? Start here.'],
  ['/payment-terms', 'Payments and refunds', 'How session payments, cancellations and refunds work.'],
  ['/faq', 'Common questions', 'Quick answers to what most people ask us.'],
]

export default function Contact() {
  useMeta({ title: 'Contact us', description: 'Questions about your account, payments, safety or partnerships? Write to The Youth Matters team. We reply within two working days.', path: '/contact' })
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/contact', { method: 'POST', body: Object.fromEntries(new FormData(e.currentTarget)) })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page">
      <div className="split">
        <div className="stack">
          <h1 style={{ fontSize: 'var(--step-4)' }}>Talk to the team</h1>
          <p className="muted">Questions about your account, payments, safety or partnerships. A person reads every message, and we reply within two working days.</p>
          <a href="mailto:hello@theyouthmatters.org" className="contact-line"><Mail size={16} /> hello@theyouthmatters.org</a>
          <ul className="contact-routes">
            {ROUTES.map(([to, title, text]) => (
              <li key={to}><Link to={to}><strong>{title}</strong><span>{text}</span><ArrowUpRight size={16} aria-hidden /></Link></li>
            ))}
          </ul>
        </div>
        {sent ? (
          <div className="card card-pad stack" role="status">
            <h2 className="display" style={{ fontSize: 'var(--step-3)' }}>Message sent</h2>
            <p className="muted">Thank you. We will reply to the email you gave us within two working days.</p>
            <Link to="/" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }}>Back to home</Link>
          </div>
        ) : (
          <form className="card card-pad stack" onSubmit={submit}>
            <div className="grid-2">
              <div className="field"><label htmlFor="c-name">Name</label><input id="c-name" name="name" className="input" autoComplete="name" required minLength={2} maxLength={80} /></div>
              <div className="field"><label htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" className="input" autoComplete="email" required /></div>
            </div>
            <div className="field">
              <label htmlFor="c-topic">Topic</label>
              <select id="c-topic" name="topic" className="select">{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="field">
              <label htmlFor="c-msg">Message</label>
              <textarea id="c-msg" name="message" className="textarea" required minLength={10} maxLength={4000} />
            </div>
            <FormError>{error}</FormError>
            <SubmitButton busy={busy} busyText="Sending" style={{ justifySelf: 'start', width: 'auto' }}>Send message</SubmitButton>
          </form>
        )}
      </div>
    </div>
  )
}
