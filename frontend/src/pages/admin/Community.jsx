import { useRef, useState } from 'react'
import { ArrowUpRight, ImagePlus, Pin, Plus } from 'lucide-react'
import { FormError, Spinner, SubmitButton } from '../../components/auth/fields'
import { adminApi, adminClient, useAdminApi } from '../../lib/admin'
import { cityPhoto } from '../../components/ui/Photo'
import { plural } from '../../lib/format'
import { Confirm, Empty, Loading, PageHead, Pager, Person, Pill, SearchBox, Sheet, Tabs, ago, useDebounced } from './ui'

// A small on/off control, for things that are either live on the site or not
function Switch({ on, label, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`adm-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <i />
    </button>
  )
}

function Questions() {
  const [filter, setFilter] = useState('live')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
  const q = useDebounced(term)
  const list = useAdminApi(`/admin/questions?filter=${filter}&q=${encodeURIComponent(q)}&page=${page}`)
  const rows = list.data?.items || []
  const choose = (set) => (v) => { set(v); setPage(1) }

  const change = async (p, body) => {
    setError('')
    try {
      await adminApi(`/admin/questions/${p.id}`, { method: 'POST', body })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="adm-toolbar">
        <Tabs label="Which questions" value={filter} onChange={choose(setFilter)}
          items={[['live', 'On the site'], ['pinned', 'Pinned'], ['unanswered', 'No answer yet'], ['removed', 'Removed']]} />
        <SearchBox value={term} onChange={choose(setTerm)} placeholder="Search questions" />
      </div>
      <FormError>{error}</FormError>
      {list.error ? <Empty title="We could not load questions" text={list.error.message} />
        : !list.data ? <Loading what="questions" />
          : rows.length === 0 ? <Empty title="Nothing here" text={q ? `No question matches "${q}".` : 'There are no questions in this group.'} />
            : (
              <ul className="adm-list">
                {rows.map((p) => (
                  <li key={p.id} className="adm-row adm-question">
                    <div className="adm-question-text">
                      <strong>{p.pinned && <Pin size={13} aria-label="Pinned" />} <button className="adm-title-link" onClick={() => setOpen(p.id)}>{p.title}</button></strong>
                      <span>{p.author.displayName} · {p.country}{p.topic ? ` · ${p.topic}` : ''} · {plural(p.answers, 'answer')} · {p.score} points · {ago(p.at)}</span>
                    </div>
                    <span className="adm-row-actions">
                      {p.removed ? (
                        <>
                          <Pill tone="warn">Removed</Pill>
                          <Confirm label="Put back" question="Show it on the site again?" className="btn-text" onConfirm={() => change(p, { removed: false })} />
                        </>
                      ) : (
                        <>
                          <button className="btn-text" onClick={() => change(p, { pinned: !p.pinned })}>{p.pinned ? 'Unpin' : 'Pin to top'}</button>
                          <Confirm label="Remove" question="Take it off the site?" danger className="btn-text" onConfirm={() => change(p, { removed: true })} />
                          <a href={`/p/${p.id}`} target="_blank" rel="noreferrer" className="adm-icon" aria-label="Open on the site"><ArrowUpRight size={16} /></a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
      <Pager page={page} hasMore={list.data?.hasMore} onPage={setPage} />
      {open && <Question id={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  )
}

// The whole question and everything under it, so one bad answer can go without removing the rest
function Question({ id, onClose, onChanged }) {
  const { data: p, error, reload } = useAdminApi(`/admin/questions/${id}`)
  const remove = async (a) => {
    await adminApi(`/admin/answers/${a.id}`, { method: 'DELETE' })
    reload()
    onChanged()
  }
  if (error) return <Sheet title="Question" onClose={onClose}><p className="adm-note">{error.message}</p></Sheet>
  if (!p) return <Sheet title="Question" onClose={onClose}><Loading what="the question" /></Sheet>
  return (
    <Sheet title={p.title} onClose={onClose} wide>
      <div className="adm-account">
        <Person user={p.author} sub={`@${p.author.username}`} size={48} />
        {p.removed && <div className="adm-account-pills"><Pill tone="warn">Removed</Pill></div>}
      </div>
      <p className="adm-prose">{p.body || 'They asked the question in the title and added nothing more.'}</p>
      <section>
        <h3 className="adm-h2">{p.answers.length ? plural(p.answers.length, 'answer or reply', 'answers and replies') : 'Answers'}</h3>
        {p.answers.length === 0 ? <p className="adm-note">Nobody has answered yet.</p> : (
          <ul className="adm-plain adm-room-log">
            {p.answers.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>{a.author.displayName}</strong> <span className="faint">{a.reply ? 'reply · ' : ''}{a.score} points · {ago(a.at)}</span><br />
                  {a.removed ? <s>{a.body}</s> : a.body}
                </span>
                {a.removed ? <Pill tone="muted">Removed</Pill>
                  : <Confirm label="Remove" question="Remove it?" danger className="btn-text" onConfirm={() => remove(a)} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Sheet>
  )
}

// A room's latest messages, with the room's name and description above them
function Room({ room, onClose, onChanged }) {
  const messages = useAdminApi(`/admin/chat/rooms/${room.id}/messages`)
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi(`/admin/chat/rooms/${room.id}`, { method: 'PATCH', body: { name, description } })
      setSaved(true)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (m) => {
    await adminApi(`/admin/chat/messages/${m.id}`, { method: 'DELETE' })
    messages.reload()
    onChanged()
  }
  const removeRoom = async () => {
    setError('')
    try {
      await adminApi(`/admin/chat/rooms/${room.id}`, { method: 'DELETE' })
      onChanged()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Sheet title={`# ${room.name}`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="field"><label htmlFor="room-name">Room name</label><input id="room-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} required maxLength={80} /></div>
        <div className="field"><label htmlFor="room-about">What it is for</label><input id="room-about" className="input" value={description} onChange={(e) => { setDescription(e.target.value); setSaved(false) }} maxLength={255} /></div>
        <FormError>{error}</FormError>
        {saved && <p className="adm-ok" role="status">Saved.</p>}
        <SubmitButton busy={busy} busyText="Saving">Save</SubmitButton>
      </form>
      <section>
        <h3 className="adm-h2">Latest messages</h3>
        {!messages.data ? <Loading what="messages" />
          : messages.data.length === 0 ? <p className="adm-note">Nobody has written in this room yet.</p>
            : (
              <ul className="adm-plain adm-room-log">
                {messages.data.map((m) => (
                  <li key={m.id}>
                    <span><strong>{m.author.displayName}</strong> <span className="faint">{ago(m.at)}</span><br />{m.body}</span>
                    <Confirm label="Delete" question="Delete it?" danger className="btn-text" onConfirm={() => remove(m)} />
                  </li>
                ))}
              </ul>
            )}
      </section>
      <section className="adm-actions">
        <h3 className="adm-h2">Delete this room</h3>
        <div className="adm-action">
          <p>The room and every message in it go for good. To take it off the site and keep the messages, close it instead.</p>
          <div className="adm-action-row"><Confirm label="Delete room" question="Delete the room and its messages?" yes="Delete for good" danger onConfirm={removeRoom} /></div>
        </div>
      </section>
    </Sheet>
  )
}

