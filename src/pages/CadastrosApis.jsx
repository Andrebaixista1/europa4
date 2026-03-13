import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiArrowLeft,
  FiChevronRight,
  FiDatabase,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { normalizeRole, Roles } from '../utils/roles.js'

const API_BASE = 'http://85.31.61.242:8011/api'
const V8_ENDPOINT = `${API_BASE}/logins/consultasv8`
const HANDMAIS_ENDPOINT = `${API_BASE}/logins/consultashandmais`
const EQUIPES_ENDPOINT = `${API_BASE}/equipes`
const V8_REGISTER_ENDPOINT = `${API_BASE}/register/consultasv8`
const HANDMAIS_REGISTER_ENDPOINT = `${API_BASE}/register/consultashandmais`
const V8_UPDATE_TEAMS_ENDPOINT = `${API_BASE}/alter/consultasv8/equipes`
const HANDMAIS_UPDATE_TEAMS_ENDPOINT = `${API_BASE}/alter/consultashandmais/equipes`
const SQL_JSON_KEY = 'JSON_F52E2B61-18A1-11d1-B105-00805F49916B'

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')

  let normalized = raw
  if (hasComma && hasDot) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    normalized = raw.replace(',', '.')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const formatInt = (value) => {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('pt-BR')
}

const maskCadastro = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return '****'

  if (raw.includes('@')) {
    const [localPart = '', domainPart = ''] = raw.split('@')
    const local =
      localPart.length <= 2
        ? `${localPart.slice(0, 1)}***`
        : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(3, localPart.length - 3))}${localPart.slice(-1)}`

    if (!domainPart) return `${local}@****`

    const domainChunks = domainPart.split('.')
    if (domainChunks.length < 2) {
      return `${local}@${domainPart.slice(0, 1)}***`
    }

    const host = domainChunks[0]
    const tld = domainChunks.slice(1).join('.')
    const hostMasked =
      host.length <= 1
        ? `${host}***`
        : `${host.slice(0, 1)}${'*'.repeat(Math.max(2, host.length - 1))}`

    return `${local}@${hostMasked}.${tld}`
  }

  if (raw.length <= 4) return `${raw.slice(0, 1)}***`
  return `${raw.slice(0, 2)}${'*'.repeat(Math.max(3, raw.length - 4))}${raw.slice(-2)}`
}

const displayCadastro = (value, hideDomain = false) => {
  const raw = String(value ?? '').trim()
  if (!raw) return '****'
  if (hideDomain && raw.includes('@')) {
    return raw.split('@')[0] || raw
  }
  return raw
}

const parseSqlWrappedPayload = (payload) => {
  if (!payload || Array.isArray(payload)) return payload
  const value = payload?.[SQL_JSON_KEY]
  if (typeof value !== 'string') return payload
  try {
    return JSON.parse(value)
  } catch {
    return payload
  }
}

const normalizeApiCollection = (payload) => {
  const parsedPayload = parseSqlWrappedPayload(payload)

  if (Array.isArray(parsedPayload)) {
    if (
      parsedPayload.length === 1 &&
      parsedPayload[0] &&
      typeof parsedPayload[0] === 'object' &&
      parsedPayload[0][SQL_JSON_KEY]
    ) {
      const nested = parseSqlWrappedPayload(parsedPayload[0])
      return normalizeApiCollection(nested)
    }
    return parsedPayload
  }

  if (Array.isArray(parsedPayload?.rows)) return parsedPayload.rows
  if (Array.isArray(parsedPayload?.data)) return parsedPayload.data
  if (Array.isArray(parsedPayload?.items)) return parsedPayload.items
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

const parseEquipeIds = (value) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => toNumberOrNull(item))
          .filter((item) => item != null)
      )
    ).sort((a, b) => a - b)
  }

  const raw = String(value ?? '').trim()
  if (!raw) return []

  const normalized = raw.replace(/[{}[\]]/g, '')
  return Array.from(
    new Set(
      normalized
        .split(',')
        .map((item) => toNumberOrNull(item.trim()))
        .filter((item) => item != null)
    )
  ).sort((a, b) => a - b)
}

const normalizeEquipeRows = (rows) =>
  rows
    .map((row) => ({
      id: toNumberOrNull(row?.id ?? row?.equipe_id ?? row?.team_id),
      nome: String(row?.nome ?? row?.name ?? row?.team_name ?? '').trim(),
      descricao: String(row?.descricao ?? row?.description ?? '').trim(),
      ativo: row?.ativo ?? row?.active ?? true,
      unknown: false,
    }))
    .filter((row) => row.id != null)

const normalizeV8Rows = (rows) =>
  rows
    .map((row) => {
      const id = Number(row?.id ?? 0)
      const label = String(row?.email ?? '').trim()
      const total = toNumber(row?.total)
      const consultados = toNumber(row?.consultados)
      const limite = toNumber(row?.limite)
      const accessTeamIds = parseEquipeIds(row?.equipe_id)

      return {
        id,
        label: label || `Login ${id || '-'}`,
        total,
        consultados,
        limite,
        accessTeamIds,
      }
    })
    .filter((row) => {
      const token = row.label.toUpperCase()
      return row.id !== 0 && token !== 'TOTAL'
    })

const normalizeHandMaisRows = (rows) =>
  rows
    .map((row) => {
      const id = Number(row?.id ?? 0)
      const label = String(row?.empresa ?? '').trim()
      const total = toNumber(row?.total)
      const consultados = toNumber(row?.consultados)
      const limite = toNumber(row?.limite)
      const accessTeamIds = parseEquipeIds(row?.equipe_id)

      return {
        id,
        label: label || `Conta ${id || '-'}`,
        total,
        consultados,
        limite,
        accessTeamIds,
      }
    })
    .filter((row) => {
      const token = row.label.toUpperCase()
      return row.id !== 0 && token !== 'TOTAL'
    })

const buildSummary = (rows) =>
  rows.reduce(
    (acc, item) => {
      acc.registros += 1
      acc.total += toNumber(item.total)
      acc.consultados += toNumber(item.consultados)
      acc.limite += toNumber(item.limite)
      acc.acessos += Array.isArray(item.accessTeamIds) ? item.accessTeamIds.length : 0
      return acc
    },
    { registros: 0, total: 0, consultados: 0, limite: 0, acessos: 0 }
  )

const buildFallbackTeam = (teamId) => ({
  id: teamId,
  nome: `Equipe ${teamId}`,
  descricao: '',
  ativo: true,
  unknown: true,
})

const sortNumericList = (values) => Array.from(new Set((values || []).map((item) => Number(item)).filter((item) => Number.isFinite(item)))).sort((a, b) => a - b)

const sameNumericList = (left, right) => {
  const a = sortNumericList(left)
  const b = sortNumericList(right)
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const buildAccessSnapshot = (rows) =>
  Object.fromEntries(
    (rows || []).map((row) => [row.id, sortNumericList(row.accessTeamIds || [])])
  )

function ProductCard(props) {
  const {
    title,
    rows,
    loading,
    logoSrc,
    logoAlt,
    logoFallbackSrc,
    hideCadastro = false,
    onAdd,
    selectedRowId,
    onSelectRow,
    detailRow,
    teams,
    teamSearch,
    onTeamSearchChange,
    onToggleTeam,
    currentTeamId,
    canEditAccess,
    canAdd,
    productToneClass,
    showInlinePanel = false,
  } = props

  const summary = useMemo(() => buildSummary(rows), [rows])
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])

  const activeTeams = useMemo(() => {
    if (!detailRow) return []
    return detailRow.accessTeamIds
      .map((teamId) => teamMap.get(teamId) ?? buildFallbackTeam(teamId))
      .filter((team) => !team.unknown)
  }, [detailRow, teamMap])

  const filteredTeams = useMemo(() => {
    const term = String(teamSearch ?? '').trim().toLowerCase()
    if (!term) return teams
    return teams.filter((team) => {
      const name = String(team?.nome ?? '').toLowerCase()
      return name.includes(term) || String(team?.id ?? '').includes(term)
    })
  }, [teamSearch, teams])

  return (
    <section className={`neo-card p-3 cadastros-api-product-card ${detailRow ? 'is-expanded' : ''}`}>
      <div className="cadastros-api-product-head">
        <div className="cadastros-api-product-brand">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={logoAlt || title}
              className="cadastros-api-product-logo"
              loading="lazy"
              onError={(event) => {
                const target = event.currentTarget
                if (logoFallbackSrc && target.src !== logoFallbackSrc) {
                  target.src = logoFallbackSrc
                  return
                }
                target.style.display = 'none'
              }}
            />
          )}
          <div className="cadastros-api-product-brand-text">
            <h5 className="mb-1">{title}</h5>
            <small className="opacity-75">Contadores individuais, somatorio e matriz de equipes</small>
          </div>
        </div>
        <div className="cadastros-api-product-actions">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
            onClick={onAdd}
            disabled={!canAdd}
          >
            <FiPlus size={14} />
            Adicionar
          </button>
          <span className="cadastros-api-count-pill">{formatInt(summary.registros)} contas</span>
        </div>
      </div>

      <div className="cadastros-api-product-shell">
        <div className="cadastros-api-product-list-pane">
          <div className="cadastros-api-summary-grid">
            <div className="cadastros-api-summary-item">
              <span>Total</span>
              <strong>{formatInt(summary.total)}</strong>
            </div>
            <div className="cadastros-api-summary-item">
              <span>Consultados</span>
              <strong>{formatInt(summary.consultados)}</strong>
            </div>
            <div className="cadastros-api-summary-item">
              <span>Limite</span>
              <strong>{formatInt(summary.limite)}</strong>
            </div>
          </div>

          <div className="cadastros-api-list-head cadastros-api-list-head-access">
            <span>Cadastro</span>
            <span>Equipes</span>
            <span>Consultados</span>
            <span>Limite</span>
          </div>

          <div className="cadastros-api-list">
            {loading && <div className="cadastros-api-list-empty">Carregando dados...</div>}
            {!loading && rows.length === 0 && (
              <div className="cadastros-api-list-empty">Nenhum cadastro encontrado para esta equipe.</div>
            )}

            {!loading &&
              rows.map((row) => {
                const isSelected = selectedRowId === row.id
                const isCurrentTeamActive = currentTeamId != null && row.accessTeamIds.includes(currentTeamId)

                return (
                  <button
                    key={`${title}-${row.id}-${row.label}`}
                    type="button"
                    className={`cadastros-api-list-row cadastros-api-list-row-button ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelectRow(row.id)}
                  >
                    <span className="cadastros-api-list-label">
                      {hideCadastro ? displayCadastro(row.label, true) : row.label}
                    </span>
                    <span className="cadastros-api-access-count">
                      <span className={`cadastros-api-access-dot ${isCurrentTeamActive ? 'is-on' : ''}`} />
                      {formatInt(row.accessTeamIds.length)}
                    </span>
                    <span>{formatInt(row.consultados)}</span>
                    <span className="cadastros-api-list-last-cell">
                      {formatInt(row.limite)}
                      <FiChevronRight className="cadastros-api-row-chevron" size={15} />
                    </span>
                  </button>
                )
              })}
          </div>
        </div>

        {showInlinePanel ? (
          <aside className={`cadastros-api-access-panel ${detailRow ? 'is-open' : ''} ${productToneClass || ''}`}>
            {detailRow ? (
              <>
                <div className="cadastros-api-access-panel-head">
                  <div>
                    <div className="cadastros-api-access-kicker">
                      <FiShield size={13} />
                      <span>{title}</span>
                    </div>
                    <h6 className="mb-1">{hideCadastro ? displayCadastro(detailRow.label, true) : detailRow.label}</h6>
                    <div className="cadastros-api-access-subtitle">
                      Selecione as equipes com acesso a este login.
                    </div>
                  </div>
                  <div className="cadastros-api-access-stats">
                    <strong>{formatInt(activeTeams.length)}</strong>
                    <span>equipes ativas</span>
                  </div>
                </div>

                <div className="cadastros-api-access-highlight">
                  <span className="cadastros-api-access-highlight-label">Resumo rapido</span>
                  <div className="cadastros-api-access-highlight-grid">
                    <div>
                      <strong>{formatInt(detailRow.total)}</strong>
                      <span>Total</span>
                    </div>
                    <div>
                      <strong>{formatInt(detailRow.consultados)}</strong>
                      <span>Consultados</span>
                    </div>
                    <div>
                      <strong>{formatInt(detailRow.limite)}</strong>
                      <span>Limite</span>
                    </div>
                  </div>
                </div>

                <div className="cadastros-api-active-strip">
                  {activeTeams.length > 0 ? (
                    activeTeams.map((team) => (
                      <span
                        key={`active-${title}-${detailRow.id}-${team.id}`}
                        className={`cadastros-api-team-chip ${team.unknown ? 'is-unknown' : ''}`}
                      >
                        #{team.id} {team.nome}
                      </span>
                    ))
                  ) : (
                    <span className="cadastros-api-team-chip is-empty">Nenhuma equipe vinculada</span>
                  )}
                </div>

                <div className="cadastros-api-access-toolbar">
                  <label className="cadastros-api-access-search">
                    <FiSearch size={14} />
                    <input
                      type="text"
                      value={teamSearch}
                      onChange={(event) => onTeamSearchChange(event.target.value)}
                      placeholder="Buscar equipe por nome ou ID"
                    />
                  </label>
                  <div className="cadastros-api-access-note">
                    {canEditAccess ? 'Edicao visual habilitada nesta tela.' : 'Visualizacao somente leitura.'}
                  </div>
                </div>

                <div className="cadastros-api-team-grid">
                  {filteredTeams.map((team) => {
                    const checked = detailRow.accessTeamIds.includes(team.id)
                    const isCurrentTeam = currentTeamId != null && Number(currentTeamId) === Number(team.id)

                    return (
                      <label
                        key={`team-option-${title}-${detailRow.id}-${team.id}`}
                        className={`cadastros-api-team-option ${checked ? 'is-enabled' : ''} ${isCurrentTeam ? 'is-current' : ''}`}
                      >
                        <div className="cadastros-api-team-option-main">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canEditAccess}
                            onChange={(event) => onToggleTeam(detailRow.id, team.id, event.target.checked)}
                          />
                          <div>
                            <strong>{team.nome}</strong>
                            <span>
                              equipe_id: {team.id}
                              {team.unknown ? ' | nome nao encontrado na base de equipes' : ''}
                              {isCurrentTeam ? ' | equipe atual do usuario' : ''}
                            </span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {canEditAccess && (
                  <div className="cadastros-api-panel-footnote">
                    As alteracoes dos checkboxes ainda sao locais nesta etapa. Se aprovar o fluxo, eu conecto o salvar no endpoint de vinculo.
                  </div>
                )}
              </>
            ) : (
              <div className="cadastros-api-access-empty">
                <FiUsers size={18} />
                <strong>Mapa de acessos por equipe</strong>
                <span>Clique em um login para abrir o painel lateral e ver os checkboxes de equipes deste produto.</span>
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </section>
  )
}

function AccessWorkbench({
  title,
  detailRow,
  teams,
  teamSearch,
  onTeamSearchChange,
  onToggleTeam,
  currentTeamId,
  canEditAccess,
  isSaving,
  isDirty,
  hideCadastro,
  productToneClass,
  onSave,
  onClose,
}) {
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])

  const activeTeams = useMemo(() => {
    if (!detailRow) return []
    return detailRow.accessTeamIds
      .map((teamId) => teamMap.get(teamId) ?? buildFallbackTeam(teamId))
      .filter((team) => !team.unknown)
  }, [detailRow, teamMap])

  const filteredTeams = useMemo(() => {
    const term = String(teamSearch ?? '').trim().toLowerCase()
    if (!term) return teams
    return teams.filter((team) => {
      const name = String(team?.nome ?? '').toLowerCase()
      return name.includes(term) || String(team?.id ?? '').includes(term)
    })
  }, [teamSearch, teams])

  if (!detailRow) return null

  return (
    <div
      className="cadastros-api-access-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <section
        className={`neo-card p-3 cadastros-api-access-workbench ${productToneClass || ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cadastros-api-access-modal-head">
          <div>
            <div className="cadastros-api-access-kicker">
              <FiShield size={13} />
              <span>{title}</span>
            </div>
            <h5 className="mb-0">Acessos por equipe</h5>
          </div>
          <button type="button" className="btn btn-ghost btn-icon cadastros-api-modal-close" aria-label="Fechar" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="cadastros-api-access-workbench-grid">
          <div className="cadastros-api-access-overview">
            <div className="cadastros-api-access-panel-head">
              <div>
                <h5 className="mb-1">{hideCadastro ? displayCadastro(detailRow.label, true) : detailRow.label}</h5>
                <div className="cadastros-api-access-subtitle">
                  Editor visual de equipes com acesso a este login.
                </div>
              </div>
              <div className="cadastros-api-access-stats">
                <strong>{formatInt(activeTeams.length)}</strong>
                <span>equipes ativas</span>
              </div>
            </div>

            <div className="cadastros-api-access-highlight">
              <span className="cadastros-api-access-highlight-label">Resumo do login</span>
              <div className="cadastros-api-access-highlight-grid">
                <div>
                  <strong>{formatInt(detailRow.total)}</strong>
                  <span>Total</span>
                </div>
                <div>
                  <strong>{formatInt(detailRow.consultados)}</strong>
                  <span>Consultados</span>
                </div>
                <div>
                  <strong>{formatInt(detailRow.limite)}</strong>
                  <span>Limite</span>
                </div>
              </div>
            </div>

            <div className="cadastros-api-active-strip">
              {activeTeams.length > 0 ? (
                activeTeams.map((team) => (
                  <span
                    key={`workbench-active-${title}-${detailRow.id}-${team.id}`}
                    className={`cadastros-api-team-chip ${team.unknown ? 'is-unknown' : ''}`}
                  >
                    #{team.id} {team.nome}
                  </span>
                ))
              ) : (
                <span className="cadastros-api-team-chip is-empty">Nenhuma equipe vinculada</span>
              )}
            </div>
          </div>

          <div className="cadastros-api-access-editor">
            <div className="cadastros-api-access-toolbar">
              <label className="cadastros-api-access-search">
                <FiSearch size={14} />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(event) => onTeamSearchChange(event.target.value)}
                  placeholder="Buscar equipe por nome ou ID"
                />
              </label>
              <div className="cadastros-api-access-note">
                {canEditAccess ? 'Edicao visual habilitada nesta tela.' : 'Visualizacao somente leitura.'}
              </div>
            </div>

            <div className="cadastros-api-team-grid">
              {filteredTeams.map((team) => {
                const checked = detailRow.accessTeamIds.includes(team.id)
                const isCurrentTeam = currentTeamId != null && Number(currentTeamId) === Number(team.id)

                return (
                  <label
                    key={`workbench-team-option-${title}-${detailRow.id}-${team.id}`}
                    className={`cadastros-api-team-option ${checked ? 'is-enabled' : ''} ${isCurrentTeam ? 'is-current' : ''}`}
                  >
                    <div className="cadastros-api-team-option-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEditAccess}
                        onChange={(event) => onToggleTeam(detailRow.id, team.id, event.target.checked)}
                      />
                      <div>
                        <strong>{team.nome}</strong>
                        <span>
                          equipe_id: {team.id}
                          {team.unknown ? ' | nome nao encontrado na base de equipes' : ''}
                          {isCurrentTeam ? ' | equipe atual do usuario' : ''}
                        </span>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="cadastros-api-panel-footnote d-flex align-items-center justify-content-between gap-3 flex-wrap">
              <span>
                {canEditAccess
                  ? 'Altere os checkboxes e salve para atualizar as equipes com acesso a este login.'
                  : 'Somente usuarios Master podem editar essas configuracoes.'}
              </span>
              {canEditAccess && (
                <button type="button" className="btn btn-primary btn-sm" disabled={!isDirty || isSaving} onClick={onSave}>
                  {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function CadastrosApis() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [v8Rows, setV8Rows] = useState([])
  const [handMaisRows, setHandMaisRows] = useState([])
  const [initialV8Access, setInitialV8Access] = useState({})
  const [initialHandMaisAccess, setInitialHandMaisAccess] = useState({})
  const [equipes, setEquipes] = useState([])
  const [selectedAccess, setSelectedAccess] = useState({ product: null, rowId: null })
  const [v8TeamSearch, setV8TeamSearch] = useState('')
  const [handTeamSearch, setHandTeamSearch] = useState('')
  const [isV8ModalOpen, setIsV8ModalOpen] = useState(false)
  const [isHandMaisModalOpen, setIsHandMaisModalOpen] = useState(false)
  const [isSavingV8, setIsSavingV8] = useState(false)
  const [isSavingHandMais, setIsSavingHandMais] = useState(false)
  const [isSavingAccess, setIsSavingAccess] = useState(false)
  const [v8Email, setV8Email] = useState('')
  const [v8Senha, setV8Senha] = useState('')
  const [v8EquipeIds, setV8EquipeIds] = useState([])
  const [handEmpresaMode, setHandEmpresaMode] = useState('existente')
  const [handEmpresaSelecionada, setHandEmpresaSelecionada] = useState('')
  const [handEmpresaNova, setHandEmpresaNova] = useState('')
  const [handTokenApi, setHandTokenApi] = useState('')
  const [handEquipeIds, setHandEquipeIds] = useState([])

  const equipeId = useMemo(() => {
    const value = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }, [user])

  const equipeNome = useMemo(
    () => String(user?.equipe_nome ?? user?.team_name ?? '').trim(),
    [user]
  )

  const normalizedUserRole = useMemo(
    () => normalizeRole(user?.role, user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia),
    [user?.role, user?.level, user?.nivel_hierarquia, user?.NivelHierarquia]
  )

  const canEditAccess = normalizedUserRole === Roles.Master

  const loadData = useCallback(async () => {
    if (!equipeId) {
      setV8Rows([])
      setHandMaisRows([])
      setError('Nao foi possivel identificar a equipe do usuario logado.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const v8Url = new URL(V8_ENDPOINT)
      const handUrl = new URL(HANDMAIS_ENDPOINT)

      if (canEditAccess) {
        v8Url.searchParams.set('all', '1')
        handUrl.searchParams.set('all', '1')
      } else {
        v8Url.searchParams.set('equipe_id', String(equipeId))
        handUrl.searchParams.set('equipe_id', String(equipeId))
      }

      const [v8Response, handResponse, equipesResponse] = await Promise.all([
        fetch(v8Url.toString(), { method: 'GET' }),
        fetch(handUrl.toString(), { method: 'GET' }),
        fetch(EQUIPES_ENDPOINT, { method: 'GET' }),
      ])

      if (!v8Response.ok) throw new Error(`V8: HTTP ${v8Response.status}`)
      if (!handResponse.ok) throw new Error(`Hand+: HTTP ${handResponse.status}`)
      if (!equipesResponse.ok) throw new Error(`Equipes: HTTP ${equipesResponse.status}`)

      const [v8Payload, handPayload, equipesPayload] = await Promise.all([
        safeJson(v8Response).catch(() => []),
        safeJson(handResponse).catch(() => []),
        safeJson(equipesResponse).catch(() => []),
      ])

      const nextV8Rows = normalizeV8Rows(normalizeApiCollection(v8Payload))
      const nextHandMaisRows = normalizeHandMaisRows(normalizeApiCollection(handPayload))

      setV8Rows(nextV8Rows)
      setHandMaisRows(nextHandMaisRows)
      setInitialV8Access(buildAccessSnapshot(nextV8Rows))
      setInitialHandMaisAccess(buildAccessSnapshot(nextHandMaisRows))
      setEquipes(normalizeEquipeRows(normalizeApiCollection(equipesPayload)))
      setUpdatedAt(new Date().toLocaleString('pt-BR'))
    } catch (loadError) {
      setError(String(loadError?.message || 'Falha ao carregar os cadastros das APIs.'))
      setV8Rows([])
      setHandMaisRows([])
      setEquipes([])
    } finally {
      setLoading(false)
    }
  }, [canEditAccess, equipeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const empresasHandMais = useMemo(() => {
    const set = new Set()
    for (const item of handMaisRows) {
      const nome = String(item?.label ?? '').trim()
      if (nome) set.add(nome)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [handMaisRows])

  const allTeams = useMemo(() => {
    const baseMap = new Map()

    for (const team of equipes) {
      if (team?.id == null) continue
      baseMap.set(team.id, team)
    }

    for (const row of [...v8Rows, ...handMaisRows]) {
      for (const teamId of row.accessTeamIds || []) {
        if (!baseMap.has(teamId)) {
          baseMap.set(teamId, buildFallbackTeam(teamId))
        }
      }
    }

    return Array.from(baseMap.values())
      .filter((team) => !team.unknown)
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
  }, [equipes, handMaisRows, v8Rows])

  const selectedV8Row = useMemo(
    () => (selectedAccess.product === 'v8' ? v8Rows.find((row) => row.id === selectedAccess.rowId) ?? null : null),
    [selectedAccess, v8Rows]
  )

  const selectedHandMaisRow = useMemo(
    () =>
      selectedAccess.product === 'hand'
        ? handMaisRows.find((row) => row.id === selectedAccess.rowId) ?? null
        : null,
    [handMaisRows, selectedAccess]
  )

  useEffect(() => {
    if (selectedAccess.product === 'v8' && selectedAccess.rowId != null && !selectedV8Row) {
      setSelectedAccess({ product: null, rowId: null })
    }
    if (selectedAccess.product === 'hand' && selectedAccess.rowId != null && !selectedHandMaisRow) {
      setSelectedAccess({ product: null, rowId: null })
    }
  }, [selectedAccess, selectedHandMaisRow, selectedV8Row])

  const resetV8Modal = () => {
    setV8Email('')
    setV8Senha('')
    setV8EquipeIds(sortNumericList(equipeId != null ? [1, equipeId] : [1]))
  }

  const resetHandMaisModal = () => {
    setHandEmpresaMode('existente')
    setHandEmpresaSelecionada('')
    setHandEmpresaNova('')
    setHandTokenApi('')
    setHandEquipeIds(sortNumericList(equipeId != null ? [1, equipeId] : [1]))
  }

  const openV8Modal = () => {
    if (!canEditAccess) {
      notify.warn('Somente o perfil Master pode cadastrar ou editar acessos das APIs.')
      return
    }
    resetV8Modal()
    setIsV8ModalOpen(true)
  }

  const openHandMaisModal = () => {
    if (!canEditAccess) {
      notify.warn('Somente o perfil Master pode cadastrar ou editar acessos das APIs.')
      return
    }
    resetHandMaisModal()
    setIsHandMaisModalOpen(true)
  }

  const handleSelectAccessRow = (product, rowId) => {
    if (!canEditAccess) {
      notify.warn('Somente o perfil Master pode abrir o editor de acessos.')
      return
    }
    setSelectedAccess((current) => {
      if (current.product === product && current.rowId === rowId) {
        return { product: null, rowId: null }
      }
      return { product, rowId }
    })
  }

  const toggleCreateTeamSelection = (setter, currentIds, teamId, checked) => {
    const nextIds = checked
      ? sortNumericList([...(currentIds || []), teamId])
      : sortNumericList((currentIds || []).filter((id) => id !== teamId))
    setter(nextIds)
  }

  const toggleTeamAccess = (product, rowId, teamId, checked) => {
    const updater = (rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row
        const nextIds = checked
          ? Array.from(new Set([...(row.accessTeamIds || []), teamId])).sort((a, b) => a - b)
          : (row.accessTeamIds || []).filter((id) => id !== teamId)
        return { ...row, accessTeamIds: nextIds }
      })

    if (product === 'v8') {
      setV8Rows(updater)
      return
    }

    setHandMaisRows(updater)
  }

  const selectedAccessDetail = useMemo(() => {
    if (selectedAccess.product === 'v8' && selectedV8Row) {
      const initialIds = initialV8Access[selectedV8Row.id] || []
      return {
        title: 'V8 Bank',
        row: selectedV8Row,
        hideCadastro: true,
        productToneClass: 'is-v8',
        search: v8TeamSearch,
        setSearch: setV8TeamSearch,
        onToggle: (rowId, teamId, checked) => toggleTeamAccess('v8', rowId, teamId, checked),
        isDirty: !sameNumericList(selectedV8Row.accessTeamIds, initialIds),
        onSave: async () => {
          setIsSavingAccess(true)
          try {
            const response = await fetch(V8_UPDATE_TEAMS_ENDPOINT, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                id: selectedV8Row.id,
                equipe_id: sortNumericList(selectedV8Row.accessTeamIds),
              }),
            })
            const payload = await safeJson(response).catch(() => null)
            if (!response.ok || payload?.success === false) {
              throw new Error(payload?.message || `HTTP ${response.status}`)
            }
            setInitialV8Access((current) => ({
              ...current,
              [selectedV8Row.id]: sortNumericList(selectedV8Row.accessTeamIds),
            }))
            notify.success('Equipes do login V8 atualizadas com sucesso.')
          } catch (saveError) {
            notify.error(String(saveError?.message || 'Falha ao salvar alteracoes do V8.'))
          } finally {
            setIsSavingAccess(false)
          }
        },
      }
    }

    if (selectedAccess.product === 'hand' && selectedHandMaisRow) {
      const initialIds = initialHandMaisAccess[selectedHandMaisRow.id] || []
      return {
        title: 'Hand+',
        row: selectedHandMaisRow,
        hideCadastro: false,
        productToneClass: 'is-hand',
        search: handTeamSearch,
        setSearch: setHandTeamSearch,
        onToggle: (rowId, teamId, checked) => toggleTeamAccess('hand', rowId, teamId, checked),
        isDirty: !sameNumericList(selectedHandMaisRow.accessTeamIds, initialIds),
        onSave: async () => {
          setIsSavingAccess(true)
          try {
            const response = await fetch(HANDMAIS_UPDATE_TEAMS_ENDPOINT, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                id: selectedHandMaisRow.id,
                equipe_id: sortNumericList(selectedHandMaisRow.accessTeamIds),
              }),
            })
            const payload = await safeJson(response).catch(() => null)
            if (!response.ok || payload?.success === false) {
              throw new Error(payload?.message || `HTTP ${response.status}`)
            }
            setInitialHandMaisAccess((current) => ({
              ...current,
              [selectedHandMaisRow.id]: sortNumericList(selectedHandMaisRow.accessTeamIds),
            }))
            notify.success('Equipes do cadastro Hand+ atualizadas com sucesso.')
          } catch (saveError) {
            notify.error(String(saveError?.message || 'Falha ao salvar alteracoes do Hand+.'))
          } finally {
            setIsSavingAccess(false)
          }
        },
      }
    }

    return null
  }, [handTeamSearch, initialHandMaisAccess, initialV8Access, selectedAccess.product, selectedHandMaisRow, selectedV8Row, v8TeamSearch])

  const handleSubmitV8 = async (event) => {
    event.preventDefault()
    if (!canEditAccess) {
      notify.warn('Somente o perfil Master pode cadastrar logins V8.')
      return
    }
    if (!v8Email.trim()) {
      notify.warn('Informe o e-mail do login V8.')
      return
    }
    if (!v8Senha.trim()) {
      notify.warn('Informe a senha do login V8.')
      return
    }

    setIsSavingV8(true)
    try {
      const response = await fetch(V8_REGISTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: v8Email.trim(),
          senha: v8Senha,
          equipe_id: sortNumericList(v8EquipeIds),
        }),
      })

      const payload = await safeJson(response).catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`)
      }

      notify.success('Login V8 cadastrado com sucesso.')
      setIsV8ModalOpen(false)
      resetV8Modal()
      await loadData()
    } catch (saveError) {
      notify.error(String(saveError?.message || 'Falha ao cadastrar login V8.'))
    } finally {
      setIsSavingV8(false)
    }
  }

  const handleSubmitHandMais = async (event) => {
    event.preventDefault()
    if (!canEditAccess) {
      notify.warn('Somente o perfil Master pode cadastrar logins Hand+.')
      return
    }
    const empresaFinal =
      handEmpresaMode === 'novo'
        ? handEmpresaNova.trim()
        : handEmpresaSelecionada.trim()

    if (!empresaFinal) {
      notify.warn('Selecione uma empresa existente ou informe uma nova empresa.')
      return
    }

    if (!handTokenApi.trim()) {
      notify.warn('Informe o token da Hand+.')
      return
    }

    setIsSavingHandMais(true)
    try {
      const response = await fetch(HANDMAIS_REGISTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          empresa: empresaFinal,
          token_api: handTokenApi.trim(),
          equipe_id: sortNumericList(handEquipeIds),
        }),
      })

      const payload = await safeJson(response).catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `HTTP ${response.status}`)
      }

      notify.success('Cadastro Hand+ realizado com sucesso.')
      setIsHandMaisModalOpen(false)
      resetHandMaisModal()
      await loadData()
    } catch (saveError) {
      notify.error(String(saveError?.message || 'Falha ao cadastrar login Hand+.'))
    } finally {
      setIsSavingHandMais(false)
    }
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3 gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Cadastros APIs</h2>
              <div className="opacity-75 small">
                Visualizacao dos saldos e dos acessos por equipe em cada login.
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {updatedAt && <small className="opacity-75">Atualizado em: {updatedAt}</small>}
            <button type="button" className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2" onClick={loadData} disabled={loading}>
              <FiRefreshCw size={14} />
              <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          </div>
        </div>

        {error && (
          <section className="neo-card p-3 mb-3">
            <div className="small text-danger">{error}</div>
          </section>
        )}

        <section className="cadastros-api-grid">
          <ProductCard
            title="V8 Bank"
            rows={v8Rows}
            loading={loading}
            hideCadastro
            onAdd={openV8Modal}
            logoSrc="https://v8-white-label-logos.s3.us-east-1.amazonaws.com/v8-rebrand/v8-logo-auth0.svg"
            logoAlt="Logo V8 Bank"
            selectedRowId={selectedAccess.product === 'v8' ? selectedAccess.rowId : null}
            onSelectRow={(rowId) => handleSelectAccessRow('v8', rowId)}
            detailRow={selectedV8Row}
            teams={allTeams}
            teamSearch={v8TeamSearch}
            onTeamSearchChange={setV8TeamSearch}
            onToggleTeam={(rowId, teamId, checked) => toggleTeamAccess('v8', rowId, teamId, checked)}
            currentTeamId={equipeId}
            canEditAccess={canEditAccess}
            canAdd={canEditAccess}
            productToneClass="is-v8"
          />
          <ProductCard
            title="Hand+"
            rows={handMaisRows}
            loading={loading}
            hideCadastro={false}
            onAdd={openHandMaisModal}
            logoSrc="http://localhost:5174/handplus-logo.svg"
            logoFallbackSrc="/handplus-logo.svg"
            logoAlt="Logo Hand Plus"
            selectedRowId={selectedAccess.product === 'hand' ? selectedAccess.rowId : null}
            onSelectRow={(rowId) => handleSelectAccessRow('hand', rowId)}
            detailRow={selectedHandMaisRow}
            teams={allTeams}
            teamSearch={handTeamSearch}
            onTeamSearchChange={setHandTeamSearch}
            onToggleTeam={(rowId, teamId, checked) => toggleTeamAccess('hand', rowId, teamId, checked)}
            currentTeamId={equipeId}
            canEditAccess={canEditAccess}
            canAdd={canEditAccess}
            productToneClass="is-hand"
          />
        </section>

        <section className="neo-card p-3 mt-3 cadastros-api-info">
          <div className="cadastros-api-info-grid">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <FiDatabase size={14} />
                <strong>Equipe utilizada na consulta</strong>
              </div>
              <small className="opacity-75">
                equipe_id: {equipeId ?? '-'}
                {equipeNome ? ` | equipe_nome: ${equipeNome}` : ''}
              </small>
            </div>
            <div className="cadastros-api-info-side">
              <span>{formatInt(allTeams.length)} equipes mapeadas no painel</span>
              <span>{formatInt(v8Rows.length + handMaisRows.length)} logins carregados nesta tela</span>
            </div>
          </div>
        </section>
      </main>

      {isV8ModalOpen && (
        <div className="cadastros-api-modal-overlay" role="dialog" aria-modal="true">
          <section className="cadastros-api-modal neo-card">
            <header className="cadastros-api-modal-header">
              <h5 className="mb-0">Adicionar login V8</h5>
              <button
                type="button"
                className="btn btn-ghost btn-icon cadastros-api-modal-close"
                aria-label="Fechar"
                onClick={() => {
                  setIsV8ModalOpen(false)
                  resetV8Modal()
                }}
              >
                <FiX />
              </button>
            </header>
            <form className="cadastros-api-modal-body" onSubmit={handleSubmitV8}>
              <div className="mb-3">
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  className="form-control"
                  value={v8Email}
                  onChange={(event) => setV8Email(event.target.value)}
                  placeholder="email@dominio.com"
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Senha</label>
                <input
                  type="password"
                  className="form-control"
                  value={v8Senha}
                  onChange={(event) => setV8Senha(event.target.value)}
                  placeholder="Informe a senha"
                />
              </div>

              <div className="mb-3">
                <label className="form-label d-block">Equipes com acesso</label>
                <div className="cadastros-api-team-grid">
                  {allTeams.map((team) => {
                    const checked = v8EquipeIds.includes(team.id)
                    return (
                      <label key={`create-v8-team-${team.id}`} className={`cadastros-api-team-option ${checked ? 'is-enabled' : ''}`}>
                        <div className="cadastros-api-team-option-main">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => toggleCreateTeamSelection(setV8EquipeIds, v8EquipeIds, team.id, event.target.checked)}
                          />
                          <div>
                            <strong>{team.nome}</strong>
                            <span>equipe_id: {team.id}</span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="cadastros-api-modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setIsV8ModalOpen(false)
                    resetV8Modal()
                  }}
                  disabled={isSavingV8}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingV8}>
                  {isSavingV8 ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isHandMaisModalOpen && (
        <div className="cadastros-api-modal-overlay" role="dialog" aria-modal="true">
          <section className="cadastros-api-modal neo-card">
            <header className="cadastros-api-modal-header">
              <h5 className="mb-0">Adicionar login Hand+</h5>
              <button
                type="button"
                className="btn btn-ghost btn-icon cadastros-api-modal-close"
                aria-label="Fechar"
                onClick={() => {
                  setIsHandMaisModalOpen(false)
                  resetHandMaisModal()
                }}
              >
                <FiX />
              </button>
            </header>

            <form className="cadastros-api-modal-body" onSubmit={handleSubmitHandMais}>
              <div className="mb-3">
                <label className="form-label d-block">Empresa</label>
                <div className="cadastros-api-toggle-group mb-2">
                  <button
                    type="button"
                    className={`btn btn-sm ${handEmpresaMode === 'existente' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setHandEmpresaMode('existente')}
                  >
                    Usar existente
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${handEmpresaMode === 'novo' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setHandEmpresaMode('novo')}
                  >
                    Adicionar nova
                  </button>
                </div>

                {handEmpresaMode === 'existente' ? (
                  <select
                    className="form-select"
                    value={handEmpresaSelecionada}
                    onChange={(event) => setHandEmpresaSelecionada(event.target.value)}
                  >
                    <option value="">Selecione uma empresa</option>
                    {empresasHandMais.map((empresa) => (
                      <option key={empresa} value={empresa}>
                        {empresa}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control"
                    value={handEmpresaNova}
                    onChange={(event) => setHandEmpresaNova(event.target.value)}
                    placeholder="Nome da nova empresa"
                  />
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Token</label>
                <input
                  type="text"
                  className="form-control"
                  value={handTokenApi}
                  onChange={(event) => setHandTokenApi(event.target.value)}
                  placeholder="Token da API"
                />
              </div>

              <div className="mb-3">
                <label className="form-label d-block">Equipes com acesso</label>
                <div className="cadastros-api-team-grid">
                  {allTeams.map((team) => {
                    const checked = handEquipeIds.includes(team.id)
                    return (
                      <label key={`create-hand-team-${team.id}`} className={`cadastros-api-team-option ${checked ? 'is-enabled' : ''}`}>
                        <div className="cadastros-api-team-option-main">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => toggleCreateTeamSelection(setHandEquipeIds, handEquipeIds, team.id, event.target.checked)}
                          />
                          <div>
                            <strong>{team.nome}</strong>
                            <span>equipe_id: {team.id}</span>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="cadastros-api-modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setIsHandMaisModalOpen(false)
                    resetHandMaisModal()
                  }}
                  disabled={isSavingHandMais}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingHandMais}>
                  {isSavingHandMais ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <AccessWorkbench
        title={selectedAccessDetail?.title ?? ''}
        detailRow={selectedAccessDetail?.row ?? null}
        teams={allTeams}
        teamSearch={selectedAccessDetail?.search ?? ''}
        onTeamSearchChange={selectedAccessDetail?.setSearch ?? (() => {})}
        onToggleTeam={selectedAccessDetail?.onToggle ?? (() => {})}
        currentTeamId={equipeId}
        canEditAccess={canEditAccess}
        isSaving={isSavingAccess}
        isDirty={selectedAccessDetail?.isDirty ?? false}
        hideCadastro={selectedAccessDetail?.hideCadastro ?? false}
        productToneClass={selectedAccessDetail?.productToneClass ?? ''}
        onSave={selectedAccessDetail?.onSave ?? (async () => {})}
        onClose={() => setSelectedAccess({ product: null, rowId: null })}
      />

      <Footer />
    </div>
  )
}
