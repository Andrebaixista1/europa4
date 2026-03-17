import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { normalizeRole, Roles } from '../utils/roles.js'

const AuthContext = createContext(null)

const API_BASE = 'http://85.31.61.242:8011/api'
const LOGIN_URL = `${API_BASE}/login`
const PERMISSOES_URL = `${API_BASE}/permissoes`
const PERMISSOES2_URL = `${API_BASE}/permissoes2`

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
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

const normalizePermissionToken = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const parsePermissionCsv = (value) =>
  String(value ?? '')
    .split(',')
    .map((token) => normalizePermissionToken(token))
    .filter(Boolean)

const pushActionTokensFromFlags = (list, pageKey, source) => {
  if (!pageKey || !source || typeof source !== 'object') return
  const key = normalizePermissionToken(pageKey)
  if (!key) return
  const canView = normalizeBoolean(source.allow_view) || normalizeBoolean(source.allow_consultar)
  if (canView) list.push(`${key}.view`)
  if (normalizeBoolean(source.allow_criar)) list.push(`${key}.create`)
  if (normalizeBoolean(source.allow_editar)) list.push(`${key}.edit`)
  if (normalizeBoolean(source.allow_excluir)) list.push(`${key}.delete`)
  if (normalizeBoolean(source.allow_exportar)) list.push(`${key}.export`)
}

const unwrapSqlJsonEnvelope = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return raw
  const first = raw[0]
  if (!first || typeof first !== 'object') return raw
  const key = Object.keys(first).find((item) => item.toUpperCase().startsWith('JSON_'))
  if (!key || typeof first[key] !== 'string') return raw
  try {
    return JSON.parse(first[key])
  } catch {
    return raw
  }
}

const parseJsonField = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

const normalizePermissionsList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    const tokens = []
    for (const item of value) {
      if (item === null || item === undefined) continue
      if (typeof item === 'object') {
        if (item.allowed === false || item.allowed === 0 || item.allowed === '0') continue
        const rawToken =
          item.slug ??
          item.nome ??
          item.permission ??
          item.permissao ??
          item.pagina_key ??
          item.page_key ??
          item.permissoes ??
          item.permissoes_sistema
        if (typeof rawToken === 'string' && rawToken.includes(',')) {
          tokens.push(...parsePermissionCsv(rawToken))
          continue
        }
        const normalized = normalizePermissionToken(rawToken)
        if (normalized) tokens.push(normalized)
        continue
      }
      tokens.push(...parsePermissionCsv(item))
    }
    return tokens
  }
  return parsePermissionCsv(value)
}

const extractPermissionsFromPermissoesApi = (records = []) => {
  const output = []

  for (const row of Array.isArray(records) ? records : []) {
    if (row === null || row === undefined) continue

    if (typeof row !== 'object') {
      output.push(...parsePermissionCsv(row))
      continue
    }

    output.push(...parsePermissionCsv(row.permissoes))
    output.push(...parsePermissionCsv(row.permissoes_sistema))

    const rowPageKey = normalizePermissionToken(row.pagina_key ?? row.page_key ?? '')
    if (rowPageKey) output.push(rowPageKey)
    pushActionTokensFromFlags(output, rowPageKey, row)

    const jsonCollections = [
      parseJsonField(row.permissoes_json, []),
      parseJsonField(row.permissoes_sistema_json, []),
      parseJsonField(row.permissoes_matriz_json, []),
      parseJsonField(row.paginas_permissoes_json, []),
    ]

    for (const collection of jsonCollections) {
      if (!Array.isArray(collection)) continue
      for (const item of collection) {
        if (item === null || item === undefined) continue
        if (typeof item === 'string') {
          output.push(...parsePermissionCsv(item))
          continue
        }
        if (typeof item !== 'object') {
          output.push(...parsePermissionCsv(item))
          continue
        }
        if (Object.prototype.hasOwnProperty.call(item, 'allowed') && !normalizeBoolean(item.allowed)) {
          continue
        }

        const rawToken =
          item.slug ??
          item.permission ??
          item.permissao ??
          item.pagina_key ??
          item.page_key ??
          item.nome
        const token = normalizePermissionToken(rawToken)
        if (token) output.push(token)

        const pageKey = normalizePermissionToken(item.pagina_key ?? item.page_key ?? rowPageKey)
        if (pageKey) output.push(pageKey)
        pushActionTokensFromFlags(output, pageKey, item)
      }
    }
  }

  return Array.from(new Set(output.map((token) => normalizePermissionToken(token)).filter(Boolean)))
}

