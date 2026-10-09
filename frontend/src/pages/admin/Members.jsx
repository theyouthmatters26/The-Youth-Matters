import { useState } from 'react'
import { ArrowUpRight, Download, Plus } from 'lucide-react'
import { FormError, Spinner, SubmitButton } from '../../components/auth/fields'
import { hoursText } from '../../components/mentors/booking'
import { adminApi, downloadAdminFile, useAdmin, useAdminApi } from '../../lib/admin'
import { plural } from '../../lib/format'
import { Confirm, Empty, Facts, Loading, PageHead, Pager, PasswordBox, Person, Pill, SearchBox, Sheet, StatusPill, Tabs, ago, day, newPassword, useDebounced } from './ui'

const FILTERS = [['all', 'Everyone'], ['verified', 'Verified'], ['pending', 'Not verified'], ['suspended', 'Suspended'], ['mentors', 'Mentors'], ['team', 'Team']]
const ROLE = { student: 'Student', mentor: 'Mentor', admin: 'Team' }
const DOCUMENT = { passport: 'passport', driving_licence: 'driving licence', national_id: 'national ID' }
const STRIKE = { warn_and_delete: 'They were sent a warning.', mute_24h: 'They are muted for 24 hours.', suspend_pending_review: 'That was strike three: the account is suspended.' }

// An account the team makes for someone: a mentor you invited, or a student who could not sign up alone
function AddMember({ onClose, onAdded }) {
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
      const res = await adminApi('/admin/members', { method: 'POST', body: { name: f.name, email: f.email, password, dateOfBirth: f.dob || undefined } })
      setAdded({ ...res, email: f.email, password })
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (added) {
    return (
      <Sheet title="Account made" onClose={onClose}>
        <p className="adm-ok" role="status">
          Tell them to log in on the site with <strong>{added.email}</strong> and the password <strong className="mono">{added.password}</strong>. This is the only time the password is shown.
        </p>
        <p className="adm-note">
          {added.status === 'active' ? 'The account is verified, so they can take part straight away.'
            : 'The first time they log in they are asked for a photo ID, to check they are 18 or over. Until then they can read but not post.'}
        </p>
        <button className="btn btn-ghost btn-block" onClick={onClose}>Done</button>
      </Sheet>
    )
  }
  return (
    <Sheet title="Add a member" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="am-name">Full name</label>
          <input id="am-name" name="name" className="input" required minLength={2} maxLength={80} placeholder="Ananya Rao" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="am-email">Email</label>
          <input id="am-email" name="email" type="email" className="input" required placeholder="ananya@example.com" autoComplete="off" />
          <span className="hint">They log in with this. We email them to say the account is ready.</span>
        </div>
        <PasswordBox id="am-pass" label="Starting password" required value={password} onChange={setPassword}
          hint="Give this to them yourself. We do not email passwords. They can change it after logging in." />
        <div className="field">
          <label htmlFor="am-dob">Date of birth <span className="faint">Optional</span></label>
          <input id="am-dob" name="dob" type="date" className="input" />
          <span className="hint">Only if you have seen their ID. The account is then verified straight away. Leave it empty and they do the age check themselves.</span>
        </div>
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Adding">Add member</SubmitButton>
      </form>
    </Sheet>
  )
}

// Fix a name or an email, or set a new password for someone who is locked out
function EditMember({ m, onSaved }) {
  const [name, setName] = useState(m.displayName)
  const [email, setEmail] = useState(m.email)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setDone('')
    try {
      await adminApi(`/admin/members/${m.id}`, { method: 'PATCH', body: { name, email, ...(password ? { password } : {}) } })
      setDone(password ? `Saved. Their new password is ${password}. Tell them yourself: it is not emailed.` : 'Saved.')
      setPassword('')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="adm-action" onSubmit={save}>
      <p><strong>Edit their details.</strong> Fix a name or an email, or set a new password for someone who is locked out.</p>
      <div className="field">
        <label htmlFor="em-name">Name</label>
        <input id="em-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="em-email">Email</label>
        <input id="em-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <PasswordBox id="em-pass" label="New password" value={password} onChange={setPassword} hint="Leave empty to keep their current password." />
      <FormError>{error}</FormError>
      {done && <p className="adm-ok" role="status">{done}</p>}
      <button className="btn btn-primary btn-sm adm-account-save" disabled={busy}>{busy ? <Spinner /> : 'Save changes'}</button>
    </form>
  )
}

