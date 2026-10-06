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
    setAccountState(null)
  }

  // Pick up anything that changed elsewhere: a review approved by our team, a suspended account
  useEffect(() => {
    if (!session.get()?.access) return
    api('/auth/me').then(setAccount).catch((e) => [401, 403, 422].includes(e.status) && logout())
  }, [])

  const user = account?.verification === 'verified' ? account : null
  return <AuthContext.Provider value={{ user, account, signIn, setAccount, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

// Wrap member-only routes. Visitors log in and come back; half-finished sign-ups finish first.
export function RequireAuth({ children }) {
  const { user, account } = useAuth()
  const location = useLocation()
  const from = location.pathname + location.search
  if (!account) return <Navigate to="/login" replace state={{ from }} />
  if (!user) return <Navigate to="/register" replace state={{ from }} />
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
    navigate(account ? '/register' : '/login', { state: { from: location.pathname + location.search } })
    return false
  }
}
