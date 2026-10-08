import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Bold, Check, ImagePlus, Link2, Plus, Trash2 } from 'lucide-react'
import { FormError, Spinner } from '../../components/auth/fields'
import ArticleBody, { Inline } from '../../components/blog/ArticleBody'
import Photo from '../../components/ui/Photo'
import { adminApi, useAdminApi } from '../../lib/admin'
import { SNIPPETS, parseArticle, slugify, wordCount } from '../../lib/article'
import { Confirm, Empty, Loading, PageHead, Pill, Tabs, day } from './ui'
import '../../components/blog/blog.css'

const BLANK = {
  title: '', slug: '', excerpt: '', topic: '', image: '', imageAlt: '', source: '', seoTitle: '', description: '',
  keywords: [], takeaways: [], faqs: [], sources: [], author: { name: 'TYM Team', username: 'tym.team', role: 'Editorial team', bio: '' },
}
const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean)

// Question and answer pairs, or labelled links: a short list you add to and remove from
function Pairs({ label, hint, value, onChange, first, second, addLabel }) {
  const set = (i, k, v) => onChange(value.map((row, n) => (n === i ? { ...row, [k]: v } : row)))
  return (
    <fieldset className="adm-pairs">
      <legend>{label}</legend>
      {hint && <p className="adm-hint">{hint}</p>}
      {value.map((row, i) => (
        <div key={i} className="adm-pair">
          <input className="input" value={row.a} onChange={(e) => set(i, 'a', e.target.value)} placeholder={first} aria-label={`${first} ${i + 1}`} />
          <textarea className="textarea" rows={2} value={row.b} onChange={(e) => set(i, 'b', e.target.value)} placeholder={second} aria-label={`${second} ${i + 1}`} />
          <button type="button" className="adm-icon" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label={`Remove ${i + 1}`}><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...value, { a: '', b: '' }])}><Plus size={14} /> {addLabel}</button>
    </fieldset>
  )
}

