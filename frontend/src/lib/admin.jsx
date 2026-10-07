import { createContext, useContext, useEffect, useState } from 'react'
import { adminClient } from './api'

// The admin panel's own sign-in, kept apart from the member session (see lib/api.js).
// `admin.access` lists the parts of the panel this person may open; the server checks it on every call.
const AdminContext = createContext(null)

export const adminApi = adminClient.api
export const useAdminApi = adminClient.useApi

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(() => adminClient.session.get()?.admin ?? null)

  const signIn = ({ access, refresh, admin: who }) => {
    adminClient.session.set({ access, refresh, admin: who })
    setAdmin(who)
  }
  const signOut = () => {
    adminClient.session.set(null)
    setAdmin(null)
  }
  const update = (who) => {
    adminClient.session.set({ ...adminClient.session.get(), admin: who })
    setAdmin(who)
  }

  // Pick up changes made elsewhere: access widened or narrowed, or the person removed from the team
  useEffect(() => {
    const ended = () => setAdmin(null)
    window.addEventListener('tym.admin:ended', ended)
    if (adminClient.session.get()?.access) adminApi('/admin/me').then(update).catch((e) => [401, 403, 422].includes(e.status) && signOut())
    return () => window.removeEventListener('tym.admin:ended', ended)
  }, [])

  const can = (area) => Boolean(admin?.access.includes(area))
  return <AdminContext.Provider value={{ admin, can, signIn, signOut, update }}>{children}</AdminContext.Provider>
}

export const useAdmin = () => useContext(AdminContext)

// Save an export (members or payments as a spreadsheet) to the person's computer
export async function downloadAdminFile(path, filename) {
  await adminApi('/admin/me') // renews the token first if it has expired
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${adminClient.session.get().access}` } })
  if (!res.ok) throw new Error('We could not make that file.')
  const url = URL.createObjectURL(await res.blob())
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // straight away can cancel the download
}

// Private files (a mentor's CV or proof of study) need the admin's token, so a plain link will not do.
// Opens the file in a new tab; with cloud storage the server answers with a short-lived link instead.
export async function openAdminFile(path) {
  // The tab opens now, during the click: Safari refuses one opened after waiting for the file.
  // A window we keep a handle to cannot be opened with noopener, so its opener is cleared by hand.
  const tab = window.open('', '_blank')
  if (!tab) throw new Error('Your browser blocked the new tab. Allow pop-ups for this site and try again.')
  tab.opener = null
  try {
    await adminApi('/admin/me') // renews the token first if it has expired
    const res = await fetch(`/api${path}?link=1`, { headers: { Authorization: `Bearer ${adminClient.session.get().access}` } })
    if (!res.ok) throw new Error('We could not open that file.')
    tab.location.href = res.headers.get('content-type')?.includes('json') ? (await res.json()).url : URL.createObjectURL(await res.blob())
  } catch (err) {
    tab.close()
    throw err
  }
}
