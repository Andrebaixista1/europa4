import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiCheck, FiLayers, FiShield, FiSliders, FiUser } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

const SCOPE_OPTIONS = [
  { key: 'hierarquia', label: 'Hierarquia', icon: FiLayers },
  { key: 'setor', label: 'Setor', icon: FiShield },
  { key: 'usuario', label: 'Usuario especifico', icon: FiUser }
]

const TARGETS_BY_SCOPE = {
  hierarquia: ['Master', 'Administrador', 'Supervisor', 'Operador'],
  setor: ['Comercial', 'Backoffice', 'TI', 'Financeiro'],
  usuario: ['anderson.souza', 'maria.santos', 'joao.oliveira']
}

const PAGE_CATALOG = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'consultas_in100', label: 'Consultas IN100' },
  { key: 'consultas_v8', label: 'Consultas V8' },
  { key: 'consultas_prata', label: 'Consultas Prata' },
  { key: 'consultas_presenca', label: 'Consultas Presenca' },
  { key: 'consultas_handmais', label: 'Consultas Hand+' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'equipes', label: 'Equipes' },
  { key: 'permissoes', label: 'Permissoes' },
  { key: 'backups', label: 'Backups' }
]

const API_CATALOG = [
  { key: 'api_consulta_in100', label: '/webhook/consulta-logs-in100' },
  { key: 'api_consulta_v8', label: '/webhook/api/consulta-v8' },
  { key: 'api_consulta_prata', label: '/webhook/api/consulta-prata' },
  { key: 'api_consulta_presenca', label: '/webhook/api/presencabank' },
  { key: 'api_consulta_handmais', label: '/webhook/api/consulta-handmais' },
  { key: 'api_admin_users', label: '/api/users/*' },
  { key: 'api_admin_teams', label: '/api/teams/*' },
  { key: 'api_admin_perms', label: '/api/permissoes/*' }
]

const createFlags = (catalog, enabledKeys = []) => {
  const enabled = new Set(enabledKeys)
  return catalog.reduce((acc, item) => {
    acc[item.key] = enabled.has(item.key)
    return acc
  }, {})
}

