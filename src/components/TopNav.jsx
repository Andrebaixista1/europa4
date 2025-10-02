import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { notify } from '../utils/notify.js'

export default function TopNav() {
  const { user, logout, isAuthenticated } = useAuth()
  const loader = useLoading()
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')
  return (
    <nav className="navbar navbar-expand-lg navbar-dark glass-nav">
      <div className="container">
        <Link to="/" className="navbar-brand fw-semibold">
          <span className="d-inline-flex align-items-center gap-2">
            <img src="/neo-logo.svg" alt="Nova Europa 4" className="brand-logo" />
            <span>Nova Europa 4</span>
          </span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarsExample"
          aria-controls="navbarsExample"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarsExample">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link to="/" className="nav-link">Início</Link>
            </li>
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <Link to="/dashboard" className="nav-link">Dashboard</Link>
                </li>
              </>
            )}
          </ul>
          <div className="d-flex align-items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <span className="text-light small opacity-75">{user?.name}</span>
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={() => {
                    loader.showFor(400)
                    logout()
                    notify.info('Sessão encerrada')
                  }}
                >
                  Sair
                </button>
              </>
            ) : (
              !isDashboard && (
                <Link to="/login" className="btn btn-primary btn-sm">Entrar</Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
