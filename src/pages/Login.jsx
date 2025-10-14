import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import { defaultRouteFor } from '../utils/roles.js'
import { notify } from '../utils/notify.js'
import { novidadesList } from '../components/NovidadesModal.jsx'

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

  // Typewriter: 3 primeiras novidades (ou fallback)
  const novidades = (() => {
    try {
      const arr = (novidadesList || []).slice(0, 3)
      const titles = arr.map((x) => x?.descricao).filter(Boolean)
      if (titles.length > 0) return titles
    } catch {}
    return [
      'Gestão de saldos e recargas, adicionado novo card para gestão de saldos e recargas.',
      'Cards Inteligentes, cards que pertencem a sua hierarquia, você só vê o que é relevante.',
      'Sistema de hierarquias de usuarios, cada usuario tem sua própria hierarquia de acesso.',
    ]
  })()

  const [twIndex, setTwIndex] = useState(0)
  const [twText, setTwText] = useState('')
  const [twPhase, setTwPhase] = useState('typing') // typing | pausing | deleting

  useEffect(() => {
    const full = novidades[twIndex % novidades.length] || ''
    let t
    if (twPhase === 'typing') {
      if (twText.length < full.length) t = setTimeout(() => setTwText(full.slice(0, twText.length + 1)), 50)
      else t = setTimeout(() => setTwPhase('pausing'), 900)
    } else if (twPhase === 'pausing') {
      t = setTimeout(() => setTwPhase('deleting'), 600)
    } else if (twPhase === 'deleting') {
      if (twText.length > 0) t = setTimeout(() => setTwText(twText.slice(0, -1)), 30)
      else { setTwIndex((i) => (i + 1) % novidades.length); setTwPhase('typing') }
    }
    return () => { if (t) clearTimeout(t) }
  }, [twText, twPhase, twIndex, novidades])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <div className="container flex-grow-1 d-flex align-items-center py-5">
        <div className="row w-100 g-4 align-items-center">
          <div className="col-lg-6">
            <h2 className="fw-bold gradient-text mb-3">Bem-vindo(a) ao Nova Europa 4</h2>
            <p className="opacity-75">
              <span className="me-2">Novidades:</span>
              <span>{twText}</span>
            </p>
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
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
