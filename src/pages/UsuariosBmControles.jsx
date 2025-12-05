import { useEffect, useMemo, useState, useCallback } from 'react'
import * as Fi from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'

const endpoint = 'https://n8n.apivieiracred.store/webhook/get-bm-manual'

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const badgeClass = (status) => {
  const s = (status || '').toLowerCase()
  if (s.includes('verificado')) return 'text-bg-success'
  if (s.includes('ban')) return 'text-bg-danger'
  if (s.includes('nao') || s.includes('nao')) return 'text-bg-secondary'
  return 'text-bg-warning'
}

const normalizeRows = (raw) => {
  if (!Array.isArray(raw)) return []
  // Agrupa por BM e por portfólio, juntando telefones dentro do mesmo portfólio
  const byBm = new Map()
  raw.forEach((row, idx) => {
    const bmId = row.id || row.id_bm || `row-${idx}`
    const bmNome = row.nome || row.nome_bm || 'BM'
    const criacaoBm = row.criacao_bm || null
    const portNome = row.portifolio || row.nome_portifolio || '-'
    const portKey = `${bmId}::${portNome}`

    const telefone = {
      phone: row.phone || '-',
      phone_status: row.phone_status || row.status_phone || '-',
      cartao: row.cartao || '-',
      id_phone: row.id_phone || row.phone_id || row.id_telefone || row.telefone_id || null,
    }

    const portEntry = {
      nome: portNome,
      status_port: row.status_port || '-',
      limite: row.limite || '-',
      criacao_port: row.criacao_port || null,
      telefones: [telefone],
      id_port: row.id_port || row.id_portifolio || row.portifolio_id || null,
    }

    const bm = byBm.get(bmId) || { id: bmId, nome: bmNome, criacao_bm: criacaoBm, portfolios: new Map() }
    const existingPort = bm.portfolios.get(portKey)
    if (existingPort) {
      existingPort.telefones.push(telefone)
    } else {
      bm.portfolios.set(portKey, portEntry)
    }
    byBm.set(bmId, bm)
  })

  // flattens to array with portfolios as arrays
  return Array.from(byBm.values()).map((bm) => ({
    id: bm.id,
    nome: bm.nome,
    criacao_bm: bm.criacao_bm,
    portfolios: Array.from(bm.portfolios.values()),
  }))
}

const formatPhoneBR = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2)
    const part1 = digits.slice(2, 7)
    const part2 = digits.slice(7)
    return `(${ddd}) ${part1}-${part2}`
  }
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2)
    const part1 = digits.slice(2, 6)
    const part2 = digits.slice(6)
    return `(${ddd}) ${part1}-${part2}`
  }
  return value || '-'
}

const formatPhoneInput = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const newTelefone = () => ({ numero: '', status: 'Verificado', cartao: 'OK', id_phone: null })
const newPortifolio = () => ({ nome: '', limite: '0', status: 'Verificado', criacao_port: null, id_port: null, telefones: [newTelefone()] })
const normalizeLimiteInput = (value) => (value === '1000000' || value === 1000000 ? 'Ilimitado' : String(value ?? '0'))

