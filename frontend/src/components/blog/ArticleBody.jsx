import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Check, Lightbulb } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { users } from '../../data/sample'
import './blog.css'

// Articles are written as text in the admin panel, turned into typed blocks (lib/article.js) and rendered here, so writers get
// stats that count up, checklists readers can tick, tables and callouts without writing HTML.

// **bold** and [label](url) inside any text. Internal links stay in the app, others open a new tab.
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g
export function Inline({ text }) {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (!link) return <Fragment key={i}>{part}</Fragment>
    const [, label, href] = link
    if (!/^(https?:\/\/|mailto:|\/)/i.test(href)) return <Fragment key={i}>{label}</Fragment>
    return href.startsWith('/')
      ? <Link key={i} to={href} className="link">{label}</Link>
      : <a key={i} href={href} target="_blank" rel="noopener" className="link">{label}</a>
  })
}

// Runs once when the element first scrolls into view
function useInView(threshold = 0.35) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return undefined
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, threshold])
  return [ref, seen]
}

function CountUp({ value, prefix = '', suffix = '' }) {
  const [ref, seen] = useInView(0.6)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!seen) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return undefined }
    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1400)
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [seen, value])
  return <span ref={ref} aria-label={`${prefix}${value.toLocaleString('en-GB')}${suffix}`}>{prefix}{shown.toLocaleString('en-GB')}{suffix}</span>
}

function Checklist({ id, title, items }) {
  const key = `tym.checklist.${id}`
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] }
  })
  const toggle = (i) => {
    const next = done.includes(i) ? done.filter((d) => d !== i) : [...done, i]
    setDone(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* private mode: ticks last this visit */ }
  }
  const pct = Math.round((done.length / items.length) * 100)
  return (
    <section className="checklist" aria-label={title} data-reveal>
      <header>
        <h3>{title}</h3>
        <span className="checklist-count">{done.length} of {items.length} done</span>
      </header>
      <span className="checklist-bar" aria-hidden><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
      <ul>
        {items.map((item, i) => (
          <li key={item}>
            <label className={done.includes(i) ? 'is-done' : ''}>
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} />
              <span className="checklist-box" aria-hidden><Check size={13} /></span>
              <span><Inline text={item} /></span>
            </label>
          </li>
        ))}
      </ul>
      <p className="checklist-note">Your ticks are saved on this device.</p>
    </section>
  )
}

const FACES = {
  mentor: Object.values(users).filter((u) => u.role === 'mentor' && u.avatar).slice(0, 4),
  community: Object.values(users).filter((u) => u.role === 'student' && u.avatar).slice(0, 4),
}
const CTA = {
  mentor: { title: 'Talk it through with someone who did it', text: 'Verified students and recent graduates review SOPs, visa files and plans on a one-to-one video call.', to: '/mentors', label: 'Find a mentor' },
  community: { title: 'Still unsure about your situation?', text: 'Ask the community. Students who went last year usually answer within a few hours, free.', to: '/ask', label: 'Ask a question' },
}

function Cta({ kind }) {
  const c = CTA[kind]
  return (
    <aside className="article-cta-card" data-reveal>
      <span className="faces" aria-hidden>{FACES[kind].map((u) => <Avatar key={u.username} user={u} size={32} />)}</span>
      <div>
        <strong>{c.title}</strong>
        <p>{c.text}</p>
      </div>
      <Link to={c.to} className="btn btn-light btn-sm">{c.label} <ArrowUpRight size={15} /></Link>
    </aside>
  )
}

function Block({ b }) {
  switch (b.type) {
    case 'p': return <p><Inline text={b.text} /></p>
    case 'h2': return <h2 id={b.id} data-reveal>{b.text}</h2>
    case 'h3': return <h3>{b.text}</h3>
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul'
      return <Tag className="article-list">{b.items.map((t) => <li key={t}><Inline text={t} /></li>)}</Tag>
    }
    case 'callout': return (
      <aside className={`callout callout-${b.tone || 'tip'}`} data-reveal>
        {b.tone === 'warning' ? <AlertTriangle size={18} aria-hidden /> : <Lightbulb size={18} aria-hidden />}
        <div>{b.title && <strong>{b.title}</strong>}<p><Inline text={b.text} /></p></div>
      </aside>
    )
    case 'stats': return (
      <div className="stat-row" data-reveal>
        {b.items.map((s) => (
          <div key={s.label}><span className="stat-value"><CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} /></span><span className="stat-label">{s.label}</span></div>
        ))}
      </div>
    )
    case 'steps': return (
      <ol className="article-steps" data-reveal>
        {b.items.map((s, i) => <li key={s.title}><span className="mono">{String(i + 1).padStart(2, '0')}</span><div><strong>{s.title}</strong><p><Inline text={s.text} /></p></div></li>)}
      </ol>
    )
    case 'table': return (
      <div className="article-table" data-reveal>
        <table>
          <thead><tr>{b.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row"><Inline text={c} /></th> : <td key={j}><Inline text={c} /></td>))}</tr>)}</tbody>
        </table>
      </div>
    )
    case 'quote': return (
      <figure className="article-quote" data-reveal>
        <blockquote><Inline text={b.text} /></blockquote>
        <figcaption><strong>{b.by}</strong>{b.role && <span>{b.role}</span>}</figcaption>
      </figure>
    )
    case 'example': return (
      <figure className={`article-example${/weak/i.test(b.label) ? ' is-weak' : ''}`}>
        <figcaption>{b.label}</figcaption>
        <p><Inline text={b.text} /></p>
      </figure>
    )
    case 'checklist': return <Checklist {...b} />
    case 'cta': return <Cta kind={b.kind} />
    default: return null
  }
}

export default function ArticleBody({ blocks }) {
  return <div className="article-body">{blocks.map((b, i) => <Block key={i} b={b} />)}</div>
}

// Table of contents with the section you are reading highlighted
export function Contents({ blocks }) {
  const sections = blocks.filter((b) => b.type === 'h2')
  const [active, setActive] = useState(sections[0]?.id)
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting)
      if (visible.length) setActive(visible[0].target.id)
    }, { rootMargin: '-15% 0px -70% 0px' })
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [blocks])
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ol>
        {sections.map((s) => (
          <li key={s.id}><a href={`#${s.id}`} className={active === s.id ? 'is-active' : ''} aria-current={active === s.id ? 'location' : undefined}>{s.text}</a></li>
        ))}
      </ol>
    </nav>
  )
}
