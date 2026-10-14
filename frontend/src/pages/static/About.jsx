import { Link } from 'react-router-dom'
import Photo from '../../components/ui/Photo'
import { useAuth } from '../../lib/auth'
import { useMeta } from '../../lib/meta'

const VALUES = [
  ['Honest answers, not sales talk', 'The people answering have already been through it themselves, so you hear what actually happened. TYM is not an agent and earns nothing from where you choose to apply.'],
  ['Safe by design', 'Every member is 18 or older, checked against a photo ID. Abuse is filtered automatically and reviewed by people.'],
  ['Free where it counts', 'Questions, answers, chatrooms and the AI Counsellor cost nothing. Mentors are optional.'],
]

export default function About() {
  const { account } = useAuth()
  useMeta({ title: 'About TYM', description: 'The Youth Matters connects young people through honest conversation about studying abroad. Founded in 2026 by a team of alumni who wanted to guide the youth through that decision.', path: '/about' })
  return (
    <div className="container page">
      <header className="page-head">
        <h1>Our mission is simple: to connect <em>youth.</em></h1>
      </header>

      <section className="about-story">
        <figure className="about-photo">
          <Photo src="/images/hero-students.jpg" alt="Four students talking around a table" sizes="(max-width: 1240px) 92vw, 1160px" priority />
        </figure>
        <div className="about-copy">
          <h2 className="display about-lede">Communication is the solution for the youth.</h2>
          <div className="prose stack">
            <p>At TYM (The Youth Matters), we connect the youth through an engaging and easy-to-use chat platform. Founded in 2026 by a team of alumni, TYM was built to help students navigate the major decisions that come with studying abroad.</p>
            <p>Our platform grew directly out of our founder&apos;s own experience with the challenges of moving overseas for school. After growing up in Dubai&apos;s multicultural environment and earning master&apos;s degrees from top UK universities, we wanted to build a community-first space to support the next generation of international students.</p>
            <p>Thank you for being part of our journey.<br />&ndash; The TYM Team</p>
          </div>
          {account
            ? <Link to="/community" className="btn btn-primary">Open the community</Link>
            : <Link to="/register" className="btn btn-primary">Join the community</Link>}
        </div>
      </section>

      <section className="founders" aria-labelledby="story-title">
        <figure className="founder-face">
          <Photo src="/images/founder/founder1.jpg" alt="Sumayya Samreen" sizes="(max-width: 900px) 40vw, 260px" />
          <figcaption>Sumayya Samreen</figcaption>
        </figure>
        <div className="founder-copy">
          <p className="founder-eyebrow">Our Story</p>
          <h2 id="story-title" className="display">Birth of<br />The Youth Matters</h2>
          <p>It all started from personal experience. We still remember how isolating it felt to decide
            to study abroad: navigating the forms, deposits, deadlines, selections and approvals without
            having anyone to turn to who had actually been through it.</p>
          <p>This platform is the exact space we wish we had back then: real students who have made the
            move, mentors who give honest answers, and a community focused entirely on what you actually
            need.</p>
        </div>
        <figure className="founder-face">
          <Photo src="/images/founder/founder2.jpg" alt="Sameera Maheen" sizes="(max-width: 900px) 40vw, 260px" />
          <figcaption>Sameera Maheen</figcaption>
        </figure>
      </section>

      <section className="value-grid">
        {VALUES.map(([title, text]) => (
          <div key={title} className="value">
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
