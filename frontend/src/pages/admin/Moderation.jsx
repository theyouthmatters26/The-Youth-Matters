import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { FormError } from '../../components/auth/fields'
import Avatar from '../../components/ui/Avatar'
import { adminApi, useAdminApi } from '../../lib/admin'
import { Confirm, Empty, Loading, PageHead, Pager, Pill, Tabs, ago } from './ui'

const KIND = { post: 'Question', comment: 'Answer', chat_message: 'Chat message', user: 'Profile' }

// One report: what was reported, why, and the three things you can do about it
function Report({ r, onDone }) {
  const [error, setError] = useState('')
  const t = r.target
  const resolve = async (action) => {
    setError('')
    try {
      await adminApi(`/admin/reports/${r.id}/resolve`, { method: 'POST', body: { action } })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <li className="adm-report">
      <div className="adm-report-head">
        <Pill tone="muted">{KIND[t.type]}</Pill>
        <span className="adm-report-why">“{r.reason}”</span>
        <time dateTime={r.at}>{ago(r.at)}</time>
      </div>
      {t.missing ? <p className="adm-note">This {KIND[t.type].toLowerCase()} no longer exists.</p> : (
        <div className="adm-report-target">
          <Avatar user={t.author} size={32} />
          <div>
            <p><strong>{t.author.displayName}</strong> <span className="faint">@{t.author.username}</span> {t.removed && <Pill tone="warn">{t.type === 'user' ? 'Suspended' : 'Removed'}</Pill>}</p>
            <p className="adm-report-title">{t.title}</p>
            {t.excerpt && <p className="adm-report-text">{t.excerpt}</p>}
            <a href={t.url} target="_blank" rel="noreferrer" className="adm-more">See it on the site <ArrowUpRight size={14} aria-hidden /></a>
          </div>
        </div>
      )}
      <p className="adm-report-by">Reported by {r.reporter ? `${r.reporter.displayName} (@${r.reporter.username})` : 'a member who has left'}</p>
      {r.status === 'open' && (
        <div className="adm-action-row">
          <Confirm label="Nothing wrong" question="Dismiss this report?" onConfirm={() => resolve('dismiss')} />
          {t.type !== 'user' && !t.missing && <Confirm label="Remove it" question="Take it off the site?" danger onConfirm={() => resolve('remove')} />}
          {!t.missing && (
            <Confirm label={t.type === 'user' ? 'Strike this member' : 'Remove and strike'} danger
              question={t.type === 'user' ? 'Give them a strike?' : 'Remove it and strike the author?'} onConfirm={() => resolve('strike')} />
          )}
        </div>
      )}
      <FormError>{error}</FormError>
    </li>
  )
}

export default function Moderation({ onChanged }) {
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const list = useAdminApi(`/admin/reports?status=${status}&page=${page}`)
  const rows = list.data?.items || []
  const done = () => { list.reload(); onChanged?.() }

  return (
    <>
      <PageHead eyebrow="Moderation" title="Reports from members"
        text="Members flag questions, answers, chat messages and profiles. A strike warns the first time, mutes for a day the second, and suspends the third." />
      <div className="adm-toolbar">
        <Tabs label="Which reports" value={status} onChange={(s) => { setStatus(s); setPage(1) }}
          items={[['open', 'To review'], ['resolved', 'Acted on'], ['dismissed', 'Dismissed']]} />
      </div>
      {list.error ? <Empty title="We could not load reports" text={list.error.message} />
        : !list.data ? <Loading what="reports" />
          : rows.length === 0 ? (
            <Empty title={status === 'open' ? 'Nothing to review' : 'Nothing here yet'}
              text={status === 'open' ? 'When a member reports something it shows up here.' : 'Reports you deal with are kept here.'} />
          ) : <ul className="adm-list">{rows.map((r) => <Report key={r.id} r={r} onDone={done} />)}</ul>}
      <Pager page={page} hasMore={list.data?.hasMore} onPage={setPage} />
    </>
  )
}
