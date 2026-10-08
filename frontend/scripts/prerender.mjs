// Builds each public page into plain HTML. Runs after `vite build` (see "build" in package.json).
//
// It serves dist/ itself, opens every public address in headless Chrome and saves what Chrome drew as
// dist/<address>/index.html. A visitor then sees the page as soon as the HTML arrives, while the
// scripts load behind it and take over; search engines and link previews get real content, titles and
// descriptions. dist/app.html is the empty app, for every address that is not built here (a question,
// a profile, the admin panel).
//
// Needs Google Chrome (or CHROME_PATH pointing at Chrome or Chromium), and the API running with its
// database, because pages are drawn from live data: articles, mentors, countries. Without either it
// says so and stops; dist/ is then the plain app, which works the same, only slower to first show.
//
//   API_URL        where the API is         (default http://localhost:5000)
//   VITE_SITE_URL  the site's public address, for canonical links and the sitemap (read from ../.env too)
//
// The web server must look for a built page before falling back to the app:
//   try_files $uri $uri/index.html /app.html;      (deploy/nginx.conf has the whole thing)

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../dist')
const API = new URL(process.env.API_URL || 'http://localhost:5000')
const AT_ONCE = 4

function setting(name) {
  if (process.env[name]) return process.env[name]
  try {
    const line = fs.readFileSync(path.resolve(HERE, '../../.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
    return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '') || ''
  } catch { return '' }
}
const SITE = (setting('VITE_SITE_URL') || 'https://theyouthmatters.com').replace(/\/$/, '')

function chrome() {
  const places = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  ]
  return places.find((p) => p && fs.existsSync(p))
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' }

// dist/ as a website: files as they are, the empty app for every page address, /api passed on to Flask
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      const up = http.request({ host: API.hostname, port: API.port || 80, path: req.url, method: req.method, headers: { ...req.headers, host: API.host } }, (r) => {
        res.writeHead(r.statusCode, r.headers)
        r.pipe(res)
      })
      up.on('error', () => { res.writeHead(502); res.end() })
      return req.pipe(up)
    }
    const ext = path.extname(url.pathname)
    const file = ext ? path.join(DIST, decodeURIComponent(url.pathname)) : path.join(DIST, 'app.html')
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'Content-Type': TYPES[ext || '.html'] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

