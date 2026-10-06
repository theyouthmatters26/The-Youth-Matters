import { useEffect, useRef, useState } from 'react'
import { Camera, Lock } from 'lucide-react'
import { api } from '../../lib/api'
import { useCamera } from './camera'
import { FormError, Spinner } from './fields'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TURN_MS = 1800

const PROMPTS = {
  off: 'Your camera turns on only for this check.',
  ready: 'Centre your face in the oval, in good light. No cap or sunglasses.',
  straight: 'Look straight at the camera',
  turn: 'Now turn your head slowly to one side',
  checking: 'Matching your selfie to your ID',
}

// Step 4 of sign-up: two frames, looking straight then turned. The server matches the face to
// the ID photo and checks the head really moved, which a photo held up to the camera cannot do.
export default function SelfieCheck({ onDone }) {
  const camera = useCamera('user')
  const [phase, setPhase] = useState('off')
  const [count, setCount] = useState(3)
  const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const begin = async () => {
    await camera.start()
    setPhase('ready')
  }

  const run = async () => {
    setError('')
    setPhase('straight')
    for (const n of [3, 2, 1]) {
      setCount(n)
      await sleep(800)
    }
    if (!alive.current) return
    const straight = await camera.capture()
    setPhase('turn')
    await sleep(TURN_MS)
    if (!alive.current) return
    const turned = await camera.capture()
    setPhase('checking')

    const form = new FormData()
    form.append('straight', straight, 'straight.jpg')
    form.append('turned', turned, 'turned.jpg')
    try {
      const { user } = await api('/verify/selfie', { method: 'POST', body: form })
      camera.stop()
      onDone(user)
    } catch (e) {
      if (!alive.current) return
      setError(e.message)
      setPhase('ready')
    }
  }

  const live = phase !== 'off' && camera.stream
  return (
    <div className="stack verify">
      <div className={`selfie-stage is-${phase}`}>
        {live ? <video ref={camera.video} autoPlay playsInline muted /> : <Camera size={36} aria-hidden />}
        <svg className="selfie-ring" viewBox="0 0 100 100" aria-hidden>
          <circle className="track" cx="50" cy="50" r="48.5" pathLength="100" />
          <circle className="progress" cx="50" cy="50" r="48.5" pathLength="100" />
        </svg>
        {phase === 'straight' && <span className="selfie-count" aria-hidden key={count}>{count}</span>}
        {phase === 'checking' && <span className="selfie-wait" aria-hidden><Spinner /></span>}
      </div>

      <p className={`selfie-prompt${phase === 'straight' || phase === 'turn' ? ' is-strong' : ''}`} aria-live="assertive">
        {PROMPTS[phase === 'ready' && !camera.stream ? 'off' : phase]}
      </p>

      <FormError>{error || camera.error}</FormError>

      {phase === 'off' || !camera.stream ? (
        <button className="btn btn-primary btn-block" onClick={begin}><Camera size={16} /> Turn on camera</button>
      ) : phase === 'ready' ? (
        <button className="btn btn-primary btn-block" onClick={run}>{error ? 'Try again' : 'Start the check'}</button>
      ) : (
        <button className="btn btn-primary btn-block" disabled>
          {phase === 'checking' ? <><Spinner /> Checking</> : 'Hold on'}
        </button>
      )}

      <p className="verify-privacy"><Lock size={14} aria-hidden /> Your selfie is only kept if a person needs to review it.</p>
    </div>
  )
}
