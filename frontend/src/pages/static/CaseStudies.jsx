import { caseStudies } from '../../data/sample'
import { useMeta } from '../../lib/meta'

export default function CaseStudies() {
  useMeta({ title: 'Case studies', description: 'The journeys The Youth Matters is built for: getting visa funds right, finding flatmates before the flight, and reshaping a shortlist with a mentor.', path: '/case-studies' })
  return (
    <div className="container page">
      <header className="page-head">
        <h1>The journeys TYM is built for</h1>
        <p>Three examples of how students use the community on their way abroad. Stories from our own members will take their place as they share them.</p>
      </header>
      <div className="case-grid">
        {caseStudies.map((c) => (
          <figure key={c.name} className="card card-pad case">
            <p className="mono faint">{c.route}</p>
            <blockquote className="display">“{c.quote}”</blockquote>
            <figcaption className="mini-row">
              <div><strong>{c.course}</strong><span>An example journey</span></div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
