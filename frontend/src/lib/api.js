import { useCallback, useEffect, useState } from 'react'
import { building, carried, carry } from './prerender'

// Thin fetch wrapper for the Flask API. Sends the signed-in session's token and renews it once
// when it has expired; a sign-in that cannot be renewed is dropped and the request goes again as a visitor. There are two sign-ins, each with its own client: members, and the admin panel.

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

const OFFLINE = 'We could not reach The Youth Matters. Check your connection and try again.'

async function send(path, { method, body, token }) {
  const isForm = body instanceof FormData
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(OFFLINE, 0, null)
  }
  return { res, data: await res.json().catch(() => null) }
}

function createClient(KEY, { pages = false } = {}) {
  // Kept here too, for browsers that will not store anything (site data blocked, some in-app
  // browsers): the sign-in then lasts until the tab closes instead of failing silently
  let memory = null
  const session = {
    get() {
      try { return JSON.parse(localStorage.getItem(KEY)) ?? memory } catch { return memory }
    },
    set(value) {
      memory = value || null
      try {
        if (value) localStorage.setItem(KEY, JSON.stringify(value))
        else localStorage.removeItem(KEY)
      } catch { /* the copy in memory above carries on */ }
    },
  }

  async function api(path, { method = 'GET', body } = {}) {
    const current = session.get()
    let { res, data } = await send(path, { method, body, token: current?.access })

    // 401: the token has expired or its account is gone. 422 with the token library's own "msg":
    // the token itself is not valid (the server's key changed). Any other 422 is about what was sent.
    if ((res.status === 401 || (res.status === 422 && data?.msg)) && current?.access) {
      const renewed = current.refresh ? await send('/auth/refresh', { method: 'POST', token: current.refresh }) : null
      if (renewed?.res.ok) {
        // Read it again: if they logged out while this was in flight, the old sign-in must not come back
        const now = session.get()
        if (now) session.set({ ...now, access: renewed.data.access })
        ;({ res, data } = await send(path, { method, body, token: renewed.data.access }))
      } else if (!renewed || [401, 422].includes(renewed.res.status)) {
        // The sign-in is over: it expired, or the account is gone. Carry on as a visitor,
        // so the pages anyone can read still load, and tell the app it is signed out.
        session.set(null)
        window.dispatchEvent(new Event(`${KEY}:ended`))
        ;({ res, data } = await send(path, { method, body }))
      }
    }

    if (!res.ok) {
      const message = data?.message || (res.status >= 500 || !data ? OFFLINE : `Request failed (${res.status})`)
      throw new ApiError(message, res.status, data)
    }
    if (pages && building && method === 'GET') carry(path, data)
    return data
  }

  // Load one API resource into a component. reload() fetches it again (after a change).
  // `of` is the path the data belongs to. A failed refresh keeps what is already on screen;
  // data for a different path is never shown as if it were this one's.
  function useApi(path) {
    const [state, setState] = useState(() => {
      const data = pages && path ? carried(path) : null // a page built ahead of time brings its answers
      return { data, error: null, loading: Boolean(path) && !data, of: path }
    })
    const [version, setVersion] = useState(0)
    useEffect(() => {
      if (!path) return undefined
      let live = true
      setState((s) => (s.of === path && s.data ? s : { ...s, loading: true, error: null }))
      api(path)
        .then((data) => live && setState({ data, error: null, loading: false, of: path }))
        .catch((error) => live && setState((s) => ({ data: s.of === path ? s.data : null, error, loading: false, of: path })))
      return () => { live = false }
    }, [path, version])
    const reload = useCallback(() => setVersion((v) => v + 1), [])
    return { ...state, reload }
  }

  return { session, api, useApi }
}

export const { session, api, useApi } = createClient('tym.session', { pages: true })
// The admin panel signs in separately, so a team member can use the site and the panel side by side
export const adminClient = createClient('tym.admin')
