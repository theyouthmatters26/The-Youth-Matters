import { Link } from 'react-router-dom'
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react'
import { subjects } from '../../data/sample'
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

const SOCIAL = [
  { href: 'https://facebook.com', label: 'Facebook', Icon: Facebook },
  { href: 'https://x.com', label: 'X', Icon: Twitter },
  { href: 'https://instagram.com', label: 'Instagram', Icon: Instagram },
  { href: 'https://youtube.com', label: 'YouTube', Icon: Youtube },
  { href: 'https://linkedin.com', label: 'LinkedIn', Icon: Linkedin },
]

export default function Footer() {
  return (
    <footer className="site-footer dark">
      <div className="container footer-top">
        <div className="footer-brand">
          <Link to="/" className="footer-logo" aria-label="The Youth Matters, home">
            <img src="/logo.png" alt="" width="48" height="50" loading="lazy" />
            <span>The Youth Matters</span>
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
        <div className="connect" aria-label="Connect with us">
          <span>Connect</span>
          {SOCIAL.map(({ href, label, Icon }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><Icon size={16} strokeWidth={1.6} /></a>
          ))}
        </div>
      </div>
    </footer>
  )
}
