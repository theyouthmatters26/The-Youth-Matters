import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Check, ImagePlus, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { FormError, Spinner, SubmitButton } from '../components/auth/fields'
import { countries } from '../data/sample'
import { api, useApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useMeta } from '../lib/meta'
import '../components/auth/auth.css'

const LEVELS = [['', 'Choose one'], ['foundation', 'Foundation'], ['undergraduate', 'Undergraduate'], ['postgraduate', 'Postgraduate'], ['phd', 'PhD'], ['other', 'Other']]

// Picture upload with instant preview; the server checks, resizes and strips location data
export function PictureField({ kind, current, onChange }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const upload = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const form = new FormData()
    form.append('image', file)
    setBusy(true)
    setError('')
    try {
      onChange(await api(`/users/me/${kind}`, { method: 'POST', body: form }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try { onChange(await api(`/users/me/${kind}`, { method: 'DELETE' })) } finally { setBusy(false) }
  }
  return (
    <div className="picture-field">
      <div className="picture-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current.click()} disabled={busy}>
          {busy ? <Spinner /> : kind === 'avatar' ? <Camera size={15} /> : <ImagePlus size={15} />}
          {current ? 'Change' : 'Upload'} {kind === 'avatar' ? 'photo' : 'cover'}
        </button>
        {current && <button type="button" className="btn-text" onClick={remove} disabled={busy}><Trash2 size={14} /> Remove</button>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
      <FormError>{error}</FormError>
    </div>
  )
}

export default function Settings() {
  useMeta({ title: 'Your profile settings', path: '/settings' })
  const { account, setAccount, logout } = useAuth()
  const navigate = useNavigate()
  const { data } = useApi(`/users/${account.username}`)
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!data) return
    setProfile(data)
    setForm({
      displayName: data.displayName, bio: data.bio || '', targetCountry: data.targetCountry?.slug || '',
      studyLevel: data.studyLevel || '', university: data.university || '', course: data.course || '', intake: data.intake || '',
    })
  }, [data])

  if (!form) return <div className="container page post-loading"><Spinner /> Loading your profile</div>

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setSaved(false) }
  const applied = (res) => { setAccount(res.me); setProfile(res.profile) }
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      applied(await api('/users/me', { method: 'PATCH', body: form }))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page settings">
      <header className="page-head">
        <h1>Your profile</h1>
        <p>This is what other students see when you ask or answer. A few details about where you are going get you better answers.</p>
      </header>

      <section className="card settings-pictures" aria-label="Photos">
        <div className="settings-cover">{profile.cover && <img src={profile.cover} alt="Your cover" />}</div>
        <div className="settings-pictures-row">
          <div className="settings-avatar"><Avatar user={profile} size={104} /></div>
          <div className="settings-pictures-text">
            <strong>Profile photo and cover</strong>
            <p className="muted">A clear photo of your face helps people trust your answers. JPG, PNG or WebP, up to 6 MB.</p>
            <div className="settings-pictures-buttons">
              <PictureField kind="avatar" current={profile.avatar} onChange={applied} />
              <PictureField kind="cover" current={profile.cover} onChange={applied} />
            </div>
          </div>
        </div>
      </section>

      <form className="card card-pad stack settings-form" onSubmit={save}>
        <h2 className="section-title">About you</h2>
        <div className="grid-2">
          <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" className="input" value={form.displayName} onChange={set('displayName')} maxLength={80} required /></div>
          <div className="field">
            <label htmlFor="s-country">Heading to</label>
            <select id="s-country" className="select" value={form.targetCountry} onChange={set('targetCountry')}>
              <option value="">Not decided yet</option>
              {countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <div className="field-row"><label htmlFor="s-bio">Bio</label><span className="hint">{300 - form.bio.length} left</span></div>
          <textarea id="s-bio" className="textarea" rows={3} maxLength={300} value={form.bio} onChange={set('bio')}
            placeholder="For example: MSc Marketing offer from Leeds, sorting out my visa file." />
        </div>
        <div className="grid-2">
          <div className="field"><label htmlFor="s-uni">University</label><input id="s-uni" className="input" value={form.university} onChange={set('university')} maxLength={120} placeholder="University of Leeds" /></div>
          <div className="field"><label htmlFor="s-course">Course</label><input id="s-course" className="input" value={form.course} onChange={set('course')} maxLength={120} placeholder="MSc Marketing" /></div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="s-level">Study level</label>
            <select id="s-level" className="select" value={form.studyLevel} onChange={set('studyLevel')}>
              {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="s-intake">Intake</label><input id="s-intake" className="input" value={form.intake} onChange={set('intake')} maxLength={40} placeholder="September 2026" /></div>
        </div>
        <FormError>{error}</FormError>
        <div className="settings-save">
          {saved && <span className="saved-note" role="status"><Check size={15} /> Saved</span>}
          <Link to={`/u/${account.username}`} className="btn btn-ghost btn-sm">View profile</Link>
          <SubmitButton busy={busy} busyText="Saving" style={{ width: 'auto' }}>Save changes</SubmitButton>
        </div>
      </form>

      <section className="card card-pad stack" aria-labelledby="account-title">
        <h2 id="account-title" className="section-title">Account</h2>
        <dl className="settings-account">
          <div><dt>Email</dt><dd>{account.email}</dd></div>
          <div><dt>Username</dt><dd>@{account.username}</dd></div>
          <div><dt>Age check</dt><dd><ShieldCheck size={15} /> Verified 18+ from your photo ID</dd></div>
        </dl>
        <div className="settings-account-actions">
          <Link to="/forgot-password" className="btn btn-ghost btn-sm">Change password</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/') }}><LogOut size={14} /> Log out</button>
        </div>
      </section>
    </div>
  )
}
