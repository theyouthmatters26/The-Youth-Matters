import { useEffect } from 'react'

// Page metadata for search engines and link previews: title, description, canonical URL,
// Open Graph / Twitter tags and JSON-LD structured data. Restores the site defaults on leave.
// ponytail: tags are set client-side; Google renders JS, but prerendering the blog routes at build
// time is the upgrade if other crawlers matter.
export const SITE = 'The Youth Matters'
export const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')

function tag(selector, create) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  return el
}

function meta(attr, key, content) {
  const el = tag(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement('meta')
    m.setAttribute(attr, key)
    return m
  })
  el.setAttribute('content', content)
}

export function useMeta({ title, description, path, image, type = 'website', jsonLd }) {
  useEffect(() => {
    const previous = { title: document.title, description: document.head.querySelector('meta[name="description"]')?.content }
    const url = `${siteUrl}${path || window.location.pathname}`
    const img = image ? `${siteUrl}${image}` : `${siteUrl}/images/hero-students.jpg`
    document.title = title ? `${title} | ${SITE}` : previous.title
    if (description) meta('name', 'description', description)
    meta('property', 'og:title', title || SITE)
    if (description) meta('property', 'og:description', description)
    meta('property', 'og:type', type)
    meta('property', 'og:url', url)
    meta('property', 'og:image', img)
    meta('name', 'twitter:card', 'summary_large_image')
    tag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' })).href = url

    const ld = jsonLd && tag('script#page-ld', () => Object.assign(document.createElement('script'), { id: 'page-ld', type: 'application/ld+json' }))
    if (ld) ld.textContent = JSON.stringify(jsonLd)

    return () => {
      document.title = previous.title
      if (previous.description) meta('name', 'description', previous.description)
      document.head.querySelector('script#page-ld')?.remove()
    }
  }, [title, description, path, image, type, jsonLd])
}
