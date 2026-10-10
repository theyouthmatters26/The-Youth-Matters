import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { FormError } from '../auth/fields'
import Gate from '../ui/Gate'
import PostCard, { PostSkeleton } from './PostCard'
import './feed.css'

// A page of posts from the API that keeps loading as you scroll. Visitors see `preview` posts and
// an invitation to join. `fresh` posts (just written on this page) appear at the top straight away.
export default function PostList({ endpoint = '/posts', query = '', preview = 2, fresh = [], onMeta,
  empty, gateTitle = 'Read every discussion', gateText = 'Create a free account to read every question and answer, and ask your own.' }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const sentinel = useRef(null)
  const latest = useRef(0) // only the newest request may change the list: an earlier, slower one belongs to another tab
  const sep = endpoint.includes('?') ? '&' : '?'

  const load = async (n, replace) => {
    const mine = ++latest.current
    setLoading(true)
    setError(null)
    try {
      const res = await api(`${endpoint}${sep}${query}${query ? '&' : ''}page=${n}`)
      if (mine !== latest.current) return
      setItems((prev) => (replace ? res.items : [...prev, ...res.items.filter((p) => !prev.some((q) => q.id === p.id))]))
      setPage(n)
      setHasMore(res.hasMore)
      onMeta?.(res)
    } catch (e) {
      if (mine === latest.current) setError({ message: e.message, retry: () => load(n, replace) })
    } finally {
      if (mine === latest.current) setLoading(false)
    }
  }

  useEffect(() => { load(1, true) }, [endpoint, query, Boolean(user)])

  // Load the next page when the bottom of the list comes into view (members only).
  // After a failure it waits for "Try again", or it would ask again without end.
  useEffect(() => {
    if (!user || !hasMore || loading || error || !sentinel.current) return undefined
    const io = new IntersectionObserver(([e]) => e.isIntersecting && load(page + 1), { rootMargin: '400px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [user, hasMore, loading, error, page])

  const all = [...fresh.filter((p) => !items.some((q) => q.id === p.id)), ...items]
  const remove = (id) => setItems((prev) => prev.filter((p) => p.id !== id))
  const shown = user ? all : all.slice(0, preview)
  const locked = user ? [] : all.slice(preview, preview + 2)

  if (error && !all.length) {
    return (
      <div className="card empty">
        <p className="form-error">{error.message}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => load(1, true)}>Try again</button>
      </div>
    )
  }
  if (!loading && !all.length) return empty || null

  return (
    <>
      <div className="feed-list">
        {shown.map((p) => <PostCard key={p.id} post={p} onDeleted={remove} />)}
        {loading && [0, 1, 2].slice(0, all.length ? 1 : 3).map((i) => <PostSkeleton key={i} />)}
      </div>
      {!user && !loading && (
        <Gate title={gateTitle} text={gateText}>
          {locked.length > 0 ? <div className="feed-list">{locked.map((p) => <PostCard key={p.id} post={p} />)}</div> : null}
        </Gate>
      )}
      {error && (
        <div className="feed-end">
          <FormError>{error.message}</FormError>
          <button className="btn btn-ghost btn-sm load-more" onClick={error.retry}>Try again</button>
        </div>
      )}
      {user && hasMore && <div ref={sentinel} className="feed-sentinel" aria-hidden />}
      {user && !hasMore && all.length > 5 && <p className="feed-end">You are all caught up.</p>}
    </>
  )
}
