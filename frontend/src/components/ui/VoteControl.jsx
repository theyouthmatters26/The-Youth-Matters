import { useState } from 'react'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'
import { api } from '../../lib/api'
import { useMemberGuard } from '../../lib/auth'
import './ui.css'

// Up / down votes on a post or answer. The number changes at once; if the server says no, it
// goes back. Clicking your current vote again removes it.
export default function VoteControl({ type, id, score: initialScore, myVote: initialVote = 0, horizontal = false }) {
  const guard = useMemberGuard()
  const [vote, setVote] = useState(initialVote)
  const [score, setScore] = useState(initialScore)
  const [busy, setBusy] = useState(false)

  const cast = async (value) => {
    if (!guard() || busy) return
    const next = vote === value ? 0 : value
    const before = { vote, score }
    setVote(next)
    setScore(score - vote + next)
    setBusy(true)
    try {
      const res = await api('/votes', { method: 'PUT', body: { targetType: type, targetId: id, value: next } })
      setScore(res.score)
      setVote(res.myVote)
    } catch {
      setVote(before.vote)
      setScore(before.score)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`vote ${horizontal ? 'vote-row' : ''}${vote ? ` is-${vote > 0 ? 'up' : 'down'}` : ''}`}>
      <button aria-label="Upvote" aria-pressed={vote === 1} onClick={() => cast(1)}>
        <ArrowBigUp size={20} strokeWidth={1.6} fill={vote === 1 ? 'currentColor' : 'none'} />
      </button>
      <span className="vote-score mono" aria-live="polite">{score}</span>
      <button aria-label="Downvote" aria-pressed={vote === -1} onClick={() => cast(-1)}>
        <ArrowBigDown size={20} strokeWidth={1.6} fill={vote === -1 ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