// One person: who they are, how they were verified, and what a moderator can do about them
function Member({ id, onClose, onChanged }) {
  const { can } = useAdmin()
  const { data: m, error, reload } = useAdminApi(`/admin/members/${id}`)
  const [reason, setReason] = useState('')
  const [dob, setDob] = useState('')
  const [hours, setHours] = useState('')
  const [problem, setProblem] = useState('')
  const [said, setSaid] = useState('')

  const act = async (path, body, done) => {
    setProblem('')
    setSaid('')
    try {
      const res = await adminApi(`/admin/members/${id}/${path}`, { method: 'POST', body })
      setSaid(done(res))
      setReason('')
      reload()
      onChanged()
    } catch (err) {
      setProblem(err.message)
    }
  }
  const removePost = async (postId) => {
    await adminApi(`/admin/content/post/${postId}`, { method: 'DELETE' })
    reload()
  }
  const [kept, setKept] = useState('')
  const deleteAccount = async () => {
    setKept('')
    try {
      await adminApi(`/admin/members/${id}`, { method: 'DELETE' })
      onChanged()
      onClose()
    } catch (err) {
      setKept(err.message)
    }
  }

  if (error) return <Sheet title="Member" onClose={onClose}><p className="adm-note">{error.message}</p></Sheet>
  if (!m) return <Sheet title="Member" onClose={onClose}><Loading what="this member" /></Sheet>

  const v = m.verification
  const blocked = m.status === 'suspended' || m.status === 'banned'
  const needsReason = reason.trim().length < 5
  return (
    <Sheet title={m.displayName} onClose={onClose}>
      <div className="adm-account">
        <Person user={m} sub={`@${m.username}`} size={56} />
        <div className="adm-account-pills"><StatusPill status={m.status} /><Pill tone="muted">{ROLE[m.role]}</Pill></div>
      </div>

      <Facts items={[
        ['Email', <>{m.email} {m.emailVerified ? '' : <Pill tone="muted">not confirmed</Pill>}</>],
        ['Signs in with', m.google ? 'Google' : 'Email and password'],
        ['Joined', day(m.joinedAt)],
        ['Last seen', ago(m.lastSeenAt)],
        ['Age check', m.age ? `${m.age} years old${v?.documentType ? `, read from their ${DOCUMENT[v.documentType]}` : ''}${v?.note ? `. ${v.note}` : ''}` : 'Not done yet'],
        ['Heading to', m.country],
        ['Studying', [m.course, m.university].filter(Boolean).join(', ')],
        ['Starts', m.intake],
        ['Activity', `${plural(m.counts.questions, 'question')}, ${plural(m.counts.answers, 'answer')}, ${plural(m.counts.sessions, 'mentor session')}`],
        ['Counselling hours', hoursText(m.counselingMinutes)],
        ['Muted until', m.mutedUntil && new Date(m.mutedUntil).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })],
        ['Open reports', m.counts.openReports || null],
      ]} />
      {m.bio && <p className="adm-quote">{m.bio}</p>}
      <a href={`/u/${m.username}`} target="_blank" rel="noreferrer" className="adm-more">Open their profile on the site <ArrowUpRight size={14} aria-hidden /></a>

      {m.canAct ? (
        <section className="adm-actions" aria-label="Actions">
          <h3 className="adm-h2">Actions</h3>
          {can('bookings') && (
            <div className="adm-action">
              <p><strong>Counselling hours.</strong> They have {hoursText(m.counselingMinutes)}. Add time as a goodwill gesture or for a payment taken outside the site, or take some away with a minus number.</p>
              <div className="adm-action-row">
                <input type="number" className="input" step="0.5" min={-100} max={100} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours, for example 1 or -0.5" aria-label="Hours to add or take away" />
                <button className="btn btn-primary btn-sm" disabled={!Number(hours) || needsReason}
                  onClick={() => act('hours', { minutes: Math.round(Number(hours) * 60), reason }, (res) => { setHours(''); return `Done. They now have ${hoursText(res.counselingMinutes)}.` })}>
                  {Number(hours) < 0 ? 'Take away' : 'Add hours'}
                </button>
              </div>
              <p className="adm-hint">Write the reason in the box below first. It is kept in the activity log.</p>
            </div>
          )}
          {m.status === 'pending' && (
            <div className="adm-action">
              <p><strong>Verify by hand.</strong> Only after you have seen their ID another way, for example by email. Enter the date of birth on it.</p>
              <div className="adm-action-row">
                <input type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} aria-label="Date of birth on their ID" />
                <button className="btn btn-primary btn-sm" disabled={!dob} onClick={() => act('verify', { dateOfBirth: dob }, () => 'Verified. They can take part now.')}>Verify</button>
              </div>
            </div>
          )}
          {blocked ? (
            <div className="adm-action">
              <p><strong>Reinstate.</strong> Lets them sign in and take part again.</p>
              <Confirm label="Reinstate account" question="Reinstate this account?" className="btn btn-primary btn-sm"
                onConfirm={() => act('status', { status: 'active' }, () => 'The account is reinstated.')} />
            </div>
          ) : (
            <div className="adm-action">
              <label htmlFor="mem-reason"><strong>Reason.</strong> The member is told this, so write it for them.</label>
              <input id="mem-reason" className="input" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="For example: repeated spam links in answers" />
              <div className="adm-action-row">
                <button className="btn btn-ghost btn-sm" disabled={needsReason} onClick={() => act('strike', { reason }, (r) => `Strike recorded. ${STRIKE[r.outcome]}`)}>Give a strike</button>
                <Confirm label="Suspend" question="Suspend this account?" danger disabled={needsReason}
                  onConfirm={() => act('status', { status: 'suspended', reason }, () => 'The account is suspended and they have been emailed.')} />
                <Confirm label="Ban" question="Ban for good?" danger disabled={needsReason}
                  onConfirm={() => act('status', { status: 'banned', reason }, () => 'The account is banned and they have been emailed.')} />
              </div>
              <p className="adm-hint">Strikes go: a warning, then a 24 hour mute, then suspension.</p>
            </div>
          )}
          <FormError>{problem}</FormError>
          {said && <p className="adm-ok" role="status">{said}</p>}

          <h3 className="adm-h2">Their account</h3>
          <EditMember m={m} onSaved={() => { reload(); onChanged() }} />
          {m.role !== 'admin' && (
            <div className="adm-action">
              <p><strong>Delete the account.</strong> Erases their profile, questions, answers and chat messages for good. An account with sessions or payments cannot be deleted, because those records have to be kept: ban it instead.</p>
              <div className="adm-action-row"><Confirm label="Delete account" question="Delete this account and everything they posted?" yes="Delete for good" danger onConfirm={deleteAccount} /></div>
              <FormError>{kept}</FormError>
            </div>
          )}
        </section>
      ) : <p className="adm-note">{m.role === 'admin' ? 'Team accounts are managed from the Team page.' : 'This account cannot be changed here.'}</p>}

      {m.strikes.length > 0 && (
        <section>
          <h3 className="adm-h2">Strikes</h3>
          <ul className="adm-plain">
            {m.strikes.map((k) => <li key={k.at}><span><strong>Strike {k.level}</strong> {k.reason}</span><time dateTime={k.at}>{ago(k.at)}</time></li>)}
          </ul>
        </section>
      )}

      {m.recentPosts.length > 0 && (
        <section>
          <h3 className="adm-h2">Latest questions</h3>
          <ul className="adm-plain">
            {m.recentPosts.map((p) => (
              <li key={p.id}>
                <span>{p.removed ? <s>{p.title}</s> : <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">{p.title}</a>}</span>
                {p.removed ? <Pill tone="muted">Removed</Pill>
                  : can('moderation') && <Confirm label="Remove" question="Remove it?" danger className="btn-text" onConfirm={() => removePost(p.id)} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  )
}

export default function Members() {
  const [filter, setFilter] = useState('all')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const q = useDebounced(term)
  const list = useAdminApi(`/admin/members?filter=${filter}&q=${encodeURIComponent(q)}&page=${page}`)
  const rows = list.data?.items || []
  const choose = (set) => (value) => { set(value); setPage(1) }
  const download = () => { setError(''); downloadAdminFile('/admin/members.csv', 'tym-members.csv').catch((err) => setError(err.message)) }

  return (
    <>
      <PageHead eyebrow="Members" title="Everyone on TYM" text="Look someone up to see how they were verified and what they have posted. Add an account, edit it, warn, suspend or delete it.">
        <button className="btn btn-ghost" onClick={download}><Download size={15} /> Download as a spreadsheet</button>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add a member</button>
      </PageHead>
      <div className="adm-toolbar">
        <Tabs label="Which members" value={filter} onChange={choose(setFilter)} items={FILTERS} />
        <SearchBox value={term} onChange={choose(setTerm)} placeholder="Search by name, username or email" />
      </div>
      <FormError>{error}</FormError>

      {list.error ? <Empty title="We could not load members" text={list.error.message} />
        : !list.data ? <Loading what="members" />
          : rows.length === 0 ? <Empty title="Nobody matches" text={q ? `No member matches "${q}".` : 'There is nobody in this group yet.'} />
            : (
              <ul className="adm-list">
                {rows.map((u) => (
                  <li key={u.id}>
                    <button className="adm-row adm-member" onClick={() => setOpen(u.id)}>
                      <Person user={u} sub={`@${u.username}`} />
                      <span className="adm-cell adm-cell-wide">{u.email}</span>
                      <span className="adm-cell adm-cell-drop">{ROLE[u.role]}{u.country ? ` · ${u.country}` : ''}</span>
                      <StatusPill status={u.status} />
                      <time className="adm-cell adm-cell-time" dateTime={u.joinedAt}>Joined {ago(u.joinedAt)}</time>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      <Pager page={page} hasMore={list.data?.hasMore} onPage={setPage} />
      {open && <Member id={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
      {adding && <AddMember onClose={() => setAdding(false)} onAdded={list.reload} />}
    </>
  )
}
