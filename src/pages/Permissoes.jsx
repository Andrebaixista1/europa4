import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiArrowLeft,
  FiCheck,
  FiDatabase,
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiEdit2,
  FiGrid,
  FiHome,
  FiPlusCircle,
  FiSearch,
  FiShield,
  FiSliders,
  FiUser,
  FiUsers,
  FiX
} from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

const SCOPE_OPTIONS = [
  { key: 'setor', label: 'Equipe', icon: FiShield }
]

const SCOPE_LABELS = {
  setor: 'Equipe'
}

const TARGETS_BY_SCOPE = {
  setor: []
}

const PAGE_CATALOG = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'consultas_clientes', label: 'Consulta Clientes' },
  { key: 'consultas_in100', label: 'Consulta Individual (IN100)' },
  { key: 'cliente_argus', label: 'Cliente Argus' },
  { key: 'historico_consultas', label: 'Histórico de Consultas' },
  { key: 'consultas_presenca', label: 'Consulta Presença' },
  { key: 'consultas_handmais', label: 'Consulta Hand+' },
  { key: 'consultas_prata', label: 'Consulta Prata' },
  { key: 'consultas_v8', label: 'Consultas V8' },
  { key: 'recargas', label: 'Gestão de Recargas' },
  { key: 'controle_planejamento', label: 'Controle Planejamento' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'equipes', label: 'Equipes' },
  { key: 'usuarios2', label: 'Usuários 2' },
  { key: 'permissoes', label: 'Equipes e Permissões' },
  { key: 'backups', label: 'Backups' }
]

const PAGE_CAPABILITIES = {
  dashboard: { consultar: true },
  consultas_clientes: { consultar: true },
  consultas_in100: { consultar: true },
  cliente_argus: { consultar: true },
  historico_consultas: { consultar: true, exportar: true },
  consultas_presenca: { consultar: true },
  consultas_handmais: { consultar: true },
  consultas_prata: { consultar: true },
  consultas_v8: { consultar: true },
  recargas: { consultar: true, criar: true, editar: true, excluir: true },
  controle_planejamento: { consultar: true, criar: true, editar: true, excluir: true },
  usuarios: { consultar: true, criar: true, editar: true, excluir: true },
  equipes: { consultar: true, criar: true, editar: true, excluir: true },
  usuarios2: { consultar: true, criar: true, editar: true, excluir: true },
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

const PERMISSIONS_API_ENDPOINTS = {
  equipes: 'https://n8n.apivieiracred.store/webhook/api/getequipes',
  usuarios: 'https://n8n.apivieiracred.store/webhook/api/getusuarios'
}

const PERMISSION_GROUPS = [
  { key: 'visao_geral', label: 'Visão Geral', pages: ['dashboard'] },
  {
    key: 'consultas',
    label: 'Consultas',
    pages: [
      'consultas_clientes',
      'consultas_in100',
      'cliente_argus',
      'historico_consultas',
      'consultas_presenca',
      'consultas_handmais',
      'consultas_prata',
      'consultas_v8'
    ]
  },
  { key: 'gestao', label: 'Gestão', pages: ['recargas', 'controle_planejamento'] },
  { key: 'configuracoes', label: 'Configurações', pages: ['usuarios', 'equipes', 'usuarios2', 'permissoes', 'backups'] }
]

const GROUP_ICON_MAP = {
  visao_geral: FiGrid,
  consultas: FiSearch,
  gestao: FiUsers,
  configuracoes: FiSliders
}

const PAGE_ICON_MAP = {
  dashboard: FiHome,
  consultas_clientes: FiSearch,
  consultas_in100: FiSearch,
  cliente_argus: FiSearch,
  historico_consultas: FiSearch,
  consultas_presenca: FiSearch,
  consultas_handmais: FiSearch,
  consultas_prata: FiSearch,
  consultas_v8: FiSearch,
  recargas: FiDatabase,
  controle_planejamento: FiGrid,
  usuarios: FiUser,
  equipes: FiUsers,
  usuarios2: FiUsers,
  permissoes: FiShield,
  backups: FiDatabase
}

const ACTION_ICON_MAP = {
  consultar: FiSearch,
  criar: FiPlusCircle,
  editar: FiEdit2,
  excluir: FiX,
  exportar: FiDownload
}

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

pageKeyAliases[normalizeToken('consultas_in100')] = 'consultas_in100'
pageKeyAliases[normalizeToken('consultas_prata')] = 'consultas_prata'
pageKeyAliases[normalizeToken('consultas_presenca')] = 'consultas_presenca'
pageKeyAliases[normalizeToken('consultas_handmais')] = 'consultas_handmais'
pageKeyAliases[normalizeToken('consultas_v8')] = 'consultas_v8'
pageKeyAliases[normalizeToken('consulta_clientes')] = 'consultas_clientes'
pageKeyAliases[normalizeToken('cliente_argus')] = 'cliente_argus'
pageKeyAliases[normalizeToken('historico_consultas')] = 'historico_consultas'
pageKeyAliases[normalizeToken('controle_planejamento')] = 'controle_planejamento'
pageKeyAliases[normalizeToken('usuarios2')] = 'usuarios2'

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
  extras: { readOnly: false, forceMfa: false, timeWindow: false },
  pageRules: {}
})

