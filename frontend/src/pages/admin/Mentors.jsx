import { useState } from 'react'
import { ArrowUpRight, FileText, Plus, Star } from 'lucide-react'
import { FormError, Spinner, SubmitButton } from '../../components/auth/fields'
import { countries } from '../../data/sample'
import { ALL_FIELDS, plain } from '../../data/mentorForm'
import { adminApi, openAdminFile, useAdminApi } from '../../lib/admin'
import { plural } from '../../lib/format'
import { MentorHours, Packages } from './Payments'
import { Confirm, Empty, Facts, Loading, PageHead, PasswordBox, Person, Pill, Sheet, Tabs, ago, day, newPassword } from './ui'

// One application, with everything needed to decide: profile and the two private documents
function Application({ a, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const decide = async (approve) => {
    setError('')
    try {
      await adminApi(`/admin/mentor-applications/${a.id}/decision`, { method: 'POST', body: { approve, note } })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }
  const file = (kind) => openAdminFile(`/admin/mentor-applications/${a.id}/files/${kind}`).catch((err) => setError(err.message))

  return (
    <Sheet title={`${a.user.displayName}'s application`} onClose={onClose} wide>
      <div className="adm-account">
        <Person user={a.user} sub={a.user.email} size={56} />
        <div className="adm-account-pills"><Pill tone={a.status === 'pending' ? 'solid' : 'muted'}>{a.status === 'pending' ? 'To read' : a.status}</Pill></div>
      </div>
      <p className="adm-quote">{a.headline}</p>
      <Facts items={[
        ['Studied', `${a.course}, ${a.university}`],
        ['Status', `${a.graduated ? 'Graduated' : 'Graduating'} ${a.graduationYear}`],
        ['Helps with', a.topics.join(', ')],
        ['Languages', a.languages.join(', ')],
        ['Work', a.experience],
        ['LinkedIn', a.linkedin && <a href={a.linkedin} target="_blank" rel="noreferrer nofollow" className="link">Open profile</a>],
        ['Time zone', a.timezone.replace(/_/g, ' ')],
        ['Applied', day(a.createdAt)],
        ['Decided', a.decidedAt && day(a.decidedAt)],
        ['Note to them', a.status !== 'pending' && a.note],
      ]} />
      <section>
        <h3 className="adm-h2">About them</h3>
        <p className="adm-prose">{a.about}</p>
      </section>
      {Object.keys(a.details || {}).length > 0 && (
        <section>
          <h3 className="adm-h2">Registration form</h3>
          <Facts items={ALL_FIELDS.map(([key, label]) => [plain(label), [].concat(a.details[key] || []).join(', ')])} />
        </section>
      )}
      <section>
        <h3 className="adm-h2">Documents</h3>
        <div className="adm-action-row">
          <button className="btn btn-ghost btn-sm" onClick={() => file('cv')}><FileText size={15} /> Open CV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => file('proof')}><FileText size={15} /> Open proof of study</button>
        </div>
        <p className="adm-hint">Private files. They open in a new tab and are never shown on the site.</p>
      </section>
      {a.status === 'pending' && (
        <section className="adm-actions">
          <h3 className="adm-h2">Decide</h3>
          <div className="adm-action">
            <label htmlFor="app-note">A note for them. Needed if you turn it down, so they know what to change.</label>
            <textarea id="app-note" className="textarea adm-textarea" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="For example: your proof of enrolment is out of date, please upload this term's letter." />
            <div className="adm-action-row">
              <Confirm label="Approve and go live" question="Approve? Their profile goes live now." className="btn btn-primary btn-sm" onConfirm={() => decide(true)} />
              <Confirm label="Turn down" question="Turn this down?" danger disabled={note.trim().length < 10} onConfirm={() => decide(false)} />
            </div>
          </div>
        </section>
      )}
      <FormError>{error}</FormError>
    </Sheet>
  )
}

function Applications({ status, onChanged }) {
  const list = useAdminApi(`/admin/mentor-applications?status=${status}`)
  const [open, setOpen] = useState(null)
  if (list.error) return <Empty title="We could not load applications" text={list.error.message} />
  if (!list.data) return <Loading what="applications" />
  if (!list.data.length) {
    return (
      <Empty title={status === 'pending' ? 'No new applications' : 'None yet'}
        text={status === 'pending' ? 'Applications from the mentor form on the site arrive here. You will also see a number beside Mentors in the menu.' : 'Applications you decide on are kept here.'}>
        {status === 'pending' && <a href="/mentors/register" target="_blank" rel="noreferrer" className="adm-more">See the mentor form on the site <ArrowUpRight size={14} aria-hidden /></a>}
      </Empty>
    )
  }
  return (
    <>
      <ul className="adm-list">
        {list.data.map((a) => (
          <li key={a.id}>
            <button className="adm-row adm-apps" onClick={() => setOpen(a)}>
              <Person user={a.user} sub={a.user.email} />
              <span className="adm-cell adm-cell-wide">{a.course}, {a.university}</span>
              <span className="adm-cell">{a.sessionMinutes} min sessions</span>
              <time className="adm-cell adm-cell-time" dateTime={a.createdAt}>Applied {ago(a.createdAt)}</time>
            </button>
          </li>
        ))}
      </ul>
      {open && <Application a={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); list.reload(); onChanged?.() }} />}
    </>
  )
}

