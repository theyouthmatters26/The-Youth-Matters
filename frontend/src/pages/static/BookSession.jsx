import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Clock3, MessageSquare, Send, Wallet } from 'lucide-react'
import { FormError, Spinner, SubmitButton } from '../../components/auth/fields'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatMoney } from '../../lib/format'
import { useMeta } from '../../lib/meta'
import { hoursText, viewerZone } from '../../components/mentors/booking'
import '../../components/auth/auth.css'

// The form the client asked for, while sessions are arranged by hand. There is no checkout here on
// purpose: sending it emails the team, acknowledges the student, and lands in the admin inbox as a
// Mentorship session message (api/contact.py). The team then takes payment and books the session.
const EDUCATION = ['High School', "Bachelor's", "Master's", 'Working Professional', 'Other']
const DESTINATIONS = ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'Other Europe', 'Undecided']
const DEGREES = ["Bachelor's", "Master's", 'PhD', 'Diploma / Foundation', 'Other']
const INTAKES = ['Spring 2027', 'Fall 2027', 'Spring 2028', 'Fall 2028', 'Undecided']
const HELP = ['University Selection', 'Applications', 'Scholarships', 'SOP / Personal Statement']
const SUPPORT = ['IELTS / TOEFL', 'Visa Guidance', 'Course / Career Advice', 'Overall Planning', 'Other']
const FORMATS = ['Zoom / Google Meet', 'Phone Call', 'Other']
const DURATIONS = ['60 minutes', '2 hours', '3 hours']
const APPLIED = ['Yes', 'No', 'Planning to apply soon']
const HEARD = ['Social Media', 'Friend / Referral', 'Website', 'Event', 'Other']

const EMPTY = {
  packageId: null,
  fullName: '', email: '', whatsapp: '', residence: '', education: '',
  destination: '', degree: '', intake: '', subject: '',
  help: [], support: [], date: '', time: '', timezone: viewerZone, format: '', duration: '60 minutes',
  questions: '', applied: '', heard: '', anythingElse: '', signature: '', agreed: false,
}

// Sections number themselves in CSS, so moving one or adding one cannot put them out of step.
function Section({ title, children }) {
  const id = title.toLowerCase().replace(/\W+/g, '-')
  return (
    <section className="apply-section card card-pad stack" aria-labelledby={id}>
      <header>
        <span className="mono apply-num auto" aria-hidden />
        <div><h2 id={id}>{title}</h2></div>
      </header>
      {children}
    </section>
  )
}

