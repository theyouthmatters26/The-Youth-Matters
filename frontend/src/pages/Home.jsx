import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BadgeCheck, Star } from 'lucide-react'
import Hero from '../components/home/Hero'
import PostCard, { PostSkeleton } from '../components/feed/PostCard'
import RoomCard from '../components/feed/RoomCard'
import Avatar from '../components/ui/Avatar'
import Gate from '../components/ui/Gate'
import Photo, { cityPhoto } from '../components/ui/Photo'
import { caseStudies, countries, subjects } from '../data/sample'
import { useArticles } from '../lib/blog'
import { useApi } from '../lib/api'
import { formatCount } from '../lib/format'
import { useAuth } from '../lib/auth'
import { SITE, siteUrl, useMeta } from '../lib/meta'
import '../components/home/home.css'

// Visitors see this many items per list before the sign-up gate.
const PREVIEW = 2

const WHY = [
  ['Chatroom', 'Join the chatroom on study abroad matters and connect with peers who share your interests or face the same challenges.'],
  ['Free and open', 'The chatroom is completely free: an accessible place to express yourself and have meaningful conversations.'],
  ['Ask TYM AI', 'Take advice from our AI mentor as well, also for free.'],
  ['Safe environment', 'Your safety comes first. Conversations are monitored to keep the community respectful and supportive.'],
  ['Mentorship option', 'For personal guidance, premium mentorship is available to help you through your journey with expert advice.'],
]

function Why() {
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="container">
        <header className="section-head" data-reveal>
          <h2 id="why-title" className="display">Where your voice connects</h2>
          <p>At The Youth Matters (TYM), we are dedicated to creating a vibrant space where young people can discuss the challenges of studying abroad. Join today and be part of a community where your voice truly matters.</p>
        </header>
        <div className="value-grid" data-reveal data-reveal-delay="1">
          {WHY.map(([title, text]) => (
            <div key={title} className="value">
              <h3>{title}</h3>
              <p className="muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Subjects() {
  return (
    <section className="section" aria-labelledby="subjects-title">
      <div className="container subjects">
        <header className="section-head" data-reveal>
          <h2 id="subjects-title" className="display">One community. Every next step.</h2>
          <p>We are starting with Study Abroad. More chat rooms are on the way, among them education, scholarships, career, research, health, family matters, investments, sports, sustainability and global issues.</p>
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
  // The countries the site actually has, with how many students have joined each. Until they load,
  // the ones the website ships with, so the page drawn ahead of time is not empty.
  const live = useApi('/subjects/study-abroad/communities').data
  const places = live?.length
    ? live.map((c) => ({ ...c.country, members: c.members }))
    : countries.map((c) => ({ ...c, members: 0 }))
  return (
    <section className="section" aria-labelledby="dest-title">
      <div className="container">
        <header className="section-head" data-reveal>
          <h2 id="dest-title" className="display">Where are you headed?</h2>
          <p>Every country has its own community with discussions, a live chat room and mentors who studied there.</p>
        </header>
        <div className="dest-grid" data-reveal data-reveal-delay="1">
          {places.map((c) => (
            <Link key={c.slug} to={`/c/${c.slug}`} className="dest-card">
              <Photo src={cityPhoto(c)} sizes="(max-width: 640px) 92vw, (max-width: 1000px) 46vw, 400px" />
              <div className="dest-info">
                <span className="dest-name">{c.name}</span>
                <span className="dest-meta">{c.members > 0 ? `${formatCount(c.members)} ${c.members === 1 ? 'student' : 'students'}` : 'Open now'}</span>
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
  const { data, error } = useApi('/posts?sort=top')
  if (error && !data) return <p className="muted">We could not load the discussions just now. Reload the page to try again.</p>
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
        <span>{m.sessionMinutes} min · counselling hours</span>
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
            <Gate tone="dark" title={`${all.length - PREVIEW} more mentors`} text="Sign up to see every mentor and their open times.">
              <MentorCard m={list[PREVIEW]} />
            </Gate>
          )}
        </div>
      </div>
    </section>
  )
}

function Blogs() {
  const [lead, ...rest] = useArticles().articles.slice(0, 4)
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
            <div className="blog-photo"><Photo src={lead.image} sizes="(max-width: 860px) 92vw, 640px" /></div>
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
    <section className="section" aria-label="An example journey">
      <div className="container story" data-reveal>
        <Photo src="/images/flight.jpg" alt="View of a plane wing above the clouds" sizes="(max-width: 860px) 92vw, 520px" />
        <figure>
          <blockquote className="display">{story.quote}</blockquote>
          <figcaption>
            <strong>The kind of journey TYM is for</strong>
            <span>{story.course}, {story.route}</span>
          </figcaption>
          <Link to="/case-studies" className="text-link">See more journeys <ArrowRight size={16} /></Link>
        </figure>
      </div>
    </section>
  )
}

// What search engines are told this site is
const ABOUT_TYM = {
  '@context': 'https://schema.org', '@type': 'Organization', name: SITE, url: siteUrl, logo: `${siteUrl}/logo.png`,
  description: 'A community of students helping each other study abroad: questions and answers, chat rooms, mentors and guides.',
}

export default function Home() {
  useMeta({ description: 'Ask questions, meet students and talk to verified mentors before you study abroad. Honest answers on visas, money and housing from people who made the move.', path: '/', jsonLd: ABOUT_TYM })
  return (
    <>
      <Hero />
      <Why />
      <Subjects />
      <Destinations />
      <LiveCommunity />
      <MentorsBand />
      <Blogs />
      <Story />
    </>
  )
}
