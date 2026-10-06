import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import { FormError, GoogleButton, PasswordField, SubmitButton } from '../../components/auth/fields'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Members-only pages send visitors here; tell them what logging in will open
const REASONS = [
  ['/ai', 'Log in to use the AI Counsellor. It is free for members.'],
  ['/chat', 'Log in to join the live chatrooms.'],
  ['/ask', 'Log in to ask the community.'],
  ['/notifications', 'Log in to see your notifications.'],
  ['/mentors', 'Log in to book your session.'],
]

export default function Login() {
  const { account, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (account) return <Navigate to={account.verification === 'verified' ? from : '/register'} replace state={{ from }} />

  const submit = async (e) => {
    e.preventDefault()
    const { email, password } = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      signIn(await api('/auth/login', { method: 'POST', body: { email, password } }))
    } catch (err) {
      if (err.data?.error === 'email_unverified') {
        navigate('/register', { state: { from, confirm: { email: err.data.email, devCode: err.data.devCode } } })
        return
      }
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle={REASONS.find(([p]) => from.startsWith(p))?.[1] || 'Log in to ask questions, join the chatrooms and book mentors.'}>
      <GoogleButton onSession={signIn} onError={setError} />
      <div className="divider"><span>or with email</span></div>

      <form className="stack auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required autoFocus />
        </div>
        <PasswordField id="password" autoComplete="current-password"
          aside={<Link to="/forgot-password" className="field-link">Forgot password?</Link>} />
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Logging in">Log in</SubmitButton>
      </form>

      <p className="auth-switch">New to The Youth Matters? <Link to="/register" state={location.state} className="link">Create an account</Link></p>
    </AuthLayout>
  )
}
