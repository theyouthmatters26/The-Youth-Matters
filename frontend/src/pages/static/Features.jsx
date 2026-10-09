import { Link } from 'react-router-dom'
import { Bot, Globe2, MessagesSquare, ShieldCheck, Users, Vote } from 'lucide-react'
import { useMeta } from '../../lib/meta'

const FEATURES = [
  { Icon: Users, title: 'Questions and answers', text: 'Ask anything, answer what you know, and vote the most useful replies to the top.', to: '/ask', cta: 'Ask a question' },
  { Icon: Globe2, title: 'Destination hubs', text: 'Join the UK, US, Canada and more to fill your feed with the countries you care about.', to: '/community', cta: 'See every country' },
  { Icon: MessagesSquare, title: 'Live chatrooms', text: 'Free public rooms by country. Find flatmates, compare CAS timelines, ask quick questions.', to: '/chat', cta: 'Open chatrooms' },
  { Icon: Bot, title: 'AI Counsellor', text: 'Private help with SOPs, visa steps and shortlists. Type @TYMAi in any chatroom for a quick answer.', to: '/ai', cta: 'Try the AI Lounge' },
  { Icon: Vote, title: 'Verified mentors', text: 'Buy counselling hours once, then book a one-to-one with any mentor at a time that suits you.', to: '/mentors', cta: 'Browse mentors' },
  { Icon: ShieldCheck, title: 'A safer community', text: 'Every member is 18+ and checked with a photo ID, abuse is filtered automatically, and there is a three-strike policy and one-click reporting.', to: '/faq', cta: 'How moderation works' },
]

// From the client's feature list: only what the site does today
const INCLUDED = [
  ['Accounts', 'Sign up and sign in with your email or Google, confirm your age once, and reset a forgotten password by email.'],
  ['Your profile', 'A profile with your own photo and personal details.'],
  ['Notifications', 'Alerts in the site when someone answers you or there is an update that matters.'],
  ['Chat history and search', 'Chat room messages are saved, and you can search questions, answers and members.'],
  ['Free chat rooms', 'Specialised chat rooms on study abroad matters, free to join.'],
  ['Your data', 'The security of your personal data is our top priority.'],
]
const MENTOR_KINDS = ['Higher education', 'Study abroad', 'Migration', 'Career', 'Finance management', 'Social matters', 'Friendship', 'Marriage', 'Investment', 'Mental health']

export default function Features() {
  useMeta({ title: 'Features', description: 'Country communities, questions and answers, live chat rooms, Ask TYM AI and one-to-one sessions with student mentors: everything between the offer letter and the flight.', path: '/features' })
  return (
    <div className="container page">
      <header className="page-head">
        <h1>Everything you need between the offer letter and the flight</h1>
      </header>
      <div className="feature-list">
        {FEATURES.map(({ Icon, title, text, to, cta }) => (
          <article key={title} className="feature">
            <Icon size={22} strokeWidth={1.5} />
            <h2>{title}</h2>
            <p className="muted">{text}</p>
            <Link to={to} className="link">{cta}</Link>
          </article>
        ))}
      </div>

      <section className="value-grid">
        {INCLUDED.map(([title, text]) => (
          <div key={title} className="value">
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="value-grid" style={{ marginTop: 'var(--s-7)' }}>
        <div className="value">
          <h3>TYM Mentors</h3>
          <p className="muted">Mentor sessions are a premium service: one-to-one time with an experienced person from the field. Study abroad mentors are open now, and we are bringing in counsellors for {MENTOR_KINDS.join(', ').toLowerCase()}.</p>
        </div>
        <div className="value">
          <h3>More chat rooms</h3>
          <p className="muted">After Study Abroad: education, scholarships, career, research, health, family matters, investments, social concerns, sports, entertainment, politics, sustainability, global issues and climate.</p>
        </div>
      </section>
    </div>
  )
}
