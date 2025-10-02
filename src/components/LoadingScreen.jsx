export default function LoadingScreen() {
  return (
    <div className="splash d-flex align-items-center justify-content-center">
      <div className="text-center">
        <div className="splash-logo-wrap mb-3">
          <img src="/neo-logo.svg" alt="Nova Europa" className="splash-logo" />
        </div>
        <div className="splash-pulse mx-auto" />
      </div>
    </div>
  )
}