const selectPermissoesRowsForUser = (input, records = []) => {
  const collection = Array.isArray(records) ? records : []
  if (collection.length === 0) return []

  const targetUserId = toNumberOrNull(input?.id_user ?? input?.id ?? input?.user_id ?? null)
  const targetLogin = normalizePermissionToken(input?.login ?? input?.Login ?? '')

  const byId =
    targetUserId === null
      ? []
      : collection.filter((row) => toNumberOrNull(row?.id_user ?? row?.id ?? row?.user_id ?? null) === targetUserId)

  if (byId.length > 0) return byId

  const byLogin = targetLogin
    ? collection.filter((row) => normalizePermissionToken(row?.login ?? row?.Login ?? row?.usuario_login ?? '') === targetLogin)
    : []

  if (byLogin.length > 0) return byLogin

  return []
}

const hasAnyAllowedPageAction = (item) =>
  normalizeBoolean(item?.allow_view) ||
  normalizeBoolean(item?.allow_consultar) ||
  normalizeBoolean(item?.allow_criar) ||
  normalizeBoolean(item?.allow_editar) ||
  normalizeBoolean(item?.allow_excluir) ||
  normalizeBoolean(item?.allow_exportar)

const extractAllowedPageKeys = (records = []) => {
  const output = []

  for (const item of Array.isArray(records) ? records : []) {
    if (!item || typeof item !== 'object') continue
    const pageKey = normalizePermissionToken(item.pagina_key ?? item.page_key ?? item.slug ?? item.nome)
    if (!pageKey || !hasAnyAllowedPageAction(item)) continue
    output.push(pageKey)
  }

  return Array.from(new Set(output))
}

const normalizePagePermissionStates = (value) => {
  if (!value) return {}

  if (Array.isArray(value)) {
    return value.reduce((acc, item) => {
      if (!item || typeof item !== 'object') return acc
      const pageKey = normalizePermissionToken(item.pagina_key ?? item.page_key ?? item.pageKey ?? item.slug ?? item.nome)
      if (!pageKey) return acc
      acc[pageKey] = hasAnyAllowedPageAction(item)
      return acc
    }, {})
  }

  if (typeof value !== 'object') return {}

  return Object.entries(value).reduce((acc, [rawKey, rawValue]) => {
    const pageKey = normalizePermissionToken(rawKey)
    if (!pageKey) return acc
    if (rawValue && typeof rawValue === 'object') acc[pageKey] = hasAnyAllowedPageAction(rawValue)
    else acc[pageKey] = normalizeBoolean(rawValue)
    return acc
  }, {})
}

const resolvePermissoes2RoleEntry = (input, extras = {}) => {
  if (extras?.permissoes2_role && typeof extras.permissoes2_role === 'object') {
    return extras.permissoes2_role
  }

  const roles = Array.isArray(extras?.permissoes2) ? extras.permissoes2 : []
  if (roles.length === 0) return null

  const normalizedRoleId = toNumberOrNull(input?.role_id ?? input?.roleId ?? null)
  const normalizedRoleSlug = normalizePermissionToken(input?.role_slug ?? input?.role ?? '')
  const normalizedRoleName = normalizePermissionToken(input?.role_nome ?? input?.role ?? '')
  const normalizedLevel = toNumberOrNull(input?.nivel_hierarquia ?? input?.level ?? input?.nivel ?? null)

  return (
    roles.find((item) => normalizedRoleId !== null && toNumberOrNull(item?.id ?? null) === normalizedRoleId) ??
    roles.find((item) => normalizedRoleSlug && normalizePermissionToken(item?.slug ?? '') === normalizedRoleSlug) ??
    roles.find((item) => normalizedRoleName && normalizePermissionToken(item?.nome ?? item?.role ?? '') === normalizedRoleName) ??
    roles.find((item) => normalizedLevel !== null && toNumberOrNull(item?.nivel ?? null) === normalizedLevel) ??
    null
  )
}

const deriveRoleFromProfile = (rawRole, level, permissionsList = []) => {
  const normalizedPermissions = permissionsList
    .map((permission) => {
      const available = typeof permission.normalize === 'function' ? permission.normalize('NFD') : String(permission)
      return available.replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    })
    .filter(Boolean)

  let resolved = normalizeRole(rawRole, level)
  if (resolved) return resolved

  if (normalizedPermissions.some((item) => item.startsWith('manage:') || item.endsWith('.edit') || item.endsWith('.create') || item.endsWith('.delete'))) {
    return Roles.Administrador
  }
  if (normalizedPermissions.some((item) => item.includes('supervision') || item.includes('supervisor'))) {
    return Roles.Supervisor
  }
  return Roles.Operador
}

