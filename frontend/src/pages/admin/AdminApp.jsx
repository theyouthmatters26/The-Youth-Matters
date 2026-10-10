import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, CircleHelp, Flag, Globe, GraduationCap, KeyRound, LayoutDashboard, LogOut, Mail, Menu, MessagesSquare, Newspaper, Users, Wallet, X } from 'lucide-react'
import { FormError, PasswordField, PasswordMeter, Spinner, SubmitButton } from '../../components/auth/fields'
import Avatar from '../../components/ui/Avatar'
import { AdminProvider, adminApi, useAdmin, useAdminApi } from '../../lib/admin'
import AdminLogin from './AdminLogin'
import Blog from './Blog'
import Community from './Community'
import Contact from './Contact'
import Faqs from './Faqs'
import Members from './Members'
import Mentors from './Mentors'
import Moderation from './Moderation'
import Overview from './Overview'
import Payments from './Payments'
import Support from './Support'
import Team from './Team'
import { Person, Pill, Sheet } from './ui'
import '../../components/auth/auth.css'
import './admin.css'

// One entry per screen. People only see the screens whose area they were given (admin.access).
// `counts` is the screen's number in /admin/badges, when that is not simply its area.
const NAV = [
  { area: 'overview', to: '/admin', label: 'Overview', icon: LayoutDashboard, page: Overview, end: true },
  { area: 'support', to: '/admin/support', label: 'Support', icon: MessagesSquare, page: Support },
  { area: 'support', to: '/admin/enquiries', label: 'Enquiries', icon: Mail, page: Contact, counts: 'contact' },
  { area: 'members', to: '/admin/members', label: 'Members', icon: Users, page: Members },
  { area: 'moderation', to: '/admin/moderation', label: 'Moderation', icon: Flag, page: Moderation },
  { area: 'community', to: '/admin/community', label: 'Community', icon: Globe, page: Community },
  { area: 'blog', to: '/admin/blog', label: 'Blog', icon: Newspaper, page: Blog },
  { area: 'faq', to: '/admin/faq', label: 'FAQ', icon: CircleHelp, page: Faqs },
  { area: 'mentors', to: '/admin/mentors', label: 'Mentors', icon: GraduationCap, page: Mentors },
  { area: 'bookings', to: '/admin/payments', label: 'Payments', icon: Wallet, page: Payments },
  { area: 'team', to: '/admin/team', label: 'Team', icon: KeyRound, page: Team },
]

// Your own name and password. Each form saves on its own, so changing one never touches the other.
function Account({ onClose }) {
  const { admin, update, signIn, signOut } = useAdmin()
  const navigate = useNavigate()
  const [name, setName] = useState(admin.name)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState({})
  const [done, setDone] = useState('')
  // Logging out goes to a clean sign-in page: the next person should not land where this one was
  const logOut = () => { navigate('/admin/login', { replace: true }); signOut() }

  const save = (what, fn) => async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    setBusy(what)
    setError({})
    setDone('')
    try {
      await fn(Object.fromEntries(new FormData(form)))
      setDone(what)
      if (what === 'password') { form.reset(); setPassword('') }
    } catch (err) {
      setError({ [what]: err.message })
    } finally {
      setBusy('')
    }
  }
  const saveName = save('name', async () => update(await adminApi('/admin/me', { method: 'PATCH', body: { name } })))
  // A new password signs every other device out; the server answers with fresh tokens for this one
  const savePassword = save('password', async (f) => {
    const fresh = await adminApi('/admin/me/password', { method: 'POST', body: { current: f.current, new: f.password } })
    signIn({ ...fresh, admin })
  })

  return (
    <Sheet title="Your account" onClose={onClose}>
      <div className="adm-account">
        <Person user={{ displayName: admin.name, avatar: admin.avatar }} sub={admin.email} size={52} />
        <div className="adm-account-pills"><Pill tone={admin.isOwner ? 'solid' : 'line'}>{admin.isOwner ? 'Owner · Super admin' : admin.roleLabel}</Pill></div>
      </div>

      <form className="stack" onSubmit={saveName}>
        <h3 className="adm-h2">Your details</h3>
        <div className="field">
          <label htmlFor="acc-name">Name</label>
          <input id="acc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
          <span className="hint">Students see this name when you reply to them in Support.</span>
        </div>
        <div className="field">
          <label htmlFor="acc-email">Email</label>
          <input id="acc-email" className="input" value={admin.email} readOnly />
          <span className="hint">You sign in with this email.</span>
        </div>
        <FormError>{error.name}</FormError>
        {done === 'name' && <p className="adm-ok" role="status">Your name is saved.</p>}
        <button className="btn btn-ghost adm-account-save" disabled={busy === 'name' || name.trim() === admin.name}>{busy === 'name' ? <Spinner /> : 'Save name'}</button>
      </form>

      <section>
        <h3 className="adm-h2">What you can open</h3>
        {admin.isOwner ? <p className="adm-hint">Everything. The owner is always a super admin and has the whole panel.</p> : (
          <div className="adm-chips">{NAV.filter((n) => admin.access.includes(n.area)).map((n) => <Pill key={n.to} tone="muted">{n.label}</Pill>)}</div>
        )}
      </section>

      <form className="stack" onSubmit={savePassword}>
        <h3 className="adm-h2">Change your password</h3>
        <PasswordField id="acc-current" label="Current password" name="current" autoComplete="current-password" />
        <PasswordField id="acc-new" label="New password" autoComplete="new-password" minLength={8} maxLength={72}
          value={password} onChange={(e) => setPassword(e.target.value)}>
          <PasswordMeter password={password} />
        </PasswordField>
        <FormError>{error.password}</FormError>
        {done === 'password' && <p className="adm-ok" role="status">Your password is changed, and every other device has been signed out. Use the new one next time you sign in.</p>}
        <SubmitButton busy={busy === 'password'} busyText="Saving" disabled={password.length < 8}>Change password</SubmitButton>
      </form>

      <button className="btn btn-ghost btn-block" onClick={logOut}><LogOut size={16} /> Log out</button>
    </Sheet>
  )
}