// What students read on a mentor's page. Session length and weekly hours stay the mentor's own.
function Listing({ id, start, onSaved }) {
  const [f, setF] = useState({ headline: start.headline, university: start.university, course: start.course, about: start.about })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSaved(false) }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi(`/admin/mentors/${id}`, { method: 'PATCH', body: f })
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <h3 className="adm-h2">Their listing</h3>
      <div className="field">
        <label htmlFor="ml-headline">Headline</label>
        <input id="ml-headline" className="input" value={f.headline} onChange={set('headline')} required minLength={10} maxLength={160} />
      </div>
      <div className="grid-2">
        <div className="field"><label htmlFor="ml-course">Course</label><input id="ml-course" className="input" value={f.course} onChange={set('course')} required minLength={2} maxLength={120} /></div>
        <div className="field"><label htmlFor="ml-uni">University</label><input id="ml-uni" className="input" value={f.university} onChange={set('university')} required minLength={2} maxLength={120} /></div>
      </div>
      <p className="adm-hint">Each session is {start.sessionMinutes} minutes and uses that much of the student's counselling hours. Prices are set on the packages, under Payments.</p>
      <div className="field">
        <label htmlFor="ml-about">About them</label>
        <textarea id="ml-about" className="textarea adm-textarea" rows={5} value={f.about} onChange={set('about')} maxLength={4000} />
      </div>
      <FormError>{error}</FormError>
      {saved && <p className="adm-ok" role="status">Saved. Their page on the site shows the change now.</p>}
      <button className="btn btn-primary btn-sm adm-account-save" disabled={busy}>{busy ? <Spinner /> : 'Save listing'}</button>
    </form>
  )
}

