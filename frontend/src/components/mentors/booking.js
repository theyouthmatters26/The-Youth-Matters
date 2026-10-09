// Small helpers for the booking flow: dates in the viewer's own time zone, Razorpay Checkout,
// and a calendar file so the session lands in Google Calendar, Apple Calendar or Outlook.

export const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone

export const zoneName = (timeZone = viewerZone) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'long' }).formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value || timeZone

export const city = (timeZone) => timeZone.split('/').pop().replace(/_/g, ' ')

// YYYY-MM-DD of an instant in the viewer's zone, used to group slots by day
export const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA')

export const formatTime = (iso, timeZone) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
    .replace(' ', ' ')

export const formatDay = (iso, opts = {}) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...opts })

// Counselling time, as people say it: 30 -> "30 minutes", 60 -> "1 hour", 90 -> "1.5 hours"
export const hoursText = (minutes) => {
  if (minutes < 60) return `${minutes} minutes`
  const hours = +(minutes / 60).toFixed(2)
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = resolve
    s.onerror = () => reject(new Error('The payment window could not load. Check your connection and try again.'))
    document.head.appendChild(s)
  })
}

const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function downloadIcs(booking) {
  const who = booking.mentor.user.displayName
  const text = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Youth Matters//Sessions//EN', 'BEGIN:VEVENT',
    `UID:tym-booking-${booking.id}@theyouthmatters.com`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(booking.startsAt)}`, `DTEND:${icsDate(booking.endsAt)}`,
    `SUMMARY:TYM session with ${who}`, `DESCRIPTION:Join the call: ${booking.meetingUrl}`,
    `URL:${booking.meetingUrl}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }))
  Object.assign(document.createElement('a'), { href: url, download: 'tym-session.ics' }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
