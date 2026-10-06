import { useState } from 'react'
import { Plus, Send } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { users } from '../data/sample'

const STARTERS = [
  'Review the opening paragraph of my SOP',
  'Which documents do I need for a UK student visa?',
  'Help me shortlist universities for MSc Data Science',
  'Explain the Graduate Route after a UK master\'s',
]

const HISTORY = ['UK visa funds check', 'SOP draft, second pass', 'Leeds vs Sheffield']

// Phase 4: POST /api/ai/conversations/<id>/messages
export default function AiLounge() {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')

  const ask = (text) => {
    if (!text.trim()) return
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: 'This is a preview. Once connected, TYMAi will answer here with guidance tailored to your profile, target country and course.' },
    ])
    setDraft('')
  }

  return (
    <div className="container page">
      <div className="chat-shell card">
        <aside className="chat-rooms">
          <button className="btn btn-ghost btn-sm btn-block" onClick={() => setMessages([])}><Plus size={14} /> New conversation</button>
          <p className="eyebrow" style={{ marginTop: 16 }}>Recent</p>
          {HISTORY.map((h) => <a key={h} href="#" onClick={(e) => e.preventDefault()}><strong>{h}</strong></a>)}
          <p className="lounge-note">Private to you. TYMAi can make mistakes, so confirm visa rules on official government sites.</p>
        </aside>

        <section className="chat-main" aria-label="AI Counsellor">
          {messages.length === 0 ? (
            <div className="lounge-empty">
              <Avatar user={users.tymai} size={48} />
              <h1>AI Counsellor Lounge</h1>
              <p className="muted">One-to-one help with SOPs, visas and choosing a university. Start with one of these or ask your own.</p>
              <div className="starter-grid">
                {STARTERS.map((s) => <button key={s} className="starter" onClick={() => ask(s)}>{s}</button>)}
              </div>
            </div>
          ) : (
            <ol className="chat-log">
              {messages.map((m, i) => (
                <li key={i} className={m.role === 'assistant' ? 'is-ai' : ''}>
                  <Avatar user={m.role === 'assistant' ? users.tymai : users.aisha} size={32} />
                  <div>
                    <p className="chat-meta"><strong>{m.role === 'assistant' ? 'TYMAi' : 'You'}</strong></p>
                    <p>{m.content}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
            <label htmlFor="ai-msg" className="visually-hidden">Ask TYMAi</label>
            <input id="ai-msg" className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about visas, SOPs, universities..." />
            <button className="btn btn-primary" aria-label="Send"><Send size={16} /></button>
          </form>
        </section>
      </div>
    </div>
  )
}
