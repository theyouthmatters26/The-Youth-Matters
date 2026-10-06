import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, MessageCircle } from 'lucide-react'
import CommentThread, { ReplyBox } from '../components/post/CommentThread'
import { MoreMenu, SaveButton, ShareButton } from '../components/feed/PostActions'
import RichText from '../components/feed/RichText'
import SideRail from '../components/home/SideRail'
import Avatar from '../components/ui/Avatar'
import Gate from '../components/ui/Gate'
import RoleBadge from '../components/ui/RoleBadge'
import VoteControl from '../components/ui/VoteControl'
import { FormError, Spinner } from '../components/auth/fields'
import { categories } from '../data/sample'
import { api, useApi } from '../lib/api'
import { useAuth, useMemberGuard } from '../lib/auth'
import { fullDate, plural, timeAgo } from '../lib/format'
import { siteUrl, useMeta } from '../lib/meta'
import NotFound from './NotFound'
import '../components/post/post.css'

// schema.org QAPage: lets search engines show the question with its best answer
function qaPage(post, comments) {
  const answer = (c) => ({ '@type': 'Answer', text: c.body, upvoteCount: c.score, dateCreated: c.createdAt,
    url: `${siteUrl}/p/${post.id}#c${c.id}`, author: { '@type': 'Person', name: c.author.displayName } })
  const top = comments.filter((c) => !c.parentId && !c.isDeleted)
  const accepted = top.find((c) => c.id === post.helpfulCommentId)
  return {
    '@context': 'https://schema.org', '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question', name: post.title, text: post.body || post.title, answerCount: top.length,
      upvoteCount: post.score, dateCreated: post.createdAt, author: { '@type': 'Person', name: post.author.displayName },
      ...(accepted && { acceptedAnswer: answer(accepted) }),
      suggestedAnswer: top.filter((c) => c !== accepted).slice(0, 5).map(answer),
    },
  }
}

function EditPost({ post, onSaved, onCancel }) {
  const [title, setTitle] = useState(post.title)
  const [body, setBody] = useState(post.body)
  const [topic, setTopic] = useState(post.category?.slug || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await api(`/posts/${post.id}`, { method: 'PATCH', body: { title, body, category: topic || null } })
      onSaved(res.post)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <form className="stack" onSubmit={save}>
      <input className="input composer-title" value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} aria-label="Question" />
      <textarea className="textarea" rows={6} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} aria-label="Details" />
      <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
        <option value="">Any topic</option>
        {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </select>
      <FormError>{error}</FormError>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy || title.trim().length < 10}>{busy ? <Spinner /> : 'Save changes'}</button>
      </div>
    </form>
  )
}

