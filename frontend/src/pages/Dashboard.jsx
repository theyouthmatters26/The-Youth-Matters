import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowUpRight, Bot, CalendarCheck, CheckCircle2, Circle, MessagesSquare, PenLine, Users, Video, Wallet } from 'lucide-react'
import Composer from '../components/feed/Composer'
import PostList from '../components/feed/PostList'
import { formatDay, formatTime } from '../components/mentors/booking'
import Avatar from '../components/ui/Avatar'
import SortTabs from '../components/ui/SortTabs'
import { countries } from '../data/sample'
import { useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatMoney, timeAgo } from '../lib/format'
import { useMeta } from '../lib/meta'
import { notificationText } from './Notifications'
import Photo, { cityPhoto } from '../components/ui/Photo'
import '../components/feed/feed.css'

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// The things that make answers to your questions specific to you
const CHECKLIST = [
  ['avatar', 'Add a profile photo'],
  ['bio', 'Write a short bio'],
  ['targetCountry', 'Choose where you are heading'],
  ['university', 'Add your university'],
  ['course', 'Add your course'],
  ['intake', 'Add your intake'],
]

const ACTIONS = [
  ['/ask', PenLine, 'Ask a question', 'Answers within hours'],
  ['/chat', MessagesSquare, 'Chatrooms', 'Talk live by country'],
  ['/ai', Bot, 'Ask TYM AI', 'SOPs, visas, shortlists'],
  ['/mentors', Users, 'Book a mentor', 'One-to-one video call'],
]

// Students who paid for a session and are waiting for this mentor to open the chat.
function ChatRequests({ username }) {
  const { data } = useApi('/mentor-chats')
  const waiting = (data || []).filter((c) => c.asMentor && c.status === 'pending')
  if (!waiting.length) return null
  return (
    <div className="card card-pad">
      <h3 className="section-title"><MessagesSquare size={16} aria-hidden /> Chat requests</h3>
      <div className="mini-list">
        {waiting.slice(0, 3).map((c) => (
          <Link key={`${c.mentorId}-${c.studentId}`} to={`/u/${username}?tab=Messages&with=${c.mentorId}-${c.studentId}`} className="mini-row">
            <Avatar user={c.with} size={32} />
            <div><strong>{c.with.displayName}</strong><span>Booked a session · waiting on you</span></div>
          </Link>
        ))}
      </div>
      <Link to={`/u/${username}?tab=Messages`} className="text-link rail-more">Open your messages <ArrowUpRight size={14} /></Link>
    </div>
  )
}