function Editor({ id, onClose }) {
  const loaded = useAdminApi(id ? `/admin/blog/${id}` : null)
  const [a, setA] = useState(id ? null : BLANK)
  const [clean, setClean] = useState(id ? null : JSON.stringify(BLANK)) // the article as it was last loaded or saved
  const [status, setStatus] = useState('draft')
  const [savedId, setSavedId] = useState(id)
  const [view, setView] = useState('write')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [slugTouched, setSlugTouched] = useState(Boolean(id))
  const body = useRef(null)
  const file = useRef(null)

  useEffect(() => {
    if (!loaded.data) return
    const d = loaded.data
    const article = { ...BLANK, ...d, faqs: d.faqs.map(([q, ans]) => ({ a: q, b: ans })), sources: d.sources.map((s) => ({ a: s.label, b: s.url })) }
    setA(article)
    setClean(JSON.stringify(article))
    setStatus(d.status)
  }, [loaded.data])

  // The article lives only in this component until it is saved: warn before a reload or a closed tab throws it away
  const dirty = Boolean(a) && JSON.stringify(a) !== clean
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const blocks = useMemo(() => parseArticle(a?.source || ''), [a?.source])
  if (loaded.error) return <Empty title="We could not open this article" text={loaded.error.message}><button className="btn btn-ghost btn-sm" onClick={onClose}>Back to articles</button></Empty>
  if (!a) return <Loading what="the article" />

  const set = (k) => (e) => { setA({ ...a, [k]: e.target.value }); setNote('') }
  const setTitle = (e) => setA({ ...a, title: e.target.value, slug: slugTouched ? a.slug : slugify(e.target.value) })
  const words = wordCount(a.source)

  // Put a snippet where the cursor is, on its own lines
  const insert = (snippet, wrap) => {
    const el = body.current
    const [from, to] = [el.selectionStart, el.selectionEnd]
    const picked = a.source.slice(from, to)
    const text = wrap ? wrap(picked) : `${from && a.source[from - 1] !== '\n' ? '\n\n' : ''}${snippet}\n\n`
    setA({ ...a, source: a.source.slice(0, from) + text + a.source.slice(to) })
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = from + text.length })
  }

  const upload = async (e) => {
    const picked = e.target.files[0]
    e.target.value = ''
    if (!picked) return
    const form = new FormData()
    form.append('image', picked)
    setBusy('photo')
    setError('')
    try {
      const { url } = await adminApi('/admin/blog/image', { method: 'POST', body: form })
      setA((now) => ({ ...now, image: url }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const save = async (publish) => {
    setBusy(publish ? 'publish' : 'draft')
    setError('')
    setNote('')
    const payload = {
      ...a, publish,
      faqs: a.faqs.filter((r) => r.a.trim() && r.b.trim()).map((r) => [r.a, r.b]),
      sources: a.sources.filter((r) => r.a.trim() && r.b.trim()).map((r) => ({ label: r.a, url: r.b })),
    }
    try {
      const res = await adminApi(savedId ? `/admin/blog/${savedId}` : '/admin/blog', { method: savedId ? 'PATCH' : 'POST', body: payload })
      setSavedId(res.id)
      setStatus(res.status)
      setA((now) => ({ ...now, slug: res.slug }))
      setClean(JSON.stringify({ ...a, slug: res.slug })) // what was sent: anything typed while it saved still counts as unsaved
      setSlugTouched(true)
      setNote(publish ? 'Published. It is live on the site.' : 'Saved as a draft. Only the team can see it.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const remove = async () => {
    await adminApi(`/admin/blog/${savedId}`, { method: 'DELETE' })
    onClose()
  }
  const leave = () => {
    if (!dirty || window.confirm('This article has changes that are not saved. Leave without saving them?')) onClose()
  }

  return (
    <div className="adm-editor">
      <header className="adm-editor-bar">
        <button className="btn-text adm-editor-back" onClick={leave}><ArrowLeft size={15} /> All articles</button>
        <Pill tone={status === 'published' ? 'solid' : 'muted'}>{status === 'published' ? 'Published' : 'Draft'}</Pill>
        <span className="adm-editor-count">{words.toLocaleString('en-IN')} words · {Math.max(1, Math.round(words / 220))} min read</span>
        <div className="adm-editor-actions">
          {status === 'published' && <a href={`/blogs/${a.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View <ArrowUpRight size={14} /></a>}
          <button className="btn btn-ghost btn-sm" onClick={() => save(false)} disabled={Boolean(busy)}>
            {busy === 'draft' ? <Spinner /> : status === 'published' ? 'Unpublish' : 'Save draft'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => save(true)} disabled={Boolean(busy)}>
            {busy === 'publish' ? <Spinner /> : status === 'published' ? 'Save changes' : 'Publish'}
          </button>
        </div>
      </header>
      <FormError>{error}</FormError>
      {note && <p className="adm-ok" role="status">{note}</p>}

      <div className="adm-editor-switch"><Tabs label="Write or preview" value={view} onChange={setView} items={[['write', 'Write'], ['preview', 'Preview']]} /></div>

      <div className={`adm-editor-grid is-${view}`}>
        <div className="adm-editor-form stack">
          <div className="field">
            <label htmlFor="b-title">Title</label>
            <input id="b-title" className="input adm-editor-title" value={a.title} onChange={setTitle} maxLength={200} placeholder="UK student visa funds, explained in plain English" />
          </div>
          <div className="field">
            <div className="field-row"><label htmlFor="b-excerpt">Summary</label><span className="hint">{300 - a.excerpt.length} left</span></div>
            <textarea id="b-excerpt" className="textarea adm-textarea" rows={2} maxLength={300} value={a.excerpt} onChange={set('excerpt')}
              placeholder="One or two sentences shown under the title and on the blog page." />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="b-topic">Topic</label>
              <input id="b-topic" className="input" value={a.topic} onChange={set('topic')} maxLength={60} placeholder="Visas" list="b-topics" />
              <datalist id="b-topics">{['Visas', 'Applications', 'Life abroad', 'Money', 'Accommodation', 'Scholarships'].map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div className="field">
              <label htmlFor="b-slug">Web address</label>
              <input id="b-slug" className="input mono" value={a.slug} maxLength={160} placeholder="made-from-the-title"
                onChange={(e) => { setSlugTouched(true); setA({ ...a, slug: slugify(e.target.value) }) }} />
              <span className="hint">theyouthmatters.com/blogs/{a.slug || '...'}</span>
            </div>
          </div>

          <div className="field">
            <span className="adm-label">Cover photo</span>
            <div className="adm-cover">
              {a.image ? <img src={a.image} alt="" /> : <span>No photo yet</span>}
              <div className="stack">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current.click()} disabled={busy === 'photo'}>
                  {busy === 'photo' ? <Spinner /> : <ImagePlus size={15} />} {a.image ? 'Change photo' : 'Upload a photo'}
                </button>
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
                <input className="input" value={a.imageAlt} onChange={set('imageAlt')} maxLength={200} placeholder="Describe the photo, for people who cannot see it" aria-label="Photo description" />
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="b-source">The article</label>
            <div className="adm-insert" role="toolbar" aria-label="Insert">
              <button type="button" onClick={() => insert('', (t) => `**${t || 'bold text'}**`)} aria-label="Bold"><Bold size={14} /></button>
              <button type="button" onClick={() => insert('', (t) => `[${t || 'link text'}](https://)`)} aria-label="Link"><Link2 size={14} /></button>
              {SNIPPETS.map(([name, snippet]) => <button key={name} type="button" onClick={() => insert(snippet)}>{name}</button>)}
            </div>
            <textarea id="b-source" ref={body} className="textarea adm-editor-source" value={a.source} onChange={set('source')} spellCheck
              placeholder={'Start writing. Leave an empty line between paragraphs.\n\n## A section heading\n\nUse the buttons above to add tips, steps, tables and checklists.'} />
            <details className="adm-format">
              <summary>How formatting works</summary>
              <p>Write normally and leave an empty line between paragraphs. Start a line with <code>##</code> for a section heading (these build the contents list), <code>-</code> for bullets, or <code>&gt;</code> for a quote. The Insert buttons add everything else as a block that begins with <code>:::</code> and ends with a line of <code>:::</code>. Use <code>**bold**</code> and <code>[text](https://link)</code> anywhere.</p>
            </details>
          </div>

          <div className="field">
            <label htmlFor="b-take">The short version</label>
            <textarea id="b-take" className="textarea adm-textarea" rows={4} value={a.takeaways.join('\n')} onChange={(e) => setA({ ...a, takeaways: e.target.value.split('\n') })}
              placeholder="One takeaway per line. Three to five works best." />
          </div>
          <Pairs label="Questions people ask" hint="Shown at the end of the article, and given to search engines as FAQs." value={a.faqs}
            onChange={(faqs) => setA({ ...a, faqs })} first="Question" second="Answer" addLabel="Add a question" />
          <Pairs label="Official sources" hint="Links readers should check before they apply." value={a.sources}
            onChange={(sources) => setA({ ...a, sources })} first="Name, for example GOV.UK: Student visa" second="https://" addLabel="Add a source" />

          <fieldset className="adm-pairs">
            <legend>Search engines</legend>
            <div className="field"><label htmlFor="b-seo">Page title</label><input id="b-seo" className="input" value={a.seoTitle} onChange={set('seoTitle')} maxLength={120} placeholder="Defaults to the article title" /></div>
            <div className="field"><label htmlFor="b-desc">Description</label><textarea id="b-desc" className="textarea adm-textarea" rows={2} maxLength={320} value={a.description} onChange={set('description')} placeholder="Defaults to the summary" /></div>
            <div className="field"><label htmlFor="b-keys">Search phrases</label><input id="b-keys" className="input" value={a.keywords.join(', ')} onChange={(e) => setA({ ...a, keywords: e.target.value.split(',').map((k) => k.trimStart()) })} placeholder="uk student visa funds, 28 day rule" /><span className="hint">Separate with commas.</span></div>
          </fieldset>

          <fieldset className="adm-pairs">
            <legend>Written by</legend>
            <div className="grid-2">
              <div className="field"><label htmlFor="b-an">Name</label><input id="b-an" className="input" value={a.author.name} maxLength={80} onChange={(e) => setA({ ...a, author: { ...a.author, name: e.target.value } })} /></div>
              <div className="field"><label htmlFor="b-ar">Course or role</label><input id="b-ar" className="input" value={a.author.role} maxLength={160} onChange={(e) => setA({ ...a, author: { ...a.author, role: e.target.value } })} placeholder="Mentor, MSc Data Science, Leeds" /></div>
            </div>
            <div className="field"><label htmlFor="b-ab">About the writer</label><textarea id="b-ab" className="textarea adm-textarea" rows={2} maxLength={500} value={a.author.bio} onChange={(e) => setA({ ...a, author: { ...a.author, bio: e.target.value } })} /></div>
          </fieldset>

          {savedId && (
            <div className="adm-editor-danger">
              <Confirm label="Delete this article" question="Delete it for good?" yes="Delete" danger onConfirm={remove} />
            </div>
          )}
        </div>

        <aside className="adm-preview" aria-label="Preview">
          <p className="adm-h2">How it will look</p>
          <div className="adm-preview-page">
            {a.image && <img className="adm-preview-cover" src={a.image} alt="" />}
            <p className="post-kicker">{a.topic || 'Topic'} · {Math.max(1, Math.round(words / 220))} min read</p>
            <h1>{a.title || 'Your title'}</h1>
            {a.excerpt && <p className="post-lede">{a.excerpt}</p>}
            {lines(a.takeaways.join('\n')).length > 0 && (
              <section className="takeaways"><h2>The short version</h2><ul>{lines(a.takeaways.join('\n')).map((t) => <li key={t}><Check size={16} aria-hidden /> <span><Inline text={t} /></span></li>)}</ul></section>
            )}
            {blocks.length ? <ArticleBody blocks={blocks} /> : <p className="muted">The article appears here as you write.</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function Blog() {
  const [params, setParams] = useSearchParams()
  const editing = params.get('edit')
  const [show, setShow] = useState('all')
  const list = useAdminApi('/admin/blog')

  if (editing) {
    return <Editor key={editing} id={editing === 'new' ? null : Number(editing)} onClose={() => { setParams({}); list.reload() }} />
  }
  const all = list.data || []
  const drafts = all.filter((b) => b.status === 'draft').length
  const rows = show === 'all' ? all : all.filter((b) => b.status === show)
  return (
    <>
      <PageHead eyebrow="Blog" title="Articles" text="Write guides, save them as drafts, and publish when they are ready. Published articles appear on the blog, the home page and in search.">
        <button className="btn btn-primary" onClick={() => setParams({ edit: 'new' })}><Plus size={16} /> New article</button>
      </PageHead>
      {all.length > 0 && (
        <div className="adm-toolbar">
          <Tabs label="Which articles" value={show} onChange={setShow} items={[['all', 'All'], ['published', 'Published'], ['draft', 'Drafts', drafts]]} />
          <span className="adm-hint">{all.length - drafts} live on the site</span>
        </div>
      )}
      {list.error ? <Empty title="We could not load articles" text={list.error.message} />
        : !list.data ? <Loading what="articles" />
          : all.length === 0 ? <Empty title="No articles yet" text="Write the first one. It stays a draft until you publish it." />
            : rows.length === 0 ? <Empty title={show === 'draft' ? 'No drafts' : 'Nothing published yet'} text={show === 'draft' ? 'Everything you have written is live.' : 'Open a draft and publish it when it is ready.'} />
            : (
              <ul className="adm-list">
                {rows.map((b) => (
                  <li key={b.id}>
                    <button className="adm-row adm-article" onClick={() => setParams({ edit: b.id })}>
                      <Photo src={b.image} sizes="112px" />
                      <span className="adm-article-text">
                        <strong>{b.title}</strong>
                        {b.excerpt && <span>{b.excerpt}</span>}
                        <small>{b.topic} · {b.readMins} min read · {b.author.name}</small>
                      </span>
                      <Pill tone={b.status === 'published' ? 'line' : 'muted'}>{b.status === 'published' ? 'Published' : 'Draft'}</Pill>
                      <time className="adm-cell adm-cell-time" dateTime={b.published}>{b.status === 'published' ? day(b.published) : `Edited ${day(b.updated)}`}</time>
                    </button>
                  </li>
                ))}
              </ul>
            )}
    </>
  )
}
