import { useState } from 'react'
import { Plus } from 'lucide-react'
import { FormError, SubmitButton } from '../../components/auth/fields'
import { adminApi, useAdmin, useAdminApi } from '../../lib/admin'
import { Confirm, Empty, Loading, PageHead, PasswordBox, Person, Pill, Sheet, ago, newPassword } from './ui'

// Three ways to choose what someone can open. "Custom" shows the list of parts to tick.
const PRESETS = [
  ['support', 'Support only', 'They can reply to students in Ask TYM AI and answer contact form enquiries. Nothing else.'],
  ['all', 'Everything', 'Every part of the panel, including this Team page.'],
  ['custom', 'Choose the parts', 'Tick exactly what they can open.'],
]

function AccessPicker({ areas, value, onChange }) {
  const all = areas.map((a) => a.key)
  const preset = value.length === all.length ? 'all' : value.length === 1 && value[0] === 'support' ? 'support' : 'custom'
  const [custom, setCustom] = useState(preset === 'custom')
  const shown = custom ? 'custom' : preset
  const pick = (key) => {
    setCustom(key === 'custom')
    if (key === 'all') onChange(all)
    if (key === 'support') onChange(['support'])
  }
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])

  return (
    <fieldset className="adm-access">
      <legend>What they can open</legend>
      {PRESETS.map(([key, label, about]) => (
        <label key={key} className={`adm-choice${shown === key ? ' is-on' : ''}`}>
          <input type="radio" name="preset" checked={shown === key} onChange={() => pick(key)} />
          <span><strong>{label}</strong><span>{about}</span></span>
        </label>
      ))}
      {shown === 'custom' && (
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
function Teammate({ person, areas, onClose, onSaved }) {
  const adding = !person
  const [name, setName] = useState(person?.name || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(adding ? newPassword() : '')
  const [access, setAccess] = useState(person?.access || ['support'])
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
            <input id="tm-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="sam@theyouthmatters.org" />
            <span className="hint">They sign in with this. Reply and waiting-student emails also go here.</span>
          </div>
        )}
        <PasswordBox id="tm-pass" label={adding ? 'Starting password' : 'New password'} required={adding} value={password} onChange={setPassword}
          hint={adding ? 'Give this to them yourself. We do not email passwords. They can change it after signing in.' : 'Leave empty to keep their current password.'} />
        <AccessPicker areas={areas} value={access} onChange={setAccess} />
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Saving" disabled={!access.length}>{adding ? 'Add to the team' : 'Save changes'}</SubmitButton>
      </form>
    </Sheet>
  )
}

// Which outside services are connected, so "why did no email arrive?" has an answer on the page
function Setup() {
  const { data } = useAdminApi('/admin/setup')
  if (!data) return null
  return (
    <section className="adm-setup" aria-labelledby="setup-title">
      <h2 id="setup-title" className="adm-h2">What is switched on</h2>
      <ul className="adm-list">
        {data.map((s) => (
          <li key={s.name} className="adm-row adm-setting">
            <div className="adm-question-text">
              <strong>{s.name}</strong>
              <span>{s.on ? s.when_on : s.when_off}</span>
            </div>
            <span className="adm-row-actions">
              {!s.on && <span className="adm-cell mono">{s.setting}</span>}
              <Pill tone={s.on ? 'solid' : 'muted'}>{s.on ? 'On' : 'Off'}</Pill>
            </span>
          </li>
        ))}
      </ul>
      <p className="adm-hint">These are set in the <code>.env</code> file on the server. Add the value named beside anything that is off, then restart.</p>
    </section>
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
  const { people, areas } = list.data
  const label = Object.fromEntries(areas.map((a) => [a.key, a.label]))

  return (
    <>
      <PageHead eyebrow="Team" title="Who can use this panel" text="Add the people who help run TYM and choose what each of them can open. Someone who only answers students needs Support chat and nothing else.">
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
              {p.isOwner ? <Pill tone="solid">Owner</Pill>
                : p.fullAccess ? <Pill>Everything</Pill>
                  : p.access.length ? p.access.map((k) => <Pill key={k} tone="muted">{label[k]}</Pill>)
                    : <Pill tone="warn">No access to the panel</Pill>}
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
      <p className="adm-hint">The owner is the account named in <code>ADMIN_EMAIL</code> on the server. It always has everything and cannot be removed here.</p>

      <Setup />

      {editing !== undefined && (
        <Teammate person={editing} areas={areas} onClose={() => setEditing(undefined)}
          onSaved={(created) => { setEditing(undefined); setAdded(created); list.reload() }} />
      )}
    </>
  )
}
