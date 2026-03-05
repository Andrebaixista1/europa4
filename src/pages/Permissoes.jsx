import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiCheck, FiLayers, FiShield, FiSliders, FiUser } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const SCOPE_OPTIONS = [
  { key: 'hierarquia', label: 'Hierarquia', icon: FiLayers },
  { key: 'setor', label: 'Equipe', icon: FiShield },
  { key: 'usuario', label: 'Usuário específico', icon: FiUser }
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
  { key: 'consultas_presenca', label: 'Consultas Presença' },
  { key: 'consultas_handmais', label: 'Consultas Hand+' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'equipes', label: 'Equipes' },
  { key: 'permissoes', label: 'Permissões' },
  { key: 'backups', label: 'Backups' }
]

const PAGE_CAPABILITIES = {
  dashboard: { consultar: true },
  consultas_in100: { consultar: true },
  consultas_v8: { consultar: true },
  consultas_prata: { consultar: true },
  consultas_presenca: { consultar: true },
  consultas_handmais: { consultar: true },
  usuarios: { consultar: true, criar: true, editar: true, excluir: true },
  equipes: { consultar: true, criar: true, editar: true, excluir: true },
  permissoes: { consultar: true, criar: true, editar: true, excluir: true },
  backups: { consultar: true, exportar: true }
}

const ACTION_LABELS = {
  consultar: 'Consultar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
  exportar: 'Exportar'
}

const ACCESS_MODE_OPTIONS = [
  {
    key: 'liberado',
    title: 'Acesso completo',
    description: 'Pode abrir a página e executar as ações permitidas.'
  },
  {
    key: 'somente-leitura',
    title: 'Somente leitura',
    description: 'Pode visualizar e consultar, sem alterar dados.'
  },
  {
    key: 'restrito',
    title: 'Bloqueado',
    description: 'Não pode visualizar esta página.'
  }
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

const PERMISSIONS_GET_API_URL = 'https://n8n.apivieiracred.store/webhook/api/permissions'

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
const normalizeToken = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()

const toBool = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  const token = normalizeToken(value)
  return ['1', 'true', 'sim', 'yes', 'on'].includes(token)
}

const parseJsonSafe = (value) => {
  try {
    return JSON.parse(value)
  } catch (_) {
    return null
  }
}

const pageKeyAliases = PAGE_CATALOG.reduce((acc, item) => {
  acc[normalizeToken(item.key)] = item.key
  acc[normalizeToken(item.label)] = item.key
  return acc
}, {})

const apiKeyAliases = API_CATALOG.reduce((acc, item) => {
  acc[normalizeToken(item.key)] = item.key
  acc[normalizeToken(item.label)] = item.key
  return acc
}, {})

const normalizeScope = (value) => {
  const token = normalizeToken(value)
  if (token.includes('hier')) return 'hierarquia'
  if (token.includes('setor') || token.includes('equipe') || token.includes('team')) return 'setor'
  if (token.includes('user') || token.includes('usuario')) return 'usuario'
  return ''
}

const normalizePageKey = (value) => {
  const token = normalizeToken(value)
  return pageKeyAliases[token] || ''
}

const normalizeApiKey = (value) => {
  const token = normalizeToken(value)
  return apiKeyAliases[token] || ''
}

const createEmptyPreset = () => ({
  pages: createFlags(PAGE_CATALOG, []),
  apis: createFlags(API_CATALOG, []),
  extras: { readOnly: false, forceMfa: false, timeWindow: false }
})

const createPageRulesFromConfig = (cfg) => {
  const next = {}
  PAGE_CATALOG.forEach((page) => {
    const cap = PAGE_CAPABILITIES[page.key] || {}
    const view = Boolean(cfg?.pages?.[page.key])
    next[page.key] = {
      view,
      consultar: view && Boolean(cap.consultar),
      criar: false,
      editar: false,
      excluir: false,
      exportar: false
    }
  })
  return next
}

const ensurePresetShape = (input) => {
  const base = createEmptyPreset()
  const next = { ...base }

  if (Array.isArray(input?.pages)) {
    input.pages.forEach((value) => {
      const key = normalizePageKey(value)
      if (key) next.pages[key] = true
    })
  } else if (input?.pages && typeof input.pages === 'object') {
    Object.entries(input.pages).forEach(([rawKey, rawValue]) => {
      const key = normalizePageKey(rawKey)
      if (key) next.pages[key] = toBool(rawValue)
    })
  }

  if (Array.isArray(input?.apis)) {
    input.apis.forEach((value) => {
      const key = normalizeApiKey(value)
      if (key) next.apis[key] = true
    })
  } else if (input?.apis && typeof input.apis === 'object') {
    Object.entries(input.apis).forEach(([rawKey, rawValue]) => {
      const key = normalizeApiKey(rawKey)
      if (key) next.apis[key] = toBool(rawValue)
    })
  }

  if (input?.extras && typeof input.extras === 'object') {
    next.extras = {
      readOnly: toBool(input.extras.readOnly ?? input.extras.somente_leitura),
      forceMfa: toBool(input.extras.forceMfa ?? input.extras.force_mfa),
      timeWindow: toBool(input.extras.timeWindow ?? input.extras.time_window)
    }
  }

  return next
}