const MOCK_PRESETS = {
  hierarquia: {
    Master: {
      pages: createFlags(PAGE_CATALOG, PAGE_CATALOG.map((i) => i.key)),
      apis: createFlags(API_CATALOG, API_CATALOG.map((i) => i.key)),
      extras: { readOnly: false, forceMfa: true, timeWindow: false }
    },
    Administrador: {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_in100', 'consultas_v8', 'consultas_prata', 'consultas_presenca', 'consultas_handmais', 'usuarios', 'equipes', 'permissoes']),
      apis: createFlags(API_CATALOG, ['api_consulta_in100', 'api_consulta_v8', 'api_consulta_prata', 'api_consulta_presenca', 'api_consulta_handmais', 'api_admin_users', 'api_admin_teams']),
      extras: { readOnly: false, forceMfa: true, timeWindow: true }
    },
    Supervisor: {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_in100', 'consultas_v8', 'consultas_prata', 'consultas_presenca', 'consultas_handmais', 'usuarios', 'equipes']),
      apis: createFlags(API_CATALOG, ['api_consulta_in100', 'api_consulta_v8', 'api_consulta_prata', 'api_consulta_presenca', 'api_consulta_handmais']),
      extras: { readOnly: false, forceMfa: false, timeWindow: true }
    },
    Operador: {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_in100', 'consultas_v8', 'consultas_prata', 'consultas_presenca', 'consultas_handmais']),
      apis: createFlags(API_CATALOG, ['api_consulta_in100', 'api_consulta_v8', 'api_consulta_prata', 'api_consulta_presenca', 'api_consulta_handmais']),
      extras: { readOnly: false, forceMfa: false, timeWindow: false }
    }
  },
  setor: {
    Comercial: {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_in100', 'consultas_v8', 'consultas_prata', 'consultas_presenca', 'consultas_handmais']),
      apis: createFlags(API_CATALOG, ['api_consulta_in100', 'api_consulta_v8', 'api_consulta_prata', 'api_consulta_presenca', 'api_consulta_handmais']),
      extras: { readOnly: false, forceMfa: false, timeWindow: true }
    },
    Backoffice: {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'usuarios', 'equipes', 'permissoes', 'backups']),
      apis: createFlags(API_CATALOG, ['api_admin_users', 'api_admin_teams', 'api_admin_perms']),
      extras: { readOnly: false, forceMfa: true, timeWindow: false }
    },
    TI: {
      pages: createFlags(PAGE_CATALOG, PAGE_CATALOG.map((i) => i.key)),
      apis: createFlags(API_CATALOG, API_CATALOG.map((i) => i.key)),
      extras: { readOnly: false, forceMfa: true, timeWindow: false }
    },
    Financeiro: {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_in100', 'consultas_v8']),
      apis: createFlags(API_CATALOG, ['api_consulta_in100', 'api_consulta_v8']),
      extras: { readOnly: true, forceMfa: true, timeWindow: true }
    }
  },
  usuario: {
    'anderson.souza': {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_in100', 'consultas_v8', 'consultas_prata']),
      apis: createFlags(API_CATALOG, ['api_consulta_in100', 'api_consulta_v8', 'api_consulta_prata']),
      extras: { readOnly: false, forceMfa: false, timeWindow: false }
    },
    'maria.santos': {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_presenca', 'consultas_handmais']),
      apis: createFlags(API_CATALOG, ['api_consulta_presenca', 'api_consulta_handmais']),
      extras: { readOnly: false, forceMfa: false, timeWindow: false }
    },
    'joao.oliveira': {
      pages: createFlags(PAGE_CATALOG, ['dashboard', 'consultas_in100']),
      apis: createFlags(API_CATALOG, ['api_consulta_in100']),
      extras: { readOnly: true, forceMfa: false, timeWindow: true }
    }
  }
}

const cloneConfig = (config) => JSON.parse(JSON.stringify(config))

