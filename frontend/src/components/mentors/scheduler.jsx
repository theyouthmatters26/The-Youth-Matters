/* What a mentor uses to describe when they are free, and what they help with.

   Shared by the application form and the mentor's own profile page: the two must offer exactly the
   same controls, or a mentor would be able to set something on one that the other cannot show. */
import { Fragment, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']]
export const HOURS = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`) // 06:00 to 22:00
export const PRESETS = [
  ['Weekday evenings', ['mon', 'tue', 'wed', 'thu', 'fri'], ['18:00', '19:00', '20:00']],
  ['Weekend mornings', ['sat', 'sun'], ['09:00', '10:00', '11:00']],
]
export const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu']
export const myZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
export const ZONES = (() => { try { return Intl.supportedValuesOf('timeZone') } catch { return [myZone()] } })()
// Every suggested area, with room for a few of their own. The mentor decides how many fit them;
// the ceiling is only here so the field cannot be used to paste an essay.
export const TOPIC_MAX = 20
export const slotCount = (hours) => Object.values(hours).reduce((n, t) => n + t.length, 0)

export function TagInput({ id, value, onChange, suggestions, max, placeholder }) {
  const [text, setText] = useState('')
  const add = (t) => {
    const v = t.trim().replace(/,$/, '')
    if (v && !value.includes(v) && value.length < max) onChange([...value, v])
    setText('')
  }
  return (
    <div className="tag-input">
      <div className="tag-box">
        {value.map((t) => (
          <span key={t} className="tag">{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} /></button>
          </span>
        ))}
        {value.length < max && (
          <input id={id} value={text} maxLength={60} placeholder={value.length ? 'Add another' : placeholder}
            onChange={(e) => setText(e.target.value)} onBlur={() => text && add(text)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) }
              if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
            }} />
        )}
      </div>
      <div className="tag-suggest">
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <button key={s} type="button" className="chip" onClick={() => add(s)} disabled={value.length >= max}>+ {s}</button>
        ))}
      </div>
    </div>
  )
}

// Most mentors work the same hours on several days, and painting 119 cells for that is a chore.
// This adds a whole range to every day ticked, in one go. The grid below is still there for the
// odd hour that does not fit the pattern.
function AddRange({ update }) {
  const [days, setDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri'])
  const [from, setFrom] = useState('18:00')
  const [to, setTo] = useState('21:00')
  // HH:MM is zero padded, so comparing the strings compares the times
  const picked = HOURS.filter((h) => h >= from && h <= to)

  const add = () => {
    if (!days.length || !picked.length) return
    update((prev) => {
      const next = { ...prev }
      days.forEach((d) => { next[d] = [...new Set([...(next[d] || []), ...picked])].sort() })
      return next
    })
  }

  return (
    <div className="week-add">
      <div className="week-add-days" role="group" aria-label="Days to add">
        {DAYS.map(([d, label]) => (
          <button key={d} type="button" className={`chip${days.includes(d) ? ' is-on' : ''}`}
            aria-pressed={days.includes(d)}
            onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>{label}</button>
        ))}
      </div>
      <div className="week-add-when">
        <label htmlFor="wk-from" className="visually-hidden">From</label>
        <select id="wk-from" className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
          {HOURS.map((h) => <option key={h}>{h}</option>)}
        </select>
        <span className="faint">to</span>
        <label htmlFor="wk-to" className="visually-hidden">To</label>
        <select id="wk-to" className="select" value={to} onChange={(e) => setTo(e.target.value)}>
          {HOURS.map((h) => <option key={h}>{h}</option>)}
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={add}
          disabled={!days.length || !picked.length}>
          Add {picked.length ? `${picked.length * days.length} ${picked.length * days.length === 1 ? 'time' : 'times'}` : 'times'}
        </button>
      </div>
    </div>
  )
}

// Weekly start times, like a timetable. Click, or press and drag across cells, to paint them.
export function WeekGrid({ value, update }) {
  const paint = useRef(null)
  useEffect(() => {
    const stop = () => { paint.current = null }
    window.addEventListener('pointerup', stop)
    return () => window.removeEventListener('pointerup', stop)
  }, [])
  const has = (d, h) => Boolean(value[d]?.includes(h))
  const set = (d, h, on) => update((prev) => {
    const day = new Set(prev[d] || [])
    if (on) day.add(h); else day.delete(h)
    return { ...prev, [d]: [...day].sort() }
  })
  const preset = (days, hours) => update((prev) => {
    const next = { ...prev }
    days.forEach((d) => { next[d] = [...new Set([...(next[d] || []), ...hours])].sort() })
    return next
  })
  const total = slotCount(value)

  return (
    <div className="week">
      <AddRange update={update} />
      <div className="week-tools">
        {PRESETS.map(([label, days, hours]) => <button key={label} type="button" className="chip" onClick={() => preset(days, hours)}>+ {label}</button>)}
        {total > 0 && <button type="button" className="btn-text" onClick={() => update(() => ({}))}>Clear</button>}
        <span className="week-count"><strong className="mono">{total}</strong> {total === 1 ? 'time' : 'times'} a week</span>
      </div>
      <div className="week-grid" role="group" aria-label="Weekly session start times">
        <span />
        {DAYS.map(([d, label]) => <span key={d} className="week-day">{label}</span>)}
        {HOURS.map((h) => (
          <Fragment key={h}>
            <span className="week-hour mono">{h}</span>
            {DAYS.map(([d, label]) => (
              <button key={d} type="button" className="week-cell" aria-pressed={has(d, h)} aria-label={`${label} ${h}`}
                onPointerDown={(e) => { if (e.pointerType === 'mouse') { paint.current = !has(d, h); set(d, h, paint.current) } }}
                onPointerEnter={(e) => { if (paint.current !== null && e.buttons === 1) set(d, h, paint.current) }}
                onClick={(e) => { if (e.detail === 0 || e.nativeEvent.pointerType !== 'mouse') set(d, h, !has(d, h)) }} />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// The client's questions (data/mentorForm.js). Answers live together in form.details.