// A mentor's wallet: the time they have given and what that is worth to them. Students buy hours
// from TYM, so a mentor is paid for time given, at their share of the hourly rate.
function MentorWallet({ username }) {
  const { data, error } = useApi('/mentors/me/wallet')
  if (error || !data) return null
  const hours = (mins) => (mins % 60 === 0 ? `${mins / 60}` : (mins / 60).toFixed(1))
  return (
    <div className="card card-pad dash-wallet">
      <h3 className="section-title"><Wallet size={16} aria-hidden /> Your wallet</h3>
      <p className="dash-wallet-total">{formatMoney(data.earnedMinor, data.currency)}</p>
      <p className="muted dash-small">Earned from {data.sessions} {data.sessions === 1 ? 'session' : 'sessions'},
        {' '}{hours(data.minutes)} counselling {data.minutes === 60 ? 'hour' : 'hours'} given.</p>
      <dl className="dash-wallet-grid">
        <div><dt>This month</dt><dd>{formatMoney(data.thisMonthMinor, data.currency)}</dd></div>
        <div><dt>Still to come</dt><dd>{data.upcoming} {data.upcoming === 1 ? 'session' : 'sessions'}</dd></div>
        <div><dt>Your share</dt><dd>{data.sharePercent}% of {formatMoney(data.hourlyRateMinor, data.currency)} an hour</dd></div>
      </dl>
      <p className="faint dash-small">We pay out by bank transfer at the end of each month. Questions about a
        payment? Write to support@theyouthmatters.com.</p>
      <Link to={`/u/${username}?tab=Sessions`} className="text-link rail-more">Your sessions <ArrowUpRight size={14} /></Link>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const location = useLocation()
  useMeta({ title: 'My TYM', path: '/my' })
  const profile = useApi(`/users/${user.username}`)
  const communities = useApi('/users/me/communities')
  const bookings = useApi('/bookings')
  const notes = useApi('/notifications')
  const [sort, setSort] = useState('hot')
  const [joined, setJoined] = useState(true)
  const [fresh, setFresh] = useState([])

  // Old links like /my?tab=Sessions open that tab on your profile
  const tab = new URLSearchParams(location.search).get('tab')
  if (tab) return <Navigate to={`/u/${user.username}?tab=${tab}`} replace />

  const p = profile.data
  const missing = p ? CHECKLIST.filter(([k]) => !p[k]) : []
  const done = CHECKLIST.length - missing.length
  const next = (bookings.data || []).filter((b) => b.status === 'confirmed' && new Date(b.endsAt) > new Date())
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0]

  return (
    <div className="container page dashboard">
      <header className="dash-head">
        <div>
          <p className="eyebrow">My TYM</p>
          <h1>{greeting()}, {user.displayName.split(' ')[0]}.</h1>
          <p className="muted">Here is what is new in the communities you follow.</p>
        </div>
        <Link to={`/u/${user.username}`} className="dash-me">
          <Avatar user={user} size={44} />
          <span><strong>{user.displayName}</strong><span>View your profile</span></span>
        </Link>
      </header>

      <nav className="dash-actions" aria-label="Quick actions">
        {ACTIONS.map(([to, Icon, title, text]) => (
          <Link key={to} to={to}><Icon size={20} aria-hidden /><strong>{title}</strong><span>{text}</span></Link>
        ))}
      </nav>

      <div className="layout-2 dash-grid">
        <section aria-labelledby="feed-title">
          <Composer onPosted={(post) => setFresh([post, ...fresh])} />
          <div className="feed-head">
            <h2 id="feed-title" className="col-title dash-feed-title">{joined ? 'From your communities' : 'Popular across TYM'}</h2>
            <SortTabs value={sort} onChange={setSort} />
          </div>
          {!joined && (
            <div className="join-hint card">
              <p><strong>Join a community to fill your feed.</strong> Pick the countries you are considering.</p>
              <div className="join-hint-pills">
                {countries.map((c) => <Link key={c.slug} to={`/c/${c.slug}`} className="chip">{c.name}</Link>)}
              </div>
            </div>
          )}
          <PostList endpoint="/feed" query={sort === 'unanswered' ? 'sort=new&unanswered=1' : `sort=${sort}`} fresh={fresh}
            onMeta={(res) => setJoined(res.following)}
            empty={<div className="card empty"><h2 className="display">Quiet for now</h2><p className="muted">Nothing new in your communities yet. Ask the first question.</p></div>} />
        </section>

        <aside className="stack sticky dash-rail">
          {p && (
            <div className="card card-pad dash-stats">
              <dl>
                <div><dt>Questions</dt><dd>{p.stats.posts}</dd></div>
                <div><dt>Answers</dt><dd>{p.stats.answers}</dd></div>
                <div><dt>Karma</dt><dd>{p.stats.karma}</dd></div>
              </dl>
              {missing.length > 0 && (
                <div className="dash-complete">
                  <div className="dash-complete-head"><strong>Complete your profile</strong><span className="mono">{done}/{CHECKLIST.length}</span></div>
                  <span className="checklist-bar" aria-hidden><i style={{ transform: `scaleX(${done / CHECKLIST.length})` }} /></span>
                  <ul>
                    {CHECKLIST.map(([k, label]) => (
                      <li key={k} className={p[k] ? 'is-done' : ''}>{p[k] ? <CheckCircle2 size={15} /> : <Circle size={15} />} {label}</li>
                    ))}
                  </ul>
                  <Link to="/settings" className="btn btn-ghost btn-sm btn-block">Finish your profile</Link>
                </div>
              )}
            </div>
          )}

          {user.role === 'mentor' && <ChatRequests username={user.username} />}
          {user.role === 'mentor' && <MentorWallet username={user.username} />}

          <div className="card card-pad">
            <h3 className="section-title"><CalendarCheck size={16} aria-hidden /> Next session</h3>
            {next ? (
              <div className="dash-session">
                {/* For a mentor the other person is the student who booked them */}
                <Avatar user={next.asMentor ? next.student : next.mentor.user} size={40} />
                <div>
                  <strong>{(next.asMentor ? next.student : next.mentor.user).displayName}</strong>
                  <span>{next.asMentor ? 'You are mentoring · ' : ''}{formatDay(next.startsAt, { weekday: 'short' })}, {formatTime(next.startsAt)}</span>
                </div>
                <a href={next.meetingUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm"><Video size={14} /> Join</a>
              </div>
            ) : (
              <p className="muted dash-small">No sessions booked. A 30 minute call with someone who went can save weeks.</p>
            )}
            <Link to={next ? `/u/${user.username}?tab=Sessions` : '/mentors'} className="text-link rail-more">
              {next ? 'All your sessions' : 'Find a mentor'} <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="card card-pad">
            <h3 className="section-title">Your communities</h3>
            {communities.data?.length ? (
              <div className="mini-list">
                {communities.data.map((c) => (
                  <Link key={c.id} to={`/c/${c.country.slug}`} className="mini-row">
                    <Photo src={cityPhoto(c.country)} className="mini-city" sizes="48px" />
                    <div><strong>{c.country.name}</strong><span>{c.subject.name}</span></div>
                  </Link>
                ))}
              </div>
            ) : <p className="muted dash-small">You have not joined any yet.</p>}
            <Link to="/community" className="text-link rail-more">Find communities <ArrowUpRight size={14} /></Link>
          </div>

          <div className="card card-pad">
            <h3 className="section-title">Latest activity</h3>
            {notes.data?.items.length ? (
              <ul className="dash-notes">
                {notes.data.items.slice(0, 4).map((n) => (
                  <li key={n.id} className={n.isRead ? '' : 'is-unread'}>
                    <Link to={n.post ? `/p/${n.post.id}${n.commentId ? `#c${n.commentId}` : ''}` : '/notifications'}>
                      <span><strong>{n.actor?.displayName}</strong> {notificationText(n)}</span>
                      <span className="faint">{timeAgo(n.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="muted dash-small">Answers, replies and mentions will show up here.</p>}
            <Link to="/notifications" className="text-link rail-more">All notifications <ArrowUpRight size={14} /></Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
