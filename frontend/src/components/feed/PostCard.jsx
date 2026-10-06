import { Link } from 'react-router-dom'
import { Bookmark, MessageCircle, Pin } from 'lucide-react'
import Avatar from '../ui/Avatar'
import RoleBadge from '../ui/RoleBadge'
import VoteControl from '../ui/VoteControl'
import { categoryBySlug, countryBySlug } from '../../data/sample'
import { timeAgo } from '../../lib/format'
import './feed.css'

// One question in a feed. Rendered as a row inside .feed-list.
export default function PostCard({ post }) {
  const country = countryBySlug[post.country]
  const category = categoryBySlug[post.category]

  return (
    <article className="post-row">
      <header className="post-meta">
        <Link to={`/u/${post.author.username}`} className="post-author">
          <Avatar user={post.author} size={26} />
          <span>{post.author.displayName}</span>
        </Link>
        <RoleBadge role={post.author.role} />
        <span className="post-where">
          <Link to={`/c/${country.slug}`} className="post-place">{country.name}</Link>
          {category && <span className="faint"> / {category.name}</span>}
        </span>
        {post.isPinned && <Pin size={13} className="faint" aria-label="Pinned" />}
        <time className="faint post-time" dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
      </header>

      <h3 className="post-title"><Link to={`/p/${post.id}`}>{post.title}</Link></h3>
      <p className="post-excerpt">{post.body}</p>

      <footer className="post-foot">
        <VoteControl score={post.score} horizontal />
        <Link to={`/p/${post.id}`} className="post-action">
          <MessageCircle size={16} strokeWidth={1.7} />
          {post.commentCount === 0 ? 'Be the first to answer' : `${post.commentCount} answers`}
        </Link>
        <button className="post-action post-save" aria-label="Save question"><Bookmark size={16} strokeWidth={1.7} /></button>
      </footer>
    </article>
  )
}
