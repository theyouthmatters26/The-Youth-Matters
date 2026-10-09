import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatMoney } from '../../lib/format'
import { FormError, Spinner } from '../auth/fields'
import { hoursText, loadRazorpay } from './booking'
import './mentors.css'

// Counselling hours on sale: the same price whichever mentor they are spent on. Anyone can see them;
// buying needs a verified account. onBought(minutes) runs once the hours are on the balance.
export default function Packages({ onBought }) {
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
      const { paymentId, checkout: c } = await api(`/packages/${p.id}/order`, { method: 'POST' })
      await loadRazorpay()
      const rzp = new window.Razorpay({
        key: c.key, order_id: c.orderId, amount: c.amount, currency: c.currency,
        name: c.name, description: c.description, prefill: c.prefill, theme: { color: '#0b0b0c' },
        handler: async (paid) => {
          setBusy(p.id)
          try {
            const res = await api(`/packages/payments/${paymentId}/verify`, { method: 'POST', body: paid })
            setAccount({ ...account, counselingMinutes: res.counselingMinutes })
            setDone(`${hoursText(p.hours * 60)} added. You now have ${hoursText(res.counselingMinutes)}.`)
            onBought?.(res.counselingMinutes)
          } catch (e) {
            setProblem(e.message)
          } finally {
            setBusy(null)
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      })
      rzp.on('payment.failed', (r) => setProblem(`${r.error?.description || 'The payment did not go through.'} No money was taken. Try again or use another method.`))
      rzp.open()
    } catch (e) {
      setProblem(e.message)
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
              {user ? (
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
      <p className="book-fine">Hours work with every TYM mentor and do not expire. Secure checkout by Razorpay: UPI, cards, net banking and wallets.</p>
    </div>
  )
}
