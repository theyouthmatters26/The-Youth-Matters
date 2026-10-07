import { useState } from 'react'
import { DevCode, FormError, OtpInput, PasswordField, PasswordMeter, SubmitButton } from '../../components/auth/fields'
import { adminApi, useAdmin } from '../../lib/admin'
import Photo from '../../components/ui/Photo'

// The team's way in. Members sign in on the site; this page only accepts admin accounts.
// A forgotten password is reset with a code sent to the admin's email, then they are signed straight in.
export default function AdminLogin() {
  const { signIn } = useAdmin()
  const [step, setStep] = useState('signin') // signin | forgot | reset
  const [sent, setSent] = useState(null) // { email, devCode }
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = (to) => { setStep(to); setError(''); setCode(''); setPassword('') }
  const run = (fn) => async (e) => {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      await fn(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const enter = (email, pass) => adminApi('/admin/login', { method: 'POST', body: { email, password: pass } }).then(signIn)

  const submit = run((f) => enter(f.email, f.password))
  const sendCode = run(async (f) => {
    setSent(await adminApi('/auth/forgot-password', { method: 'POST', body: { email: f.email } }))
    go('reset')
  })
  const reset = run(async () => {
    await adminApi('/auth/reset-password', { method: 'POST', body: { email: sent.email, code, password } })
    await enter(sent.email, password)
  })

  return (
    <div className="adm-login">
      <div className="adm-login-side" aria-hidden>
        <Photo src="/images/slide-london.jpg" sizes="55vw" priority />
        <p>Every question before they go, answered by someone who went.</p>
      </div>
      <main className="adm-login-main">
        {step === 'signin' && (
          <form className="adm-login-form stack" onSubmit={submit}>
            <div className="adm-brand"><Photo src="/logo.png" sizes="36px" loading="eager" /><span>The Youth Matters<small>Admin</small></span></div>
            <div>
              <h1>Sign in</h1>
              <p className="muted">For the TYM team.</p>
            </div>
            <div className="field">
              <label htmlFor="adm-email">Email</label>
              <input id="adm-email" name="email" type="email" className="input" autoComplete="username" required autoFocus />
            </div>
            <PasswordField id="adm-password" autoComplete="current-password"
              aside={<button type="button" className="field-link" onClick={() => go('forgot')}>Forgot password?</button>} />
            <FormError>{error}</FormError>
            <SubmitButton busy={busy} busyText="Signing in">Sign in</SubmitButton>
            <p className="adm-login-note">Looking for the community? <a href="/login" className="link">Members sign in here</a>.</p>
          </form>
        )}

        {step === 'forgot' && (
          <form className="adm-login-form stack" onSubmit={sendCode}>
            <div className="adm-brand"><Photo src="/logo.png" sizes="36px" loading="eager" /><span>The Youth Matters<small>Admin</small></span></div>
            <div>
              <h1>Reset your password</h1>
              <p className="muted">Enter the email you sign in with and we will send it a 6-digit code.</p>
            </div>
            <div className="field">
              <label htmlFor="adm-forgot">Email</label>
              <input id="adm-forgot" name="email" type="email" className="input" autoComplete="username" required autoFocus />
            </div>
            <FormError>{error}</FormError>
            <SubmitButton busy={busy} busyText="Sending">Send code</SubmitButton>
            <p className="adm-login-note"><button type="button" className="btn-text" onClick={() => go('signin')}>Back to sign in</button></p>
          </form>
        )}

        {step === 'reset' && (
          <form className="adm-login-form stack" onSubmit={reset}>
            <div className="adm-brand"><Photo src="/logo.png" sizes="36px" loading="eager" /><span>The Youth Matters<small>Admin</small></span></div>
            <div>
              <h1>Choose a new password</h1>
              <p className="muted">If {sent.email} is on the team, a code is on its way. It expires in 10 minutes.</p>
            </div>
            <div className="field">
              <label htmlFor="adm-code">6-digit code</label>
              <OtpInput id="adm-code" value={code} onChange={setCode} />
            </div>
            <DevCode code={sent.devCode} />
            <PasswordField id="adm-new" label="New password" autoComplete="new-password" minLength={8} maxLength={72}
              value={password} onChange={(e) => setPassword(e.target.value)}>
              <PasswordMeter password={password} />
            </PasswordField>
            <FormError>{error}</FormError>
            <SubmitButton busy={busy} busyText="Saving" disabled={code.length < 6 || password.length < 8}>Save and sign in</SubmitButton>
            <p className="adm-login-note"><button type="button" className="btn-text" onClick={() => go('signin')}>Back to sign in</button></p>
          </form>
        )}
      </main>
    </div>
  )
}
