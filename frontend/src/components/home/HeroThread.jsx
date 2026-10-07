import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { comments, countryBySlug, mentors, posts } from '../../data/sample'
import { building } from '../../lib/prerender'
import './home.css'

// The headline's promise, shown literally: a question and the answer from someone who went.
// It follows the background slider (London -> a UK question, Toronto -> a Canadian one).
// These are written examples (data/sample.js), so the card says so, carries no counts or times,
// and links to the real community rather than to a thread.
function threadFor(country) {
  const firstAnswer = (p) => comments[p.id]?.find((c) => !c.parentId && c.author.role !== 'bot')
  const question = posts.find((p) => p.country === country && firstAnswer(p))
  return question && { question, answer: firstAnswer(question) }
}

const credentials = (user) => {
  const m = mentors.find((x) => x.user.username === user.username)
  return m ? `${m.course}, ${m.university}` : user.bio
}

function ThreadCard({ question, answer, country, active }) {
  // In a page built ahead of time the five cards waiting their turn show initials: their portraits
  // would be fetched with the page's first picture and they cannot be seen yet
  const face = (user) => (building && !active ? { ...user, avatar: null } : user)
  return (
    <article className={`thread-card${active ? ' is-active' : ''}`} aria-hidden={!active} inert={active ? undefined : ''}>
      <header className="thread-who">
        <Avatar user={face(question.author)} size={34} />
        <span>
          <strong>{question.author.displayName}</strong>
          <span>{question.author.bio}</span>
        </span>
      </header>
      <p className="thread-q">{question.title}</p>

      <div className="thread-answer">
        <header className="thread-who">
          <Avatar user={face(answer.author)} size={34} />
          <span>
            <strong>{answer.author.displayName} {answer.author.role === 'mentor' && <em>Mentor</em>}</strong>
            <span>{credentials(answer.author)}</span>
          </span>
        </header>
        <div className="thread-body">
          <span className="thread-typing" aria-hidden>
            {answer.author.displayName.split(' ')[0]} is typing <i /><i /><i />
          </span>
          <p className="thread-a">{answer.body}</p>
        </div>
      </div>

      <footer className="thread-foot">
        <span>An example of a question and its answer</span>
        <Link to={`/c/${country}`} className="thread-link">See the real ones <ArrowUpRight size={15} aria-hidden /></Link>
      </footer>
    </article>
  )
}

export default function HeroThread({ countries, active }) {
  const threads = countries.map((c) => ({ country: c, thread: threadFor(c) })).filter((t) => t.thread)
  const current = threads.find((t) => t.country === countries[active]) || threads[0]

  return (
    <figure className="thread" aria-label="An example of a question and its answer">
      {/* All cards share one grid cell: the tallest sets the height, so nothing jumps as they change */}
      <div className="thread-stack">
        <div className="thread-card thread-behind" aria-hidden />
        {threads.map(({ country, thread }) => (
          <ThreadCard key={country} {...thread} country={country} active={country === current.country} />
        ))}
      </div>
      <figcaption className="thread-caption" key={current.country}>
        What the {countryBySlug[current.country].name} community is for
      </figcaption>
    </figure>
  )
}