// One mentor: fix their listing, take down a review, or stop them being a mentor
function MentorSheet({ mentor, onClose, onChanged }) {
  const { data, error: failed, reload } = useAdminApi(`/admin/mentors/${mentor.id}`)
  const [error, setError] = useState('')
  const run = async (fn) => {
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }
  const removeReview = (r) => run(async () => { await adminApi(`/admin/reviews/${r.id}`, { method: 'DELETE' }); reload(); onChanged() })
  const removeMentor = () => run(async () => { await adminApi(`/admin/mentors/${mentor.id}`, { method: 'DELETE' }); onChanged(); onClose() })

  return (
    <Sheet title={mentor.user.displayName} onClose={onClose} wide>
      <div className="adm-account">
        <Person user={mentor.user} sub={mentor.user.email} size={56} />
        <div className="adm-account-pills">{mentor.listed ? <Pill>Listed</Pill> : <Pill tone="warn">Hidden</Pill>}</div>
      </div>
      {failed ? <p className="adm-note">{failed.message}</p> : !data ? <Loading what="this mentor" /> : (
        <>
          <Listing id={mentor.id} start={data} onSaved={onChanged} />
          <section>
            <h3 className="adm-h2">Reviews from students</h3>
            {data.reviews.length === 0 ? <p className="adm-note">No student has reviewed this mentor yet.</p> : (
              <ul className="adm-plain adm-room-log">
                {data.reviews.map((r) => (
                  <li key={r.id}>
                    <span><strong>{r.by}</strong> <span className="faint">{r.rating} out of 5 · {ago(r.at)}</span><br />{r.body}</span>
                    <Confirm label="Delete" question="Delete this review?" danger className="btn-text" onConfirm={() => removeReview(r)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="adm-actions">
            <h3 className="adm-h2">Stop them being a mentor</h3>
            <div className="adm-action">
              {data.bookings > 0
                ? <p>Students have booked {plural(data.bookings, 'session')} with this mentor, so the profile has to be kept. Use Hide in the list to take it off the site.</p>
                : <p>Takes their mentor profile, hours and reviews off the site. Their member account stays, and they can apply again.</p>}
              {data.bookings === 0 && <div className="adm-action-row"><Confirm label="Remove as a mentor" question="Remove their mentor profile?" yes="Remove" danger onConfirm={removeMentor} /></div>}
            </div>
          </section>
        </>
      )}
      <FormError>{error}</FormError>
    </Sheet>
  )
}

// A mentor the team adds itself, instead of waiting for an application. They set their own
// session length and weekly hours when they first log in.
function AddMentor({ onClose, onAdded }) {
  const [password, setPassword] = useState(newPassword)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      await adminApi('/admin/mentors', { method: 'POST', body: { ...f, password } })
      setAdded({ email: f.email, password })
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (added) {
    return (
      <Sheet title="Mentor added" onClose={onClose}>
        <p className="adm-ok" role="status">
          They are listed in TYM Mentors now. Tell them to log in with <strong>{added.email}</strong> and the password{' '}
          <strong className="mono">{added.password}</strong>. This is the only time the password is shown.
        </p>
        <p className="adm-note">Students can book them once the mentor sets their session length and weekly hours in their own settings.</p>
        <button className="btn btn-ghost btn-block" onClick={onClose}>Done</button>
      </Sheet>
    )
  }
  return (
    <Sheet title="Add a mentor" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="ad-name">Full name</label>
          <input id="ad-name" name="name" className="input" required minLength={2} maxLength={80} placeholder="Ananya Rao" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="ad-email">Email</label>
          <input id="ad-email" name="email" type="email" className="input" required placeholder="ananya@example.com" autoComplete="off" />
          <span className="hint">They log in with this. We email them to say their profile is live.</span>
        </div>
        <PasswordBox id="ad-pass" label="Starting password" required value={password} onChange={setPassword}
          hint="Give this to them yourself. We do not email passwords. They can change it after logging in." />
        <div className="field">
          <label htmlFor="ad-country">Country they studied in</label>
          <select id="ad-country" name="country" className="select" defaultValue="uk">
            {countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ad-uni">University</label>
          <input id="ad-uni" name="university" className="input" required minLength={2} maxLength={120} placeholder="Royal Holloway, University of London" />
        </div>
        <div className="field">
          <label htmlFor="ad-course">Course</label>
          <input id="ad-course" name="course" className="input" required minLength={2} maxLength={120} placeholder="MSc Artificial Intelligence" />
        </div>
        <div className="field">
          <label htmlFor="ad-year">Graduation year <span className="faint">Optional</span></label>
          <input id="ad-year" name="graduationYear" type="number" className="input" min={1970} max={2035} placeholder="2024" />
        </div>
        <div className="field">
          <label htmlFor="ad-headline">Headline</label>
          <input id="ad-headline" name="headline" className="input" required minLength={10} maxLength={160}
            placeholder="I help students apply to UK universities on a budget." />
        </div>
        <div className="field">
          <label htmlFor="ad-topics">What they help with <span className="faint">Optional</span></label>
          <input id="ad-topics" name="topics" className="input" maxLength={400} placeholder="Applications, Scholarships, Housing" />
          <span className="hint">Separate each one with a comma.</span>
        </div>
        <div className="field">
          <label htmlFor="ad-about">About them <span className="faint">Optional</span></label>
          <textarea id="ad-about" name="about" className="input" rows={4} maxLength={4000} placeholder="A few lines students read on their page." />
        </div>
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Adding">Add mentor</SubmitButton>
      </form>
    </Sheet>
  )
}

function Directory() {
  const list = useAdminApi('/admin/mentors')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const toggle = async (m) => {
    setError('')
    try {
      await adminApi(`/admin/mentors/${m.id}/listed`, { method: 'POST', body: { listed: !m.listed } })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const add = <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={16} /> Add a mentor</button>
  const sheet = adding && <AddMentor onClose={() => setAdding(false)} onAdded={list.reload} />
  if (list.error) return <Empty title="We could not load mentors" text={list.error.message} />
  if (!list.data) return <Loading what="mentors" />
  if (!list.data.length) {
    return (
      <>
        <Empty title="No mentors yet" text="Add one here, or approve an application and the mentor appears on the site." />
        <p className="adm-directory-add">{add}</p>
        {sheet}
      </>
    )
  }
  return (
    <>
      <p className="adm-directory-add">{add}</p>
      <FormError>{error}</FormError>
      <ul className="adm-list">
        {list.data.map((m) => (
          <li key={m.id} className="adm-row adm-directory">
            <Person user={m.user} sub={`${m.course}, ${m.university}`} />
            <span className="adm-cell adm-cell-drop">{m.country}</span>
            <span className="adm-cell">{m.sessionMinutes} min sessions</span>
            <span className="adm-cell">
              {m.rating ? <><Star size={13} aria-hidden /> {m.rating} ({m.reviewCount})</> : 'No reviews yet'} · {m.sessions} sessions
            </span>
            <span className="adm-row-actions">
              {m.listed ? <Pill>Listed</Pill> : <Pill tone="warn">Hidden</Pill>}
              <button className="btn-text" onClick={() => setOpen(m)}>Edit</button>
              <Confirm label={m.listed ? 'Hide' : 'List again'} className="btn-text"
                question={m.listed ? 'Hide from the directory?' : 'Show in the directory?'} onConfirm={() => toggle(m)} />
              <a href={`/mentors/${m.id}`} target="_blank" rel="noreferrer" className="adm-icon" aria-label={`Open ${m.user.displayName}'s page`}><ArrowUpRight size={16} /></a>
            </span>
          </li>
        ))}
      </ul>
      <p className="adm-hint">Mentors join by filling in the mentor form on the site, or you add them here yourself. Edit opens their listing, their reviews, and the way to remove them.</p>
      {open && <MentorSheet mentor={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
      {sheet}
    </>
  )
}

export default function Mentors({ onChanged }) {
  const [tab, setTab] = useState('pending')
  const pending = useAdminApi('/admin/mentor-applications?status=pending')
  return (
    <>
      <PageHead eyebrow="Mentors" title="Applications, the directory and charges"
        text="When someone fills in the mentor form on the site, their application lands here with their CV and proof of study. Approve it and their profile goes live in TYM Mentors, bookable straight away. Turn it down with a note and they can fix it and apply again. Under Charges you set what counselling hours cost: every mentor costs the same, and students pay with hours." />
      <div className="adm-toolbar">
        <Tabs label="Mentors" value={tab} onChange={setTab}
          items={[['pending', 'New applications', pending.data?.length], ['approved', 'Approved'], ['rejected', 'Turned down'], ['directory', 'Mentors on the site'], ['charges', 'Charges'], ['hours', 'Mentor hours']]} />
      </div>
      {/* What students pay and what each mentor gave: the same screens as under Payments, where people also look for them */}
      {tab === 'charges' ? <Packages /> : tab === 'hours' ? <MentorHours />
        : tab === 'directory' ? <Directory /> : <Applications key={tab} status={tab} onChanged={() => { pending.reload(); onChanged?.() }} />}
    </>
  )
}
