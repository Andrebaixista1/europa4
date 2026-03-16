const normalizeToken = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const normalizePath = (value) => {
  const path = String(value ?? '').trim().split('?')[0].split('#')[0]
  if (!path) return ''
  if (path === '/') return '/'
  return path.endsWith('/') ? path.slice(0, -1) : path
}

const createDefinition = (pageKey, route, aliases = []) => ({
  pageKey,
  route,
  aliases: Array.from(new Set([pageKey, ...aliases].map((item) => normalizeToken(item)).filter(Boolean))),
})

export const PAGE_ACCESS_ORDER = [
  'dashboard',
  'perfil',
  'consultas_clientes',
  'consultas_online',
  'cliente_argus',
  'historico_consultas',
  'usuarios',
  'equipes',
  'permissoes',
  'cadastros_apis',
  'teste',
  'recargas',
  'controle_planejamento',
  'extracoes',
  'backups',
]

export const PAGE_ACCESS_DEFINITIONS = Object.freeze({
  dashboard: createDefinition('dashboard', '/dashboard', ['dashboard.view']),
  perfil: createDefinition('perfil', '/perfil', ['perfil.view']),
  consultas_clientes: createDefinition('consultas_clientes', '/consultas/clientes', [
    'consulta_clientes',
    'consulta_cliente',
    'consulta.cliente',
    'consulta.clientes',
    'consultas.clientes',
    'consultas_clientes.view',
    'consulta_clientes.view',
    'consulta_cliente.view',
  ]),
  consultas_online: createDefinition('consultas_online', '/consultas/online', [
    'consulta_online',
    'consulta.online',
    'consultas.online',
    'consulta_online.view',
    'consultas_online.view',
  ]),
  cliente_argus: createDefinition('cliente_argus', '/consulta/cliente-argus', [
    'cliente.argus',
    'cliente_argus.view',
  ]),
  historico_consultas: createDefinition('historico_consultas', '/consultas/historico', [
    'historico.consultas',
    'historico_consultas.view',
  ]),
  recargas: createDefinition('recargas', '/recargas', ['recargas.view']),
  controle_planejamento: createDefinition('controle_planejamento', '/admin/controle-planejamento', [
    'controle.planejamento',
    'controle_planejamento.view',
  ]),
  extracoes: createDefinition('extracoes', '/admin/relatorios', [
    'relatorios',
    'relatorios.view',
    'extracoes.view',
  ]),
  usuarios: createDefinition('usuarios', '/usuarios', [
    'users',
    'user',
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
  ]),
  equipes: createDefinition('equipes', '/equipes', ['equipes.view', 'equipes.edit']),
  permissoes: createDefinition('permissoes', '/admin/permissoes', [
    'config',
    'config.view',
    'config.edit',
    'permissoes.view',
  ]),
  teste: createDefinition('teste', '/admin/teste', ['teste.view']),
  cadastros_apis: createDefinition('cadastros_apis', '/admin/cadastros-apis', ['cadastros_apis.view']),
  backups: createDefinition('backups', '/admin/backups', ['backups.view']),
  usuarios2: createDefinition('usuarios2', '/admin/usuarios-cadastro', ['usuarios2.view']),
})

const permissionSetFromUser = (user) =>
  new Set(
    (Array.isArray(user?.permissions) ? user.permissions : [])
      .map((item) => normalizeToken(item))
      .filter(Boolean)
  )

const pagePermissionSetFromUser = (user) =>
  new Set(
    (Array.isArray(user?.page_permissions) ? user.page_permissions : [])
      .map((item) => normalizeToken(item))
      .filter(Boolean)
  )

const pagePermissionStateMapFromUser = (user) => {
  const source = user?.page_permission_states
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}

  return Object.entries(source).reduce((acc, [rawKey, rawValue]) => {
    const pageKey = normalizeToken(rawKey)
    if (!pageKey) return acc
    acc[pageKey] = Boolean(rawValue)
    return acc
  }, {})
}

const hasGlobalAccess = (permissionSet) =>
  permissionSet.has('view:master') ||
  permissionSet.has('view:admin') ||
  permissionSet.has('manage:system') ||
  permissionSet.has('admin') ||
  permissionSet.has('master')

export function getPageAccessDefinition(pageKey) {
  return PAGE_ACCESS_DEFINITIONS[normalizeToken(pageKey)] ?? null
}

export function resolvePageKey(value) {
  const normalized = normalizeToken(value)
  if (PAGE_ACCESS_DEFINITIONS[normalized]) return normalized

  const path = normalizePath(value)
  if (!path) return ''

  for (const definition of Object.values(PAGE_ACCESS_DEFINITIONS)) {
    const route = normalizePath(definition.route)
    if (!route) continue
    if (path === route || path.startsWith(`${route}/`)) return definition.pageKey
  }

  return ''
}

export function canAccessPage(user, pageKeyOrPath) {
  if (!user) return false

  const pageKey = resolvePageKey(pageKeyOrPath)
  if (!pageKey) return false

  const definition = getPageAccessDefinition(pageKey)
  const permissionSet = permissionSetFromUser(user)
  const pagePermissionSet = pagePermissionSetFromUser(user)
  const pagePermissionStateMap = pagePermissionStateMapFromUser(user)
  if (Object.prototype.hasOwnProperty.call(pagePermissionStateMap, pageKey)) {
    return Boolean(pagePermissionStateMap[pageKey])
  }
  if (pagePermissionSet.has(pageKey)) return true
  if (definition?.aliases?.some((alias) => permissionSet.has(alias))) return true

  return hasGlobalAccess(permissionSet)
}

export function getAccessibleHomeRoute(user) {
  for (const pageKey of PAGE_ACCESS_ORDER) {
    if (!canAccessPage(user, pageKey)) continue
    const route = getPageAccessDefinition(pageKey)?.route
    if (route) return route
  }

  const dashboardRoute = getPageAccessDefinition('dashboard')?.route
  return canAccessPage(user, 'dashboard') ? dashboardRoute : null
}

export function getPageRoute(pageKey) {
  return getPageAccessDefinition(pageKey)?.route ?? ''
}
