import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import * as Fi from 'react-icons/fi'
import { Link } from 'react-router-dom'

const endpoint = 'https://n8n.apivieiracred.store/webhook/get-zapresponder'

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export default function UsuariosZapresponder() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modalUser, setModalUser] = useState(null)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState([])
  const [activeTab, setActiveTab] = useState('usuarios')
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [tempDept, setTempDept] = useState([])
  const [deptUsersModal, setDeptUsersModal] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(endpoint, { method: 'GET' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Resposta inválida da API')
        setRows(data)
      } catch (err) {
        setError(err)
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const grouped = useMemo(() => {
    const source = Array.isArray(rows) && rows.length > 0 ? rows : []
    const map = new Map()
    source.forEach((row, idx) => {
      if (!row) return
      const key = row.email || row.usuario_nome || `row-${idx}`
      const current = map.get(key) || {
        nome: row.usuario_nome || 'Usuário',
        email: row.email || '-',
        atualizadoEm: row.atualizado_em || null,
        departamentos: [],
      }
      current.departamentos.push(row.departamento_nome || '-')
      if (row.atualizado_em) {
        const prev = current.atualizadoEm ? new Date(current.atualizadoEm).getTime() : 0
        const next = new Date(row.atualizado_em).getTime()
        if (next > prev) current.atualizadoEm = row.atualizado_em
      }
      map.set(key, current)
    })
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [rows])

  const totals = useMemo(() => {
    const depSet = new Set()
    grouped.forEach((g) => g.departamentos.forEach((d) => depSet.add(d)))
    const lastUpdated = grouped.reduce((acc, g) => {
      const ts = g.atualizadoEm ? new Date(g.atualizadoEm).getTime() : 0
      return ts > acc ? ts : acc
    }, 0)
    return {
      usuarios: grouped.length,
      departamentos: depSet.size,
      atualizadoEm: lastUpdated ? new Date(lastUpdated) : null,
      depList: Array.from(depSet).sort(),
    }
  }, [grouped])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const deptSet = new Set(deptFilter.map((d) => String(d || '').toLowerCase()))
    return grouped.filter((user) => {
      const matchesText = !q || `${user.nome} ${user.email}`.toLowerCase().includes(q)
      const matchesDept =
        deptSet.size === 0 ||
        user.departamentos.some((d) => deptSet.has(String(d || '').toLowerCase()))
      return matchesText && matchesDept
    })
  }, [grouped, search, deptFilter])

  const deptGroups = useMemo(() => {
    const map = new Map()
    filtered.forEach((user) => {
      user.departamentos.forEach((dep) => {
        const key = dep || '-'
        const entry = map.get(key) || { dep: key, users: new Map(), atualizadoEm: null }
        const name = user.nome || user.email || 'Usuário'
        const email = user.email || name
        entry.users.set(email, name)
        const ts = user.atualizadoEm ? new Date(user.atualizadoEm).getTime() : 0
        const prev = entry.atualizadoEm ? new Date(entry.atualizadoEm).getTime() : 0
        if (ts > prev) entry.atualizadoEm = user.atualizadoEm
        map.set(key, entry)
      })
    })
    return Array.from(map.values()).sort((a, b) => a.dep.localeCompare(b.dep))
  }, [filtered])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <Link to="/dashboard" className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2">
                <Fi.FiArrowLeft />
                <span className="d-none d-sm-inline">Voltar</span>
              </Link>
            </div>
            <h2 className="fw-bold mb-1">Usuários Zapresponder</h2>
            <div className="opacity-75">Visão dos usuários e seus departamentos no Zapresponder.</div>
          </div>
          <div className="d-none d-md-flex gap-2">
            <span className="badge text-bg-success d-flex align-items-center gap-1">
              <Fi.FiZap />
              Zapresponder
            </span>
            <span className="badge text-bg-secondary">Pré-visualização</span>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="text-uppercase small opacity-75 mb-1">Usuários</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiUsers />
                <span className="display-6 fw-bold">{totals.usuarios}</span>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="text-uppercase small opacity-75 mb-1">Departamentos únicos</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiGrid />
                <span className="display-6 fw-bold">{totals.departamentos}</span>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="text-uppercase small opacity-75 mb-1">Atualizado em</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiClock />
                <span className="fw-semibold">
                  {totals.atualizadoEm ? totals.atualizadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-6 col-lg-4">
              <label className="form-label small text-secondary mb-1">Buscar (usuário ou email)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Digite para filtrar"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-6 col-lg-4 d-flex flex-column gap-2">
              <label className="form-label small text-secondary mb-1">Departamentos</label>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-info btn-sm"
                  onClick={() => { setTempDept(deptFilter); setShowDeptModal(true) }}
                >
                  Selecionar
                </button>
                {deptFilter.length > 0 && (
                  <div className="d-flex flex-wrap gap-1">
                    {deptFilter.slice(0, 3).map((dep) => (
                      <span key={dep} className="badge text-bg-dark">{dep}</span>
                    ))}
                    {deptFilter.length > 3 && (
                      <span className="badge text-bg-secondary">+{deptFilter.length - 3}</span>
                    )}
                  </div>
                )}
                {deptFilter.length === 0 && <span className="small text-secondary">Todos</span>}
              </div>
            </div>
            <div className="col-12 col-md-12 col-lg-4 d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-light mt-auto"
                onClick={() => { setSearch(''); setDeptFilter([]) }}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 mb-3">
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'usuarios' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('usuarios')}
          >
            Usuários
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'deptos' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('deptos')}
          >
            Departamentos
          </button>
        </div>

        <div className="neo-card neo-lg p-4 tab-content">
          <div className={`tab-pane fade ${activeTab === 'usuarios' ? 'show active' : ''}`}>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <h5 className="mb-1 d-flex align-items-center gap-2">
                  <Fi.FiUsers />
                  Usuários e departamentos
                </h5>
                <div className="small opacity-75">Dados carregados do Zapresponder.</div>
              </div>
              {loading && (
                <div className="d-flex align-items-center gap-2 text-warning small">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Carregando...
                </div>
              )}
              {error && (
                <div className="text-danger small">
                  Falha ao carregar: {error.message}
                </div>
              )}
            </div>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th style={{ minWidth: '220px' }}>Departamentos</th>
                    <th style={{ width: '180px' }}>Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.email}>
                      <td className="fw-semibold">{user.nome}</td>
                      <td>{user.email}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-2"
                            onClick={() => setModalUser(user)}
                            title="Ver departamentos"
                            aria-label="Ver departamentos"
                          >
                            <Fi.FiList />
                            <span className="visually-hidden">Ver departamentos</span>
                            <span className="badge ms-1" style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#e2e8f0' }}>
                              {user.departamentos.length}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="text-nowrap">{formatDateTime(user.atualizadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`tab-pane fade ${activeTab === 'deptos' ? 'show active' : ''}`}>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <div>
                <h5 className="mb-1 d-flex align-items-center gap-2">
                  <Fi.FiGrid />
                  Departamentos e usuários
                </h5>
                <div className="small opacity-75">Agrupamento por departamento considerando os filtros acima.</div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                  <th>Departamento</th>
                  <th style={{ width: '140px' }}>Usuários</th>
                  <th>Lista</th>
                  <th style={{ width: '180px' }}>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {deptGroups.map((dep) => {
                    const users = Array.from(dep.users.values())
                    const preview = users.slice(0, 4).join(', ')
                    const hasMore = users.length > 4
                    return (
                    <tr key={dep.dep}>
                      <td className="fw-semibold">{dep.dep}</td>
                      <td>{users.length}</td>
                      <td>
                        {preview}
                        {hasMore && <span className="text-secondary"> +{users.length - 4} mais</span>}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1 ms-2"
                          onClick={() => setDeptUsersModal({ dep: dep.dep, users })}
                        >
                          <Fi.FiUsers />
                          <span className="visually-hidden">Ver usuários</span>
                        </button>
                      </td>
                      <td className="text-nowrap">{formatDateTime(dep.atualizadoEm)}</td>
                    </tr>
                  )
                })}
                  {deptGroups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-secondary py-3">Nenhum departamento encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <DepartamentosModal user={modalUser} onClose={() => setModalUser(null)} />
      <DeptUsersModal data={deptUsersModal} onClose={() => setDeptUsersModal(null)} />
      <DepartamentoFilterModal
        open={showDeptModal}
        options={totals.depList}
        selected={tempDept}
        onChange={setTempDept}
        onApply={() => { setDeptFilter(tempDept); setShowDeptModal(false) }}
        onClose={() => setShowDeptModal(false)}
        onClear={() => { setTempDept([]); setDeptFilter([]); setShowDeptModal(false) }}
      />
    </div>
  )
}

