import { Link } from 'react-router-dom'
import Photo from '../../components/ui/Photo'
import { useMeta } from '../../lib/meta'

const VALUES = [
  ['Honest over polished', 'Answers come from students who have filed the same forms, paid the same deposits and missed the same deadlines.'],
  ['Safe by design', 'Every member is 18 or older, checked against a photo ID. Abuse is filtered automatically and reviewed by people.'],
  ['Free where it counts', 'Questions, answers, chatrooms and the AI Counsellor cost nothing. Mentors are optional.'],
]

export default function About() {
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
            <p>At TYM, we connect young people through seamless, intuitive and engaging chat. Founded in 2026, TYM was created by a team of passionate alumni who wanted to guide the youth through the critical decisions that come with studying abroad. We saw the chance to build a chat platform that puts its members first, and set out to make something special.</p>
            <p>The Youth Matters grew out of our founder's own experience of how hard those decisions were during her study abroad journey. She holds a master's in Artificial Intelligence from a reputed university in the UK, and brings an international outlook from a childhood spent in the multicultural atmosphere of Dubai.</p>
            <p>Thank you for being part of our journey. The TYM team</p>
          </div>
          <Link to="/register" className="btn btn-primary">Join the community</Link>
        </div>
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
