import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import * as Fi from 'react-icons/fi'

const USERS_URL = 'https://n8n.apivieiracred.store/webhook/api/getusuarios'
const TEAMS_URL = 'https://n8n.apivieiracred.store/webhook/api/getequipes'
const ROWS_PER_PAGE = 10

const toBool = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  const token = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'sim', 'yes', 'on'].includes(token)
}

const unwrapPayload = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.value)) return payload.value
  if (Array.isArray(payload?.data)) return payload.data
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const parseResponseArray = async (response) => {
  const text = await response.text()
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return []

  try {
    const json = JSON.parse(trimmed)
    return unwrapPayload(json)
  } catch {
    return []
  }
}

const normalizeName = (value) => String(value ?? '').toUpperCase()

const buildLoginFromName = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '')
}

const isEmptyJsonResponseError = (value) => {
  const message = String(value ?? '').toLowerCase()
  return message.includes('unexpected end of json input') || message.includes("failed to execute 'json' on 'response'")
}

export default function AdminUsuariosCadastro() {
  const [rows, setRows] = useState([])
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [modalError, setModalError] = useState('')
  const [isLoginDirty, setIsLoginDirty] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    login: '',
    equipe_id: '',
    ativo: true,
    senha: '',
    senha_confirmacao: ''
  })

  const load = async () => {
    setIsLoading(true)
    setError('')

    try {
      const [usersResp, teamsResp] = await Promise.all([
        fetch(USERS_URL, { method: 'GET' }),
        fetch(TEAMS_URL, { method: 'GET' })
      ])

      if (!usersResp.ok) throw new Error(`Usuários HTTP ${usersResp.status}`)
      if (!teamsResp.ok) throw new Error(`Equipes HTTP ${teamsResp.status}`)

      const usersJson = await parseResponseArray(usersResp)
      const teamsJson = await parseResponseArray(teamsResp)

      const teamRows = teamsJson
        .map((item) => ({
          id: Number(item?.id ?? 0),
          nome: String(item?.nome ?? item?.descricao ?? `Equipe ${item?.id ?? ''}`).trim(),
          ativo: toBool(item?.ativo ?? true)
        }))
        .filter((item) => Number.isFinite(item.id) && item.id > 0)

      const teamNameById = new Map(teamRows.map((team) => [team.id, team.nome]))

      const userRows = usersJson
        .map((item) => {
          const equipeId = Number(item?.equipe_id ?? item?.equipeId ?? 0) || null
          return {
            id: Number(item?.id ?? 0),
            nome: normalizeName(String(item?.nome ?? '').trim()),
            login: String(item?.login ?? '').trim().toLowerCase(),
            equipe_id: equipeId,
            equipe_nome: String(item?.equipe_nome ?? teamNameById.get(equipeId) ?? '-').trim(),
            ativo: toBool(item?.ativo ?? true)
          }
        })
        .filter((item) => Number.isFinite(item.id) && item.id > 0)

      setTeams(teamRows)
      setRows(userRows)
      setCurrentPage(1)
    } catch (loadError) {
      const message = String(loadError?.message || loadError || 'Erro ao carregar usuários')
      if (isEmptyJsonResponseError(message)) {
        setRows([])
        setError('')
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (teamFilter && String(row.equipe_id ?? '') !== teamFilter) return false
      if (!term) return true
      return `${row.nome} ${row.login} ${row.equipe_nome}`.toLowerCase().includes(term)
    })
  }, [rows, search, teamFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)

  const paginated = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE
    return filtered.slice(start, start + ROWS_PER_PAGE)
  }, [filtered, safePage])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const paginationItems = useMemo(() => {
    const items = []
    for (let page = 1; page <= totalPages; page += 1) items.push(page)
    return items
  }, [totalPages])

  const openCreate = () => {
    setEditingRow(null)
    setForm({
      nome: '',
      login: '',
      equipe_id: '',
      ativo: true,
      senha: '',
      senha_confirmacao: ''
    })
    setIsLoginDirty(false)
    setShowPassword(false)
    setShowPasswordConfirm(false)
    setModalError('')
    setShowModal(true)
  }

  const openEdit = (row) => {
    setEditingRow(row)
    setForm({
      nome: normalizeName(row.nome || ''),
      login: String(row.login || '').toLowerCase(),
      equipe_id: row.equipe_id ? String(row.equipe_id) : '',
      ativo: Boolean(row.ativo),
      senha: '',
      senha_confirmacao: ''
    })
    setIsLoginDirty(true)
    setShowPassword(false)
    setShowPasswordConfirm(false)
    setModalError('')
    setShowModal(true)
  }

  const updateNome = (value) => {
    const upperName = normalizeName(value)
    setForm((prev) => {
      const next = { ...prev, nome: upperName }
      if (!isLoginDirty) next.login = buildLoginFromName(upperName)
      return next
    })
  }

  const updateLogin = (value) => {
    setIsLoginDirty(true)
    setForm((prev) => ({ ...prev, login: buildLoginFromName(value) }))
  }

  const closeModal = () => {
    setShowModal(false)
    setShowPassword(false)
    setShowPasswordConfirm(false)
    setModalError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const trimmedNome = normalizeName(form.nome).trim()
    const trimmedLogin = buildLoginFromName(form.login).trim()
    const equipeId = form.equipe_id ? Number(form.equipe_id) : null
    const equipeNome = teams.find((team) => team.id === equipeId)?.nome || '-'
    const senha = String(form.senha ?? '').trim()
    const confirmacao = String(form.senha_confirmacao ?? '').trim()

    if (!trimmedNome || !trimmedLogin) {
      setModalError('Preencha Nome e Login.')
      return
    }

    if (!equipeId) {
      setModalError('Selecione uma equipe.')
      return
    }

    const shouldValidatePassword = !editingRow || senha || confirmacao
    if (shouldValidatePassword) {
      if (senha.length < 4 || confirmacao.length < 4) {
        setModalError('Senha e confirmação precisam ter no mínimo 4 caracteres.')
        return
      }
      if (senha !== confirmacao) {
        setModalError('Senha e confirmação precisam ser iguais.')
        return
      }
    }

    setModalError('')

    if (editingRow) {
      setRows((prev) => prev.map((row) => (
        row.id === editingRow.id
          ? {
              ...row,
              nome: trimmedNome,
              login: trimmedLogin,
              equipe_id: equipeId,
              equipe_nome: equipeNome,
              ativo: Boolean(form.ativo)
            }
          : row
      )))
    } else {
      const nextId = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
      setRows((prev) => [
        {
          id: nextId,
          nome: trimmedNome,
          login: trimmedLogin,
          equipe_id: equipeId,
          equipe_nome: equipeNome,
          ativo: Boolean(form.ativo)
        },
        ...prev
      ])
    }

    closeModal()
  }

  const statusSwitchId = `admin-user-ativo-${editingRow?.id ?? 'new'}`

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2">
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Usuários</h2>
              <div className="opacity-75 small">Cadastro de usuários no novo modelo.</div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-4 mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small opacity-75">Buscar</label>
              <input
                className="form-control"
                placeholder="Nome, login ou equipe..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small opacity-75">Equipe</label>
              <select className="form-select" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                <option value="">Todas</option>
                {teams.map((team) => (
                  <option key={team.id} value={String(team.id)}>{team.nome}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-auto ms-md-auto d-flex gap-2 justify-content-end">
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setTeamFilter('') }}>
                <Fi.FiX className="me-1" />
                Limpar
              </button>
              <button className="btn btn-ghost btn-ghost-primary btn-sm" onClick={load} disabled={isLoading}>
                <Fi.FiRefreshCcw className="me-1" />
                Atualizar
              </button>
              <button className="btn btn-ghost btn-ghost-info btn-sm" onClick={openCreate}>
                <Fi.FiPlus className="me-1" />
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div className="small opacity-75 mb-2">Mostrando {filtered.length} de {rows.length} usuários</div>

        <div className="neo-card neo-lg p-0">
          {isLoading && (<div className="p-4 text-center opacity-75">Carregando...</div>)}
          {error && (<div className="p-4 alert alert-danger m-3">{error}</div>)}
          {!isLoading && !error && (
            <div className="table-responsive">
              {totalPages > 1 && (
                <div className="d-flex justify-content-end px-3 pt-3">
                  <div className="d-flex align-items-center gap-2">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage === 1}>
                      <Fi.FiChevronLeft />
                    </button>
                    {paginationItems.map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={`btn btn-sm ${page === safePage ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>
                      <Fi.FiChevronRight />
                    </button>
                  </div>
                </div>
              )}
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ID</th>
                    <th>Nome</th>
                    <th>Login</th>
                    <th>Equipe</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 && (
                    <tr><td colSpan={6} className="text-center opacity-75 p-4">Sem usuarios cadastrados</td></tr>
                  )}
                  {paginated.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td className="text-uppercase">{row.nome || '-'}</td>
                      <td>{row.login || '-'}</td>
                      <td>{row.equipe_nome || '-'}</td>
                      <td>
                        <span className={`badge ${row.ativo ? 'text-bg-success' : 'text-bg-danger'}`}>
                          {row.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-ghost-primary btn-icon d-inline-flex align-items-center justify-content-center"
                          title="Editar"
                          onClick={() => openEdit(row)}
                        >
                          <Fi.FiEdit2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-3" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 2200 }}>
          <div className="neo-card neo-lg p-0 admin-modal-card admin-users-modal-card" style={{ maxWidth: 760, width: '95%', maxHeight: '88vh' }}>
            <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
              <h5 className="mb-0">{editingRow ? 'Editar Usuário' : 'Novo Usuário'}</h5>
              <button className="btn btn-ghost btn-icon" onClick={closeModal} aria-label="Fechar">
                <Fi.FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="admin-modal-body admin-users-modal-body p-4">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small">Nome</label>
                  <input
                    className="form-control text-uppercase"
                    value={form.nome}
                    onChange={(event) => updateNome(event.target.value)}
                    placeholder="NOME SOBRENOME"
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small">Login</label>
                  <input
                    className="form-control"
                    value={form.login}
                    onChange={(event) => updateLogin(event.target.value)}
                    placeholder="nomesobrenome"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>

                <div className="col-12 col-md-9">
                  <label className="form-label small">Equipe</label>
                  <select
                    className="form-select"
                    value={form.equipe_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, equipe_id: event.target.value }))}
                    required
                  >
                    <option value="">Selecione uma equipe</option>
                    {teams.map((team) => (
                      <option key={team.id} value={String(team.id)}>{team.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3 d-flex align-items-end">
                  <div className="admin-users-active-wrap w-100">
                    <label className="form-label small mb-2" htmlFor={statusSwitchId}>Status</label>
                    <div className="form-check form-switch m-0">
                      <input
                        id={statusSwitchId}
                        className="form-check-input"
                        type="checkbox"
                        checked={Boolean(form.ativo)}
                        onChange={(event) => setForm((prev) => ({ ...prev, ativo: event.target.checked }))}
                      />
                      <label className="form-check-label fw-semibold" htmlFor={statusSwitchId}>
                        {form.ativo ? 'Ativo' : 'Inativo'}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small">Senha</label>
                  <div className="input-group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      value={form.senha}
                      onChange={(event) => setForm((prev) => ({ ...prev, senha: event.target.value }))}
                      placeholder={editingRow ? 'Preencha para alterar' : 'Mínimo 4 caracteres'}
                      minLength={4}
                      required={!editingRow}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <Fi.FiEyeOff /> : <Fi.FiEye />}
                    </button>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small">Confirmar senha</label>
                  <div className="input-group">
                    <input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      className="form-control"
                      value={form.senha_confirmacao}
                      onChange={(event) => setForm((prev) => ({ ...prev, senha_confirmacao: event.target.value }))}
                      placeholder={editingRow ? 'Repita para confirmar' : 'Repita a senha'}
                      minLength={4}
                      required={!editingRow}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPasswordConfirm((prev) => !prev)}
                      title={showPasswordConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-label={showPasswordConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPasswordConfirm ? <Fi.FiEyeOff /> : <Fi.FiEye />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="small opacity-75 mt-2">
                Nome em maiúsculo e login sem espaços. Exemplo: JOÃO SILVA -> joaosilva.
              </div>
              {modalError && (
                <div className="alert alert-danger py-2 px-3 mt-3 mb-0 small">
                  {modalError}
                </div>
              )}

              <div className="d-flex justify-content-end gap-2 admin-modal-actions admin-users-modal-actions">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm">{editingRow ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
