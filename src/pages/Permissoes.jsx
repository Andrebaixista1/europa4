import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { normalizeRole, Roles } from '../utils/roles.js'
import { notify } from '../utils/notify.js'

const API_BASE = 'http://85.31.61.242:8011/api'
const PERMISSIONS_PATH = 'permissoes2'
const SAVE_PATH = 'permissoes/alterar'

const PROFILE_ORDER = [Roles.Master, Roles.Administrador, Roles.Supervisor, Roles.Operador]

const PAGE_LABEL_OVERRIDES = {
  dashboard: 'Dashboard',
  perfil: 'Perfil',
  consultas_clientes: 'Consulta Offline',
  consultas_online: 'Consulta Online',
  cliente_argus: 'Cliente Argus',
  recargas: 'Gestão de Recargas',
  controle_planejamento: 'Controle Planejamento',
  extracoes: 'Extrações',
  usuarios: 'Usuários',
  equipes: 'Equipes',
  permissoes: 'Permissões',
  teste: 'Teste',
  cadastros_apis: "Cadastros API's",
  backups: 'Backups',
}

const PAGE_KEY_ALIASES = {
  perfil: 'perfil',
  profile: 'perfil',
  minha_conta: 'perfil',
  minha_conta_perfil: 'perfil',
  consulta_cliente: 'consultas_clientes',
  consultas_clientes: 'consultas_clientes',
  consulta_online: 'consultas_online',
  consultas_online: 'consultas_online',
  users: 'usuarios',
  usuarios: 'usuarios',
  equipes: 'equipes',
  config: 'permissoes',
  configuracoes: 'permissoes',
  permissoes: 'permissoes',
  backups: 'backups',
}

const PAGE_CATALOG_BASE = [
  { pageKey: 'dashboard', route: '/dashboard' },
  { pageKey: 'perfil', route: '/perfil' },
  { pageKey: 'consultas_clientes', route: '/consultas/clientes' },
  { pageKey: 'consultas_online', route: '/consultas/online' },
  { pageKey: 'cliente_argus', route: '/consulta/cliente-argus' },
  { pageKey: 'recargas', route: '/recargas' },
  { pageKey: 'controle_planejamento', route: '/admin/controle-planejamento' },
  { pageKey: 'extracoes', route: '/admin/relatorios' },
  { pageKey: 'usuarios', route: '/usuarios' },
  { pageKey: 'equipes', route: '/equipes' },
  { pageKey: 'permissoes', route: '/admin/permissoes' },
  { pageKey: 'teste', route: '/admin/teste' },
  { pageKey: 'cadastros_apis', route: '/admin/cadastros-apis' },
  { pageKey: 'backups', route: '/admin/backups' },
]

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const token = value.trim().toLowerCase()
    return ['1', 'true', 'sim', 'yes', 'on'].includes(token)
  }
  return false
}

const safeJson = async (response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(text.trim() || `HTTP ${response.status}`)
  }
}

const unwrapSqlJsonEnvelope = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return raw
  const first = raw[0]
  if (!first || typeof first !== 'object') return raw
  const jsonKey = Object.keys(first).find((key) => key.toUpperCase().startsWith('JSON_'))
  if (!jsonKey || typeof first[jsonKey] !== 'string') return raw
  try {
    return JSON.parse(first[jsonKey])
  } catch {
    return raw
  }
}

const normalizeApiCollection = (raw) => {
  const data = unwrapSqlJsonEnvelope(raw)
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.items)) return data.items
  return []
}

const fetchCollection = async (path, idUser) => {
  const url = new URL(`${API_BASE}/${path}`)
  if (idUser !== null && idUser !== undefined && idUser !== '') {
    url.searchParams.set('id_user', String(idUser))
  }

  const response = await fetch(url.toString(), { method: 'GET' })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)

  const payload = await safeJson(response)
  return normalizeApiCollection(payload)
}

const parseJsonField = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseCsvPermissions = (value) => {
  if (!value) return []
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((slug) => ({ slug, nome: slug, modulo: slug.split('.')[0] || 'geral' }))
}

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const titleCase = (value) =>
  String(value || '')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (match) => match.toUpperCase())

