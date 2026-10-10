import { useState } from 'react'
import { Plus } from 'lucide-react'
import { FormError, SubmitButton } from '../../components/auth/fields'
import { adminApi, useAdmin, useAdminApi } from '../../lib/admin'
import { Confirm, Empty, Loading, PageHead, PasswordBox, Person, Pill, Sheet, ago, newPassword } from './ui'

const CUSTOM = { key: 'custom', label: 'Choose the parts yourself', about: 'Tick exactly what they can open.' }

// Which role this set of areas is, or 'custom'. The server decides the same way; this keeps the
// radio button in step while the owner is still ticking boxes.
const roleOf = (roles, value) => roles.find((r) => r.areas.length === value.length
  && r.areas.every((a) => value.includes(a)))?.key || CUSTOM.key

// Super admin, Admin, Mentor admin, Support, or exactly the parts you tick.
function AccessPicker({ roles, areas, value, onChange }) {
  const [custom, setCustom] = useState(() => roleOf(roles, value) === CUSTOM.key)
  const shown = custom ? CUSTOM.key : roleOf(roles, value)
  const pick = (role) => {
    setCustom(role.key === CUSTOM.key)
    if (role.areas) onChange(role.areas)
  }
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])

  return (
    <fieldset className="adm-access">
      <legend>Their role</legend>
      {[...roles, CUSTOM].map((role) => (
        <label key={role.key} className={`adm-choice${shown === role.key ? ' is-on' : ''}`}>
          <input type="radio" name="role" checked={shown === role.key} onChange={() => pick(role)} />
          <span><strong>{role.label}</strong><span>{role.about}</span></span>
        </label>
      ))}
      {shown === CUSTOM.key && (
        <div className="adm-access-list">
          {areas.map((a) => (
            <label key={a.key} className="check">
              <input type="checkbox" checked={value.includes(a.key)} onChange={() => toggle(a.key)} />
              <span><strong>{a.label}.</strong> {a.about}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

// Add someone, or change what an existing teammate can open
function Teammate({ person, roles, areas, onClose, onSaved }) {
  const adding = !person
  const [name, setName] = useState(person?.name || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(adding ? newPassword() : '')
  const [access, setAccess] = useState(person?.access || roles.find((r) => r.key === 'support')?.areas || ['support'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (adding) await adminApi('/admin/team', { method: 'POST', body: { name, email, password, access } })
      else await adminApi(`/admin/team/${person.id}`, { method: 'PATCH', body: { name, access, ...(password ? { password } : {}) } })
      onSaved(adding ? { email, password } : null)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Sheet title={adding ? 'Add a teammate' : `Change ${person.name}`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="field">
          <label htmlFor="tm-name">Name</label>
          <input id="tm-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} placeholder="Sam Support" />
        </div>
        {adding && (
          <div className="field">
            <label htmlFor="tm-email">Email</label>
            <input id="tm-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="sam@theyouthmatters.com" />
            <span className="hint">They sign in with this. Reply and waiting-student emails also go here.</span>
          </div>
        )}
        <PasswordBox id="tm-pass" label={adding ? 'Starting password' : 'New password'} required={adding} value={password} onChange={setPassword}
          hint={adding ? 'Give this to them yourself. We do not email passwords. They can change it after signing in.' : 'Leave empty to keep their current password.'} />
        <AccessPicker roles={roles} areas={areas} value={access} onChange={setAccess} />
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Saving" disabled={!access.length}>{adding ? 'Add to the team' : 'Save changes'}</SubmitButton>
      </form>
    </Sheet>
  )
}

export default function Team() {
  const { admin } = useAdmin()
  const list = useAdminApi('/admin/team')
  const [editing, setEditing] = useState(undefined) // undefined: closed, null: adding, object: changing
  const [added, setAdded] = useState(null)
  const [error, setError] = useState('')

  const remove = async (p) => {
    setError('')
    try {
      await adminApi(`/admin/team/${p.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  if (list.error) return <Empty title="We could not load the team" text={list.error.message} />
  if (!list.data) return <Loading what="the team" />
  const { people, areas, roles } = list.data
  const roleName = Object.fromEntries(roles.map((r) => [r.key, r.label]))
  const label = Object.fromEntries(areas.map((a) => [a.key, a.label]))

  return (
    <>
      <PageHead eyebrow="Team" title="Who can use this panel" text="Add the people who help run TYM and give each of them a role. A super admin can do everything, an admin runs the site but cannot change the team, a mentor admin looks after mentors and their sessions, and support only answers students.">
        <button className="btn btn-primary" onClick={() => { setAdded(null); setEditing(null) }}><Plus size={16} /> Add a teammate</button>
      </PageHead>

      {added && (
        <p className="adm-ok adm-added" role="status">
          Added. Send them the sign-in page <strong>{window.location.origin}/admin/login</strong>, their email <strong>{added.email}</strong> and
          the starting password <strong className="mono">{added.password}</strong>. This is the only time the password is shown.
        </p>
      )}
      <FormError>{error}</FormError>

      <ul className="adm-list">
        {people.map((p) => (
          <li key={p.id} className="adm-row adm-teammate">
            <Person user={{ displayName: p.name, avatar: p.avatar }} sub={p.email} />
            <span className="adm-chips">
              {p.isOwner ? <Pill tone="solid">Owner · Super admin</Pill>
                : !p.access.length ? <Pill tone="warn">No access to the panel</Pill>
                  : p.role !== 'custom' ? <Pill tone={p.fullAccess ? 'solid' : 'line'}>{roleName[p.role]}</Pill>
                    : p.access.map((k) => <Pill key={k} tone="muted">{label[k]}</Pill>)}
            </span>
            <span className="adm-cell adm-cell-time">Seen {ago(p.lastSeenAt)}</span>
            <span className="adm-row-actions">
              {p.isOwner || p.id === admin.id ? <span className="faint">{p.id === admin.id ? 'You' : ''}</span> : (
                <>
                  <button className="btn-text" onClick={() => { setAdded(null); setEditing(p) }}>Change</button>
                  <Confirm label="Remove" question={`Remove ${p.name.split(' ')[0]}?`} danger className="btn-text" onConfirm={() => remove(p)} />
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="adm-hint">The owner is the account named in <code>ADMIN_EMAIL</code> on the server. It is always a super admin and cannot be removed here.</p>

      {editing !== undefined && (
        <Teammate person={editing} roles={roles} areas={areas} onClose={() => setEditing(undefined)}
          onSaved={(created) => { setEditing(undefined); setAdded(created); list.reload() }} />
      )}
    </>
  )
}
