import { Link } from 'react-router-dom'

const VALUES = [
  ['Honest over polished', 'Answers come from students who have filed the same forms, paid the same deposits and missed the same deadlines.'],
  ['Safe by design', 'Every member is 18 or older, checked against a photo ID. Abuse is filtered automatically and reviewed by people.'],
  ['Free where it counts', 'Questions, answers, chatrooms and the AI Counsellor cost nothing. Mentors are optional.'],
]

export default function About() {
  return (
    <div className="container page">
      <header className="page-head">
        <h1>Built by students who wished this <em>existed.</em></h1>
      </header>

      <section className="about-story">
        <figure className="about-photo">
          <img src="/images/hero-students.jpg" alt="Four students talking around a table" width="1600" height="1067" />
        </figure>
        <div className="about-copy">
          <h2 className="display about-lede">One place for every question between the offer letter and the flight.</h2>
          <div className="prose stack">
            <p>The Youth Matters started with a group chat. A handful of us were applying to UK universities, swapping screenshots of visa checklists and asking the same questions over and over. The answers existed, but they were scattered across forums, agents with something to sell, and friends of friends.</p>
            <p>So we built one place for it. Ask anything about studying abroad, get answers from people who have just done it, and talk to them live. We are starting with the UK and adding destinations as the community grows.</p>
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
