import { useLoading } from '../context/LoadingContext.jsx'

export default function GlobalLoader() {
  const { visible } = useLoading()
  if (!visible) return null
  return (
    <div className="global-loader-overlay" aria-hidden="true" role="status" aria-live="polite">
      <div>
        <div className="splash-logo-wrap">
          <img src="/neo-logo.svg" alt="Carregando..." className="splash-logo" />
        </div>
        <div className="splash-pulse" style={{ width: 96, margin: '12px auto 0' }} />
      </div>
    </div>
  )
}
