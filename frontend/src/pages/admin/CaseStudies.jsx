import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Plus, X } from 'lucide-react'
import { FormError, Spinner } from '../../components/auth/fields'
import { adminApi, useAdminApi } from '../../lib/admin'
import { Confirm, Empty, Loading, PageHead, Pill, Tabs } from './ui'

const TONE = { published: 'line', hidden: 'muted' }
const LABEL = { published: 'On the site', hidden: 'Hidden' }
const BLANK = { name: '', route: '', course: '', quote: '', story: '' }
const REQUIRED = ['name', 'route', 'course', 'quote']  // the story is the one line that may be left out
const LIMIT = { name: 80, route: 120, course: 120, quote: 2000, story: 4000 }
const MAX_PICTURES = 8

// What the page shows. Same shape whether it is a new one or one being edited.
function Fields({ id, value, onChange }) {
  const field = (key, label, hint, { rows, note } = {}) => (
    <div className="field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      {rows
        ? <textarea id={`${id}-${key}`} className="textarea" rows={rows} maxLength={LIMIT[key]}
          value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} placeholder={hint} />
        : <input id={`${id}-${key}`} className="input" maxLength={LIMIT[key]} value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })} placeholder={hint} />}
      {note && <span className="hint">{note}</span>}
    </div>
  )
  return (
    <>
      <div className="grid-2">
        {field('name', 'Student', 'Aisha Khan')}
        {field('route', 'Their route', 'Hyderabad to Leeds')}
      </div>
      {field('course', 'Course', 'MSc Marketing')}
      {field('quote', 'What they said', "In the student's own words.", { rows: 3 })}
      {field('story', <>Their story <span className="faint">Optional</span></>,
        'A few lines about how it went, read when a student opens this journey.',
        { rows: 5, note: 'The card on the page keeps showing the quote. This is what opens underneath it, with the pictures.' })}
    </>
  )
}

const full = (v) => REQUIRED.every((k) => v[k].trim())
const trimmed = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]))

