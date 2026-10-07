import { useState } from 'react'
import { ArrowUpRight, FileText, Star } from 'lucide-react'
import { FormError, Spinner } from '../../components/auth/fields'
import { adminApi, openAdminFile, useAdminApi } from '../../lib/admin'
import { formatMoney, plural } from '../../lib/format'
import { Confirm, Empty, Facts, Loading, PageHead, Person, Pill, Sheet, Tabs, ago, day } from './ui'

const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]

// One application, with everything needed to decide: profile, hours, and the two private documents
function Application({ a, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const hours = DAYS.filter(([d]) => a.weeklyHours[d]?.length).map(([d, label]) => `${label} ${a.weeklyHours[d].join(', ')}`)

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
        ['Sessions', `${a.sessionMinutes} minutes for ${formatMoney(a.price * 100)}`],
        ['Helps with', a.topics.join(', ')],
        ['Languages', a.languages.join(', ')],
        ['Work', a.experience],
        ['LinkedIn', a.linkedin && <a href={a.linkedin} target="_blank" rel="noreferrer nofollow" className="link">Open profile</a>],
        ['Weekly hours', <>{hours.map((h) => <span key={h} className="adm-hours">{h}</span>)}<span className="faint">{a.timezone.replace(/_/g, ' ')} time</span></>],
        ['Applied', day(a.createdAt)],
        ['Decided', a.decidedAt && day(a.decidedAt)],
        ['Note to them', a.status !== 'pending' && a.note],
      ]} />
      <section>
        <h3 className="adm-h2">About them</h3>
        <p className="adm-prose">{a.about}</p>
      </section>
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
              <span className="adm-cell">{formatMoney(a.price * 100)} · {a.sessionMinutes} min</span>
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
  const [f, setF] = useState({ headline: start.headline, university: start.university, course: start.course, about: start.about, price: start.price })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSaved(false) }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi(`/admin/mentors/${id}`, { method: 'PATCH', body: { ...f, price: Number(f.price) } })
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
      <div className="field">
        <label htmlFor="ml-price">Price of one session, in rupees</label>
        <input id="ml-price" type="number" className="input" value={f.price} onChange={set('price')} required min={299} max={9999} step={1} />
        <span className="hint">Each session is {start.sessionMinutes} minutes. A new price applies to sessions booked from now on.</span>
      </div>
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

function Directory() {
  const list = useAdminApi('/admin/mentors')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
  const toggle = async (m) => {
    setError('')
    try {
      await adminApi(`/admin/mentors/${m.id}/listed`, { method: 'POST', body: { listed: !m.listed } })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  if (list.error) return <Empty title="We could not load mentors" text={list.error.message} />
  if (!list.data) return <Loading what="mentors" />
  if (!list.data.length) return <Empty title="No mentors yet" text="Approve an application and the mentor appears here and on the site." />
  return (
    <>
      <FormError>{error}</FormError>
      <ul className="adm-list">
        {list.data.map((m) => (
          <li key={m.id} className="adm-row adm-directory">
            <Person user={m.user} sub={`${m.course}, ${m.university}`} />
            <span className="adm-cell adm-cell-drop">{m.country}</span>
            <span className="adm-cell">{formatMoney(m.priceMinor, m.currency)} · {m.sessionMinutes} min</span>
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
      <p className="adm-hint">Mentors join by filling in the mentor form on the site. Edit opens their listing, their reviews, and the way to remove them.</p>
      {open && <MentorSheet mentor={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  )
}

export default function Mentors({ onChanged }) {
  const [tab, setTab] = useState('pending')
  const pending = useAdminApi('/admin/mentor-applications?status=pending')
  return (
    <>
      <PageHead eyebrow="Mentors" title="Applications and the directory"
        text="When someone fills in the mentor form on the site, their application lands here with their CV and proof of study. Approve it and their profile goes live in TYM Mentors, bookable straight away. Turn it down with a note and they can fix it and apply again." />
      <div className="adm-toolbar">
        <Tabs label="Mentors" value={tab} onChange={setTab}
          items={[['pending', 'New applications', pending.data?.length], ['approved', 'Approved'], ['rejected', 'Turned down'], ['directory', 'Mentors on the site']]} />
      </div>
      {tab === 'directory' ? <Directory /> : <Applications key={tab} status={tab} onChanged={() => { pending.reload(); onChanged?.() }} />}
    </>
  )
}