const normalizePageKey = (value) => {
  const normalized = slugify(value)
  return PAGE_KEY_ALIASES[normalized] || normalized
}

const formatPageLabel = (pageKey, fallbackName = '') => {
  const normalizedKey = normalizePageKey(pageKey)
  if (PAGE_LABEL_OVERRIDES[normalizedKey]) return PAGE_LABEL_OVERRIDES[normalizedKey]
  if (fallbackName && String(fallbackName).trim()) return String(fallbackName).trim()
  return titleCase(normalizedKey || pageKey)
}

const derivePageFromPermission = (permission) => {
  const slug = String(permission?.slug || '').trim().toLowerCase()
  const nome = String(permission?.nome || '').trim()
  const modulo = String(permission?.modulo || '').trim().toLowerCase()

  let rawPageKey = ''
  if (slug.includes('.')) {
    const parts = slug.split('.').filter(Boolean)
    if (parts[0] === 'consulta' && parts.length >= 2) rawPageKey = `consultas_${parts[1]}`
    else rawPageKey = parts[0]
  } else if (slug) {
    rawPageKey = slug
  } else if (modulo) {
    rawPageKey = modulo
  }

  const pageKey = normalizePageKey(rawPageKey)
  if (!pageKey) return null
  return { pageKey, pageLabel: formatPageLabel(pageKey, nome) }
}

const extractAllowedPagesFromRow = (row) => {
  const pageMap = new Map()

  const appendPage = (key, label = '') => {
    const pageKey = normalizePageKey(key)
    if (!pageKey) return
    if (!pageMap.has(pageKey)) {
      pageMap.set(pageKey, { pageKey, pageLabel: formatPageLabel(pageKey, label) })
    }
  }

  const explicitPagePermissions = parseJsonField(row?.paginas_permissoes_json)
  if (explicitPagePermissions.length > 0) {
    for (const page of explicitPagePermissions) {
      const hasAllowed =
        normalizeBoolean(page?.allow_view) ||
        normalizeBoolean(page?.allow_consultar) ||
        normalizeBoolean(page?.allow_criar) ||
        normalizeBoolean(page?.allow_editar) ||
        normalizeBoolean(page?.allow_excluir) ||
        normalizeBoolean(page?.allow_exportar)
      if (hasAllowed) appendPage(page?.pagina_key, page?.pagina_nome)
    }

    if (row?.pagina_key) {
      const hasAllowed =
        normalizeBoolean(row?.allow_view) ||
        normalizeBoolean(row?.allow_consultar) ||
        normalizeBoolean(row?.allow_criar) ||
        normalizeBoolean(row?.allow_editar) ||
        normalizeBoolean(row?.allow_excluir) ||
        normalizeBoolean(row?.allow_exportar)
      if (hasAllowed) appendPage(row?.pagina_key, row?.pagina_nome)
    }

    return Array.from(pageMap.values())
  }

  for (const permission of parseCsvPermissions(row?.permissoes_sistema ?? row?.permissoes)) {
    const parsed = derivePageFromPermission(permission)
    if (parsed) appendPage(parsed.pageKey, parsed.pageLabel)
  }

  for (const permission of parseJsonField(row?.permissoes_sistema_json)) {
    if (permission?.allowed !== undefined && !normalizeBoolean(permission.allowed)) continue
    const parsed = derivePageFromPermission(permission)
    if (parsed) appendPage(parsed.pageKey, parsed.pageLabel)
  }

  for (const permission of parseJsonField(row?.permissoes_json)) {
    const parsed = derivePageFromPermission(permission)
    if (parsed) appendPage(parsed.pageKey, parsed.pageLabel)
  }

  for (const permission of parseJsonField(row?.permissoes_matriz_json)) {
    if (permission?.allowed !== undefined && !normalizeBoolean(permission.allowed)) continue
    const parsed = derivePageFromPermission(permission)
    if (parsed) appendPage(parsed.pageKey, parsed.pageLabel)
  }

  if (row?.pagina_key) {
    const hasAllowed =
      normalizeBoolean(row?.allow_view) ||
      normalizeBoolean(row?.allow_consultar) ||
      normalizeBoolean(row?.allow_criar) ||
      normalizeBoolean(row?.allow_editar) ||
      normalizeBoolean(row?.allow_excluir) ||
      normalizeBoolean(row?.allow_exportar)
    if (hasAllowed) appendPage(row?.pagina_key, row?.pagina_nome)
  }

  return Array.from(pageMap.values())
}

