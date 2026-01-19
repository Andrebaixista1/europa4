import { useLoading } from '../context/LoadingContext.jsx'
import { useLoadingMessages } from '../hooks/useLoadingMessages.js'

export default function GlobalLoader() {
  const { visible } = useLoading()
  const step = useLoadingMessages()
  if (!visible) return null
  return (
    <div className="global-loader-overlay" aria-hidden="true" role="status" aria-live="polite">
      <div>
        <div className="splash-logo-wrap">
          <img src="/neo-logo.svg" alt="Carregando..." className="splash-logo" />
        </div>
        <div className="splash-pulse" style={{ width: 96, margin: '12px auto 0' }} />
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.82)', letterSpacing: 0.2, fontWeight: 600, textAlign: 'center' }}>
          {step}
        </div>
      </div>
    </div>
  )
}