function Rooms() {
  const list = useAdminApi('/admin/chat/rooms')
  const [open, setOpen] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const add = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await adminApi('/admin/chat/rooms', { method: 'POST', body: { name } })
      setName('')
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  const toggle = async (r, isActive) => {
    setError('')
    try {
      await adminApi(`/admin/chat/rooms/${r.id}`, { method: 'PATCH', body: { isActive } })
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }
  if (list.error) return <Empty title="We could not load chat rooms" text={list.error.message} />
  if (!list.data) return <Loading what="chat rooms" />
  return (
    <>
      <form className="adm-inline-form" onSubmit={add}>
        <label htmlFor="room-new" className="visually-hidden">New room</label>
        <input id="room-new" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="A new room, for example September 2027 intake" maxLength={80} required minLength={2} />
        <button className="btn btn-primary"><Plus size={15} /> Add room</button>
      </form>
      <FormError>{error}</FormError>
      <ul className="adm-list">
        {list.data.map((r) => (
          <li key={r.id} className="adm-row adm-setting">
            <div className="adm-question-text">
              <strong># {r.name}</strong>
              <span>{r.description || 'No description'} · {plural(r.messages, 'message')}</span>
            </div>
            <span className="adm-row-actions">
              <button className="btn-text" onClick={() => setOpen(r)}>Manage</button>
              <span className="adm-switch-label">{r.isActive ? 'Open' : 'Closed'}</span>
              <Switch on={r.isActive} label={`${r.name} is open`} onChange={(v) => toggle(r, v)} />
            </span>
          </li>
        ))}
      </ul>
      <p className="adm-hint">A closed room disappears from the site. Its messages are kept and come back when you open it again. Manage a room to rename it, read it, or delete it.</p>
      {open && <Room room={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  )
}

function Topics() {
  const list = useAdminApi('/admin/topics')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const run = async (path, method, body) => {
    setError('')
    try {
      await adminApi(path, { method, body })
      list.reload()
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }
  const add = async (e) => {
    e.preventDefault()
    if (await run('/admin/topics', 'POST', { name })) setName('')
  }

  if (list.error) return <Empty title="We could not load topics" text={list.error.message} />
  if (!list.data) return <Loading what="topics" />
  return (
    <>
      <form className="adm-inline-form" onSubmit={add}>
        <label htmlFor="topic-new" className="visually-hidden">New topic</label>
        <input id="topic-new" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="A new topic, for example Health insurance" maxLength={80} required minLength={2} />
        <button className="btn btn-primary"><Plus size={15} /> Add topic</button>
      </form>
      <FormError>{error}</FormError>
      <ul className="adm-list">
        {list.data.map((t) => (
          <li key={t.id} className="adm-row adm-setting">
            {editing?.id === t.id ? (
              <form className="adm-inline-form" onSubmit={async (e) => { e.preventDefault(); if (await run(`/admin/topics/${t.id}`, 'PATCH', { name: editing.name })) setEditing(null) }}>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Topic name" maxLength={80} required autoFocus />
                <button className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <div className="adm-question-text"><strong>{t.name}</strong><span>{plural(t.questions, 'question')}</span></div>
                <span className="adm-row-actions">
                  <button className="btn-text" onClick={() => setEditing({ id: t.id, name: t.name })}>Rename</button>
                  {t.questions === 0 && <Confirm label="Delete" question="Delete this topic?" danger className="btn-text" onConfirm={() => run(`/admin/topics/${t.id}`, 'DELETE')} />}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="adm-hint">Students pick a topic when they ask. A topic with questions can be renamed, not deleted, so those questions keep their place.</p>
    </>
  )
}

// The country's picture, as it appears across the site. Replacing one drops the old file.
function CountryPhoto({ c, onDone }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const upload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const form = new FormData()
    form.append('image', file)
    setBusy(true)
    try {
      await adminApi(`/admin/communities/${c.id}/image`, { method: 'POST', body: form })
      onDone()
    } catch (err) {
      onDone(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button className="btn-text" onClick={() => input.current.click()} disabled={busy}>
        {busy ? <Spinner /> : <ImagePlus size={14} />} {c.image ? 'Change photo' : 'Add photo'}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
    </>
  )
}

// A new destination: the country, its community and its chat room, all from here
function NewCountry({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', isoCode: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const made = await adminApi('/admin/communities', { method: 'POST', body: { ...form, isoCode: form.isoCode.toUpperCase() } })
      setForm({ name: '', isoCode: '', description: '' })
      setOpen(false)
      onAdded(made)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <button className="btn btn-primary btn-sm adm-add-country" onClick={() => setOpen(true)}><Plus size={15} /> Add a country</button>
  return (
    <form className="adm-new-country stack" onSubmit={add}>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="co-name">Country</label>
          <input id="co-name" className="input" value={form.name} onChange={set('name')} maxLength={80} autoFocus placeholder="France" />
        </div>
        <div className="field">
          <label htmlFor="co-iso">Two-letter code</label>
          <input id="co-iso" className="input mono" value={form.isoCode} onChange={set('isoCode')} maxLength={2} placeholder="FR" />
          <span className="hint">The ISO code, like FR for France or NL for the Netherlands.</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="co-about">About this country</label>
        <input id="co-about" className="input" value={form.description} onChange={set('description')} maxLength={500}
          placeholder="Campus France, student visas and life in French universities." />
        <span className="hint">One line, shown on the community page and in the chat room.</span>
      </div>
      <FormError>{error}</FormError>
      <div className="adm-action-row">
        <SubmitButton busy={busy} busyText="Adding" style={{ width: 'auto' }} disabled={form.name.trim().length < 2 || form.isoCode.trim().length !== 2}>
          Add the country
        </SubmitButton>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="adm-hint">This creates the country, its community and its chat room. Add its photo afterwards.</p>
    </form>
  )
}

function Countries() {
  const list = useAdminApi('/admin/communities')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const change = async (c, body) => {
    setError('')
    try {
      await adminApi(`/admin/communities/${c.id}`, { method: 'PATCH', body })
      list.reload()
      setEditing(null)
    } catch (err) {
      setError(err.message)
    }
  }
  if (list.error) return <Empty title="We could not load countries" text={list.error.message} />
  if (!list.data) return <Loading what="countries" />
  return (
    <>
      <NewCountry onAdded={() => list.reload()} />
      <FormError>{error}</FormError>
      <ul className="adm-list">
        {list.data.map((c) => (
          <li key={c.id} className="adm-row adm-setting">
            {editing?.id === c.id ? (
              <form className="adm-inline-form" onSubmit={(e) => { e.preventDefault(); change(c, { description: editing.description }) }}>
                <input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} aria-label={`About ${c.country}`} maxLength={500} autoFocus />
                <button className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <Person user={{ displayName: c.country, avatar: cityPhoto({ slug: c.slug, image: c.image }) }} sub={c.description || 'No description'} />
                <span className="adm-row-actions">
                  <span className="adm-cell">{plural(c.members, 'member')} · {plural(c.questions, 'question')}</span>
                  <CountryPhoto c={c} onDone={(err) => { setError(err || ''); list.reload() }} />
                  <button className="btn-text" onClick={() => setEditing({ id: c.id, description: c.description || '' })}>Edit text</button>
                  <span className="adm-switch-label">{c.isActive ? 'Open' : 'Hidden'}</span>
                  <Switch on={c.isActive} label={`${c.country} is open`} onChange={(v) => change(c, { isActive: v })} />
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="adm-hint">Hiding a country takes its community off the site. Its questions and members are kept.
        A country without a photo of its own uses the one the website ships with, when there is one.</p>
    </>
  )
}

export default function CommunityAdmin() {
  const [tab, setTab] = useState('questions')
  return (
    <>
      <PageHead eyebrow="Community" title="What is on the site"
        text="Pin the questions worth seeing first, open any question to read it and remove a bad answer, and look after the chat rooms, topics and countries." />
      <div className="adm-toolbar">
        <Tabs label="Community" value={tab} onChange={setTab} items={[['questions', 'Questions'], ['rooms', 'Chat rooms'], ['topics', 'Topics'], ['countries', 'Countries']]} />
      </div>
      {tab === 'questions' && <Questions />}
      {tab === 'rooms' && <Rooms />}
      {tab === 'topics' && <Topics />}
      {tab === 'countries' && <Countries />}
    </>
  )
}