const buildPageRule = (pageKey, inputRule = {}, fallbackView = undefined) => {
  const cap = PAGE_CAPABILITIES[pageKey] || {}
  const rawView = inputRule?.view ?? inputRule?.allow_view ?? inputRule?.allowView ?? inputRule?.allow
  const view = fallbackView !== undefined ? Boolean(fallbackView) : toBool(rawView)

  const consultarValue = inputRule?.consultar ?? inputRule?.allow_consultar ?? inputRule?.allowConsultar
  const criarValue = inputRule?.criar ?? inputRule?.allow_criar ?? inputRule?.allowCriar
  const editarValue = inputRule?.editar ?? inputRule?.allow_editar ?? inputRule?.allowEditar
  const excluirValue = inputRule?.excluir ?? inputRule?.allow_excluir ?? inputRule?.allowExcluir
  const exportarValue = inputRule?.exportar ?? inputRule?.allow_exportar ?? inputRule?.allowExportar

  return {
    view,
    consultar: view && Boolean(cap.consultar) && (consultarValue === undefined ? true : toBool(consultarValue)),
    criar: view && Boolean(cap.criar) && toBool(criarValue),
    editar: view && Boolean(cap.editar) && toBool(editarValue),
    excluir: view && Boolean(cap.excluir) && toBool(excluirValue),
    exportar: view && Boolean(cap.exportar) && toBool(exportarValue)
  }
}

const createPageRulesFromConfig = (cfg) => {
  const next = {}
  PAGE_CATALOG.forEach((page) => {
    const fallbackView = Boolean(cfg?.pages?.[page.key] ?? cfg?.pageRules?.[page.key]?.view)
    next[page.key] = buildPageRule(page.key, cfg?.pageRules?.[page.key], fallbackView)
  })
  return next
}

