import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarClock, Check, Clock3, FileText, HeartHandshake, KeyRound, Upload, Wallet, X } from 'lucide-react'
import { FormError, Spinner, SubmitButton } from '../../components/auth/fields'
import MentorCard from '../../components/mentors/MentorCard'
import Avatar from '../../components/ui/Avatar'
import { countries } from '../../data/sample'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fullDate } from '../../lib/format'
import { useMeta } from '../../lib/meta'
import { PictureField } from '../Settings'
import '../../components/auth/auth.css'

const BENEFITS = [
  [CalendarClock, 'Your hours, your price', 'Choose the weekly hours that suit you, in your own time zone, and what a session costs.'],
  [Wallet, 'Paid before you meet', 'Students pay upfront through Razorpay when they book, so there is nothing to chase.'],
  [HeartHandshake, 'Help someone like you', 'You remember how confusing your own move was. A single hour can save someone months.'],
]
const LOOK_FOR = [
  'You study at, or recently graduated from, a university abroad',
  'Your age is checked from photo ID (part of every TYM account)',
  'You can show proof of enrolment or your degree',
  'You reply to bookings and messages within a day',
  'You give honest answers, including "check the official page" when you are not sure',
]
const STEPS = [
  ['Apply', 'Your profile, hours, CV and proof of study, all on this page.'],
  ['Review', 'Our team checks your documents and may ask for a short call.'],
  ['Go live', 'Your profile appears in TYM Mentors and students can book you.'],
]
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
const HOURS = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`) // 06:00 to 22:00
const PRESETS = [
  ['Weekday evenings', ['mon', 'tue', 'wed', 'thu', 'fri'], ['18:00', '19:00', '20:00']],
  ['Weekend mornings', ['sat', 'sun'], ['09:00', '10:00', '11:00']],
]
const TOPICS = ['SOP and personal statement review', 'Student visa documents', 'University shortlisting', 'Scholarships and funding',
  'Finding accommodation', 'Part-time work rules', 'Interview practice', 'Settling in']
const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu']
const MAX_FILE = 5 * 1024 * 1024
const DRAFT = 'tym.mentorDraft'
const myZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
const ZONES = (() => { try { return Intl.supportedValuesOf('timeZone') } catch { return [myZone()] } })()
const EMPTY = {
  country: 'uk', university: '', course: '', graduated: false, graduationYear: '', headline: '', about: '', experience: '',
  topics: [], languages: ['English'], linkedin: '', price: 1299, sessionMinutes: 30, timezone: myZone(), weeklyHours: {},
}
const slotCount = (hours) => Object.values(hours).reduce((n, t) => n + t.length, 0)

function TagInput({ id, value, onChange, suggestions, max, placeholder }) {
  const [text, setText] = useState('')
  const add = (t) => {
    const v = t.trim().replace(/,$/, '')
    if (v && !value.includes(v) && value.length < max) onChange([...value, v])
    setText('')
  }
  return (
    <div className="tag-input">
      <div className="tag-box">
        {value.map((t) => (
          <span key={t} className="tag">{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} /></button>
          </span>
        ))}
        {value.length < max && (
          <input id={id} value={text} maxLength={60} placeholder={value.length ? 'Add another' : placeholder}
            onChange={(e) => setText(e.target.value)} onBlur={() => text && add(text)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) }
              if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
            }} />
        )}
      </div>
      <div className="tag-suggest">
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <button key={s} type="button" className="chip" onClick={() => add(s)} disabled={value.length >= max}>+ {s}</button>
        ))}
      </div>
    </div>
  )
}

// Weekly start times, like a timetable. Click, or press and drag across cells, to paint them.
function WeekGrid({ value, update }) {
  const paint = useRef(null)
  useEffect(() => {
    const stop = () => { paint.current = null }
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])
  const has = (d, h) => Boolean(value[d]?.includes(h))
  const set = (d, h, on) => update((prev) => {
    const day = new Set(prev[d] || [])
    if (on) day.add(h); else day.delete(h)
    return { ...prev, [d]: [...day].sort() }
  })
  const preset = (days, hours) => update((prev) => {
    const next = { ...prev }
    days.forEach((d) => { next[d] = [...new Set([...(next[d] || []), ...hours])].sort() })
    return next
  })
  const total = slotCount(value)

  return (
    <div className="week">
      <div className="week-tools">
        {PRESETS.map(([label, days, hours]) => <button key={label} type="button" className="chip" onClick={() => preset(days, hours)}>+ {label}</button>)}
        {total > 0 && <button type="button" className="btn-text" onClick={() => update(() => ({}))}>Clear</button>}
        <span className="week-count"><strong className="mono">{total}</strong> {total === 1 ? 'time' : 'times'} a week</span>
      </div>
      <div className="week-grid" role="group" aria-label="Weekly session start times">
        <span />
        {DAYS.map(([d, label]) => <span key={d} className="week-day">{label}</span>)}
        {HOURS.map((h) => (
          <Fragment key={h}>
            <span className="week-hour mono">{h}</span>
            {DAYS.map(([d, label]) => (
              <button key={d} type="button" className="week-cell" aria-pressed={has(d, h)} aria-label={`${label} ${h}`}
                onPointerDown={(e) => { if (e.pointerType === 'mouse') { paint.current = !has(d, h); set(d, h, paint.current) } }}
                onPointerEnter={(e) => { if (paint.current !== null && e.buttons === 1) set(d, h, paint.current) }}
                onClick={(e) => { if (e.detail === 0 || e.nativeEvent.pointerType !== 'mouse') set(d, h, !has(d, h)) }} />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function FileField({ id, label, hint, accept, file, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <label htmlFor={id} className={`dropzone${file ? ' has-file' : ''}`}>
        {file ? <FileText size={20} aria-hidden /> : <Upload size={20} aria-hidden />}
        <span>
          <strong>{file ? file.name : 'Choose a file'}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · choose again to replace` : hint}</span>
        </span>
      </label>
      <input id={id} type="file" accept={accept} className="visually-hidden" onChange={(e) => { onChange(e.target.files[0] || null); e.target.value = '' }} />
    </div>
  )
}

