import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { fileToJpeg } from '../auth/camera'
import { FormError, Spinner } from '../auth/fields'
import { categories, countries } from '../../data/sample'
import { api, useApi } from '../../lib/api'
import { useAuth, useMemberGuard } from '../../lib/auth'
import './feed.css'

const DRAFT = 'tym.draft'
const MAX_IMAGES = 4
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT)) || {} } catch { return {} } }

// Ask a question from anywhere: collapsed it is one line ("Ask the community..."), open it is the
// full form. Drafts survive a refresh, similar questions show up while you type the title, and
// Ctrl/Cmd + Enter posts. `full` is the standalone Ask page.
export default function Composer({ country, full = false, onPosted }) {
  const { user } = useAuth()
  const guard = useMemberGuard()
  const navigate = useNavigate()
  const draft = useRef(readDraft()).current
  const [open, setOpen] = useState(full || Boolean(draft.title))
  const [title, setTitle] = useState(draft.title || '')
  const [body, setBody] = useState(draft.body || '')
  const [place, setPlace] = useState(country || draft.country || 'uk')
  const [topic, setTopic] = useState(draft.category || '')
  const [files, setFiles] = useState([])
  const [similar, setSimilar] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef(null)
  const picker = useRef(null)
  const topics = useApi(open && user ? '/categories' : null).data || categories // the admin's topics; ours until they load

  useEffect(() => { if (country) setPlace(country) }, [country])
  useEffect(() => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ title, body, country: place, category: topic })) } catch { /* ignore */ }
  }, [title, body, place, topic])
  const urls = useRef(new Set())
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // "Already asked?" while typing the title
  useEffect(() => {
    if (title.trim().length < 12) { setSimilar([]); return undefined }
    const t = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(title.trim())}&any=1`)
        .then((r) => setSimilar((r.posts || []).slice(0, 3)))
        .catch(() => setSimilar([]))
    }, 450)
    return () => clearTimeout(t)
  }, [title])

  const expand = () => {
    if (!guard()) return
    setOpen(true)
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  const addFiles = async (e) => {
    const chosen = [...e.target.files].slice(0, MAX_IMAGES - files.length)
    e.target.value = ''
    try {
      // Shrunk in the browser first: four photos as they come off a phone are more than one request may carry
      const added = (await Promise.all(chosen.map(fileToJpeg))).map((file) => ({ file, url: URL.createObjectURL(file) }))
      added.forEach((f) => urls.current.add(f.url))
      setFiles((prev) => [...prev, ...added].slice(0, MAX_IMAGES))
    } catch {
      setError('We could not open one of those pictures. Use JPG, PNG or WebP files.')
    }
  }

  const reset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.url))
    setTitle(''); setBody(''); setTopic(''); setFiles([]); setSimilar([]); setError('')
    try { localStorage.removeItem(DRAFT) } catch { /* ignore */ }
    if (!full) setOpen(false)
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (!guard()) return
    setBusy(true)
    setError('')
    let payload = { title, body, country: place, category: topic || undefined }
    if (files.length) {
      const form = new FormData()
      Object.entries(payload).forEach(([k, v]) => v !== undefined && form.append(k, v))
      files.forEach((f) => form.append('images', f.file))
      payload = form
    }
    try {
      const { post } = await api('/posts', { method: 'POST', body: payload })
      reset()
      if (onPosted) onPosted(post)
      else navigate(`/p/${post.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit() }

  // A saved draft opens the form, but only for a member: a visitor has no name or photo to show in it
  if (!open || !user) {
    return (
      <div className="composer is-collapsed">
        {user ? <Avatar user={user} size={40} /> : <span className="composer-dot" aria-hidden />}
        <button className="composer-prompt" onClick={expand}>
          {user ? `Ask the community something, ${user.displayName.split(' ')[0]}...` : 'Log in to ask the community a question'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={expand}>Ask</button>
      </div>
    )
  }

  return (
    <form className={`composer${full ? ' is-full' : ''}`} onSubmit={submit} onKeyDown={onKey}>
      {!full && (
        <div className="composer-head">
          <Avatar user={user} size={40} />
          <div><strong>{user.displayName}</strong><span>Asking in the {countries.find((c) => c.slug === place)?.name} community</span></div>
          <button type="button" className="icon-ghost" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
      )}

      <div className="field">
        <label htmlFor="c-title" className={full ? '' : 'visually-hidden'}>Your question</label>
        <input id="c-title" ref={titleRef} className="input composer-title" maxLength={300} required value={title}
          onChange={(e) => setTitle(e.target.value)} placeholder="What do you want to know? Ask it as a question." />
        {title.length > 240 && <span className="hint">{300 - title.length} characters left</span>}
      </div>

      {similar.length > 0 && (
        <div className="similar" role="status">
          <p>Already asked? These might answer it:</p>
          <ul>{similar.map((p) => <li key={p.id}><Link to={`/p/${p.id}`} target={full ? undefined : '_blank'}>{p.title}</Link> <span className="faint">{p.commentCount} answers</span></li>)}</ul>
        </div>
      )}

      <div className="field">
        <label htmlFor="c-body" className={full ? '' : 'visually-hidden'}>Details</label>
        <textarea id="c-body" className="textarea composer-body" rows={full ? 6 : 3} maxLength={10000} value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Course, university, intake, budget and what you have already tried. Mention someone with @username." />
        <span className="hint">Do not share passport numbers, bank details or phone numbers.</span>
      </div>

      {files.length > 0 && (
        <ul className="composer-files">
          {files.map((f, i) => (
            <li key={f.url}>
              <img src={f.url} alt="" />
              <button type="button" aria-label="Remove picture" onClick={() => { URL.revokeObjectURL(f.url); setFiles(files.filter((_, j) => j !== i)) }}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="composer-bar">
        <label className="visually-hidden" htmlFor="c-country">Destination</label>
        <select id="c-country" className="select select-sm" value={place} onChange={(e) => setPlace(e.target.value)}>
          {countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <label className="visually-hidden" htmlFor="c-topic">Topic</label>
        <select id="c-topic" className="select select-sm" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Any topic</option>
          {topics.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <button type="button" className="icon-ghost" aria-label="Add pictures" disabled={files.length >= MAX_IMAGES}
          onClick={() => picker.current.click()} title="Add up to 4 pictures">
          <ImagePlus size={19} />
        </button>
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles} />
        <span className="composer-spacer" />
        {(title || body) && !busy && <button type="button" className="btn-text composer-clear" onClick={reset}>Clear</button>}
        <button className="btn btn-primary btn-sm" disabled={busy || title.trim().length < 10}>
          {busy ? <><Spinner /> Posting</> : 'Post question'}
        </button>
      </div>
      <FormError>{error}</FormError>
    </form>
  )
}
