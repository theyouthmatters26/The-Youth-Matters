import { Link, useParams } from 'react-router-dom'
import { Bookmark, ChevronLeft, Flag, Share2 } from 'lucide-react'
import CommentThread from '../components/post/CommentThread'
import SideRail from '../components/home/SideRail'
import Avatar from '../components/ui/Avatar'
import RoleBadge from '../components/ui/RoleBadge'
import Gate from '../components/ui/Gate'
import VoteControl from '../components/ui/VoteControl'
import { categoryBySlug, comments, countryBySlug, posts } from '../data/sample'
import { timeAgo } from '../lib/format'
import { useAuth } from '../lib/auth'
import NotFound from './NotFound'

export default function PostDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const post = posts.find((p) => String(p.id) === id)
  if (!post) return <NotFound />
  const country = countryBySlug[post.country]
  const thread = comments[post.id] || []

  return (
    <div className="container page">
      <Link to={`/c/${country.slug}`} className="back-link"><ChevronLeft size={16} /> {country.name}</Link>
      <div className="layout-2">
        <div className="stack" style={{ gap: 'var(--s-5)' }}>
          <article className="card post-full">
            <p className="post-meta">
              <span className="chip">{categoryBySlug[post.category].name}</span>
              <span className="faint">Asked {timeAgo(post.createdAt)} ago</span>
            </p>
            <h1>{post.title}</h1>
            <div className="post-meta">
              <Link to={`/u/${post.author.username}`} className="post-author">
                <Avatar user={post.author} size={28} />
                <span>{post.author.displayName}</span>
              </Link>
              <RoleBadge role={post.author.role} isOp />
            </div>
            <p className="post-body">{post.body}</p>
            <footer className="post-foot">
              <VoteControl score={post.score} horizontal />
              <button className="post-action"><Bookmark size={16} strokeWidth={1.7} /> Save</button>
              <button className="post-action"><Share2 size={16} strokeWidth={1.7} /> Share</button>
              <button className="post-action post-save"><Flag size={15} strokeWidth={1.7} /> Report</button>
            </footer>
          </article>

          <section className="card post-answers" aria-labelledby="answers-title">
            <h2 id="answers-title" className="display answers-title">
              {thread.length ? `${thread.length} answers and replies` : 'No answers yet'}
            </h2>
            {thread.length === 0 && (
              <p className="muted">If nobody answers within 6 hours, TYMAi will post a first answer to get things started.</p>
            )}
            {thread.length > 0 && user && <CommentThread comments={thread} opUsername={post.author.username} />}
            {thread.length > 0 && !user && (
              <>
                {/* Visitors see the first answer; the rest of the thread is for members */}
                <CommentThread comments={thread.slice(0, 1)} opUsername={post.author.username} />
                <Gate title="Read the full discussion" text="Create a free account to see every answer, reply and vote.">
                  <CommentThread comments={thread.slice(1)} opUsername={post.author.username} />
                </Gate>
              </>
            )}
            {user && (
              <form className="answer-form" onSubmit={(e) => e.preventDefault()}>
                <label htmlFor="answer" className="section-title">Your answer</label>
                <textarea id="answer" className="textarea" style={{ minHeight: 120 }}
                  placeholder="Share what you know. Dates, amounts and sources help most." />
                <div><button className="btn btn-primary btn-sm">Post answer</button></div>
              </form>
            )}
          </section>
        </div>
        <SideRail country={post.country} />
      </div>
    </div>
  )
}