function Section({ n, title, text, children }) {
  return (
    <section className="card card-pad apply-section" aria-labelledby={`apply-${n}`}>
      <header>
        <span className="mono apply-num">0{n}</span>
        <div><h2 id={`apply-${n}`}>{title}</h2>{text && <p className="muted">{text}</p>}</div>
      </header>
      <div className="stack">{children}</div>
    </section>
  )
}

function StatusCard({ icon: Icon, title, children }) {
  return (
    <div className="card card-pad stack apply-status" role="status">
      <Icon size={26} aria-hidden />
      <h2 className="display">{title}</h2>
      {children}
    </div>
  )
}

export default function MentorApply() {
  useMeta({ title: 'Become a TYM mentor', description: 'Studying abroad or recently graduated? Mentor students heading where you went: set your own hours and price, and get paid upfront through Razorpay.', path: '/mentors/register' })
  const { account, user, setAccount } = useAuth()
  const existing = useApi(user ? '/mentor-application' : null)
  const [form, setForm] = useState(() => {
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT) || '{}') } } catch { return EMPTY }
  })
  const [cv, setCv] = useState(null)
  const [proof, setProof] = useState(null)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)
  const [retry, setRetry] = useState(false)

  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(form)) } catch { /* private mode */ } }, [form])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setValue = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const pickFile = (setter, pdfOnly) => (file) => {
    setError('')
    if (file && file.size > MAX_FILE) return setError(`${file.name} is over 5 MB. Upload a smaller file.`)
    if (file && pdfOnly && file.type !== 'application/pdf') return setError('Upload your CV as a PDF.')
    setter(file)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const problem = !user.avatar ? 'Add a profile photo in step 1.'
      : !form.topics.length ? 'Add at least one topic you can help with.'
        : !form.languages.length ? 'Add the languages you can mentor in.'
          : slotCount(form.weeklyHours) < 2 ? 'Pick at least 2 weekly session times in step 5.'
            : !cv || !proof ? 'Add your CV and proof of study in step 6.'
              : !agree ? 'Please agree to the mentor guidelines.' : ''
    if (problem) return setError(problem)
    const body = new FormData()
    Object.entries(form).forEach(([k, v]) => body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)))
    body.append('agree', 'true')
    body.append('cv', cv)
    body.append('proof', proof)
    setBusy(true)
    try {
      const res = await api('/mentor-application', { method: 'POST', body })
      try { localStorage.removeItem(DRAFT) } catch { /* private mode */ }
      setSent(res)
      setRetry(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const startAgain = (a) => {
    setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, a[k] ?? EMPTY[k]])) })
    setRetry(true)
  }

  const current = sent || existing.data
  const country = countries.find((c) => c.slug === form.country)
  const preview = {
    user: user || account || { displayName: 'You' }, community: { country: { name: country?.name } },
    course: form.course || 'Your course', university: form.university || 'your university',
    headline: form.headline || 'Your one-line headline shows here. Make it specific.',
    priceMinor: (Number(form.price) || 0) * 100, currency: 'INR', sessionMinutes: Number(form.sessionMinutes),
  }

  let panel
  if (!account) {
    panel = (
      <StatusCard icon={KeyRound} title="Sign in to apply">
        <p className="muted">Mentors take paid bookings, so every mentor has a TYM account with an age check from photo ID. It takes about two minutes.</p>
        <div className="apply-status-actions">
          <Link to="/register" state={{ from: '/mentors/register' }} className="btn btn-primary btn-sm">Create an account</Link>
          <Link to="/login" state={{ from: '/mentors/register' }} className="btn btn-ghost btn-sm">Log in</Link>
        </div>
      </StatusCard>
    )
  } else if (!user) {
    panel = (
      <StatusCard icon={KeyRound} title="Finish your age check first">
        <p className="muted">Upload your photo ID to finish signing up, then come back here to apply.</p>
        <Link to="/register" className="btn btn-primary btn-sm apply-status-btn">Finish sign-up</Link>
      </StatusCard>
    )
  } else if (user.role === 'mentor' || current?.status === 'approved') {
    panel = (
      <StatusCard icon={BadgeCheck} title="You are a TYM mentor">
        <p className="muted">Students can find and book you in TYM Mentors. Your upcoming sessions are on your profile.</p>
        <Link to={`/u/${user.username}?tab=Sessions`} className="btn btn-primary btn-sm apply-status-btn">Your sessions</Link>
      </StatusCard>
    )
  } else if (existing.loading) {
    panel = <p className="muted post-loading"><Spinner /> Checking your application</p>
  } else if (current?.status === 'pending') {
    panel = (
      <StatusCard icon={Clock3} title="Application received">
        <p className="muted">Sent on {fullDate(current.createdAt)}. Our team will check your documents and email {user.email} within a week, sometimes to set up a short call.</p>
        <MentorCard preview m={{ ...preview, course: current.course, university: current.university, headline: current.headline, priceMinor: current.price * 100, sessionMinutes: current.sessionMinutes, community: { country: { name: countries.find((c) => c.slug === current.country)?.name } } }} />
        <p className="muted dash-small">This is how students will see you once you are approved.</p>
      </StatusCard>
    )
  } else if (current?.status === 'rejected' && !retry) {
    panel = (
      <StatusCard icon={FileText} title="Your application needs changes">
        {current.note ? <blockquote className="apply-note">{current.note}</blockquote> : <p className="muted">Our team could not approve it this time.</p>}
        <p className="muted">You can update your details and send it again.</p>
        <button className="btn btn-primary btn-sm apply-status-btn" onClick={() => startAgain(current)}>Update and apply again</button>
      </StatusCard>
    )
  } else {
    const year = new Date().getFullYear()
    panel = (
      <form className="stack apply-sections" onSubmit={submit}>
        <Section n={1} title="Your photo" text="Students book people they can see. Use a clear, recent photo of your face.">
          <div className="apply-photo">
            <Avatar user={user} size={88} />
            <PictureField kind="avatar" current={user.avatar} onChange={(res) => setAccount(res.me)} />
          </div>
        </Section>

        <Section n={2} title="Where you studied">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="a-country">Country</label>
              <select id="a-country" className="select" value={form.country} onChange={set('country')}>
                {countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="a-uni">University</label>
              <input id="a-uni" className="input" value={form.university} onChange={set('university')} required minLength={2} maxLength={120} placeholder="University of Leeds" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="a-course">Course</label>
            <input id="a-course" className="input" value={form.course} onChange={set('course')} required minLength={2} maxLength={120} placeholder="MSc Data Science" />
          </div>
          <div className="grid-2">
            <fieldset className="segmented apply-two" aria-label="Where you are in your course">
              {[[false, 'Studying now'], [true, 'Graduated']].map(([v, label]) => (
                <label key={label}>
                  <input type="radio" name="graduated" checked={form.graduated === v} onChange={() => setValue('graduated')(v)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor="a-year">{form.graduated ? 'Graduation year' : 'Expected graduation year'}</label>
              <input id="a-year" className="input" type="number" inputMode="numeric" min={2000} max={2035} value={form.graduationYear}
                onChange={set('graduationYear')} required placeholder={String(form.graduated ? year - 1 : year + 1)} />
            </div>
          </div>
        </Section>

        <Section n={3} title="Your mentor profile" text="Write it the way you would introduce yourself to a junior. Specific beats impressive.">
          <div className="field">
            <div className="field-row"><label htmlFor="a-headline">Headline</label><span className="hint">{160 - form.headline.length} left</span></div>
            <input id="a-headline" className="input" value={form.headline} onChange={set('headline')} required minLength={20} maxLength={160}
              placeholder="I review SOPs line by line and check UK visa files before you submit." />
          </div>
          <div className="field">
            <div className="field-row">
              <label htmlFor="a-about">About you</label>
              <span className="hint">{form.about.length < 150 ? `${150 - form.about.length} more characters` : `${2000 - form.about.length} left`}</span>
            </div>
            <textarea id="a-about" className="textarea" rows={6} value={form.about} onChange={set('about')} required minLength={150} maxLength={2000}
              placeholder="Where you are from, why you went, what surprised you, and what you can help with." />
          </div>
          <div className="field">
            <label htmlFor="a-exp">Work or volunteering <span className="faint">Optional</span></label>
            <input id="a-exp" className="input" value={form.experience} onChange={set('experience')} maxLength={255}
              placeholder="Data analyst intern at a Leeds fintech. Student ambassador." />
          </div>
          <div className="field">
            <div className="field-row"><label htmlFor="a-topics">What you help with</label><span className="hint">{form.topics.length}/8</span></div>
            <TagInput id="a-topics" value={form.topics} onChange={setValue('topics')} suggestions={TOPICS} max={8} placeholder="Type a topic and press Enter" />
          </div>
          <div className="field">
            <div className="field-row"><label htmlFor="a-langs">Languages you can mentor in</label><span className="hint">{form.languages.length}/6</span></div>
            <TagInput id="a-langs" value={form.languages} onChange={setValue('languages')} suggestions={LANGUAGES} max={6} placeholder="Type a language" />
          </div>
          <div className="field">
            <label htmlFor="a-link">LinkedIn <span className="faint">Optional, but it helps</span></label>
            <input id="a-link" className="input" type="url" value={form.linkedin} onChange={set('linkedin')} placeholder="https://www.linkedin.com/in/..." />
          </div>
        </Section>

        <Section n={4} title="Sessions and price" text="Sessions are one-to-one video calls. Most TYM mentors charge ₹1,199 to ₹1,999.">
          <div className="grid-2">
            <fieldset className="segmented" aria-label="Session length">
              {[30, 45, 60].map((m) => (
                <label key={m}>
                  <input type="radio" name="minutes" checked={Number(form.sessionMinutes) === m} onChange={() => setValue('sessionMinutes')(m)} />
                  <span>{m} min</span>
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor="a-price">Price per session</label>
              <div className="price-input">
                <span aria-hidden>₹</span>
                <input id="a-price" className="input" type="number" inputMode="numeric" min={299} max={9999} step={50}
                  value={form.price} onChange={set('price')} required />
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="a-tz">Your time zone</label>
            <select id="a-tz" className="select" value={form.timezone} onChange={set('timezone')}>
              {(ZONES.includes(form.timezone) ? ZONES : [form.timezone, ...ZONES]).map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </Section>

        <Section n={5} title="Weekly hours" text={`Pick when sessions can start, in ${form.timezone.replace(/_/g, ' ')} time. Students see them in their own time zone. They are set when the team approves your application; to change them afterwards, write to support@theyouthmatters.com.`}>
          <WeekGrid value={form.weeklyHours} update={(fn) => setForm((f) => ({ ...f, weeklyHours: fn(f.weeklyHours) }))} />
        </Section>

        <Section n={6} title="Documents" text="Only the TYM review team can open these. They are never shown on your profile.">
          <div className="grid-2">
            <FileField id="a-cv" label="CV" hint="PDF, up to 5 MB" accept="application/pdf" file={cv} onChange={pickFile(setCv, true)} />
            <FileField id="a-proof" label="Proof of enrolment or degree" hint="Student ID, enrolment letter or degree. PDF, JPG or PNG, up to 5 MB"
              accept="application/pdf,image/jpeg,image/png" file={proof} onChange={pickFile(setProof, false)} />
          </div>
        </Section>

        <div className="card card-pad stack apply-submit">
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I will give honest advice, reply to bookings within a day, and point students to official sources for visa rules and fees.</span>
          </label>
          <FormError>{error}</FormError>
          <SubmitButton busy={busy} busyText="Sending your application">Send application</SubmitButton>
          <p className="faint dash-small">Your answers are saved on this device as you type, so you can finish later. Files need adding again.</p>
        </div>
      </form>
    )
  }

  const formShown = user && user.role !== 'mentor' && !existing.loading && (!current || retry)

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

      <div className="layout-2 apply-layout">
        <div>{panel}</div>
        <aside className="stack sticky apply-rail">
          {formShown && (
            <div className="apply-preview">
              <p className="col-title">How students will see you</p>
              <MentorCard preview m={preview} />
            </div>
          )}
          <div className="card card-pad">
            <h2 className="section-title">What we look for</h2>
            <ul className="apply-list">{LOOK_FOR.map((t) => <li key={t}><Check size={16} aria-hidden /> {t}</li>)}</ul>
          </div>
          <div className="card card-pad">
            <h2 className="section-title">How it works</h2>
            <ol className="apply-steps">
              {STEPS.map(([title, text], i) => <li key={title}><span className="mono">0{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
