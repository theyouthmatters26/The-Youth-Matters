import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Ban, Flag, GraduationCap, LogOut, MapPin } from 'lucide-react'
import PostCard from '../components/feed/PostCard'
import MySessions from '../components/mentors/MySessions'
import Avatar from '../components/ui/Avatar'
import RoleBadge from '../components/ui/RoleBadge'
import { comments, countryBySlug, posts, users } from '../data/sample'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import NotFound from './NotFound'

const TABS = ['Questions', 'Answers', 'Saved']
const OWN_TABS = ['Sessions', ...TABS] // your paid mentor sessions come first on your own profile

export default function Profile() {
  const { username } = useParams()
  const { account, logout } = useAuth()
  const navigate = useNavigate()
  const own = account?.username === username
  // Demo members come from sample data; your own account comes from the API session
  const user = Object.values(users).find((u) => u.username === username) || (own ? account : null)
  const [params] = useSearchParams()
  const tabs = own ? OWN_TABS : TABS
  const [tab, setTab] = useState(tabs.includes(params.get('tab')) ? params.get('tab') : tabs[0])
  if (!user) return <NotFound />

  const asked = posts.filter((p) => p.author.username === username)
  const answers = Object.entries(comments).flatMap(([postId, list]) =>
    list.filter((c) => c.author.username === username).map((c) => ({ ...c, post: posts.find((p) => String(p.id) === postId) })))

  return (
    <div className="container page">
      <header className="card card-pad profile-head">
        <Avatar user={user} size={88} />
        <div className="stack" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 'var(--step-3)' }}>{user.displayName} <RoleBadge role={user.role} /></h1>
          <p className="mono faint">@{user.username}</p>
          {user.bio && <p>{user.bio}</p>}
          <p className="profile-facts muted">
            {user.targetCountry && <span><MapPin size={14} /> Heading to {countryBySlug[user.targetCountry].name}</span>}
            {user.studyLevel && <span><GraduationCap size={14} /> {user.studyLevel}</span>}
          </p>
        </div>
        <div className="profile-actions">
          {own ? (
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/') }}><LogOut size={14} /> Log out</button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm"><Flag size={14} /> Report</button>
              <button className="btn btn-ghost btn-sm"><Ban size={14} /> Block</button>
            </>
          )}
        </div>
      </header>

      <div className="tabs" role="tablist" style={{ margin: '24px 0 16px' }}>
        {tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <div className="feed-list" style={{ maxWidth: 820 }}>
        {tab === 'Questions' && (asked.length ? asked.map((p) => <PostCard key={p.id} post={p} />)
          : <p className="post-row muted">No questions yet.</p>)}
        {tab === 'Answers' && (answers.length ? answers.map((a) => (
          <article key={a.id} className="post-row">
            <p className="post-meta">Answered <Link to={`/p/${a.post.id}`} className="post-place">{a.post.title}</Link> <span className="faint">{timeAgo(a.createdAt)}</span></p>
            <p>{a.body}</p>
          </article>
        )) : <p className="post-row muted">No answers yet.</p>)}
        {tab === 'Saved' && <p className="post-row muted">Saved questions are only visible to you.</p>}
        {tab === 'Sessions' && <MySessions />}
      </div>
    </div>
  )
}
