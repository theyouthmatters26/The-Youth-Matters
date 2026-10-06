import { Link } from 'react-router-dom'
import { faqs } from '../../data/sample'
import { useMeta } from '../../lib/meta'

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
}

export default function Faq() {
  useMeta({ title: 'Frequently asked questions', description: 'How The Youth Matters works: free community, 18+ verification with a photo ID, TYMAi, mentor sessions, moderation and cancellations.', path: '/faq', jsonLd: FAQ_LD })
  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1>Frequently asked questions</h1>
        <p>About the community, verification, TYMAi and mentor sessions. Still unsure? <Link to="/contact" className="link">Contact us</Link>.</p>
      </header>
      <div className="faq">
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p className="muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
