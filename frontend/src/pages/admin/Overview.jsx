import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAdmin, useAdminApi } from '../../lib/admin'
import { formatMoney, plural } from '../../lib/format'
import { Loading, PageHead, Person, StatusPill, ago } from './ui'

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// What each queue says when something is waiting in it
const QUEUES = [
  ['support', '/admin/support', (n) => `${plural(n, 'student is', 'students are')} waiting for a person`, 'Reply in Support', 'support'],
  ['contact', '/admin/enquiries', (n) => `${plural(n, 'contact form message')} to answer`, 'Open the inbox', 'support'],
  ['moderation', '/admin/moderation', (n) => `${plural(n, 'report')} to review`, 'Open Moderation', 'moderation'],
  ['mentors', '/admin/mentors', (n) => `${plural(n, 'mentor application')} to read`, 'Open Mentors', 'mentors'],
]

const KIND = { post: 'a question', comment: 'an answer', chat_message: 'a chat message' }
// One line of the audit trail, in plain words
const SAID = {
  suspended: (d) => `suspended ${d.name}`,
  banned: (d) => `banned ${d.name}`,
  reinstated: (d) => `reinstated ${d.name}`,
  verified: (d) => `verified ${d.name} by hand`,
  member_added: (d) => `made an account for ${d.name}`,
  member_deleted: (d) => `deleted ${d.name}'s account`,
  password_set: (d) => `set a new password for ${d.name}`,
  strike: (d) => `gave ${d.name} strike ${d.level}`,
  edited: (d) => `edited a question${d.name ? ` by ${d.name}` : ''}`,
  removed: (d, kind) => `removed ${KIND[kind] || 'something'}${d.name ? ` by ${d.name}` : ''}`,
  restored: (d) => `put back a question${d.name ? ` by ${d.name}` : ''}`,
  booking_cancelled: (d) => `cancelled ${d.name}'s session${d.refunded ? ' and returned the hours' : ''}`,
  hours_adjusted: (d) => `${d.minutes > 0 ? 'added' : 'took'} ${Math.abs(d.minutes) / 60} counselling ${Math.abs(d.minutes) === 60 ? 'hour' : 'hours'} ${d.minutes > 0 ? 'to' : 'from'} ${d.name}`,
  package_added: (d) => `added the ${d.name} package`,
  package_edited: (d) => `changed the ${d.name} package`,
  report_dismissed: () => 'dismissed a report',
  team_added: (d) => `added ${d.name} to the team`,
  team_updated: (d) => `changed what ${d.name} can open`,
  team_removed: (d) => `removed ${d.name} from the team`,
  mentor_approved: (d) => `approved ${d.name} as a mentor`,
  mentor_rejected: (d) => `turned down ${d.name}'s mentor application`,
  mentor_listed: (d) => `put ${d.name} back in the mentor directory`,
  mentor_hidden: (d) => `hid ${d.name} from the mentor directory`,
  mentor_edited: (d) => `edited ${d.name}'s mentor listing`,
  mentor_removed: (d) => `removed ${d.name} as a mentor`,
  review_removed: (d) => `deleted a review by ${d.name}`,
}

function Signups({ days }) {
  const most = Math.max(...days.map((d) => d.count), 1)
  const total = days.reduce((n, d) => n + d.count, 0)
  return (
    <section aria-labelledby="ov-signups">
      <h2 id="ov-signups" className="adm-h2">Sign-ups, last 14 days</h2>
      <div className="adm-bars" role="img" aria-label={`${plural(total, 'person', 'people')} signed up in the last 14 days`}>
        {days.map((d) => (
          <span key={d.date} title={`${new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${d.count}`}>
            <i style={{ transform: `scaleY(${Math.max(d.count / most, 0.03)})` }} />
          </span>
        ))}
      </div>
      <p className="adm-bars-note"><strong>{total}</strong> in two weeks</p>
    </section>
  )
}

export default function Overview() {
  const { admin, can } = useAdmin()
  const { data: o, error } = useAdminApi('/admin/overview')
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  if (error) return <PageHead title="Overview" text={error.message} />
  if (!o) return <Loading what="the overview" />

  const waiting = QUEUES.filter(([queue, , , , area]) => can(area) && o.queues[queue] > 0)
  return (
    <>
      <PageHead eyebrow={today} title={`${greeting()}, ${admin.name.split(' ')[0]}.`} />

      <section className="adm-needs" aria-labelledby="ov-needs">
        <h2 id="ov-needs" className="adm-h2">Needs you</h2>
        {waiting.length ? (
          <ul className="adm-list">
            {waiting.map(([queue, to, say, action]) => (
              <li key={queue}>
                <Link to={to} className="adm-row adm-need">
                  <span><strong>{say(o.queues[queue])}</strong></span>
                  <span className="adm-go">{action} <ArrowRight size={15} aria-hidden /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="adm-clear">Nothing is waiting. Every queue is clear.</p>}
      </section>

      <dl className="adm-figures">
        <div><dt>Members</dt><dd>{o.members.total.toLocaleString('en-IN')}</dd><span>{o.members.newThisWeek} joined in the last 7 days</span></div>
        <div><dt>Verified 18+</dt><dd>{o.members.verified.toLocaleString('en-IN')}</dd><span>{o.members.pending} still to show ID</span></div>
        <div><dt>Questions</dt><dd>{o.community.questions.toLocaleString('en-IN')}</dd><span>{o.community.unanswered} without an answer</span></div>
        <div><dt>Earned this month</dt><dd>{formatMoney(o.money.earnedThisMonthMinor, o.money.currency)}</dd><span>{plural(o.money.upcomingSessions, 'session')} coming up</span></div>
      </dl>

      <p className="adm-line">
        Across the community: <strong>{plural(o.community.answers, 'answer')}</strong>,{' '}
        <strong>{plural(o.community.chatToday, 'chat message')}</strong> in the last day,{' '}
        <strong>{plural(o.community.aiConversations, 'conversation')}</strong> with TYMAi and{' '}
        <strong>{plural(o.money.mentors, 'mentor')}</strong> in the directory.
      </p>

      <div className="adm-split">
        <Signups days={o.signups} />
        <section aria-labelledby="ov-new">
          <h2 id="ov-new" className="adm-h2">Newest members</h2>
          <ul className="adm-plain">
            {o.newest.map((u) => (
              <li key={u.id}><Person user={u} sub={`@${u.username} · joined ${ago(u.joinedAt)}`} size={34} /><StatusPill status={u.status} /></li>
            ))}
          </ul>
          {can('members') && <Link to="/admin/members" className="adm-more">All members <ArrowRight size={14} aria-hidden /></Link>}
        </section>
      </div>

      <section aria-labelledby="ov-log">
        <h2 id="ov-log" className="adm-h2">What the team did lately</h2>
        {o.activity.length ? (
          <ul className="adm-plain adm-log">
            {o.activity.map((a) => (
              <li key={a.id}>
                <span><strong>{a.by}</strong> {(SAID[a.action] || (() => a.action.replace(/_/g, ' ')))(a.detail, a.target)}</span>
                <time dateTime={a.at}>{ago(a.at)}</time>
              </li>
            ))}
          </ul>
        ) : <p className="adm-clear">Nothing yet. Suspensions, removals, approvals and team changes are listed here.</p>}
      </section>
    </>
  )
}