const unwrapPermissionsPayload = (raw) => {
  let payload = raw

  if (payload && typeof payload === 'object' && Array.isArray(payload.value) && payload.value.length > 0) {
    payload = payload.value
  }

  if (Array.isArray(payload) && payload.length === 1 && payload[0] && typeof payload[0] === 'object') {
    const jsonKey = Object.keys(payload[0]).find((key) => key.toUpperCase().startsWith('JSON_'))
    if (jsonKey && typeof payload[0][jsonKey] === 'string') {
      const parsed = parseJsonSafe(payload[0][jsonKey])
      if (parsed) return parsed
    }
  }

  if (typeof payload === 'string') {
    const parsed = parseJsonSafe(payload)
    if (parsed) return parsed
  }

  return payload
}

const parsePermissionsFromPayload = (rawPayload) => {
  const payload = unwrapPermissionsPayload(rawPayload)

  if (!payload) return null

  const hasEchoShape = payload?.webhookUrl && payload?.headers && payload?.query && payload?.body
  if (hasEchoShape && !payload?.rules && !payload?.permissoes && !payload?.data) return null

  const targetsByScope = { hierarquia: [], setor: [], usuario: [] }
  const presetsByScope = { hierarquia: {}, setor: {}, usuario: {} }
  let appliedRows = 0

  const upsertPreset = (scope, target, partial) => {
    if (!scope || !target) return
    if (!targetsByScope[scope].includes(target)) targetsByScope[scope].push(target)

    if (!presetsByScope[scope][target]) {
      presetsByScope[scope][target] = createEmptyPreset()
    }

    const current = presetsByScope[scope][target]
    presetsByScope[scope][target] = ensurePresetShape({
      ...current,
      ...partial,
      pages: { ...current.pages, ...(partial?.pages || {}) },
      apis: { ...current.apis, ...(partial?.apis || {}) },
      extras: { ...current.extras, ...(partial?.extras || {}) }
    })
    appliedRows += 1
  }

  const directSource = payload?.data || payload
  for (const scopeKey of ['hierarquia', 'setor', 'usuario']) {
    const scopeBlock = directSource?.[scopeKey]
    if (scopeBlock && typeof scopeBlock === 'object' && !Array.isArray(scopeBlock)) {
      Object.entries(scopeBlock).forEach(([target, cfg]) => {
        upsertPreset(scopeKey, String(target).trim(), cfg)
      })
    }
  }

  const rowsCandidate =
    (Array.isArray(directSource?.rules) && directSource.rules) ||
    (Array.isArray(directSource?.permissoes) && directSource.permissoes) ||
    (Array.isArray(directSource?.rows) && directSource.rows) ||
    (Array.isArray(directSource) && directSource) ||
    []

  rowsCandidate.forEach((row) => {
    if (!row || typeof row !== 'object') return

    const scope = normalizeScope(row.escopo_tipo ?? row.scope ?? row.escopo)
    if (!scope) return

    const targetRaw =
      row.alvo ??
      row.target ??
      row.role_alvo ??
      row.role ??
      row.setor ??
      row.equipe_nome ??
      row.equipe_id ??
      row.usuario_login ??
      row.usuario_id

    if (!targetRaw) return

    const target = String(targetRaw).trim()
    if (!target) return

    const partial = { pages: {}, apis: {}, extras: {} }

    const pageKey = normalizePageKey(row.pagina_key ?? row.page_key ?? row.page)
    if (pageKey) {
      partial.pages[pageKey] = toBool(row.allow_view ?? row.allowView ?? row.view ?? 0)
    }

    const apiKey = normalizeApiKey(row.api_key ?? row.endpoint_key ?? row.api)
    if (apiKey) {
      partial.apis[apiKey] = toBool(row.allow_use ?? row.allowUse ?? row.allow_view ?? 0)
    }

    if (Array.isArray(row.paginas)) {
      row.paginas.forEach((p) => {
        const key = normalizePageKey(p?.pagina_key ?? p?.key ?? p)
        if (!key) return
        partial.pages[key] = toBool(p?.allow_view ?? p?.allow ?? true)
      })
    }

    if (Array.isArray(row.apis)) {
      row.apis.forEach((a) => {
        const key = normalizeApiKey(a?.api_key ?? a?.key ?? a)
        if (!key) return
        partial.apis[key] = toBool(a?.allow_use ?? a?.allow ?? true)
      })
    }

    upsertPreset(scope, target, partial)
  })

  const hasAnyTarget = Object.values(targetsByScope).some((list) => list.length > 0)
  if (!hasAnyTarget) return null

  return { targetsByScope, presetsByScope, appliedRows }
}

