import { Link } from 'react-router-dom'
import Photo, { shipped } from '../../components/ui/Photo'
import { useAuth } from '../../lib/auth'
import { useMeta } from '../../lib/meta'

const VALUES = [
  ['Honest answers, not sales talk', 'The people answering have already been through it themselves, so you hear what actually happened. TYM is not an agent and earns nothing from where you choose to apply.'],
  ['Safe by design', 'Every member is 18 or older, checked against a photo ID. Abuse is filtered automatically and reviewed by people.'],
  ['Free where it counts', 'Questions, answers, chatrooms and the AI Counsellor cost nothing. Mentors are optional.'],
]

// Her photograph is in. Replace `message` with Sumayya's own words when she sends them.
const FOUNDER = {
  name: 'Sumayya Samreen',
  role: 'Founder, The Youth Matters',
  photo: '/images/founder.jpg',
  message: [
    'I started The Youth Matters because I remember how lonely the decision to study abroad can feel. '
    + 'The forms, the deposits, the deadlines, and nobody to ask who had actually been through it.',
    'This is the place I wish I had: students who have already made the move, mentors who answer '
    + 'honestly, and a community that does not sell you anything you do not need.',
  ],
}

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
            <p>At TYM, we connect young people through seamless, intuitive and engaging chat. Founded in 2026, TYM was created by a team of passionate alumni who wanted to guide the youth through the critical decisions that come with studying abroad. We saw the chance to build a chat platform that puts its members first, and set out to make something special.</p>
            <p>The Youth Matters grew out of our founder's own experience of how hard those decisions were during her study abroad journey. She holds a master's in Artificial Intelligence from a reputed university in the UK, and brings an international outlook from a childhood spent in the multicultural atmosphere of Dubai.</p>
            <p>Thank you for being part of our journey. The TYM team</p>
          </div>
          {account
            ? <Link to="/community" className="btn btn-primary">Open the community</Link>
            : <Link to="/register" className="btn btn-primary">Join the community</Link>}
        </div>
      </section>

      {/* A word from the founder. Replace FOUNDER.message with Sumayya's own words when
          she sends them. */}
      <section className={`founder${shipped(FOUNDER.photo) ? '' : ' is-solo'}`} aria-labelledby="founder-title">
        {shipped(FOUNDER.photo) && (
          <figure className="founder-photo">
            <Photo src={FOUNDER.photo} alt={`${FOUNDER.name}, founder of The Youth Matters`}
              sizes="(max-width: 860px) 40vw, 260px" />
          </figure>
        )}
        <div className="founder-copy">
          <p className="eyebrow" id="founder-title">A word from our founder</p>
          <blockquote>
            {FOUNDER.message.map((line) => <p key={line}>{line}</p>)}
          </blockquote>
          <p className="founder-name"><strong>{FOUNDER.name}</strong><span>{FOUNDER.role}</span></p>
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
