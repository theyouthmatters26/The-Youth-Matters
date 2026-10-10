import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquare, Plus, Send, Trash2, UserRound } from 'lucide-react'
import RichText from '../components/feed/RichText'
import Avatar from '../components/ui/Avatar'
import { FormError } from '../components/auth/fields'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useMeta } from '../lib/meta'
import { Sources, Typing } from './Chatrooms'

const TYMAI = { displayName: 'TYMAi', role: 'bot' }
const POLL_MS = 5000 // a person from the team may reply at any moment
const STARTERS = [
  'Review the opening paragraph of my SOP',
  'Which documents do I need for a UK student visa?',
  'Help me shortlist universities for MSc Data Science',
  'How much should I budget per month as a student in Dublin?',
]

// Who is answering right now, and the way to ask for a person
function Handoff({ convo, onAsk, onCancel, busy }) {
  if (convo.status === 'human') {
    return <p className="handoff is-person"><UserRound size={15} aria-hidden /> <span><strong>{convo.person || 'Someone'} from the TYM team</strong> is with you. TYMAi is paused while they help.</span></p>
  }
  if (convo.status === 'waiting') {
    return (
      <p className="handoff">
        <UserRound size={15} aria-hidden />
        <span>We have communicated your queries to our support team, they will reach out to you as soon as possible.</span>
        <button type="button" className="btn-text" onClick={onCancel} disabled={busy}>Cancel</button>
      </p>
    )
  }
  return (
    <p className="handoff">
      <span>You are talking to TYMAi. Prefer a person from our team?</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onAsk} disabled={busy}><UserRound size={14} /> Talk to a person</button>
    </p>
  )
}

