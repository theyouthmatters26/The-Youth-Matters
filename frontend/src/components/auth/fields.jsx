import { useEffect, useState } from 'react'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { api } from '../../lib/api'

export function FormError({ children }) {
  if (!children) return null
  return <p role="alert" className="form-error"><AlertCircle size={16} aria-hidden /> {children}</p>
}

export function Spinner() {
  return <span className="spinner" aria-hidden />
}

export function SubmitButton({ busy, busyText, disabled, children, ...rest }) {
  return (
    <button className="btn btn-primary btn-block" disabled={busy || disabled} {...rest}>
      {busy ? <><Spinner /> {busyText}</> : children}
    </button>
  )
}

export function PasswordField({ id, label = 'Password', aside, children, ...input }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="input-wrap">
        <input id={id} name="password" type={shown ? 'text' : 'password'} className="input" required {...input} />
        <button type="button" className="input-icon" onClick={() => setShown(!shown)}
          aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {children}
    </div>
  )
}

const STRENGTH = ['Too short', 'Fair', 'Good', 'Strong', 'Very strong']

export function passwordScore(p) {
  if (p.length < 8) return 0
  return 1 + (p.length >= 12) + (/[a-z]/i.test(p) && /\d/.test(p)) + (/[^a-z0-9]/i.test(p) || /[a-z]/.test(p) && /[A-Z]/.test(p))
}

export function PasswordMeter({ password }) {
  const score = passwordScore(password)
  return (
    <div className="meter" aria-live="polite">
      <span className="meter-bars" data-score={password ? score : 0} aria-hidden><i /><i /><i /><i /></span>
      <span>{password ? STRENGTH[score] : 'At least 8 characters'}</span>
    </div>
  )
}

// One real input stretched over six boxes: paste, SMS autofill and backspace all just work.
export function OtpInput({ value, onChange, id, disabled, invalid }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className={`otp${invalid ? ' is-invalid' : ''}`}>
      <input id={id} value={value} disabled={disabled} autoFocus inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} aria-label="6-digit code" aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} aria-hidden className={focused && i === Math.min(value.length, 5) ? 'is-active' : undefined}>
          {value[i]}
        </span>
      ))}
    </div>
  )
}

// Shown only on a development machine without an email provider: the API hands the code back.
export function DevCode({ code }) {
  if (!code) return null
  return <p className="dev-note">Email is not set up on this computer, so here is your code: <b className="mono">{code}</b></p>
}

export function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return [left, () => setLeft(seconds)]
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function loadGoogle() {
  if (window.google?.accounts || document.getElementById('gsi')) return
  const s = document.createElement('script')
  s.id = 'gsi'
  s.src = 'https://accounts.google.com/gsi/client'
  s.async = true
  document.head.appendChild(s)
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.87 2.68-6.62z" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

// `as` is "mentor" on the mentor sign-up and log-in pages: a new account made there is a mentor
// account, which shows no photo ID and waits for our team instead (api/auth.py).
export function GoogleButton({ onSession, onError, as }) {
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (GOOGLE_CLIENT_ID) loadGoogle() }, [])

  const click = () => {
    onError('')
    if (!window.google?.accounts) return onError('Google sign-in is still loading. Try again in a moment.')
    // Opened straight from the click so the browser does not block the Google window
    window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (r) => {
        if (r.error) return onError('Google sign-in was cancelled.')
        setBusy(true)
        try {
          onSession(await api('/auth/google', { method: 'POST', body: { accessToken: r.access_token, as } }))
        } catch (e) {
          onError(e.message)
        } finally {
          setBusy(false)
        }
      },
      error_callback: () => onError('Google sign-in was cancelled.'),
    }).requestAccessToken()
  }

  if (!GOOGLE_CLIENT_ID) return null // not switched on: the page offers email only, with no dead button
  return (
    <button type="button" className="btn btn-ghost btn-block auth-google" onClick={click} disabled={busy}>
      {busy ? <Spinner /> : <GoogleMark />} Continue with Google
    </button>
  )
}
