import { Component, Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, matchPath, useLocation } from 'react-router-dom'
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import { RequireAuth } from './lib/auth'

// A page whose code is downloaded when it is first opened, so nobody downloads the whole site to read
// one article. load() fetches it ahead of rendering: main.jsx does that for the page being opened, so
// the first render already has it and a page built ahead of time is never replaced by an empty one.
function page(load) {
  let Ready = null
  const fetched = () => load().then((m) => { Ready = m.default; return m })
  const Lazy = lazy(fetched)
  const Page = (props) => (Ready ? <Ready {...props} /> : <Lazy {...props} />)
  Page.load = fetched
  return Page
}

// The admin panel is its own bundle, with its own sign-in and no site header or footer.
// Members never download it.
const AdminApp = page(() => import('./pages/admin/AdminApp'))

// path, page, members only
const ROUTES = [
  ['/', page(() => import('./pages/Home'))],
  ['/community', page(() => import('./pages/CommunityHub'))],
  ['/c/:slug', page(() => import('./pages/Community'))],
  ['/p/:id', page(() => import('./pages/PostDetail'))],
  ['/ask', page(() => import('./pages/Ask')), true],
  ['/search', page(() => import('./pages/Search'))],
  ['/notifications', page(() => import('./pages/Notifications')), true],
  ['/u/:username', page(() => import('./pages/Profile'))],
  ['/my', page(() => import('./pages/Dashboard')), true],
  ['/settings', page(() => import('./pages/Settings')), true],

  ['/chat', page(() => import('./pages/Chatrooms')), true],
  ['/chat/:room', page(() => import('./pages/Chatrooms')), true],
  ['/ai', page(() => import('./pages/AiLounge')), true],
  ['/mentors', page(() => import('./pages/Mentors'))],
  ['/mentors/register', page(() => import('./pages/static/MentorApply'))],
  // Mentors have their own way in: the same two pages, without the photo-ID step (pages/auth)
  ['/mentors/signup', page(() => import('./pages/auth/Register'))],
  ['/mentors/login', page(() => import('./pages/auth/Login'))],
  ['/mentors/:id', page(() => import('./pages/MentorProfile'))],
  ['/blogs', page(() => import('./pages/Blogs'))],
  ['/blogs/:slug', page(() => import('./pages/BlogPost'))],

  ['/login', page(() => import('./pages/auth/Login'))],
  ['/register', page(() => import('./pages/auth/Register'))],
  ['/forgot-password', page(() => import('./pages/auth/ForgotPassword'))],

  ['/about', page(() => import('./pages/static/About'))],
  ['/features', page(() => import('./pages/static/Features'))],
  ['/faq', page(() => import('./pages/static/Faq'))],
  ['/case-studies', page(() => import('./pages/static/CaseStudies'))],
  ['/contact', page(() => import('./pages/static/Contact'))],
  ['/:page', page(() => import('./pages/static/StaticPage'))], // terms, privacy and the other footer pages
  ['*', page(() => import('./pages/NotFound'))],
]

const isAdmin = (pathname) => pathname === '/admin' || pathname.startsWith('/admin/')

// Fetch the code for the page at this address. Resolves either way: a page that fails to download
// is reported by the error screen below when it renders.
export function loadPage(pathname) {
  const found = isAdmin(pathname) ? AdminApp : ROUTES.find(([path]) => matchPath({ path, end: true }, pathname))?.[1]
  return Promise.resolve(found?.load()).catch(() => {})
}

// One broken page must not take the whole site down with it. Also what shows when a page's code will
// not download: after a new release, a tab left open asks for a file that is no longer there.
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.where !== this.props.where) this.setState({ error: null }) // moved on: try the next page
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="container page narrow" role="alert">
        <p className="eyebrow">A short delay</p>
        <h1 className="error-title">This page did not load properly.</h1>
        <p className="muted error-text">Reloading usually fixes it. If it keeps happening, write to support@theyouthmatters.com.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>
      </div>
    )
  }
}

// On every route: scroll to top, then let [data-reveal] blocks settle in as they enter the viewport.
let landed = false
function PageEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    const root = document.documentElement
    // A page built ahead of time shows everything at once (html.static in base.css). That only holds
    // for the page they arrived on.
    if (landed) root.classList.remove('static')
    landed = true
    window.scrollTo({ top: 0, behavior: 'instant' })
    const io = new IntersectionObserver((entries) => {
      const arriving = root.classList.contains('static')
      for (const e of entries) {
        // On arrival everything already on screen counts, right down to the bottom edge: it is
        // visible now and must not blink out to fade back in
        if (e.isIntersecting || (arriving && e.boundingClientRect.top < window.innerHeight)) {
          e.target.classList.add('is-revealed')
          io.unobserve(e.target)
        }
      }
      root.classList.remove('static')
    }, { rootMargin: '0px 0px -10% 0px' })
    const watch = () => document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach((el) => io.observe(el))
    const raf = requestAnimationFrame(watch)
    // Sections that arrive once their data has loaded (the blog, an article) join in as they are added
    const added = new MutationObserver(watch)
    added.observe(document.body, { childList: true, subtree: true })
    return () => { cancelAnimationFrame(raf); io.disconnect(); added.disconnect() }
  }, [pathname])
  return null
}

export default function App() {
  const { pathname, search, hash } = useLocation()
  // /terms/ is /terms: one address per page, for visitors and for search engines
  if (pathname.length > 1 && pathname.endsWith('/')) return <Navigate to={pathname.replace(/\/+$/, '') + search + hash} replace />
  if (isAdmin(pathname)) {
    return <ErrorBoundary where="admin"><Suspense fallback={null}><AdminApp /></Suspense></ErrorBoundary>
  }
  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <PageEffects />
      <Header />
      <main id="main">
        <ErrorBoundary where={pathname}>
          <Suspense fallback={<div className="page-wait" />}>
            <Routes>
              {ROUTES.map(([path, Page, members]) => (
                <Route key={path} path={path} element={members ? <RequireAuth><Page /></RequireAuth> : <Page />} />
              ))}
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
