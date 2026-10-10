import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MessageSquarePlus } from 'lucide-react'
import { FormError, SubmitButton } from '../../components/auth/fields'
import { faqs as fallback } from '../../data/sample'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useMeta } from '../../lib/meta'

const ld = (pairs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: pairs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
})

// Anyone can send a question in; our team answers it and useful ones join the list above.
function PostYourFaq() {
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const send = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/faqs', { method: 'POST', body: { question: question.trim() } })
      setSent(true)
      setQuestion('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card card-pad stack faq-ask" aria-labelledby="faq-ask-title">
      <h2 id="faq-ask-title" className="section-title"><MessageSquarePlus size={18} aria-hidden /> Post your FAQ</h2>
      <p className="muted">Something missing from this page? Send us the question. We answer it, and the useful
        ones are added here for everyone.</p>
      {!user ? (
        <p className="muted">
          <Link to="/login" className="link">Log in</Link> to send a question, or{' '}
          <Link to="/contact" className="link">contact us</Link>.
        </p>
      ) : sent ? (
        <p className="saved-note" role="status"><Check size={15} /> Thank you. Our team will answer it, and you
          will get a notification when they do.</p>
      ) : (
        <form className="stack" onSubmit={send}>
          <div className="field">
            <div className="field-row">
              <label htmlFor="faq-q">Your question</label>
              <span className="hint">{200 - question.length} left</span>
            </div>
            <input id="faq-q" className="input" value={question} onChange={(e) => setQuestion(e.target.value)}
              maxLength={200} placeholder="For example: can I work part time on a student visa in Ireland?" />
          </div>
          <FormError>{error}</FormError>
          <SubmitButton busy={busy} busyText="Sending" style={{ width: 'auto' }} disabled={question.trim().length < 10}>
            Send my question
          </SubmitButton>
        </form>
      )}
    </section>
  )
}

export default function Faq() {
  // The team writes these in the admin panel. The list that ships with the site is the fallback,
  // so the page is never empty while the API is loading or unreachable.
  const { data } = useApi('/faqs')
  const pairs = data?.length ? data.map((f) => [f.question, f.answer]) : fallback

  useMeta({ title: 'Frequently asked questions', description: 'How The Youth Matters works: free community, 18+ verification with a photo ID, TYMAi, mentor sessions, moderation and cancellations.', path: '/faq', jsonLd: ld(pairs) })

  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1>Frequently asked questions</h1>
        <p>About the community, verification, TYMAi and mentor sessions. Still unsure? <Link to="/contact" className="link">Contact us</Link>.</p>
      </header>
      <div className="faq">
        {pairs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p className="muted">{a}</p>
          </details>
        ))}
      </div>
      <PostYourFaq />
    </div>
  )
}