const getJson = (address) => fetch(new URL(address, API)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${address} answered ${r.status}`))))

// Every address a visitor can open without signing in. [path, last changed]
async function addresses() {
  const today = new Date().toISOString().slice(0, 10)
  const footer = [...fs.readFileSync(path.resolve(HERE, '../src/pages/static/StaticPage.jsx'), 'utf8').matchAll(/^\s*'(\/[a-z-]+)': \[/gm)].map((m) => m[1])
  const fixed = ['/', '/about', '/features', '/faq', '/case-studies', '/contact', '/community', '/mentors', '/mentors/register', '/blogs', '/login', '/register', ...footer]
  const [articles, countries, mentors] = await Promise.all([getJson('/api/blogs'), getJson('/api/subjects/study-abroad/communities'), getJson('/api/mentors')])
  return [
    ...fixed.map((p) => [p, today]),
    ...countries.map((c) => [`/c/${c.country.slug}`, today]),
    ...mentors.map((m) => [`/mentors/${m.id}`, today]),
    ...articles.map((a) => [`/blogs/${a.slug}`, a.updated || a.published || today]),
  ]
}

// A built page is complete without its scripts, so nothing should stand between the visitor and the
// first screen. The stylesheets go into the page itself (no second trip before anything can be drawn),
// and the app's script and its parts are fetched once the page has finished loading, so on a slow
// phone connection they do not compete with the main picture.
// The page's main picture (the one marked fetchpriority="high"), as preload links for the top of the
// page: the browser starts on it with the first bytes it receives. One link per <source>, each
// limited to the screens its source is for, so only one of them is ever fetched.
function first(html) {
  const picture = [...html.matchAll(/<picture>(.*?)<\/picture>/gs)].find((m) => m[1].includes('fetchpriority="high"'))
  if (!picture) return ''
  const seen = []
  return [...picture[1].matchAll(/<source([^>]*)>/g)].map(([, attrs]) => {
    const get = (name) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1]
    const media = [get('media'), ...seen.map((m) => `not all and ${m}`)].filter(Boolean).join(' and ')
    if (get('media')) seen.push(get('media'))
    return `<link rel="preload" as="image" fetchpriority="high" type="${get('type')}" imagesrcset="${get('srcset')}" imagesizes="${get('sizes')}"${media ? ` media="${media}"` : ''}>`
  }).join('')
}

const sheets = new Map()
function quick(html) {
  html = html.replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/g, (_, href) => {
    if (!sheets.has(href)) sheets.set(href, fs.readFileSync(path.join(DIST, href), 'utf8'))
    return `<style data-from="${href}">${sheets.get(href)}</style>`
  })
  // after the viewport tag: before it, a phone still measures itself as a desktop and would pick the wide picture
  html = html.replace(/(<meta name="viewport"[^>]*>)/, (tag) => tag + first(html))
  const parts = []
  html = html.replace(/<link rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => { parts.push(href); return '' })
  const start = (app) => `<script>addEventListener('load',function(){setTimeout(function(){var d=document,h=d.head;${JSON.stringify(parts)}.forEach(function(p){var l=d.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=p;h.appendChild(l)});var s=d.createElement('script');s.type='module';s.crossOrigin='';s.src=${JSON.stringify(app)};h.appendChild(s)},0)})</script>`
  return html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (_, app) => start(app))
}

function draw(browser, address, profile) {
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions', `--user-data-dir=${profile}`,
    '--window-size=1350,940', '--virtual-time-budget=8000',
    // lib/prerender.js looks for this name: timers stay on their first frame and the API answers are kept in the page
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 TYM-Prerender',
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), // Chrome refuses its sandbox as root (containers, CI)
    '--dump-dom', address,
  ]
  return new Promise((resolve, reject) => {
    execFile(browser, args, { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 }, (error, out) => (error ? reject(error) : resolve(out)))
  })
}

async function main() {
  const shell = path.join(DIST, 'index.html')
  if (!fs.existsSync(shell)) throw new Error('dist/ is missing: run vite build first')
  // The empty app keeps its own file. (After a second run without a rebuild, index.html is already the built home page.)
  if (!fs.readFileSync(shell, 'utf8').includes('class="static"')) fs.copyFileSync(shell, path.join(DIST, 'app.html'))

  const browser = chrome()
  if (!browser) return console.warn('\nPages were not pre-built: Chrome was not found (set CHROME_PATH). The site works without it.\n')
  let list
  try {
    list = await addresses()
  } catch (e) {
    return console.warn(`\nPages were not pre-built: the API at ${API.origin} did not answer (${e.message}). Start it and build again. The site works without it.\n`)
  }

  const server = await serve()
  const local = `http://127.0.0.1:${server.address().port}`
  const profiles = fs.mkdtempSync(path.join(os.tmpdir(), 'tym-prerender-'))
  const built = []
  const queue = [...list]
  const worker = async (n) => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [address] = next
      try {
        let html = await draw(browser, local + address, path.join(profiles, String(n)))
        const drawn = html.includes('<main id="main">') && !html.includes('This page has already departed') && !html.includes('did not load properly')
        if (!drawn) { console.warn(`  skipped ${address}: it did not draw as a page`); continue }
        html = quick(html.replace('<html lang="en">', '<html lang="en" class="static">').replaceAll(local, SITE))
        if (!/^<!doctype/i.test(html)) html = `<!doctype html>\n${html}`
        const file = path.join(DIST, address === '/' ? '' : address, 'index.html')
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, html)
        built.push(next)
      } catch (e) {
        console.warn(`  skipped ${address}: ${String(e.message).split('\n')[0]}`)
      }
    }
  }
  await Promise.all(Array.from({ length: AT_ONCE }, (_, n) => worker(n)))
  server.close()
  fs.rmSync(profiles, { recursive: true, force: true })

  // The sitemap lists exactly what was built, so a new article is in it from its first deploy
  const urls = built.sort(([a], [b]) => a.localeCompare(b)).filter(([p]) => !['/login', '/register'].includes(p))
    .map(([p, changed]) => `  <url><loc>${SITE}${p === '/' ? '/' : p}</loc><lastmod>${changed}</lastmod></url>`)
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
  console.log(`\nPre-built ${built.length} of ${list.length} pages for ${SITE}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
