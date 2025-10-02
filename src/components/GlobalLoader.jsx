import LoadingScreen from './LoadingScreen.jsx'
import { useLoading } from '../context/LoadingContext.jsx'

export default function GlobalLoader() {
  const { visible } = useLoading()
  if (!visible) return null
  return (
    <div className="global-loader-overlay">
      <LoadingScreen />
    </div>
  )
}