export default function Permissoes() {
  const { user } = useAuth()
  const [scope, setScope] = useState('hierarquia')
  const [target, setTarget] = useState(TARGETS_BY_SCOPE.hierarquia[0])
  const [selectedPage, setSelectedPage] = useState(PAGE_CATALOG[0].key)
  const [accessMode, setAccessMode] = useState('liberado')
  const [config, setConfig] = useState(() => cloneConfig(MOCK_PRESETS.hierarquia.Master))
  const [pageRules, setPageRules] = useState(() => createPageRulesFromConfig(MOCK_PRESETS.hierarquia.Master))
  const [statusMsg, setStatusMsg] = useState('')
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [apiTargetsByScope, setApiTargetsByScope] = useState(null)
  const [apiPresetsByScope, setApiPresetsByScope] = useState(null)

  const scopeTargets = useMemo(() => {
    const remoteTargets = apiTargetsByScope?.[scope]
    if (Array.isArray(remoteTargets) && remoteTargets.length > 0) return remoteTargets
    return TARGETS_BY_SCOPE[scope] || []
  }, [scope, apiTargetsByScope])

  const resolvePreset = (scopeKey, targetKey) => {
    const remote = apiPresetsByScope?.[scopeKey]?.[targetKey]
    if (remote) return remote
    return MOCK_PRESETS?.[scopeKey]?.[targetKey] ?? MOCK_PRESETS.hierarquia.Operador
  }

  useEffect(() => {
    if (!scopeTargets.includes(target)) {
      setTarget(scopeTargets[0] || '')
    }
  }, [scopeTargets, target])

  useEffect(() => {
    const preset = resolvePreset(scope, target)
    const nextConfig = cloneConfig(preset)
    setConfig(nextConfig)
    setPageRules(createPageRulesFromConfig(nextConfig))
  }, [scope, target, apiPresetsByScope])

  const loadPermissionsFromApi = async () => {
    setLoadingRemote(true)
    try {
      const requestUrl = new URL(PERMISSIONS_GET_API_URL)
      if (user?.id) requestUrl.searchParams.set('id_user', String(user.id))

      const response = await fetch(requestUrl.toString(), { method: 'GET' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const json = await response.json()
      const parsed = parsePermissionsFromPayload(json)

      if (!parsed) {
        setStatusMsg('API de permissões ainda sem estrutura final. Mantido modo local.')
        return
      }

      setApiTargetsByScope(parsed.targetsByScope)
      setApiPresetsByScope(parsed.presetsByScope)
      setStatusMsg(`Permissões carregadas da API (${parsed.appliedRows} registros).`)
    } catch (error) {
      setStatusMsg(`Falha ao carregar API de permissões: ${error?.message || 'erro desconhecido'}`)
    } finally {
      setLoadingRemote(false)
    }
  }

  useEffect(() => {
    loadPermissionsFromApi()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pagesEnabledCount = useMemo(
    () => Object.values(config.pages || {}).filter(Boolean).length,
    [config.pages]
  )

  const actionsEnabledCount = useMemo(
    () => Object.values(pageRules || {}).reduce((acc, rule) => {
      const total = ['consultar', 'criar', 'editar', 'excluir', 'exportar']
        .filter((actionKey) => Boolean(rule?.[actionKey]))
        .length
      return acc + total
    }, 0),
    [pageRules]
  )

  const toggleExtra = (key) => {
    setConfig((prev) => ({
      ...prev,
      extras: {
        ...(prev.extras || {}),
        [key]: !prev?.extras?.[key]
      }
    }))
  }

  const selectedPageMeta = PAGE_CATALOG.find((page) => page.key === selectedPage) || PAGE_CATALOG[0]
  const selectedPageRule = pageRules[selectedPageMeta.key] || {
    view: false,
    consultar: false,
    criar: false,
    editar: false,
    excluir: false,
    exportar: false
  }
  const selectedPageCapabilities = PAGE_CAPABILITIES[selectedPageMeta.key] || {}
  const selectedPageActions = ['consultar', 'criar', 'editar', 'excluir', 'exportar']
    .filter((actionKey) => Boolean(selectedPageCapabilities[actionKey]))

  const updatePageRule = (pageKey, updater) => {
    setPageRules((prev) => {
      const current = prev[pageKey] || {
        view: false,
        consultar: false,
        criar: false,
        editar: false,
        excluir: false,
        exportar: false
      }
      const nextRule = typeof updater === 'function' ? updater(current) : updater
      return { ...prev, [pageKey]: nextRule }
    })
  }

  const setPageVisibility = (pageKey, nextView) => {
    const cap = PAGE_CAPABILITIES[pageKey] || {}
    updatePageRule(pageKey, (current) => ({
      ...current,
      view: nextView,
      consultar: nextView ? (current.consultar || Boolean(cap.consultar)) : false,
      criar: nextView ? current.criar : false,
      editar: nextView ? current.editar : false,
      excluir: nextView ? current.excluir : false,
      exportar: nextView ? current.exportar : false
    }))

    setConfig((prev) => ({
      ...prev,
      pages: {
        ...(prev.pages || {}),
        [pageKey]: nextView
      }
    }))
  }

  const togglePageAction = (pageKey, actionKey) => {
    const cap = PAGE_CAPABILITIES[pageKey] || {}
    if (!cap[actionKey]) return
    updatePageRule(pageKey, (current) => {
      const nextActionValue = !current[actionKey]
      const nextView = current.view || nextActionValue
      return {
        ...current,
        view: nextView,
        consultar: actionKey === 'consultar' ? nextActionValue : (nextView ? current.consultar || Boolean(cap.consultar) : false),
        [actionKey]: nextActionValue
      }
    })

    setConfig((prev) => ({
      ...prev,
      pages: {
        ...(prev.pages || {}),
        [pageKey]: true
      }
    }))
  }

  useEffect(() => {
    const hasWriteAccess =
      Boolean(selectedPageRule.criar) ||
      Boolean(selectedPageRule.editar) ||
      Boolean(selectedPageRule.excluir) ||
      Boolean(selectedPageRule.exportar)

    if (!selectedPageRule.view) {
      setAccessMode('restrito')
    } else if (hasWriteAccess) {
      setAccessMode('liberado')
    } else {
      setAccessMode('somente-leitura')
    }
  }, [selectedPageRule])

  const applyAccessMode = (mode) => {
    setAccessMode(mode)
    if (mode === 'restrito') {
      setPageVisibility(selectedPageMeta.key, false)
      return
    }

    setPageVisibility(selectedPageMeta.key, true)
    if (mode === 'somente-leitura') {
      updatePageRule(selectedPageMeta.key, (current) => ({
        ...current,
        consultar: true,
        criar: false,
        editar: false,
        excluir: false,
        exportar: false
      }))
    } else if (mode === 'liberado') {
      updatePageRule(selectedPageMeta.key, (current) => ({
        ...current,
        consultar: Boolean(selectedPageCapabilities.consultar),
        criar: Boolean(selectedPageCapabilities.criar),
        editar: Boolean(selectedPageCapabilities.editar),
        excluir: Boolean(selectedPageCapabilities.excluir),
        exportar: Boolean(selectedPageCapabilities.exportar)
      }))
    }
  }

  const restorePreset = () => {
    const preset = MOCK_PRESETS?.[scope]?.[target]
    if (!preset) return
    const nextConfig = cloneConfig(preset)
    setConfig(nextConfig)
    setPageRules(createPageRulesFromConfig(nextConfig))
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
              <h2 className="fw-bold mb-1">Permissões</h2>
              <div className="opacity-75 small">
                Defina visibilidade de páginas e regras por hierarquia, equipe ou usuário.
              </div>
            </div>
          </div>
        </div>

        <section className="row g-3 permissions-wix-grid">
          <div className="col-12 col-xl-3">
            <div className="neo-card p-0 h-100 permissions-wix-panel">
              <div className="permissions-wix-panel-head">
                <FiLayers size={16} />
                <span>Escopo de Regras</span>
              </div>
              <div className="permissions-wix-panel-body">
                <div className="small text-uppercase opacity-75 mb-2">Escopo</div>
                <div className="permissions-scope-stack mb-3">
                  {SCOPE_OPTIONS.map((item) => {
                    const Icon = item.icon
                    const active = scope === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`permissions-scope-item ${active ? 'active' : ''}`}
                        onClick={() => setScope(item.key)}
                      >
                        <Icon size={15} />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="small text-uppercase opacity-75 mb-2">
                  {scope === 'hierarquia' ? 'Níveis' : scope === 'setor' ? 'Equipes' : 'Usuários'}
                </div>
                <div className="permissions-target-stack mb-3" role="listbox" aria-label="Alvo da regra">
                  {scopeTargets.map((item) => {
                    const isActive = target === item
                    return (
                      <button
                        key={item}
                        type="button"
                        className={`permissions-target-item ${isActive ? 'active' : ''}`}
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
                    <div className="permissions-summary-label">Páginas liberadas</div>
                  </div>
                  <div className="permissions-summary-item">
                    <div className="permissions-summary-value">{actionsEnabledCount}</div>
                    <div className="permissions-summary-label">Ações ativas</div>
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2" onClick={saveMock}>
                    <FiCheck size={15} />
                    <span>Salvar</span>
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={loadPermissionsFromApi} disabled={loadingRemote}>
                    {loadingRemote ? 'Carregando API...' : 'Atualizar API'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={restorePreset}>
                    Restaurar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="neo-card p-0 h-100 permissions-wix-panel">
              <div className="permissions-wix-panel-head">
                <FiLayers size={16} />
                <span>Páginas do Sistema</span>
              </div>
              <div className="permissions-wix-panel-body permissions-wix-scroll">
                <div className="d-flex flex-column gap-2">
                  {PAGE_CATALOG.map((item) => {
                    const isSelected = selectedPage === item.key
                    const isEnabled = Boolean(pageRules?.[item.key]?.view || config?.pages?.[item.key])
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`permissions-page-row ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedPage(item.key)}
                      >
                        <span className="permissions-page-row-label">{item.label}</span>
                        <span className={`permissions-page-row-badge ${isEnabled ? 'on' : 'off'}`}>
                          {isEnabled ? 'Liberada' : 'Bloqueada'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-5">
            <div className="neo-card p-0 h-100 permissions-wix-panel">
              <div className="permissions-wix-panel-head">
                <FiShield size={16} />
                <span>Permissões da Página</span>
              </div>
              <div className="permissions-wix-panel-body permissions-wix-scroll">
                <div className="permissions-config-title mb-3">
                  <div className="small text-uppercase opacity-75">Página selecionada</div>
                  <div className="fw-semibold fs-5">{selectedPageMeta.label}</div>
                </div>

                <div className="small text-uppercase opacity-75 mb-2">Quem pode acessar esta página?</div>
                <div className="permissions-mode-grid mb-3">
                  {ACCESS_MODE_OPTIONS.map((option) => {
                    const active = accessMode === option.key
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`permissions-mode-card ${active ? 'active' : ''}`}
                        onClick={() => applyAccessMode(option.key)}
                      >
                        <div className="permissions-mode-title">{option.title}</div>
                        <div className="permissions-mode-desc">{option.description}</div>
                      </button>
                    )
                  })}
                </div>

                <div className="small text-uppercase opacity-75 mb-2">Ações permitidas nesta página</div>
                <div className="permissions-action-grid mb-3">
                  {selectedPageActions.length === 0 && (
                    <div className="permissions-empty">
                      Esta página não possui ações configuráveis no momento.
                    </div>
                  )}
                  {selectedPageActions.map((actionKey) => {
                    const active = Boolean(selectedPageRule[actionKey])
                    return (
                      <button
                        key={actionKey}
                        type="button"
                        className={`permissions-action-item ${active ? 'active' : ''}`}
                        onClick={() => togglePageAction(selectedPageMeta.key, actionKey)}
                        disabled={!selectedPageRule.view}
                        title={!selectedPageRule.view ? 'Libere a visualização da página para editar ações.' : ''}
                      >
                        <span>{ACTION_LABELS[actionKey] || actionKey}</span>
                        <span>{active ? 'ON' : 'OFF'}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="small text-uppercase opacity-75 mb-2 d-flex align-items-center gap-2">
                  <FiSliders size={14} />
                  Políticas complementares
                </div>
                <div className="permissions-policy-grid">
                  <button
                    type="button"
                    className={`permissions-policy-item ${config?.extras?.forceMfa ? 'active' : ''}`}
                    onClick={() => toggleExtra('forceMfa')}
                  >
                    <span>Obrigar MFA (2FA)</span>
                    <span>{config?.extras?.forceMfa ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    type="button"
                    className={`permissions-policy-item ${config?.extras?.timeWindow ? 'active' : ''}`}
                    onClick={() => toggleExtra('timeWindow')}
                  >
                    <span>Restringir horário de acesso</span>
                    <span>{config?.extras?.timeWindow ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                {statusMsg && (
                  <div className="alert alert-info py-2 px-3 mt-3 mb-0 small">
                    {statusMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
