import { Link, useSearchParams } from 'react-router-dom'
import PostCard, { PostSkeleton } from '../components/feed/PostCard'
import Avatar from '../components/ui/Avatar'
import { useArticles } from '../lib/blog'
import { useApi } from '../lib/api'
import { useMeta } from '../lib/meta'

// Questions, people, communities and mentors come from the API (Postgres full-text search);
// articles are few, so they are matched here from the published list.
export default function Search() {
  const [params] = useSearchParams()
  const term = (params.get('q') || '').trim()
  useMeta({ title: term ? `Search: ${term}` : 'Search', path: '/search' })
  const { data, loading } = useApi(term.length >= 2 ? `/search?q=${encodeURIComponent(term)}` : null)
  const blogs = useArticles().articles
  const q = term.toLowerCase()
  const has = (s) => s.toLowerCase().includes(q)
  const articles = q ? blogs.filter((b) => has(b.title) || has(b.excerpt) || b.keywords.some(has)) : []
  const r = data || { posts: [], users: [], communities: [], mentors: [] }
  const total = r.posts.length + r.users.length + r.communities.length + r.mentors.length + articles.length

  return (
    <div className="container page">
      <header className="page-head">
        <h1>{term ? <>Results for “{term}”</> : 'Search the community'}</h1>
        <p>{!term ? 'Use the search in the top bar.' : loading ? 'Searching...' : `${total} ${total === 1 ? 'result' : 'results'} across questions, articles, communities, mentors and people.`}</p>
      </header>

      {term && (
        <div className="layout-2">
          <section className="stack" aria-label="Questions">
            <h2 className="section-title">Questions</h2>
            {loading && <div className="feed-list"><PostSkeleton /><PostSkeleton /></div>}
            {!loading && (r.posts.length
              ? <div className="feed-list">{r.posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
              : <p className="muted">No questions match. <Link to="/ask" className="link">Ask it yourself.</Link></p>)}
          </section>
          <aside className="stack">
            {[
              ['Articles', articles.map((b) => ({ key: b.slug, to: `/blogs/${b.slug}`, title: b.title, sub: `${b.topic} · ${b.readMins} min read` }))],
              ['Communities', r.communities.map((c) => ({ key: c.id, to: `/c/${c.country.slug}`, title: c.country.name, sub: c.description }))],
              ['Mentors', r.mentors.map((m) => ({ key: m.id, to: `/mentors/${m.id}`, title: m.user.displayName, sub: m.university, user: m.user }))],
              ['People', r.users.map((u) => ({ key: u.username, to: `/u/${u.username}`, title: u.displayName, sub: `@${u.username}`, user: u }))],
            ].map(([label, rows]) => rows.length > 0 && (
              <div key={label} className="card card-pad">
                <h2 className="section-title">{label}</h2>
                <div className="mini-list">
                  {rows.map((row) => (
                    <Link key={row.key} to={row.to} className="mini-row">
                      {row.user && <Avatar user={row.user} size={32} />}
                      <div><strong>{row.title}</strong><span>{row.sub}</span></div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </aside>
        </div>
      )}
    </div>
  )
}
