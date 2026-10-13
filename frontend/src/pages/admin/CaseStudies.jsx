import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { FormError, Spinner } from '../../components/auth/fields'
import { adminApi, useAdminApi } from '../../lib/admin'
import { Confirm, Empty, Loading, PageHead, Pill, Tabs } from './ui'

const TONE = { published: 'line', hidden: 'muted' }
const LABEL = { published: 'On the site', hidden: 'Hidden' }
const BLANK = { name: '', route: '', course: '', quote: '' }
const LIMIT = { name: 80, route: 120, course: 120, quote: 2000 }

// The four lines the page shows. Same shape whether it is a new one or one being edited.
function Fields({ id, value, onChange }) {
  const field = (key, label, hint) => (
    <div className="field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      {key === 'quote'
        ? <textarea id={`${id}-quote`} className="textarea" rows={3} maxLength={LIMIT.quote}
          value={value.quote} onChange={(e) => onChange({ ...value, quote: e.target.value })}
          placeholder="In the student's own words." />
        : <input id={`${id}-${key}`} className="input" maxLength={LIMIT[key]} value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })} placeholder={hint} />}
    </div>
  )
  return (
    <>
      <div className="grid-2">
        {field('name', 'Student', 'Aisha Khan')}
        {field('route', 'Their route', 'Hyderabad to Leeds')}
      </div>
      {field('course', 'Course', 'MSc Marketing')}
      {field('quote', 'What they said')}
    </>
  )
}

const full = (v) => Object.keys(BLANK).every((k) => v[k].trim())
const trimmed = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]))

function Row({ c, onChanged, onMove }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: c.name, route: c.route, course: c.course, quote: c.quote })
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi('/admin/case-studies', { method: 'POST', body: trimmed(form) })
      setForm(BLANK)
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
