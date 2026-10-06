import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { blogs, users } from '../data/sample'
import { useMeta } from '../lib/meta'
import '../components/home/home.css'

const byline = (b) => {
  const person = Object.values(users).find((u) => u.username === b.author.username)
  return { displayName: b.author.name, role: person?.role || 'admin', avatar: person?.avatar || '/logo.png' }
}

function Byline({ post }) {
  return (
    <span className="blog-byline">
      <Avatar user={byline(post)} size={26} />
      {post.author.name} · {post.readMins} min read
    </span>
  )
}

export default function Blogs() {
  useMeta({
    title: 'Study abroad guides from students who went first',
    description: 'Long-form guides on UK student visa funds, your first month abroad and writing an SOP, written by the TYM team and verified student mentors.',
    path: '/blogs',
  })
  const [lead, ...rest] = blogs
  return (
    <div className="container page">
      <header className="page-head" data-reveal>
        <h1>Guides from people who went first</h1>
        <p>Practical writing from the TYM team and our mentors on visas, money, applications and life abroad.</p>
      </header>
      {lead && <div className="blog-layout" data-reveal data-reveal-delay="1">
        <Link to={`/blogs/${lead.slug}`} className="blog-lead">
          <div className="blog-photo"><img src={lead.image} alt={lead.imageAlt || ''} /></div>
          <span className="blog-meta">{lead.topic} · {lead.date}</span>
          <h3>{lead.title}</h3>
          <p>{lead.excerpt}</p>
          <Byline post={lead} />
        </Link>
        <ul className="blog-list">
          {rest.map((b) => (
            <li key={b.slug}>
              <Link to={`/blogs/${b.slug}`}>
                <span className="blog-meta">{b.topic} · {b.date}</span>
                <h3>{b.title}</h3>
                <p>{b.excerpt}</p>
                <Byline post={b} />
                <ArrowUpRight size={18} className="blog-arrow" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>}
    </div>
  )
}
