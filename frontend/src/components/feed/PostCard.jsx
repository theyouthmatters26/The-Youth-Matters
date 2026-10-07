import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import Avatar from '../ui/Avatar'
import RoleBadge from '../ui/RoleBadge'
import VoteControl from '../ui/VoteControl'
import { MoreMenu, SaveButton, ShareButton } from './PostActions'
import { FormError } from '../auth/fields'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fullDate, plural, timeAgo } from '../../lib/format'
import './feed.css'

// One question in a feed, shaped like the API's post: votes, answers, save and share work in place.
export default function PostCard({ post, onDeleted }) {
  const { account } = useAuth()
  const navigate = useNavigate()
  const [gone, setGone] = useState(false)
  const [error, setError] = useState('')
  if (gone) return null

  const own = account?.username === post.author.username
  const place = post.community.country
  const remove = async () => {
    setError('')
    try {
      await api(`/posts/${post.id}`, { method: 'DELETE' })
      setGone(true)
      onDeleted?.(post.id)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <article className="post-row">
      <header className="post-meta">
        <Link to={`/u/${post.author.username}`} className="post-author">
          <Avatar user={post.author} size={28} />
          <span>{post.author.displayName}</span>
        </Link>
        <RoleBadge role={post.author.role} />
        <span className="post-where">
          <Link to={`/c/${place.slug}`} className="post-place">{place.name}</Link>
          {post.category && <span className="faint"> / {post.category.name}</span>}
        </span>
        <time className="faint post-time" dateTime={post.createdAt} title={fullDate(post.createdAt)}>
          {timeAgo(post.createdAt)}{post.edited && ' · edited'}
        </time>
        <MoreMenu own={own} onEdit={() => navigate(`/p/${post.id}`, { state: { edit: true } })} onDelete={remove}
          reportTarget={{ targetType: 'post', targetId: post.id, path: `/p/${post.id}` }} />
      </header>
      <FormError>{error}</FormError>

      <h3 className="post-title"><Link to={`/p/${post.id}`}>{post.title}</Link></h3>
      {post.excerpt && <p className="post-excerpt">{post.excerpt}</p>}
      {post.images.length > 0 && (
        <Link to={`/p/${post.id}`} className={`post-media n-${Math.min(post.images.length, 4)}`} aria-label="Open the pictures">
          {post.images.slice(0, 4).map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)}
        </Link>
      )}

      <footer className="post-foot">
        <VoteControl type="post" id={post.id} score={post.score} myVote={post.myVote} horizontal />
        <Link to={`/p/${post.id}`} className="post-action">
          <MessageCircle size={16} strokeWidth={1.7} />
          {post.commentCount === 0 ? 'Be the first to answer' : plural(post.commentCount, 'answer')}
        </Link>
        {post.hasHelpful && <span className="post-answered"><CheckCircle2 size={15} /> Answered</span>}
        <span className="post-foot-end">
          <SaveButton postId={post.id} saved={post.saved} label={false} />
          <ShareButton path={`/p/${post.id}`} title={post.title} label={false} />
        </span>
      </footer>
    </article>
  )
}

export function PostSkeleton() {
  return (
    <div className="post-row post-skeleton" aria-hidden>
      <i className="sk-meta" /><i className="sk-title" /><i className="sk-line" /><i className="sk-line short" />
    </div>
  )
}
