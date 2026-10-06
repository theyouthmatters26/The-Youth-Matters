import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BadgeCheck, Star } from 'lucide-react'
import Hero from '../components/home/Hero'
import PostCard, { PostSkeleton } from '../components/feed/PostCard'
import RoomCard from '../components/feed/RoomCard'
import Avatar from '../components/ui/Avatar'
import Gate from '../components/ui/Gate'
import { blogs, caseStudies, countries, subjects } from '../data/sample'
import { useApi } from '../lib/api'
import { formatCount, formatMoney } from '../lib/format'
import { useAuth } from '../lib/auth'
import '../components/home/home.css'

// Visitors see this many items per list before the sign-up gate.
const PREVIEW = 2

function Subjects() {
  return (
    <section className="section" aria-labelledby="subjects-title">
      <div className="container subjects">
        <header className="section-head" data-reveal>
          <h2 id="subjects-title" className="display">One community. Every next step.</h2>
          <p>We are starting with Study Abroad. Career, Education, Entrepreneurship and Life &amp; Experiences open next, built the same way: subject, country, chat rooms, mentors.</p>
        </header>
        <ol className="subject-list" data-reveal data-reveal-delay="1">
          {subjects.map((s) => (
            <li key={s.slug} className={s.isActive ? 'is-live' : ''}>
              {s.isActive ? (
                <Link to="/community" className="subject-row">
                  <span className="subject-name display">{s.name}</span>
                  <span className="subject-desc">{s.description}</span>
                  <span className="subject-status">Open now <ArrowUpRight size={16} /></span>
                </Link>
              ) : (
                <div className="subject-row">
                  <span className="subject-name display">{s.name}</span>
                  <span className="subject-desc">{s.description}</span>
                  <span className="subject-status">Coming soon</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Destinations() {
  return (
    <section className="section" aria-labelledby="dest-title">
      <div className="container">
        <header className="section-head" data-reveal>
          <h2 id="dest-title" className="display">Where are you headed?</h2>
          <p>Every country has its own community with discussions, a live chat room and mentors who studied there.</p>
        </header>
        <div className="dest-grid" data-reveal data-reveal-delay="1">
          {countries.map((c, i) => (
            <Link key={c.slug} to={`/c/${c.slug}`} className="dest-card">
              <img src={`/images/city-${c.slug}.jpg`} alt="" loading="lazy" width="900" height="600" />
              <div className="dest-info">
                <span className="dest-name">{c.name}</span>
                <span className="dest-meta">{formatCount(c.members)} students</span>
                {i === 0 && <span className="dest-note">Our largest community, and where TYM started.</span>}
              </div>
              <ArrowUpRight size={18} className="dest-arrow" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// The four best discussions this week from the API; visitors see two and the invitation
function TopPosts() {
  const { user } = useAuth()
  const { data } = useApi('/posts?sort=top')
  if (!data) return <div className="feed-list"><PostSkeleton /><PostSkeleton /></div>
  const top = data.items
  return (
    <>
      <div className="feed-list">{top.slice(0, user ? 4 : PREVIEW).map((p) => <PostCard key={p.id} post={p} />)}</div>
      {!user && (
        <Gate title="Read every discussion" text="Create a free account to see all questions, answer them and follow the countries you care about.">
          <div className="feed-list">{top.slice(PREVIEW, PREVIEW + 2).map((p) => <PostCard key={p.id} post={p} />)}</div>
        </Gate>
      )}
    </>
  )
}

function LiveCommunity() {
  const { user } = useAuth()
  const rooms = useApi('/chat/rooms').data || []

  return (
    <section className="section" id="feed" aria-labelledby="live-title">
      <div className="container">
        <header className="section-head section-head-row" data-reveal>
          <div>
            <h2 id="live-title" className="display">Live in the community</h2>
            <p>The most useful discussions this week, and the chat rooms that are busy right now.</p>
          </div>
          <Link to="/community" className="text-link">Open Community ChatRoom <ArrowRight size={16} /></Link>
        </header>

        <div className="live-grid">
          <div>
            <h3 className="col-title">Top discussions</h3>
            <TopPosts />
          </div>
          <div>
            <h3 className="col-title">Chat rooms</h3>
            <div className="card card-pad room-list">{rooms.map((r) => <RoomCard key={r.slug} room={r} />)}</div>
            {!user && <Link to="/register" className="btn btn-ghost btn-sm btn-block hub-rail-cta">Sign up free to chat</Link>}
          </div>
        </div>
      </div>
    </section>
  )
}

function MentorCard({ m, featured = false }) {
  return (
    <Link to={`/mentors/${m.id}`} className={`mentor-dark ${featured ? 'is-featured' : ''}`}>
      <div className="mentor-dark-top">
        <Avatar user={m.user} size={featured ? 64 : 48} />
        <div>
          <strong>{m.user.displayName} <BadgeCheck size={15} aria-label="Verified" /></strong>
          <span>{m.course}, {m.university}</span>
        </div>
      </div>
      <p>{m.headline}</p>
      <footer>
        <span>{m.rating ? <><Star size={13} /> {m.rating} · {m.reviewCount} reviews</> : 'New mentor'}</span>
        <span>{formatMoney(m.priceMinor, m.currency)} / {m.sessionMinutes} min</span>
      </footer>
    </Link>
  )
}

function MentorsBand() {
  const { user } = useAuth()
  const { data } = useApi('/mentors')
  const all = data || []
  const list = all.slice(0, 3)
  return (
    <section className="dark band" aria-labelledby="mentors-title">
      <div className="container">
        <header className="section-head section-head-row" data-reveal>
          <div>
            <h2 id="mentors-title" className="display">Talk to someone who went</h2>
            <p className="muted">Verified students and recent graduates. Book a one-to-one when you want a proper hour on your plans.</p>
          </div>
          <Link to={user ? '/mentors' : '/register'} state={{ from: '/mentors' }} className="btn btn-light">
            {user ? 'View all mentors' : 'Sign up to view all mentors'}
            <span className="btn-arrow" aria-hidden><ArrowUpRight size={15} /></span>
          </Link>
        </header>
        <div className="mentor-band-grid" data-reveal data-reveal-delay="1">
          {(user ? list : list.slice(0, PREVIEW)).map((m, i) => <MentorCard key={m.id} m={m} featured={i === 0} />)}
          {!user && list[PREVIEW] && (
            <Gate tone="dark" title={`${all.length - PREVIEW} more mentors`} text="Sign up to see every mentor, their open times and prices.">
              <MentorCard m={list[PREVIEW]} />
            </Gate>
          )}
        </div>
      </div>
    </section>
  )
}

function Blogs() {
  const [lead, ...rest] = blogs
  if (!lead) return null
  return (
    <section className="section" aria-labelledby="blogs-title">
      <div className="container">
        <header className="section-head section-head-row" data-reveal>
          <div>
            <h2 id="blogs-title" className="display">From the blog</h2>
            <p>Guides written by the TYM team and our mentors.</p>
          </div>
          <Link to="/blogs" className="text-link">All articles <ArrowRight size={16} /></Link>
        </header>
        <div className="blog-layout" data-reveal data-reveal-delay="1">
          <Link to={`/blogs/${lead.slug}`} className="blog-lead">
            <div className="blog-photo"><img src={lead.image} alt="" loading="lazy" /></div>
            <span className="blog-meta">{lead.topic} · {lead.readMins} min read</span>
            <h3>{lead.title}</h3>
            <p>{lead.excerpt}</p>
          </Link>
          <ul className="blog-list">
            {rest.map((b) => (
              <li key={b.slug}>
                <Link to={`/blogs/${b.slug}`}>
                  <span className="blog-meta">{b.topic} · {b.readMins} min read</span>
                  <h3>{b.title}</h3>
                  <p>{b.excerpt}</p>
                  <ArrowUpRight size={18} className="blog-arrow" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Story() {
  const story = caseStudies[0]
  return (
    <section className="section" aria-label="Member story">
      <div className="container story" data-reveal>
        <img src="/images/flight.jpg" alt="View of a plane wing above the clouds" loading="lazy" />
        <figure>
          <blockquote className="display">{story.quote}</blockquote>
          <figcaption>
            <strong>{story.name}</strong>
            <span>{story.course}, {story.route}</span>
          </figcaption>
          <Link to="/case-studies" className="text-link">Read more case studies <ArrowRight size={16} /></Link>
        </figure>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Subjects />
      <Destinations />
      <LiveCommunity />
      <MentorsBand />
      <Blogs />
      <Story />
    </>
  )
}
