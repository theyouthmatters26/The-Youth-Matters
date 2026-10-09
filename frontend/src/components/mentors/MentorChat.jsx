import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { FormError, Spinner } from '../auth/fields'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { timeAgo } from '../../lib/format'
import './mentors.css'

const POLL_MS = 5000
export const chatLink = (username, mentorId, studentId) => `/u/${username}?tab=Messages&with=${mentorId}-${studentId}`

// One private conversation between a student and a mentor they booked. Polls for new messages.
function Thread({ c, onBack, onRead }) {
  const { account } = useAuth()
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const log = useRef(null)
  const lastId = useRef(0)
  const path = `/mentor-chats/${c.mentorId}/${c.studentId}/messages`

  const merge = (rows) => {
    if (!rows.length) return
    lastId.current = Math.max(lastId.current, ...rows.map((m) => m.id))
    setMessages((prev) => [...(prev || []).filter((m) => !m.pending && !rows.some((r) => r.id === m.id)), ...rows])
  }

  useEffect(() => {
    let live = true
    lastId.current = 0
    setMessages(null)
    setError('')
    const load = async () => {
      if (document.hidden && lastId.current) return
      try {
        const rows = await api(`${path}${lastId.current ? `?after=${lastId.current}` : ''}`)
        if (!live) return
        if (!lastId.current) setMessages(rows)
        merge(rows)
        if (rows.some((m) => m.authorId !== account.id)) onRead()
      } catch (err) {
        if (live && !lastId.current) { setMessages([]); setError(err.message) }
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => { live = false; clearInterval(timer) }
  }, [path])

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages])

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setError('')
    const temp = { id: `t${Date.now()}`, pending: true, authorId: account.id, body, createdAt: new Date().toISOString() }
    setMessages((prev) => [...(prev || []), temp])
    try {
      merge(await api(path, { method: 'POST', body: { body } }))
    } catch (err) {
      setError(err.message)
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      setDraft(body)
    }
  }

  const first = c.with.displayName.split(' ')[0]
  return (
    <section className="mchat-thread" aria-label={`Messages with ${c.with.displayName}`}>
      <header className="mchat-head">
        <button className="icon-btn mchat-back" onClick={onBack} aria-label="All conversations"><ArrowLeft size={18} /></button>
        <Avatar user={c.with} size={36} />
        <div>
          <strong>{c.with.displayName}</strong>
          <span className="faint">{c.asMentor ? 'Booked a session with you' : 'Your mentor'}</span>
        </div>
        {!c.asMentor && <Link to={`/mentors/${c.mentorId}`} className="btn btn-ghost btn-sm">Book again</Link>}
      </header>
      <ol className="mchat-log" ref={log} aria-live="polite">
        {messages === null && <li className="mchat-note"><Spinner /> Loading messages</li>}
        {messages?.length === 0 && !error && <li className="mchat-note">No messages yet. Say hello to {first}, or share what you would like to cover.</li>}
        {messages?.map((m) => (
          <li key={m.id} className={`mchat-msg${m.authorId === account.id ? ' is-mine' : ''}${m.pending ? ' is-pending' : ''}`}>
            <p>{m.body}</p>
            <time className="faint" dateTime={m.createdAt}>{m.pending ? 'sending' : timeAgo(m.createdAt)}</time>
          </li>
        ))}
      </ol>
      <form className="mchat-input" onSubmit={send}>
        <FormError>{error}</FormError>
        <label htmlFor="mchat-msg" className="visually-hidden">Message</label>
        <input id="mchat-msg" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000}
          placeholder={`Message ${first}`} autoComplete="off" />
        <button className="btn btn-primary" aria-label="Send" disabled={!draft.trim()}><Send size={16} /></button>
      </form>
    </section>
  )
}

// The Messages tab of your own profile: everyone you have a booked session with, as a student or a mentor
export default function MentorChat() {
  const { account } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data, error, loading, reload } = useApi('/mentor-chats')
  const open = params.get('with')
  const pick = (key) => setParams(key ? { tab: 'Messages', with: key } : { tab: 'Messages' }, { replace: true })

  if (loading) return <p className="muted session-empty"><Spinner /> Loading your messages</p>
  if (error) return <FormError>{error.message}</FormError>
  if (!data.length) {
    return (
      <div className="empty card">
        <h2 className="display">No conversations yet</h2>
        <p className="muted">{account?.role === 'mentor'
          ? 'When a student books a session with you, you can message each other here.'
          : 'Book a session with a mentor and you can message them here, before and after the call.'}</p>
        {account?.role !== 'mentor' && <Link to="/mentors" className="btn btn-primary btn-sm">Find a mentor</Link>}
      </div>
    )
  }
  const current = data.find((c) => `${c.mentorId}-${c.studentId}` === open)
  return (
    <div className={`mchat card${current ? ' has-open' : ''}`}>
      <ul className="mchat-list" aria-label="Conversations">
        {data.map((c) => {
          const key = `${c.mentorId}-${c.studentId}`
          return (
            <li key={key}>
              <button className={key === open ? 'is-on' : ''} onClick={() => pick(key)}>
                <Avatar user={c.with} size={40} />
                <span className="mchat-who">
                  <strong>{c.with.displayName}</strong>
                  <span className="faint">{c.last ? c.last.body : c.asMentor ? 'Booked a session with you' : 'Say hello'}</span>
                </span>
                {c.unread > 0 && <span className="mchat-unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {current ? <Thread key={open} c={current} onBack={() => pick(null)} onRead={reload} />
        : <p className="mchat-pick muted">Choose a conversation.</p>}
    </div>
  )
}
