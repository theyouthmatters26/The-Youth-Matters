import { Link } from 'react-router-dom'
import { MessagesSquare } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { roomMessages } from '../../data/sample'
import '../home/home.css'

// Chat room preview: name, people online and the last two messages.
export default function RoomCard({ room }) {
  return (
    <Link to={`/chat/${room.slug}`} className="room-card">
      <header>
        <span className="room-name"><MessagesSquare size={16} strokeWidth={1.7} /> {room.name}</span>
        <span className="room-online">{room.online} online</span>
      </header>
      <ul>
        {roomMessages.slice(0, 2).map((m) => (
          <li key={m.id}>
            <Avatar user={m.author} size={24} />
            <p><strong>{m.author.displayName}</strong> {m.body}</p>
          </li>
        ))}
      </ul>
    </Link>
  )
}
