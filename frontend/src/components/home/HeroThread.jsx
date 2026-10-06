import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { comments, countryBySlug, mentors, posts } from '../../data/sample'
import { timeAgo } from '../../lib/format'
import './home.css'

// The headline's promise, shown literally: a real question and the answer from someone who went.
// It follows the background slider (London -> a UK question, Toronto -> a Canadian one), and is
// built from the same discussion data as the feed, so it previews the product, not decoration.
function threadFor(country) {
  const firstAnswer = (p) => comments[p.id]?.find((c) => !c.parentId && c.author.role !== 'bot')
  const question = posts.find((p) => p.country === country && firstAnswer(p))
  return question && { question, answer: firstAnswer(question) }
}

const credentials = (user) => {
  const m = mentors.find((x) => x.user.username === user.username)
  return m ? `${m.course}, ${m.university}` : user.bio
}

function ThreadCard({ question, answer, active }) {
  const hours = Math.max(1, Math.round((new Date(answer.createdAt) - new Date(question.createdAt)) / 3600_000))
  return (
    <article className={`thread-card${active ? ' is-active' : ''}`} aria-hidden={!active} inert={active ? undefined : ''}>
      <header className="thread-who">
        <Avatar user={question.author} size={34} />
        <span>
          <strong>{question.author.displayName} <time dateTime={question.createdAt}>{timeAgo(question.createdAt)} ago</time></strong>
          <span>{question.author.bio}</span>
        </span>
      </header>
      <p className="thread-q">{question.title}</p>

      <div className="thread-answer">
        <header className="thread-who">
          <Avatar user={answer.author} size={34} />
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
        <span>Answered within {hours} {hours === 1 ? 'hour' : 'hours'}</span>
        <span>{question.score} found this helpful</span>
        <Link to={`/p/${question.id}`} className="thread-link">Read the thread <ArrowUpRight size={15} aria-hidden /></Link>
      </footer>
    </article>
  )
}

export default function HeroThread({ countries, active }) {
  const threads = countries.map((c) => ({ country: c, thread: threadFor(c) })).filter((t) => t.thread)
  const current = threads.find((t) => t.country === countries[active]) || threads[0]

  return (
    <figure className="thread" aria-label="A recent question and answer from the community">
      {/* All cards share one grid cell: the tallest sets the height, so nothing jumps as they change */}
      <div className="thread-stack">
        <div className="thread-card thread-behind" aria-hidden />
        {threads.map(({ country, thread }) => (
          <ThreadCard key={country} {...thread} active={country === current.country} />
        ))}
      </div>
      <figcaption className="thread-caption" key={current.country}>
        From the {countryBySlug[current.country].name} community
      </figcaption>
    </figure>
  )
}
