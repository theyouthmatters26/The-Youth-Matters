import { Fragment } from 'react'
import { Link } from 'react-router-dom'

// What members write is plain text. Show it with paragraphs and line breaks, make web links
// clickable and turn @username into a link to that profile. React escapes everything else.
const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|(?<![\w@])@[a-z0-9._]{3,32})/gi

function line(text, key) {
  return text.split(TOKEN).map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      return <a key={`${key}-${i}`} href={part} target="_blank" rel="noopener nofollow ugc" className="link">{part.replace(/^https?:\/\/(www\.)?/, '')}</a>
    }
    if (/^@[a-z0-9._]{3,32}$/i.test(part)) {
      return <Link key={`${key}-${i}`} to={`/u/${part.slice(1).toLowerCase()}`} className="mention">{part}</Link>
    }
    return <Fragment key={`${key}-${i}`}>{part}</Fragment>
  })
}

export default function RichText({ text, className }) {
  if (!text) return null
  return (
    <div className={className}>
      {text.split(/\n{2,}/).map((para, p) => (
        <p key={p}>{para.split('\n').map((l, i) => <Fragment key={i}>{i > 0 && <br />}{line(l, `${p}-${i}`)}</Fragment>)}</p>
      ))}
    </div>
  )
}
