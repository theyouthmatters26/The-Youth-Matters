import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, Lock, RotateCcw, Video } from 'lucide-react'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatMoney } from '../../lib/format'
import { FormError, Spinner } from '../auth/fields'
import { city, dayKey, downloadIcs, formatDay, formatTime, loadRazorpay, viewerZone, zoneName } from './booking'
import './mentors.css'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const keyOf = (d) => d.toLocaleDateString('en-CA')

function Calendar({ month, onMonth, days, selected, onSelect, first, last }) {
  const start = monthStart(month)
  const lead = (start.getDay() + 6) % 7 // Monday first
  const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), i + 1))]
  const canBack = start > monthStart(first)
  const canForward = start < monthStart(last)

  return (
    <div className="cal">
      <div className="cal-head">
        <strong>{start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong>
        <div>
          <button className="icon-btn" onClick={() => onMonth(-1)} disabled={!canBack} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => onMonth(1)} disabled={!canForward} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="cal-grid" role="grid" aria-label="Choose a day">
        {WEEKDAYS.map((w) => <span key={w} className="cal-weekday" aria-hidden>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />
          const key = keyOf(d)
          const open = days.has(key)
          return (
            <button key={key} className={`cal-day${open ? ' is-open' : ''}${selected === key ? ' is-selected' : ''}${key === keyOf(new Date()) ? ' is-today' : ''}`}
              disabled={!open} aria-pressed={selected === key} onClick={() => onSelect(key)}
              aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${open ? ', times available' : ''}`}>
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Booked({ booking }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(booking.meetingUrl); setCopied(true) } catch { /* clipboard blocked */ }
  }
  return (
    <div className="book-done" role="status">
      <span className="book-done-mark" aria-hidden><Check size={22} /></span>
      <h3>You are booked with {booking.mentor.user.displayName.split(' ')[0]}</h3>
      <p className="book-done-when">{formatDay(booking.startsAt)}<br />{formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}</p>
      <div className="book-done-actions">
        <button className="btn btn-primary btn-sm" onClick={() => downloadIcs(booking)}><CalendarPlus size={15} /> Add to calendar</button>
        <button className="btn btn-ghost btn-sm" onClick={copy}><Copy size={15} /> {copied ? 'Link copied' : 'Copy join link'}</button>
      </div>
      <p className="book-fine">We emailed you the details{booking.invoiceNumber ? `, receipt ${booking.invoiceNumber}` : ''}. Your sessions are always in <Link to="/my?tab=Sessions" className="link">My TYM</Link>.</p>
    </div>
  )
}

export default function BookingPanel({ mentor }) {
  const { user, account } = useAuth()
  const location = useLocation()
  const availability = useApi(`/mentors/${mentor.id}/availability`)
  const slots = availability.data?.slots || []
  const byDay = useMemo(() => slots.reduce((acc, s) => {
    (acc[dayKey(s.startsAt)] ||= []).push(s)
    return acc
  }, {}), [slots])
  const openDays = useMemo(() => new Set(Object.keys(byDay)), [byDay])

  const [monthOffset, setMonthOffset] = useState(0)
  const [day, setDay] = useState(null)
  const [slot, setSlot] = useState(null)
  const [stage, setStage] = useState('pick') // pick -> details -> done
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [booked, setBooked] = useState(null)

  const first = slots.length ? new Date(slots[0].startsAt) : new Date()
  const last = slots.length ? new Date(slots[slots.length - 1].startsAt) : new Date()
  const month = new Date(first.getFullYear(), first.getMonth() + monthOffset, 1)
  const price = formatMoney(mentor.priceMinor, mentor.currency)
  const firstName = mentor.user.displayName.split(' ')[0]

  const checkout = async (res) => {
    await loadRazorpay()
    const c = res.checkout
    const rzp = new window.Razorpay({
      key: c.key, order_id: c.orderId, amount: c.amount, currency: c.currency,
      name: c.name, description: c.description, prefill: c.prefill,
      theme: { color: '#0b0b0c' },
      handler: async (paid) => {
        setBusy(true)
        try {
          const { booking } = await api(`/bookings/${res.booking.id}/verify`, { method: 'POST', body: paid })
          setBooked(booking)
          setStage('done')
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      },
      modal: {
        ondismiss: () => setNote(`Payment not finished. We are holding ${formatTime(slot.startsAt)} for you until ${formatTime(res.booking.holdExpiresAt)}.`),
      },
    })
    rzp.on('payment.failed', (r) => setError(`${r.error?.description || 'The payment did not go through.'} No money was taken. Try again or use another method.`))
    rzp.open()
  }

  const pay = async () => {
    setBusy(true)
    setError('')
    setNote('')
    try {
      const res = await api('/bookings', { method: 'POST', body: { slotId: slot.id, topic, timezone: viewerZone } })
      await checkout(res)
    } catch (e) {
      setError(e.message)
      if (e.status === 409) {
        availability.reload()
        setStage('pick')
        setSlot(null)
      }
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'done') return <aside className="book" aria-label="Your booking"><Booked booking={booked} /></aside>

  return (
    <aside className="book" id="book" aria-label={`Book a session with ${firstName}`}>
      <header className="book-head">
        <p className="book-price">{price}<span> / {mentor.sessionMinutes} min</span></p>
        <p className="book-sub"><Video size={15} aria-hidden /> One-to-one video call</p>
      </header>

      {stage === 'pick' && (
        <>
          {availability.loading && <div className="book-loading"><Spinner /> Loading open times</div>}
          {availability.error && (
            <div className="stack">
              <FormError>{availability.error.message}</FormError>
              <button className="btn btn-ghost btn-sm" onClick={availability.reload}><RotateCcw size={15} /> Try again</button>
            </div>
          )}
          {availability.data && !slots.length && (
            <p className="book-empty">{firstName} has no open times in the next three weeks. Check back soon, new times open every day.</p>
          )}
          {slots.length > 0 && (
            <>
              <Calendar month={month} first={first} last={last} days={openDays} selected={day}
                onMonth={(n) => setMonthOffset(monthOffset + n)} onSelect={(k) => { setDay(k); setSlot(null) }} />

              {day ? (
                <div className="book-times">
                  <p className="book-label">{formatDay(byDay[day][0].startsAt)}</p>
                  <div className="time-grid">
                    {byDay[day].map((s) => (
                      <button key={s.id} className={`time${slot?.id === s.id ? ' is-on' : ''}`} aria-pressed={slot?.id === s.id}
                        onClick={() => setSlot(s)}>{formatTime(s.startsAt)}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="book-hint">Pick a day to see the times. Days in bold have open slots.</p>
              )}
              <p className="book-zone">Times in {zoneName()}</p>
              <button className="btn btn-primary btn-block" disabled={!slot} onClick={() => setStage('details')}>
                {slot ? `Continue with ${formatTime(slot.startsAt)}` : 'Choose a time'}
              </button>
            </>
          )}
        </>
      )}

      {stage === 'details' && slot && (
        <div className="book-details">
          <button className="book-back" onClick={() => { setStage('pick'); setError(''); setNote('') }}><ArrowLeft size={15} /> Change time</button>
          <div className="book-summary">
            <strong>{formatDay(slot.startsAt)}</strong>
            <span>{formatTime(slot.startsAt)} – {formatTime(slot.endsAt)} · {zoneName()}</span>
            <span className="faint">{formatTime(slot.startsAt, mentor.timezone)} for {firstName} in {city(mentor.timezone)}</span>
          </div>
          <div className="field">
            <label htmlFor="topic">What would you like to cover? <span className="faint">Optional</span></label>
            <textarea id="topic" className="textarea" rows={4} maxLength={1000} value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder={`For example: "Can you look at my SOP opening and my funds evidence?" ${firstName} reads this before the call.`} />
          </div>
          <div className="book-total"><span>Total</span><strong>{price}</strong></div>

          <FormError>{error}</FormError>
          {note && <p className="book-note" role="status">{note}</p>}

          {user ? (
            <button className="btn btn-primary btn-block" onClick={pay} disabled={busy}>
              {busy ? <><Spinner /> Opening secure payment</> : <><Lock size={15} /> Pay {price}</>}
            </button>
          ) : account ? (
            <Link to="/register" state={{ from: location.pathname }} className="btn btn-primary btn-block">Finish verifying to book</Link>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              <Link to="/register" state={{ from: location.pathname }} className="btn btn-primary btn-block">Create a free account to book</Link>
              <p className="book-fine" style={{ textAlign: 'center' }}>Already a member? <Link to="/login" state={{ from: location.pathname }} className="link">Log in</Link></p>
            </div>
          )}
          <p className="book-fine">Secure checkout by Razorpay: UPI, cards, net banking and wallets. Free cancellation up to 24 hours before, refunded in full.</p>
        </div>
      )}
    </aside>
  )
}
