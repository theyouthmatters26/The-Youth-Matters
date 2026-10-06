import { useState } from 'react'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import './ui.css'

// Phase 2: PUT /api/votes. For now the vote is kept in local state.
export default function VoteControl({ score, horizontal = false }) {
  const [vote, setVote] = useState(0)
  const toggle = (v) => setVote(vote === v ? 0 : v)

  return (
    <div className={`vote ${horizontal ? 'vote-row' : ''}`}>
      <button aria-label="Upvote" aria-pressed={vote === 1} onClick={() => toggle(1)}>
        <ArrowBigUp size={20} strokeWidth={1.6} fill={vote === 1 ? 'currentColor' : 'none'} />
      </button>
      <span className="vote-score mono">{score + vote}</span>
      <button aria-label="Downvote" aria-pressed={vote === -1} onClick={() => toggle(-1)}>
        <ArrowBigDown size={20} strokeWidth={1.6} fill={vote === -1 ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
