import Avatar from '../../components/ui/Avatar'
import { caseStudies, users } from '../../data/sample'
import { useMeta } from '../../lib/meta'

export default function CaseStudies() {
  useMeta({ title: 'Case studies', description: 'Short stories from students who used The Youth Matters on their way to universities in the UK and the US.', path: '/case-studies' })
  return (
    <div className="container page">
      <header className="page-head">
        <h1>Where our members ended up</h1>
        <p>Short stories from students who used the community on their way abroad.</p>
      </header>
      <div className="case-grid">
        {caseStudies.map((c) => (
          <figure key={c.name} className="card card-pad case">
            <p className="mono faint">{c.route}</p>
            <blockquote className="display">“{c.quote}”</blockquote>
            <figcaption className="mini-row">
              <Avatar user={Object.values(users).find((u) => u.displayName === c.name) || { displayName: c.name }} size={40} />
              <div><strong>{c.name}</strong><span>{c.course}</span></div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
