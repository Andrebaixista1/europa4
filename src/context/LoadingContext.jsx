import { createContext, useContext, useMemo, useRef, useState } from 'react'

const LoadingContext = createContext(null)

export function LoadingProvider({ children }) {
  const [visible, setVisible] = useState(false)
  const counter = useRef(0)

  const begin = () => {
    counter.current += 1
    setVisible(true)
  }
  const end = () => {
    counter.current = Math.max(0, counter.current - 1)
    if (counter.current === 0) setVisible(false)
  }
  const showFor = (ms = 500) => {
    begin()
    setTimeout(end, ms)
  }

  const value = useMemo(() => ({ visible, begin, end, showFor }), [visible])
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
}

export function useLoading() {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider')
  return ctx
}

