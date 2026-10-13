import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatMoney } from '../../lib/format'
import { FormError, Spinner } from '../auth/fields'
import { buyHours, hoursText } from './booking'
import './mentors.css'

// Counselling hours on sale: the same price whichever mentor they are spent on. Anyone can see them;
// buying needs a verified account. onBought(minutes) runs once the hours are on the balance.
// `book` is for the pages where there is no checkout yet: the card leads to the booking form and
// our team arranges payment by hand. `mentorId` asks for that mentor on the way in.
export default function Packages({ onBought, book, mentorId }) {
  const { user, account, setAccount } = useAuth()
  const location = useLocation()
  const { data, error, loading } = useApi('/packages')
  const [busy, setBusy] = useState(null)
  const [problem, setProblem] = useState('')
  const [done, setDone] = useState('')

  const buy = async (p) => {
    setBusy(p.id)
    setProblem('')
    setDone('')
    try {
      const res = await buyHours(p.id)
      setAccount({ ...account, counselingMinutes: res.counselingMinutes })
      setDone(`${hoursText(p.hours * 60)} added. You now have ${hoursText(res.counselingMinutes)}.`)
      onBought?.(res.counselingMinutes)
    } catch (e) {
      setProblem(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="muted"><Spinner /> Loading packages</p>
  if (error) return <FormError>{error.message}</FormError>
  if (!data.length) return <p className="muted">Counselling hours are not on sale just now. Please check back soon.</p>
  const perHour = (p) => p.priceMinor / p.hours
  const dearest = Math.max(...data.map(perHour))

  return (
    <div className="packages">
      <ul className="package-list">
        {data.map((p) => {
          const saving = Math.round((1 - perHour(p) / dearest) * 100)
          return (
            <li key={p.id} className="package">
              <p className="package-hours">{hoursText(p.hours * 60)}</p>
              <p className="package-price">{formatMoney(p.priceMinor, p.currency)}</p>
              <p className="faint package-note">
                {p.hours > 1 ? `${formatMoney(perHour(p), p.currency)} an hour${saving > 0 ? ` · save ${saving}%` : ''}` : 'One session with any mentor'}
              </p>
              {book ? (
                <Link to={`/book-a-session?plan=${p.id}${mentorId ? `&mentor=${mentorId}` : ''}`}
                  className="btn btn-primary btn-sm btn-block">
                  Book a session
                </Link>
              ) : user ? (
                <button className="btn btn-primary btn-sm btn-block" onClick={() => buy(p)} disabled={busy !== null}>
                  {busy === p.id ? <><Spinner /> Opening secure payment</> : <><Lock size={14} /> Buy {hoursText(p.hours * 60)}</>}
                </button>
              ) : (
                <Link to={account ? '/register' : '/login'} state={{ from: location.pathname }} className="btn btn-ghost btn-sm btn-block">
                  {account ? 'Finish verifying to buy' : 'Log in to buy'}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      <FormError>{problem}</FormError>
      {done && <p className="book-note" role="status">{done}</p>}
      <p className="book-fine">Hours work with every TYM mentor and do not expire.{book
        ? ' Tell us what you need and our team confirms your mentor, your time and how to pay.'
        : ' Secure checkout by Cashfree: UPI, cards and net banking.'}</p>
    </div>
  )
}
