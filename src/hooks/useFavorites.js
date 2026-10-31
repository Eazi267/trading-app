import { preferencesAllowed } from '../utils/consent.js'
import { useCallback, useEffect, useState } from 'react'

// Two small "remember my choices" helpers for the phone UI.
// Both keep their data in this browser (localStorage) and never crash if
// storage is blocked: every read and write is wrapped in try/catch.

export const MAX_TABS = 4
export const MIN_TABS = 2
export const DEFAULT_TABS = ['/dashboard', '/markets', '/sessions', '/balance']
// Admins start with the pages they use most; each is dropped automatically if their admin tier can't open it.
export const ADMIN_DEFAULT_TABS = ['/dashboard', '/admin/users', '/admin/trading', '/transactions']

function readList(key) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

function writeList(key, list) {
  if (!preferencesAllowed()) return // only remembered with the person's permission (cookie settings)
  try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* ignore */ }
}

// Which pages sit in the phone bottom bar. `pages` is every page the person
// is allowed to see (so a page that is switched off later can't linger).
export function useFavoriteTabs(userId, pages, defaults = DEFAULT_TABS) {
  const key = 'pulse_fav_tabs_' + (userId ?? 'anon')
  const allowed = pages.map((p) => p.to)
  const sanitize = useCallback((list) => {
    const clean = (list || []).filter((to, i, arr) => allowed.includes(to) && arr.indexOf(to) === i).slice(0, MAX_TABS)
    return clean.length >= MIN_TABS ? clean : defaults.filter((to) => allowed.includes(to))
  }, [allowed.join('|'), defaults.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const [paths, setPaths] = useState(() => sanitize(readList(key)))
  useEffect(() => { setPaths(sanitize(readList(key))) }, [key, sanitize])

  const save = useCallback((next) => {
    const clean = sanitize(next)
    setPaths(clean)
    writeList(key, clean)
  }, [key, sanitize])

  const reset = useCallback(() => {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    setPaths(sanitize(null))
  }, [key, sanitize])

  return { paths, save, reset, isDefault: paths.join() === defaults.filter((to) => allowed.includes(to)).join() }
}

// Starred markets (e.g. "BTC/USD"), shown first on the Markets page.
export function useFavoriteMarkets() {
  const key = 'pulse_fav_markets'
  const [favs, setFavs] = useState(() => readList(key) || [])
  const toggle = useCallback((symbol) => {
    setFavs((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
      writeList(key, next)
      return next
    })
  }, [])
  return { favs, toggle }
}
