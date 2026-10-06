import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowBigUp, Bell, MessageSquare, Reply } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { notifications } from '../data/sample'
import { timeAgo } from '../lib/format'

const ICONS = { upvote: ArrowBigUp, answer: MessageSquare, reply: Reply, followed_post: Bell }

export default function Notifications() {
  const [items, setItems] = useState(notifications)
  const unread = items.filter((n) => n.unread).length

  return (
    <div className="container page narrow">
      <header className="page-head row-between">
        <div>
          <h1>Notifications</h1>
          <p>{unread ? `${unread} unread` : 'You are all caught up.'}</p>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={!unread}
          onClick={() => setItems(items.map((n) => ({ ...n, unread: false })))}>Mark all as read</button>
      </header>

      <ol className="card notif-list">
        {items.map((n) => {
          const Icon = ICONS[n.kind]
          return (
            <li key={n.id} className={n.unread ? 'is-unread' : ''}>
              <Link to={`/p/${n.postId}`}>
                {n.actor ? <Avatar user={n.actor} size={36} /> : <span className="notif-icon"><Icon size={18} /></span>}
                <div>
                  <p><strong>{n.actor?.displayName}</strong> {n.text}</p>
                  <p className="muted notif-target">{n.target}</p>
                </div>
                <span className="faint mono">{timeAgo(n.createdAt)}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