export default function UsuariosBmControles() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [openBms, setOpenBms] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [formBmNome, setFormBmNome] = useState('')
  const [formCriacaoBm, setFormCriacaoBm] = useState(null)
  const [formPortifolios, setFormPortifolios] = useState([newPortifolio()])
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [editingBmId, setEditingBmId] = useState(null)
  const isEditMode = formMode === 'edit' || Boolean(editingBmId)

  const buildPortifoliosFromBm = (bm) => {
    const ports = Array.isArray(bm?.portfolios) ? bm.portfolios : []
    const mapped = ports.map((port) => ({
      nome: port.nome || '',
      limite: normalizeLimiteInput(port.limite),
      status: port.status_port || 'Verificado',
      criacao_port: port.criacao_port || null,
      id_port: port.id_port || port.id_portifolio || null,
      telefones: (Array.isArray(port.telefones) && port.telefones.length > 0 ? port.telefones : [newTelefone()]).map((tel) => ({
        numero: formatPhoneInput(tel.phone || ''),
        status: tel.phone_status || tel.status || 'Verificado',
        cartao: tel.cartao || 'OK',
        id_phone: tel.id_phone || null
      }))
    }))
    return mapped.length ? mapped : [newPortifolio()]
  }

  const openAddModal = () => {
    setFormMode('add')
    setEditingBmId(null)
    setFormBmNome('')
    setFormCriacaoBm(null)
    setFormPortifolios([newPortifolio()])
    setFormError('')
    setShowForm(true)
  }

  const openEditModal = (bm) => {
    setFormMode('edit')
    setEditingBmId(bm?.id || null)
    setFormBmNome(bm?.nome || '')
    setFormCriacaoBm(bm?.criacao_bm || null)
    setFormPortifolios(buildPortifoliosFromBm(bm))
    setFormError('')
    setShowForm(true)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'GET' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRows(normalizeRows(data))
      setCurrentPage(1)
    } catch (err) {
      setError(err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const grupos = useMemo(() => {
    const parseId = (v) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }
    return [...rows].sort((a, b) => {
      const diff = parseId(b?.id) - parseId(a?.id)
      if (diff !== 0) return diff
      return (a?.nome || '').localeCompare(b?.nome || '')
    })
  }, [rows])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(grupos.length / PAGE_SIZE)), [grupos.length])
  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return grupos.slice(start, start + PAGE_SIZE)
  }, [grupos, safePage])

  useEffect(() => {
    setOpenBms([])
  }, [paginated])

  useEffect(() => {
    if (currentPage !== safePage) setCurrentPage(safePage)
  }, [safePage, currentPage])

  const resumo = useMemo(() => {
    const bmCount = grupos.length
    const portCount = grupos.reduce((acc, bm) => acc + (Array.isArray(bm.portfolios) ? bm.portfolios.length : 0), 0)
    const ultimaCriacaoBm = grupos.reduce((acc, g) => {
      const ts = g.criacao_bm ? new Date(g.criacao_bm).getTime() : 0
      return ts > acc ? ts : acc
    }, 0)
    return {
      bms: bmCount,
      portifolios: portCount,
      ultimaCriacaoBm: ultimaCriacaoBm ? new Date(ultimaCriacaoBm) : null
    }
  }, [grupos, rows])

  const payloadTelefones = (list) =>
    list
      .map((t) => {
        const digits = String(t.numero || '').replace(/\D/g, '')
        const base = {
          phone: digits || null,
          status: (t.status || '').toLowerCase(),
          cartao: (t.cartao || '').toLowerCase()
        }
        if (t.id_phone) base.id_phone = t.id_phone
        return base
      })
      .filter((t) => t.phone)

  const payloadPortifolios = (list, criacaoPort) =>
    list
      .map((p) => {
        const base = {
          nome_portifolio: (p.nome || '').trim(),
          limite: p.limite === 'Ilimitado' ? '1000000' : String(p.limite || '0'),
          status_port: p.status || '',
          criacao_port: p.criacao_port || criacaoPort,
          telefones: payloadTelefones(p.telefones || [])
        }
        if (p.id_port) base.id_port = p.id_port
        return base
      })
      .filter((p) => p.nome_portifolio)

  const handlePortifolioChange = (idx, field, value) => {
    setFormPortifolios((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  const handleTelefoneChange = (pIdx, tIdx, field, value) => {
    setFormPortifolios((prev) =>
      prev.map((p, i) => {
        if (i !== pIdx) return p
        const telefones = (p.telefones || []).map((t, j) =>
          j === tIdx ? { ...t, [field]: field === 'numero' ? formatPhoneInput(value) : value } : t
        )
        return { ...p, telefones }
      })
    )
  }

  const handleSubmitForm = async (e) => {
    e?.preventDefault?.()
    const nomeBm = formBmNome.trim()
    const nowIso = new Date().toISOString()
    const ports = payloadPortifolios(formPortifolios, nowIso)
    const criacaoBm = isEditMode ? (formCriacaoBm || nowIso) : nowIso

    if (!nomeBm) return setFormError('Informe o nome da BM.')
    if (ports.length === 0) return setFormError('Adicione pelo menos um portifolio com nome.')
    if (ports.some((p) => (p.telefones || []).length === 0)) return setFormError('Cada portifolio precisa de pelo menos um telefone.')

    const payload = {
      nome_bm: nomeBm,
      criacao_bm: criacaoBm,
      portfolios: ports
    }
    if (isEditMode && editingBmId) payload.id_bm = editingBmId

    try {
      setFormSaving(true)
      setFormError('')
      const urlSalvar = isEditMode
        ? 'https://n8n.apivieiracred.store/webhook/atualiza-bm-port'
        : 'https://n8n.apivieiracred.store/webhook/adiciona-bm-port'
      const res = await fetch(urlSalvar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      setShowForm(false)
      setFormBmNome('')
      setFormCriacaoBm(null)
      setFormPortifolios([newPortifolio()])
      await loadData()
    } catch (err) {
      console.error('Falha ao salvar BM:', err)
      setFormError(err.message || 'Erro ao salvar')
    } finally {
      setFormSaving(false)
    }
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />

      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2">
              <Fi.FiArrowLeft />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <div className="small text-secondary mb-1 text-uppercase">Administração</div>
              <h2 className="fw-bold mb-1">BM Controles</h2>
              <div className="opacity-75">Central para visualizar conexoes e responsaveis dos BMs.</div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge text-bg-info d-flex align-items-center gap-1">
              <Fi.FiInfo />
              Versao inicial
            </span>
          </div>
        </div>

        <div className="row g-3 mt-1">
          <div className="col-12">
            <div className="neo-card neo-lg p-4" style={{
              background: 'linear-gradient(135deg, rgba(17,24,39,0.9), rgba(30,41,59,0.85))',
              border: '1px solid rgba(148,163,184,0.28)',
              boxShadow: '0 12px 45px rgba(0,0,0,0.35)'
            }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h5 className="mb-0">Business Managers</h5>
                </div>
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <span className="badge text-bg-secondary">BMs: {resumo.bms}</span>
                  <span className="badge text-bg-secondary">Portf.: {resumo.portifolios}</span>
                  <span className="badge text-bg-secondary">
                    Ult. criacao BM: {resumo.ultimaCriacaoBm ? resumo.ultimaCriacaoBm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}
                  </span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={openAddModal}>
                    + Adicionar BM
                  </button>
                </div>
              </div>

              {loading && (
                <div className="alert alert-info d-flex align-items-center gap-2 mb-0">
                  <Fi.FiRefreshCw className="spin" />
                  <span>Carregando dados...</span>
                </div>
              )}

              {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-0">
                  <Fi.FiAlertTriangle />
                  <div>
                    <div className="fw-semibold">Falha ao consultar a API</div>
                    <div className="small">{error.message || 'Erro desconhecido'}</div>
                  </div>
                </div>
              )}

              {!loading && !error && rows.length === 0 && (
                <div className="alert alert-warning d-flex align-items-center gap-2 mb-0">
                  <Fi.FiInbox />
                  <span>Nenhum dado retornado.</span>
                </div>
              )}

              {!loading && !error && grupos.length > 0 && (
                <div className="d-flex flex-column gap-2">
                  {grupos.length > PAGE_SIZE && (
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="small text-secondary">
                        Pagina {safePage} de {totalPages} • Mostrando {paginated.length} de {grupos.length} BMs
                      </div>
                      <div className="btn-group">
                        <button
                          type="button"
                          className="btn btn-outline-light btn-sm"
                          disabled={safePage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-light btn-sm"
                          disabled={safePage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-1 d-flex flex-column gap-2">
                    {paginated.map((bm) => {
                      const portfolios = Array.isArray(bm.portfolios) ? bm.portfolios : []
                      const isOpen = openBms.includes(bm.id)
                      return (
                        <div
                          key={bm.id}
                          className="p-0 neo-card neo-lg"
                          style={{
                            background: 'rgba(12,18,32,0.8)',
                            border: '1px solid rgba(100,116,139,0.25)',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-100 d-flex align-items-center justify-content-between px-3 py-3"
                            onClick={() =>
                              setOpenBms((prev) =>
                                prev.includes(bm.id) ? prev.filter((id) => id !== bm.id) : [...prev, bm.id]
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setOpenBms((prev) =>
                                  prev.includes(bm.id) ? prev.filter((id) => id !== bm.id) : [...prev, bm.id]
                                )
                              }
                            }}
                            aria-expanded={isOpen}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer'
                            }}
                          >
                            <div className="d-flex align-items-center gap-3 text-start">
                              <div
                                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                                style={{
                                  width: 34,
                                  height: 34,
                                  background: 'rgba(59,130,246,0.15)',
                                  border: '1px solid rgba(59,130,246,0.35)'
                                }}
                              >
                                <Fi.FiChevronRight
                                  style={{
                                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.18s ease'
                                  }}
                                />
                              </div>
                              <div>
                                <div className="text-uppercase small opacity-75 mb-1">BM #{bm.id}</div>
                                <div className="fw-bold">{bm.nome}</div>
                                <div className="small text-secondary">Criacao BM: {formatDateTime(bm.criacao_bm)}</div>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge text-bg-info">Portf.: {Array.isArray(portfolios) ? portfolios.length : 0}</span>
                              <button
                                type="button"
                                className="btn btn-outline-info btn-sm d-inline-flex align-items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditModal(bm)
                                }}
                              >
                                <Fi.FiEdit2 />
                                <span className="d-none d-md-inline">Editar</span>
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="p-3 pt-0">
                              <div className="d-flex flex-column gap-2">
                                {portfolios.map((port, pIdx) => (
                                  <div
                                    key={`${bm.id}-${pIdx}`}
                                    className="neo-card p-3"
                                    style={{ background: 'rgba(20,27,46,0.75)', border: '1px solid rgba(148,163,184,0.2)' }}
                                  >
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <div>
                                        <div className="fw-semibold">{port.nome}</div>
                                        <div className="small text-secondary">
                                          Limite: {port.limite} • Criacao: {formatDateTime(port.criacao_port)}
                                        </div>
                                      </div>
                                      <span className={`badge ${badgeClass(port.status_port)}`}>{port.status_port}</span>
                                    </div>

                                    <div className="table-responsive">
                                      <table className="table table-dark table-hover align-middle mb-0">
                                        <thead>
                                          <tr>
                                            <th className="small text-uppercase text-secondary">Telefone</th>
                                            <th className="small text-uppercase text-secondary">Cartao</th>
                                            <th className="small text-uppercase text-secondary">Status phone</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(() => {
                                            const raw = Array.isArray(port.telefones) ? port.telefones : []
                                            const valid = raw.filter((t) => {
                                              const digits = String(t.phone || '').replace(/\D/g, '')
                                              return digits && digits !== '0'
                                            })
                                            const toRender = valid.length ? valid : [{ phone: null, cartao: '-', phone_status: '-' }]
                                            return toRender.map((tel, tIdx) => (
                                              <tr key={`${bm.id}-${pIdx}-${tIdx}`}>
                                                <td>{tel.phone ? formatPhoneBR(tel.phone) : 'Sem telefone cadastrado'}</td>
                                                <td>{tel.cartao || '-'}</td>
                                                <td><span className={`badge ${badgeClass(tel.phone_status)}`}>{tel.phone_status || '-'}</span></td>
                                              </tr>
                                            ))
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {showForm && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
          <div
            className="neo-card neo-lg p-4"
            style={{
              maxWidth: 860,
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div>
                <h5 className="mb-0">{isEditMode ? 'Editar BM manual' : 'Adicionar BM manual'}</h5>
                {isEditMode && editingBmId && <div className="small text-secondary mt-1">BM #{editingBmId}</div>}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)} aria-label="Fechar">
                <Fi.FiX />
              </button>
            </div>

            {formError && (
              <div className="alert alert-danger py-2" role="alert">{formError}</div>
            )}

            <form onSubmit={handleSubmitForm} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small">Nome da BM *</label>
                <input
                  className="form-control"
                  value={formBmNome}
                  onChange={(e) => setFormBmNome(e.target.value)}
                  placeholder="Ex: Vieira - Leticia - ND, Art, King"
                  required
                />
              </div>

              <div className="neo-card p-3" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.25)' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">Portifolios e Telefones</div>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() =>
                      setFormPortifolios((p) => [
                        ...p,
                        newPortifolio()
                      ])
                    }
                  >
                    + Adicionar portifolio
                  </button>
                </div>
                <div className="d-flex flex-column gap-3">
                  {formPortifolios.map((p, idx) => (
                    <div key={idx} className="neo-card p-3" style={{ background: 'rgba(10,14,25,0.6)', border: '1px solid rgba(148,163,184,0.2)' }}>
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-md-4">
                          <label className="form-label small">Nome *</label>
                          <input
                            className="form-control"
                            value={p.nome}
                            onChange={(e) => handlePortifolioChange(idx, 'nome', e.target.value)}
                            required
                          />
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small">Limite *</label>
                          <select
                            className="form-select"
                            value={p.limite}
                            onChange={(e) => handlePortifolioChange(idx, 'limite', e.target.value)}
                          >
                            <option value="0">0</option>
                            <option value="250">250</option>
                            <option value="2000">2000</option>
                            <option value="10000">10000</option>
                            <option value="100000">100000</option>
                            <option value="Ilimitado">Ilimitado</option>
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small">Status *</label>
                          <select
                            className="form-select"
                            value={p.status}
                            onChange={(e) => handlePortifolioChange(idx, 'status', e.target.value)}
                          >
                            <option value="Verificado">Verificado</option>
                            <option value="Nao verificado">Nao verificado</option>
                            <option value="Em analise">Em analise</option>
                            <option value="Rejeitado">Rejeitado</option>
                            <option value="Restrito">Restrito</option>
                          </select>
                        </div>
                        <div className="col-12 col-md-2 d-flex justify-content-end">
                          {formPortifolios.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm text-danger"
                              onClick={() => setFormPortifolios((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div className="small text-secondary">Telefones do portifolio</div>
                          <button
                            type="button"
                            className="btn btn-outline-light btn-sm"
                            onClick={() =>
                              setFormPortifolios((prev) =>
                                prev.map((port, i) =>
                                  i === idx
                                    ? {
                                        ...port,
                                        telefones: [...(port.telefones || []), newTelefone()]
                                      }
                                    : port
                                )
                              )
                            }
                          >
                            + Adicionar telefone
                          </button>
                        </div>
                        <div className="d-flex flex-column gap-2">
                          {(p.telefones || []).map((t, tIdx) => (
                            <div key={tIdx} className="row g-2 align-items-end">
                              <div className="col-12 col-md-4">
                                <label className="form-label small">Numero *</label>
                                <input
                                  className="form-control"
                                  value={t.numero}
                                  onChange={(e) => handleTelefoneChange(idx, tIdx, 'numero', e.target.value)}
                                  placeholder="(11) 99999-9999"
                                  required
                                />
                              </div>
                              <div className="col-12 col-md-3">
                                <label className="form-label small">Status *</label>
                                <select
                                  className="form-select"
                                  value={t.status}
                                  onChange={(e) => handleTelefoneChange(idx, tIdx, 'status', e.target.value)}
                                >
                                  <option value="Verificado">Verificado</option>
                                  <option value="Nao verificado">Nao verificado</option>
                                  <option value="Em analise">Em analise</option>
                                  <option value="Rejeitado">Rejeitado</option>
                                  <option value="Restrito">Restrito</option>
                                </select>
                              </div>
                              <div className="col-12 col-md-3">
                                <label className="form-label small">Cartao *</label>
                                <select
                                  className="form-select"
                                  value={t.cartao}
                                  onChange={(e) => handleTelefoneChange(idx, tIdx, 'cartao', e.target.value)}
                                >
                                  <option value="OK">OK</option>
                                  <option value="Sem Saldo">Sem Saldo</option>
                                  <option value="Nao Cadastrado">Nao Cadastrado</option>
                                </select>
                              </div>
                              <div className="col-12 col-md-2 d-flex justify-content-end">
                                {(p.telefones || []).length > 1 && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm text-danger"
                                    onClick={() =>
                                      setFormPortifolios((prev) =>
                                        prev.map((port, i) =>
                                          i === idx
                                            ? { ...port, telefones: port.telefones.filter((_, j) => j !== tIdx) }
                                            : port
                                        )
                                      )
                                    }
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={formSaving}>
                  {formSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
