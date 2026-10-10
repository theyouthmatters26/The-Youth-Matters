import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { FormError, Spinner } from '../../components/auth/fields'
import { adminApi, useAdminApi } from '../../lib/admin'
import { Confirm, Empty, Loading, PageHead, Person, Pill, Tabs, ago } from './ui'

const TONE = { pending: 'warn', published: 'line', hidden: 'muted' }
const LABEL = { pending: 'Waiting for an answer', published: 'On the site', hidden: 'Hidden' }

// One question: the team edits both lines in place. Answering a member's question publishes it.
function Row({ f, onChanged, onMove }) {
  const [open, setOpen] = useState(f.status === 'pending')
  const [question, setQuestion] = useState(f.question)
  const [answer, setAnswer] = useState(f.answer || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changed = question !== f.question || answer !== (f.answer || '')

  const save = async (body) => {
    setBusy(true)
    setError('')
    try {
      await adminApi(`/admin/faqs/${f.id}`, { method: 'PATCH', body })
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
        <button className="adm-faq-q" onClick={() => setOpen(!open)} aria-expanded={open}>{f.question}</button>
        <Pill tone={TONE[f.status]}>{LABEL[f.status]}</Pill>
        <div className="adm-faq-order">
          <button className="adm-icon" onClick={() => onMove(f, -1)} aria-label="Move up" disabled={f.status !== 'published'}><ArrowUp size={15} /></button>
          <button className="adm-icon" onClick={() => onMove(f, 1)} aria-label="Move down" disabled={f.status !== 'published'}><ArrowDown size={15} /></button>
        </div>
      </div>
      {f.askedBy && (
        <p className="adm-faq-by">
          <Person user={f.askedBy} sub={`Asked ${ago(f.createdAt)}`} size={28} />
        </p>
      )}
      {open && (
        <div className="adm-faq-body">
          <div className="field">
            <label htmlFor={`q-${f.id}`}>Question</label>
            <input id={`q-${f.id}`} className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor={`a-${f.id}`}>Answer</label>
            <textarea id={`a-${f.id}`} className="textarea" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)}
              maxLength={4000} placeholder="Write the answer members will read on the FAQ page." />
            {f.status === 'pending' && <span className="hint">Saving an answer puts it on the FAQ page and tells whoever asked.</span>}
          </div>
          <FormError>{error}</FormError>
          <div className="adm-action-row">
            <button className="btn btn-primary btn-sm" disabled={busy || !changed || !question.trim()}
              onClick={() => save({ question: question.trim(), answer: answer.trim() })}>
              {busy ? <Spinner /> : f.status === 'pending' ? 'Answer and publish' : 'Save'}
            </button>
            {f.status === 'published' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save({ status: 'hidden' })}>Hide</button>}
            {f.status === 'hidden' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save({ status: 'published' })}>Put back on the site</button>}
            <Confirm label="Delete" question="Delete this question?" danger
              onConfirm={async () => { await adminApi(`/admin/faqs/${f.id}`, { method: 'DELETE' }); onChanged() }} />
          </div>
        </div>
      )}
    </li>
  )
}

function NewFaq({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi('/admin/faqs', { method: 'POST', body: { question: question.trim(), answer: answer.trim() } })
      setQuestion('')
      setAnswer('')
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} /> Add a question</button>
  return (
    <form className="adm-faq-new stack" onSubmit={add}>
      <div className="field">
        <label htmlFor="new-q">Question</label>
        <input id="new-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} autoFocus
          placeholder="How do counselling hours work?" />
      </div>
      <div className="field">
        <label htmlFor="new-a">Answer</label>
        <textarea id="new-a" className="textarea" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={4000}
          placeholder="Plain words, the way you would say it to a student." />
      </div>
      <FormError>{error}</FormError>
      <div className="adm-action-row">
        <button className="btn btn-primary btn-sm" disabled={busy || question.trim().length < 5 || answer.trim().length < 5}>
          {busy ? <Spinner /> : 'Add to the FAQ page'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

export default function Faqs({ onChanged }) {
  const [filter, setFilter] = useState('all')
  const list = useAdminApi('/admin/faqs')
  const rows = list.data || []
  const waiting = rows.filter((f) => f.status === 'pending')
  const shown = filter === 'all' ? rows : rows.filter((f) => f.status === filter)
  const done = () => { list.reload(); onChanged?.() }

  // Swap this one's place with its neighbour on the page: two small saves, no drag and drop
  const move = async (f, by) => {
    const page = rows.filter((r) => r.status === 'published')
    const at = page.indexOf(f)
    const other = page[at + by]
    if (!other) return
    await adminApi(`/admin/faqs/${f.id}`, { method: 'PATCH', body: { sortOrder: other.sortOrder } })
    await adminApi(`/admin/faqs/${other.id}`, { method: 'PATCH', body: { sortOrder: f.sortOrder } })
    done()
  }

  return (
    <>
      <PageHead eyebrow="FAQ" title="The FAQ page"
        text="What members read on /faq, in this order. Questions members send in with “Post your FAQ” wait here until you answer them; answering one puts it on the page and tells them." />
      <div className="adm-toolbar">
        <Tabs label="Which questions" value={filter} onChange={setFilter}
          items={[['all', 'All', 0], ['pending', 'From members', waiting.length], ['published', 'On the site'], ['hidden', 'Hidden']]} />
        <NewFaq onAdded={done} />
      </div>
      {list.error ? <Empty title="We could not load the FAQ" text={list.error.message} />
        : !list.data ? <Loading what="the FAQ" />
          : shown.length === 0 ? (
            <Empty title={filter === 'pending' ? 'Nothing waiting' : 'Nothing here yet'}
              text={filter === 'pending' ? 'Questions members send in from the FAQ page show up here.' : 'Add a question to start the page.'} />
          ) : <ul className="adm-list adm-faqs">{shown.map((f) => <Row key={f.id} f={f} onChanged={done} onMove={move} />)}</ul>}
    </>
  )
}
