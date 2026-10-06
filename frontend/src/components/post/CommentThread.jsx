import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag, Reply } from 'lucide-react'
import Avatar from '../ui/Avatar'
import RoleBadge from '../ui/RoleBadge'
import VoteControl from '../ui/VoteControl'
import { timeAgo } from '../../lib/format'
import './post.css'

// The API returns comments flat; nest them by parentId here.
function buildTree(comments) {
  const byParent = {}
  for (const c of comments) (byParent[c.parentId ?? 'root'] ||= []).push(c)
  const attach = (c) => ({ ...c, replies: (byParent[c.id] || []).map(attach) })
  return (byParent.root || []).map(attach)
}

function Comment({ comment, opUsername }) {
  const [replying, setReplying] = useState(false)
  const { author } = comment

  return (
    <li className={`comment ${author.role === 'bot' ? 'is-ai' : ''}`}>
      <div className="comment-head">
        <Avatar user={author} size={28} />
        <Link to={`/u/${author.username}`} className="comment-author">{author.displayName}</Link>
        <RoleBadge role={author.role} isOp={author.username === opUsername} />
        <span className="faint mono">{timeAgo(comment.createdAt)}</span>
      </div>
      <p className="comment-body">{comment.body}</p>
      <div className="comment-actions">
        <VoteControl score={comment.score} horizontal />
        <button className="post-action" onClick={() => setReplying(!replying)}><Reply size={15} /> Reply</button>
        <button className="post-action"><Flag size={14} /> Report</button>
      </div>
      {replying && (
        <form className="reply-form" onSubmit={(e) => { e.preventDefault(); setReplying(false) }}>
          <label htmlFor={`reply-${comment.id}`} className="visually-hidden">Your reply</label>
          <textarea id={`reply-${comment.id}`} className="textarea" style={{ minHeight: 80 }}
            placeholder={`Reply to ${author.displayName}`} />
          <div><button className="btn btn-primary btn-sm">Post reply</button></div>
        </form>
      )}
      {comment.replies.length > 0 && (
        <ul className="comment-list nested">
          {comment.replies.map((r) => <Comment key={r.id} comment={r} opUsername={opUsername} />)}
        </ul>
      )}
    </li>
  )
}

export default function CommentThread({ comments, opUsername }) {
  return (
    <ul className="comment-list">
      {buildTree(comments).map((c) => <Comment key={c.id} comment={c} opUsername={opUsername} />)}
    </ul>
  )
}
