import { useCallback, useEffect, useState } from 'react'

// Thin fetch wrapper for the Flask API. Sends the signed-in session's token and renews it once
// when it has expired. Pages still on data/sample.js switch to this as their endpoints land.

const KEY = 'tym.session'

export const session = {
  get() {
    try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
  },
  set(value) {
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value))
      else localStorage.removeItem(KEY)
    } catch { /* private mode: the session lasts this tab only */ }
  },
}

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

export async function api(path, { method = 'GET', body } = {}) {
  const current = session.get()
  let { res, data } = await send(path, { method, body, token: current?.access })

  if (res.status === 401 && current?.refresh && path !== '/auth/refresh') {
    const renewed = await send('/auth/refresh', { method: 'POST', token: current.refresh })
    if (renewed.res.ok) {
      session.set({ ...current, access: renewed.data.access })
      ;({ res, data } = await send(path, { method, body, token: renewed.data.access }))
    }
  }

  if (!res.ok) {
    const message = data?.message || (res.status >= 500 || !data ? OFFLINE : `Request failed (${res.status})`)
    throw new ApiError(message, res.status, data)
  }
  return data
}

// Load one API resource into a component. reload() fetches it again (after a change).
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!path) return undefined
    let live = true
    setState((s) => ({ ...s, loading: true, error: null }))
    api(path)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }))
    return () => { live = false }
  }, [path, version])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
