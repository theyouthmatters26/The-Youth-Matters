import { Link, useLocation } from 'react-router-dom'
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

// Put each profile's full address in href. One left empty still shows its icon, but as a picture and
// not a link, so the footer never links to a social network's front page.
const SOCIAL = [
  { href: '', label: 'Facebook', Icon: Facebook },
  { href: '', label: 'X', Icon: Twitter },
  { href: '', label: 'Instagram', Icon: Instagram },
  { href: '', label: 'YouTube', Icon: Youtube },
  { href: '', label: 'LinkedIn', Icon: Linkedin },

]

// The number students message on WhatsApp, digits only with the country code (wa.me wants it that way)
const WHATSAPP = '447449424640'
// Pages where the bottom of the screen is a message box: the floating button would sit on the send button
const NO_FLOAT = ['/ai', '/chat']

function WhatsApp() {
  const { pathname } = useLocation()
  if (NO_FLOAT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null
  return (
    <a className="whatsapp" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hello, I have a question about The Youth Matters.')}`}
      target="_blank" rel="noreferrer" aria-label="Send a query on WhatsApp">
      <span className="whatsapp-label">WhatsApp us</span>
      <span className="whatsapp-icon" aria-hidden>
        <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor">
          <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.400L3 29l6.800-1.800C11.700 28.300 13.800 29 16 29c7.200 0 13-5.800 13-13S23.200 3 16 3zm0 23.700c-2 0-3.900-.5-5.600-1.500l-.4-.2-4 1.100 1.100-3.900-.3-.400C5.800 20.100 5.200 18.100 5.200 16 5.200 10 10 5.200 16 5.200S26.800 10 26.800 16 22 26.700 16 26.700zm5.900-8c-.3-.200-1.900-.900-2.200-1-.3-.100-.5-.200-.7.200-.200.300-.800 1-1 1.200-.200.200-.400.200-.700.100-.300-.200-1.400-.500-2.600-1.600-1-.900-1.600-1.900-1.800-2.300-.200-.300 0-.500.100-.700.100-.100.300-.400.500-.600.200-.200.200-.300.300-.500.100-.200.100-.400 0-.600-.100-.200-.700-1.800-1-2.400-.300-.600-.500-.500-.700-.500h-.600c-.200 0-.600.100-.900.400-.300.300-1.200 1.200-1.200 2.900s1.200 3.400 1.400 3.600c.200.200 2.400 3.700 5.900 5.200.800.400 1.500.600 2 .700.800.300 1.600.200 2.200.100.700-.100 1.900-.800 2.200-1.600.300-.800.300-1.400.200-1.600-.100-.100-.300-.200-.600-.400z" />
        </svg>
      </span>
    </a>
  )
}

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
        <div className="connect" aria-label="Connect with us">
          <span>Connect</span>
          {SOCIAL.map(({ href, label, Icon }) => (href
            ? <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><Icon size={16} strokeWidth={1.6} /></a>
            : <i key={label} role="img" aria-label={label}><Icon size={16} strokeWidth={1.6} /></i>))}
        </div>
      </div>
      <WhatsApp />
    </footer>
  )
}
