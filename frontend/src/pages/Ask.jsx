import { useLocation } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import Composer from '../components/feed/Composer'
import { useMeta } from '../lib/meta'

const TIPS = [
  'Ask one clear question in the title, like you would ask a friend.',
  'Say your course, university and intake, so answers fit your situation.',
  'Mention what you already tried or read. People can then skip the basics.',
  'Never share passport numbers, bank details or phone numbers.',
]

export default function Ask() {
  const location = useLocation() // "Ask a question" on a country page pre-selects that country
  useMeta({ title: 'Ask the community', path: '/ask' })
  return (
    <div className="container page ask-page">
      <header className="page-head">
        <h1>Ask the community</h1>
        <p>Students who made the move last year answer most questions within a few hours.</p>
      </header>
      <div className="ask-grid">
        <Composer full country={location.state?.country} />
        <aside className="ask-tips card card-pad" aria-label="Tips for a good question">
          <h2 className="section-title">Get a good answer faster</h2>
          <ul>{TIPS.map((t) => <li key={t}><CheckCircle2 size={16} aria-hidden /> {t}</li>)}</ul>
        </aside>
      </div>
    </div>
  )
}
