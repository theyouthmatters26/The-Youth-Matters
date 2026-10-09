import { useLocation } from 'react-router-dom'
import { useMeta } from '../../lib/meta'
import { policies } from '../../data/policies'
import NotFound from '../NotFound'

// Footer pages. The policies are the client's own wording (data/policies.js); the first three are ours.
// A page is [title, introduction, body, last updated]. The body is a list of blocks, or a policy from that file.
const PAGES = {
  '/news': ['Latest news', 'Updates from the TYM team: new destinations, features and community events.', [
    'Communities are open for the United Kingdom, United States, Canada, Australia, Ireland and Germany, and more destinations will follow as the community grows.',
  ]],
  '/careers': ['Work for us', 'We are a small team building a calmer way to prepare for studying abroad.', [
    'We do not have open roles right now. Send your CV and a short note to support@theyouthmatters.com and we will keep you in mind.',
  ]],
  '/volunteer': ['Volunteer', 'Help moderate the community, welcome new members or run a country chatroom.', [
    'Volunteers are experienced members with a good standing record. Write to support@theyouthmatters.com with the hub you would like to help with.',
  ]],
  '/queries': ['Queries and suggestions', 'Questions, feedback and suggestions that help us improve The Youth Matters.', policies['/queries']],
  '/guidelines': ['Community guidelines', 'The behaviour expected from everyone using The Youth Matters, a community for people aged 18 to 32.', policies['/guidelines']],
  '/payment-terms': ['Payment terms and refund/cancellation policy', 'How payments, cancellations and refunds work for paid offerings on The Youth Matters.', [
    ...policies['/payment-terms'].blocks,
    // The one paid offering today, and what the site does for it
    ['h', 'Mentor sessions'],
    'Mentor sessions are paid for with counselling hours. You buy a package of hours in advance through Razorpay, by UPI, card or net banking, with prices shown in INR, and every payment gets an invoice number and a receipt by email. Each session you book takes its length from your hours, at the same rate for every mentor. Cancel up to 24 hours before a session and the time goes back on your hours. To ask about a refund for hours you have not used, write to info@theyouthmatters.com.',
  ], policies['/payment-terms'].updated],
  '/help-safety': ['Help and safety', 'How we keep The Youth Matters a respectful and safer place, and what to do if something goes wrong.', policies['/help-safety']],
  '/terms': ['Terms and conditions', 'The terms for using The Youth Matters website, platform and services.', policies['/terms']],
  '/privacy': ['Privacy policy', 'How we collect, use, store and protect your personal data.', policies['/privacy']],
  '/cookies': ['Cookie policy', 'How The Youth Matters uses cookies and similar technologies.', policies['/cookies']],
}

export default function StaticPage() {
  const { pathname } = useLocation()
  const [title, intro, body, updated = body?.updated] = PAGES[pathname] || []
  useMeta({ title, description: intro, path: pathname })
  if (!title) return <NotFound />
  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1>{title}</h1>
        <p>{intro}</p>
        {updated && <p className="faint dash-small">Last updated: {updated}</p>}
      </header>
      <div className="card card-pad stack prose">
        {(body.blocks || body).map((b, i) => (
          typeof b === 'string' ? <p key={i}>{b}</p>
            : b[0] === 'h' ? <h2 key={i}>{b[1]}</h2>
              : <ul key={i}>{b[1].map((item) => <li key={item}>{item}</li>)}</ul>
        ))}
      </div>
    </div>
  )
}

export const STATIC_PATHS = Object.keys(PAGES) // read by scripts/prerender.mjs
