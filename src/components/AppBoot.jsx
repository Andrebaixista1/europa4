import { useEffect, useState } from 'react'
import LoadingScreen from './LoadingScreen.jsx'

export default function AppBoot({ children }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <LoadingScreen />
  return children
}

