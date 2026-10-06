import { Link } from 'react-router-dom'
import { MessagesSquare } from 'lucide-react'
import { timeAgo } from '../../lib/format'
import '../home/home.css'

// One chat room in a list, like a messages inbox: room, latest message and when it was sent.
// Visitors get the room description instead of other people's messages.
export default function RoomCard({ room, active = false }) {
  const last = room.last
  return (
    <Link to={`/chat/${room.slug}`} className={`room-row${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="room-thumb" aria-hidden>
        {room.country ? <img src={`/images/city-${room.country}.jpg`} alt="" loading="lazy" /> : <MessagesSquare size={18} strokeWidth={1.7} />}
      </span>
      <span className="room-body">
        <span className="room-top">
          <strong>{room.name}</strong>
          {room.lastAt && <time className="faint" dateTime={room.lastAt}>{timeAgo(room.lastAt)}</time>}
        </span>
        <span className="room-last">
          {last ? <><b>{last.author.displayName.split(' ')[0]}:</b> {last.body}</> : room.description}
        </span>
        {room.activeToday > 0 && <span className="room-here">{room.activeToday} {room.activeToday === 1 ? 'person' : 'people'} talking today</span>}
      </span>
    </Link>
  )
}
