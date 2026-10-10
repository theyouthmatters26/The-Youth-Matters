import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Check, CircleCheck, Clock, MessageSquare, Star, Video } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { FormError, Spinner } from '../auth/fields'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { downloadIcs, formatDay, formatTime, hoursText } from './booking'
import { chatLink } from './MentorChat'
import Packages from './Packages'
import './mentors.css'

const DAY = 24 * 3600_000

// Where the private chat for this session stands. A mentor accepts the request from here, the way
// they can from Messages; a student sees whether theirs has been opened yet.
function ChatButton({ chat, who, account, b, giving }) {
  const first = who.displayName.split(' ')[0]
  const to = chatLink(account.username, b.mentor.id, giving ? b.student.id : account.id)
  if (giving && chat?.status === 'pending') {
    return <Link to={to} className="btn btn-primary btn-sm"><Check size={15} /> Accept chat request</Link>
  }
  if (!giving && chat?.status === 'pending') {
    return <span className="faint session-meta"><Clock size={14} /> Waiting for {first} to open your chat</span>
  }
  if (chat?.status === 'declined') {
    return <span className="faint session-meta">No chat before this one: you meet on the call.</span>
  }
  return (
    <Link to={to} className="btn btn-ghost btn-sm">
      <MessageSquare size={15} /> {chat ? `Chat with ${first}` : `Message ${first}`}
      {chat?.unread > 0 && <span className="session-unread">{chat.unread}</span>}
    </Link>
  )
}

function ReviewForm({ booking, onDone }) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/bookings/${booking.id}/review`, { method: 'POST', body: { rating, body } })
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <form className="session-review" onSubmit={submit}>
      <div className="star-pick" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`}
            className={n <= rating ? 'is-on' : ''} onClick={() => setRating(n)}><Star size={20} /></button>
        ))}
      </div>
      <textarea className="textarea" rows={3} maxLength={1000} required minLength={10} value={body} onChange={(e) => setBody(e.target.value)}
        placeholder={`What helped most? Your review is shown on ${booking.mentor.user.displayName.split(' ')[0]}'s profile.`} />
      <FormError>{error}</FormError>
      <button className="btn btn-primary btn-sm" disabled={!rating || body.trim().length < 10 || busy}>
        {busy ? <><Spinner /> Posting</> : 'Post review'}
      </button>
    </form>
  )
}

