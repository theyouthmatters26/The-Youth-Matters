import { Link, useSearchParams } from 'react-router-dom'
import PostCard from '../components/feed/PostCard'
import Avatar from '../components/ui/Avatar'
import { blogs, countries, mentors, posts, users } from '../data/sample'

// Phase 2: GET /api/search?q=
export default function Search() {
  const [params] = useSearchParams()
  const q = (params.get('q') || '').toLowerCase()
  const has = (s) => s.toLowerCase().includes(q)

  const found = {
    posts: posts.filter((p) => has(p.title) || has(p.body)),
    people: Object.values(users).filter((u) => has(u.displayName) || has(u.username)),
    hubs: countries.filter((c) => has(c.name)),
    mentors: mentors.filter((m) => has(m.university) || has(m.course) || has(m.user.displayName)),
    articles: blogs.filter((b) => has(b.title) || has(b.excerpt) || b.keywords.some(has)),
  }
  const total = Object.values(found).reduce((n, l) => n + l.length, 0)

  return (
    <div className="container page">
      <header className="page-head">
        <h1>{q ? <>Results for "{params.get('q')}"</> : 'Search the community'}</h1>
        <p>{q ? `${total} ${total === 1 ? 'result' : 'results'} across questions, articles, destinations, mentors and people.` : 'Use the search bar at the top of the page.'}</p>
      </header>

      {q && (
        <div className="layout-2">
          <section className="stack" aria-label="Questions">
            <h2 className="section-title">Questions</h2>
            {found.posts.length ? found.posts.map((p) => <PostCard key={p.id} post={p} />)
              : <p className="muted">No questions match. <Link to="/ask" className="link">Ask it yourself.</Link></p>}
          </section>
          <aside className="stack">
            {[
              ['Articles', found.articles.map((b) => ({ key: b.slug, to: `/blogs/${b.slug}`, title: b.title, sub: `${b.topic} · ${b.readMins} min read` }))],
              ['Destinations', found.hubs.map((c) => ({ key: c.slug, to: `/c/${c.slug}`, title: c.name, sub: c.description }))],
              ['Mentors', found.mentors.map((m) => ({ key: m.id, to: `/mentors/${m.id}`, title: m.user.displayName, sub: m.university, user: m.user }))],
              ['People', found.people.map((u) => ({ key: u.username, to: `/u/${u.username}`, title: u.displayName, sub: `@${u.username}`, user: u }))],
            ].map(([label, rows]) => rows.length > 0 && (
              <div key={label} className="card card-pad">
                <h2 className="section-title">{label}</h2>
                <div className="mini-list">
                  {rows.map((r) => (
                    <Link key={r.key} to={r.to} className="mini-row">
                      {r.user && <Avatar user={r.user} size={32} />}
                      <div><strong>{r.title}</strong><span>{r.sub}</span></div>
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