const normalizeApiCollection = (raw) => {
  const data = unwrapSqlJsonEnvelope(raw)
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.items)) return data.items
  return []
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

const fetchAccessCollections = async (idUser) => {
  const [permissoes, permissoes2] = await Promise.all([
    fetchCollection(PERMISSOES_URL, idUser).catch(() => []),
    fetchCollection(PERMISSOES2_URL, idUser).catch(() => []),
  ])

  return { permissoes, permissoes2 }
}

const fetchCollection = async (url, idUser) => {
  const requestUrl = new URL(url)
  if (idUser !== null && idUser !== undefined && idUser !== '') {
    requestUrl.searchParams.set('id_user', String(idUser))
  }
  const response = await fetch(requestUrl.toString(), { method: 'GET' })
  if (!response.ok) {
    throw new Error(`${requestUrl.pathname}: HTTP ${response.status}`)
  }
  const payload = await safeJson(response)
  return normalizeApiCollection(payload)
}

const extractLoginPayload = (raw) => {
  const data = unwrapSqlJsonEnvelope(raw)
  if (!data) return null
  if (Array.isArray(data)) return data[0] ?? null
  if (data.user && typeof data.user === 'object') return { ...data, ...data.user }
  if (Array.isArray(data.data)) return data.data[0] ?? null
  if (data.data && typeof data.data === 'object') return { ...data, ...data.data }
  return data
}

