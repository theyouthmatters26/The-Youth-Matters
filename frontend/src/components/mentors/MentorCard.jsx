import { Link } from 'react-router-dom'
import { BadgeCheck, Star } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Photo from '../ui/Photo'
import './mentors.css'

// preview: the same card, not a link (the mentor application shows applicants how they will look)
export default function MentorCard({ m, preview = false }) {
  const Tag = preview ? 'div' : Link
  return (
    <Tag {...(preview ? {} : { to: `/mentors/${m.id}` })} className="mcard">
      <div className="mcard-photo">
        {m.user.avatar ? <Photo src={m.user.avatar} sizes="(max-width: 640px) 46vw, 280px" /> : <Avatar user={m.user} size={96} />}
        <span className="mcard-price">Requires counselling hours · {m.sessionMinutes} min</span>
      </div>
      <div className="mcard-body">
        <h3>{m.user.displayName} <BadgeCheck size={16} aria-label="Verified mentor" /></h3>
        <p className="mcard-uni">{m.course} · {m.university}</p>
        <p className="mcard-headline">{m.headline}</p>
        <footer>
          {m.rating ? <span><Star size={14} aria-hidden /> {m.rating} <span className="faint">({m.reviewCount})</span></span> : <span className="faint">New mentor</span>}
          <span className="faint">{m.community.country.name}</span>
        </footer>
      </div>
    </Tag>
  )
}

export function MentorCardSkeleton() {
  return (
    <div className="mcard mcard-skeleton" aria-hidden>
      <div className="mcard-photo" />
      <div className="mcard-body"><i /><i /><i /></div>
    </div>
  )
}
