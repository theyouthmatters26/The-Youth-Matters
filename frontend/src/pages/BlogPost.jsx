import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronLeft, Link2 } from 'lucide-react'
import ArticleBody, { Contents, Inline } from '../components/blog/ArticleBody'
import Avatar from '../components/ui/Avatar'
import { Spinner } from '../components/auth/fields'
import { users } from '../data/sample'
import { useArticle, useArticles } from '../lib/blog'
import { SITE, siteUrl, useMeta } from '../lib/meta'
import NotFound from './NotFound'
import Photo from '../components/ui/Photo'
import '../components/blog/blog.css'

const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

function authorOf(post) {
  const person = Object.values(users).find((u) => u.username === post.author.username)
  // role drives the avatar style; title is what the byline shows
  return { ...post.author, displayName: post.author.name, title: post.author.role, role: person?.role || 'admin', avatar: person?.avatar || '/logo.png' }
}

function structuredData(post) {
  const url = `${siteUrl}/blogs/${post.slug}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting', '@id': `${url}#article`, mainEntityOfPage: url, headline: post.title,
        description: post.description, image: `${siteUrl}${post.image}`, keywords: post.keywords.join(', '),
        datePublished: post.published, dateModified: post.updated, inLanguage: 'en-GB',
        author: post.author.username === 'tym.team'
          ? { '@type': 'Organization', name: SITE, url: siteUrl }
          : { '@type': 'Person', name: post.author.name, jobTitle: post.author.role },
        publisher: { '@type': 'Organization', name: SITE, logo: { '@type': 'ImageObject', url: `${siteUrl}/logo.png` } },
      },
      {
        '@type': 'FAQPage',
        mainEntity: post.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '') } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Blogs', item: `${siteUrl}/blogs` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  }
}

function CopyLink() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* blocked */ }
  }
  return <button className="toc-share" onClick={copy}>{copied ? <><Check size={14} /> Link copied</> : <><Link2 size={14} /> Copy link</>}</button>
}

export default function BlogPost() {
  const { slug } = useParams()
  const { post, missing, error } = useArticle(slug)
  const { articles } = useArticles()
  const jsonLd = useMemo(() => post && structuredData(post), [post])
  useMeta(post ? { title: post.seoTitle || post.title, description: post.description, path: `/blogs/${post.slug}`, image: post.image, type: 'article', jsonLd } : {})
  if (missing) return <NotFound />
  if (!post) return <div className="container page post-loading">{error ? error.message : <><Spinner /> Loading the article</>}</div>

  const author = authorOf(post)
  const related = articles.filter((b) => b.slug !== slug).slice(0, 3)

  return (
    <article className="post">
      <span className="read-progress" aria-hidden />
      <header className="container post-head">
        <Link to="/blogs" className="back-link"><ChevronLeft size={16} /> All articles</Link>
        <p className="post-kicker">{post.topic} · {post.readMins} min read</p>
        <h1>{post.title}</h1>
        <p className="post-lede">{post.excerpt}</p>
        <div className="post-byline">
          <Avatar user={author} size={44} />
          <div>
            <strong>{author.name}</strong>
            <span>{author.title}</span>
          </div>
          <p className="post-dates">
            <span>Published <time dateTime={post.published}>{longDate(post.published)}</time></span>
            {post.updated !== post.published && <span>Updated <time dateTime={post.updated}>{longDate(post.updated)}</time></span>}
          </p>
        </div>
      </header>

      <figure className="container post-cover">
        <Photo src={post.image} alt={post.imageAlt || ''} width="1600" height="900" sizes="(max-width: 920px) 92vw, 880px" priority />
      </figure>

      <div className="container post-grid">
        <aside className="post-aside">
          <Contents blocks={post.body} />
          <CopyLink />
        </aside>

        <div className="post-main">
          <details className="toc-mobile">
            <summary>On this page</summary>
            <Contents blocks={post.body} />
          </details>
          <section className="takeaways" aria-labelledby="takeaways-title" data-reveal>
            <h2 id="takeaways-title">The short version</h2>
            <ul>{post.takeaways.map((t) => <li key={t}><Check size={16} aria-hidden /> <span><Inline text={t} /></span></li>)}</ul>
          </section>

          <ArticleBody blocks={post.body} />

          <section className="post-faq" aria-labelledby="faq-title">
            <h2 id="faq-title" data-reveal>Questions people ask</h2>
            {post.faqs.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p><Inline text={a} /></p>
              </details>
            ))}
          </section>

          {post.sources?.length > 0 && (
            <section className="post-sources" aria-labelledby="sources-title">
              <h2 id="sources-title">Official sources</h2>
              <p className="muted">Rules and fees change. Always check these before you apply.</p>
              <ul>{post.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener" className="link">{s.label}</a></li>)}</ul>
            </section>
          )}

          <footer className="post-writer">
            <Avatar user={author} size={64} />
            <div>
              <p className="faint">Written by</p>
              <strong>{author.name}</strong>
              <p>{post.author.bio}</p>
            </div>
          </footer>
        </div>
      </div>

      <section className="post-related" aria-labelledby="related-title">
        <div className="container">
          <h2 id="related-title" className="display">Keep reading</h2>
          <div className="related-grid">
            {related.map((b) => (
              <Link key={b.slug} to={`/blogs/${b.slug}`} className="related-card">
                <div className="related-photo"><Photo src={b.image} sizes="(max-width: 720px) 92vw, 380px" /></div>
                <span className="blog-meta">{b.topic} · {b.readMins} min read</span>
                <h3>{b.title}</h3>
                <span className="text-link">Read article <ArrowUpRight size={15} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </article>
  )
}
