import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import { defaultRouteFor } from '../utils/roles.js'
import { notify } from '../utils/notify.js'
import { fetchN8n } from '../services/n8nClient.js'

export default function Login() {
  const { login: doLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetPhone, setResetPhone] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const loader = useLoading()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      loader.begin()
      const u = await doLogin(login, password)
      if (remember) {
        localStorage.setItem('ne_login_saved', JSON.stringify({ login, password, remember: true }))
      } else {
        localStorage.removeItem('ne_login_saved')
      }
      const target = location.state?.from ? from : defaultRouteFor(u.role)
      notify.success(`Bem-vindo(a), ${u.name}!`)
      navigate(target, { replace: true })
    } catch (err) {
      const msg = err?.message || 'Falha no login'
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
      loader.end()
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ne_login_saved')
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved?.login) setLogin(saved.login)
        if (saved?.password) setPassword(saved.password)
        if (saved?.remember) setRemember(!!saved.remember)
      }
    } catch {}
  }, [])

  const closeResetModal = () => {
    if (resetLoading) return
    setShowResetModal(false)
    setResetUsername('')
    setResetPhone('')
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()

    const username = resetUsername.trim()
    const phone = resetPhone.trim()

    if (!username || !phone) {
      notify.warn('Informe o nome de usuário e o WhatsApp para continuar.')
      return
    }

    setResetLoading(true)

    try {
      const response = await fetchN8n('/api/reset', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: username,
          username,
          usuario: username,
          telefone: phone,
          phone,
          whatsapp: phone,
        }),
      })

      if (!response.ok) {
        const message = await response.text().catch(() => '')
        throw new Error(message || 'Não foi possível solicitar a recuperação de senha.')
      }

      notify.success('Solicitação enviada. Se os dados informados estiverem corretos, você receberá em breve uma nova senha no WhatsApp cadastrado.')
      closeResetModal()
    } catch (err) {
      notify.error(err?.message || 'Não foi possível solicitar a recuperação de senha.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <div className="container flex-grow-1 d-flex align-items-center py-5">
        <div className="row w-100 g-4 align-items-center">
          <div className="col-lg-6">
            <h2 className="fw-bold gradient-text mb-3">Bem-vindo(a) ao Nova Europa 4</h2>
          </div>
          <div className="col-lg-5 ms-lg-auto">
            <form onSubmit={handleSubmit} className="neo-card p-4">
              <h5 className="mb-3">Entrar</h5>
              {error && (<div className="alert alert-danger py-2" role="alert">{error}</div>)}
              <div className="mb-3">
                <label className="form-label">Login</label>
                <input type="text" className="form-control" value={login} onChange={(e) => setLogin(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Senha</label>
                <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="rememberCheck" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <label className="form-check-label" htmlFor="rememberCheck">Lembrar login e senha</label>
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <button
                type="button"
                className="btn btn-link w-100 mt-3 p-0 text-decoration-none"
                onClick={() => setShowResetModal(true)}
              >
                Esqueci minha senha
              </button>
            </form>
          </div>
        </div>
      </div>

      {showResetModal ? (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050 }}
          role="dialog"
          aria-modal="true"
          onClick={closeResetModal}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <form className="modal-content modal-dark" onSubmit={handleResetPassword}>
              <div className="modal-header">
                <h5 className="modal-title">Recuperar senha</h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={closeResetModal} disabled={resetLoading} />
              </div>
              <div className="modal-body">
                <p className="modal-dark-subtitle mb-3">
                  Informe seu nome de usuário e o WhatsApp cadastrado para solicitar o envio de uma nova senha.
                </p>
                <div className="mb-3">
                  <label className="form-label">Nome de usuário</label>
                  <input
                    type="text"
                    className="form-control"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="Digite seu usuário"
                    disabled={resetLoading}
                    required
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">WhatsApp</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={resetPhone}
                    onChange={(e) => setResetPhone(e.target.value)}
                    placeholder="Digite o número com DDD"
                    disabled={resetLoading}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={closeResetModal} disabled={resetLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                  {resetLoading ? 'Enviando...' : 'Solicitar nova senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
