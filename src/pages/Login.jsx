import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import { defaultRouteFor } from '../utils/roles.js'
import { notify } from '../utils/notify.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const loader = useLoading()
  const [showChange, setShowChange] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changeMsg, setChangeMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      loader.begin()
      const u = await login(email, password)
      const target = location.state?.from ? from : defaultRouteFor(u.role)
      notify.success(`Bem-vindo(a), ${u.name}!`)
      navigate(target, { replace: true })
    } catch (err) {
      const msg = err.message || 'Falha no login'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
      loader.end()
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setChangeMsg('')
    if (newPwd.length < 6) {
      const m = 'A nova senha deve ter pelo menos 6 caracteres.'
      setChangeMsg(m)
      notify.warn(m)
      return
    }
    if (newPwd !== confirmPwd) {
      const m = 'A confirmação não confere com a nova senha.'
      setChangeMsg(m)
      notify.warn(m)
      return
    }
    // Fluxo simulado (mock). Em produção, enviar para API.
    loader.showFor(700)
    const ok = 'Solicitação enviada! Em produção, verificaríamos a senha atual e enviaríamos uma confirmação para seu e-mail.'
    setChangeMsg(ok)
    notify.success('Solicitação de alteração de senha enviada')
    setTimeout(() => {
      setShowChange(false)
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    }, 900)
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <div className="container flex-grow-1 d-flex align-items-center py-5">
        <div className="row w-100 g-4 align-items-center">
          <div className="col-lg-6">
            <h2 className="fw-bold gradient-text mb-3">Bem-vindo(a) ao Nova Europa 4</h2>
            <p className="opacity-75">
              Acesse com um dos usuários mocados para testar a visão por hierarquia:
            </p>
            <ul className="small opacity-75 mb-0">
              <li>master@neo.com / 123456</li>
              <li>supervisor@neo.com / 123456</li>
              <li>operador@neo.com / 123456</li>
            </ul>
          </div>
          <div className="col-lg-5 ms-lg-auto">
            <form onSubmit={handleSubmit} className="neo-card p-4">
              <h5 className="mb-3">Entrar</h5>
              {error && (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Senha</label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <div className="d-flex justify-content-between mt-3">
                <button type="button" className="btn btn-link p-0" onClick={() => setShowChange(true)}>
                  Alterar senha
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal Alterar Senha */}
      {showChange && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Alterar senha</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowChange(false)}></button>
              </div>
              <form onSubmit={handleChangePassword}>
                <div className="modal-body">
                  {changeMsg && (
                    <div className="alert alert-info py-2" role="alert">{changeMsg}</div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">E-mail</label>
                    <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Senha atual</label>
                    <input type="password" className="form-control" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
                  </div>
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Nova senha</label>
                        <input type="password" className="form-control" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Confirmar nova senha</label>
                        <input type="password" className="form-control" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowChange(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