const extractCatalogPagesFromRow = (row) => {
  const pageMap = new Map()

  const appendCatalogPage = (key, label = '', route = '') => {
    const pageKey = normalizePageKey(key)
    if (!pageKey || pageMap.has(pageKey)) return
    pageMap.set(pageKey, {
      pageKey,
      pageLabel: formatPageLabel(pageKey, label),
      route: String(route || '').trim(),
    })
  }

  for (const page of parseJsonField(row?.paginas_permissoes_json)) {
    appendCatalogPage(page?.pagina_key, page?.pagina_nome, page?.rota)
  }

  if (row?.pagina_key) {
    appendCatalogPage(row?.pagina_key, row?.pagina_nome, row?.rota)
  }

  return Array.from(pageMap.values())
}

const createEmptyProfile = (role) => ({
  role,
  roleId: null,
  roleSlug: '',
  systemPermissions: [],
  userKeys: new Set(),
  fixedUsersCount: null,
  pages: new Map(),
})

const clonePermissionsByRole = (input = {}) =>
  Object.fromEntries(PROFILE_ORDER.map((role) => [role, new Set(Array.from(input?.[role] || []))]))

const setsEqual = (a, b) => {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

const formatActivePermissionsLabel = (total) =>
  `${total} permissão${total === 1 ? '' : 'ões'} ativa${total === 1 ? '' : 's'}`

const formatActivePermissionsLabelSafe = (total) => `${total} permiss\u00f5es ativas`

const buildProfileData = (rawRows = []) => {
  const profileMap = new Map(
    PROFILE_ORDER.map((role) => [role, createEmptyProfile(role)])
  )

  const allPagesMap = new Map(
    PAGE_CATALOG_BASE.map((page) => [
      page.pageKey,
      { pageKey: page.pageKey, pageLabel: formatPageLabel(page.pageKey), route: page.route || '' },
    ])
  )

  for (const row of rawRows || []) {
    const role = normalizeRole(
      row?.role_nome || row?.role || row?.perfil || row?.nome || row?.slug,
      row?.nivel_hierarquia ?? row?.nivel
    )

    if (!profileMap.has(role)) {
      profileMap.set(role, createEmptyProfile(role))
    }

    const profile = profileMap.get(role)
    const roleId = toNumberOrNull(row?.id ?? row?.role_id ?? row?.roleId ?? null)
    if (roleId !== null && profile.roleId === null) profile.roleId = roleId

    const roleSlug = String(row?.slug ?? row?.role_slug ?? '').trim()
    if (roleSlug && !profile.roleSlug) profile.roleSlug = roleSlug

    const systemPermissions = parseJsonField(row?.permissoes_sistema_json)
    if (systemPermissions.length > 0 || !profile.systemPermissions.length) {
      profile.systemPermissions = systemPermissions
    }

    const explicitUsers = toNumberOrNull(
      row?.usuarios_count ??
        row?.qtd_usuarios ??
        row?.total_usuarios ??
        row?.users_count ??
        row?.qtd_users
    )
    if (explicitUsers !== null) {
      profile.fixedUsersCount =
        profile.fixedUsersCount === null
          ? explicitUsers
          : Math.max(profile.fixedUsersCount, explicitUsers)
    }

    const userId = toNumberOrNull(row?.id_user ?? row?.user_id ?? row?.usuario_id)
    if (userId !== null) profile.userKeys.add(`id:${userId}`)
    else {
      const login = String(row?.login || row?.usuario_login || '').trim().toLowerCase()
      if (login) profile.userKeys.add(`login:${login}`)
    }

    for (const page of extractCatalogPagesFromRow(row)) {
      const currentPage = allPagesMap.get(page.pageKey)
      if (!currentPage) {
        allPagesMap.set(page.pageKey, page)
        continue
      }

      if (!currentPage.route && page.route) {
        allPagesMap.set(page.pageKey, { ...currentPage, route: page.route })
      }
    }

    for (const page of extractAllowedPagesFromRow(row)) {
      if (!profile.pages.has(page.pageKey)) {
        profile.pages.set(page.pageKey, { pageKey: page.pageKey, pageLabel: page.pageLabel })
      }
      if (!allPagesMap.has(page.pageKey)) {
        allPagesMap.set(page.pageKey, { pageKey: page.pageKey, pageLabel: page.pageLabel, route: '' })
      }
    }
  }

  return {
    profiles: PROFILE_ORDER.map((role) => {
      const profile = profileMap.get(role)
      return {
        role,
        roleId: profile?.roleId ?? null,
        roleSlug: profile?.roleSlug ?? '',
        systemPermissions: Array.isArray(profile?.systemPermissions) ? profile.systemPermissions : [],
        usersCount: profile?.fixedUsersCount ?? profile?.userKeys?.size ?? 0,
        pages: Array.from(profile?.pages?.values() || []),
      }
    }),
    allPages: Array.from(allPagesMap.values()).sort((a, b) =>
      a.pageLabel.localeCompare(b.pageLabel, 'pt-BR')
    ),
    permissionsByRole: Object.fromEntries(
      PROFILE_ORDER.map((role) => [role, new Set(Array.from(profileMap.get(role)?.pages?.keys() || []))])
    ),
  }
}

export default function Permissoes() {
  const { user, refreshAccess } = useAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [allPages, setAllPages] = useState([])
  const [selectedRole, setSelectedRole] = useState(Roles.Master)
  const [profileSearch, setProfileSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [permissionsByRole, setPermissionsByRole] = useState(clonePermissionsByRole())
  const [initialPermissionsByRole, setInitialPermissionsByRole] = useState(clonePermissionsByRole())
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    let isCancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const idUser = user?.id_user ?? user?.id ?? null
        const rows = await fetchCollection(PERMISSIONS_PATH, idUser)
        const built = buildProfileData(rows || [])
        if (!isCancelled) {
          setProfiles(built.profiles)
          setAllPages(built.allPages)
          setPermissionsByRole(clonePermissionsByRole(built.permissionsByRole))
          setInitialPermissionsByRole(clonePermissionsByRole(built.permissionsByRole))
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err)
          setProfiles(
            PROFILE_ORDER.map((role) => ({
              role,
              roleId: null,
              roleSlug: '',
              systemPermissions: [],
              usersCount: 0,
              pages: [],
            }))
          )
          setAllPages(
            PAGE_CATALOG_BASE.map((page) => ({
              pageKey: page.pageKey,
              pageLabel: formatPageLabel(page.pageKey),
              route: page.route || '',
            }))
          )
          setPermissionsByRole(clonePermissionsByRole())
          setInitialPermissionsByRole(clonePermissionsByRole())
        }
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      isCancelled = true
    }
  }, [user?.id, user?.id_user])

  const selectedPermissions = useMemo(
    () => permissionsByRole?.[selectedRole] || new Set(),
    [permissionsByRole, selectedRole]
  )

  const selectedProfile = useMemo(
    () =>
      profiles.find((profile) => profile.role === selectedRole) || {
        role: selectedRole,
        roleId: null,
        roleSlug: '',
        systemPermissions: [],
        usersCount: 0,
      },
    [profiles, selectedRole]
  )

  const filteredProfiles = useMemo(() => {
    const term = profileSearch.trim().toLowerCase()
    if (!term) return profiles
    return profiles.filter((profile) => String(profile.role || '').toLowerCase().includes(term))
  }, [profiles, profileSearch])

  const filteredPages = useMemo(() => {
    const term = pageSearch.trim().toLowerCase()
    if (!term) return allPages
    return allPages.filter(
      (page) =>
        String(page.pageLabel || '').toLowerCase().includes(term) ||
        String(page.pageKey || '').toLowerCase().includes(term)
    )
  }, [allPages, pageSearch])

  const activePermissionCountByRole = useMemo(
    () => Object.fromEntries(PROFILE_ORDER.map((role) => [role, permissionsByRole?.[role]?.size ?? 0])),
    [permissionsByRole]
  )

  const hasChanges = useMemo(() => {
    const current = permissionsByRole?.[selectedRole] || new Set()
    const initial = initialPermissionsByRole?.[selectedRole] || new Set()
    return !setsEqual(current, initial)
  }, [initialPermissionsByRole, permissionsByRole, selectedRole])

  const summaryData = useMemo(() => {
    const allowed = allPages.filter((page) => selectedPermissions.has(page.pageKey)).map((page) => page.pageLabel)
    const blocked = allPages.filter((page) => !selectedPermissions.has(page.pageKey)).map((page) => page.pageLabel)
    return {
      totalAllowed: allowed.length,
      totalBlocked: blocked.length,
      allowed,
      blocked,
    }
  }, [allPages, selectedPermissions])

  const togglePageAccess = (pageKey) => {
    setPermissionsByRole((prev) => {
      const next = clonePermissionsByRole(prev)
      if (!next[selectedRole]) next[selectedRole] = new Set()
      if (next[selectedRole].has(pageKey)) next[selectedRole].delete(pageKey)
      else next[selectedRole].add(pageKey)
      return next
    })
  }

  const handleSaveConfirmed = async () => {
    if (selectedProfile.roleId === null) {
      notify.error('Nao foi possivel identificar o role_id desse perfil.')
      return
    }

    const payload = {
      role_id: selectedProfile.roleId,
      // This screen edits only page access. Sending the full system permission matrix
      // makes the backend JSON payload unnecessarily large and breaks the PATCH flow.
      permissoes_sistema_json: [],
      paginas_permissoes_json: allPages
        .map((page) => ({
          pagina_key: page.pageKey,
          allow_view: selectedPermissions.has(page.pageKey),
          allow_consultar: false,
          allow_criar: false,
          allow_editar: false,
          allow_excluir: false,
          allow_exportar: false,
        }))
        .sort((a, b) => String(a.pagina_key).localeCompare(String(b.pagina_key), 'pt-BR')),
    }

    setIsSaving(true)
    try {
      const response = await fetch(`${API_BASE}/${SAVE_PATH}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `${SAVE_PATH}: HTTP ${response.status}`)
      }

      if (toNumberOrNull(user?.role_id ?? user?.roleId ?? null) === selectedProfile.roleId) {
        await refreshAccess()
      }

      setInitialPermissionsByRole(clonePermissionsByRole(permissionsByRole))
      setShowConfirmModal(false)
      notify.success(`Permissões do perfil ${selectedRole} enviadas com sucesso.`)
    } catch (err) {
      notify.error(`Não foi possível salvar: ${err?.message || 'erro desconhecido'}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />

      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link
              to="/dashboard"
              className="btn btn-ghost btn-sm d-flex align-items-center gap-2"
              title="Voltar ao Dashboard"
            >
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>

            <div>
              <h2 className="fw-bold mb-1">Permissões</h2>
              <div className="opacity-75 small">
                Defina por perfil quais páginas podem ser acessadas no sistema.
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="neo-card p-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <input
                  value={profileSearch}
                  onChange={(event) => setProfileSearch(event.target.value)}
                  className="form-control"
                  placeholder="Buscar perfil..."
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setProfileSearch('')}
                  aria-label="Limpar busca de perfil"
                  type="button"
                >
                  <Fi.FiX />
                </button>
              </div>

              {isLoading && <div className="text-center py-4 opacity-75">Carregando perfis...</div>}
              {error && <div className="alert alert-danger py-2">{String(error.message || error)}</div>}

              {!isLoading && !error && (
                <ul className="list-group permissions-list-scroll">
                  {filteredProfiles.map((profile) => (
                    <li
                      key={profile.role}
                      className={`list-group-item d-flex justify-content-between align-items-center ${selectedRole === profile.role ? 'active' : ''}`}
                      role="button"
                      onClick={() => setSelectedRole(profile.role)}
                    >
                      <span className="fw-semibold">{profile.role}</span>
                      <span className="small opacity-75 text-end">
                        {formatActivePermissionsLabelSafe(activePermissionCountByRole[profile.role] ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="neo-card p-4 h-100 d-flex flex-column">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="mb-1">{selectedProfile.role}</h5>
                  <div className="small opacity-75">Marque as páginas que esse perfil pode acessar.</div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className="badge text-bg-primary">{summaryData.totalAllowed} liberada(s)</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                    onClick={() => setShowConfirmModal(true)}
                    disabled={isLoading || isSaving || !hasChanges}
                  >
                    <Fi.FiSave size={14} />
                    Salvar
                  </button>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 mb-3">
                <input
                  value={pageSearch}
                  onChange={(event) => setPageSearch(event.target.value)}
                  className="form-control"
                  placeholder="Buscar página..."
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPageSearch('')}
                  aria-label="Limpar busca de página"
                  type="button"
                >
                  <Fi.FiX />
                </button>
              </div>

              {filteredPages.length === 0 ? (
                <div className="opacity-75">Nenhuma página encontrada para esse filtro.</div>
              ) : (
                <div className="permissions-editor-scroll pe-1">
                  {filteredPages.map((page) => {
                    const checked = selectedPermissions.has(page.pageKey)
                    return (
                      <div
                        key={page.pageKey}
                        className={`permissions-page-toggle-row ${checked ? 'is-enabled' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePageAccess(page.pageKey)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          togglePageAccess(page.pageKey)
                        }}
                      >
                        <div className="d-flex align-items-start gap-2">
                          <input
                            type="checkbox"
                            className="form-check-input mt-1"
                            checked={checked}
                            onChange={() => togglePageAccess(page.pageKey)}
                            onClick={(event) => event.stopPropagation()}
                          />
                          <div>
                            <div className="fw-semibold">{page.pageLabel}</div>
                            <div className="permissions-page-route-row">
                              <span className="small opacity-50">{page.route || 'Sem rota mapeada'}</span>
                              {page.route ? (
                                <a
                                  href={page.route}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="permissions-page-open-link"
                                  title="Abrir pagina em nova aba"
                                  aria-label={`Abrir ${page.pageLabel} em nova aba`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Fi.FiExternalLink size={13} />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <span className={`badge ${checked ? 'text-bg-success' : 'text-bg-secondary'}`}>
                          {checked ? 'Liberada' : 'Bloqueada'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showConfirmModal && (
        <div className="permissions-save-modal-overlay" role="dialog" aria-modal="true">
          <div className="neo-card permissions-save-modal">
            <div className="permissions-save-modal-header">
              <div>
                <h5 className="mb-1">Confirmar alterações</h5>
                <div className="small opacity-75">
                  Perfil <strong>{selectedRole}</strong> • {summaryData.totalAllowed} página(s) liberada(s)
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowConfirmModal(false)}
              >
                <Fi.FiX />
              </button>
            </div>

            <div className="permissions-save-modal-body">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="small text-uppercase opacity-75 mb-2">Páginas liberadas</div>
                  <div className="permissions-save-list">
                    {summaryData.allowed.length === 0 ? (
                      <div className="small opacity-75">Nenhuma página liberada.</div>
                    ) : (
                      summaryData.allowed.map((label) => (
                        <div className="permissions-save-list-item" key={`allow-${label}`}>
                          <Fi.FiCheckSquare size={14} className="text-success" />
                          <span>{label}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="small text-uppercase opacity-75 mb-2">Páginas bloqueadas</div>
                  <div className="permissions-save-list">
                    {summaryData.blocked.length === 0 ? (
                      <div className="small opacity-75">Nenhuma página bloqueada.</div>
                    ) : (
                      summaryData.blocked.map((label) => (
                        <div className="permissions-save-list-item" key={`block-${label}`}>
                          <Fi.FiSquare size={14} className="opacity-75" />
                          <span>{label}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

            <div className="permissions-save-modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveConfirmed} disabled={isSaving}>
                {isSaving ? 'Enviando...' : 'Confirmar e enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