function Session({ b, chat, onChange }) {
  const { account } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const now = Date.now()
  const start = new Date(b.startsAt).getTime()
  const upcoming = b.status === 'confirmed' && new Date(b.endsAt).getTime() > now
  const past = b.status === 'completed' || (b.status === 'confirmed' && !upcoming)
  // A session this person gives as the mentor: the other person is the student, and only the student can cancel or review
  const giving = Boolean(b.asMentor)
  const who = giving ? b.student : b.mentor.user
  const to = giving ? `/u/${b.student.username}` : `/mentors/${b.mentor.id}`
  const canCancel = !giving && upcoming && start - now > DAY

  // The mentor closes the session once the conversation is finished
  const endSession = async () => {
    setBusy(true)
    setError('')
    try {
      await api(`/bookings/${b.id}/end`, { method: 'POST' })
      onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    setError('')
    try {
      await api(`/bookings/${b.id}/cancel`, { method: 'POST' })
      onChange()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  // Somebody who deleted their account keeps their booking on the books, with nothing of them left
  const gone = who.username?.startsWith('deleted')
  return (
    <li className="session">
      {gone ? <Avatar user={who} size={48} /> : <Link to={to}><Avatar user={who} size={48} /></Link>}
      <div className="session-main">
        <p className="session-who">
          {gone ? <span>{giving ? 'With a member who has left' : who.displayName}</span>
            : <Link to={to}>{giving ? `With ${who.displayName}` : who.displayName}</Link>}
          <span className={`session-status is-${upcoming ? 'upcoming' : past ? 'past' : 'cancelled'}`}>
            {upcoming ? 'Upcoming' : past ? 'Completed' : 'Cancelled'}
          </span>
        </p>
        <p className="session-when">{formatDay(b.startsAt)} · {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
          <span className="faint"> · in your chat</span></p>
        {b.session === 'live' && <p className="session-live">Your session is on now. Talk in the chat below.</p>}
        {b.session === 'overtime' && (
          <p className="session-live">The booked time is up.{giving ? ' End the session when you are done.'
            : ' Your mentor will close it when you are both done.'}</p>
        )}
        {b.topic && <p className="session-topic">{giving && 'They want to cover: '}“{b.topic}”</p>}
        {b.note && <p className="faint">{b.note}</p>}
        {!giving && <p className="faint session-meta">{hoursText(b.minutes)} of counselling</p>}

        <FormError>{error}</FormError>
        <div className="session-actions">
          {/* A session is time in the chat. A video call only exists if the mentor shared a link. */}
          {upcoming && b.meetingUrl && (
            <a href={b.meetingUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><Video size={15} /> Join call</a>
          )}
          {giving && ['live', 'overtime'].includes(b.session) && (
            <button className="btn btn-ghost btn-sm" onClick={endSession} disabled={busy}>
              {busy ? <Spinner /> : <CircleCheck size={15} />} End session
            </button>
          )}
          {/* The calendar entry is named after the other person, which downloadIcs reads from mentor.user */}
          {upcoming && <button className="btn btn-ghost btn-sm" onClick={() => downloadIcs(giving ? { ...b, mentor: { user: who } } : b)}><CalendarPlus size={15} /> Add to calendar</button>}
          {b.status !== 'cancelled' && !gone && <ChatButton chat={chat} who={who} account={account} b={b} giving={giving} />}
          {canCancel && !confirming && <button className="btn-text" onClick={() => setConfirming(true)}>Cancel session</button>}
          {canCancel && confirming && (
            <span className="session-confirm">
              Cancel and get {hoursText(b.minutes)} back?
              <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>{busy ? <Spinner /> : 'Yes, cancel'}</button>
              <button className="btn-text" onClick={() => setConfirming(false)}>Keep it</button>
            </span>
          )}
          {!giving && upcoming && !canCancel && <span className="faint session-meta">Less than 24 hours to go, so it can no longer be cancelled.</span>}
          {!giving && past && !b.reviewed && !reviewing && <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(true)}><Star size={15} /> Leave a review</button>}
          {!giving && past && b.reviewed && <span className="faint session-meta">Thanks for your review.</span>}
        </div>
        {reviewing && <ReviewForm booking={b} onDone={onChange} />}
      </div>
    </li>
  )
}

// What the member has to spend, and where to get more
function Hours() {
  const { account } = useAuth()
  const [buying, setBuying] = useState(false)
  const minutes = account?.counselingMinutes || 0
  return (
    <section className="card card-pad hours" aria-label="Your counselling hours">
      <div className="hours-row">
        <div>
          <p className="eyebrow">Counselling hours</p>
          <p className="hours-balance display">{hoursText(minutes)}</p>
          <p className="faint">{minutes ? 'Ready to book with any TYM mentor.' : 'Buy hours, then book any TYM mentor with them.'}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setBuying(!buying)}>{buying ? 'Close' : 'Buy hours'}</button>
      </div>
      {buying && <Packages />}
    </section>
  )
}

export default function MySessions() {
  const { account } = useAuth()
  const { data, error, loading, reload } = useApi('/bookings')
  const chats = useApi('/mentor-chats').data || []
  const chatFor = (b, giving) => chats.find((c) => c.mentorId === b.mentor.id
    && c.studentId === (giving ? b.student?.id : account.id))
  if (loading) return <p className="muted session-empty"><Spinner /> Loading your sessions</p>
  if (error) return <FormError>{error.message}</FormError>
  if (!data.length) {
    return account?.role === 'mentor' ? (
      <div className="empty card">
        <h2 className="display">No sessions yet</h2>
        <p className="muted">When a student books you, the session appears here with their name, the time and what they want to cover. Accept their chat request and you talk in Messages at that time.</p>
      </div>
    ) : (
      <div className="stack">
        <Hours />
        <div className="empty card">
          <h2 className="display">No sessions yet</h2>
          <p className="muted">Book a one-to-one with a student who has already done what you are planning.</p>
          <Link to="/mentors" className="btn btn-primary btn-sm">Find a mentor</Link>
        </div>
      </div>
    )
  }
  // Upcoming first (soonest at the top), then past sessions (latest first), cancelled last
  const now = Date.now()
  const rank = (b) => (b.status === 'completed' ? 1 : b.status !== 'confirmed' ? 2 : new Date(b.endsAt) > now ? 0 : 1)
  const sorted = [...data].sort((a, b) => rank(a) - rank(b) ||
    (rank(a) === 0 ? new Date(a.startsAt) - new Date(b.startsAt) : new Date(b.startsAt) - new Date(a.startsAt)))
  const list = (rows) => <ul className="sessions">{rows.map((b) => <Session key={b.id} b={b} chat={chatFor(b, Boolean(b.asMentor))} onChange={reload} />)}</ul>
  // A mentor's own sessions with students come first, apart from any they booked as a student
  const giving = sorted.filter((b) => b.asMentor)
  const booked = sorted.filter((b) => !b.asMentor)
  if (!giving.length) return <div className="stack"><Hours />{list(booked)}</div>
  return (
    <div className="stack">
      {booked.length > 0 && <Hours />}
      <h2 className="eyebrow">Sessions you are giving</h2>
      {list(giving)}
      {booked.length > 0 && <h2 className="eyebrow">Sessions you booked</h2>}
      {booked.length > 0 && list(booked)}
    </div>
  )
}