function Shell() {
  const { admin, can } = useAdmin()
  const { pathname } = useLocation()
  const items = NAV.filter((n) => can(n.area))
  const home = items[0]?.to || '/admin/login'
  const badges = useAdminApi('/admin/badges')
  const [menu, setMenu] = useState(false)
  const [account, setAccount] = useState(false)

  useEffect(() => setMenu(false), [pathname])
  useEffect(() => {
    const t = setInterval(badges.reload, 30000)
    return () => clearInterval(t)
  }, [badges.reload])

  return (
    <div className="adm">
      <header className="adm-top">
        <Link to={home} className="adm-brand"><img src="/logo.png" alt="" /><span>The Youth Matters<small>Admin</small></span></Link>
        <button className="adm-icon" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="adm-rail" aria-label={menu ? 'Close menu' : 'Open menu'}>
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <aside id="adm-rail" className={`adm-rail${menu ? ' is-open' : ''}`}>
        <Link to={home} className="adm-brand"><img src="/logo.png" alt="" /><span>The Youth Matters<small>Admin</small></span></Link>
        <nav aria-label="Admin">
          {items.map(({ area, to, label, icon: Icon, end, counts = area }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={17} strokeWidth={1.7} aria-hidden /> {label}
              {badges.data?.[counts] > 0 && <span className="adm-badge" aria-label={`${badges.data[counts]} waiting`}>{badges.data[counts]}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="adm-rail-foot">
          <a href="/" target="_blank" rel="noreferrer" className="adm-rail-link">View the site <ArrowUpRight size={14} aria-hidden /></a>
          <button className="adm-me" onClick={() => setAccount(true)}>
            <Avatar user={{ displayName: admin.name, avatar: admin.avatar }} size={34} />
            <span><strong>{admin.name}</strong><span>{admin.isOwner ? 'Owner · Super admin' : admin.roleLabel}</span></span>
          </button>
        </div>
      </aside>
      {menu && <button className="adm-scrim" onClick={() => setMenu(false)} aria-label="Close menu" />}

      <main className="adm-main" id="main">
        <Routes>
          {items.map(({ to, page: Page }) => <Route key={to} path={to} element={<Page onChanged={badges.reload} />} />)}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </main>
      {account && <Account onClose={() => setAccount(false)} />}
    </div>
  )
}

function Routed() {
  const { admin } = useAdmin()
  const location = useLocation()

  useEffect(() => {
    // The panel is not for search engines
    const robots = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex, nofollow' })
    document.head.appendChild(robots)
    document.title = 'Admin | The Youth Matters'
    return () => robots.remove()
  }, [])

  const atLogin = location.pathname === '/admin/login'
  if (!admin) return atLogin ? <AdminLogin /> : <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
  if (atLogin) return <Navigate to={location.state?.from || '/admin'} replace />
  return <Shell />
}

export default function AdminApp() {
  return <AdminProvider><Routed /></AdminProvider>
}
