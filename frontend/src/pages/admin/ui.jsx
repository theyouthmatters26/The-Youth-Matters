import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react'
import { Spinner } from '../../components/auth/fields'
import Avatar from '../../components/ui/Avatar'
import { timeAgo } from '../../lib/format'

// Small pieces every admin screen is built from.

export const ago = (iso) => (iso ? (timeAgo(iso) === 'just now' ? 'just now' : `${timeAgo(iso)} ago`) : 'never')
export const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function PageHead({ eyebrow, title, text, children }) {
  return (
    <header className="adm-head">
      <div>
        {eyebrow && <p className="adm-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {text && <p className="adm-lede">{text}</p>}
      </div>
      {children && <div className="adm-head-actions">{children}</div>}
    </header>
  )
}

// items: [key, label, count?]
export function Tabs({ value, onChange, items, label }) {
  return (
    <div className="adm-tabs" role="tablist" aria-label={label}>
      {items.map(([key, text, count]) => (
        <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}>
          {text}{count > 0 && <span className="adm-count">{count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Pill({ tone = 'line', children }) {
  return <span className={`adm-pill is-${tone}`}>{children}</span>
}

const STATUS = { active: ['Verified', 'line'], pending: ['Not verified', 'muted'], suspended: ['Suspended', 'warn'], banned: ['Banned', 'warn'], closed: ['Deleted by the member', 'muted'] }
export function StatusPill({ status }) {
  const [label, tone] = STATUS[status] || [status, 'muted']
  return <Pill tone={tone}>{label}</Pill>
}

export function Person({ user, sub, size = 36 }) {
  return (
    <span className="adm-person">
      <Avatar user={user} size={size} />
      <span><strong>{user.displayName}</strong>{sub && <span>{sub}</span>}</span>
    </span>
  )
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="adm-search">
      <Search size={16} aria-hidden />
      <span className="visually-hidden">{placeholder}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search"><X size={14} /></button>}
    </label>
  )
}

// The value, a moment after typing stops: one request per pause, not per key
export function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

// A password that is easy to read out, from characters that are not mistaken for each other
export const newPassword = () => {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const picks = crypto.getRandomValues(new Uint32Array(14))
  return [...picks].map((n) => letters[n % letters.length]).join('')
}

// A password the team sets for someone else: shown as text, with a button that makes a strong one
export function PasswordBox({ id, label, hint, value, onChange, required }) {
  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor={id}>{label}{!required && <span className="faint"> Optional</span>}</label>
        <button type="button" className="btn-text adm-regen" onClick={() => onChange(newPassword())}><RefreshCw size={13} /> Make one</button>
      </div>
      <input id={id} className="input mono" value={value} onChange={(e) => onChange(e.target.value)} required={required} minLength={8} maxLength={72} autoComplete="off" />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

// A panel that slides in from the right for one person or one item. Escape or the backdrop closes it.
export function Sheet({ title, onClose, wide, children }) {
  const panel = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  // Once, on opening: a parent re-rendering must not pull focus out of a field being typed in
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && close.current()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [])
  return (
    <div className="adm-sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`adm-sheet${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <header>
          <h2>{title}</h2>
          <button className="adm-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="adm-sheet-body">{children}</div>
      </aside>
    </div>
  )
}

export function Empty({ title, text, children }) {
  return (
    <div className="adm-empty">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function Loading({ what = '' }) {
  return <p className="adm-loading" role="status"><Spinner /> Loading {what}</p>
}

export function Pager({ page, hasMore, onPage }) {
  if (page === 1 && !hasMore) return null
  return (
    <nav className="adm-pager" aria-label="Pages">
      <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /> Newer</button>
      <span className="mono">Page {page}</span>
      <button className="btn btn-ghost btn-sm" disabled={!hasMore} onClick={() => onPage(page + 1)}>Older <ChevronRight size={15} /></button>
    </nav>
  )
}

// A button that asks once before doing something that is hard to undo
export function Confirm({ label, question = 'Are you sure?', yes = 'Yes', danger, onConfirm, disabled, className = 'btn btn-ghost btn-sm' }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!asking) {
    const button = <button type="button" className={`${className}${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={() => { setError(''); setAsking(true) }}>{label}</button>
    // What went wrong last time stays beside the button until it is tried again
    return error ? <span className="adm-confirm">{button}<span role="alert" className="is-danger">{error}</span></span> : button
  }
  const run = async () => {
    setBusy(true)
    try { await onConfirm() } catch (err) { setError(err?.message || 'That did not work. Try again.') } finally { setBusy(false); setAsking(false) }
  }
  return (
    <span className="adm-confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <button type="button" className={`btn btn-primary btn-sm${danger ? ' is-danger' : ''}`} onClick={run} disabled={busy}>{busy ? <Spinner /> : yes}</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)} disabled={busy}>Cancel</button>
    </span>
  )
}

// Label and value pairs, for the details of a person or an application
export function Facts({ items }) {
  return (
    <dl className="adm-facts">
      {items.filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== false).map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  )
}
