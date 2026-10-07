import { Link } from 'react-router-dom'
import { Bot, Globe2, MessagesSquare, ShieldCheck, Users, Vote } from 'lucide-react'
import { useMeta } from '../../lib/meta'

const FEATURES = [
  { Icon: Users, title: 'Questions and answers', text: 'Ask anything, answer what you know, and vote the most useful replies to the top.', to: '/ask', cta: 'Ask a question' },
  { Icon: Globe2, title: 'Destination hubs', text: 'Join the UK, US, Canada and more to fill your feed with the countries you care about.', to: '/community', cta: 'See every country' },
  { Icon: MessagesSquare, title: 'Live chatrooms', text: 'Free public rooms by country. Find flatmates, compare CAS timelines, ask quick questions.', to: '/chat', cta: 'Open chatrooms' },
  { Icon: Bot, title: 'AI Counsellor', text: 'Private help with SOPs, visa steps and shortlists. Type @TYMAi in any chatroom for a quick answer.', to: '/ai', cta: 'Try the AI Lounge' },
  { Icon: Vote, title: 'Verified mentors', text: 'Book a paid one-to-one with a student at the university you want, at a time that suits you.', to: '/mentors', cta: 'Browse mentors' },
  { Icon: ShieldCheck, title: 'A safer community', text: 'Every member is 18+ and checked with a photo ID, abuse is filtered automatically, and there is a three-strike policy and one-click reporting.', to: '/faq', cta: 'How moderation works' },
]

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
    </div>
  )
}