export default function PostDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, account } = useAuth()
  const guard = useMemberGuard()
  const postRes = useApi(`/posts/${id}`)
  const commentsRes = useApi(`/posts/${id}/comments`)
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [sort, setSort] = useState('best')
  const [editing, setEditing] = useState(Boolean(location.state?.edit))

  useEffect(() => { if (postRes.data) setPost(postRes.data) }, [postRes.data])
  useEffect(() => { if (commentsRes.data) setComments(commentsRes.data) }, [commentsRes.data])
  // Jump to a linked answer (#c123) once the thread is on the page
  useEffect(() => {
    if (location.hash && comments.length) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center' })
  }, [location.hash, comments.length])

  const jsonLd = useMemo(() => post && qaPage(post, comments), [post, comments])
  useMeta(post ? { title: post.title, description: (post.body || post.title).slice(0, 155), path: `/p/${post.id}`, type: 'article', jsonLd } : {})

  if (postRes.error?.status === 404) return <NotFound />
  if (postRes.error) return <div className="container page"><p className="form-error">{postRes.error.message}</p></div>
  if (!post) return <div className="container page post-loading"><Spinner /> Loading the discussion</div>

  const own = account?.username === post.author.username
  const place = post.community.country
  const answers = comments.filter((c) => !c.isDeleted).length
  const markHelpful = async (commentId) => {
    const res = await api(`/posts/${post.id}/helpful`, { method: 'POST', body: { commentId } })
    setPost({ ...post, helpfulCommentId: res.helpfulCommentId, hasHelpful: Boolean(res.helpfulCommentId) })
  }
  const remove = async () => {
    await api(`/posts/${post.id}`, { method: 'DELETE' })
    navigate(`/c/${place.slug}`, { replace: true })
  }
  const threadProps = {
    comments, setComments, sort, opUsername: post.author.username, helpfulId: post.helpfulCommentId,
    canMarkHelpful: own, markHelpful,
  }
  const topCount = comments.filter((c) => !c.parentId).length

  return (
    <div className="container page">
      <Link to={`/c/${place.slug}`} className="back-link"><ChevronLeft size={16} /> {place.name}</Link>
      <div className="layout-2">
        <div className="stack" style={{ gap: 'var(--s-5)' }}>
          <article className="card post-full">
            <header className="post-meta">
              <Link to={`/u/${post.author.username}`} className="post-author">
                <Avatar user={post.author} size={36} />
                <span>{post.author.displayName}</span>
              </Link>
              <RoleBadge role={post.author.role} />
              <span className="post-where">
                <Link to={`/c/${place.slug}`} className="post-place">{place.name}</Link>
                {post.category && <span className="faint"> / {post.category.name}</span>}
              </span>
              <time className="faint post-time" dateTime={post.createdAt} title={fullDate(post.createdAt)}>
                Asked {timeAgo(post.createdAt)} ago{post.edited && ' · edited'}
              </time>
              <MoreMenu own={own} onEdit={() => setEditing(true)} onDelete={remove}
                reportTarget={{ targetType: 'post', targetId: post.id, path: `/p/${post.id}` }} />
            </header>

            {editing ? (
              <EditPost post={post} onCancel={() => setEditing(false)} onSaved={(p) => { setPost({ ...post, ...p }); setEditing(false) }} />
            ) : (
              <>
                <h1>{post.title}</h1>
                {post.hasHelpful && <p className="post-answered-line"><CheckCircle2 size={16} /> {post.author.displayName.split(' ')[0]} found an answer that helped</p>}
                <RichText text={post.body} className="post-body" />
                {post.images.length > 0 && (
                  <div className={`post-gallery n-${Math.min(post.images.length, 4)}`}>
                    {post.images.map((src, i) => (
                      <a key={src} href={src} target="_blank" rel="noopener"><img src={src} alt={`Picture ${i + 1} from ${post.author.displayName}`} /></a>
                    ))}
                  </div>
                )}
              </>
            )}

            <footer className="post-foot">
              <VoteControl type="post" id={post.id} score={post.score} myVote={post.myVote} horizontal />
              <a href="#answers" className="post-action"><MessageCircle size={16} strokeWidth={1.7} /> {plural(answers, 'answer')}</a>
              <span className="post-foot-end">
                <SaveButton postId={post.id} saved={post.saved} />
                <ShareButton path={`/p/${post.id}`} title={post.title} />
              </span>
            </footer>
          </article>

          <section className="card post-answers" id="answers" aria-labelledby="answers-title">
            <div className="answers-head">
              <h2 id="answers-title" className="display answers-title">{answers ? plural(answers, 'answer') : 'No answers yet'}</h2>
              {answers > 1 && (
                <div className="tabs" role="tablist" aria-label="Sort answers">
                  {[['best', 'Best'], ['new', 'New']].map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}>{label}</button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <ReplyBox postId={post.id} placeholder={own ? 'Add more details or thank someone...' : 'Share what you know. Dates, amounts and sources help most.'}
                onDone={(c) => setComments((list) => [...list, c])} />
            ) : (
              <button className="answer-cta" onClick={guard}>
                <span>{account ? 'Finish verifying your account to answer' : 'Log in to answer this question'}</span>
                <span className="btn btn-primary btn-sm">{account ? 'Finish sign-up' : 'Log in'}</span>
              </button>
            )}

            {commentsRes.loading && <p className="muted post-loading"><Spinner /> Loading answers</p>}
            {!commentsRes.loading && answers === 0 && (
              <p className="muted answers-empty">Be the first to help. If nobody answers within 6 hours, TYMAi will post a first answer to get things started.</p>
            )}
            {user && <CommentThread {...threadProps} />}
            {!user && answers > 0 && (
              <>
                <CommentThread {...threadProps} limitTop={1} />
                {topCount > 1 && (
                  <Gate title="Read the full discussion" text="Create a free account to see every answer, reply and vote.">
                    <CommentThread {...threadProps} comments={comments.filter((c) => !c.parentId).slice(1, 3)} />
                  </Gate>
                )}
              </>
            )}
          </section>
        </div>
        <SideRail country={place.slug} />
      </div>
    </div>
  )
}
