import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'qorlitog-theme'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
