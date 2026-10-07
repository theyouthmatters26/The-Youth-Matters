import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, GraduationCap, MapPin, Pencil, School } from 'lucide-react'
import PostList from '../components/feed/PostList'
import { MoreMenu } from '../components/feed/PostActions'
import MySessions from '../components/mentors/MySessions'
import Avatar from '../components/ui/Avatar'
import RoleBadge from '../components/ui/RoleBadge'
import { FormError, Spinner } from '../components/auth/fields'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { plural, timeAgo } from '../lib/format'
import { useMeta } from '../lib/meta'
import NotFound from './NotFound'

const LEVELS = { undergraduate: 'Undergraduate', postgraduate: 'Postgraduate', phd: 'PhD', foundation: 'Foundation', other: 'Other' }

function Answers({ username }) {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async (n) => {
    setLoading(true)
    setError('')
    try {
      const res = await api(`/users/${username}/comments?page=${n}`)
      setItems((prev) => (n === 1 ? res.items : [...prev, ...res.items]))
      setPage(n)
      setHasMore(res.hasMore)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(1) }, [username])

  if (loading && !items.length) return <p className="muted post-loading"><Spinner /> Loading answers</p>
  if (error && !items.length) return <FormError>{error}</FormError>
  if (!items.length) return <div className="card empty"><h2 className="display">No answers yet</h2><p className="muted">Answers and replies will show up here.</p></div>
  return (
    <>
      <ol className="feed-list answer-list">
        {items.map((c) => (
          <li key={c.id} className="post-row">
            <p className="post-meta">
              {c.parentId ? 'Replied in' : 'Answered'} <Link to={`/p/${c.post.id}#c${c.id}`} className="post-place answer-on">{c.post.title}</Link>
              <span className="faint post-time">{timeAgo(c.createdAt)}</span>
            </p>
            <p className="answer-excerpt">{c.body}</p>
            <p className="post-meta">
              <span className="mono">{plural(c.score, 'point')}</span>
              {c.isHelpful && <span className="post-answered"><CheckCircle2 size={14} /> Helped the asker</span>}
            </p>
          </li>
        ))}
      </ol>
      {error && <div style={{ marginTop: 'var(--s-4)' }}><FormError>{error}</FormError></div>}
      {hasMore && <button className="btn btn-ghost btn-sm load-more" onClick={() => load(page + 1)} disabled={loading}>Show more</button>}
    </>
  )
}

export default function Profile() {
  const { username } = useParams()
  const { account } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data: u, error, loading } = useApi(`/users/${username}`)
  const own = account?.username === username
  const tabs = own ? ['Questions', 'Answers', 'Saved', 'Sessions'] : ['Questions', 'Answers']
  const tab = tabs.includes(params.get('tab')) ? params.get('tab') : 'Questions'
  useMeta(u ? { title: `${u.displayName} (@${u.username})`, description: u.bio || `${u.displayName} on The Youth Matters.`, path: `/u/${u.username}` } : {})

  if (error?.status === 404) return <NotFound />
  if (error) return <div className="container page"><FormError>{error.message}</FormError></div>
  if (loading || !u) return <div className="container page post-loading"><Spinner /> Loading profile</div>

  const facts = [
    u.targetCountry && [MapPin, <>Heading to <Link to={`/c/${u.targetCountry.slug}`} className="link">{u.targetCountry.name}</Link></>],
    (u.course || u.university) && [School, [u.course, u.university].filter(Boolean).join(', ')],
    u.studyLevel && [GraduationCap, LEVELS[u.studyLevel]],
    u.intake && [CalendarDays, `Starts ${u.intake}`],
  ].filter(Boolean)
  const joined = new Date(u.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="container page profile">
      <header className="profile-card card">
        <div className="profile-cover">{u.cover && <img src={u.cover} alt="" />}</div>
        <div className="profile-main">
          <div className="profile-avatar"><Avatar user={u} size={120} /></div>
          <div className="profile-actions">
            {own ? (
              <Link to="/settings" className="btn btn-ghost btn-sm"><Pencil size={14} /> Edit profile</Link>
            ) : (
              <>
                {u.mentorId && <Link to={`/mentors/${u.mentorId}`} className="btn btn-primary btn-sm">Book a session</Link>}
                <MoreMenu reportTarget={{ targetType: 'user', targetId: u.id, path: `/u/${u.username}` }} />
              </>
            )}
          </div>
          <h1>{u.displayName} <RoleBadge role={u.role} /></h1>
          <p className="profile-handle">@{u.username} · Joined {joined}</p>
          {u.bio && <p className="profile-bio">{u.bio}</p>}
          {facts.length > 0 && (
            <ul className="profile-facts">{facts.map(([Icon, text], i) => <li key={i}><Icon size={15} aria-hidden /> {text}</li>)}</ul>
          )}
          <dl className="profile-stats">
            <div><dt>Questions</dt><dd>{u.stats.posts}</dd></div>
            <div><dt>Answers</dt><dd>{u.stats.answers}</dd></div>
            <div><dt>Karma</dt><dd>{u.stats.karma}</dd></div>
            <div><dt>Helped someone</dt><dd>{u.stats.helpful}</dd></div>
          </dl>
        </div>
      </header>

      <div className="tabs profile-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setParams(t === 'Questions' ? {} : { tab: t }, { replace: true })}>{t}</button>
        ))}
      </div>

      <div className="profile-content">
        {tab === 'Questions' && (
          <PostList query={`author=${u.username}&sort=new`} preview={3}
            empty={<div className="card empty"><h2 className="display">No questions yet</h2>
              {own ? <><p className="muted">Ask your first question. Students who went answer within hours.</p><Link to="/ask" className="btn btn-primary btn-sm">Ask a question</Link></>
                : <p className="muted">{u.displayName.split(' ')[0]} has not asked anything yet.</p>}</div>} />
        )}
        {tab === 'Answers' && <Answers username={u.username} />}
        {tab === 'Saved' && own && (
          <PostList query="saved=1&sort=new"
            empty={<div className="card empty"><h2 className="display">Nothing saved yet</h2><p className="muted">Tap the bookmark on any question to keep it here. Only you can see this list.</p></div>} />
        )}
        {tab === 'Sessions' && own && <MySessions />}
      </div>
    </div>
  )
}