const ensurePresetShape = (input) => {
  const base = createEmptyPreset()
  const next = { ...base, pageRules: {} }

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

  next.pageRules = createPageRulesFromConfig(next)

  if (input?.pageRules && typeof input.pageRules === 'object') {
    Object.entries(input.pageRules).forEach(([rawKey, rawRule]) => {
      const key = normalizePageKey(rawKey)
      if (!key) return
      const fallbackView = Boolean(next.pages[key])
      const nextRule = buildPageRule(key, rawRule, fallbackView)
      next.pageRules[key] = nextRule
      next.pages[key] = Boolean(nextRule.view)
    })
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

  const targetsByScope = { setor: [], usuario: [] }
  const presetsByScope = { setor: {}, usuario: {} }
  let appliedRows = 0

  const upsertPreset = (scope, target, partial) => {
    if (!scope || !target) return
    if (!targetsByScope[scope] || !presetsByScope[scope]) return
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
      extras: { ...current.extras, ...(partial?.extras || {}) },
      pageRules: { ...current.pageRules, ...(partial?.pageRules || {}) }
    })
    appliedRows += 1
  }

  const directSource = payload?.data || payload
  for (const scopeKey of ['setor', 'usuario']) {
    const scopeBlock = directSource?.[scopeKey]
    if (scopeBlock && typeof scopeBlock === 'object' && !Array.isArray(scopeBlock)) {
      Object.entries(scopeBlock).forEach(([target, cfg]) => {
        upsertPreset(scopeKey, String(target).trim(), cfg)
      })
    }
  }

  let rowsCandidate =
    (Array.isArray(directSource?.rules) && directSource.rules) ||
    (Array.isArray(directSource?.permissoes) && directSource.permissoes) ||
    (Array.isArray(directSource?.rows) && directSource.rows) ||
    (Array.isArray(directSource) && directSource) ||
    []

  const hasTablesShape = Boolean(
    Array.isArray(directSource?.usuarios) ||
    Array.isArray(directSource?.equipes) ||
    Array.isArray(directSource?.paginas_catalogo) ||
    Array.isArray(directSource?.paginasCatalogo) ||
    Array.isArray(directSource?.regras_paginas) ||
    Array.isArray(directSource?.regrasPaginas) ||
    Array.isArray(directSource?.regras)
  )

  if (hasTablesShape) {
    const usuarios = Array.isArray(directSource?.usuarios) ? directSource.usuarios : []
    const equipes = Array.isArray(directSource?.equipes) ? directSource.equipes : []
    const regras = Array.isArray(directSource?.regras) ? directSource.regras : []
    const regrasPaginas = Array.isArray(directSource?.regras_paginas)
      ? directSource.regras_paginas
      : (Array.isArray(directSource?.regrasPaginas) ? directSource.regrasPaginas : [])
    const paginasCatalogo = Array.isArray(directSource?.paginas_catalogo)
      ? directSource.paginas_catalogo
      : (Array.isArray(directSource?.paginasCatalogo) ? directSource.paginasCatalogo : [])

    const equipeById = new Map(
      equipes.map((item) => [String(item?.id ?? ''), item])
    )
    const usuarioById = new Map(
      usuarios.map((item) => [String(item?.id ?? ''), item])
    )
    const regraById = new Map(
      regras.map((item) => [String(item?.id ?? ''), item])
    )

    equipes.forEach((item) => {
      const name = String(item?.nome ?? item?.descricao ?? '').trim()
      if (name) upsertPreset('setor', name, {})
    })

    usuarios.forEach((item) => {
      const name = String(item?.login ?? item?.nome ?? item?.id ?? '').trim()
      if (name) upsertPreset('usuario', name, {})
    })

    const mapRegraScope = (regra) => {
      const rawScope = normalizeScope(regra?.escopo_tipo ?? regra?.scope ?? regra?.escopo)
      if (rawScope === 'usuario' || rawScope === 'setor') return rawScope
      if (regra?.usuario_id_alvo !== null && regra?.usuario_id_alvo !== undefined) return 'usuario'
      if (regra?.equipe_id_alvo !== null && regra?.equipe_id_alvo !== undefined) return 'setor'
      return ''
    }

    const mergedRuleRows = regrasPaginas.map((row) => {
      const regraId = String(row?.regra_id ?? row?.rule_id ?? '')
      const regra = regraById.get(regraId)
      const scope = mapRegraScope(regra)
      const equipeAlvo = equipeById.get(String(regra?.equipe_id_alvo ?? ''))
      const usuarioAlvo = usuarioById.get(String(regra?.usuario_id_alvo ?? ''))
      return {
        ...row,
        escopo_tipo: scope,
        equipe_nome: row?.equipe_nome ?? equipeAlvo?.nome ?? '',
        setor: row?.setor ?? equipeAlvo?.nome ?? '',
        usuario_login: row?.usuario_login ?? usuarioAlvo?.login ?? usuarioAlvo?.nome ?? '',
        usuario_id: row?.usuario_id ?? regra?.usuario_id_alvo ?? '',
        role_alvo: row?.role_alvo ?? regra?.role_alvo ?? ''
      }
    })

    rowsCandidate = [
      ...equipes,
      ...usuarios,
      ...paginasCatalogo,
      ...mergedRuleRows
    ]
  }

  const rows = []
  const seenRows = new Set()
  rowsCandidate.forEach((row) => {
    if (!row || typeof row !== 'object') return

    const pageKey = normalizePageKey(row.pagina_key ?? row.page_key ?? row.page)
    const ruleId = String(row.regra_id ?? row.rule_id ?? '').trim()
    const userKey = String(row.login ?? row.usuario_login ?? row.usuario_nome ?? row.usuario_id ?? '').trim()
    const teamKey = String(row.equipe_nome ?? row.setor ?? row.nome ?? '').trim()

    let dedupeKey = ''
    if (ruleId && pageKey) {
      dedupeKey = `rule-page|${ruleId}|${pageKey}`
    } else if (pageKey && (row.suporta_consultar !== undefined || row.pagina_nome || row.rota)) {
      dedupeKey = `catalog-page|${pageKey}`
    } else if (userKey && !ruleId && !pageKey) {
      dedupeKey = `user|${normalizeToken(userKey)}`
    } else if (teamKey && !ruleId && !pageKey) {
      dedupeKey = `team|${normalizeToken(teamKey)}`
    } else {
      dedupeKey = `row|${JSON.stringify(row)}`
    }

    if (seenRows.has(dedupeKey)) return
    seenRows.add(dedupeKey)
    rows.push(row)
  })

  const rulePagesByRuleId = new Map()

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return

    const scope = normalizeScope(row.escopo_tipo ?? row.scope ?? row.escopo)
    const explicitTargetRaw =
      row.alvo ??
      row.target ??
      row.role_alvo ??
      row.setor ??
      row.equipe_nome ??
      row.equipe_id ??
      row.usuario_login ??
      row.usuario_id
    const explicitTarget = explicitTargetRaw !== undefined && explicitTargetRaw !== null
      ? String(explicitTargetRaw).trim()
      : ''

    const userTargetRaw = row.login ?? row.usuario_login ?? row.usuario_nome ?? row.usuario_id
    const userTarget = userTargetRaw !== undefined && userTargetRaw !== null ? String(userTargetRaw).trim() : ''
    const teamTargetRaw = row.equipe_nome ?? row.setor ?? row.equipe_id
    const teamTarget = teamTargetRaw !== undefined && teamTargetRaw !== null ? String(teamTargetRaw).trim() : ''
    const rowRuleId = String(row.regra_id ?? row.rule_id ?? '').trim()

    const partial = { pages: {}, apis: {}, extras: {}, pageRules: {} }

    const pageKey = normalizePageKey(row.pagina_key ?? row.page_key ?? row.page)
    if (pageKey) {
      const view = toBool(row.allow_view ?? row.allowView ?? row.view ?? 0)
      partial.pages[pageKey] = view
      partial.pageRules[pageKey] = buildPageRule(pageKey, row, view)

      if (rowRuleId) {
        if (!rulePagesByRuleId.has(rowRuleId)) rulePagesByRuleId.set(rowRuleId, [])
        rulePagesByRuleId.get(rowRuleId).push(row)
      }
    }

    const apiKey = normalizeApiKey(row.api_key ?? row.endpoint_key ?? row.api)
    if (apiKey) {
      partial.apis[apiKey] = toBool(row.allow_use ?? row.allowUse ?? row.allow_view ?? 0)
    }

    const paginasList = Array.isArray(row.paginas)
      ? row.paginas
      : (typeof row.paginas === 'string' ? (parseJsonSafe(row.paginas) || []) : [])

    if (Array.isArray(paginasList)) {
      paginasList.forEach((p) => {
        const key = normalizePageKey(p?.pagina_key ?? p?.key ?? p)
        if (!key) return
        const view = toBool(p?.allow_view ?? p?.allow ?? true)
        partial.pages[key] = view
        partial.pageRules[key] = buildPageRule(key, p, view)
      })
    }

    if (Array.isArray(row.apis)) {
      row.apis.forEach((a) => {
        const key = normalizeApiKey(a?.api_key ?? a?.key ?? a)
        if (!key) return
        partial.apis[key] = toBool(a?.allow_use ?? a?.allow ?? true)
      })
    }

    const isStandaloneTeam = Boolean(
      row.nome &&
      !row.login &&
      !row.usuario_login &&
      !row.usuario_id &&
      !row.pagina_key &&
      !row.page_key &&
      !row.page &&
      !row.regra_id &&
      !row.rule_id &&
      !row.escopo_tipo &&
      !row.scope &&
      !row.escopo
    )
    if (isStandaloneTeam) {
      const teamName = String(row.nome).trim()
      if (teamName) upsertPreset('setor', teamName, {})
    }

    const isStandaloneUser = Boolean(
      (row.login || row.usuario_login || row.usuario_nome || row.usuario_id) &&
      !row.pagina_key &&
      !row.page_key &&
      !row.page &&
      !row.regra_id &&
      !row.rule_id &&
      !row.escopo_tipo &&
      !row.scope &&
      !row.escopo
    )
    if (isStandaloneUser) {
      const userName = String(row.login ?? row.usuario_login ?? row.usuario_nome ?? row.usuario_id).trim()
      if (userName) upsertPreset('usuario', userName, {})
    }

    const targetsToApply = []
    if (scope && explicitTarget) targetsToApply.push({ scope, target: explicitTarget })
    if (userTarget) targetsToApply.push({ scope: 'usuario', target: userTarget })
    if (teamTarget) targetsToApply.push({ scope: 'setor', target: teamTarget })

    const uniq = new Set()
    targetsToApply.forEach((item) => {
      const id = `${item.scope}|${item.target}`
      if (uniq.has(id)) return
      uniq.add(id)
      upsertPreset(item.scope, item.target, partial)
    })
  })

  const hasAnyPageRules = Object.values(presetsByScope).some((scopeBlock) =>
    Object.values(scopeBlock || {}).some((preset) => Object.keys(preset?.pageRules || {}).length > 0)
  )

  if (!hasAnyPageRules && rulePagesByRuleId.size > 0) {
    const applyRuleRowsToTarget = (scopeKey, targetKey, ruleRows) => {
      if (!scopeKey || !targetKey || !Array.isArray(ruleRows) || ruleRows.length === 0) return
      const partial = { pages: {}, apis: {}, extras: {}, pageRules: {} }
      ruleRows.forEach((ruleRow) => {
        const key = normalizePageKey(ruleRow.pagina_key ?? ruleRow.page_key ?? ruleRow.page)
        if (!key) return
        const view = toBool(ruleRow.allow_view ?? ruleRow.allowView ?? ruleRow.view ?? 0)
        partial.pages[key] = view
        partial.pageRules[key] = buildPageRule(key, ruleRow, view)
      })
      upsertPreset(scopeKey, targetKey, partial)
    }

    const ruleIds = Array.from(rulePagesByRuleId.keys())
    const teamTargets = Array.isArray(targetsByScope.setor) ? targetsByScope.setor.filter(Boolean) : []

    if (teamTargets.length > 0) {
      teamTargets.forEach((teamName, index) => {
        const ruleId = ruleIds[Math.min(index, ruleIds.length - 1)]
        applyRuleRowsToTarget('setor', teamName, rulePagesByRuleId.get(ruleId))
      })
    } else {
      const firstRuleId = ruleIds[0]
      applyRuleRowsToTarget('setor', `Regra ${firstRuleId}`, rulePagesByRuleId.get(firstRuleId))
    }
  }

  const hasAnyTarget = Object.values(targetsByScope).some((list) => list.length > 0)
  if (!hasAnyTarget) return null

  const defaultScope = ['setor', 'usuario'].find((scopeKey) => targetsByScope[scopeKey]?.length > 0) || 'setor'
  const defaultTarget = targetsByScope[defaultScope]?.[0] || ''
  return { targetsByScope, presetsByScope, appliedRows, defaultScope, defaultTarget }
}

