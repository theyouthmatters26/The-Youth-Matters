import { useApi } from '../../lib/api'
import { caseStudies } from '../../data/sample'
import { useMeta } from '../../lib/meta'

export default function CaseStudies() {
  useMeta({ title: 'Case studies', description: 'The journeys The Youth Matters is built for: getting visa funds right, finding flatmates before the flight, and reshaping a shortlist with a mentor.', path: '/case-studies' })
  // The team writes these in the admin panel. The examples in sample.js are the fallback, so the
  // page still reads while the request is in flight or if it fails.
  const { data } = useApi('/case-studies')
  const stories = data?.length ? data : caseStudies
  return (
    <div className="container page">
      <header className="page-head">
        <h1>The journeys TYM is built for</h1>
        <p>Examples of how students use the community on their way to study abroad. Stories from our own members will take their place as they share them.</p>
      </header>
      <div className="case-grid">
        {stories.map((c) => (
          <figure key={c.id || c.name} className="card card-pad case">
            <p className="mono faint">{c.route}</p>
            <blockquote className="display">“{c.quote}”</blockquote>
            <figcaption className="mini-row">
              <div><strong>{c.course}</strong><br><span>An example journey</span></div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
