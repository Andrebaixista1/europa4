import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLoading } from '../context/LoadingContext.jsx'

export default function RouteChangeLoader() {
  const { pathname } = useLocation()
  const { showFor } = useLoading()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    showFor(500)
  }, [pathname])

  return null
}

