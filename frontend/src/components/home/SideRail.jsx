import { Link } from 'react-router-dom'
import { ArrowUpRight, MessagesSquare, Star } from 'lucide-react'
import RoomCard from '../feed/RoomCard'
import Avatar from '../ui/Avatar'
import { countryBySlug } from '../../data/sample'
import { useApi } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import './home.css'

// Right rail for country and post pages: the live chatroom, mentors who studied there,
// the official rules, and TYMAi. Everything is about the country being read.
export default function SideRail({ country }) {
  const place = countryBySlug[country]
  const { data } = useApi(country ? `/mentors?country=${country}` : '/mentors')
  const mentors = (data || []).slice(0, 3)
  const rooms = useApi('/chat/rooms').data || []
  // The country's own room, or the open one (no country) when it has none
  const room = rooms.find((r) => r.country === country) || rooms.find((r) => !r.country)

  return (
    <aside className="stack sticky rail">
      {room && (
        <div className="card card-pad rail-room">
          <h3 className="section-title"><MessagesSquare size={16} aria-hidden /> Live chatroom</h3>
          <RoomCard room={room} />
          <Link to={`/chat/${room.slug}`} className="btn btn-ghost btn-sm btn-block">Join the conversation</Link>
        </div>
      )}

      {mentors.length > 0 && (
        <div className="card card-pad">
          <h3 className="section-title">{place ? `Mentors who studied in ${place.name}` : 'Talk to someone who went'}</h3>
          <div className="mini-list">
            {mentors.map((m) => (
              <Link key={m.id} to={`/mentors/${m.id}`} className="mini-row">
                <Avatar user={m.user} size={40} />
                <div>
                  <strong>{m.user.displayName}</strong>
                  <span>{m.university}</span>
                  {m.rating && <span className="mini-rating"><Star size={11} aria-hidden /> {m.rating} · {formatMoney(m.priceMinor, m.currency)}</span>}
                </div>
              </Link>
            ))}
          </div>
          <Link to="/mentors" className="text-link rail-more">All mentors <ArrowUpRight size={14} /></Link>
        </div>
      )}

      {place?.official && (
        <div className="card card-pad rail-official">
          <h3 className="section-title">Check the official rules</h3>
          <p className="muted">Visa rules change. Members share what worked for them; the government page has the final word.</p>
          <a href={place.official.url} target="_blank" rel="noreferrer" className="text-link">{place.official.label} <ArrowUpRight size={14} /></a>
        </div>
      )}

      <div className="card card-pad ai-card">
        <h3 className="display">Stuck on your SOP at 2am?</h3>
        <p>TYMAi reviews drafts, explains visa steps and helps you shortlist. Free and private.</p>
        <Link to="/ai" className="btn btn-light btn-sm">Open the AI Lounge</Link>
      </div>
    </aside>
  )
}
