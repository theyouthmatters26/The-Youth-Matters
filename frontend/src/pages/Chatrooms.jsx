import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { Send, ShieldCheck } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import RoleBadge from '../components/ui/RoleBadge'
import { roomMessages, rooms } from '../data/sample'
import { timeAgo } from '../lib/format'
import { useAuth } from '../lib/auth'

// Members only (RequireAuth in App.jsx). Phase 4: messages arrive over SocketIO (backend/app/sockets/chat.py).
export default function Chatrooms() {
  const { room = 'study-abroad' } = useParams()
  const { user } = useAuth()
  const current = rooms.find((r) => r.slug === room) || rooms[0]
  const [messages, setMessages] = useState(roomMessages)
  const [draft, setDraft] = useState('')

  const send = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    setMessages([...messages, { id: Date.now(), author: user, body: draft.trim(), createdAt: new Date().toISOString() }])
    setDraft('')
  }

  return (
    <div className="container page">
      <div className="chat-shell card">
        <aside className="chat-rooms">
          <p className="eyebrow">Study Abroad rooms</p>
          {rooms.map((r) => (
            <NavLink key={r.slug} to={`/chat/${r.slug}`} className={() => (r.slug === current.slug ? 'active' : '')}>
              <strong># {r.name}</strong>
              <span>{r.online} online</span>
            </NavLink>
          ))}
        </aside>

        <section className="chat-main" aria-label={`${current.name} chat`}>
          <header className="chat-head">
            <div>
              <h1 className="chat-title"># {current.name}</h1>
              <p className="muted" style={{ fontSize: 'var(--step--1)' }}>{current.description}</p>
            </div>
            <span className="chip"><ShieldCheck size={14} /> Moderated</span>
          </header>

          <ol className="chat-log">
            {messages.map((m) => (
              <li key={m.id} className={m.author.role === 'bot' ? 'is-ai' : ''}>
                <Avatar user={m.author} size={32} />
                <div>
                  <p className="chat-meta">
                    <strong>{m.author.displayName}</strong> <RoleBadge role={m.author.role} />
                    <span className="faint mono">{timeAgo(m.createdAt)}</span>
                  </p>
                  <p>{m.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <form className="chat-input" onSubmit={send}>
            <label htmlFor="chat-msg" className="visually-hidden">Message</label>
            <input id="chat-msg" className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message #${current.name}. Type @TYMAi to ask the assistant.`} />
            <button className="btn btn-primary" aria-label="Send"><Send size={16} /></button>
          </form>
        </section>
      </div>
    </div>
  )
}
