import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarClock, Check, Clock3, FileText, HeartHandshake, KeyRound, Upload, Wallet, X } from 'lucide-react'
import { FormError, Spinner, SubmitButton } from '../../components/auth/fields'
import MentorCard from '../../components/mentors/MentorCard'
import Avatar from '../../components/ui/Avatar'
import { countries } from '../../data/sample'
import { AGREEMENTS, ALL_FIELDS, AVAILABILITY, CATCH_ALL, CODE_OF_CONDUCT, DECLARATION, EDUCATION, EXPERTISE, KEY_AREAS, MENTORING, MOTIVATION, PERSONAL, PROFESSIONAL, follows, plain, required } from '../../data/mentorForm'
import { LANGUAGES, TOPIC_MAX, TagInput, WeekGrid, ZONES, myZone, slotCount } from '../../components/mentors/scheduler'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fullDate } from '../../lib/format'
import { useMeta } from '../../lib/meta'
import { PictureField } from '../Settings'
import '../../components/auth/auth.css'

const BENEFITS = [
  [CalendarClock, 'Your hours, your way', 'Choose the weekly hours that suit you, in your own time zone, and how long a session lasts.'],
  [Wallet, 'Paid before you meet', 'Students buy counselling hours from TYM and spend them when they book, so there is nothing to chase.'],
  [HeartHandshake, 'Help someone like you', 'You remember how confusing your own move was. A single hour can save someone months.'],
]
const LOOK_FOR = [
  'You are an experienced professional, educator, international graduate or study-abroad expert',
  'You can show your CV and proof of your qualification',
  'You reply to bookings and messages within a day',
  'You give honest answers, including "check the official page" when you are not sure',
]
const STEPS = [
  ['Sign up', 'Create your mentor account with Google or an email address. No photo ID is needed.'],
  ['Apply', 'Complete the form on this page. Please make sure everything is accurate and up to date.'],
  ['Review', 'Our team checks your documents and may ask for a short call.'],
  ['Go live', 'Your profile appears in TYM Mentors and students can book you.'],
]
const MAX_FILE = 5 * 1024 * 1024
const DRAFT = 'tym.mentorDraft'
const EMPTY = {
  country: 'uk', university: '', course: '', graduated: false, graduationYear: '', headline: '', about: '', experience: '',
  topics: [], languages: ['English'], linkedin: '', sessionMinutes: 30, timezone: myZone(), weeklyHours: {},
  details: {},
}
// Between the columns of one "rows" answer. Written and read in Questions() and nowhere else.
const ROW_SEP = ' \u00b7 '
// The education questions are shown in three places in section 3, not one list
const onlyEducation = (keys) => EDUCATION.filter(([k]) => keys.includes(k))

