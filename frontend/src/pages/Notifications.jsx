import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowBigUp, AtSign, Bell, CheckCircle2, MessageSquare, Reply } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { Spinner } from '../components/auth/fields'
import { api } from '../lib/api'
import { fullDate, timeAgo } from '../lib/format'
import { useMeta } from '../lib/meta'

const ICONS = { upvote: ArrowBigUp, answer: MessageSquare, reply: Reply, mention: AtSign, system: CheckCircle2 }
const TEXT = {
  answer: 'answered your question',
  reply: 'replied to you',
  mention: 'mentioned you',
  upvote: 'Your post',
  followed_post: 'posted in a community you joined',
}
const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['answer', 'Answers'], ['mention', 'Mentions']]

export function notificationText(n) {
  if (n.kind === 'upvote') return `Your post ${n.message || 'got new upvotes'}`
  return n.message || TEXT[n.kind] || 'sent you an update'
}

export default function Notifications() {
  useMeta({ title: 'Notifications', path: '/notifications' })
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = async (n) => {
    setLoading(true)
    const res = await api(`/notifications?page=${n}`)
    setItems((prev) => (n === 1 ? res.items : [...prev, ...res.items]))
    setUnread(res.unread)
    setPage(n)
    setHasMore(res.hasMore)
    setLoading(false)
  }
  useEffect(() => { load(1) }, [])

  const markAll = async () => {
    const res = await api('/notifications/read', { method: 'POST' })
    setItems(items.map((n) => ({ ...n, isRead: true })))
    setUnread(res.unread)
    window.dispatchEvent(new Event('tym:notifications'))
  }
  const open = (n) => {
    if (n.isRead) return
    api('/notifications/read', { method: 'POST', body: { ids: [n.id] } })
      .then(() => window.dispatchEvent(new Event('tym:notifications')))
  }

  const shown = items.filter((n) => filter === 'all' || (filter === 'unread' ? !n.isRead : filter === 'answer' ? ['answer', 'reply'].includes(n.kind) : n.kind === filter))

  return (
    <div className="container page narrow">
      <header className="page-head row-between">
        <div>
          <h1>Notifications</h1>
          <p>{unread ? `${unread} unread` : 'You are all caught up.'}</p>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={!unread} onClick={markAll}>Mark all as read</button>
      </header>

      <div className="tabs notif-filters" role="tablist" aria-label="Filter notifications">
        {FILTERS.map(([k, label]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
      </div>

      {loading && !items.length && <p className="muted post-loading"><Spinner /> Loading</p>}
      {!loading && !shown.length && (
        <div className="card empty">
          <span className="empty-icon"><Bell size={20} /></span>
          <h2 className="display">{filter === 'all' ? 'Nothing yet' : 'Nothing here'}</h2>
          <p className="muted">When someone answers your question, replies to you or mentions you, it shows up here.</p>
          <Link to="/ask" className="btn btn-primary btn-sm">Ask a question</Link>
        </div>
      )}
      {shown.length > 0 && (
        <ol className="card notif-list">
          {shown.map((n) => {
            const Icon = ICONS[n.kind] || Bell
            const to = n.post ? `/p/${n.post.id}${n.commentId ? `#c${n.commentId}` : ''}` : '/my'
            return (
              <li key={n.id} className={n.isRead ? '' : 'is-unread'}>
                <Link to={to} onClick={() => open(n)}>
                  {n.actor ? <Avatar user={n.actor} size={36} /> : <span className="notif-icon"><Icon size={18} /></span>}
                  <div>
                    <p>{n.actor && <strong>{n.actor.displayName} </strong>}{notificationText(n)}</p>
                    {n.post && <p className="muted notif-target">{n.post.title}</p>}
                  </div>
                  <span className="faint mono" title={fullDate(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
      {hasMore && <button className="btn btn-ghost btn-sm load-more" onClick={() => load(page + 1)} disabled={loading}>Show older</button>}
    </div>
  )
}
