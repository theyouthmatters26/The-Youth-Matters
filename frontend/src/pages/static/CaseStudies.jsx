import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import RichText from '../../components/feed/RichText'
import { useApi } from '../../lib/api'
import { caseStudies } from '../../data/sample'
import { useMeta } from '../../lib/meta'

// A journey is worth opening when the team wrote more than the quote on the card
const hasMore = (c) => Boolean(c.story || c.images?.length)

// The whole journey: the pictures the team put on it and the longer read, over the page.
// <dialog> brings the backdrop, Escape and the focus trap with it, so none of that is written here.
function Story({ story, onClose }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.showModal() }, [])

  return (
    <dialog ref={ref} className="case-sheet" onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="case-sheet-body">
        <button type="button" className="case-sheet-close" onClick={() => ref.current.close()} aria-label="Close">
          <X size={18} />
        </button>
        <p className="mono faint">{story.route}</p>
        <blockquote className="display">“{story.quote}”</blockquote>
        {story.images?.length > 0 && (
          <div className={`case-shots n-${Math.min(story.images.length, 3)}`}>
            {story.images.map((src, i) => (
              <img key={src} src={src} alt={`${story.name}'s journey, picture ${i + 1}`} loading="lazy" />
            ))}
          </div>
        )}
        <RichText text={story.story} className="case-story" />
        <p className="case-sheet-who"><strong>{story.name}</strong>{story.course}</p>
      </div>
    </dialog>
  )
}

export default function CaseStudies() {
  useMeta({ title: 'Case studies', description: 'The journeys The Youth Matters is built for: getting visa funds right, finding flatmates before the flight, and reshaping a shortlist with a mentor.', path: '/case-studies' })
  // The team writes these in the admin panel. The examples in sample.js are the fallback, so the
  // page still reads while the request is in flight or if it fails.
  const { data } = useApi('/case-studies')
  const stories = data?.length ? data : caseStudies
  const [open, setOpen] = useState(null)

  return (
    <div className="container page">
      <header className="page-head">
        <h1>The journeys TYM is built for</h1>
        <p>Examples of how students use the community on their way to study abroad. Stories from our own members will take their place as they share them.</p>
      </header>
      <div className="case-grid">
        {stories.map((c) => {
          const card = (
            <>
              <p className="mono faint">{c.route}</p>
              <blockquote className="display">“{c.quote}”</blockquote>
              <figcaption className="mini-row">
                <div><strong>{c.course}</strong><span>{hasMore(c) ? 'Read their journey' : 'An example journey'}</span></div>
              </figcaption>
            </>
          )
          // Only the journeys with something behind them open; the rest stay as they always were
          return hasMore(c) ? (
            <figure key={c.id || c.name} className="card card-pad case case-open">
              <button type="button" className="case-button" onClick={() => setOpen(c)}>
                <span className="visually-hidden">Read {c.name}'s journey</span>
              </button>
              {card}
            </figure>
          ) : (
            <figure key={c.id || c.name} className="card card-pad case">{card}</figure>
          )
        })}
      </div>
      {open && <Story story={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