// The form's own questions (data/mentorForm.js), each drawn the way its kind asks for.
function Questions({ fields, details, set }) {
  return fields.map((f) => {
    const [key, label, kind, options] = f
    // "If yes" questions only belong on the page after that Yes
    const after = follows(f)
    if (after && details[after] !== 'Yes') return null
    const id = `q-${key}`
    const value = details[key] ?? (kind === 'many' || kind === 'rows' ? [] : '')
    const need = required(f)

    if (kind === 'many') {
      // "Open to all formats" and "Flexible" already cover the rest, so they stand alone: ticking
      // one clears the others, and while it is ticked the others are out of reach.
      const whole = options.find((o) => CATCH_ALL.includes(o))
      const covered = whole && value.includes(whole)
      return (
        <fieldset key={key} className="field apply-many">
          <legend>{label}</legend>
          <div className="grid-2">
            {options.map((o) => (
              <label key={o} className={`check${covered && o !== whole ? ' is-off' : ''}`}>
                <input type="checkbox" checked={value.includes(o)} disabled={covered && o !== whole}
                  onChange={(e) => {
                    if (o === whole) return set(key, e.target.checked ? [o] : [])
                    set(key, e.target.checked ? [...value.filter((x) => x !== whole), o] : value.filter((x) => x !== o))
                  }} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )
    }

    // One entry per row, a column each. Stored as one string per row so the answer stays a plain
    // list like every other one; the separator is only ever written and read here.
    if (kind === 'rows') {
      const rows = Array.isArray(value) && value.length ? value : ['']
      const cells = (row) => options.map((_, i) => row.split(ROW_SEP)[i] || '')
      // Trailing blanks are dropped, the ones in between keep their place, so a half-filled row
      // still reads back into the right columns.
      const join = (parts) => {
        const kept = [...parts]
        while (kept.length && !kept[kept.length - 1].trim()) kept.pop()
        return kept.join(ROW_SEP)
      }
      const write = (next) => set(key, next)
      return (
        <div key={key} className="field">
          <label htmlFor={`${id}-0-0`} className="visually-hidden">{label}</label>
          {rows.map((row, i) => (
            <div key={i} className="apply-cols"
              style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr)) auto` }}>
              {options.map((col, c) => (
                <input key={col} id={`${id}-${i}-${c}`} className="input" value={cells(row)[c]} maxLength={60}
                  placeholder={col} aria-label={`${col}, entry ${i + 1}`}
                  onChange={(e) => {
                    const parts = cells(row)
                    parts[c] = e.target.value
                    write(rows.map((r, n) => (n === i ? join(parts) : r)))
                  }} />
              ))}
              <button type="button" className="apply-drop" aria-label={`Remove entry ${i + 1}`}
                disabled={rows.length === 1 && !rows[0]}
                onClick={() => write(rows.length > 1 ? rows.filter((_, n) => n !== i) : [''])}>
                <X size={14} />
              </button>
            </div>
          ))}
          {rows.length < 10 && (
            <button type="button" className="btn btn-ghost btn-sm apply-add" onClick={() => write([...rows, ''])}>
              + Add another
            </button>
          )}
        </div>
      )
    }

    if (kind === 'yesno') {
      return (
        <div key={key} className="field">
          <span className="apply-q">{label}</span>
          <fieldset className="segmented apply-two" aria-label={plain(label)}>
            {['Yes', 'No'].map((o) => (
              <label key={o}><input type="radio" name={id} checked={value === o}
                onChange={() => {
                  set(key, o)
                  // Answering No puts the follow-up questions away; anything typed into them goes
                  // too, so the team never reads answers to a question that was withdrawn.
                  if (o === 'No') ALL_FIELDS.filter((x) => follows(x) === key).forEach(([k]) => set(k, ''))
                }} /><span>{o}</span></label>
            ))}
          </fieldset>
        </div>
      )
    }

    return (
      <div key={key} className="field">
        <label htmlFor={id}>{label}</label>
        {kind === 'select' ? (
          <select id={id} className="select" value={value} onChange={(e) => set(key, e.target.value)} required={need}>
            <option value="">Choose</option>
            {options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : kind === 'area' ? (
          <textarea id={id} className="textarea" rows={4} value={value} onChange={(e) => set(key, e.target.value)} required={need} maxLength={2000} />
        ) : (
          <input id={id} className="input" value={value} onChange={(e) => set(key, e.target.value)} required={need} maxLength={160} />
        )}
      </div>
    )
  })
}

function Section({ n, title, text, children }) {
  return (
    <section className="card card-pad apply-section" aria-labelledby={`apply-${n}`}>
      <header>
        <span className="mono apply-num">{String(n).padStart(2, '0')}</span>
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
      <input id={id} type="file" accept={accept} className="visually-hidden"
        onChange={(e) => { onChange(e.target.files[0] || null); e.target.value = '' }} />
    </div>
  )
}

export default function MentorApply() {
  useMeta({ title: 'Become a TYM mentor', description: 'Become a Study Abroad Mentor with The Youth Matters: for experienced professionals, educators, international graduates and study-abroad experts who can guide young people through their journey.', path: '/mentors/register' })
  const { account, setAccount } = useAuth()
  // A mentor account is its own account: "mentor" while our team decides, "verified" once approved
  // (api/serializers.py). Students never apply from here, they need a mentor account of their own.
  const me = account && (account.verification === 'mentor' || account.role === 'mentor') ? account : null
  const approved = me?.verification === 'verified'
  const existing = useApi(me ? '/mentor-application' : null)
  const [form, setForm] = useState(() => {
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT) || '{}') } } catch { return EMPTY }
  })
  const [cv, setCv] = useState(null)
  const [proof, setProof] = useState(null)
  const [agreed, setAgreed] = useState(() => AGREEMENTS.map(() => false))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(null)
  const [retry, setRetry] = useState(false)

  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify(form)) } catch { /* private mode */ } }, [form])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setValue = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setDetail = (k, v) => setForm((f) => ({ ...f, details: { ...f.details, [k]: v } }))
  const pickFile = (setter, pdfOnly) => (file) => {
    setError('')
    if (file && file.size > MAX_FILE) return setError(`${file.name} is over 5 MB. Upload a smaller file.`)
    if (file && pdfOnly && file.type !== 'application/pdf') return setError('Upload your CV as a PDF.')
    setter(file)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const asked = ALL_FIELDS.filter((f) => !follows(f) || form.details[follows(f)] === 'Yes')
    const missing = asked.find((f) => required(f) && !(form.details[f[0]] || '').length)
    // minLength on the fields does not fire for a draft restored from this device, so the two
    // lengths the server insists on are checked here as well
    const about = form.about.trim()
    const problem = !me.avatar ? 'Add a profile photo in step 1.'
      : missing ? `Please answer: ${plain(missing[1])}`
        : form.headline.trim().length < 20 ? 'Your headline needs at least 20 characters.'
          : about.length < 150 ? `Your introduction needs at least 150 characters. ${150 - about.length} to go.`
            : !form.topics.length ? 'Choose at least one key area of expertise.'
            : !form.languages.length ? 'Add the languages you can mentor in.'
              : slotCount(form.weeklyHours) < 2 ? 'Pick at least 2 weekly session times.'
                : !cv || !proof ? 'Add your CV and your qualification document.'
                  : agreed.includes(false) ? 'Please tick the Mentor Code of Conduct and each declaration.' : ''
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
    user: me || account || { displayName: 'You' }, community: { country: { name: country?.name } },
    course: form.course || 'Your course', university: form.university || 'your university',
    headline: form.headline || 'Your one-line headline shows here. Make it specific.',
    sessionMinutes: Number(form.sessionMinutes),
  }

  let panel
  if (!account) {
    panel = (
      <StatusCard icon={KeyRound} title="Create your mentor account">
        <p className="muted">Mentors take paid bookings, so every mentor has their own TYM account. Sign up with Google or an email address: there is no photo ID to show, because our team checks you from this application.</p>
        <div className="apply-status-actions">
          <Link to="/mentors/signup" className="btn btn-primary btn-sm">Become a mentor</Link>
          <Link to="/mentors/login" className="btn btn-ghost btn-sm">Mentor log in</Link>
        </div>
      </StatusCard>
    )
  } else if (!me) {
    panel = (
      <StatusCard icon={KeyRound} title="Mentors have their own account">
        <p className="muted">You are signed in with a student account. Mentoring runs on a separate account, so log out and sign up with another email address to apply.</p>
        <Link to="/mentors/signup" className="btn btn-primary btn-sm apply-status-btn">Become a mentor</Link>
      </StatusCard>
    )
  } else if (approved || current?.status === 'approved') {
    panel = (
      <StatusCard icon={BadgeCheck} title="You are a TYM mentor">
        <p className="muted">Students can find and book you in TYM Mentors. Your upcoming sessions are on your profile.</p>
        <Link to={`/u/${me.username}?tab=Sessions`} className="btn btn-primary btn-sm apply-status-btn">Your sessions</Link>
      </StatusCard>
    )
  } else if (existing.loading) {
    panel = <p className="muted post-loading"><Spinner /> Checking your application</p>
  } else if (current?.status === 'pending') {
    panel = (
      <StatusCard icon={Clock3} title="Application received">
        <p className="muted">Sent on {fullDate(current.createdAt)}. Our team will check your documents and email {me.email} within a week, sometimes to set up a short call. Your profile goes live on TYM Mentors as soon as it is approved.</p>
        <MentorCard preview m={{ ...preview, course: current.course, university: current.university, headline: current.headline, sessionMinutes: current.sessionMinutes, community: { country: { name: countries.find((c) => c.slug === current.country)?.name } } }} />
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
            <Avatar user={me} size={88} />
            <PictureField kind="avatar" current={me.avatar} onChange={(res) => setAccount(res.me)} />
          </div>
        </Section>

        <Section n={2} title="Personal details" text="Your email address and date of birth come from your TYM account.">
          <div className="grid-2"><Questions fields={PERSONAL} details={form.details} set={setDetail} /></div>
        </Section>

        <Section n={3} title="Educational background"
          text="One qualification per block. The first is the one students see on your profile; add as many others as you have.">
          <p className="apply-sub">Main qualification <span className="faint">shown on your profile</span></p>
          <Questions fields={onlyEducation(['qualification', 'field'])} details={form.details} set={setDetail} />
          <div className="grid-2">
            <div className="field">
              <label htmlFor="a-uni">Institution or university</label>
              <input id="a-uni" className="input" value={form.university} onChange={set('university')} required minLength={2} maxLength={120} placeholder="University of Leeds" />
            </div>
            <div className="field">
              <label htmlFor="a-course">Degree or qualification, as it is written</label>
              <input id="a-course" className="input" value={form.course} onChange={set('course')} required minLength={2} maxLength={120} placeholder="MSc Data Science" />
            </div>
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
              <input id="a-year" className="input" type="number" inputMode="numeric" min={1970} max={2035} value={form.graduationYear}
                onChange={set('graduationYear')} required placeholder={String(form.graduated ? year - 1 : year + 1)} />
            </div>
          </div>

          <p className="apply-sub">Your other qualifications</p>
          <Questions fields={onlyEducation(['additionalQualifications'])} details={form.details} set={setDetail} />

          <p className="apply-sub">Studying abroad yourself</p>
          <Questions fields={onlyEducation(['studiedAbroad', 'abroadStudy'])}
            details={form.details} set={setDetail} />

          <p className="apply-sub">Where your profile is listed</p>
          <div className="field">
            <label htmlFor="a-country">Main country you will mentor for</label>
            <select id="a-country" className="select" value={form.country} onChange={set('country')}>
              {countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <span className="hint">Your profile sits in this country&apos;s community. You can still list more countries further down.</span>
          </div>
        </Section>

        <Section n={4} title="Professional experience">
          <Questions fields={PROFESSIONAL} details={form.details} set={setDetail} />
        </Section>

        <Section n={5} title="Study abroad expertise" text="Select every country and area you have substantial knowledge or experience with.">
          <Questions fields={EXPERTISE} details={form.details} set={setDetail} />
          <div className="field">
            <div className="field-row"><label htmlFor="a-topics">Your key areas of expertise *</label><span className="hint">{form.topics.length}/{TOPIC_MAX}</span></div>
            <TagInput id="a-topics" value={form.topics} onChange={setValue('topics')} suggestions={KEY_AREAS} max={TOPIC_MAX} placeholder="Choose your strongest areas, or type another" />
          </div>
          <p className="muted dash-small">Important: mentors should only provide visa, immigration, legal or financial guidance within the scope of their actual qualifications and expertise.</p>
        </Section>

        <Section n={6} title="Mentoring experience">
          <Questions fields={MENTORING} details={form.details} set={setDetail} />
        </Section>

        <Section n={7} title="Your mentor profile" text="Students see your headline and introduction on your mentor profile.">
          <div className="field">
            <div className="field-row"><label htmlFor="a-headline">Headline</label><span className="hint">{160 - form.headline.length} left</span></div>
            <input id="a-headline" className="input" value={form.headline} onChange={set('headline')} required minLength={20} maxLength={160}
              placeholder="International Education Professional | UK & Canada Study Abroad Mentor" />
          </div>
          <div className="field">
            <div className="field-row">
              <label htmlFor="a-about">About you</label>
              <span className="hint">{form.about.length < 150 ? `${150 - form.about.length} more characters needed` : `${2000 - form.about.length} left`}</span>
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
            <div className="field-row"><label htmlFor="a-langs">Languages you can mentor in</label><span className="hint">{form.languages.length}/6</span></div>
            <TagInput id="a-langs" value={form.languages} onChange={setValue('languages')} suggestions={LANGUAGES} max={6} placeholder="Type a language" />
          </div>
          <div className="field">
            <label htmlFor="a-link">LinkedIn <span className="faint">Optional, but it helps</span></label>
            <input id="a-link" className="input" type="url" value={form.linkedin} onChange={set('linkedin')} placeholder="https://www.linkedin.com/in/..." />
          </div>
          <Questions fields={MOTIVATION} details={form.details} set={setDetail} />
        </Section>

        <Section n={8} title="Availability and mentoring format" text="Bookings on TYM are one-to-one video calls. Students pay with counselling hours bought from TYM, so there is no price for you to set.">
          <Questions fields={AVAILABILITY} details={form.details} set={setDetail} />
          <div className="grid-2">
            <fieldset className="segmented" aria-label="Session length">
              {[30, 45, 60].map((m) => (
                <label key={m}>
                  <input type="radio" name="minutes" checked={Number(form.sessionMinutes) === m} onChange={() => setValue('sessionMinutes')(m)} />
                  <span>{m} min</span>
                </label>
              ))}
            </fieldset>
          </div>
          <div className="field">
            <label htmlFor="a-tz">Your time zone</label>
            <select id="a-tz" className="select" value={form.timezone} onChange={set('timezone')}>
              {(ZONES.includes(form.timezone) ? ZONES : [form.timezone, ...ZONES]).map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </Section>

        <Section n={9} title="Weekly hours" text={`Add the hours you are free in one go, then change any single one in the grid below. Times are in ${form.timezone.replace(/_/g, ' ')}; students see them in their own time zone. They are set when the team approves your application; to change them afterwards, write to support@theyouthmatters.com.`}>
          <WeekGrid value={form.weeklyHours} update={(fn) => setForm((f) => ({ ...f, weeklyHours: fn(f.weeklyHours) }))} />
        </Section>

        <Section n={10} title="Documents and verification" text="Only the TYM review team can open these. They are never shown on your profile.">
          <div className="grid-2">
            <FileField id="a-cv" label="Resume / CV *" hint="PDF, up to 5 MB" accept="application/pdf" file={cv} onChange={pickFile(setCv, true)} />
            <FileField id="a-proof" label="Educational qualification document *" hint="Degree certificate, transcript or enrolment letter. PDF, JPG or PNG, up to 5 MB"
              accept="application/pdf,image/jpeg,image/png" file={proof} onChange={pickFile(setProof, false)} />
          </div>
        </Section>

        <Section n={11} title="Mentoring standards and declarations" text="As a Study Abroad Mentor, I agree to:">
          <ul className="apply-list">{CODE_OF_CONDUCT.map((t) => <li key={t}><Check size={16} aria-hidden /> {t}</li>)}</ul>
          {AGREEMENTS.map((text, i) => (
            <label key={text} className="check">
              <input type="checkbox" checked={agreed[i]} onChange={(e) => setAgreed((a) => a.map((v, j) => (j === i ? e.target.checked : v)))} />
              <span>{text} *</span>
            </label>
          ))}
          <Questions fields={DECLARATION} details={form.details} set={setDetail} />
        </Section>

        <div className="card card-pad stack apply-submit">
          <FormError>{error}</FormError>
          <SubmitButton busy={busy} busyText="Sending your application">Submit mentor application</SubmitButton>
          <p className="faint dash-small">Your answers are saved on this device as you type, so you can finish later. Files need adding again.</p>
        </div>
      </form>
    )
  }

  const formShown = me && !approved && !existing.loading && (!current || retry)

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">TYM Mentors · Apply</p>
        <h1>Become a Study Abroad Mentor</h1>
        <p>Thank you for your interest in becoming a mentor with The Youth Matters. We are looking for experienced professionals, educators, international graduates, study-abroad experts and industry professionals who can guide young people through their study-abroad journey.</p>
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
