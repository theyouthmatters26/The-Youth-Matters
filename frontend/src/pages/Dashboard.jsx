import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowUpRight, Bot, CalendarCheck, CheckCircle2, Circle, MessagesSquare, PenLine, Users, Video } from 'lucide-react'
import Composer from '../components/feed/Composer'
import PostList from '../components/feed/PostList'
import { formatDay, formatTime } from '../components/mentors/booking'
import Avatar from '../components/ui/Avatar'
import SortTabs from '../components/ui/SortTabs'
import { countries } from '../data/sample'
import { useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useMeta } from '../lib/meta'
import { notificationText } from './Notifications'
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
          <PostList endpoint="/feed" query={sort === 'unanswered' ? 'sort=new' : `sort=${sort}`} fresh={fresh}
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

          <div className="card card-pad">
            <h3 className="section-title"><CalendarCheck size={16} aria-hidden /> Next session</h3>
            {next ? (
              <div className="dash-session">
                <Avatar user={next.mentor.user} size={40} />
                <div>
                  <strong>{next.mentor.user.displayName}</strong>
                  <span>{formatDay(next.startsAt, { weekday: 'short' })}, {formatTime(next.startsAt)}</span>
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
                    <img src={`/images/city-${c.country.slug}.jpg`} alt="" className="mini-city" />
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