// Modal para mostrar todos os departamentos de um usuário
export function DepartamentosModal({ user, onClose }) {
  if (!user) return null
  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content bg-dark text-light border border-secondary">
          <div className="modal-header">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <Fi.FiUsers />
              Departamentos de {user.nome}
            </h5>
            <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-2 small text-secondary">{user.email}</div>
            <div className="mb-3 small text-secondary">
              Atualizado em: {formatDateTime(user.atualizadoEm)}
            </div>
            <div className="d-flex flex-wrap gap-2">
              {user.departamentos.map((dep, idx) => (
                <span
                  key={`${user.email}-${idx}`}
                  className="badge"
                  style={{ background: '#0b1220', border: '1px solid #1f2a44', color: '#e2e8f0' }}
                >
                  {dep}
                </span>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DepartamentoFilterModal({ open, options, selected, onChange, onApply, onClose, onClear }) {
  if (!open) return null
  const toggle = (dep) => {
    const exists = selected.includes(dep)
    if (exists) onChange(selected.filter((d) => d !== dep))
    else onChange([...selected, dep])
  }
  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-dark text-light border border-secondary">
          <div className="modal-header">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <Fi.FiList /> Selecionar departamentos
            </h5>
            <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {options.length === 0 && <div className="text-secondary small">Nenhum departamento disponível.</div>}
            <div className="d-flex flex-column gap-2">
              {options.map((dep) => (
                <label key={dep} className="d-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selected.includes(dep)}
                    onChange={() => toggle(dep)}
                  />
                  <span>{dep}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-light" onClick={onClear}>Limpar</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
            <button type="button" className="btn btn-primary" onClick={onApply}>Aplicar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeptUsersModal({ data, onClose }) {
  if (!data) return null
  const { dep, users = [] } = data
  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content bg-dark text-light border border-secondary">
          <div className="modal-header">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <Fi.FiUsers />
              Usuários do departamento
            </h5>
            <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="mb-3 small text-secondary">{dep}</div>
            {users.length === 0 && <div className="text-secondary small">Nenhum usuário listado.</div>}
            <ul className="list-group list-group-flush">
              {users.map((name, idx) => (
                <li key={`${dep}-${idx}`} className="list-group-item bg-dark text-light d-flex align-items-center gap-2">
                  <Fi.FiUser /> <span>{name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