// Private one-to-one help. The open conversation lives in ?c= so a reload keeps your place.
export default function AiLounge() {
  useMeta({ title: 'Ask TYM AI', path: '/ai' })
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('c')) || null
  const list = useApi('/ai/conversations')
  const [messages, setMessages] = useState([])
  const [convo, setConvo] = useState(null) // { status, person } of the open conversation
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [asking, setAsking] = useState(false)
  const [draft, setDraft] = useState(() => params.get('q') || '') // the home page's Ask bar sends its question as ?q=
  const [error, setError] = useState('')
  const created = useRef(null) // a conversation this page just started: its messages are already here
  const openId = useRef(id) // the conversation on screen now, for a reply that arrives after a switch
  openId.current = id
  const log = useRef(null)
  const input = useRef(null)
  const lastId = useRef(0)

  const add = (rows) => {
    const real = rows.filter((m) => typeof m.id === 'number')
    if (real.length) lastId.current = Math.max(lastId.current, ...real.map((m) => m.id))
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      return [...prev.filter((m) => m.id !== 'pending'), ...rows.filter((m) => !seen.has(m.id))]
    })
  }
  const keep = (c) => setConvo((prev) => (prev?.status === c.status && prev?.person === c.person ? prev : { status: c.status, person: c.person }))

  useEffect(() => {
    setError('')
    if (!id) { setMessages([]); setConvo(null); lastId.current = 0; return undefined }
    let live = true
    if (created.current !== id) {
      setLoading(true)
      setMessages([])
      lastId.current = 0
      api(`/ai/conversations/${id}`)
        .then((c) => { if (live) { keep(c); add(c.messages) } })
        .catch((err) => live && setError(err.message))
        .finally(() => live && setLoading(false))
    }
    // Replies from a person arrive while you read, so keep looking
    const timer = setInterval(async () => {
      if (document.hidden || !lastId.current) return
      try {
        const fresh = await api(`/ai/conversations/${id}/messages?after=${lastId.current}`)
        if (!live) return
        if (fresh.messages.length) list.reload() // the list shows who each conversation is with
        keep(fresh)
        add(fresh.messages)
      } catch { /* the next look tries again */ }
    }, POLL_MS)
    return () => { live = false; clearInterval(timer) }
  }, [id])

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages, thinking])

  const ask = async (text) => {
    const body = text.trim()
    if (!body || thinking) return
    setDraft('')
    setError('')
    setMessages((m) => [...m, { id: 'pending', role: 'user', content: body }])
    setThinking(convo?.status !== 'human') // with a person in the conversation, TYMAi does not answer
    try {
      const res = await api('/ai/messages', { method: 'POST', body: { body, conversationId: id || undefined } })
      // They opened another conversation while waiting: the answer stays in the one it was asked in
      if (openId.current !== id) { list.reload(); return }
      keep(res.conversation)
      add(res.messages)
      if (!id) {
        created.current = res.conversation.id
        setParams({ c: res.conversation.id })
        list.reload()
      }
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== 'pending'))
      setDraft(body)
      setError(err.message)
    } finally {
      setThinking(false)
      input.current?.focus()
    }
  }

  const person = async (cancel) => {
    setAsking(true)
    setError('')
    try {
      keep(await api(`/ai/conversations/${id}/human`, { method: 'POST', body: { cancel } }))
      list.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setAsking(false)
    }
  }

  const startNew = () => { created.current = null; setParams({}); input.current?.focus() }
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.title}"?`)) return
    setError('')
    try {
      await api(`/ai/conversations/${c.id}`, { method: 'DELETE' })
      if (c.id === id) startNew()
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="container page">
      <div className="chat-shell card">
        <aside className="chat-rooms" aria-label="Your conversations">
          <button className="btn btn-ghost btn-sm btn-block" onClick={startNew}><Plus size={14} /> New conversation</button>
          {list.data?.length > 0 && <p className="eyebrow lounge-recent">Recent</p>}
          <ul className="lounge-list">
            {(list.data || []).map((c) => (
              <li key={c.id} className={c.id === id ? 'is-active' : ''}>
                <button onClick={() => { created.current = null; setParams({ c: c.id }) }} aria-current={c.id === id ? 'page' : undefined}>
                  {c.status === 'ai' ? <MessageSquare size={14} aria-hidden /> : <UserRound size={14} aria-hidden />}
                  <span>
                    <strong>{c.title}</strong>
                    <span>{c.unread && c.id !== id ? <b className="lounge-unread">New reply from the team</b> : c.status === 'human' ? 'With the TYM team' : c.status === 'waiting' ? 'Waiting for a person' : timeAgo(c.createdAt)}</span>
                  </span>
                </button>
                <button className="lounge-delete" onClick={() => remove(c)} aria-label={`Delete ${c.title}`}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
          <p className="lounge-note">Private to you and, if you ask for a person, the TYM team. TYMAi answers on studying abroad and how TYM works. The results may not be 100% correct, so always verify before you act on them and confirm anything important on official government sites.</p>
        </aside>

        <section className="chat-main is-lounge" aria-label="Ask TYM AI">
          {messages.length === 0 && !loading ? (
            <div className="lounge-empty">
              <Avatar user={TYMAI} size={48} />
              <h1>Ask TYM AI</h1>
              <p className="muted">One-to-one help with SOPs, visas and choosing a university. Answers use what students here have already shared, and your profile. You can ask for a person from our team at any point.</p>
              <div className="starter-grid">
                {STARTERS.map((s) => <button key={s} className="starter" onClick={() => ask(s)}>{s}</button>)}
              </div>
            </div>
          ) : (
            <ol className="chat-log" ref={log} aria-live="polite">
              {loading && <li className="chat-note">Loading conversation...</li>}
              {messages.map((m) => {
                const author = m.role === 'assistant' ? TYMAI : m.role === 'human' ? { displayName: m.author?.name || 'TYM team', role: 'admin' } : user
                return (
                  <li key={m.id} className={m.role === 'assistant' ? 'is-ai' : m.role === 'human' ? 'is-person' : ''}>
                    <Avatar user={author} size={32} />
                    <div>
                      <p className="chat-meta">
                        <strong>{m.role === 'assistant' ? 'TYMAi' : m.role === 'human' ? author.displayName : 'You'}</strong>
                        {m.role === 'human' && <span className="chat-team">TYM team</span>}
                      </p>
                      <RichText text={m.content} className="chat-text" />
                      <Sources items={m.sources} />
                    </div>
                  </li>
                )
              })}
              {thinking && <li className="is-ai"><Avatar user={TYMAI} size={32} /><Typing name="TYMAi" /></li>}
            </ol>
          )}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
            {id && convo && <Handoff convo={convo} busy={asking} onAsk={() => person(false)} onCancel={() => person(true)} />}
            <FormError>{error}</FormError>
            <label htmlFor="ai-msg" className="visually-hidden">Your message</label>
            <input id="ai-msg" ref={input} className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000}
              placeholder={convo?.status === 'human' ? `Reply to ${convo.person || 'the team'}...` : 'Ask about visas, SOPs, universities...'} autoComplete="off" disabled={thinking} />
            <button className="btn btn-primary" aria-label="Send" disabled={thinking || !draft.trim()}><Send size={16} /></button>
          </form>
        </section>
      </div>
    </div>
  )
}
