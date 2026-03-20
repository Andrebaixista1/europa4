import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import { defaultRouteFor } from '../utils/roles.js'
import { notify } from '../utils/notify.js'
import { AUTH_ENDPOINTS } from '../config/endpoints.js'
import { fetchText } from '../services/httpClient.js'


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
  const [recoverOpen, setRecoverOpen] = useState(false)
  const [recoverLogin, setRecoverLogin] = useState('')
  const [recoverWhatsapp, setRecoverWhatsapp] = useState('')
  const [recovering, setRecovering] = useState(false)
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

  const openRecoverModal = () => {
    setRecoverLogin(login || '')
    setRecoverWhatsapp('')
    setRecoverOpen(true)
  }

  const closeRecoverModal = () => {
    if (recovering) return
    setRecoverOpen(false)
  }

  const handleRecoverPassword = async (e) => {
    e.preventDefault()
    const normalizedLogin = String(recoverLogin || '').trim()
    const normalizedPhone = String(recoverWhatsapp || '').replace(/\D/g, '')

    if (!normalizedLogin || !normalizedPhone) {
      notify.warn('Informe o login e o WhatsApp para recuperar a senha.')
      return
    }

    setRecovering(true)
    try {
      await fetchText(AUTH_ENDPOINTS.reset, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: normalizedLogin,
          username: normalizedLogin,
          usuario: normalizedLogin,
          telefone: normalizedPhone,
          phone: normalizedPhone,
          whatsapp: normalizedPhone,
        }),
      })

      setRecoverOpen(false)
      notify.success('Solicitação enviada. Em instantes você receberá a nova senha no WhatsApp cadastrado.')
    } catch (err) {
      notify.error(err?.message || 'Não foi possível solicitar a recuperação de senha.')
    } finally {
      setRecovering(false)
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
                className="btn btn-link w-100 mt-2 text-decoration-none"
                onClick={openRecoverModal}
                disabled={loading}
              >
                Recuperar senha
              </button>
            </form>
          </div>
        </div>
      </div>

      {recoverOpen && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content neo-card border-0">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title">Recuperar senha</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeRecoverModal}
                    aria-label="Fechar"
                    disabled={recovering}
                  />
                </div>
                <form onSubmit={handleRecoverPassword}>
                  <div className="modal-body pt-2">
                    <p className="text-muted mb-3">
                      Informe seu login e WhatsApp. Vamos enviar uma nova senha para acesso.
                    </p>
                    <div className="mb-3">
                      <label className="form-label">Login</label>
                      <input
                        type="text"
                        className="form-control"
                        value={recoverLogin}
                        onChange={(e) => setRecoverLogin(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">WhatsApp</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: 11980733602"
                        value={recoverWhatsapp}
                        onChange={(e) => setRecoverWhatsapp(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={closeRecoverModal}
                      disabled={recovering}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={recovering}>
                      {recovering ? 'Enviando...' : 'Enviar recuperação'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeRecoverModal} />
        </>
      )}
    </div>
  )
}
