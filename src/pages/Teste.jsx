import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiCheckCircle, FiShield } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = 'http://85.31.61.242:8011/api'
const PERMISSOES2_URL = `${API_BASE}/permissoes2`

const parseJson = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

const getAllowedPermissions = (role) => {
  const all = parseJson(role?.permissoes_sistema_json)
  return all.filter((item) => item?.allowed === true || item?.allowed === 1 || item?.allowed === '1')
}

function TestColumn({ title, description }) {
  return (
    <section className="neo-card p-3 h-100">
      <div className="small text-uppercase opacity-75 mb-2">{title}</div>
      <h5 className="mb-2">{title}</h5>
      <p className="mb-0 opacity-75">{description}</p>
    </section>
  )
}

export default function Teste() {
  const { user } = useAuth()
  const [perfis, setPerfis] = useState([])
  const [loadingPermissoes, setLoadingPermissoes] = useState(false)
  const [errorPermissoes, setErrorPermissoes] = useState('')

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    const loadPermissoes = async () => {
      setLoadingPermissoes(true)
      setErrorPermissoes('')
      try {
        const idUser = user?.id_user ?? user?.id
        const url = new URL(PERMISSOES2_URL)
        if (idUser !== null && idUser !== undefined && idUser !== '') {
          url.searchParams.set('id_user', String(idUser))
        }

        const response = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const payload = await response.json()
        const rows = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : []

        const ordered = [...rows].sort((a, b) => Number(b?.nivel ?? 0) - Number(a?.nivel ?? 0))
        if (mounted) setPerfis(ordered)
      } catch (error) {
        if (!mounted || error?.name === 'AbortError') return
        setErrorPermissoes(error?.message || 'Falha ao carregar permissões.')
      } finally {
        if (mounted) setLoadingPermissoes(false)
      }
    }

    loadPermissoes()
    return () => {
      mounted = false
      controller.abort()
    }
  }, [user?.id_user, user?.id])

  const permissaoResumo = useMemo(() => {
    return perfis.map((perfil) => {
      const allowed = getAllowedPermissions(perfil)
      const modulos = new Set(allowed.map((item) => item?.modulo).filter(Boolean))
      return {
        ...perfil,
        allowedCount: allowed.length,
        modulosCount: modulos.size,
        allowed
      }
    })
  }, [perfis])

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />

      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Link
            to="/dashboard"
            className="btn btn-ghost btn-sm d-flex align-items-center gap-2"
            title="Voltar"
          >
            <FiArrowLeft size={16} />
            <span className="d-none d-sm-inline">Voltar</span>
          </Link>
          <div>
            <h2 className="fw-bold mb-1">Teste</h2>
            <div className="opacity-75 small">Página de teste com colunas de configuração.</div>
          </div>
        </div>

        <section className="neo-card p-3 p-lg-4">
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <section className="neo-card p-3 h-100">
                <div className="small text-uppercase opacity-75 mb-2">Permissões</div>
                <h5 className="mb-2 d-flex align-items-center gap-2">
                  <FiShield size={16} />
                  Perfis e permissões
                </h5>
                <p className="mb-3 opacity-75">
                  Origem: <code>/api/permissoes2</code>
                </p>

                {loadingPermissoes && (
                  <div className="small opacity-75">Carregando permissões...</div>
                )}

                {!loadingPermissoes && errorPermissoes && (
                  <div className="alert alert-danger py-2 px-3 small mb-0">
                    {errorPermissoes}
                  </div>
                )}

                {!loadingPermissoes && !errorPermissoes && permissaoResumo.length === 0 && (
                  <div className="small opacity-75">Nenhum perfil retornado.</div>
                )}

                {!loadingPermissoes && !errorPermissoes && permissaoResumo.length > 0 && (
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    {permissaoResumo.map((perfil) => (
                      <div key={perfil.id} className="p-2 mb-2 rounded border border-secondary-subtle">
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                          <strong>{perfil.nome}</strong>
                          <span className="badge text-bg-primary">{perfil.allowedCount}</span>
                        </div>
                        <div className="small opacity-75 mb-2">
                          nível {perfil.nivel} • {perfil.modulosCount} módulos
                        </div>
                        <div className="d-flex flex-wrap gap-1">
                          {perfil.allowed.slice(0, 5).map((item) => (
                            <span key={`${perfil.id}-${item.id}-${item.slug}`} className="badge text-bg-secondary d-inline-flex align-items-center gap-1">
                              <FiCheckCircle size={11} />
                              {item.slug || item.nome}
                            </span>
                          ))}
                          {perfil.allowedCount > 5 && (
                            <span className="badge text-bg-dark">+{perfil.allowedCount - 5}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <div className="col-12 col-lg-4">
              <TestColumn
                title="Equipes"
                description="Área reservada para testes relacionados a equipes."
              />
            </div>
            <div className="col-12 col-lg-4">
              <TestColumn
                title="Usuários"
                description="Área reservada para testes relacionados a usuários."
              />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
