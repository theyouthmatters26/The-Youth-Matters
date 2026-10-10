import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { users } from '../../data/sample'
import Avatar from './Avatar'
import './ui.css'

const FACES = Object.values(users).filter((u) => u.avatar && u.role === 'student').slice(0, 4)

// Members-only content. Visitors see the top of it fading out, then a panel inviting them in;
// members see the children as normal. With nothing to tease (a short feed, an empty one) it is
// the panel on its own: a visitor must never reach the end of a page with no way in.
export default function Gate({ children, title = 'See everything', text, tone = 'light' }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (user) return children

  return (
    <div className={`gate gate-${tone}${children ? '' : ' gate-bare'}`}>
      {children && <div className="gate-preview" aria-hidden inert="">{children}</div>}
      <div className="gate-panel">
        <span className="gate-faces" aria-hidden>{FACES.map((u) => <Avatar key={u.username} user={u} size={30} />)}</span>
        <h3 className="display">{title}</h3>
        {text && <p>{text}</p>}
        <div className="gate-actions">
          <Link to="/register" state={{ from: pathname }} className={`btn ${tone === 'dark' ? 'btn-primary' : 'btn-light'}`}>Create free account</Link>
          <Link to="/login" state={{ from: pathname }} className="gate-login">Log in</Link>
        </div>
        <p className="gate-note">Free for students. Every member is 18+ and verified.</p>
      </div>
    </div>
  )
}
