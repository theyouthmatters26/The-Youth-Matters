import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MessageSquareReply } from 'lucide-react'
import Avatar from '../ui/Avatar'
import RoleBadge from '../ui/RoleBadge'
import VoteControl from '../ui/VoteControl'
import RichText from '../feed/RichText'
import { MoreMenu } from '../feed/PostActions'
import { FormError, Spinner } from '../auth/fields'
import { api } from '../../lib/api'
import { useAuth, useMemberGuard } from '../../lib/auth'
import { fullDate, plural, timeAgo } from '../../lib/format'
import './post.css'

const ORDER = {
  best: (a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt),
  new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
}

// Flat list from the API -> nested tree, each level sorted; removed answers without replies disappear.
function buildTree(comments, sort, helpfulId) {
  const byParent = {}
  for (const c of comments) (byParent[c.parentId ?? 'root'] ||= []).push(c)
  const count = (c) => (byParent[c.id] || []).reduce((n, r) => n + 1 + count(r), 0)
  const attach = (c) => ({ ...c, replies: (byParent[c.id] || []).sort(ORDER[sort]).map(attach), total: count(c) })
  const prune = (list) => list.filter((c) => !c.isDeleted || c.replies.length).map((c) => ({ ...c, replies: prune(c.replies) }))
  const top = prune((byParent.root || []).sort(ORDER[sort]).map(attach))
  return top.sort((a, b) => (b.id === helpfulId) - (a.id === helpfulId))
}

export function ReplyBox({ postId, parentId, placeholder, onDone, onCancel, autoFocus }) {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async (e) => {
    e?.preventDefault()
    if (body.trim().length < 2) return
    setBusy(true)
    setError('')
    try {
      const { comment } = await api(`/posts/${postId}/comments`, { method: 'POST', body: { body, parentId } })
      setBody('')
      onDone(comment)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="reply-box" onSubmit={send} onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && send()}>
      <Avatar user={user} size={32} />
      <div className="reply-box-main">
        <textarea className="textarea" rows={parentId ? 2 : 4} maxLength={5000} value={body} autoFocus={autoFocus}
          onChange={(e) => setBody(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <FormError>{error}</FormError>
        <div className="reply-box-bar">
          <span className="hint">Ctrl + Enter to post</span>
          {onCancel && <button type="button" className="btn-text" onClick={onCancel}>Cancel</button>}
          <button className="btn btn-primary btn-sm" disabled={busy || body.trim().length < 2}>
            {busy ? <Spinner /> : parentId ? 'Reply' : 'Post answer'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Comment({ c, ctx }) {
  const { account } = useAuth()
  const guard = useMemberGuard()
  const [collapsed, setCollapsed] = useState(false)
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.body)
  const [error, setError] = useState('')
  const own = account?.username === c.author.username
  const helpful = ctx.helpfulId === c.id

  const save = async () => {
    setError('')
    try {
      const { comment } = await api(`/comments/${c.id}`, { method: 'PATCH', body: { body: draft } })
      ctx.update(comment)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    }
  }
  const remove = async () => {
    await api(`/comments/${c.id}`, { method: 'DELETE' })
    ctx.update({ ...c, isDeleted: true, body: '' })
  }

  return (
    <li className={`comment${c.author.role === 'bot' ? ' is-ai' : ''}${helpful ? ' is-helpful' : ''}${collapsed ? ' is-collapsed' : ''}`} id={`c${c.id}`}>
      <button className="comment-line" onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand thread' : 'Collapse thread'} aria-expanded={!collapsed} />
      <div className="comment-head">
        {c.isDeleted ? <span className="comment-removed-dot" aria-hidden /> : <Avatar user={c.author} size={28} />}
        {c.isDeleted ? <span className="faint">[removed]</span> : (
          <>
            <Link to={`/u/${c.author.username}`} className="comment-author">{c.author.displayName}</Link>
            <RoleBadge role={c.author.role} isOp={c.author.username === ctx.opUsername} />
          </>
        )}
        <span className="faint" title={fullDate(c.createdAt)}>{timeAgo(c.createdAt)}{c.edited && ' · edited'}</span>
        {helpful && <span className="helpful-badge"><CheckCircle2 size={14} /> Helped the asker</span>}
        {collapsed && c.total > 0 && <button className="btn-text comment-more" onClick={() => setCollapsed(false)}>{plural(c.total, 'reply', 'replies')} hidden</button>}
      </div>

      {!collapsed && (
        <>
          {editing ? (
            <div className="comment-edit">
              <textarea className="textarea" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit your answer" />
              <FormError>{error}</FormError>
              <div className="reply-box-bar">
                <button className="btn-text" onClick={() => { setEditing(false); setDraft(c.body) }}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={draft.trim().length < 2}>Save</button>
              </div>
            </div>
          ) : !c.isDeleted && <RichText text={c.body} className="comment-body" />}

          {!c.isDeleted && !editing && (
            <div className="comment-actions">
              <VoteControl type="comment" id={c.id} score={c.score} myVote={c.myVote} horizontal />
              <button className="post-action" onClick={() => guard() && setReplying(!replying)}>
                <MessageSquareReply size={15} /> Reply
              </button>
              {ctx.canMarkHelpful && !c.parentId && !own && (
                <button className={`post-action${helpful ? ' is-on' : ''}`} onClick={() => ctx.markHelpful(helpful ? null : c.id)}>
                  <CheckCircle2 size={15} /> {helpful ? 'Unmark' : 'This helped'}
                </button>
              )}
              <MoreMenu own={own} onEdit={() => setEditing(true)} onDelete={remove}
                reportTarget={{ targetType: 'comment', targetId: c.id, path: `/p/${c.postId}#c${c.id}` }} />
            </div>
          )}

          {replying && (
            <ReplyBox postId={c.postId} parentId={c.id} autoFocus placeholder={`Reply to ${c.author.displayName}`}
              onCancel={() => setReplying(false)} onDone={(reply) => { ctx.add(reply); setReplying(false) }} />
          )}

          {c.replies.length > 0 && (
            <ul className="comment-list nested">{c.replies.map((r) => <Comment key={r.id} c={r} ctx={ctx} />)}</ul>
          )}
        </>
      )}
    </li>
  )
}

export default function CommentThread({ comments, setComments, opUsername, helpfulId, canMarkHelpful, markHelpful, sort = 'best', limitTop }) {
  const tree = useMemo(() => buildTree(comments, sort, helpfulId), [comments, sort, helpfulId])
  const ctx = {
    opUsername, helpfulId, canMarkHelpful, markHelpful,
    add: (c) => setComments((list) => [...list, c]),
    update: (c) => setComments((list) => list.map((x) => (x.id === c.id ? { ...x, ...c } : x))),
  }
  const shown = limitTop ? tree.slice(0, limitTop) : tree
  return <ul className="comment-list">{shown.map((c) => <Comment key={c.id} c={c} ctx={ctx} />)}</ul>
}
