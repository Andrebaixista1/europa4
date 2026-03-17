import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = 'http://85.31.61.242:8011/api'
const LOGIN_URL = `${API_BASE}/login`

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const unwrapSqlEnvelope = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  const first = rows[0]
  if (!first || typeof first !== 'object') return rows
  const jsonKey = Object.keys(first).find((key) => key.toUpperCase().startsWith('JSON_'))
  if (!jsonKey || typeof first[jsonKey] !== 'string') return rows
  try {
    const parsed = JSON.parse(first[jsonKey])
    return toArray(parsed)
  } catch {
    return rows
  }
}

const pickFirstFilled = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return '-'
}

export default function Perfil() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      if (!user?.id) {
        setProfile(null)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await fetch(LOGIN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id_user: user.id,
            id: user.id
          })
        })
        const rawText = await response.text()
        if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

        let payload = {}
        try {
          payload = rawText ? JSON.parse(rawText) : {}
        } catch {
          payload = {}
        }

        const rows = unwrapSqlEnvelope(toArray(payload))
        const first = rows[0] || {}
        if (!cancelled) setProfile(first)
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Falha ao carregar perfil.')
          setProfile(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const mergedProfile = useMemo(() => {
    const p = profile && typeof profile === 'object' ? profile : {}
    return {
      id: pickFirstFilled(p.id_user, p.id, user?.id),
      nome: pickFirstFilled(p.nome, p.name, user?.name, user?.nome),
      login: pickFirstFilled(p.login, p.usuario_login, user?.login),
      role: pickFirstFilled(p.role, user?.role),
      equipe: pickFirstFilled(p.equipe_nome, p.team_name, user?.equipe_nome, user?.team_name),
      ultimoAcesso: pickFirstFilled(p.data_ultimo_login, p.last_login_at, user?.data_ultimo_login, user?.lastLogin),
      status: pickFirstFilled(p.status_conta, p.status, user?.status_conta),
    }
  }, [profile, user])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Perfil</h2>
              <div className="opacity-75 small">Dados do usuario carregados de /api/login</div>
            </div>
          </div>
        </div>

        <section className="row g-3">
          <div className="col-12 col-xl-8">
            <div className="neo-card neo-lg p-4">
              {loading && <div className="small opacity-75">Carregando perfil...</div>}
              {!loading && error && <div className="alert alert-danger py-2 px-3 mb-0">{error}</div>}
              {!loading && !error && (
                <div className="table-responsive">
                  <table className="table table-dark table-sm align-middle mb-0">
                    <tbody>
                      <tr><th style={{ width: '220px' }}>ID</th><td>{mergedProfile.id}</td></tr>
                      <tr><th>Nome</th><td>{mergedProfile.nome}</td></tr>
                      <tr><th>Login</th><td>{mergedProfile.login}</td></tr>
                      <tr><th>Cargo</th><td>{mergedProfile.role}</td></tr>
                      <tr><th>Equipe</th><td>{mergedProfile.equipe}</td></tr>
                      <tr><th>Ultimo acesso</th><td>{mergedProfile.ultimoAcesso}</td></tr>
                      <tr><th>Status</th><td>{mergedProfile.status}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
