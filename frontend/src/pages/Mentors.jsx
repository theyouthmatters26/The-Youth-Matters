import { useState } from 'react'
import { CalendarCheck, Lock, Search, ShieldCheck } from 'lucide-react'
import Gate from '../components/ui/Gate'
import MentorCard, { MentorCardSkeleton } from '../components/mentors/MentorCard'
import Packages from '../components/mentors/Packages'
import { countries } from '../data/sample'
import { useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useMeta } from '../lib/meta'
import '../components/mentors/mentors.css'

const PREVIEW = 2 // visitors see this many, the rest after signing up

export default function Mentors() {
  useMeta({ title: 'TYM Mentors', description: 'Book a one-to-one video session with a verified mentor who studied where you are going. Buy counselling hours once and use them with any mentor; cancel up to 24 hours before.', path: '/mentors' })
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi('/mentors')
  const [country, setCountry] = useState('')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const list = (data || []).filter((m) =>
    (!country || m.community.country.slug === country) &&
    (!q || `${m.user.displayName} ${m.university} ${m.course} ${m.topics.join(' ')}`.toLowerCase().includes(q)))
  const shown = user ? list : list.slice(0, PREVIEW)
  const hidden = user ? [] : list.slice(PREVIEW)

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">TYM Mentors · One-to-one sessions</p>
        <h1>Book a student who has done it</h1>
        <p>Every mentor is checked by our team. Buy counselling hours, pick any mentor and a time in your own time zone, and meet on a video call.</p>
      </header>

      <ul className="trust-row">
        <li><ShieldCheck size={16} aria-hidden /> Verified by our team</li>
        <li><CalendarCheck size={16} aria-hidden /> Free cancellation up to 24 hours before</li>
        <li><Lock size={16} aria-hidden /> Secure payment with Razorpay</li>
      </ul>

      <section className="mentor-pricing" id="hours" aria-labelledby="hours-title">
        <header className="section-head">
          <h2 id="hours-title" className="display">First, get counselling hours</h2>
          <p>One price for every mentor. Buy hours once, then choose any mentor below and book a time with them: a 30 minute session uses half an hour.</p>
        </header>
        <Packages />
      </section>

      <h2 className="display mentor-choose">Then choose any mentor</h2>
      <div className="mentor-filters">
        <div className="chip-row" role="group" aria-label="Country">
          <button className={`chip${country ? '' : ' is-on'}`} aria-pressed={!country} onClick={() => setCountry('')}>All countries</button>
          {countries.map((c) => (
            <button key={c.slug} className={`chip${country === c.slug ? ' is-on' : ''}`} aria-pressed={country === c.slug}
              onClick={() => setCountry(c.slug)}>{c.name}</button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} aria-hidden />
          <span className="visually-hidden">Search mentors</span>
          <input type="search" placeholder="University, course or topic" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && (
        <div className="stack" style={{ justifyItems: 'start' }}>
          <p className="form-error">{error.message}</p>
          <button className="btn btn-ghost btn-sm" onClick={reload}>Try again</button>
        </div>
      )}

      <div className="mcard-grid">
        {loading && [0, 1, 2].map((i) => <MentorCardSkeleton key={i} />)}
        {shown.map((m) => <MentorCard key={m.id} m={m} />)}
        {hidden.length > 0 && (
          <div className="mcard-gate">
            <Gate title={`${hidden.length} more ${hidden.length === 1 ? 'mentor' : 'mentors'} to meet`}
              text="Create a free account to see every mentor and their open times.">
              <MentorCard m={hidden[0]} />
            </Gate>
          </div>
        )}
      </div>

      {data && list.length === 0 && (
        <div className="empty card">
          <h2 className="display">No mentors match that yet</h2>
          <p className="muted">Try another country or a broader search. New mentors join every month.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCountry(''); setQuery('') }}>Clear filters</button>
        </div>
      )}
    </div>
  )
}
