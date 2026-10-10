import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCheck, Clock, Info, Send, ShieldCheck, Video, X } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { FormError, Spinner } from '../auth/fields'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { timeAgo } from '../../lib/format'
import './mentors.css'

const POLL_MS = 4000
export const chatLink = (username, mentorId, studentId) => `/u/${username}?tab=Messages&with=${mentorId}-${studentId}`

const dayOf = (iso) => new Date(iso).toDateString()
const dayLabel = (iso) => {
  const day = dayOf(iso)
  const today = new Date()
  if (day === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (day === yesterday.toDateString()) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}
const clockTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// A video call link in a message becomes a button to join it. Only mentors can send one, so a link
// in this chat always came from the mentor (the server refuses a student's).
function MeetingCard({ url, mine }) {
  return (
    <a className="mchat-meet" href={url} target="_blank" rel="noopener noreferrer">
      <span className="mchat-meet-icon" aria-hidden><Video size={18} /></span>
      <span>
        <strong>{mine ? 'You shared the call link' : 'Join the video call'}</strong>
        <span className="faint">{url.replace(/^https?:\/\//, '')}</span>
      </span>
    </a>
  )
}

// What the mentor sees while a paid request is waiting, and what the student sees meanwhile.
function Request({ c, onDecide }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const first = c.with.displayName.split(' ')[0]

  const decide = (decision) => async () => {
    setBusy(decision)
    setError('')
    try {
      onDecide(await api(`/mentor-chats/${c.mentorId}/${c.studentId}/${decision}`, { method: 'POST' }))
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  if (c.status === 'declined') {
    return (
      <div className="mchat-request" role="status">
        <span className="mchat-request-icon" aria-hidden><X size={18} /></span>
        <h3>This chat is closed</h3>
        <p className="muted">{c.asMentor
          ? `You turned down ${first}'s chat request. Your session with them still stands, and a new booking asks again.`
          : `${first} could not open a chat before your session. You will still meet on the video call at the time you booked.`}</p>
      </div>
    )
  }
  if (!c.asMentor) {
    return (
      <div className="mchat-request" role="status">
        <span className="mchat-request-icon" aria-hidden><Clock size={18} /></span>
        <h3>Waiting for {first} to open the chat</h3>
        <p className="muted">Your session is booked and paid for. {first} opens the chat from their dashboard,
          usually within a day, and you will get an email when they do.</p>
        {c.requestNote && <blockquote className="mchat-note">{c.requestNote}</blockquote>}
      </div>
    )
  }
  return (
    <div className="mchat-request is-mentor">
      <span className="mchat-request-icon" aria-hidden><Clock size={18} /></span>
      <h3>{first} booked a session and would like to chat</h3>
      <p className="muted">Accept to open a private chat with them before the call. You can share the video
        call link here once it is open.</p>
      {c.requestNote && <blockquote className="mchat-note">{c.requestNote}</blockquote>}
      <FormError>{error}</FormError>
      <div className="mchat-request-actions">
        <button className="btn btn-primary btn-sm" onClick={decide('accept')} disabled={!!busy}>
          {busy === 'accept' ? <Spinner /> : <Check size={15} />} Accept and open chat
        </button>
        <button className="btn btn-ghost btn-sm" onClick={decide('decline')} disabled={!!busy}>
          <X size={15} /> Not now
        </button>
      </div>
    </div>
  )
}

// Mentors only: share the link for the call. Students never send links, so whatever is in the chat is theirs.
function ShareMeeting({ c, onShared }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(c.meetingUrl || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const share = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onShared(await api(`/mentor-chats/${c.mentorId}/${c.studentId}/meeting`, { method: 'POST', body: { url: url.trim() } }))
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="btn btn-ghost btn-sm mchat-share" onClick={() => setOpen(true)}>
        <Video size={15} /> {c.meetingUrl ? 'Share the call link again' : 'Share the call link'}
      </button>
    )
  }
  return (
    <form className="mchat-share-form" onSubmit={share}>
      <label htmlFor="mchat-meet" className="visually-hidden">Video call link</label>
      <input id="mchat-meet" className="input" value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="https://meet.google.com/..." autoComplete="off" autoFocus />
      <button className="btn btn-primary btn-sm" disabled={busy || !url.trim()}>{busy ? <Spinner /> : 'Share'}</button>
      <button type="button" className="btn-text" onClick={() => setOpen(false)}>Cancel</button>
      <FormError>{error}</FormError>
    </form>
  )
}

// The booked session itself: time in this chat. The mentor closes it when they are done.
function SessionBar({ session, asMentor, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!['live', 'overtime', 'upcoming'].includes(session.state)) return null

  const end = async () => {
    setBusy(true)
    setError('')
    try {
      await api(`/bookings/${session.id}/end`, { method: 'POST' })
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const when = new Date(session.startsAt).toLocaleString('en-GB',
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div className={`mchat-session is-${session.state}`} role="status">
      <span>
        {session.state === 'upcoming' && <><Clock size={14} aria-hidden /> Your {session.minutes} minute session is on {when}. You can write before then.</>}
        {session.state === 'live' && <><Clock size={14} aria-hidden /> Your session is on now, until {new Date(session.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.</>}
        {session.state === 'overtime' && <><Clock size={14} aria-hidden /> The booked time is up.{asMentor ? ' End it when you are done.' : ' Your mentor will close it when you are both done.'}</>}
      </span>
      {asMentor && session.state !== 'upcoming' && (
        <button className="btn btn-ghost btn-sm" onClick={end} disabled={busy}>{busy ? <Spinner /> : 'End session'}</button>
      )}
      <FormError>{error}</FormError>
    </div>
  )
}

// One conversation. Polls for new messages, the way the public chat rooms do.
function Thread({ c, onBack, onChanged }) {
  const { account } = useAuth()
  const [messages, setMessages] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const log = useRef(null)
  const lastId = useRef(0)
  const path = `/mentor-chats/${c.mentorId}/${c.studentId}/messages`

  const merge = (rows) => {
    if (!rows.length) return
    lastId.current = Math.max(lastId.current, ...rows.map((m) => m.id))
    setMessages((prev) => [...(prev || []).filter((m) => !m.pending && !rows.some((r) => r.id === m.id)), ...rows])
  }

  useEffect(() => {
    let live = true
    lastId.current = 0
    setMessages(null)
    setError('')
    const load = async () => {
      if (document.hidden && lastId.current) return
      try {
        const rows = await api(`${path}${lastId.current ? `?after=${lastId.current}` : ''}`)
        if (!live) return
        if (!lastId.current) setMessages(rows)
        merge(rows)
        if (rows.some((m) => m.authorId !== account.id)) onChanged()
      } catch (err) {
        if (live && !lastId.current) { setMessages([]); setError(err.message) }
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => { live = false; clearInterval(timer) }
  }, [path])

  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages])

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setError('')
    const temp = { id: `t${Date.now()}`, pending: true, authorId: account.id, kind: 'text', body, createdAt: new Date().toISOString() }
    setMessages((prev) => [...(prev || []), temp])
    try {
      merge(await api(path, { method: 'POST', body: { body } }))
    } catch (err) {
      setError(err.message)
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      setDraft(body)
    }
  }

  const first = c.with.displayName.split(' ')[0]
  const lastMine = [...(messages || [])].reverse().find((m) => m.authorId === account.id && !m.pending)
  let shownDay = null

  return (
    <section className="mchat-thread" aria-label={`Messages with ${c.with.displayName}`}>
      <header className="mchat-head">
        <button className="icon-btn mchat-back" onClick={onBack} aria-label="All conversations"><ArrowLeft size={18} /></button>
        <Avatar user={c.with} size={36} />
        <div>
          <strong>{c.with.displayName}</strong>
          <span className="faint">{c.asMentor ? 'Your student' : 'Your mentor'}
            {c.status === 'accepted' && ' · chat open'}</span>
        </div>
        <div className="mchat-head-actions">
          {c.meetingUrl && !c.canShareMeeting && (
            <a className="btn btn-primary btn-sm" href={c.meetingUrl} target="_blank" rel="noopener noreferrer">
              <Video size={15} /> Join call
            </a>
          )}
          {c.canShareMeeting && <ShareMeeting c={c} onShared={(m) => { merge([m]); onChanged() }} />}
          {!c.asMentor && <Link to={`/mentors/${c.mentorId}`} className="btn btn-ghost btn-sm">Book again</Link>}
        </div>
      </header>

      {c.session && <SessionBar session={c.session} asMentor={c.asMentor} onChanged={onChanged} />}

      {c.status !== 'accepted' ? (
        <div className="mchat-log mchat-log-waiting"><Request c={c} onDecide={onChanged} /></div>
      ) : (
        <ol className="mchat-log" ref={log} aria-live="polite">
          {messages === null && <li className="mchat-note-line"><Spinner /> Loading messages</li>}
          {messages?.length === 0 && !error && (
            <li className="mchat-note-line">No messages yet. Say hello to {first}, or share what you would like to cover.</li>
          )}
          {messages?.map((m) => {
            const day = dayOf(m.createdAt)
            const newDay = day !== shownDay
            shownDay = day
            const mine = m.authorId === account.id
            return (
              <li key={m.id} className={`mchat-item${newDay ? ' has-day' : ''}`}>
                {newDay && <p className="mchat-day"><span>{dayLabel(m.createdAt)}</span></p>}
                {m.kind === 'system' ? (
                  <p className="mchat-system"><ShieldCheck size={14} aria-hidden /> {m.body}</p>
                ) : (
                  <div className={`mchat-msg${mine ? ' is-mine' : ''}${m.pending ? ' is-pending' : ''}`}>
                    {m.kind === 'meeting' ? <MeetingCard url={m.body} mine={mine} /> : <p>{m.body}</p>}
                    <span className="mchat-stamp faint">
                      {m.pending ? 'sending' : clockTime(m.createdAt)}
                      {mine && !m.pending && m.id === lastMine?.id && (
                        m.readAt ? <CheckCheck size={13} aria-label="Read" /> : <Check size={13} aria-label="Sent" />
                      )}
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {c.status === 'accepted' && (
        <form className="mchat-input" onSubmit={send}>
          <FormError>{error}</FormError>
          <label htmlFor="mchat-msg" className="visually-hidden">Message</label>
          <input id="mchat-msg" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000}
            placeholder={`Message ${first}`} autoComplete="off" />
          <button className="btn btn-primary" aria-label="Send" disabled={!draft.trim()}><Send size={16} /></button>
          <p className="mchat-safety">
            <Info size={13} aria-hidden /> {c.asMentor
              ? 'Keep the conversation on TYM. Share the call link here so your student always has it.'
              : `Only ${first} can send a call link here. Never join a call, or pay, anywhere else.`}
          </p>
        </form>
      )}
    </section>
  )
}

const STATUS_TEXT = { pending: 'Waiting to be opened', declined: 'Closed', accepted: 'Say hello' }

// The Messages tab of your own profile: every mentor or student you are paired with
export default function MentorChat() {
  const { account } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data, error, loading, reload } = useApi('/mentor-chats')
  const open = params.get('with')
  const pick = (key) => setParams(key ? { tab: 'Messages', with: key } : { tab: 'Messages' }, { replace: true })

  if (loading) return <p className="muted session-empty"><Spinner /> Loading your messages</p>
  if (error) return <FormError>{error.message}</FormError>
  if (!data.length) {
    return (
      <div className="empty card">
        <h2 className="display">No conversations yet</h2>
        <p className="muted">{account?.role === 'mentor'
          ? 'When a student books a session with you, their chat request lands here. Accept it and you can message each other before the call.'
          : 'Book a session with a mentor. Your mentor opens the chat, and you can message each other before and after the call.'}</p>
        {account?.role !== 'mentor' && <Link to="/mentors" className="btn btn-primary btn-sm">Find a mentor</Link>}
      </div>
    )
  }
  const current = data.find((c) => `${c.mentorId}-${c.studentId}` === open)
  const waiting = data.filter((c) => c.asMentor && c.status === 'pending').length

  return (
    <div className={`mchat card${current ? ' has-open' : ''}`}>
      <ul className="mchat-list" aria-label="Conversations">
        {waiting > 0 && <li className="mchat-waiting-head">{waiting} chat {waiting === 1 ? 'request' : 'requests'} waiting on you</li>}
        {data.map((c) => {
          const key = `${c.mentorId}-${c.studentId}`
          return (
            <li key={key}>
              <button className={key === open ? 'is-on' : ''} onClick={() => pick(key)}>
                <Avatar user={c.with} size={40} />
                <span className="mchat-who">
                  <strong>{c.with.displayName}</strong>
                  <span className="faint">{c.last && c.status === 'accepted'
                    ? (c.last.kind === 'meeting' ? 'Shared the call link' : c.last.body)
                    : STATUS_TEXT[c.status]}</span>
                </span>
                {c.status === 'pending' && c.asMentor && <span className="mchat-tag">New</span>}
                {c.unread > 0 && <span className="mchat-unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                {c.last && <span className="mchat-when faint">{timeAgo(c.last.createdAt)}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {current ? <Thread key={open} c={current} onBack={() => pick(null)} onChanged={reload} />
        : <p className="mchat-pick muted">Choose a conversation.</p>}
    </div>
  )
}
