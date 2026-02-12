import { useLoadingMessages } from '../hooks/useLoadingMessages.js'

export default function LoadingScreen() {
  const step = useLoadingMessages()

  return (
    <div className="splash d-flex align-items-center justify-content-center">
      <div className="text-center">
        <div className="splash-logo-wrap mb-3">
          <img src="/neo-logo.svg" alt="Nova Europa" className="splash-logo" />
        </div>
        <div className="splash-pulse mx-auto" />
        <div className="splash-step-text mt-3">
          {step}
        </div>
      </div>
    </div>
  )
}
