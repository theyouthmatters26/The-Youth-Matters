import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import { DevCode, FormError, OtpInput, PasswordField, PasswordMeter, SubmitButton } from '../../components/auth/fields'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function ForgotPassword() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [sent, setSent] = useState(null) // { email, devCode }
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const call = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const sendCode = (e) => {
    e.preventDefault()
    const email = new FormData(e.currentTarget).get('email')
    call(async () => setSent(await api('/auth/forgot-password', { method: 'POST', body: { email } })))
  }
  const reset = (e) => {
    e.preventDefault()
    call(async () => {
      const session = await api('/auth/reset-password', { method: 'POST', body: { email: sent.email, code, password } })
      signIn(session)
      navigate(session.user.verification === 'verified' ? '/' : '/register', { replace: true })
    })
  }

  if (!sent) {
    return (
      <AuthLayout title="Reset your password" subtitle="Enter the email you signed up with and we will send you a 6-digit code.">
        <form className="stack auth-form" onSubmit={sendCode}>
          <div className="field">
            <label htmlFor="f-email">Email</label>
            <input id="f-email" name="email" type="email" className="input" autoComplete="email" required autoFocus />
          </div>
          <FormError>{error}</FormError>
          <SubmitButton busy={busy} busyText="Sending">Send code</SubmitButton>
        </form>
        <p className="auth-switch"><Link to="/login" className="link">Back to log in</Link></p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" subtitle={`If ${sent.email} has an account, a code is on its way. It expires in 10 minutes.`}>
      <form className="stack auth-form" onSubmit={reset}>
        <div className="field">
          <label htmlFor="f-code">6-digit code</label>
          <OtpInput id="f-code" value={code} onChange={setCode} />
        </div>
        <DevCode code={sent.devCode} />
        <PasswordField id="f-pass" label="New password" autoComplete="new-password" minLength={8} maxLength={72}
          value={password} onChange={(e) => setPassword(e.target.value)}>
          <PasswordMeter password={password} />
        </PasswordField>
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Saving" disabled={code.length < 6 || password.length < 8}>Save and log in</SubmitButton>
      </form>
      <p className="auth-switch"><button className="btn-text" onClick={() => { setSent(null); setCode('') }}>Use a different email</button></p>
    </AuthLayout>
  )
}
