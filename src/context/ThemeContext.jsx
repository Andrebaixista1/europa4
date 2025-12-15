import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', '#171717')
  }, [])

  const toggleTheme = () => {
    setTheme('dark')
  }

  const value = useMemo(() => ({ theme: 'dark', toggleTheme }), [])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
