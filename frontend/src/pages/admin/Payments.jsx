import { useState } from 'react'
import { Download } from 'lucide-react'
import { FormError, SubmitButton } from '../../components/auth/fields'
import { hoursText } from '../../components/mentors/booking'
import { adminApi, downloadAdminFile, useAdminApi } from '../../lib/admin'
import { formatMoney, plural } from '../../lib/format'
import { Confirm, Empty, Facts, Loading, PageHead, Pager, Person, Pill, Sheet, Tabs, ago, day } from './ui'

const BOOKING = {
  confirmed: ['Confirmed', 'line'], completed: ['Completed', 'muted'], cancelled: ['Cancelled', 'warn'],
  pending_payment: ['Paying', 'muted'], expired: ['Expired', 'muted'],
}
const PAYMENT = { paid: ['Paid', 'line'], refunded: ['Refunded', 'warn'], created: ['Not paid', 'muted'], failed: ['Failed', 'warn'] }
const when = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const pill = (map, key) => { const [label, tone] = map[key] || [key, 'muted']; return <Pill tone={tone}>{label}</Pill> }

// Cancelling for someone: the reason goes to both people, and the session's time can go back to the student
function CancelSession({ booking, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const short = reason.trim().length < 5
  const cancel = async (refund) => {
    setError('')
    try {
      onDone(await adminApi(`/admin/bookings/${booking.id}/cancel`, { method: 'POST', body: { refund, reason } }))
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <section className="adm-actions">
      <h3 className="adm-h2">Cancel this session</h3>
      <div className="adm-action">
        <label htmlFor="cancel-reason"><strong>Reason.</strong> The student and the mentor both see it.</label>
        <input id="cancel-reason" className="input" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="For example: the mentor is unwell this week" />
        <div className="adm-action-row">
          <Confirm label={`Cancel and give ${hoursText(booking.minutes)} back`} question="Cancel and return the time to the student?" danger disabled={short} onConfirm={() => cancel(true)} />
          <Confirm label="Cancel and keep the hours" question="Cancel without returning the time?" danger disabled={short} onConfirm={() => cancel(false)} />
        </div>
        <p className="adm-hint">Giving the time back adds it to the student's counselling hours, to book again.</p>
      </div>
      <FormError>{error}</FormError>
    </section>
  )
}

function PaymentSheet({ p, onClose }) {
  return (
    <Sheet title={`${formatMoney(p.amountMinor, p.currency)} from ${p.member.displayName}`} onClose={onClose}>
      <div className="adm-account"><Person user={p.member} sub={p.member.email} size={48} /><div className="adm-account-pills">{pill(PAYMENT, p.status)}</div></div>
      <Facts items={[
        ['For', p.package ? `${p.package} package` : 'An earlier session payment'],
        ['Counselling time', p.minutes && hoursText(p.minutes)],
        ['Paid on', day(p.at)],
        ['Invoice', p.invoice],
        ['Razorpay order', p.orderId && <span className="mono">{p.orderId}</span>],
        ['Razorpay payment', p.paymentId && <span className="mono">{p.paymentId}</span>],
        ['Razorpay refund', p.refundId && <span className="mono">{p.refundId}</span>],
      ]} />
      <p className="adm-hint">To refund a package, refund it in the Razorpay dashboard and take the hours off the member under Members.</p>
    </Sheet>
  )
}

function PaymentList() {
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const [error, setError] = useState('')
  const list = useAdminApi(`/admin/payments?status=${status}&page=${page}`)
  const rows = list.data?.items || []
  const sum = list.data?.summary
  const download = () => { setError(''); downloadAdminFile('/admin/payments.csv', 'tym-payments.csv').catch((err) => setError(err.message)) }
  return (
    <>
      {sum && (
        <dl className="adm-figures is-three">
          <div><dt>Taken this month</dt><dd>{formatMoney(sum.paidThisMonthMinor, sum.currency)}</dd><span>{formatMoney(sum.paidMinor, sum.currency)} since the start</span></div>
          <div><dt>Packages sold</dt><dd>{sum.paidCount}</dd><span>paid and kept</span></div>
          <div><dt>Refunded</dt><dd>{formatMoney(sum.refundedMinor, sum.currency)}</dd><span>{plural(sum.refundedCount, 'refund')}</span></div>
        </dl>
      )}
      <div className="adm-toolbar">
        <Tabs label="Which payments" value={status} onChange={(s) => { setStatus(s); setPage(1) }}
          items={[['all', 'All'], ['paid', 'Paid'], ['refunded', 'Refunded'], ['created', 'Not paid'], ['failed', 'Failed']]} />
        <button className="btn btn-ghost btn-sm" onClick={download}><Download size={14} /> Download as a spreadsheet</button>
      </div>
      <FormError>{error}</FormError>
      {list.error ? <Empty title="We could not load payments" text={list.error.message} />
        : !list.data ? <Loading what="payments" />
          : rows.length === 0 ? <Empty title="No payments here yet" text="When a student buys counselling hours, the payment appears here." />
            : (
              <ul className="adm-list">
                {rows.map((p) => (
                  <li key={p.id}>
                    <button className="adm-row adm-bookings" onClick={() => setOpen(p)}>
                      <Person user={p.member} sub={p.package ? `${p.package} package` : 'an earlier session payment'} />
                      <span className="adm-cell adm-cell-wide">{formatMoney(p.amountMinor, p.currency)}</span>
                      <span className="adm-cell">{p.invoice || 'No invoice'}</span>
                      {pill(PAYMENT, p.status)}
                      <time className="adm-cell adm-cell-time adm-cell-drop" dateTime={p.at}>{ago(p.at)}</time>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      <Pager page={page} hasMore={list.data?.hasMore} onPage={setPage} />
      {open && <PaymentSheet p={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Sessions() {
  const [status, setStatus] = useState('upcoming')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const [done, setDone] = useState(null)
  const list = useAdminApi(`/admin/bookings?status=${status}&page=${page}`)
  const rows = list.data?.items || []
  return (
    <>
      <div className="adm-toolbar">
        <Tabs label="Which sessions" value={status} onChange={(s) => { setStatus(s); setPage(1) }}
          items={[['upcoming', 'Coming up'], ['all', 'All'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]} />
      </div>
      {list.error ? <Empty title="We could not load sessions" text={list.error.message} />
        : !list.data ? <Loading what="sessions" />
          : rows.length === 0 ? <Empty title="No sessions here" text="When a student books a mentor, the session appears here." />
            : (
              <ul className="adm-list">
                {rows.map((b) => (
                  <li key={b.id}>
                    <button className="adm-row adm-bookings" onClick={() => { setDone(null); setOpen(b) }}>
                      <Person user={b.student} sub={`with ${b.mentor.displayName}`} />
                      <span className="adm-cell adm-cell-wide">{when(b.startsAt)}</span>
                      <span className="adm-cell">{hoursText(b.minutes)}{b.returned ? ' · returned' : ''}</span>
                      {pill(BOOKING, b.status)}
                      <span className="adm-cell adm-cell-time adm-cell-drop">Booked {ago(b.bookedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      <Pager page={page} hasMore={list.data?.hasMore} onPage={setPage} />
      {open && (
        <Sheet title={`${open.student.displayName} with ${open.mentor.displayName}`} onClose={() => setOpen(null)}>
          <div className="adm-account"><Person user={open.student} sub={open.student.email} size={48} /><div className="adm-account-pills">{pill(BOOKING, done?.status || open.status)}</div></div>
          <Facts items={[
            ['Mentor', open.mentor.displayName], ['When', when(open.startsAt)], ['They want to cover', open.topic],
            ['Counselling time', `${hoursText(open.minutes)}${open.returned || done?.refunded ? ', returned to the student' : ''}`],
            ['Booked', day(open.bookedAt)],
          ]} />
          {done && <p className="adm-ok" role="status">The session is cancelled{done.refunded ? ' and the time returned to the student' : ''}. Both people have been told.</p>}
          {!done && open.status === 'confirmed' && <CancelSession booking={open} onDone={(res) => { setDone(res); list.reload() }} />}
        </Sheet>
      )}
    </>
  )
}

export function MentorHours() {
  const list = useAdminApi('/admin/earnings')
  if (list.error) return <Empty title="We could not load mentor hours" text={list.error.message} />
  if (!list.data) return <Loading what="mentor hours" />
  if (!list.data.length) return <Empty title="No sessions yet" text="Once students book sessions, the time each mentor gave shows here so you know what they are owed." />
  return (
    <>
      <ul className="adm-list">
        {list.data.map((e) => (
          <li key={e.mentorId} className="adm-row adm-apps">
            <Person user={e.mentor} sub={e.mentor.email} />
            <span className="adm-cell adm-cell-wide">{plural(e.sessions, 'session')}</span>
            <span className="adm-cell">{hoursText(e.thisMonthMinutes)} this month</span>
            <strong className="adm-cell-time">{hoursText(e.minutes)}</strong>
          </li>
        ))}
      </ul>
      <p className="adm-hint">Students pay TYM for hours, not a mentor for a session, so this is the counselling time each mentor's sessions used, without cancelled ones. Paying mentors is done outside the panel for now.</p>
    </>
  )
}

// One package: what it is called, how many hours it holds and what it costs
function PackageForm({ p, onSaved, onClose }) {
  const [f, setF] = useState({ title: p?.title || '', hours: p?.hours || 1, price: p?.price || '', isActive: p ? p.isActive : true })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi(p ? `/admin/packages/${p.id}` : '/admin/packages', {
        method: p ? 'PATCH' : 'POST', body: { title: f.title, hours: Number(f.hours), price: Number(f.price), isActive: f.isActive } })
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <Sheet title={p ? `Change the ${p.title} package` : 'Add a package'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="field"><label htmlFor="pk-title">Name</label><input id="pk-title" className="input" value={f.title} onChange={set('title')} required minLength={2} maxLength={80} placeholder="10 hours" /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="pk-hours">Hours of counselling</label><input id="pk-hours" type="number" className="input" value={f.hours} onChange={set('hours')} required min={1} max={500} step={1} /></div>
          <div className="field"><label htmlFor="pk-price">Price, in rupees</label><input id="pk-price" type="number" className="input" value={f.price} onChange={set('price')} required min={1} max={500000} step={1} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} /><span>On sale. Untick to stop selling it; hours already bought stay with their owners.</span></label>
        <p className="adm-hint">A new price applies to purchases from now on.</p>
        <FormError>{error}</FormError>
        <SubmitButton busy={busy} busyText="Saving" style={{ justifySelf: 'start', width: 'auto' }}>Save package</SubmitButton>
      </form>
    </Sheet>
  )
}

export function Packages() {
  const list = useAdminApi('/admin/packages')
  const [open, setOpen] = useState(null) // a package, or 'new'
  if (list.error) return <Empty title="We could not load packages" text={list.error.message} />
  if (!list.data) return <Loading what="packages" />
  return (
    <>
      <div className="adm-toolbar"><span /><button className="btn btn-primary btn-sm" onClick={() => setOpen('new')}>Add a package</button></div>
      {list.data.length === 0 ? <Empty title="No packages yet" text="Add one so students can buy counselling hours." /> : (
        <ul className="adm-list">
          {list.data.map((p) => (
            <li key={p.id}>
              <button className="adm-row adm-bookings" onClick={() => setOpen(p)}>
                <span><strong>{p.title}</strong></span>
                <span className="adm-cell adm-cell-wide">{hoursText(p.hours * 60)} of counselling</span>
                <span className="adm-cell">{formatMoney(p.priceMinor, p.currency)}</span>
                <Pill tone={p.isActive ? 'line' : 'muted'}>{p.isActive ? 'On sale' : 'Not on sale'}</Pill>
                <span className="adm-cell adm-cell-time adm-cell-drop">{plural(p.sold, 'sale')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="adm-hint">Every mentor costs the same: students buy hours here and spend them on any mentor. A 30 minute session uses half an hour.</p>
      {open && <PackageForm p={open === 'new' ? null : open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); list.reload() }} />}
    </>
  )
}

export default function Payments() {
  const [tab, setTab] = useState('payments')
  return (
    <>
      <PageHead eyebrow="Payments" title="Money and sessions"
        text="The counselling hours students have bought, every session booked with them, the time each mentor gave, and the packages on sale. Times are in your own time zone." />
      <div className="adm-toolbar">
        <Tabs label="Payments" value={tab} onChange={setTab}
          items={[['payments', 'Payments'], ['sessions', 'Sessions'], ['earnings', 'Mentor hours'], ['packages', 'Packages']]} />
      </div>
      {tab === 'payments' && <PaymentList />}
      {tab === 'sessions' && <Sessions />}
      {tab === 'earnings' && <MentorHours />}
      {tab === 'packages' && <Packages />}
    </>
  )
}
