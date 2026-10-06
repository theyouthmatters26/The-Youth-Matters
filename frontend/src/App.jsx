import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/layout/Footer'
import Header from './components/layout/Header'
import { RequireAuth, useAuth } from './lib/auth'
import AiLounge from './pages/AiLounge'
import Ask from './pages/Ask'
import BlogPost from './pages/BlogPost'
import Blogs from './pages/Blogs'
import Chatrooms from './pages/Chatrooms'
import Community from './pages/Community'
import CommunityHub from './pages/CommunityHub'
import Home from './pages/Home'
import MentorProfile from './pages/MentorProfile'
import Mentors from './pages/Mentors'
import NotFound from './pages/NotFound'
import Notifications from './pages/Notifications'
import PostDetail from './pages/PostDetail'
import Profile from './pages/Profile'
import Search from './pages/Search'
import ForgotPassword from './pages/auth/ForgotPassword'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import About from './pages/static/About'
import CaseStudies from './pages/static/CaseStudies'
import Contact from './pages/static/Contact'
import Faq from './pages/static/Faq'
import Features from './pages/static/Features'
import MentorApply from './pages/static/MentorApply'
import StaticPage, { STATIC_PATHS } from './pages/static/StaticPage'

// On every route: scroll to top, then let [data-reveal] blocks settle in as they enter the viewport.
function PageEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-revealed')
          io.unobserve(e.target)
        }
      }
    }, { rootMargin: '0px 0px -10% 0px' })
    const raf = requestAnimationFrame(() =>
      document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach((el) => io.observe(el)))
    return () => { cancelAnimationFrame(raf); io.disconnect() }
  }, [pathname])
  return null
}

// "My TYM" in the header: the member's own profile for now (the full personal area is Phase 2).
function MyTym() {
  const { user } = useAuth()
  const { search } = useLocation()
  return <Navigate to={user ? `/u/${user.username}${search}` : '/login'} replace />
}

export default function App() {
  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <PageEffects />
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/community" element={<CommunityHub />} />
          <Route path="/c/:slug" element={<Community />} />
          <Route path="/p/:id" element={<PostDetail />} />
          <Route path="/ask" element={<RequireAuth><Ask /></RequireAuth>} />
          <Route path="/search" element={<Search />} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/my" element={<MyTym />} />

          <Route path="/chat" element={<RequireAuth><Chatrooms /></RequireAuth>} />
          <Route path="/chat/:room" element={<RequireAuth><Chatrooms /></RequireAuth>} />
          <Route path="/ai" element={<RequireAuth><AiLounge /></RequireAuth>} />
          <Route path="/mentors" element={<Mentors />} />
          <Route path="/mentors/:id" element={<MentorProfile />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blogs/:slug" element={<BlogPost />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/case-studies" element={<CaseStudies />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/mentors/register" element={<MentorApply />} />
          {STATIC_PATHS.map((p) => <Route key={p} path={p} element={<StaticPage />} />)}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
