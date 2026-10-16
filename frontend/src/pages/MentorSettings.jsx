import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check } from 'lucide-react'
import { FormError, Spinner, SubmitButton } from '../components/auth/fields'
import MentorCard from '../components/mentors/MentorCard'
import { LANGUAGES, TOPIC_MAX, TagInput, WeekGrid, ZONES, slotCount } from '../components/mentors/scheduler'
import { KEY_AREAS } from '../data/mentorForm'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useMeta } from '../lib/meta'
import '../components/auth/auth.css'
import '../components/mentors/mentors.css'

// What a mentor may change about themselves after they are approved. Their country, their
// documents and their verified badge are not here: those were checked by the team, and changing
// them is a conversation, not a form.
const MINE = ['headline', 'about', 'experience', 'topics', 'languages', 'linkedin',
  'university', 'course', 'graduationYear', 'sessionMinutes', 'timezone', 'weeklyHours']

const shape = (m) => ({
  headline: m.headline || '', about: m.about || '', experience: m.experience || '',
  topics: m.topics || [], languages: m.languages || [], linkedin: m.links?.linkedin || '',
  university: m.university || '', course: m.course || '', graduationYear: m.graduationYear || '',
  sessionMinutes: m.sessionMinutes || 30, timezone: m.timezone || 'Europe/London',
  weeklyHours: m.weeklyHours || {},
})

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export default function MentorSettings() {
  useMeta({ title: 'Your mentor profile', path: '/my/mentor' })
  const { user } = useAuth()
  const { data, error: loadError, reload } = useApi('/mentors/me')
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(null)   // what is on the server now
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm(shape(data))
    setSaved(shape(data))
  }, [data])

  if (loadError) {
    const missing = loadError.status === 404
    return (
      <div className="container page narrow">
        <h1 className="page-head">{missing ? 'This account is not a mentor' : 'We could not load your profile'}</h1>
        <p className="muted">{missing
          ? 'Mentor profiles are created when our team approves an application.'
          : loadError.message}</p>
        <Link to={missing ? '/mentors/register' : '/my'} className="btn btn-primary btn-sm">
          {missing ? 'Apply to mentor' : 'Back to your dashboard'}
        </Link>
      </div>
    )
  }
  if (!form) return <div className="container page post-loading"><Spinner /> Loading your mentor profile</div>

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setDone(false) }
  const put = (k) => (v) => { setForm({ ...form, [k]: v }); setDone(false) }
  const times = slotCount(form.weeklyHours)
  const changed = !same(form, saved)

  const save = async (e) => {
    e.preventDefault()
    setError('')
    const problem = form.headline.trim().length < 20 ? 'Your headline needs at least 20 characters.'
      : form.about.trim().length < 150 ? `Your introduction needs at least 150 characters. ${150 - form.about.trim().length} to go.`
        : !form.topics.length ? 'Choose at least one key area of expertise.'
          : !form.languages.length ? 'Add the languages you can mentor in.'
            : times < 2 ? 'Pick at least 2 weekly session times.' : ''
    if (problem) return setError(problem)
    setBusy(true)
    try {
      const fresh = await api('/mentors/me', { method: 'PATCH', body: Object.fromEntries(MINE.map((k) => [k, form[k]])) })
      setSaved(shape(fresh))
      setForm(shape(fresh))
      setDone(true)
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">TYM Mentors</p>
        <h1>Your mentor profile</h1>
        <p>Everything here is what students see before they book you. Changes go live as soon as you save.</p>
        <Link to={`/mentors/${data.id}`} className="btn btn-ghost btn-sm head-cta">
          See your public page <ArrowUpRight size={15} aria-hidden />
        </Link>
      </header>

      <div className="layout-2 apply-layout">
        <form className="stack apply-sections" onSubmit={save}>
          <section className="apply-section card card-pad stack">
            <h2 className="section-title">How students see you</h2>
            <div className="field">
              <div className="field-row">
                <label htmlFor="m-headline">Headline</label>
                <span className="hint">{160 - form.headline.length} left</span>
              </div>
              <input id="m-headline" className="input" value={form.headline} onChange={set('headline')}
                minLength={20} maxLength={160} />
            </div>
            <div className="field">
              <div className="field-row">
                <label htmlFor="m-about">About you</label>
                <span className="hint">{form.about.length < 150 ? `${150 - form.about.length} more characters needed` : `${2000 - form.about.length} left`}</span>
              </div>
              <textarea id="m-about" className="textarea" rows={6} value={form.about} onChange={set('about')}
                minLength={150} maxLength={2000} />
            </div>
            <div className="field">
              <label htmlFor="m-exp">Work or volunteering <span className="faint">Optional</span></label>
              <input id="m-exp" className="input" value={form.experience} onChange={set('experience')} maxLength={255} />
            </div>
            <div className="field">
              <div className="field-row">
                <label htmlFor="m-topics">Your key areas of expertise</label>
                <span className="hint">{form.topics.length}/{TOPIC_MAX}</span>
              </div>
              <TagInput id="m-topics" value={form.topics} onChange={put('topics')} suggestions={KEY_AREAS}
                max={TOPIC_MAX} placeholder="Choose your strongest areas, or type another" />
            </div>
            <div className="field">
              <div className="field-row">
                <label htmlFor="m-langs">Languages you can mentor in</label>
                <span className="hint">{form.languages.length}/6</span>
              </div>
              <TagInput id="m-langs" value={form.languages} onChange={put('languages')} suggestions={LANGUAGES}
                max={6} placeholder="Type a language" />
            </div>
            <div className="field">
              <label htmlFor="m-link">LinkedIn <span className="faint">Optional</span></label>
              <input id="m-link" className="input" value={form.linkedin} onChange={set('linkedin')}
                maxLength={255} placeholder="https://www.linkedin.com/in/..." />
            </div>
          </section>

          <section className="apply-section card card-pad stack">
            <h2 className="section-title">Where you studied</h2>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="m-uni">Institution or university</label>
                <input id="m-uni" className="input" value={form.university} onChange={set('university')} minLength={2} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="m-course">Degree or qualification</label>
                <input id="m-course" className="input" value={form.course} onChange={set('course')} minLength={2} maxLength={120} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="m-year">Graduation year</label>
              <input id="m-year" className="input" type="number" inputMode="numeric" min={1970} max={2035}
                value={form.graduationYear} onChange={set('graduationYear')} />
            </div>
          </section>

          <section className="apply-section card card-pad stack">
            <h2 className="section-title">Sessions and weekly hours</h2>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="m-mins">Session length</label>
                <select id="m-mins" className="select" value={form.sessionMinutes}
                  onChange={(e) => put('sessionMinutes')(Number(e.target.value))}>
                  {[30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="m-zone">Your time zone</label>
                <select id="m-zone" className="select" value={form.timezone} onChange={set('timezone')}>
                  {ZONES.map((z) => <option key={z}>{z.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <p className="hint">Times are in {form.timezone.replace(/_/g, ' ')}. Students see them in their own
              zone. A time you remove stops being bookable, but a session already booked into it stays.</p>
            <WeekGrid value={form.weeklyHours} update={(fn) => put('weeklyHours')(fn(form.weeklyHours))} />
          </section>

          <FormError>{error}</FormError>
          <div className="settings-save">
            {done && !changed && <span className="saved-note" role="status"><Check size={15} /> Saved and live</span>}
            <SubmitButton busy={busy} busyText="Saving" disabled={!changed} style={{ width: 'auto' }}>
              Save changes
            </SubmitButton>
          </div>
        </form>

        <aside className="stack sticky apply-rail">
          <div className="apply-preview">
            <p className="col-title">How students will see you</p>
            <MentorCard preview m={{
              user, community: { country: { name: data.community?.country?.name } },
              course: form.course, university: form.university,
              headline: form.headline || 'Your one-line headline shows here.',
            }} />
          </div>
          <div className="card card-pad">
            <h2 className="section-title">Your week</h2>
            <p className="muted dash-small">
              <strong className="mono">{times}</strong> {times === 1 ? 'time' : 'times'} a week.
            </p>
            <p className="muted dash-small">Students can book the next three weeks of these.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
