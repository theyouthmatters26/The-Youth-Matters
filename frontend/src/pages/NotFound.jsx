import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container page narrow" style={{ textAlign: 'left' }}>
      <p className="eyebrow">Gate closed</p>
      <h1 style={{ fontSize: 'var(--step-4)', margin: '8px 0 12px' }}>This page has already departed.</h1>
      <p className="muted" style={{ marginBottom: 20 }}>The link may be old, or the post may have been removed.</p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  )
}
