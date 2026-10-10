import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Bot, CornerUpLeft, Send, Trash2, UserRound } from 'lucide-react'
import RichText from '../../components/feed/RichText'
import Avatar from '../../components/ui/Avatar'
import { FormError } from '../../components/auth/fields'
import { adminApi, useAdmin, useAdminApi } from '../../lib/admin'
import { plural } from '../../lib/format'
import { Empty, Loading, PageHead, Pager, Pill, SearchBox, Tabs, ago, useDebounced } from './ui'

const POLL_MS = 4000
const LEVELS = { undergraduate: 'Undergraduate', postgraduate: 'Postgraduate', phd: 'PhD', foundation: 'Foundation', other: 'Other' }

function StatusLine({ c }) {
  if (c.status === 'waiting') return <Pill tone="solid">Asked for a person</Pill>
  if (c.status === 'human') return <Pill tone={c.needsReply ? 'solid' : 'line'}>{c.needsReply ? 'Waiting for your reply' : `With ${c.assignedTo || 'the team'}`}</Pill>
  return <Pill tone="muted">With TYMAi</Pill>
}

// One conversation: the whole thread, who the student is, and a box to answer as yourself
function Thread({ id, onBack, onChanged }) {
  const { admin } = useAdmin()
  const [c, setC] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const log = useRef(null)
  const lastId = useRef(0)
  const stick = useRef(true)

  const add = (rows) => {
    if (!rows.length) return
    lastId.current = Math.max(lastId.current, ...rows.map((m) => m.id))
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      return [...prev, ...rows.filter((m) => !seen.has(m.id))]
    })
  }

  useEffect(() => {
    let live = true
    setC(null)
    setMessages([])
    setError('')
    setDraft('')
    lastId.current = 0
    stick.current = true
    adminApi(`/admin/support/conversations/${id}`)
      .then((data) => { if (live) { setC(data); add(data.messages) } })
      .catch((err) => live && setError(err.message))
    // New messages from the student (or TYMAi, or a teammate) arrive by polling
    const timer = setInterval(async () => {
      if (document.hidden || !lastId.current) return
      try {
        const fresh = await adminApi(`/admin/support/conversations/${id}/messages?after=${lastId.current}`)
        if (!live) return
        const { messages: rows, ...state } = fresh
        add(rows)
        setC((prev) => (prev && Object.keys(state).some((k) => prev[k] !== state[k]) ? { ...prev, ...state } : prev))
        if (rows.length) onChanged()
      } catch { /* the next poll tries again */ }
    }, POLL_MS)
    return () => { live = false; clearInterval(timer) }
  }, [id])

  useEffect(() => {
    if (stick.current && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages])

  const send = async (e) => {
    e?.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    stick.current = true
    try {
      const res = await adminApi(`/admin/support/conversations/${id}/messages`, { method: 'POST', body: { body } })
      add([res.message])
      setC((prev) => ({ ...prev, ...res.conversation }))
      setDraft('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status) => {
    setError('')
    try {
      const row = await adminApi(`/admin/support/conversations/${id}/status`, { method: 'POST', body: { status } })
      setC((prev) => ({ ...prev, ...row }))
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  // Gone for the student too, so it asks first. Used for spam and for test threads.
  const remove = async () => {
    if (!window.confirm(`Delete this conversation with ${c.student.displayName}? The student loses it too.`)) return
    setError('')
    try {
      await adminApi(`/admin/support/conversations/${id}`, { method: 'DELETE' })
      onChanged()
      onBack()
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !c) return <Empty title="We could not open this conversation" text={error} />
  if (!c) return <Loading what="the conversation" />

  const a = c.about
  const facts = [a.country && `Heading to ${a.country}`, [a.course, a.university].filter(Boolean).join(', '), LEVELS[a.studyLevel], a.intake && `Starts ${a.intake}`].filter(Boolean)
  return (
    <>
      <header className="adm-thread-head">
        <button className="adm-icon adm-back" onClick={onBack} aria-label="Back to the list"><ArrowLeft size={18} /></button>
        <Avatar user={c.student} size={40} />
        <div className="adm-thread-who">
          <strong>{c.student.displayName}</strong>
          <span>{c.student.email} · {plural(a.questions, 'question')}, {plural(a.answers, 'answer')} · joined {ago(a.joinedAt)}</span>
          {facts.length > 0 && <span>{facts.join(' · ')}</span>}
        </div>
        <div className="adm-thread-actions">
          <StatusLine c={c} />
          {c.status === 'human'
            ? <button className="btn btn-ghost btn-sm" onClick={() => setStatus('ai')}><CornerUpLeft size={14} /> Hand back to TYMAi</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => setStatus('human')}><UserRound size={14} /> Step in</button>}
          <button className="btn btn-ghost btn-sm adm-thread-delete" onClick={remove}><Trash2 size={14} /> Delete</button>
        </div>
      </header>

      <ol className="adm-msgs" ref={log} aria-live="polite"
        onScroll={(e) => { stick.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 80 }}>
        <li className="adm-msgs-title">{c.title}</li>
        {messages.map((m) => (
          <li key={m.id} className={`adm-msg is-${m.role}`}>
            <p className="adm-msg-who">
              {m.role === 'user' ? c.student.displayName.split(' ')[0]
                : m.role === 'assistant' ? <><Bot size={13} aria-hidden /> TYMAi</>
                  : m.author?.name === admin.name ? 'You' : m.author?.name}
              <time dateTime={m.createdAt}>{ago(m.createdAt)}</time>
            </p>
            <RichText text={m.content} className="adm-bubble" />
            {m.sources?.length > 0 && (
              <p className="adm-msg-sources"><BookOpen size={12} aria-hidden /> Drew on {m.sources.map((s, i) => (
                <span key={s.postId}>{i > 0 && ', '}<a href={`/p/${s.postId}`} target="_blank" rel="noreferrer">{s.title}</a></span>
              ))}</p>
            )}
          </li>
        ))}
      </ol>

      <form className="adm-reply" onSubmit={send}>
        <FormError>{error}</FormError>
        <label htmlFor="adm-reply" className="visually-hidden">Your reply</label>
        <textarea id="adm-reply" className="textarea" rows={2} value={draft} maxLength={4000} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={`Reply to ${c.student.displayName.split(' ')[0]} as ${admin.name.split(' ')[0]}`} />
        <button className="btn btn-primary" disabled={busy || !draft.trim()}><Send size={15} /> Send</button>
        <p className="adm-reply-note">
          {c.status === 'human'
            ? 'TYMAi is paused in this conversation. Hand it back when you are done.'
            : 'Sending a reply puts TYMAi on hold here, and the student gets an email.'}
        </p>
      </form>
    </>
  )
}

export default function Support({ onChanged }) {
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('c')) || null
  const [filter, setFilter] = useState('open')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(term)
  const path = `/admin/support/conversations?filter=${filter}&q=${encodeURIComponent(q)}&page=${page}`
  const list = useAdminApi(path)
  // A reload that fails empties list.data. Keep the last list that loaded for this view, so a failed poll does not blank the inbox
  const [kept, setKept] = useState(null)
  useEffect(() => { if (list.data) setKept({ path, data: list.data }) }, [list.data])

  useEffect(() => {
    const t = setInterval(() => !document.hidden && list.reload(), 15000)
    return () => clearInterval(t)
  }, [list.reload])

  const changed = () => { list.reload(); onChanged?.() }
  const open = (cid) => setParams(cid ? { c: cid } : {})
  const choose = (set) => (value) => { set(value); setPage(1) }
  const data = list.data || (kept?.path === path ? kept.data : null)
  const rows = data?.items || []

  return (
    <>
      <PageHead eyebrow="Support" title="Step into a conversation"
        text="Students talk to TYMAi here. When one asks for a person, or you want to add something, reply as yourself and TYMAi steps back." />

      <div className={`adm-inbox${id ? ' has-open' : ''}`}>
        <div className="adm-inbox-list">
          <div className="adm-inbox-tools">
            <Tabs label="Which conversations" value={filter} onChange={choose(setFilter)}
              items={[['open', 'Open', data?.waiting], ['all', 'Every conversation']]} />
            <SearchBox value={term} onChange={choose(setTerm)} placeholder="Search by student or title" />
          </div>
          <ul>
            {list.loading && !data && <li className="adm-inbox-note"><Loading what="conversations" /></li>}
            {list.error && !data && <li><Empty title="We could not load conversations" text={list.error.message} /></li>}
            {data && rows.length === 0 && (
              <li className="adm-inbox-note">
                {q ? `Nothing matches "${q}".` : filter === 'open' ? 'Nobody is waiting for a person right now. Every conversation has the rest.' : 'No conversations yet.'}
              </li>
            )}
            {rows.map((c) => (
              <li key={c.id}>
                <button className={`adm-convo${c.id === id ? ' is-open' : ''}${c.needsReply ? ' needs-reply' : ''}`} onClick={() => open(c.id)}
                  aria-current={c.id === id ? 'true' : undefined}>
                  <Avatar user={c.student} size={36} />
                  <span className="adm-convo-text">
                    <span className="adm-convo-top"><strong>{c.student.displayName}</strong><time dateTime={c.lastAt}>{ago(c.lastAt)}</time></span>
                    <span className="adm-convo-title">{c.title}</span>
                    <span className="adm-convo-last">{c.lastRole === 'user' ? '' : c.lastRole === 'human' ? 'Team: ' : 'TYMAi: '}{c.preview}</span>
                  </span>
                  {c.needsReply && <span className="adm-dot" aria-label="Waiting for a person" />}
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} hasMore={data?.hasMore} onPage={setPage} />
        </div>

        <section className="adm-thread" aria-label="Conversation">
          {id
            ? <Thread key={id} id={id} onBack={() => open(null)} onChanged={changed} />
            : <Empty title="Pick a conversation" text="Choose one on the left to read it. Students who asked for a person are under Open, with a dot when they are waiting for a reply." />}
        </section>
      </div>
    </>
  )
}
