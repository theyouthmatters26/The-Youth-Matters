import { useState } from 'react'
import { Download } from 'lucide-react'
import { FormError } from '../../components/auth/fields'
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

// Cancelling for someone: the reason goes to both people, and the money can go back in the same step
function CancelSession({ bookingId, paid, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const short = reason.trim().length < 5
  const cancel = async (refund) => {
    setError('')
    try {
      onDone(await adminApi(`/admin/bookings/${bookingId}/cancel`, { method: 'POST', body: { refund, reason } }))
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
          {paid && <Confirm label="Cancel and refund" question="Cancel and send the money back?" danger disabled={short} onConfirm={() => cancel(true)} />}
          <Confirm label={paid ? 'Cancel without a refund' : 'Cancel session'} question="Cancel this session?" danger disabled={short} onConfirm={() => cancel(false)} />
        </div>
        {paid && <p className="adm-hint">Refunds go back through Razorpay to the card or account that paid.</p>}
      </div>
      <FormError>{error}</FormError>
    </section>
  )
}

function PaymentSheet({ p, onClose, onChanged }) {
  const [done, setDone] = useState(null)
  const open = !done && (p.bookingStatus === 'confirmed' || p.bookingStatus === 'pending_payment')
  return (
    <Sheet title={`${formatMoney(p.amountMinor, p.currency)} from ${p.member.displayName}`} onClose={onClose}>
      <div className="adm-account"><Person user={p.member} sub={p.member.email} size={48} /><div className="adm-account-pills">{pill(PAYMENT, done?.payment || p.status)}</div></div>
      <Facts items={[
        ['For', p.mentor ? `A session with ${p.mentor}` : 'A subscription'],
        ['Session', p.sessionAt && when(p.sessionAt)],
        ['Session status', p.bookingStatus && (BOOKING[done?.status || p.bookingStatus]?.[0] || p.bookingStatus)],
        ['Paid on', day(p.at)],
        ['Invoice', p.invoice],
        ['Razorpay order', p.orderId && <span className="mono">{p.orderId}</span>],
        ['Razorpay payment', p.paymentId && <span className="mono">{p.paymentId}</span>],
        ['Razorpay refund', p.refundId && <span className="mono">{p.refundId}</span>],
      ]} />
      {done && <p className="adm-ok" role="status">The session is cancelled{done.refunded ? ' and the payment refunded' : ''}. Both people have been told.</p>}
      {open && <CancelSession bookingId={p.bookingId} paid={p.status === 'paid'} onDone={(res) => { setDone(res); onChanged() }} />}
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
          <div><dt>Payments</dt><dd>{sum.paidCount}</dd><span>paid and kept</span></div>
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
          : rows.length === 0 ? <Empty title="No payments here yet" text="When a student pays for a mentor session it appears here." />
            : (
              <ul className="adm-list">
                {rows.map((p) => (
                  <li key={p.id}>
                    <button className="adm-row adm-bookings" onClick={() => setOpen(p)}>
                      <Person user={p.member} sub={p.mentor ? `for a session with ${p.mentor}` : 'subscription'} />
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
      {open && <PaymentSheet p={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
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
          items={[['upcoming', 'Coming up'], ['all', 'All'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['pending_payment', 'Paying']]} />
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
                      <span className="adm-cell">{formatMoney(b.amountMinor, b.currency)} · {PAYMENT[b.payment]?.[0] || 'No payment'}</span>
                      {pill(BOOKING, b.status)}
                      <span className="adm-cell adm-cell-time adm-cell-drop">{b.invoice || `Booked ${ago(b.bookedAt)}`}</span>
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
            ['Price', formatMoney(open.amountMinor, open.currency)], ['Payment', PAYMENT[done?.payment || open.payment]?.[0] || 'No payment'],
            ['Invoice', open.invoice], ['Booked', day(open.bookedAt)],
          ]} />
          {done && <p className="adm-ok" role="status">The session is cancelled{done.refunded ? ' and the payment refunded' : ''}. Both people have been told.</p>}
          {!done && (open.status === 'confirmed' || open.status === 'pending_payment') && (
            <CancelSession bookingId={open.id} paid={open.payment === 'paid'} onDone={(res) => { setDone(res); list.reload() }} />
          )}
        </Sheet>
      )}
    </>
  )
}

function Earnings() {
  const list = useAdminApi('/admin/earnings')
  if (list.error) return <Empty title="We could not load earnings" text={list.error.message} />
  if (!list.data) return <Loading what="earnings" />
  if (!list.data.length) return <Empty title="No paid sessions yet" text="Once students pay for sessions, each mentor's total shows here so you know what they are owed." />
  return (
    <>
      <ul className="adm-list">
        {list.data.map((e) => (
          <li key={e.mentorId} className="adm-row adm-apps">
            <Person user={e.mentor} sub={e.mentor.email} />
            <span className="adm-cell adm-cell-wide">{plural(e.sessions, 'paid session')}</span>
            <span className="adm-cell">{formatMoney(e.thisMonthMinor, e.currency)} this month</span>
            <strong className="adm-cell-time">{formatMoney(e.paidMinor, e.currency)}</strong>
          </li>
        ))}
      </ul>
      <p className="adm-hint">These are what students paid for each mentor's sessions, after refunds. Paying mentors their share is done outside the panel for now.</p>
    </>
  )
}

export default function Payments() {
  const [tab, setTab] = useState('payments')
  return (
    <>
      <PageHead eyebrow="Payments" title="Money and sessions"
        text="Every payment students have made, every session booked, and what each mentor's sessions brought in. Times are in your own time zone." />
      <div className="adm-toolbar">
        <Tabs label="Payments" value={tab} onChange={setTab} items={[['payments', 'Payments'], ['sessions', 'Sessions'], ['earnings', 'Mentor earnings']]} />
      </div>
      {tab === 'payments' && <PaymentList />}
      {tab === 'sessions' && <Sessions />}
      {tab === 'earnings' && <Earnings />}
    </>
  )
}
