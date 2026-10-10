import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import { FormError, GoogleButton, PasswordField, SubmitButton } from '../../components/auth/fields'
import { api } from '../../lib/api'
import { resumePath, useAuth } from '../../lib/auth'
import { useMeta } from '../../lib/meta'

// Members-only pages send visitors here; tell them what logging in will open
const REASONS = [
  ['/ai', 'Log in to use the AI Counsellor. It is free for members.'],
  ['/chat', 'Log in to join the live chatrooms.'],
  ['/ask', 'Log in to ask the community.'],
  ['/notifications', 'Log in to see your notifications.'],
  ['/mentors', 'Log in to book your session.'],
]

export default function Login() {
  const location = useLocation()
  // Mentors log in on their own page: no photo ID anywhere in it, and it leads back to their application
  const mentor = location.pathname === '/mentors/login'
  useMeta(mentor
    ? { title: 'Mentor log in', description: 'Log in to your TYM mentor account.', path: '/mentors/login' }
    : { title: 'Log in', description: 'Log in to The Youth Matters to ask questions, join the chat rooms and book mentors.', path: '/login' })
  const { account, signIn } = useAuth()
  const navigate = useNavigate()
  const from = location.state?.from || (mentor ? '/mentors/register' : '/')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (account) return <Navigate to={account.verification === 'verified' ? from : resumePath(account)} replace state={{ from }} />

  const submit = async (e) => {
    e.preventDefault()
    const { email, password } = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      signIn(await api('/auth/login', { method: 'POST', body: { email, password } }))
    } catch (err) {
      if (err.data?.error === 'email_unverified') {
        navigate(mentor ? '/mentors/signup' : '/register', { state: { from, confirm: { email: err.data.email, devCode: err.data.devCode } } })
        return
      }
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={mentor ? 'Mentor log in' : 'Welcome back'}
      subtitle={mentor
        ? 'Log in to your mentor account to follow your application, or to see your sessions once you are approved.'
        : REASONS.find(([p]) => from.startsWith(p))?.[1] || 'Log in to ask questions, join the chatrooms and book mentors.'}>
      {!mentor && (
        <p className="auth-switch auth-switch-top">Are you a mentor? <Link to="/mentors/login" className="link">Log in as a mentor</Link></p>
      )}
      <GoogleButton onSession={signIn} onError={setError} as={mentor ? 'mentor' : undefined} />
      <p className="google-note">
        {mentor
          ? <>New here? Google creates your mentor account and there is no code to type. By continuing you agree to the </>
          : <>New here? Google creates your account, then we ask for a photo ID to confirm you are 18 or over. By continuing you agree to the </>}
        <Link to="/terms" target="_blank" className="link">Terms</Link> and{' '}
        <Link to="/guidelines" target="_blank" className="link">Community Guidelines</Link>.
      </p>
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

      {mentor
        ? <p className="auth-switch">Not a mentor yet? <Link to="/mentors/signup" state={location.state} className="link">Apply to mentor</Link></p>
        : <p className="auth-switch">New to The Youth Matters? <Link to="/register" state={location.state} className="link">Create an account</Link></p>}
    </AuthLayout>
  )
}
