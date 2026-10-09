import { Link } from 'react-router-dom'
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react'
import { subjects } from '../../data/sample'
import Photo from '../ui/Photo'
import './layout.css'

// Bottom link row: exactly the client's template, in order.
export const FOOTER_LINKS = [
  ['/contact', 'Contact us'],
  ['/mentors/register', 'Mentors Registration'],
  ['/queries', 'Queries & Suggestions'],
  ['/guidelines', 'Community Guidelines'],
  ['/terms', 'Terms & Conditions'],
  ['/payment-terms', 'Payment Terms'],
  ['/help-safety', 'Help & Safety'],
  ['/privacy', 'Privacy Policy'],
  ['/cookies', 'Cookies Policy'],
]

// Put each profile's full address in href. One left empty is not shown, so the footer never
// links to a social network's front page.
const SOCIAL = [
  { href: '', label: 'Facebook', Icon: Facebook },
  { href: '', label: 'X', Icon: Twitter },
  { href: '', label: 'Instagram', Icon: Instagram },
  { href: '', label: 'YouTube', Icon: Youtube },
  { href: '', label: 'LinkedIn', Icon: Linkedin },
].filter((s) => s.href)

export default function Footer() {
  return (
    <footer className="site-footer dark">
      <div className="container footer-top">
        <div className="footer-brand">
          <Link to="/" className="footer-logo" aria-label="The Youth Matters, home">
            <Photo src="/logo.png" width="48" height="50" sizes="48px" />
            <span><b>T</b>he <b>Y</b>outh <b>M</b>atters</span>
          </Link>
          <p className="footer-line display">Ask before you fly.</p>
          <p className="muted">A community of students helping each other take the next step, one honest answer at a time.</p>
          <Link to="/ai" className="btn btn-light btn-sm">Ask TYM AI</Link>
        </div>
        <div className="footer-col">
          <p className="footer-title">Subjects</p>
          {subjects.map((s) => s.isActive
            ? <Link key={s.slug} to="/community">{s.name}</Link>
            : <span key={s.slug} className="footer-soon">{s.name} <em>Soon</em></span>)}
        </div>
        <div className="footer-col">
          <p className="footer-title">Community</p>
          <Link to="/community">Community ChatRoom</Link>
          <Link to="/mentors">TYM Mentors</Link>
          <Link to="/blogs">Blogs</Link>
          <Link to="/case-studies">Case Studies</Link>
        </div>
      </div>

      <nav className="container footer-links" aria-label="Footer">
        {FOOTER_LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
      </nav>

      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} The Youth Matters. All Rights Reserved.</span>
        {SOCIAL.length > 0 && (
          <div className="connect" aria-label="Connect with us">
            <span>Connect</span>
            {SOCIAL.map(({ href, label, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><Icon size={16} strokeWidth={1.6} /></a>
            ))}
          </div>
        )}
      </div>
    </footer>
  )
}
