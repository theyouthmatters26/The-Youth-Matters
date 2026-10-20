import { useState } from 'react'
import { ArrowLeft, Check, Download, Mail, MessageSquare, Plus, Square, UserCheck } from 'lucide-react'
import { FormError, Spinner } from '../../components/auth/fields'
import { adminApi, useAdminApi } from '../../lib/admin'
import { useApi } from '../../lib/api'
import { saveTranscript } from '../../lib/transcript'
import { Confirm, Empty, Loading, Person, PageHead, Pager, Pill, Tabs, ago } from './ui'

// Sessions people asked for through the booking form, while payment is arranged by hand.
// The team picks the mentor, agrees a time and payment, then confirms: that sends both of them an
// email and opens their chat on the site.
const TONE = { new: 'warn', assigned: 'line', confirmed: 'good', cancelled: 'muted' }
const LABEL = { new: 'Needs a mentor', assigned: 'Mentor assigned', confirmed: 'Confirmed', cancelled: 'Closed' }
const LENGTHS = [30, 45, 60, 90, 120, 180, 240]

// The session clock, picked rather than typed: a date, a time, and how long it runs. Both people
// see a countdown in their chat drawn from exactly this.
function When({ id, date, time, minutes, onChange, disabled }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-date`}>Session date</label>
        <input id={`${id}-date`} type="date" className="input" value={date} disabled={disabled}
          onChange={(e) => onChange({ date: e.target.value, time, minutes })} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-time`}>Start time <span className="faint">Your time zone</span></label>
        <input id={`${id}-time`} type="time" className="input" value={time} disabled={disabled}
          onChange={(e) => onChange({ date, time: e.target.value, minutes })} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-mins`}>How long</label>
        <select id={`${id}-mins`} className="select" value={minutes} disabled={disabled}
          onChange={(e) => onChange({ date, time, minutes: Number(e.target.value) })}>
          {LENGTHS.map((v) => <option key={v} value={v}>{v < 60 ? `${v} minutes` : `${v / 60} ${v === 60 ? 'hour' : 'hours'}`}</option>)}
        </select>
      </div>
    </>
  )
}

// The pickers hold local date and time; the server is given one instant.
const startsAt = ({ date, time }) => (date && time ? new Date(`${date}T${time}`).toISOString() : null)
const split = (iso) => {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const pad = (v) => String(v).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}
const readable = (iso) => (iso ? new Date(iso).toLocaleString('en-GB',
  { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null)

function Row({ r, mentors, onChanged }) {
  const [mentorId, setMentorId] = useState(r.mentor?.id || '')
  const [note, setNote] = useState(r.note || '')
  const [when, setWhen] = useState(() => ({ ...split(r.startsAt), minutes: r.minutes || 60 }))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const save = async (what, body) => {
    setBusy(what)
    setError('')
    try {
      await adminApi(`/admin/session-requests/${r.id}`, { method: 'PATCH', body })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const done = r.status === 'confirmed' || r.status === 'cancelled'
  const name = (id) => mentors.find((m) => String(m.id) === String(id))?.user.displayName || 'this mentor'

  return (
    <li className="adm-report">
      <div className="adm-report-head">
        <Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill>
        <span className="adm-contact-from"><strong>{r.name}</strong> {r.email}</span>
        <time dateTime={r.at}>{ago(r.at)}</time>
      </div>

      <dl className="adm-answers">
        {r.package && <div><dt>Plan</dt><dd>{r.package}{r.hours ? ` · ${r.hours} ${r.hours === 1 ? 'hour' : 'hours'}` : ''}</dd></div>}
        {r.whatsapp && <div><dt>WhatsApp</dt><dd>{r.whatsapp}</dd></div>}
        {r.wantedMentor && <div><dt>Asked for</dt><dd>{r.wantedMentor.name}</dd></div>}
        <div><dt>TYM account</dt><dd>{r.hasAccount ? 'Yes — the chat can open' : 'No — ask them to sign up with this email'}</dd></div>
        {Object.entries(r.answers).filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {r.message && <p className="adm-prose">{r.message}</p>}

      <div className="adm-assign">
        <div className="field">
          <label htmlFor={`m-${r.id}`}>Mentor for this session</label>
          <select id={`m-${r.id}`} className="select" value={mentorId} disabled={done}
            onChange={(e) => { setMentorId(e.target.value); setError('') }}>
            <option value="">Choose a mentor</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.displayName} · {m.community?.country?.name} · {m.sessionMinutes} min
              </option>
            ))}
          </select>
        </div>
        <When id={`w-${r.id}`} {...when} onChange={setWhen} disabled={r.status === 'cancelled'} />
        <div className="field adm-wide">
          <label htmlFor={`n-${r.id}`}>How they are paying <span className="faint">Optional</span></label>
          <input id={`n-${r.id}`} className="input" value={note} maxLength={500} disabled={done}
            onChange={(e) => setNote(e.target.value)} placeholder="Paid ₹4,000 by UPI." />
          <span className="hint">The date, the time and this line all go into both emails.</span>
        </div>
      </div>

      <FormError>{error}</FormError>
      <div className="adm-action-row">
        {!done && (
          <Confirm label={<><UserCheck size={14} /> Assign mentor and book it</>} className="btn btn-primary btn-sm"
            disabled={!mentorId || !when.date || !when.time || !!busy}
            question={`Book this session with ${name(mentorId)} on ${readable(startsAt(when)) || 'the time you picked'}? ${r.name} and the mentor are both emailed, and their private chat opens straight away.`}
            onConfirm={() => save('assign', { mentorId: Number(mentorId), note, startsAt: startsAt(when), minutes: when.minutes })} />
        )}
        {busy === 'assign' && <span className="adm-hint"><Spinner /> Emailing both of them</span>}
        {r.status === 'confirmed' && !r.endedAt && (
          <>
            <span className="adm-ok" role="status"><Check size={15} /> Booked {ago(r.confirmedAt)} · both told · chat open</span>
            <Confirm label={<><Square size={13} /> End the session</>}
              question="End this session now? The clock stops for both of them, and their chat stays open."
              onConfirm={() => save('end', { end: true })} />
          </>
        )}
        {r.endedAt && <span className="adm-hint">Session ended {ago(r.endedAt)} · chat still open</span>}
        <a className="btn btn-ghost btn-sm" href={`mailto:${r.email}?subject=${encodeURIComponent('Your TYM mentorship session')}`}>
          <Mail size={14} /> Email {r.name.split(' ')[0]}
        </a>
        {!done && (
          <Confirm label="Close" question="Close this request without booking it?" danger className="btn-text"
            onConfirm={() => save('cancel', { status: 'cancelled', note })} />
        )}
        {r.status === 'cancelled' && (
          <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => save('reopen', { status: 'assigned' })}>Reopen</button>
        )}
      </div>
    </li>
  )
}

// A session the team arranged off the site: somebody asked on WhatsApp, or the team called them.
// Saving it books it exactly like assigning a mentor to a request does.
function NewSession({ mentors, plans, onAdded }) {
  const [open, setOpen] = useState(false)
  const blank = { name: '', email: '', whatsapp: '', mentorId: '', packageId: '', note: '', message: '', date: '', time: '', minutes: 60 }
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError('') }
  const ready = form.name.trim().length > 1 && /.+@.+\..+/.test(form.email) && form.mentorId && form.date && form.time

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi('/admin/session-requests', {
        method: 'POST',
        body: {
          ...form, mentorId: Number(form.mentorId), packageId: Number(form.packageId) || undefined,
          startsAt: startsAt(form), minutes: form.minutes,
        },
      })
      setForm(blank)
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} /> Book a session</button>
  return (
    <form className="adm-faq-new stack" onSubmit={add}>
      <div className="adm-assign">
        <div className="field">
          <label htmlFor="s-name">Student&apos;s name</label>
          <input id="s-name" className="input" value={form.name} onChange={set('name')} maxLength={80} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="s-email">Student&apos;s email</label>
          <input id="s-email" type="email" className="input" value={form.email} onChange={set('email')} maxLength={255} />
          <span className="hint">If this matches a TYM account, their chat with the mentor opens straight away.</span>
        </div>
        <div className="field">
          <label htmlFor="s-wa">WhatsApp <span className="faint">Optional</span></label>
          <input id="s-wa" className="input" value={form.whatsapp} onChange={set('whatsapp')} maxLength={30} />
        </div>
        <div className="field">
          <label htmlFor="s-mentor">Mentor</label>
          <select id="s-mentor" className="select" value={form.mentorId} onChange={set('mentorId')}>
            <option value="">Choose a mentor</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.displayName} · {m.community?.country?.name} · {m.sessionMinutes} min
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="s-plan">Hours they bought</label>
          <select id="s-plan" className="select" value={form.packageId} onChange={set('packageId')}>
            <option value="">Not set</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <When id="s" date={form.date} time={form.time} minutes={form.minutes}
          onChange={(w) => setForm({ ...form, ...w })} />
        <div className="field adm-wide">
          <label htmlFor="s-note">How they paid <span className="faint">Optional</span></label>
          <input id="s-note" className="input" value={form.note} onChange={set('note')} maxLength={500}
            placeholder="Paid ₹4,000 by UPI." />
          <span className="hint">The date, the time and this line all go into both emails.</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="s-msg">What they want to cover <span className="faint">Optional</span></label>
        <textarea id="s-msg" className="textarea" rows={3} value={form.message} onChange={set('message')} maxLength={2000} />
      </div>
      <FormError>{error}</FormError>
      <div className="adm-action-row">
        <button className="btn btn-primary btn-sm" disabled={busy || !ready}>
          {busy ? <Spinner /> : 'Book it and tell them both'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

// One mentor and student conversation, read only. The team opens these for a complaint, a refund
// or a safeguarding worry, and can keep a copy. Nobody on the team can write into it.
function Chat({ c, onBack }) {
  const { data, error } = useAdminApi(`/admin/mentor-chats/${c.mentorId}/${c.studentId}`)
  if (error) return <Empty title="We could not open this conversation" text={error.message} />
  if (!data) return <Loading what="the conversation" />
  const nameOf = (m) => (m.kind === 'system' ? 'The Youth Matters'
    : m.authorId === data.student.id ? data.student.displayName : data.mentor.displayName)
  const save = () => saveTranscript({
    title: `${data.mentor.displayName} and ${data.student.displayName}`,
    subtitle: 'A mentor and student conversation on The Youth Matters',
    messages: data.messages.map((m) => ({ who: nameOf(m), at: m.createdAt, body: m.body, note: m.kind === 'system' })),
  })

  return (
    <>
      <div className="adm-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={15} /> All conversations</button>
        <button className="btn btn-ghost btn-sm" onClick={save} disabled={!data.messages.length}>
          <Download size={15} /> Save as PDF
        </button>
      </div>
      <div className="adm-account">
        <Person user={data.mentor} sub="Mentor" size={44} />
        <Person user={data.student} sub="Student" size={44} />
      </div>
      {data.messages.length === 0 ? <Empty title="Nothing said yet" text="This conversation is open but empty." /> : (
        <ol className="adm-msgs adm-msgs-flat">
          {data.messages.map((m) => (
            <li key={m.id} className={`adm-msg is-${m.authorId === data.student.id ? 'user' : 'human'}`}>
              <p className="adm-msg-who">{nameOf(m)}<time dateTime={m.createdAt}>{ago(m.createdAt)}</time></p>
              <p className="adm-bubble">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

// Every mentor and student conversation, newest first
function Chats() {
  const list = useAdminApi('/admin/mentor-chats')
  const [open, setOpen] = useState(null)
  if (open) return <Chat c={open} onBack={() => setOpen(null)} />
  if (list.error) return <Empty title="We could not load the conversations" text={list.error.message} />
  if (!list.data) return <Loading what="conversations" />
  if (!list.data.length) {
    return <Empty title="No conversations yet" text="When you confirm a session, the mentor and the student get a private chat and it appears here." />
  }
  return (
    <>
      <ul className="adm-list">
        {list.data.map((c) => (
          <li key={`${c.mentorId}-${c.studentId}`}>
            <button className="adm-row adm-member" onClick={() => setOpen(c)}>
              <Person user={c.student} sub={`with ${c.mentor.displayName}`} />
              <span className="adm-cell adm-cell-wide">{c.preview || 'No messages yet'}</span>
              <span className="adm-cell">{c.messages} message{c.messages === 1 ? '' : 's'}</span>
              <time className="adm-cell adm-cell-time" dateTime={c.lastAt || ''}>{c.lastAt ? ago(c.lastAt) : 'Never used'}</time>
            </button>
          </li>
        ))}
      </ul>
      <p className="adm-hint">Read only. Open one to read it or save it as a PDF; the team cannot write into someone else&apos;s chat.</p>
    </>
  )
}

export default function Sessions({ onChanged }) {
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const list = useAdminApi(status === 'chats' ? null : `/admin/session-requests?status=${status}&page=${page}`)
  const { data: mentors } = useApi('/mentors')
  const { data: plans } = useApi('/packages')
  const rows = list.data?.items || []
  const done = () => { list.reload(); onChanged?.() }

  return (
    <>
      <PageHead eyebrow="Sessions" title="Mentorship sessions to arrange"
        text="Every session asked for through the booking form. Agree a time and payment with the student first, then assign the mentor: that books it, emails both of them and opens their private chat on the site." />
      <div className="adm-toolbar">
        <Tabs label="Which requests" value={status} onChange={(s) => { setStatus(s); setPage(1) }}
          items={[['open', 'To arrange', list.data?.waiting], ['confirmed', 'Confirmed'], ['cancelled', 'Closed'],
            ['chats', 'Mentor and student chats']]} />
        {status !== 'chats' && <NewSession mentors={mentors || []} plans={plans || []} onAdded={done} />}
      </div>
      {status === 'chats' ? <Chats />
        : list.error ? <Empty title="We could not load the sessions" text={list.error.message} />
        : !list.data ? <Loading what="session requests" />
          : rows.length === 0 ? (
            <Empty title={status === 'open' ? 'Nothing to arrange' : 'Nothing here yet'}
              text={status === 'open'
                ? 'You are up to date. Requests from the booking form arrive here, and you can book one yourself with the button above.'
                : 'Sessions you have confirmed or closed are kept here.'}>
              {status === 'open' && (
                <a href="/book-a-session" target="_blank" rel="noreferrer" className="adm-more">
                  <MessageSquare size={14} aria-hidden /> See the booking form on the site
                </a>
              )}
            </Empty>
          ) : (
            <ul className="adm-list">
              {rows.map((r) => <Row key={r.id} r={r} mentors={mentors || []} onChanged={done} />)}
            </ul>
          )}
      {status !== 'chats' && <Pager page={page} hasMore={list.data?.hasMore} onPage={setPage} />}
    </>
  )
}