export default function Permissoes() {
  const [scope, setScope] = useState('hierarquia')
  const [target, setTarget] = useState(TARGETS_BY_SCOPE.hierarquia[0])
  const [config, setConfig] = useState(() => cloneConfig(MOCK_PRESETS.hierarquia.Master))
  const [statusMsg, setStatusMsg] = useState('')

  const scopeTargets = TARGETS_BY_SCOPE[scope] || []

  useEffect(() => {
    const first = scopeTargets[0] || ''
    setTarget(first)
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const preset = MOCK_PRESETS?.[scope]?.[target] ?? MOCK_PRESETS.hierarquia.Operador
    setConfig(cloneConfig(preset))
    setStatusMsg('')
  }, [scope, target])

  const pagesEnabledCount = useMemo(
    () => Object.values(config.pages || {}).filter(Boolean).length,
    [config.pages]
  )
  const apisEnabledCount = useMemo(
    () => Object.values(config.apis || {}).filter(Boolean).length,
    [config.apis]
  )

  const toggleItem = (group, key) => {
    setConfig((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [key]: !prev?.[group]?.[key]
      }
    }))
  }

  const toggleExtra = (key) => {
    setConfig((prev) => ({
      ...prev,
      extras: {
        ...(prev.extras || {}),
        [key]: !prev?.extras?.[key]
      }
    }))
  }

  const restorePreset = () => {
    const preset = MOCK_PRESETS?.[scope]?.[target]
    if (!preset) return
    setConfig(cloneConfig(preset))
    setStatusMsg('Preset restaurado (modo ficticio).')
  }

  const saveMock = () => {
    setStatusMsg('Layout ficticio salvo para testes visuais.')
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Permissoes</h2>
              <div className="opacity-75 small">
                Pagina para configurar permissoes por hierarquia, setor e usuario especifico,
                incluindo paginas visiveis e APIs permitidas.
              </div>
            </div>
          </div>
        </div>

        <section className="row g-3">
          <div className="col-12 col-xl-4">
            <div className="neo-card p-4 h-100 permissions-kanban-card">
              <div className="d-flex align-items-center gap-2 mb-3">
                <FiLayers size={16} />
                <div className="fw-semibold">Escopo, Setor, Usuario</div>
              </div>

              <div className="small text-uppercase opacity-75 mb-2">Escopo</div>
              <div className="permissions-scope-wrap mb-3">
                {SCOPE_OPTIONS.map((item) => {
                  const Icon = item.icon
                  const active = scope === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`permissions-scope-pill ${active ? 'active' : ''}`}
                      onClick={() => setScope(item.key)}
                    >
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="small text-uppercase opacity-75 mb-2">Alvo da regra</div>
              <div className="permissions-target-grid mb-3" role="listbox" aria-label="Alvo da regra">
                {scopeTargets.map((item) => {
                  const isActive = target === item
                  return (
                    <button
                      key={item}
                      type="button"
                      className={`permissions-target-pill ${isActive ? 'active' : ''}`}
                      onClick={() => setTarget(item)}
                      aria-pressed={isActive}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>

              <div className="permissions-summary-grid mb-3">
                <div className="permissions-summary-item">
                  <div className="permissions-summary-value">{pagesEnabledCount}</div>
                  <div className="permissions-summary-label">Paginas</div>
                </div>
                <div className="permissions-summary-item">
                  <div className="permissions-summary-value">{apisEnabledCount}</div>
                  <div className="permissions-summary-label">Permissoes</div>
                </div>
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2" onClick={saveMock}>
                  <FiCheck size={15} />
                  <span>Salvar</span>
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={restorePreset}>
                  Restaurar
                </button>
              </div>

              {statusMsg && <div className="alert alert-info py-2 px-3 mt-3 mb-0 small">{statusMsg}</div>}
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="neo-card p-4 h-100 permissions-kanban-card">
              <div className="d-flex align-items-center gap-2 mb-3">
                <FiLayers size={16} />
                <div className="fw-semibold">Paginas</div>
              </div>
              <div className="permissions-scroll-list">
                <div className="d-flex flex-column gap-2">
                  {PAGE_CATALOG.map((item) => (
                    <label className="permissions-check-row" key={item.key}>
                      <input
                        type="checkbox"
                        checked={Boolean(config?.pages?.[item.key])}
                        onChange={() => toggleItem('pages', item.key)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="neo-card p-4 h-100 permissions-kanban-card">
              <div className="d-flex align-items-center gap-2 mb-3">
                <FiShield size={16} />
                <div className="fw-semibold">Permissoes</div>
              </div>
              <div className="permissions-scroll-list">
                <div className="d-flex flex-column gap-2">
                  {API_CATALOG.map((item) => (
                    <label className="permissions-check-row" key={item.key}>
                      <input
                        type="checkbox"
                        checked={Boolean(config?.apis?.[item.key])}
                        onChange={() => toggleItem('apis', item.key)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-top border-secondary-subtle">
                  <div className="d-flex align-items-center gap-2 mb-2 opacity-85">
                    <FiSliders size={15} />
                    <span className="small text-uppercase">Regras adicionais</span>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    <label className="permissions-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(config?.extras?.readOnly)}
                        onChange={() => toggleExtra('readOnly')}
                      />
                      <span>Somente leitura</span>
                    </label>
                    <label className="permissions-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(config?.extras?.forceMfa)}
                        onChange={() => toggleExtra('forceMfa')}
                      />
                      <span>Obrigar MFA (2FA)</span>
                    </label>
                    <label className="permissions-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(config?.extras?.timeWindow)}
                        onChange={() => toggleExtra('timeWindow')}
                      />
                      <span>Restringir horario de acesso</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
