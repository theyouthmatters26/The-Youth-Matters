import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, session } from './api'

// `account` is whoever is signed in. `user` is only set once their identity check has passed,
// so everything members-only (gates, chatrooms, booking) keys off `user` and stays locked
// for half-finished sign-ups.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [account, setAccountState] = useState(() => session.get()?.user ?? null)

  const signIn = ({ access, refresh, user }) => {
    session.set({ access, refresh, user })
    setAccountState(user)
  }
  const setAccount = (user) => {
    const current = session.get()
    if (current) session.set({ ...current, user })
    setAccountState(user)
  }
  const logout = () => {
    session.set(null)
    // Half-written questions and mentor applications are not left for the next person on a shared computer
    try { localStorage.removeItem('tym.draft'); localStorage.removeItem('tym.mentorDraft') } catch { /* ignore */ }
    setAccountState(null)
  }

  // Pick up anything that changed elsewhere: a review approved by our team, a suspended account
  useEffect(() => {
    // lib/api.js says so when a sign-in can no longer be renewed
    const ended = () => setAccountState(null)
    window.addEventListener('tym.session:ended', ended)
    if (session.get()?.access) api('/auth/me').then(setAccount).catch((e) => [401, 403, 422].includes(e.status) && logout())
    return () => window.removeEventListener('tym.session:ended', ended)
  }, [])

  const user = account?.verification === 'verified' ? account : null
  return <AuthContext.Provider value={{ user, account, signIn, setAccount, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

// Where a half-finished account carries on: students show a photo ID, mentors send their application
// and wait for our team (api/serializers.py sets "mentor" until that decision).
export const resumePath = (account) => (account?.verification === 'mentor' ? '/mentors/register' : '/register')

// Wrap member-only routes. Visitors log in and come back; half-finished sign-ups finish first.
export function RequireAuth({ children }) {
  const { user, account } = useAuth()
  const location = useLocation()
  const from = location.pathname + location.search
  if (!account) return <Navigate to="/login" replace state={{ from }} />
  if (!user) return <Navigate to={resumePath(account)} replace state={{ from }} />
  return children
}

// For buttons that need a member (vote, save, reply): returns false and sends visitors to log in,
// or half-finished sign-ups to finish, coming back to this page afterwards.
export function useMemberGuard() {
  const { user, account } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (user) return true
    navigate(account ? resumePath(account) : '/login', { state: { from: location.pathname + location.search } })
    return false
  }
}
