import { Link } from 'react-router-dom'
import { ArrowUpRight, MessagesSquare, Star } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { countryBySlug, roomMessages, rooms } from '../../data/sample'
import { useApi } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import './home.css'

// Right rail for country and post pages: the live chatroom, mentors who studied there,
// the official rules, and TYMAi. Everything is about the country being read.
export default function SideRail({ country }) {
  const place = countryBySlug[country]
  const { data } = useApi(country ? `/mentors?country=${country}` : '/mentors')
  const mentors = (data || []).slice(0, 3)
  const room = rooms.find((r) => r.slug === country) || rooms[0]
  const recent = roomMessages.filter((m) => m.author.role !== 'bot').slice(-2)

  return (
    <aside className="stack sticky rail">
      <div className="card card-pad rail-room">
        <div className="rail-room-head">
          <h3 className="section-title"><MessagesSquare size={16} aria-hidden /> {room.name} chatroom</h3>
          <span className="rail-live">{room.online} online</span>
        </div>
        <ul className="rail-messages">
          {recent.map((m) => (
            <li key={m.id}><Avatar user={m.author} size={26} /><p><strong>{m.author.displayName.split(' ')[0]}</strong> {m.body}</p></li>
          ))}
        </ul>
        <Link to={`/chat/${room.slug}`} className="btn btn-ghost btn-sm btn-block">Join the conversation</Link>
      </div>

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
