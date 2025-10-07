﻿﻿﻿import { Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import NovidadesModal from './NovidadesModal.jsx'
import { notify } from '../utils/notify.js'
import { FiStar } from 'react-icons/fi'

export default function TopNav() {
  const { user, logout, isAuthenticated } = useAuth()
  const loader = useLoading()
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')
  const [isNovidadesModalOpen, setIsNovidadesModalOpen] = useState(false)
  const [recentPages, setRecentPages] = useState([])

  // Carrega recentPages ao montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ne_recent_pages')
      if (raw) setRecentPages(JSON.parse(raw))
    } catch {}
  }, [])

  // Limpa abas mockadas em reload (F5)
  useEffect(() => {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')
      const entry = Array.isArray(nav) ? nav[0] : null
      const isReload = entry ? entry.type === 'reload' : (performance && performance.navigation ? performance.navigation.type === 1 : false)
      if (isReload) {
        localStorage.removeItem('ne_recent_pages')
        setRecentPages([])
      }
    } catch {}
  }, [])

  // Atualiza recentPages a cada troca de rota (mock de abas recentes)
  useEffect(() => {
    if (!isAuthenticated) return
    const path = location.pathname
    if (path === '/' || path === '/login') return
    const titleMap = {
      '/dashboard': 'Dashboard',
      '/equipes': 'Equipes',
      '/usuarios': 'Usuários',
      '/consultas/in100': 'Consulta IN100',
      '/supervisao': 'Supervisão',
      '/operacao': 'Operação',
    }
    const label = titleMap[path] || path.split('/').filter(Boolean).map(s => (s.charAt(0).toUpperCase() + s.slice(1))).join(' / ')
    const now = Date.now()
    const prev = (() => { try { return JSON.parse(localStorage.getItem('ne_recent_pages')) || [] } catch { return [] } })()
    const filtered = prev.filter(p => p.path !== path)
    const next = [{ path, label, ts: now }, ...filtered].slice(0, 5)
    setRecentPages(next)
    try { localStorage.setItem('ne_recent_pages', JSON.stringify(next)) } catch {}
  }, [location.pathname, isAuthenticated])
  return (
    <nav className="navbar navbar-expand-lg navbar-dark glass-nav">
      <div className="container">
        <div className="d-flex align-items-center gap-3">
          <Link to="/" className="navbar-brand fw-semibold">
            <span className="d-inline-flex align-items-center gap-2">
              <img src="/neo-logo.svg" alt="Nova Europa 4" className="brand-logo" />
              <span>Nova Europa 4</span>
            </span>
          </Link>
          
          {/* Botão Novidades ao lado da logo */}
          <button 
            onClick={() => setIsNovidadesModalOpen(true)}
            className="btn btn-novidades d-flex align-items-center gap-2 p-2 rounded-2"
            style={{
              fontSize: '0.875rem',
              border: '1px solid #1E40AF',
              transition: 'transform 0.15s ease, filter 0.2s ease, border-color 0.2s ease',
              backgroundColor: '#2563EB',
              color: '#fff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB';
              e.currentTarget.style.borderColor = '#1E40AF';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB';
              e.currentTarget.style.borderColor = '#1E40AF';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FiStar size={14} className="opacity-75" />
            <span>Novidades</span>
          </button>
        </div>
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
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <Link to="/dashboard" className="nav-link">Dashboard</Link>
                </li>
              </>
            )}
          </ul>
          {isAuthenticated && recentPages.length > 0 && (
            <div className="d-none d-lg-flex align-items-center gap-2 me-3 flex-wrap" style={{ maxWidth: '50%' }}>
              {recentPages.map((p) => (
                <Link key={p.path} to={p.path} className="btn btn-outline-light btn-sm py-1 px-2" title={p.label}>
                  {p.label}
                </Link>
              ))}
            </div>
          )}
          <div className="d-flex align-items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <span className="text-light small opacity-75">{user?.name}</span>
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={() => {
                    loader.showFor(400)
                    try { localStorage.removeItem('ne_recent_pages') } catch {}
                    setRecentPages([])
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
      
      {/* Modal de Novidades */}
      <NovidadesModal 
        isOpen={isNovidadesModalOpen} 
        onClose={() => setIsNovidadesModalOpen(false)} 
      />
    </nav>
  )
}



