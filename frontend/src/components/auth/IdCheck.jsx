import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Camera, Lock, RotateCcw, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { fileToJpeg, useCamera } from './camera'
import { FormError, Spinner } from './fields'

const DOCUMENTS = [
  { value: 'passport', label: 'Passport', page: 'the photo page of your passport' },
  { value: 'driving_licence', label: 'Driving licence', page: 'the front of your driving licence' },
  { value: 'national_id', label: 'National ID', page: 'the front of your ID card (Aadhaar, PAN or similar)' },
]
const SOURCES = { mrz: 'the machine-readable lines', label: 'the date of birth field', date: 'the dates on the document' }

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

// Last step of sign-up: a photo of an ID. The server reads the date of birth (OCR); 18 or over
// verifies the account straight away. The photo is never stored.
export default function IdCheck({ onDone }) {
  const [docType, setDocType] = useState('passport')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const camera = useCamera('environment')
  const fileInput = useRef(null)
  const doc = DOCUMENTS.find((d) => d.value === docType)

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo])

  const use = (blob) => {
    setPhoto({ blob, url: URL.createObjectURL(blob) })
    setError('')
  }
  const snap = async () => {
    use(await camera.capture())
    camera.stop()
  }
  const pick = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      use(await fileToJpeg(file))
    } catch {
      setError('We could not open that file. Use a JPG or PNG photo.')
    }
  }
  const retake = () => {
    setPhoto(null)
    setResult(null)
    setError('')
  }
  const read = async () => {
    setBusy(true)
    setError('')
    const form = new FormData()
    form.append('documentType', docType)
    form.append('document', photo.blob, 'document.jpg')
    try {
      setResult(await api('/verify/document', { method: 'POST', body: form }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack verify">
      <fieldset className="segmented" disabled={busy || !!result}>
        <legend className="visually-hidden">Which document are you using?</legend>
        {DOCUMENTS.map((d) => (
          <label key={d.value}>
            <input type="radio" name="document" value={d.value} checked={docType === d.value}
              onChange={() => setDocType(d.value)} />
            <span>{d.label}</span>
          </label>
        ))}
      </fieldset>

      <div className={`id-stage${busy ? ' is-reading' : ''}${result ? ' is-read' : ''}`}>
        {photo ? (
          <img src={photo.url} alt={`Your ${doc.label.toLowerCase()}`} />
        ) : camera.stream ? (
          <>
            <video ref={camera.video} autoPlay playsInline muted />
            <span className="id-guide" aria-hidden><i /><i /><i /><i /></span>
          </>
        ) : (
          <div className="id-sketch" aria-hidden>
            <span className="id-sketch-photo" />
            <span className="id-sketch-lines"><i /><i /><i /><i /></span>
            {docType === 'passport' && <span className="id-sketch-mrz" />}
          </div>
        )}
        {busy && <span className="id-scan" aria-hidden />}
      </div>

      <p className="verify-caption" aria-live="polite">
        {busy ? 'Reading your date of birth. This takes a few seconds.'
          : camera.stream ? `Fit ${doc.page} inside the frame, flat and without glare.`
            : photo && !result ? 'Check the date of birth is sharp and readable, then continue.'
              : !result && `Use ${doc.page}. All four corners in view, in good light.`}
      </p>

      <FormError>{error || camera.error}</FormError>

      {result ? (
        <div className="verify-result" role="status">
          <span className="verify-result-label">Date of birth</span>
          <strong>{formatDate(result.dateOfBirth)}</strong>
          <span className="verify-result-note">Read from {SOURCES[result.source]} on your {doc.label.toLowerCase()}.</span>
          <div className="verify-actions">
            <button className="btn btn-primary" onClick={() => onDone(result.user)}>
              Continue <span className="btn-arrow" aria-hidden><ArrowRight size={15} /></span>
            </button>
            <button className="btn-text" onClick={retake}>Not right? Retake</button>
          </div>
        </div>
      ) : photo ? (
        <div className="verify-actions">
          <button className="btn btn-primary" onClick={read} disabled={busy}>
            {busy ? <><Spinner /> Reading</> : 'Read my date of birth'}
          </button>
          <button className="btn btn-ghost" onClick={retake} disabled={busy}><RotateCcw size={16} /> Retake</button>
        </div>
      ) : camera.stream ? (
        <div className="verify-actions">
          <button className="btn btn-primary" onClick={snap}><Camera size={16} /> Take photo</button>
          <button className="btn-text" onClick={camera.stop}>Cancel</button>
        </div>
      ) : (
        <div className="verify-actions">
          <button className="btn btn-primary" onClick={camera.start}><Camera size={16} /> Use camera</button>
          <button className="btn btn-ghost" onClick={() => fileInput.current.click()}><Upload size={16} /> Upload a photo</button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={pick} />
        </div>
      )}

      <p className="verify-privacy"><Lock size={14} aria-hidden /> We read the date and discard the photo. Your ID is never stored.</p>
    </div>
  )
}