export default function Permissoes() {
  const [scope, setScope] = useState('setor')
  const [target, setTarget] = useState('')
  const [selectedPage, setSelectedPage] = useState(PAGE_CATALOG[0].key)
  const [accessMode, setAccessMode] = useState('liberado')
  const [config, setConfig] = useState(() => createEmptyPreset())
  const [pageRules, setPageRules] = useState(() => createPageRulesFromConfig(createEmptyPreset()))
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [apiLoaded, setApiLoaded] = useState(false)
  const [apiLoadError, setApiLoadError] = useState('')
  const [apiTargetsByScope, setApiTargetsByScope] = useState(null)
  const [apiPresetsByScope, setApiPresetsByScope] = useState(null)
  const [apiUsers, setApiUsers] = useState([])
  const [usuarioResponsavel, setUsuarioResponsavel] = useState('')
  const [usuariosEquipe, setUsuariosEquipe] = useState([])
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [usuariosFilter, setUsuariosFilter] = useState('')
  const [responsavelDropdownOpen, setResponsavelDropdownOpen] = useState(false)
  const [usuariosDropdownOpen, setUsuariosDropdownOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState('edit')
  const [editorName, setEditorName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [openGroups, setOpenGroups] = useState({
    visao_geral: true,
    consultas: true,
    gestao: true,
    configuracoes: true
  })

  const scopeTargets = useMemo(() => {
    const remoteTargets = apiTargetsByScope?.[scope]
    if (apiTargetsByScope) return Array.isArray(remoteTargets) ? remoteTargets : []
    return []
  }, [scope, apiTargetsByScope])

  const usuariosDisponiveis = useMemo(() => {
    const unique = new Map()
    ;(Array.isArray(apiUsers) ? apiUsers : []).forEach((item) => {
      const nome = String(item?.nome ?? item?.login ?? '').trim()
      if (!nome) return
      const key = normalizeToken(nome)
      if (!unique.has(key)) unique.set(key, nome)
    })
    return [...unique.values()]
  }, [apiUsers])

  const usuariosResponsavelFiltrados = useMemo(() => {
    const term = normalizeToken(responsavelFilter)
    if (!term) return usuariosDisponiveis
    return usuariosDisponiveis.filter((nome) => normalizeToken(nome).includes(term))
  }, [usuariosDisponiveis, responsavelFilter])

  const usuariosEquipeFiltrados = useMemo(() => {
    const term = normalizeToken(usuariosFilter)
    const base = usuariosDisponiveis.filter((nome) => nome !== usuarioResponsavel)
    if (!term) return base
    return base.filter((nome) => normalizeToken(nome).includes(term))
  }, [usuariosDisponiveis, usuariosFilter, usuarioResponsavel])

  const resolvePreset = (scopeKey, targetKey) => {
    const remote = apiPresetsByScope?.[scopeKey]?.[targetKey]
    if (remote) return remote
    return createEmptyPreset()
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

  useEffect(() => {
    setEditorName(target || '')
  }, [target])

  useEffect(() => {
    if (!usuarioResponsavel) return
    setUsuariosEquipe((prev) => prev.filter((nome) => nome !== usuarioResponsavel))
  }, [usuarioResponsavel])

  const loadPermissionsFromApi = async () => {
    setLoadingRemote(true)
    setApiLoadError('')
      try {
        const fetchArray = async (url) => {
          const response = await fetch(url, { method: 'GET' })
          if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`)
          const rawText = await response.text()
          if (!rawText?.trim()) return []
          const json = parseJsonSafe(rawText)
          if (!json) return []
          const unwrapped = unwrapPermissionsPayload(json)
          return Array.isArray(unwrapped) ? unwrapped : []
        }

      const equipes = await fetchArray(PERMISSIONS_API_ENDPOINTS.equipes)
      const usuarios = await fetchArray(PERMISSIONS_API_ENDPOINTS.usuarios)

      const parsed = parsePermissionsFromPayload({
        data: {
          equipes,
          usuarios
        }
      })

      if (!parsed) {
        setApiLoaded(false)
        setApiLoadError('A API de permissões não retornou uma estrutura válida.')
        return
      }

      setApiTargetsByScope(parsed.targetsByScope)
      setApiPresetsByScope(parsed.presetsByScope)
      setApiUsers(usuarios)
      if (!apiLoaded) {
        setScope(parsed.defaultScope || 'setor')
        setTarget(parsed.defaultTarget || '')
      }
      setApiLoaded(true)
    } catch (error) {
      setApiLoaded(false)
      setApiLoadError(`Falha ao carregar API de permissões: ${error?.message || 'erro desconhecido'}`)
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

  const rulesRows = useMemo(() => {
    const rows = []
    const getTargets = (scopeKey) => {
      const remoteTargets = apiTargetsByScope?.[scopeKey]
      if (!Array.isArray(remoteTargets)) return []
      return [...new Set(remoteTargets.filter(Boolean))]
    }

    ;['setor'].forEach((scopeKey) => {
      getTargets(scopeKey).forEach((targetName) => {
        const preset = apiPresetsByScope?.[scopeKey]?.[targetName] || createEmptyPreset()
        const ruleSet = createPageRulesFromConfig(preset)
        const pagesEnabled = Object.values(ruleSet).filter((rule) => Boolean(rule.view)).length
        rows.push({
          id: `${scopeKey}|${targetName}`,
          scopeKey,
          scopeLabel: SCOPE_LABELS[scopeKey] || scopeKey,
          target: targetName,
          pagesEnabled
        })
      })
    })

    return rows
  }, [apiTargetsByScope, apiPresetsByScope])

  const filteredRows = useMemo(() => {
    const term = normalizeToken(searchTerm)
    if (!term) return rulesRows
    return rulesRows.filter((row) =>
      normalizeToken(`${row.target} ${row.scopeLabel}`).includes(term)
    )
  }, [rulesRows, searchTerm])

  const totalRows = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pagedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * rowsPerPage
    return filteredRows.slice(start, start + rowsPerPage)
  }, [filteredRows, rowsPerPage, safeCurrentPage])

  const showingFrom = totalRows === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1
  const showingTo = totalRows === 0 ? 0 : Math.min(safeCurrentPage * rowsPerPage, totalRows)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, rowsPerPage])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

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
      consultar: nextView ? Boolean(cap.consultar) : false,
      criar: nextView ? Boolean(cap.criar) : false,
      editar: nextView ? Boolean(cap.editar) : false,
      excluir: nextView ? Boolean(cap.excluir) : false,
      exportar: nextView ? Boolean(cap.exportar) : false
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
    const preset = apiPresetsByScope?.[scope]?.[target] || createEmptyPreset()
    const nextConfig = cloneConfig(preset)
    setConfig(nextConfig)
    setPageRules(createPageRulesFromConfig(nextConfig))
  }

  const toggleGroup = (groupKey) => {
    setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }

  const openCreateEditor = () => {
    setEditorMode('create')
    setScope('setor')
    setTarget('')
    setConfig(createEmptyPreset())
    setPageRules(createPageRulesFromConfig(createEmptyPreset()))
    setEditorName('')
    setUsuarioResponsavel('')
    setUsuariosEquipe([])
    setResponsavelFilter('')
    setUsuariosFilter('')
    setResponsavelDropdownOpen(false)
    setUsuariosDropdownOpen(false)
    setEditorOpen(true)
  }

  const openEditorFor = (scopeKey, targetKey) => {
    setEditorMode('edit')
    setScope(scopeKey)
    setTarget(targetKey)
    setEditorName(targetKey || '')
    setUsuarioResponsavel('')
    setUsuariosEquipe([])
    setResponsavelFilter('')
    setUsuariosFilter('')
    setResponsavelDropdownOpen(false)
    setUsuariosDropdownOpen(false)
    setEditorOpen(true)
  }

  const saveMock = () => {
    setEditorOpen(false)
  }

  const visiblePageNumbers = useMemo(() => {
    const maxButtons = 5
    const start = Math.max(1, safeCurrentPage - 2)
    const end = Math.min(totalPages, start + maxButtons - 1)
    const adjustedStart = Math.max(1, end - maxButtons + 1)
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index)
  }, [safeCurrentPage, totalPages])

  const toggleUsuarioEquipe = (nome) => {
    setUsuariosEquipe((prev) => (
      prev.includes(nome) ? prev.filter((item) => item !== nome) : [...prev, nome]
    ))
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
              <h2 className="fw-bold mb-1">Equipes e Permissões</h2>
              <div className="opacity-75 small">
                Gerencie permissões por equipe.
              </div>
            </div>
          </div>
        </div>

        {!apiLoaded && (
          <section className="neo-card p-4 p-md-5 text-center">
            <div className="d-flex justify-content-center mb-3">
              <div className="splash-logo-wrap" style={{ width: 86, height: 86 }}>
                <img src="/neo-logo.svg" alt="Nova Europa 4" className="splash-logo" style={{ width: 50 }} />
              </div>
            </div>
            <h4 className="fw-semibold mb-2">Carregando equipes e usuários</h4>
            <div className="opacity-75 mb-3">
              Aguarde enquanto os dados são carregados.
            </div>
            {!apiLoadError && (
              <div className="loading-dots fs-4" aria-hidden="true">
                <span>.</span><span>.</span><span>.</span>
              </div>
            )}
            {apiLoadError && (
              <div className="d-flex flex-column align-items-center gap-3">
                <div className="alert alert-warning py-2 px-3 mb-0 small">{apiLoadError}</div>
                <button type="button" className="btn btn-primary btn-sm" onClick={loadPermissionsFromApi} disabled={loadingRemote}>
                  {loadingRemote ? 'Tentando novamente...' : 'Tentar novamente'}
                </button>
              </div>
            )}
          </section>
        )}

        {apiLoaded && (
          <section className="neo-card neo-lg p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <button type="button" className="btn btn-ghost btn-ghost-info btn-sm d-inline-flex align-items-center gap-2" onClick={openCreateEditor}>
                <FiPlusCircle size={15} />
                <span>Criar Equipe</span>
              </button>

              <div className="d-flex flex-wrap align-items-center gap-3 ms-auto">
                <div className="d-inline-flex align-items-center gap-2">
                  <span>Mostrar</span>
                  <select
                    value={rowsPerPage}
                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                    className="form-select form-select-sm"
                    style={{ width: 90 }}
                    aria-label="Registros por página"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>registros por página</span>
                </div>

                <label className="d-inline-flex align-items-center gap-2 mb-0" aria-label="Buscar equipes">
                  <span>Buscar:</span>
                  <div className="input-group input-group-sm" style={{ width: 280 }}>
                    <span className="input-group-text">
                      <FiSearch size={14} />
                    </span>
                    <input
                      className="form-control"
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Nome da equipe"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th className="text-center">Qtd. Cargos Responsáveis</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center opacity-75 p-4">
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  )}
                  {pagedRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <span>{row.target}</span>
                        </div>
                      </td>
                      <td className="text-center">{row.pagesEnabled >= PAGE_CATALOG.length ? 'Todos' : row.pagesEnabled}</td>
                      <td className="text-center">
                        <div className="d-inline-flex align-items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-ghost-primary btn-icon d-inline-flex align-items-center justify-content-center"
                            title="Editar permissão"
                            onClick={() => openEditorFor(row.scopeKey, row.target)}
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-ghost-danger btn-icon d-inline-flex align-items-center justify-content-center"
                            title="Exclusão desabilitada neste modo"
                            disabled
                          >
                            <FiX size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3 gap-2 flex-wrap">
              <div className="small opacity-75">
                Mostrando {showingFrom} a {showingTo} de {totalRows} registros
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage === 1}
                >
                  {'<'}
                </button>
                {visiblePageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`btn btn-sm ${pageNumber === safeCurrentPage ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage === totalPages}
                >
                  {'>'}
                </button>
              </div>
            </div>
          </section>
        )}

        {apiLoaded && editorOpen && (
          <div
            className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-3"
            style={{ background: 'rgba(0,0,0,0.58)', zIndex: 2200 }}
            onClick={() => setEditorOpen(false)}
          >
            <div
              className="neo-card neo-lg p-0 permissions-modal-standard permissions-modal-standard-card permissions-modal-simple"
              style={{ maxWidth: 700, width: '95%', maxHeight: '86vh', overflow: 'hidden' }}
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
                <h5 className="mb-0">{editorMode === 'create' ? 'Nova Equipe e Permissões' : 'Editar Permissão'}</h5>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setEditorOpen(false)} aria-label="Fechar modal">
                  <FiX />
                </button>
              </div>

              <div className="p-4 permissions-modal-standard-body permissions-modal-simple-body">
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small">Nome</label>
                    <input
                      className="form-control"
                      type="text"
                      value={editorName}
                      onChange={(event) => setEditorName(event.target.value)}
                      placeholder="Insira um nome do grupo."
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small">Usuário responsável</label>
                    <div className="permissions-picker">
                      <button
                        type="button"
                        className="permissions-picker-trigger"
                        onClick={() => {
                          setResponsavelDropdownOpen((prev) => !prev)
                          setUsuariosDropdownOpen(false)
                        }}
                      >
                        <span className={usuarioResponsavel ? '' : 'opacity-75'}>
                          {usuarioResponsavel || 'Selecione o responsável'}
                        </span>
                        <FiChevronDown size={14} />
                      </button>
                      {responsavelDropdownOpen && (
                        <div className="permissions-picker-panel">
                          <input
                            type="text"
                            className="form-control permissions-picker-search"
                            placeholder="Filtrar usuário..."
                            value={responsavelFilter}
                            onChange={(event) => setResponsavelFilter(event.target.value)}
                          />
                          <div className="permissions-picker-list">
                            {usuariosResponsavelFiltrados.map((nome) => (
                              <button
                                key={`resp-${nome}`}
                                type="button"
                                className="permissions-picker-item"
                                onClick={() => {
                                  setUsuarioResponsavel(nome)
                                  setResponsavelDropdownOpen(false)
                                }}
                              >
                                <span>{nome}</span>
                                {usuarioResponsavel === nome && <FiCheck size={16} />}
                              </button>
                            ))}
                            {usuariosResponsavelFiltrados.length === 0 && (
                              <div className="permissions-picker-empty">Sem usuários</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label small">Usuários equipe</label>
                    <div className="permissions-picker">
                      <button
                        type="button"
                        className="permissions-picker-trigger"
                        onClick={() => {
                          setUsuariosDropdownOpen((prev) => !prev)
                          setResponsavelDropdownOpen(false)
                        }}
                      >
                        <span className={usuariosEquipe.length > 0 ? '' : 'opacity-75'}>
                          {usuariosEquipe.length > 0 ? usuariosEquipe.join(', ') : 'Selecione os usuários da equipe'}
                        </span>
                        <FiChevronDown size={14} />
                      </button>
                      {usuariosDropdownOpen && (
                        <div className="permissions-picker-panel">
                          <input
                            type="text"
                            className="form-control permissions-picker-search"
                            placeholder="Filtrar usuário..."
                            value={usuariosFilter}
                            onChange={(event) => setUsuariosFilter(event.target.value)}
                          />
                          <div className="permissions-picker-list">
                            {usuariosEquipeFiltrados.map((nome) => (
                              <button
                                key={`usr-${nome}`}
                                type="button"
                                className="permissions-picker-item"
                                onClick={() => toggleUsuarioEquipe(nome)}
                              >
                                <span>{nome}</span>
                                {usuariosEquipe.includes(nome) && <FiCheck size={16} />}
                              </button>
                            ))}
                            {usuariosEquipeFiltrados.length === 0 && (
                              <div className="permissions-picker-empty">Sem usuários</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="d-flex align-items-center gap-2 fw-semibold mb-2">
                    <FiSliders size={14} />
                    <span>Permissões</span>
                  </div>
                  <div className="permissions-tree permissions-tree-simple permissions-tree-legacy" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {PERMISSION_GROUPS.map((group) => {
                      const isOpen = Boolean(openGroups[group.key])
                      const groupPages = PAGE_CATALOG.filter((page) => group.pages.includes(page.key))
                      const allEnabled = groupPages.length > 0 && groupPages.every((page) => Boolean(pageRules?.[page.key]?.view || config?.pages?.[page.key]))
                      const GroupIcon = GROUP_ICON_MAP[group.key] || FiShield
                      return (
                        <div key={group.key} className={`permissions-tree-group permissions-tree-branch ${allEnabled ? 'is-active' : ''}`}>
                          <div
                            className={`permissions-tree-node permissions-tree-node-group permissions-tree-node-clickable ${allEnabled ? 'is-active' : ''}`}
                            onClick={() => {
                              groupPages.forEach((page) => setPageVisibility(page.key, !allEnabled))
                            }}
                          >
                            <button
                              type="button"
                              className="permissions-tree-toggle"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleGroup(group.key)
                              }}
                            >
                              {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                            </button>
                            <label
                              className="d-inline-flex align-items-center gap-2 mb-0 permissions-tree-check permissions-tree-check-group"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={allEnabled}
                                onChange={(event) => {
                                  groupPages.forEach((page) => setPageVisibility(page.key, event.target.checked))
                                }}
                              />
                              <span className="permissions-tree-item-icon"><GroupIcon size={13} /></span>
                              <span>{group.label}</span>
                            </label>
                          </div>

                          {isOpen && (
                            <div className="permissions-tree-children">
                              {groupPages.map((page) => {
                                const pageRule = pageRules?.[page.key] || buildPageRule(page.key, {}, false)
                                const availableActions = Object.keys(PAGE_CAPABILITIES[page.key] || {}).filter((actionKey) => Boolean(PAGE_CAPABILITIES[page.key]?.[actionKey]))
                                const PageIcon = PAGE_ICON_MAP[page.key] || FiChevronRight
                                return (
                                  <div
                                    key={page.key}
                                    className={`permissions-tree-page permissions-tree-node permissions-tree-node-page permissions-tree-node-clickable ${pageRule.view ? 'is-active' : ''}`}
                                    onClick={() => setPageVisibility(page.key, !Boolean(pageRule.view))}
                                  >
                                    <label
                                      className="d-inline-flex align-items-center gap-2 mb-1 permissions-tree-check permissions-tree-check-page"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={Boolean(pageRule.view)}
                                        onChange={(event) => setPageVisibility(page.key, event.target.checked)}
                                      />
                                      <span className="permissions-tree-item-icon"><PageIcon size={13} /></span>
                                      <span>{page.label}</span>
                                    </label>

                                    <div className="permissions-tree-actions-list" onClick={(event) => event.stopPropagation()}>
                                      {availableActions.map((actionKey) => {
                                        const ActionIcon = ACTION_ICON_MAP[actionKey] || FiChevronRight
                                        return (
                                          <div key={`${page.key}-${actionKey}`} className={`permissions-tree-action-row ${!pageRule.view ? 'opacity-50' : ''} ${pageRule[actionKey] ? 'is-active' : ''}`}>
                                            <label className="permissions-tree-check permissions-tree-check-action">
                                              <input
                                                type="checkbox"
                                                checked={Boolean(pageRule[actionKey])}
                                                disabled={!pageRule.view}
                                                onChange={() => togglePageAction(page.key, actionKey)}
                                              />
                                              <span className="permissions-tree-item-icon permissions-tree-item-icon-action">
                                                <ActionIcon size={12} />
                                              </span>
                                              <span className="small">{ACTION_LABELS[actionKey]}</span>
                                            </label>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 px-4 py-3 border-top permissions-modal-standard-footer">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditorOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={saveMock}>
                  {editorMode === 'create' ? 'Criar Cargo' : 'Salvar Cargo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}


