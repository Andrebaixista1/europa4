import { useEffect, useState } from 'react'

import { useLocation, useNavigate } from 'react-router-dom'

import TopNav from '../components/TopNav.jsx'

import { useAuth } from '../context/AuthContext.jsx'

import { useLoading } from '../context/LoadingContext.jsx'

import { defaultRouteFor } from '../utils/roles.js'

import { notify } from '../utils/notify.js'

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

      const msg = err.message || 'Falha no login'

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

  return (


    <div className="bg-deep text-light min-vh-100 d-flex flex-column">

      <TopNav />

      <div className="container flex-grow-1 d-flex align-items-center py-5">

        <div className="row w-100 g-4 align-items-center">

          <div className="col-lg-6">

            <h2 className="fw-bold gradient-text mb-3">Bem-vindo(a) ao Nova Europa 4</h2>

            <p className="opacity-75">Faça login com suas credenciais.</p>

          </div>

          <div className="col-lg-5 ms-lg-auto">

            <form onSubmit={handleSubmit} className="neo-card p-4">

              <h5 className="mb-3">Entrar</h5>

              {error && (



                <div className="alert alert-danger py-2" role="alert">{error}</div>

              )}

              <div className="mb-3">

                <label className="form-label">Login</label>

                <input

                  type="text"

                  className="form-control"

                  value={login}

                  onChange={(e) => setLogin(e.target.value)}

                  placeholder=""

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

                  placeholder=""

                  required

                />

              </div>

              <div className="form-check mb-3">

                <input className="form-check-input" type="checkbox" id="rememberCheck"

                       checked={remember} onChange={(e) => setRemember(e.target.checked)} />

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
