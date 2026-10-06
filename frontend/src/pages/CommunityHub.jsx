import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import PostCard from '../components/feed/PostCard'
import RoomCard from '../components/feed/RoomCard'
import Gate from '../components/ui/Gate'
import { countries, posts, rooms, subjects } from '../data/sample'
import { formatCount } from '../lib/format'
import { useAuth } from '../lib/auth'

const PREVIEW = 2

// Community ChatRoom: Subject -> Country -> Chat rooms & discussions.
export default function CommunityHub() {
  const { user } = useAuth()
  const [subject, setSubject] = useState('study-abroad')
  const active = subjects.find((s) => s.slug === subject)
  const latest = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="container page">
      <header className="page-head">
        <h1>Community ChatRoom</h1>
        <p>Pick a subject, then a country. Each community has live chat rooms, discussions and mentors who have been there.</p>
      </header>

      <div className="subject-tabs" role="tablist" aria-label="Subjects">
        {subjects.map((s) => (
          <button key={s.slug} role="tab" aria-selected={subject === s.slug} disabled={!s.isActive}
            onClick={() => setSubject(s.slug)}>
            {s.name}{!s.isActive && <em>Soon</em>}
          </button>
        ))}
      </div>

      <p className="crumbs" aria-label="Where you are">
        <span>{active.name}</span> <ChevronRight size={14} /> <span className="faint">Choose a country</span>
      </p>

      <div className="community-grid">
        {countries.map((c) => (
          <Link key={c.slug} to={`/c/${c.slug}`} className="community-card">
            <img src={`/images/city-${c.slug}.jpg`} alt="" loading="lazy" />
            <span className="community-name">{c.name}</span>
            <span className="community-meta">{formatCount(c.members)} members</span>
            <span className="community-arrow" aria-hidden><ArrowUpRight size={16} /></span>
          </Link>
        ))}
      </div>

      <div className="live-grid" style={{ marginTop: 'var(--s-8)' }}>
        <section aria-labelledby="disc-title">
          <h2 id="disc-title" className="col-title">Latest discussions</h2>
          <div className="feed-list">{(user ? latest : latest.slice(0, PREVIEW)).map((p) => <PostCard key={p.id} post={p} />)}</div>
          {!user && (
            <Gate title="Read every discussion" text="Free members can read, ask and answer in every community.">
              <div className="feed-list">{latest.slice(PREVIEW, PREVIEW + 2).map((p) => <PostCard key={p.id} post={p} />)}</div>
            </Gate>
          )}
        </section>
        <section aria-labelledby="rooms-title">
          <h2 id="rooms-title" className="col-title">Chat rooms</h2>
          <div className="room-list">{(user ? rooms : rooms.slice(0, PREVIEW)).map((r) => <RoomCard key={r.slug} room={r} />)}</div>
          {!user && (
            <Gate title="Join every chat room" text="Sign up to chat live with students heading the same way.">
              <div className="room-list">{rooms.slice(PREVIEW).map((r) => <RoomCard key={r.slug} room={r} />)}</div>
            </Gate>
          )}
        </section>
      </div>
    </div>
  )
}
