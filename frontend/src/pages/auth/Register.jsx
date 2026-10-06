import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import AuthLayout, { MemberQuote, Steps, WhyWeCheck } from '../../components/auth/AuthLayout'
import {
  DevCode, FormError, GoogleButton, OtpInput, PasswordField, PasswordMeter, SubmitButton, useCountdown,
} from '../../components/auth/fields'
import IdCheck from '../../components/auth/IdCheck'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// Sign-up (Module 1): account -> email code -> photo ID (date of birth read by OCR, 18+).
// The step comes from the account itself, so leaving halfway and logging in later resumes here.
const STEPS = ['Account', 'Email', 'Photo ID']

function AccountStep({ onSent, onSession }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const { name, email } = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    try {
      onSent(await api('/auth/register', { method: 'POST', body: { displayName: name, email, password } }))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <GoogleButton onSession={onSession} onError={setError} />
      <div className="divider"><span>or with email</span></div>
      <form className="stack auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="r-name">Full name</label>
          <input id="r-name" name="name" className="input" autoComplete="name" required minLength={2} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="r-email">Email</label>
          <input id="r-email" name="email" type="email" className="input" autoComplete="email" required />
        </div>
        <PasswordField id="r-pass" autoComplete="new-password" minLength={8} maxLength={72}
          value={password} onChange={(e) => setPassword(e.target.value)}>
          <PasswordMeter password={password} />
        </PasswordField>
        <label className="check">
          <input type="checkbox" required />
          <span>
            I am 18 or older and agree to the <Link to="/terms" target="_blank" className="link">Terms</Link> and{' '}
            <Link to="/guidelines" target="_blank" className="link">Community Guidelines</Link>.
          </span>
        </label>
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Sending code">Continue</SubmitButton>
      </form>
    </>
  )
}

function EmailStep({ sent, onBack, onSession }) {
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState(sent.devCode)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, restartWait] = useCountdown(30)

  // The sixth digit submits: no button to find
  useEffect(() => {
    if (code.length < 6) return
    setBusy(true)
    setError('')
    api('/auth/verify-email', { method: 'POST', body: { email: sent.email, code } })
      .then(onSession)
      .catch((e) => {
        setError(e.message)
        setCode('')
        setBusy(false)
      })
  }, [code])

  const resend = async () => {
    setError('')
    try {
      const r = await api('/auth/resend-code', { method: 'POST', body: { email: sent.email } })
      setDevCode(r.devCode)
      setNote('A new code is on its way. Use the newest one.')
      restartWait()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="stack auth-form">
      <div className="field">
        <label htmlFor="otp">6-digit code</label>
        <OtpInput id="otp" value={code} onChange={setCode} disabled={busy} invalid={!!error} />
      </div>
      <DevCode code={devCode} />
      <FormError>{error}</FormError>
      <SubmitButton busy={busy} busyText="Confirming" disabled={code.length < 6}>Confirm email</SubmitButton>
      <p className="resend" role="status">
        {note && <>{note} </>}
        {wait > 0
          ? <>Nothing yet? You can ask again in <span className="mono">0:{String(wait).padStart(2, '0')}</span></>
          : <>Nothing yet? Check spam, or <button className="btn-text" onClick={resend}>send a new code</button></>}
      </p>
      <p className="auth-switch">Wrong email? <button className="btn-text" onClick={onBack}>Change it</button></p>
    </div>
  )
}

function Finished({ account, from, logout }) {
  if (account.verification === 'verified') {
    return (
      <AuthLayout kicker="Verified" title={`You are in, ${account.displayName.split(' ')[0]}.`} aside={<MemberQuote />}
        subtitle="Ask your first question, say hello in a chatroom, or find a mentor who has already done it.">
        <div className="verify-actions">
          <Link to={from} className="btn btn-primary">
            Continue <span className="btn-arrow" aria-hidden><ArrowRight size={15} /></span>
          </Link>
          <Link to="/ask" className="btn btn-ghost">Ask a question</Link>
        </div>
      </AuthLayout>
    )
  }
  if (account.verification === 'review') {
    return (
      <AuthLayout kicker="Almost there" title="A person will take a quick look" aside={<WhyWeCheck />}
        subtitle={`Someone on our team is checking your details and will email ${account.email} within 24 hours.`}>
        <Link to="/" className="btn btn-primary btn-block">Back to home</Link>
        <p className="auth-switch"><button className="btn-text" onClick={logout}>Log out</button></p>
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title="We could not verify this account" aside={<WhyWeCheck />}
      subtitle="If you think this is a mistake, write to support@theyouthmatters.org and we will look again.">
      <Link to="/contact" className="btn btn-primary btn-block">Contact us</Link>
      <p className="auth-switch"><button className="btn-text" onClick={logout}>Log out</button></p>
    </AuthLayout>
  )
}

export default function Register() {
  const { account, signIn, setAccount, logout } = useAuth()
  const location = useLocation()
  const from = location.state?.from || '/'
  const [sent, setSent] = useState(location.state?.confirm || null) // { email, devCode } after the code is sent
  const [arrivedVerified] = useState(account?.verification === 'verified')

  if (arrivedVerified) return <Navigate to={from} replace />
  const step = !account ? (sent ? 1 : 0) : { document: 2 }[account.verification]
  if (step === undefined) return <Finished account={account} from={from} logout={logout} />

  const [title, subtitle] = [
    ['Create your account', 'Free for students. About two minutes from start to finish.'],
    ['Check your inbox', <>We sent a 6-digit code to <strong>{sent?.email}</strong>. It expires in 10 minutes.</>],
    ['Confirm you are 18 or over', 'Take a photo of an ID or upload one. We read the date of birth from it, so there is nothing to type.'],
  ][step]

  return (
    <AuthLayout title={title} subtitle={subtitle} aside={<WhyWeCheck />}>
      <Steps steps={STEPS} current={step} />
      {step === 0 && <AccountStep onSent={setSent} onSession={signIn} />}
      {step === 1 && <EmailStep sent={sent} onBack={() => setSent(null)} onSession={signIn} />}
      {step === 2 && <IdCheck onDone={setAccount} />}

      {step === 0 && (
        <p className="auth-switch">Already a member? <Link to="/login" state={location.state} className="link">Log in</Link></p>
      )}
      {step >= 2 && (
        <p className="auth-switch">
          Signed in as {account.email}. <button className="btn-text" onClick={() => { setSent(null); logout() }}>Log out</button>
        </p>
      )}
    </AuthLayout>
  )
}