// The photographs on one journey, newest on the end. Taking one off saves the list that is left,
// which is what takes the file out of storage as well.
function Pictures({ id, images, onChanged }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (call) => {
    setBusy(true)
    setError('')
    try {
      await call()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const add = (e) => {
    const files = [...e.target.files]
    e.target.value = ''  // choosing the same files again still counts as a change
    if (!files.length) return
    const body = new FormData()
    files.forEach((f) => body.append('images', f))
    run(() => adminApi(`/admin/case-studies/${id}/images`, { method: 'POST', body }))
  }
  const remove = (src) => run(() => adminApi(`/admin/case-studies/${id}`,
    { method: 'PATCH', body: { images: images.filter((u) => u !== src) } }))

  return (
    <div className="field">
      <label htmlFor={`pics-${id}`}>Pictures <span className="faint">Optional</span></label>
      {images.length > 0 && (
        <ul className="adm-pics">
          {images.map((src) => (
            <li key={src}>
              <img src={src} alt="" />
              <button type="button" className="adm-pic-off" onClick={() => remove(src)} disabled={busy}
                aria-label="Take this picture off">
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="adm-action-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current.click()}
          disabled={busy || images.length >= MAX_PICTURES}>
          {busy ? <Spinner /> : <ImagePlus size={15} />} Add pictures
        </button>
        <span className="hint">{images.length} of {MAX_PICTURES}. Students see them when they open this journey.</span>
      </div>
      <input ref={input} id={`pics-${id}`} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={add} />
      <FormError>{error}</FormError>
    </div>
  )
}

function Row({ c, onChanged, onMove }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: c.name, route: c.route, course: c.course, quote: c.quote, story: c.story || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed = Object.keys(BLANK).some((k) => form[k] !== c[k])

  const save = async (body) => {
    setBusy(true)
    setError('')
    try {
      await adminApi(`/admin/case-studies/${c.id}`, { method: 'PATCH', body })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="adm-faq">
      <div className="adm-faq-head">
        <button className="adm-faq-q" onClick={() => setOpen(!open)} aria-expanded={open}>
          {c.name} <span className="adm-hint">{c.route}</span>
        </button>
        <Pill tone={TONE[c.status]}>{LABEL[c.status]}</Pill>
        <div className="adm-faq-order">
          <button className="adm-icon" onClick={() => onMove(c, -1)} aria-label="Move up" disabled={c.status !== 'published'}><ArrowUp size={15} /></button>
          <button className="adm-icon" onClick={() => onMove(c, 1)} aria-label="Move down" disabled={c.status !== 'published'}><ArrowDown size={15} /></button>
        </div>
      </div>
      {open && (
        <div className="adm-faq-body">
          <Fields id={`c-${c.id}`} value={form} onChange={setForm} />
          <Pictures id={c.id} images={c.images || []} onChanged={onChanged} />
          <FormError>{error}</FormError>
          <div className="adm-action-row">
            <button className="btn btn-primary btn-sm" disabled={busy || !changed || !full(form)}
              onClick={() => save(trimmed(form))}>{busy ? <Spinner /> : 'Save'}</button>
            {c.status === 'published'
              ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save({ status: 'hidden' })}>Hide</button>
              : <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save({ status: 'published' })}>Put back on the site</button>}
            <Confirm label="Delete" question={`Delete ${c.name}'s case study?`} danger
              onConfirm={async () => { await adminApi(`/admin/case-studies/${c.id}`, { method: 'DELETE' }); onChanged() }} />
          </div>
        </div>
      )}
    </li>
  )
}

function NewCaseStudy({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [files, setFiles] = useState([])  // held until there is a journey to put them on
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const made = await adminApi('/admin/case-studies', { method: 'POST', body: trimmed(form) })
      if (files.length) {
        const body = new FormData()
        files.forEach((f) => body.append('images', f))
        // The journey is written by now, so pictures the server will not take must not lose it
        try {
          await adminApi(`/admin/case-studies/${made.id}/images`, { method: 'POST', body })
        } catch (err) {
          setError(`${err.message} The case study is on the page; open it below to add the pictures.`)
        }
      }
      setForm(BLANK)
      setFiles([])
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} /> Add a case study</button>
  return (
    <form className="adm-faq-new stack" onSubmit={add}>
      <Fields id="new" value={form} onChange={setForm} />
      <div className="field">
        <label htmlFor="new-pics">Pictures <span className="faint">Optional</span></label>
        <div className="adm-action-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current.click()}>
            <ImagePlus size={15} /> {files.length ? 'Choose different pictures' : 'Choose pictures'}
          </button>
          {files.length > 0 && (
            <>
              <span className="hint">{files.length} chosen. They go up with the case study.</span>
              <button type="button" className="btn-text" onClick={() => setFiles([])}><X size={13} /> Clear</button>
            </>
          )}
        </div>
        <input ref={input} id="new-pics" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
          onChange={(e) => { setFiles([...e.target.files].slice(0, MAX_PICTURES)); e.target.value = '' }} />
      </div>
      <FormError>{error}</FormError>
      <div className="adm-action-row">
        <button className="btn btn-primary btn-sm" disabled={busy || !full(form)}>{busy ? <Spinner /> : 'Add to the page'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

export default function CaseStudies() {
  const [filter, setFilter] = useState('all')
  const list = useAdminApi('/admin/case-studies')
  const rows = list.data || []
  const shown = filter === 'all' ? rows : rows.filter((c) => c.status === filter)

  // Swap this one's place with its neighbour on the page: two small saves, no drag and drop
  const move = async (c, by) => {
    const page = rows.filter((r) => r.status === 'published')
    const other = page[page.indexOf(c) + by]
    if (!other) return
    await adminApi(`/admin/case-studies/${c.id}`, { method: 'PATCH', body: { sortOrder: other.sortOrder } })
    await adminApi(`/admin/case-studies/${other.id}`, { method: 'PATCH', body: { sortOrder: c.sortOrder } })
    list.reload()
  }

  return (
    <>
      <PageHead eyebrow="Case studies" title="The case studies page"
        text="The journeys students read on /case-studies, in this order. The first one also appears on the home page, so put the strongest story at the top." />
      <div className="adm-toolbar">
        <Tabs label="Which case studies" value={filter} onChange={setFilter}
          items={[['all', 'All', 0], ['published', 'On the site'], ['hidden', 'Hidden']]} />
        <NewCaseStudy onAdded={list.reload} />
      </div>
      {list.error ? <Empty title="We could not load the case studies" text={list.error.message} />
        : !list.data ? <Loading what="the case studies" />
          : shown.length === 0 ? <Empty title="Nothing here yet" text="Add a student's journey to start the page." />
            : <ul className="adm-list adm-faqs">{shown.map((c) => <Row key={c.id} c={c} onChanged={list.reload} onMove={move} />)}</ul>}
    </>
  )
}
