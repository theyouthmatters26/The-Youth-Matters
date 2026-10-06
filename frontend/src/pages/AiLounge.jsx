import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquare, Plus, Send, Trash2 } from 'lucide-react'
import RichText from '../components/feed/RichText'
import Avatar from '../components/ui/Avatar'
import { FormError } from '../components/auth/fields'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useMeta } from '../lib/meta'
import { Sources, Typing } from './Chatrooms'

const TYMAI = { displayName: 'TYMAi', role: 'bot' }
const STARTERS = [
  'Review the opening paragraph of my SOP',
  'Which documents do I need for a UK student visa?',
  'Help me shortlist universities for MSc Data Science',
  'How much should I budget per month as a student in Dublin?',
]

// Private one-to-one help. The open conversation lives in ?c= so a reload keeps your place.
export default function AiLounge() {
  useMeta({ title: 'Ask TYM AI', path: '/ai' })
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('c')) || null
  const list = useApi('/ai/conversations')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const created = useRef(null) // a conversation this page just started: its messages are already here
  const log = useRef(null)
  const input = useRef(null)

  useEffect(() => {
    setError('')
    if (!id) { setMessages([]); return }
    if (created.current === id) return
    let live = true
    setLoading(true)
    api(`/ai/conversations/${id}`)
      .then((c) => live && setMessages(c.messages))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [id])

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages, thinking])

  const ask = async (text) => {
    const body = text.trim()
    if (!body || thinking) return
    setDraft('')
    setError('')
    setMessages((m) => [...m, { id: 'pending', role: 'user', content: body }])
    setThinking(true)
    try {
      const res = await api('/ai/messages', { method: 'POST', body: { body, conversationId: id || undefined } })
      setMessages((m) => [...m.filter((x) => x.id !== 'pending'), ...res.messages])
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

  const startNew = () => { created.current = null; setParams({}); input.current?.focus() }
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.title}"?`)) return
    await api(`/ai/conversations/${c.id}`, { method: 'DELETE' })
    if (c.id === id) startNew()
    list.reload()
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
                  <MessageSquare size={14} aria-hidden />
                  <span><strong>{c.title}</strong><span>{timeAgo(c.createdAt)}</span></span>
                </button>
                <button className="lounge-delete" onClick={() => remove(c)} aria-label={`Delete ${c.title}`}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
          <p className="lounge-note">Private to you. TYMAi can make mistakes, so confirm visa rules on official government sites.</p>
        </aside>

        <section className="chat-main is-lounge" aria-label="Ask TYM AI">
          {messages.length === 0 && !loading ? (
            <div className="lounge-empty">
              <Avatar user={TYMAI} size={48} />
              <h1>Ask TYM AI</h1>
              <p className="muted">One-to-one help with SOPs, visas and choosing a university. Answers use what students here have already shared, and your profile.</p>
              <div className="starter-grid">
                {STARTERS.map((s) => <button key={s} className="starter" onClick={() => ask(s)}>{s}</button>)}
              </div>
            </div>
          ) : (
            <ol className="chat-log" ref={log} aria-live="polite">
              {loading && <li className="chat-note">Loading conversation...</li>}
              {messages.map((m) => (
                <li key={m.id} className={m.role === 'assistant' ? 'is-ai' : ''}>
                  <Avatar user={m.role === 'assistant' ? TYMAI : user} size={32} />
                  <div>
                    <p className="chat-meta"><strong>{m.role === 'assistant' ? 'TYMAi' : 'You'}</strong></p>
                    <RichText text={m.content} className="chat-text" />
                    <Sources items={m.sources} />
                  </div>
                </li>
              ))}
              {thinking && <li className="is-ai"><Avatar user={TYMAI} size={32} /><Typing name="TYMAi" /></li>}
            </ol>
          )}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
            <FormError>{error}</FormError>
            <label htmlFor="ai-msg" className="visually-hidden">Ask TYMAi</label>
            <input id="ai-msg" ref={input} className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000}
              placeholder="Ask about visas, SOPs, universities..." autoComplete="off" disabled={thinking} />
            <button className="btn btn-primary" aria-label="Send" disabled={thinking || !draft.trim()}><Send size={16} /></button>
          </form>
        </section>
      </div>
    </div>
  )
}
