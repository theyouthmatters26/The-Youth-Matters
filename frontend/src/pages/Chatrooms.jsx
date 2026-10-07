import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, Send, ShieldCheck, Trash2 } from 'lucide-react'
import RichText from '../components/feed/RichText'
import RoomCard from '../components/feed/RoomCard'
import Avatar from '../components/ui/Avatar'
import RoleBadge from '../components/ui/RoleBadge'
import { FormError } from '../components/auth/fields'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useMeta } from '../lib/meta'
import '../components/auth/auth.css'

const POLL_MS = 4000
const GROUP_MS = 5 * 60 * 1000 // messages from one person within 5 minutes share one header
const ASKS_TYMAI = /(^|[^\w@])@tymai\b/i

export function Sources({ items }) {
  if (!items?.length) return null
  return (
    <div className="chat-sources">
      <span><BookOpen size={13} aria-hidden /> From the community</span>
      {items.map((s) => <Link key={s.postId} to={`/p/${s.postId}`}>{s.title}</Link>)}
    </div>
  )
}

export function Typing({ name = 'TYMAi' }) {
  return <p className="chat-typing" role="status"><span aria-hidden><i /><i /><i /></span> {name} is typing</p>
}

// Members only (RequireAuth in App.jsx). New messages arrive by polling every few seconds.
export default function Chatrooms() {
  const { room = 'study-abroad' } = useParams()
  const { user } = useAuth()
  const rooms = useApi('/chat/rooms')
  const current = rooms.data?.find((r) => r.slug === room)
  useMeta({ title: current ? `${current.name} chat room` : 'Chat rooms', path: `/chat/${room}` })
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const log = useRef(null)
  const lastId = useRef(0)
  const stick = useRef(true) // follow new messages unless the reader scrolled up
  const openRoom = useRef(room) // the room on screen now, for a reply that arrives after a switch
  openRoom.current = room

  const merge = (rows) => {
    if (!rows.length) return
    lastId.current = Math.max(lastId.current, ...rows.map((m) => m.id))
    setMessages((prev) => {
      const seen = new Set((prev || []).map((m) => m.id))
      return [...(prev || []).filter((m) => !m.pending), ...rows.filter((m) => !seen.has(m.id))]
    })
  }

  useEffect(() => {
    let live = true
    let looks = 0
    setMessages(null)
    setError('')
    lastId.current = 0
    stick.current = true
    const load = async () => {
      if (document.hidden && lastId.current) return
      // Every sixth look fetches the latest page whole and replaces the list, so a message deleted
      // by its author or a moderator leaves this screen too.
      // ponytail: this also trims a long session back to the latest 50; keep older rows if that is missed
      const seen = lastId.current
      const whole = looks++ % 6 === 0 || !seen
      try {
        const rows = await api(`/chat/rooms/${room}/messages${whole ? '' : `?after=${seen}`}`)
        if (!live) return
        // A message sent while this page was on its way is not in it yet, so it must not be replaced away
        if (whole && lastId.current === seen) setMessages(rows)
        merge(rows)
      } catch (err) {
        if (live && !lastId.current) { setMessages([]); setError(err.message) }
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => { live = false; clearInterval(timer) }
  }, [room])

  useEffect(() => {
    if (stick.current && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, thinking])

  const onScroll = () => {
    const el = log.current
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setError('')
    stick.current = true
    const temp = { id: `t${Date.now()}`, pending: true, author: user, body, sources: [], createdAt: new Date().toISOString() }
    setMessages((prev) => [...(prev || []), temp])
    setThinking(ASKS_TYMAI.test(body))
    try {
      const rows = await api(`/chat/rooms/${room}/messages`, { method: 'POST', body: { body } })
      // They moved to another room while it was sending: the reply belongs to the room it was sent in
      if (openRoom.current === room) merge(rows)
    } catch (err) {
      setError(err.message)
      if (openRoom.current !== room) return
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      setDraft(body)
    } finally {
      setThinking(false)
    }
  }

  const remove = async (m) => {
    if (!window.confirm('Delete this message for everyone?')) return
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
    try { await api(`/chat/messages/${m.id}`, { method: 'DELETE' }) } catch { setMessages((prev) => [...prev, m].sort((a, b) => a.id - b.id)) }
  }

  return (
    <div className="container page">
      <div className="chat-shell card">
        <aside className="chat-rooms" aria-label="Chat rooms">
          <p className="eyebrow">Study Abroad rooms</p>
          <div className="room-list">
            {(rooms.data || []).map((r) => <RoomCard key={r.slug} room={r} active={r.slug === room} />)}
          </div>
        </aside>

        <section className="chat-main" aria-label={`${current?.name || 'Chat'} room`}>
          <header className="chat-head">
            <div>
              <h1 className="chat-title"># {current?.name || 'Chat room'}</h1>
              <p className="muted chat-desc">
                {current?.description}
                {current?.activeToday > 0 && <> · {current.activeToday} talking today</>}
              </p>
            </div>
            <span className="chip"><ShieldCheck size={14} /> Moderated</span>
          </header>

          <ol className="chat-log" ref={log} onScroll={onScroll} aria-live="polite">
            {messages === null && <li className="chat-note">Loading messages...</li>}
            {messages?.length === 0 && !error && (
              <li className="chat-note">No messages yet. Say hello, or ask @TYMAi anything about studying abroad.</li>
            )}
            {messages?.map((m, i) => {
              const prev = messages[i - 1]
              const grouped = prev && prev.author.id === m.author.id && new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_MS
              const mine = m.author.id === user.id
              return (
                <li key={m.id} className={`${m.author.role === 'bot' ? 'is-ai' : ''}${grouped ? ' is-grouped' : ''}${m.pending ? ' is-pending' : ''}`}>
                  {grouped ? <span aria-hidden /> : <Link to={`/u/${m.author.username}`} aria-label={m.author.displayName}><Avatar user={m.author} size={32} /></Link>}
                  <div>
                    {!grouped && (
                      <p className="chat-meta">
                        <Link to={`/u/${m.author.username}`}><strong>{m.author.displayName}</strong></Link>
                        <RoleBadge role={m.author.role} />
                        <time className="faint mono" dateTime={m.createdAt}>{m.pending ? 'sending' : timeAgo(m.createdAt)}</time>
                      </p>
                    )}
                    <RichText text={m.body} className="chat-text" />
                    <Sources items={m.sources} />
                  </div>
                  {mine && !m.pending && (
                    <button className="chat-delete" onClick={() => remove(m)} aria-label="Delete message"><Trash2 size={14} /></button>
                  )}
                </li>
              )
            })}
            {thinking && <li className="is-ai"><span aria-hidden /><Typing /></li>}
          </ol>

          <form className="chat-input" onSubmit={send}>
            <FormError>{error}</FormError>
            <label htmlFor="chat-msg" className="visually-hidden">Message</label>
            <input id="chat-msg" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000}
              placeholder={`Message #${current?.name || room}. Type @TYMAi to ask the assistant.`} autoComplete="off" />
            <button className="btn btn-primary" aria-label="Send" disabled={!draft.trim()}><Send size={16} /></button>
          </form>
        </section>
      </div>
    </div>
  )
}
