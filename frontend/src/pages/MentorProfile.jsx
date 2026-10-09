import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Check, Clock, Globe2, Languages, Star } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import BookingPanel from '../components/mentors/BookingPanel'
import { city, formatTime } from '../components/mentors/booking'
import { Spinner } from '../components/auth/fields'
import { useApi } from '../lib/api'
import NotFound from './NotFound'
import Photo from '../components/ui/Photo'
import { useMeta } from '../lib/meta'
import '../components/mentors/mentors.css'

const STEPS = [
  ['Pick a time', 'Every time is shown in your own time zone, so there is no maths to do.'],
  ['Pay securely', 'UPI, cards, net banking or wallets through Razorpay. You get a receipt by email.'],
  ['Meet on video', 'The join link arrives by email and in My TYM. Cancel up to 24 hours before and the time goes back on your counselling hours.'],
]

function Stars({ value }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className={n <= Math.round(value) ? 'is-on' : ''} aria-hidden />)}
    </span>
  )
}

const reviewDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export default function MentorProfile() {
  const { id } = useParams()
  const { data: m, error, loading } = useApi(`/mentors/${id}`)
  useMeta({ title: m && `${m.user.displayName}, ${m.course}`, description: m?.headline, path: `/mentors/${id}` })

  if (loading) return <div className="container page mp-loading"><Spinner /> Loading profile</div>
  if (error?.status === 404) return <NotFound />
  if (error) return <div className="container page"><p className="form-error">{error.message}</p></div>

  const first = m.user.displayName.split(' ')[0]
  return (
    <div className="container page mp">
      <Link to="/mentors" className="back-link mp-back"><ArrowLeft size={15} /> All mentors</Link>

      <header className="mp-head">
        {m.user.avatar ? <Photo className="mp-photo" src={m.user.avatar} alt={`Portrait of ${m.user.displayName}`} sizes="(max-width: 720px) 60vw, 320px" priority />
          : <Avatar user={m.user} size={160} />}
        <div className="mp-intro">
          <p className="mp-kicker"><BadgeCheck size={15} aria-hidden /> Verified mentor · {m.community.country.name}</p>
          <h1>{m.user.displayName}</h1>
          <p className="mp-uni">{m.course}, {m.university}{m.graduationYear ? ` · Class of ${m.graduationYear}` : ''}</p>
          <p className="mp-headline">{m.headline}</p>
          <dl className="mp-facts">
            {m.rating && <div><dt><Star size={15} aria-hidden /> Rating</dt><dd>{m.rating} from {m.reviewCount} {m.reviewCount === 1 ? 'review' : 'reviews'}</dd></div>}
            <div><dt><Clock size={15} aria-hidden /> Session</dt><dd>{m.sessionMinutes} min · counselling hours</dd></div>
            {m.languages.length > 0 && <div><dt><Languages size={15} aria-hidden /> Speaks</dt><dd>{m.languages.join(', ')}</dd></div>}
            <div><dt><Globe2 size={15} aria-hidden /> Local time</dt><dd>{formatTime(new Date().toISOString(), m.timezone)} in {city(m.timezone)}</dd></div>
          </dl>
        </div>
      </header>

      <BookingPanel mentor={m} />

      <div className="mp-body">
        <section className="mp-section">
          <h2>About {first}</h2>
          <p className="mp-about">{m.about}</p>
          {m.experience && <p className="mp-experience">{m.experience}</p>}
        </section>

        {m.topics.length > 0 && (
          <section className="mp-section">
            <h2>{first} can help with</h2>
            <ul className="mp-topics">
              {m.topics.map((t) => <li key={t}><Check size={16} aria-hidden /> {t}</li>)}
            </ul>
          </section>
        )}

        <section className="mp-section">
          <h2>How a session works</h2>
          <ol className="mp-steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}><span className="mono">0{i + 1}</span><strong>{title}</strong><p>{text}</p></li>
            ))}
          </ol>
        </section>

        <section className="mp-section" aria-labelledby="reviews-title">
          <div className="mp-reviews-head">
            <h2 id="reviews-title">Reviews</h2>
            {m.rating && <p><strong>{m.rating}</strong> <Stars value={m.rating} /> <span className="faint">{m.reviewCount} from students who booked</span></p>}
          </div>
          {m.reviews.length ? (
            <ul className="mp-reviews">
              {m.reviews.map((r) => (
                <li key={r.id}>
                  <Stars value={r.rating} />
                  <p>{r.body}</p>
                  <footer><Avatar user={r.author} size={28} /> <strong>{r.author.displayName}</strong> <span className="faint">{reviewDate(r.createdAt)}</span></footer>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No reviews yet. Be the first to book {first}.</p>}
        </section>
      </div>

      <a href="#book" className="mp-mobile-bar">
        <span><strong>{m.sessionMinutes} min</strong> · counselling hours</span>
        <span className="btn btn-light btn-sm">See times</span>
      </a>
    </div>
  )
}
