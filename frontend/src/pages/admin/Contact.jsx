import { useState } from 'react'
import { ArrowUpRight, Mail } from 'lucide-react'
import { FormError } from '../../components/auth/fields'
import { adminApi, useAdminApi } from '../../lib/admin'
import { Confirm, Empty, Loading, PageHead, Pager, Pill, Tabs, ago } from './ui'

// Messages from the site's contact form. Each is kept here whether or not email is switched on.
export default function Contact({ onChanged }) {
  const [status, setStatus] = useState('new')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const list = useAdminApi(`/admin/contact?status=${status}&page=${page}`)
  const rows = list.data?.items || []

  const mark = async (m, to) => {
    setError('')
    try {
      await adminApi(`/admin/contact/${m.id}`, { method: 'POST', body: { status: to } })
      list.reload()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (m) => {
    setError('')
    try {
      await adminApi(`/admin/contact/${m.id}`, { method: 'DELETE' })
      list.reload()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHead eyebrow="Enquiries" title="Messages from the contact form"
        text="Everything people send through the Contact page on the site lands here, whether or not email is switched on. Reply from your own email, then mark it as dealt with." />
      <div className="adm-toolbar">
        <Tabs label="Which messages" value={status} onChange={(s) => { setStatus(s); setPage(1) }}
          items={[['new', 'To answer', list.data?.new], ['done', 'Dealt with']]} />
      </div>
      <FormError>{error}</FormError>
      {list.error ? <Empty title="We could not load messages" text={list.error.message} />
        : !list.data ? <Loading what="messages" />
          : rows.length === 0 ? (
            <Empty title={status === 'new' ? 'No messages to answer' : 'Nothing here yet'}
              text={status === 'new' ? 'You are up to date. New messages show a number beside Enquiries in the menu.' : 'Messages you have dealt with are kept here.'}>
              {status === 'new' && <a href="/contact" target="_blank" rel="noreferrer" className="adm-more">See the Contact page on the site <ArrowUpRight size={14} aria-hidden /></a>}
            </Empty>
          ) : (
            <ul className="adm-list">
              {rows.map((m) => (
                <li key={m.id} className="adm-report">
                  <div className="adm-report-head">
                    <Pill tone="muted">{m.topic}</Pill>
                    <span className="adm-contact-from"><strong>{m.name}</strong> {m.email}</span>
                    <time dateTime={m.at}>{ago(m.at)}</time>
                  </div>
                  <p className="adm-prose">{m.message}</p>
                  {Object.keys(m.details).length > 0 && (
                    <p className="adm-report-by">{Object.entries(m.details).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
                  )}
                  <div className="adm-action-row">
                    <a className="btn btn-primary btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent('Your message to The Youth Matters')}`}><Mail size={14} /> Reply by email</a>
                    {status === 'new'
                      ? <button className="btn btn-ghost btn-sm" onClick={() => mark(m, 'done')}>Mark as dealt with</button>
                      : <button className="btn btn-ghost btn-sm" onClick={() => mark(m, 'new')}>Move back to answer</button>}
                    <Confirm label="Delete" question="Delete this message?" danger className="btn-text" onConfirm={() => remove(m)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
      <Pager page={page} hasMore={list.data?.hasMore} onPage={setPage} />
    </>
  )
}