const normalizeUserPayload = (input, extras = {}) => {
  const idValue = input?.id_user ?? input?.id ?? input?.user_id ?? null
  const normalizedId = toNumberOrNull(idValue) ?? idValue
  const rawEquipeId = input?.equipe_id ?? input?.team_id ?? input?.equipeId ?? input?.teamId ?? null
  const normalizedEquipeId = toNumberOrNull(rawEquipeId) ?? rawEquipeId
  const level = input?.nivel_hierarquia ?? input?.level ?? input?.NivelHierarquia ?? null

  const rawJsonPermissions = parseJsonField(input?.permissoes_json, [])
  const rawMatrixPermissions = parseJsonField(input?.permissoes_matriz_json, [])
  const rawStoredPagePermissions = parseJsonField(input?.page_permissions, [])
  const rawStoredPagePermissionStates = parseJsonField(input?.page_permission_states, {})
  const matchedPermissoesRows = selectPermissoesRowsForUser(input, extras?.permissoes ?? [])
  const csvPermissions = normalizePermissionsList(input?.permissoes)
  const jsonPermissions = normalizePermissionsList(rawJsonPermissions)
  const matrixPermissions = normalizePermissionsList(rawMatrixPermissions)
  const apiPermissions = extractPermissionsFromPermissoesApi(matchedPermissoesRows)
  const matchedRoleConfig = resolvePermissoes2RoleEntry(input, extras)
  const rolePagePermissionRecords = parseJsonField(
    matchedRoleConfig?.paginas_permissoes_json,
    matchedRoleConfig?.paginas_permissoes_json ?? []
  )
  const rolePagePermissions = extractAllowedPageKeys(rolePagePermissionRecords)
  const rolePagePermissionStates = normalizePagePermissionStates(rolePagePermissionRecords)
  const storedPagePermissionStates = normalizePagePermissionStates(rawStoredPagePermissionStates)
  const storedPagePermissions = Array.isArray(rawStoredPagePermissions)
    ? rawStoredPagePermissions.map((item) => normalizePermissionToken(item)).filter(Boolean)
    : []
  const explicitPagePermissionStates =
    Object.keys(rolePagePermissionStates).length > 0 ? rolePagePermissionStates : storedPagePermissionStates
  const explicitAllowedPageKeys = Object.entries(explicitPagePermissionStates)
    .filter(([, allowed]) => Boolean(allowed))
    .map(([pageKey]) => pageKey)
  const mergedPagePermissions = Array.from(new Set([...storedPagePermissions, ...rolePagePermissions]))
  const resolvedPagePermissions =
    Object.keys(explicitPagePermissionStates).length > 0
      ? explicitAllowedPageKeys
      : mergedPagePermissions
  const mergedPermissions = Array.from(
    new Set(
      [...csvPermissions, ...jsonPermissions, ...matrixPermissions, ...apiPermissions, ...resolvedPagePermissions]
        .map(normalizePermissionToken)
        .filter(Boolean)
    )
  )

  const role = deriveRoleFromProfile(
    input?.role ?? input?.role_nome ?? input?.role_slug ?? input?.Role,
    level,
    mergedPermissions
  )

  return {
    id: normalizedId,
    id_user: normalizedId,
    name: input?.nome ?? input?.name ?? input?.Nome ?? '',
    login: input?.login ?? input?.Login ?? '',
    email: input?.email ?? input?.Email ?? '',
    role,
    role_slug: input?.role_slug ?? '',
    role_nome: input?.role_nome ?? input?.role ?? '',
    role_id: toNumberOrNull(input?.role_id ?? null),
    level: level ?? 3,
    nivel_hierarquia: level ?? 3,
    permissions: mergedPermissions,
    page_permissions: resolvedPagePermissions,
    page_permission_states: explicitPagePermissionStates,
    permissoes_json: Array.isArray(rawJsonPermissions) ? rawJsonPermissions : [],
    permissoes_matriz_json: Array.isArray(rawMatrixPermissions) ? rawMatrixPermissions : [],
    equipe_id: normalizedEquipeId,
    equipe_nome: input?.equipe_nome ?? input?.team_name ?? null,
    is_supervisor: normalizeBoolean(input?.is_supervisor ?? false),
    status: input?.status_conta ?? 'VALID',
    status_conta: input?.status_conta ?? 'VALID',
    ativo: normalizeBoolean(input?.ativo ?? true),
    success: normalizeBoolean(input?.sucesso ?? input?.success ?? true),
    mensagem: input?.mensagem ?? input?.message ?? '',
    data_ultimo_login: input?.data_ultimo_login ?? input?.last_login_at ?? null,
    lastLogin: input?.data_ultimo_login ?? input?.last_login_at ?? null,
    created_at: input?.created_at ?? null,
    updated_at: input?.updated_at ?? null,
    loginTime: new Date().toISOString(),
    api: {
      permissoes: matchedPermissoesRows,
      permissoes2_role: matchedRoleConfig ?? null
    }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const refreshAccess = async (baseUser = null) => {
    const currentUser = baseUser ?? user
    if (!currentUser) return null

    const currentUserId = toNumberOrNull(currentUser?.id_user ?? currentUser?.id ?? null)
    if (currentUserId === null) return currentUser

    const extras = await fetchAccessCollections(currentUserId)
    const refreshed = normalizeUserPayload(currentUser, extras)
    setUser(refreshed)
    localStorage.setItem('ne_auth_user', JSON.stringify(refreshed))
    return refreshed
  }

  useEffect(() => {
    let cancelled = false
    const saved = localStorage.getItem('ne_auth_user')
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      const normalized = normalizeUserPayload(parsed, parsed?.api ?? {})
      setUser(normalized)
      localStorage.setItem('ne_auth_user', JSON.stringify(normalized))

      const savedUserId = toNumberOrNull(normalized?.id_user ?? normalized?.id ?? null)
      if (savedUserId !== null) {
        ;(async () => {
          try {
            const extras = await fetchAccessCollections(savedUserId)
            if (cancelled) return
            const refreshed = normalizeUserPayload(parsed, extras)
            setUser(refreshed)
            localStorage.setItem('ne_auth_user', JSON.stringify(refreshed))
          } catch {
            // Keep the cached session when the access refresh fails.
          }
        })()
      }
    } catch {
      localStorage.removeItem('ne_auth_user')
    }

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (loginUser, password) => {
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: String(loginUser ?? '').trim(),
        password: String(password ?? '')
      })
    })

    const loginRaw = await safeJson(response)
    if (!response.ok) {
      const message = loginRaw?.mensagem || loginRaw?.message || `HTTP ${response.status}`
      throw new Error(message)
    }

    const loginData = extractLoginPayload(loginRaw)
    if (!loginData) {
      throw new Error('Resposta de autenticacao vazia.')
    }

    const statusConta = String(loginData?.status_conta ?? '').toUpperCase()
    const isSuccess = loginData?.sucesso === undefined ? true : normalizeBoolean(loginData?.sucesso)
    const allowedStatus = new Set(['VALID', 'ACTIVE', 'SUCCESS', 'PERMITTED'])
    if (!isSuccess || (statusConta && !allowedStatus.has(statusConta))) {
      const message = loginData?.mensagem || loginData?.message || 'Login ou senha invalidos.'
      throw new Error(message)
    }

    const idUser = toNumberOrNull(loginData?.id_user ?? loginData?.id ?? null)
    const extras = await fetchAccessCollections(idUser)
    const payload = normalizeUserPayload(loginData, extras)
    setUser(payload)
    localStorage.setItem('ne_auth_user', JSON.stringify(payload))
    return payload
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('ne_auth_user')
  }

  const value = useMemo(() => ({ user, login, logout, refreshAccess, isAuthenticated: !!user }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
