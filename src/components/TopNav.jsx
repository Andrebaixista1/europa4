import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import NovidadesModal from './NovidadesModal.jsx'
import { notify } from '../utils/notify.js'
import { FiStar, FiKey, FiEye, FiEyeOff, FiTrash2, FiBarChart2, FiActivity } from 'react-icons/fi'

export default function TopNav() {
  const { user, logout, isAuthenticated } = useAuth()
  const loader = useLoading()
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')
  const [isNovidadesModalOpen, setIsNovidadesModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  // Indicador de saÃºde do Status (maioria)
  const [statusMajor, setStatusMajor] = useState(null) // 'ok' | 'lenta' | 'falha' | null
  useEffect(() => {
    let abort = false
    const parseLatencyMs = (item) => {
      if (typeof item?.latencyMs === 'number') return item.latencyMs
      if (typeof item?.latency === 'string') {
        const n = parseFloat(String(item.latency).replace(',', '.'))
        return isFinite(n) ? n : null
      }
      if (typeof item?.ms === 'number') return item.ms
      if (typeof item?.timeMs === 'number') return item.timeMs
      return null
    }
    const classifyLatency = (ms) => {
      if (ms == null || !isFinite(ms) || ms === Infinity) return 'falha'
      return ms > 500 ? 'lenta' : 'ok'
    }
    const load = async () => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        const res = await fetch('https://webhook.sistemavieira.com.br/webhook/status-workflows', { method: 'GET', signal: controller.signal })
        clearTimeout(timeout)
        let data = null
        try { data = await res.json() } catch {}
        let normal = 0, lenta = 0, falha = 0
        if (Array.isArray(data)) {
          for (const it of data) {
            const ms = parseLatencyMs(it)
            const s = classifyLatency(ms)
            if (s === 'ok') normal++
            else if (s === 'lenta') lenta++
            else falha++
          }
        }
        // desempate por severidade: falha > lenta > ok
        let m = 'ok', mv = normal
        if (lenta >= mv) { m = 'lenta'; mv = lenta }
        if (falha >= mv) { m = 'falha'; mv = falha }
        if (!abort) setStatusMajor(m)
      } catch (_) { if (!abort) setStatusMajor(null) }
    }
    load()
    const id = setInterval(load, 180000)
    return () => { abort = true; clearInterval(id) }
  }, [])


  // Abre o modal de novidades automaticamente apÃ³s o login (quando o user muda de null para objeto)
  useEffect(() => {
    if (user && isDashboard) {
      const loginTime = user.loginTime
      const now = new Date().toISOString()
      // Se o login foi feito hÃ¡ menos de 2 segundos, mostra o modal
      if (loginTime && (new Date(now) - new Date(loginTime)) < 2000) {
        setIsNovidadesModalOpen(true)
      }
    }
  }, [user, isDashboard])

  const resetPasswordState = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
  }

  const openPasswordModal = () => {
    resetPasswordState()
    setIsPasswordModalOpen(true)
  }

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false)
    resetPasswordState()
    setChangingPassword(false)
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (!user?.id) {
      notify.error('UsuÃ¡rio invÃ¡lido para atualizaÃ§Ã£o de senha.')
      return
    }

    const senhaAtual = currentPassword.trim()
    const senhaNova = newPassword.trim()
    const confirmacao = confirmPassword.trim()

    if (!senhaAtual || !senhaNova || !confirmacao) {
      notify.warn('Preencha todos os campos obrigatÃ³rios.')
      return
    }

    if (senhaNova.length < 4) {
      notify.warn('A nova senha deve ter pelo menos 4 caracteres.')
      return
    }

    if (senhaNova !== confirmacao) {
      notify.warn('As senhas nÃ£o coincidem.')
      return
    }

    try {
      setChangingPassword(true)
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/alter-pass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: user.id,
          senha_nova: senhaNova,
          senha_atual: senhaAtual,
          confirmacao
        })
      })

      const rawBody = await response.text()
      if (!response.ok) {
        const message = (rawBody || '').trim() || `Erro ${response.status}`
        throw new Error(message)
      }

      let successMessage = 'Senha atualizada com sucesso.'
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody)
          const apiMessage = parsed?.mensagem ?? parsed?.message ?? parsed?.status
          if (typeof apiMessage === 'string' && apiMessage.trim()) successMessage = apiMessage.trim()
        } catch (_) {
          if (rawBody.trim()) successMessage = rawBody.trim()
        }
      }

      notify.success(successMessage)
      closePasswordModal()
    } catch (error) {
      console.error('Erro ao alterar senha (self):', error)
      notify.error(`Erro ao alterar senha: ${error.message}`)
      setChangingPassword(false)
    }
  }

  return (
    <>
    <nav className="navbar navbar-expand-lg navbar-dark glass-nav">
      <div className="container">
        <div className="d-flex align-items-center gap-3">
          <Link to="/" className="navbar-brand fw-semibold">
            <span className="d-inline-flex align-items-center gap-2">
              <img src="/neo-logo.svg" alt="Nova Europa 4" className="brand-logo" />
              <span>Nova Europa 4</span>
            </span>
          </Link>
          
          {/* BotÃ£o Novidades ao lado da logo */}
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
                  <Link to="/dashboard" className="nav-link d-inline-flex align-items-center gap-2">
                    <FiBarChart2 />
                    <span>Dashboard</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/status" className="nav-link d-inline-flex align-items-center gap-2">
                    <span className="position-relative d-inline-flex" style={{ width: 18, height: 18 }}>
                      <FiActivity />
                      <span className="status-dot" aria-hidden="true" style={{ position: "absolute", right: -2, top: -2, width: 8, height: 8, borderRadius: 999, border: "1px solid rgba(0,0,0,0.35)", background: (statusMajor === "falha" ? "var(--danger)" : statusMajor === "lenta" ? "var(--warning)" : statusMajor === "ok" ? "var(--success)" : "rgba(255,255,255,0.35)") }}></span>
                    </span>
                    <span>Status</span>
                  </Link>
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
                  type="button"
                  className="btn btn-outline-warning btn-sm"
                  title="Alterar senha"
                  aria-label="Alterar senha"
                  onClick={openPasswordModal}
                  disabled={changingPassword}
                >
                  <FiKey />
                </button>
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={() => {
                    loader.showFor(400)
                    logout()
                    notify.info('SessÃ£o encerrada')
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
    {/* Modal de Novidades */}
    <NovidadesModal 
      isOpen={isNovidadesModalOpen} 
      onClose={() => setIsNovidadesModalOpen(false)} 
    />
    {isAuthenticated && isPasswordModalOpen && (
      <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050 }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Alterar senha</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closePasswordModal} disabled={changingPassword}></button>
              </div>
              <form onSubmit={handlePasswordSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Senha atual *</label>
                    <div className="input-group">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        className="form-control"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={changingPassword}
                        placeholder="Digite a senha atual"
                        minLength={4}
                        required
                      />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCurrent((prev) => !prev)} disabled={changingPassword}>
                        {showCurrent ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nova senha *</label>
                    <div className="input-group">
                      <input
                        type={showNew ? 'text' : 'password'}
                        className="form-control"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={changingPassword}
                        placeholder="Digite a nova senha"
                        minLength={4}
                        required
                      />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setShowNew((prev) => !prev)} disabled={changingPassword}>
                        {showNew ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Confirmar senha *</label>
                    <input
                      type={showNew ? 'text' : 'password'}
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={changingPassword}
                      placeholder="Repita a nova senha"
                      minLength={4}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closePasswordModal} disabled={changingPassword}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={changingPassword || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}>
                    {changingPassword ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Salvando...
                      </>
                    ) : (
                      'Atualizar'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
