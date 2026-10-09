import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Bookmark, CalendarCheck, ChevronDown, EllipsisVertical, GraduationCap, KeyRound, LayoutDashboard, LogOut, Search, Settings, User, UserPlus, X } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import Photo from '../ui/Photo'
import './layout.css'

// Same items and order as the client's template.
export const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About TYM' },
  { to: '/features', label: 'Features' },
  { to: '/community', label: 'Community ChatRoom' },
  { to: '/ai', label: 'Ask TYM AI', highlight: true },
  { to: '/mentors', label: 'TYM Mentors' },
  { to: '/faq', label: 'FAQ' },
  { to: '/case-studies', label: 'Case Studies' },
  { to: '/blogs', label: 'Blogs' },
]

function SearchDialog({ onClose }) {
  const navigate = useNavigate()
  const input = useRef(null)
  useEffect(() => {
    input.current.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    const q = input.current.value.trim()
    if (q) { navigate(`/search?q=${encodeURIComponent(q)}`); onClose() }
  }

  return (
    <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Search" onClick={onClose}>
      <form className="search-panel" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <Search size={20} strokeWidth={1.6} aria-hidden />
        <label htmlFor="global-search" className="visually-hidden">Search</label>
        <input id="global-search" ref={input} placeholder="Search discussions, communities, mentors" autoComplete="off" />
        <kbd>Esc</kbd>
      </form>
    </div>
  )
}

// Unread count, refreshed every minute, on page changes and when notifications are read
function NotificationBell() {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()
  useEffect(() => {
    const load = () => api('/notifications/unread').then((r) => setCount(r.unread)).catch(() => {})
    load()
    const timer = setInterval(load, 60000)
    window.addEventListener('tym:notifications', load)
    return () => { clearInterval(timer); window.removeEventListener('tym:notifications', load) }
  }, [pathname])
  return (
    <Link to="/notifications" className="account-link bell" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
      <Bell size={17} strokeWidth={1.7} />
      {count > 0 && <span className="bell-count">{count > 9 ? '9+' : count}</span>}
    </Link>
  )
}

// Everything about your own account: the desktop avatar menu and the phone menu both list these
function accountLinks(user) {
  const profile = `/u/${user.username}`
  return [
    ['/my', LayoutDashboard, 'My TYM'],
    [profile, User, 'Your profile'],
    [`${profile}?tab=Saved`, Bookmark, 'Saved questions'],
    [`${profile}?tab=Sessions`, CalendarCheck, 'Your sessions'],
    ['/settings', Settings, 'Profile settings'],
    user.role === 'student' && ['/mentors/register', GraduationCap, 'Become a mentor'],
  ].filter(Boolean)
}

// Avatar menu on wide screens, including the way out
function AccountMenu({ user }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => setOpen(false), [pathname, search])
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const profile = `/u/${user.username}`
  const links = accountLinks(user)

  return (
    <div className="account-menu" ref={ref}>
      <button className="account-me" aria-haspopup="menu" aria-expanded={open} aria-label="Your account" onClick={() => setOpen(!open)}>
        <Avatar user={user} size={30} />
        <span>My TYM</span>
        <ChevronDown size={14} aria-hidden className="account-caret" />
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <Link to={profile} className="account-pop-head" role="menuitem">
            <Avatar user={user} size={40} />
            <span><strong>{user.displayName}</strong><span>@{user.username}</span></span>
          </Link>
          {links.map(([to, Icon, label]) => (
            <Link key={to} to={to} role="menuitem"><Icon size={16} strokeWidth={1.7} aria-hidden /> {label}</Link>
          ))}
          <button role="menuitem" className="account-pop-out" onClick={() => { setOpen(false); logout(); navigate('/') }}>
            <LogOut size={16} strokeWidth={1.7} aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Header() {
  const { user, account, logout } = useAuth()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const { key } = useLocation()

  useEffect(() => setMenu(false), [key]) // any move, a tab on the same page included
  useEffect(() => {
    document.body.style.overflow = menu || search ? 'hidden' : ''
  }, [menu, search])

  return (
    <>
      {/* Masthead: logo left, account links top right (client template) */}
      <div className={`masthead${user ? ' is-member' : ''}`}>
        <div className="container masthead-inner">
          <Link to="/" className="brand" aria-label="The Youth Matters, home">
            <Photo src="/logo.png" width="44" height="46" sizes="44px" loading="eager" />
            <span className="brand-name"><b>T</b>he <b>Y</b>outh <b>M</b>atters</span>
          </Link>

          <div className="account">
            {user && <NotificationBell />}
            {user ? (
              <AccountMenu user={user} />
            ) : account ? (
              <Link to="/register" className="account-link account-auth"><UserPlus size={15} strokeWidth={1.7} /> Finish sign-up</Link>
            ) : (
              <>
                <Link to="/login" className="account-link account-auth"><KeyRound size={15} strokeWidth={1.7} /> Log in</Link>
                <Link to="/register" className="account-link account-auth"><UserPlus size={15} strokeWidth={1.7} /> Register</Link>
              </>
            )}
            <button className="account-link" onClick={() => setSearch(true)}><Search size={15} strokeWidth={1.7} /> Search</button>
            <button className={`menu-toggle${user && !menu ? ' is-me' : ''}`} aria-expanded={menu} aria-controls="mobile-menu"
              aria-label={menu ? 'Close menu' : user ? 'Your account' : 'Open menu'} onClick={() => setMenu(!menu)}>
              {menu ? <X size={22} strokeWidth={1.6} /> : user ? <Avatar user={user} size={42} /> : <EllipsisVertical size={22} strokeWidth={2.6} />}
            </button>
          </div>
        </div>
      </div>

      {/* Black nav bar (client template), sticky */}
      <nav className="navbar" aria-label="Main">
        <ul className="container navbar-inner">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={`nav-link ${item.highlight ? 'nav-ai' : ''}`}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Phones and tablets. A visitor's menu is the site's pages. A member's is their own account:
          the pages are in the strip under the header instead (the same nav bar, scrolling sideways). */}
      {menu && (
        <div id="mobile-menu" className="mobile-menu">
          <div className="container">
            {!user && (
              <nav aria-label="Mobile">
                {NAV.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className="mobile-link">
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
            {user && (
              <>
                <nav aria-label="Your account" className="mobile-account">
                  <Link to={`/u/${user.username}`} className="mobile-me">
                    <Avatar user={user} size={44} />
                    <span><strong>{user.displayName}</strong><span>@{user.username}</span></span>
                  </Link>
                  {accountLinks(user).map(([to, Icon, label]) => (
                    <Link key={to} to={to} className="mobile-sublink"><Icon size={17} strokeWidth={1.7} aria-hidden /> {label}</Link>
                  ))}
                </nav>
                <div className="mobile-actions is-one">
                  <button className="btn btn-light" onClick={() => { logout(); navigate('/') }}>Log out</button>
                </div>
              </>
            )}
            {account && !user && (
              <div className="mobile-actions">
                <Link to="/register" className="btn btn-light">Finish sign-up</Link>
              </div>
            )}
            {!account && (
              <div className="mobile-actions">
                <Link to="/login" className="btn btn-glass">Log in</Link>
                <Link to="/register" className="btn btn-light">Register</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {search && <SearchDialog onClose={() => setSearch(false)} />}
    </>
  )
}