function Field({ id, label, need, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{need && ' *'}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

// Several answers to one question, as tick boxes
function Picks({ label, options, value, onChange }) {
  return (
    <fieldset className="field apply-many">
      <legend>{label}</legend>
      <div className="grid-2">
        {options.map((o) => (
          <label key={o} className="check">
            <input type="checkbox" checked={value.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function BookSession() {
  useMeta({
    title: 'Book a mentorship session',
    description: 'Tell us what you need help with and we will match you with the right TYM mentor and arrange your session.',
    path: '/book-a-session',
  })
  const { account } = useAuth()
  const { data: plans } = useApi('/packages')
  const [params] = useSearchParams()
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    fullName: account?.displayName || '',
    email: account?.email || '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  // Whichever card they came in on is already chosen for them
  const picked = form.packageId ?? (Number(params.get('plan')) || null)
  const plan = (plans || []).find((p) => p.id === picked) || null

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError('') }
  const put = (k) => (v) => { setForm({ ...form, [k]: v }); setError('') }

  const send = async (e) => {
    e.preventDefault()
    const need = [['fullName', 'your full name'], ['email', 'your email address'],
      ['whatsapp', 'your WhatsApp number'], ['residence', 'where you live now'],
      ['education', 'your current education level'], ['destination', 'where you want to study']]
    const missing = need.find(([k]) => !String(form[k]).trim())
    const problem = !plan ? 'Choose how many counselling hours you need.'
      : missing ? `Please add ${missing[1]}.`
      : !form.agreed ? 'Please confirm your details are accurate before sending.'
        : !form.signature.trim() ? 'Type your name as your signature.' : ''
    if (problem) return setError(problem)

    setBusy(true)
    try {
      await api('/contact', {
        method: 'POST',
        body: {
          name: form.fullName.trim(),
          email: form.email.trim(),
          topic: 'Mentorship session',
          message: form.questions.trim() || 'A mentorship session request. The answers are below.',
          details: {
            Plan: `${plan.title} — ${formatMoney(plan.priceMinor, plan.currency)}`,
            WhatsApp: form.whatsapp,
            'Lives in': form.residence,
            'Education level': form.education,
            Destination: form.destination,
            'Degree or programme': form.degree,
            Intake: form.intake,
            'Subject or course': form.subject,
            'Wants help with': form.help.join(', '),
            'Other support': form.support.join(', '),
            'Preferred date': form.date,
            'Preferred time': `${form.time} (${form.timezone})`,
            Format: form.format,
            Duration: form.duration,
            'Applied anywhere yet': form.applied,
            'Heard about us from': form.heard,
            'Anything else': form.anythingElse,
            Signed: form.signature,
          },
        },
      })
      setSent(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="container page narrow">
        <div className="card card-pad stack book-sent">
          <span className="book-done-mark"><Check size={22} /></span>
          <h1>Thank you, {form.fullName.split(' ')[0]}</h1>
          <p className="muted">We have your request and have emailed <strong>{form.email}</strong> to confirm
            it arrived. Our team will come back to you with a mentor, a time and how to pay.</p>
          <div className="apply-status-actions">
            <Link to="/mentors" className="btn btn-primary btn-sm">Browse mentors</Link>
            <Link to="/" className="btn btn-ghost btn-sm">Back to home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Study abroad mentors</p>
        <h1>Mentorship session booking form</h1>
        <p>Tell us what you need and we will match you with the right mentor. Our team confirms your
          session and arranges payment with you directly.</p>
      </header>

      <ul className="trust-row">
        <li><Wallet size={16} aria-hidden /> {plans?.length
          ? plans.map((p) => `${hoursText(p.hours * 60)} ${formatMoney(p.priceMinor, p.currency)}`).join(' · ')
          : 'One price for every mentor'}</li>
        <li><Clock3 size={16} aria-hidden /> We reply within a day</li>
        <li><MessageSquare size={16} aria-hidden /> Confirmed by email and WhatsApp</li>
      </ul>

      <div className="layout-2 apply-layout">
        <form className="stack apply-sections" onSubmit={send}>
          <Section title="Choose your plan">
            <p className="hint">One price for every mentor. Hours work with any TYM mentor and do not expire.</p>
            {plans ? (
              <div className="plan-grid" role="radiogroup" aria-label="Counselling hours">
                {plans.map((p) => (
                  <label key={p.id} className={`plan${picked === p.id ? ' is-on' : ''}`}>
                    <input type="radio" name="plan" className="plan-radio" checked={picked === p.id}
                      onChange={() => put('packageId')(p.id)} />
                    <span className="plan-hours">{hoursText(p.hours * 60)}</span>
                    <span className="plan-price">{formatMoney(p.priceMinor, p.currency)}</span>
                    <span className="plan-note">{p.hours > 1
                      ? `${formatMoney(p.priceMinor / p.hours, p.currency)} an hour`
                      : 'One session with any mentor'}</span>
                  </label>
                ))}
              </div>
            ) : <p className="muted"><Spinner /> Loading the price list</p>}
            <p className="hint">Nothing is charged here. Once we have confirmed your mentor and your time,
              our team arranges payment with you directly.</p>
          </Section>

          <Section title="Personal information">
            <div className="grid-2">
              <Field id="b-name" label="Full name" need>
                <input id="b-name" className="input" value={form.fullName} onChange={set('fullName')} maxLength={80} required />
              </Field>
              <Field id="b-email" label="Email address" need>
                <input id="b-email" type="email" className="input" value={form.email} onChange={set('email')} maxLength={255} required />
              </Field>
            </div>
            <div className="grid-2">
              <Field id="b-wa" label="WhatsApp number" need hint="Include your country code, for example +91">
                <input id="b-wa" className="input" value={form.whatsapp} onChange={set('whatsapp')} maxLength={30} required />
              </Field>
              <Field id="b-res" label="Current country of residence" need>
                <input id="b-res" className="input" value={form.residence} onChange={set('residence')} maxLength={80} required />
              </Field>
            </div>
            <Field id="b-edu" label="Current education level" need>
              <select id="b-edu" className="select" value={form.education} onChange={set('education')} required>
                <option value="">Choose</option>
                {EDUCATION.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </Section>

          <Section title="Study abroad preferences">
            <div className="grid-2">
              <Field id="b-dest" label="Preferred study destination" need>
                <select id="b-dest" className="select" value={form.destination} onChange={set('destination')} required>
                  <option value="">Choose</option>
                  {DESTINATIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field id="b-deg" label="Degree or programme">
                <select id="b-deg" className="select" value={form.degree} onChange={set('degree')}>
                  <option value="">Choose</option>
                  {DEGREES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid-2">
              <Field id="b-intake" label="Intended intake">
                <select id="b-intake" className="select" value={form.intake} onChange={set('intake')}>
                  <option value="">Choose</option>
                  {INTAKES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field id="b-subject" label="Preferred subject or course">
                <input id="b-subject" className="input" value={form.subject} onChange={set('subject')} maxLength={120}
                  placeholder="MSc Data Science" />
              </Field>
            </div>
          </Section>

          <Section title="Your session">
            <Picks label="What would you like help with?" options={HELP} value={form.help} onChange={put('help')} />
            <Picks label="Other support" options={SUPPORT} value={form.support} onChange={put('support')} />
            <div className="grid-2">
              <Field id="b-date" label="Preferred session date">
                <input id="b-date" type="date" className="input" value={form.date} onChange={set('date')} />
              </Field>
              <Field id="b-time" label="Preferred time">
                <input id="b-time" type="time" className="input" value={form.time} onChange={set('time')} />
              </Field>
            </div>
            <Field id="b-zone" label="Your time zone" hint="Taken from your device; change it if that is not where you will be.">
              <input id="b-zone" className="input" value={form.timezone} onChange={set('timezone')} maxLength={60} />
            </Field>
            <div className="grid-2">
              <Field id="b-format" label="Preferred format">
                <select id="b-format" className="select" value={form.format} onChange={set('format')}>
                  <option value="">Choose</option>
                  {FORMATS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field id="b-dur" label="Session duration">
                <select id="b-dur" className="select" value={form.duration} onChange={set('duration')}>
                  {DURATIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Anything else">
            <Field id="b-q" label="Main questions or challenges you would like to discuss">
              <textarea id="b-q" className="textarea" rows={4} value={form.questions} onChange={set('questions')} maxLength={2000} />
            </Field>
            <div className="grid-2">
              <Field id="b-applied" label="Have you applied to any universities?">
                <select id="b-applied" className="select" value={form.applied} onChange={set('applied')}>
                  <option value="">Choose</option>
                  {APPLIED.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field id="b-heard" label="How did you hear about us?">
                <select id="b-heard" className="select" value={form.heard} onChange={set('heard')}>
                  <option value="">Choose</option>
                  {HEARD.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <Field id="b-else" label="Anything else your mentor should know?">
              <textarea id="b-else" className="textarea" rows={3} value={form.anythingElse} onChange={set('anythingElse')} maxLength={1000} />
            </Field>
          </Section>

          <Section title="Confirmation">
            <label className="check">
              <input type="checkbox" checked={form.agreed}
                onChange={(e) => { setForm({ ...form, agreed: e.target.checked }); setError('') }} />
              <span>I confirm the information above is accurate and agree to be contacted about my
                mentorship session.</span>
            </label>
            <Field id="b-sign" label="Your name, as your signature" need>
              <input id="b-sign" className="input" value={form.signature} onChange={set('signature')} maxLength={80} />
            </Field>
            <FormError>{error}</FormError>
            <div className="book-send">
              <SubmitButton busy={busy} busyText="Sending" style={{ width: 'auto' }}>
                Send my request <Send size={16} aria-hidden />
              </SubmitButton>
            </div>
          </Section>
        </form>

        <aside className="stack sticky apply-rail">
          <div className="card card-pad">
            <h2 className="section-title">What a session costs</h2>
            <ul className="price-list">
              {(plans || []).map((p) => (
                <li key={p.id}><span>{hoursText(p.hours * 60)}</span>
                  <strong>{formatMoney(p.priceMinor, p.currency)}</strong></li>
              ))}
            </ul>
            <p className="muted dash-small">Hours work with every TYM mentor and do not expire.</p>
          </div>
          <div className="card card-pad">
            <h2 className="section-title">What happens next</h2>
            <ol className="apply-steps">
              <li><span className="mono">01</span><div><strong>You pick a plan and send this form</strong><p>We email you straight away to say it arrived.</p></div></li>
              <li><span className="mono">02</span><div><strong>We match you</strong><p>We pick the mentor who fits your plans and confirm a time.</p></div></li>
              <li><span className="mono">03</span><div><strong>You pay and meet</strong><p>Our team arranges payment, then you meet on a call.</p></div></li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
