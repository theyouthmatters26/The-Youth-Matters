import { useEffect, useRef, useState } from 'react'
import { Bookmark, Check, Flag, Link2, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useMemberGuard } from '../../lib/auth'
import { FormError } from '../auth/fields'
import './feed.css'

export function SaveButton({ postId, saved: initial, label = true }) {
  const guard = useMemberGuard()
  const [saved, setSaved] = useState(initial)
  const toggle = async () => {
    if (!guard()) return
    setSaved(!saved)
    try {
      await api(`/posts/${postId}/save`, { method: saved ? 'DELETE' : 'POST' })
    } catch {
      setSaved(saved)
    }
  }
  return (
    <button className={`post-action${saved ? ' is-on' : ''}`} onClick={toggle} aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save for later'}>
      <Bookmark size={16} strokeWidth={1.7} fill={saved ? 'currentColor' : 'none'} />{label && (saved ? 'Saved' : 'Save')}
    </button>
  )
}

// Phones get the system share sheet (WhatsApp, Telegram...); desktops copy the link.
export function ShareButton({ path, title, label = true }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = `${window.location.origin}${path}`
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, url }); return } catch { /* cancelled */ return }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked */ }
  }
  return (
    <button className="post-action" onClick={share} aria-label="Share">
      {copied ? <Check size={16} /> : <Share2 size={16} strokeWidth={1.7} />}{label && (copied ? 'Link copied' : 'Share')}
    </button>
  )
}

const REASONS = ['Spam or advertising', 'Abuse or harassment', 'Wrong or misleading', 'Personal information shared', 'Something else']

export function ReportDialog({ target, onClose }) {
  const ref = useRef(null)
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [state, setState] = useState('form')
  const [error, setError] = useState('')
  useEffect(() => { ref.current?.showModal() }, [])

  const send = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api('/reports', { method: 'POST', body: { ...target, reason: details ? `${reason}: ${details}` : reason } })
      setState('sent')
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      {state === 'sent' ? (
        <div className="sheet-body">
          <h2 className="display">Thanks for telling us</h2>
          <p className="muted">Our moderators will look at it. You will not be named to the person you reported.</p>
          <button className="btn btn-primary btn-sm" onClick={() => ref.current.close()}>Close</button>
        </div>
      ) : (
        <form className="sheet-body" onSubmit={send}>
          <h2 className="display">What is wrong?</h2>
          <div className="report-reasons" role="radiogroup">
            {REASONS.map((r) => (
              <label key={r} className={reason === r ? 'is-on' : ''}>
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {r}
              </label>
            ))}
          </div>
          <textarea className="textarea" rows={3} maxLength={400} value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything that helps our moderators (optional)" />
          <FormError>{error}</FormError>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current.close()}>Cancel</button>
            <button className="btn btn-primary btn-sm">Send report</button>
          </div>
        </form>
      )}
    </dialog>
  )
}

// "..." menu: edit and delete for your own content, report for everyone else's.
export function MoreMenu({ own, onEdit, onDelete, reportTarget }) {
  const guard = useMemberGuard()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [reporting, setReporting] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setConfirming(false) } }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div className="more" ref={ref}>
      <button className="icon-ghost" aria-label="More options" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="more-menu" role="menu">
          {own && onEdit && <button role="menuitem" onClick={() => { setOpen(false); onEdit() }}><Pencil size={15} /> Edit</button>}
          {own && onDelete && !confirming && <button role="menuitem" onClick={() => setConfirming(true)}><Trash2 size={15} /> Delete</button>}
          {own && confirming && (
            <button role="menuitem" className="is-danger" onClick={() => { setOpen(false); onDelete() }}><Trash2 size={15} /> Yes, delete it</button>
          )}
          {!own && (
            <button role="menuitem" onClick={() => { setOpen(false); if (guard()) setReporting(true) }}><Flag size={15} /> Report</button>
          )}
          <button role="menuitem" onClick={() => { setOpen(false); navigator.clipboard?.writeText(window.location.origin + (reportTarget.path || '')) }}>
            <Link2 size={15} /> Copy link
          </button>
        </div>
      )}
      {reporting && <ReportDialog target={{ targetType: reportTarget.targetType, targetId: reportTarget.targetId }} onClose={() => setReporting(false)} />}
    </div>
  )
}
