import { Fragment, useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw, X } from 'lucide-react'
import { fetchN8n } from '../services/n8nClient.js'

const CAMP_PAGE_SIZE = 50

const parseYmdLocal = (ymd, endOfDay = false) => {
  if (!ymd) return null
  const [y, m, d] = String(ymd).split('-').map((p) => Number(p))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
}

const CREATED_AT_OFFSET_MS = 3 * 60 * 60 * 1000

const fmtDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const adjusted = new Date(date.getTime() + CREATED_AT_OFFSET_MS)
  return adjusted.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const fmtPhoneBR = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return '-'
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return digits
}

const badgeForStatus = (value) => {
  const v = String(value ?? '').trim().toLowerCase()
  if (!v) return 'text-bg-secondary'
  if (v.includes('paus')) return 'text-bg-warning'
  if (v.includes('final')) return 'text-bg-info'
  if (v.includes('ver')) return 'text-bg-secondary'
  return 'text-bg-secondary'
}

const badgeForSendStatus = (value) => {
  const v = canonicalSendStatus(value)
  if (!v) return 'text-bg-secondary'
  if (v === 'SUCCESS') return 'text-bg-success'
  if (v === 'SENDING') return 'text-bg-primary'
  if (v === 'READ') return 'text-bg-info'
  if (v === 'ANSWERED') return 'text-bg-primary'
  if (v === 'A ENVIAR') return 'text-bg-warning'
  if (v === 'HEALTHY_ECOSYSTEM_ENGAGEMENT') return 'text-bg-info'
  if (isFailureSendStatus(v)) return 'text-bg-danger'
  return 'text-bg-secondary'
}

const normalizeCampanhaStatus = (row) => {
  const msg = String(row?.mensagem ?? '').toLowerCase()
  const status = String(row?.status ?? '').toLowerCase()
  if (msg.includes('final')) return 'Finalizado'
  if (status.includes('paus')) return 'Pausado'
  if (status.includes('ver')) return 'Finalizado'
  return row?.status || '-'
}

const canonicalSendStatus = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (upper.startsWith('USER_NUMBER_IS_PART_OF_AN_EXPE')) return 'USER_NUMBER_IS_PART_OF_AN_EXPE'
  return upper
}

const isFailureSendStatus = (canonical) =>
  canonical === 'DONT_EXISTS' ||
  canonical === 'UNSUPPORTED_POST_REQUEST' ||
  canonical === 'AN_ERROR_OCCURRED' ||
  canonical === 'GENERIC_USER_ERROR' ||
  canonical === 'GENERIC USER ERROR' ||
  canonical === 'PAYMENT_ISSUE' ||
  canonical === 'ACCOUNT_BLOCKED' ||
  canonical === 'USER_NUMBER_IS_PART_OF_AN_EXPE'

const labelSendStatus = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  const v = canonicalSendStatus(raw)
  if (v === 'SUCCESS') return 'ENTREGUE'
  if (v === 'SENDING') return 'ENVIADO'
  if (v === 'READ') return 'LIDO'
  if (v === 'ANSWERED') return 'RESPONDIDO'
  if (v === 'AN_ERROR_OCCURRED') return 'ERRO'
  if (v === 'GENERIC_USER_ERROR' || v === 'GENERIC USER ERROR') return 'ERRO (GENÉRICO)'
  if (v === 'PAYMENT_ISSUE') return 'PROBLEMA DE PAGAMENTO'
  if (v === 'A ENVIAR') return 'A ENVIAR'
  if (v === 'ACCOUNT_BLOCKED') return 'CONTA BLOQUEADA'
  if (v === 'HEALTHY_ECOSYSTEM_ENGAGEMENT') return 'ENGAJAMENTO SAUDÁVEL'
  if (v === 'UNSUPPORTED_POST_REQUEST') return 'ERRO (META)'
  if (v === 'DONT_EXISTS') return 'NÚMERO NÃO EXISTE'
  if (v === 'USER_NUMBER_IS_PART_OF_AN_EXPE') return 'NÚMERO EM EXPERIMENTO'
  return raw
}

const computeEnvioStats = (rows) => {
  let entregues = 0
  let lidos = 0
  let aguardando = 0
  let enviando = 0
  let falhados = 0
  for (const row of rows) {
    const v = canonicalSendStatus(row?.send_status)
    if (!v) continue
    if (v === 'SUCCESS') entregues += 1
    else if (v === 'SENDING') enviando += 1
    else if (v === 'READ') lidos += 1
    else if (v === 'A ENVIAR') aguardando += 1
    else if (isFailureSendStatus(v)) falhados += 1
  }
  return {
    entregues,
    lidos,
    respondidos: rows.filter((row) => canonicalSendStatus(row?.send_status) === 'ANSWERED').length,
    aguardando,
    enviando,
    falhados
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const csvEscape = (value) => {
  const str = String(value ?? '')
  if (/[;"\n\r]/.test(str)) return `"${str.replaceAll('"', '""')}"`
  return str
}

const csvValueForHeader = (row, header) => {
  if (header === 'campanha') return row?.nome
  if (header === 'nome') return row?.name_client
  if (header === 'telefone') return row?.client_phone
  if (header === 'status') return labelSendStatus(row?.send_status)
  if (header === 'data envio') return fmtDateTime(row?.created_at)
  if (header === 'data de criação') return fmtDateTime(row?.created_at)
  return row?.[header]
}

export default function CampanhasZap() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sendStatus, setSendStatus] = useState('')
  const [campPage, setCampPage] = useState(1)
  const [contactStatus, setContactStatus] = useState('')
  const [contactPage, setContactPage] = useState(1)
  const [contactPageSize, setContactPageSize] = useState(10)

  const fetchCampanhas = async (signal) => {
    setLoading(true)
    setError('')
    try {
      const options = {
        method: 'GET',
        headers: { Accept: 'application/json' }
      }
      if (signal) options.signal = signal
      const res = await fetchN8n('campanha-zap', options)
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Erro ${res.status}`)
      }
      const data = await res.json().catch(() => null)
      const arr = Array.isArray(data) ? data : data ? [data] : []
      setItems(arr)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Erro ao carregar campanhas.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchCampanhas(controller.signal)
    return () => controller.abort()
  }, [])

  const baseItems = useMemo(() => {
    const q = String(query ?? '').toLowerCase().trimStart()
    const qTrim = q.trim()
    const start = parseYmdLocal(dateFrom, false)
    const end = parseYmdLocal(dateTo, true)
    let startSafe = start
    let endSafe = end
    if (startSafe && endSafe && startSafe > endSafe) {
      ;[startSafe, endSafe] = [endSafe, startSafe]
    }

    return items.filter((row) => {
      if (!row) return false
      if (startSafe || endSafe) {
        const createdAt = new Date(row?.created_at ?? '')
        if (Number.isNaN(createdAt.getTime())) return false
        const createdAtAdjusted = new Date(createdAt.getTime() + CREATED_AT_OFFSET_MS)
        if (startSafe && createdAtAdjusted < startSafe) return false
        if (endSafe && createdAtAdjusted > endSafe) return false
      }
      if (!qTrim) return true
      const nome = String(row?.nome ?? '').toLowerCase()
      if (qTrim.length === 1) return nome.includes(q)
      const haystack = [
        row.id,
        row.nome,
        row.status,
        row.departamento,
        row.template,
        row.send_status,
        row.name_client,
        row.client_phone
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(qTrim)
    })
  }, [items, query, dateFrom, dateTo])

  const sendStatusOptions = useMemo(() => {
    const set = new Set()
    for (const row of baseItems) {
      const value = canonicalSendStatus(row?.send_status)
      if (value) set.add(value)
    }
    return Array.from(set).sort((a, b) => labelSendStatus(a).localeCompare(labelSendStatus(b)))
  }, [baseItems])

  useEffect(() => {
    if (sendStatus && !sendStatusOptions.includes(sendStatus)) setSendStatus('')
  }, [sendStatus, sendStatusOptions])

  const filteredItems = useMemo(() => {
    const desired = canonicalSendStatus(sendStatus)
    if (!desired) return baseItems
    return baseItems.filter((row) => canonicalSendStatus(row?.send_status) === desired)
  }, [baseItems, sendStatus])

  const grupos = useMemo(() => {
    const map = new Map()
    for (const row of filteredItems) {
      const id = String(row?.id ?? 'Sem ID')
      const list = map.get(id) ?? []
      list.push(row)
      map.set(id, list)
    }

    const parsed = Array.from(map.entries()).map(([id, rows]) => {
      const sorted = rows
        .slice()
        .sort((a, b) => Date.parse(b?.created_at ?? 0) - Date.parse(a?.created_at ?? 0))
      const head = sorted[0] ?? null
      const nome = String(head?.nome ?? 'Sem nome')
      return { id, nome, rows: sorted, head }
    })

    parsed.sort((a, b) => Date.parse(b?.head?.created_at ?? 0) - Date.parse(a?.head?.created_at ?? 0))
    return parsed
  }, [filteredItems])

  const totalRegistros = useMemo(() => {
    let total = 0
    for (const grupo of grupos) {
      const rawTotal = Number(grupo?.head?.total)
      if (Number.isFinite(rawTotal) && rawTotal > 0) total += rawTotal
      else total += grupo?.rows?.length ?? 0
    }
    return total
  }, [grupos])
  const hasFilters = Boolean(String(query ?? '').trim() || dateFrom || dateTo || sendStatus)
  const openGroup = useMemo(() => grupos.find((g) => g.id === openId) ?? null, [grupos, openId])
  const openRows = openGroup?.rows ?? []
  const openHead = openGroup?.head ?? null
  const openTotalContatos = Number(openHead?.total) || openRows.length
  const openUltimoEnvio = fmtDateTime(openHead?.created_at)
  const openEnvioStats = useMemo(() => computeEnvioStats(openRows), [openRows])
  const contactStatusOptions = useMemo(() => {
    const set = new Set()
    for (const row of openRows) {
      const value = String(row?.send_status ?? '').trim()
      if (value) set.add(value)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [openRows])

  const filteredOpenRows = useMemo(() => {
    const desired = String(contactStatus ?? '').trim()
    if (!desired) return openRows
    return openRows.filter((row) => String(row?.send_status ?? '').trim() === desired)
  }, [openRows, contactStatus])

  const campTotalPages = Math.max(1, Math.ceil(grupos.length / CAMP_PAGE_SIZE))
  const campPageSafe = clamp(campPage, 1, campTotalPages)
  const visibleGrupos = useMemo(() => {
    if (openGroup) return [openGroup]
    const start = (campPageSafe - 1) * CAMP_PAGE_SIZE
    return grupos.slice(start, start + CAMP_PAGE_SIZE)
  }, [campPageSafe, grupos, openGroup])

  const contactTotalPages = Math.max(1, Math.ceil(filteredOpenRows.length / contactPageSize))
  const contactPageSafe = clamp(contactPage, 1, contactTotalPages)
  const visibleContacts = useMemo(() => {
    const start = (contactPageSafe - 1) * contactPageSize
    return filteredOpenRows.slice(start, start + contactPageSize)
  }, [contactPageSafe, contactPageSize, filteredOpenRows])

  useEffect(() => {
    setCampPage(1)
  }, [query, dateFrom, dateTo, sendStatus])

  useEffect(() => {
    if (campPage !== campPageSafe) setCampPage(campPageSafe)
  }, [campPage, campPageSafe])

  useEffect(() => {
    setOpenId(null)
  }, [campPageSafe, query, dateFrom, dateTo, sendStatus])

  useEffect(() => {
    setContactStatus('')
    setContactPage(1)
  }, [openId])

  useEffect(() => {
    setContactPage(1)
  }, [contactStatus])

  useEffect(() => {
    if (contactPage !== contactPageSafe) setContactPage(contactPageSafe)
  }, [contactPage, contactPageSafe])

  const clearFilters = () => {
    setQuery('')
    setDateFrom('')
    setDateTo('')
    setSendStatus('')
    setCampPage(1)
    setOpenId(null)
  }

  const exportFilteredCsv = () => {
    const rows = grupos
    if (!rows || rows.length === 0) return

    const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
    const baseName = `campanhas-zap-${stamp}`.replace(/[^\w.-]+/g, '_')
    const headers = ['id', 'campanha', 'departamento', 'status', 'total', 'pendentes', 'data de criação', 'mensagem', 'template']
    const lines = [headers.join(';')]
    for (const grupo of rows) {
      const head = grupo?.head ?? null
      const values = headers.map((h) => {
        if (h === 'id') return grupo?.id
        if (h === 'campanha') return grupo?.nome
        if (h === 'departamento') return head?.departamento
        if (h === 'status') return normalizeCampanhaStatus(head)
        if (h === 'total') return head?.total
        if (h === 'pendentes') return head?.pendentes
        if (h === 'data de criação') return fmtDateTime(head?.created_at)
        if (h === 'mensagem') return head?.mensagem
        if (h === 'template') return head?.template
        return ''
      })
      lines.push(values.map((v) => csvEscape(v)).join(';'))
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportOpenCsv = () => {
    if (!openGroup) return
    const baseName = `campanha-${openGroup.nome}-${openGroup.id}`.replace(/[^\w.-]+/g, '_')
    const rows = filteredOpenRows
    const headers = [
      'id',
      'campanha',
      'departamento',
      'status',
      'template',
      'mensagem',
      'nome',
      'telefone',
      'data envio',
      'data de criação'
    ]
    const lines = [headers.join(';')]
    for (const row of rows) {
      lines.push(headers.map((h) => csvEscape(csvValueForHeader(row, h))).join(';'))
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3 flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2">
              <ArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <img
                  src="https://chat.zapresponder.com.br/assets/logo-fill-707bdf21.svg"
                  alt="Zap Responder"
                  style={{ height: 32, width: 'auto' }}
                />
                <h2 className="fw-bold mb-0">Campanhas Zap</h2>
              </div>
              <div className="opacity-75 small">Acompanhe as campanhas que foram criadas e enviadas no ZapResponder</div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-4 mb-3">
          <div className="d-flex flex-wrap gap-3 align-items-end">
            <div style={{ minWidth: 260, flex: '1 1 260px' }}>
              <div className="small text-uppercase opacity-75 mb-1">Buscar</div>
              <input
                className="form-control form-control-sm bg-transparent text-light border-secondary"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome, cliente, status..."
              />
            </div>

            <div style={{ minWidth: 260, flex: '0 1 320px' }}>
              <div className="small text-uppercase opacity-75 mb-1">Data (período)</div>
              <div className="d-flex gap-2">
                <input
                  type="date"
                  className="form-control form-control-sm bg-transparent text-light border-secondary"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <input
                  type="date"
                  className="form-control form-control-sm bg-transparent text-light border-secondary"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div style={{ minWidth: 220, flex: '0 1 240px' }}>
              <div className="small text-uppercase opacity-75 mb-1">Status (envio)</div>
              <select
                className="form-select form-select-sm bg-transparent text-light border-secondary"
                value={sendStatus}
                onChange={(e) => setSendStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {sendStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {labelSendStatus(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="d-flex flex-wrap gap-3 align-items-end ms-auto">
              <div className="text-end">
                <div className="small text-uppercase opacity-75 mb-1">Total disparado</div>
                <div className="fw-semibold">
                  {totalRegistros}
                  {hasFilters ? <span className="opacity-75"> (filtrado)</span> : null}
                </div>
              </div>
              <div className="text-end">
                <div className="small text-uppercase opacity-75 mb-1">Total campanhas</div>
                <div className="fw-semibold">{grupos.length}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2"
                onClick={exportFilteredCsv}
                disabled={grupos.length === 0}
                title="Baixar CSV do filtro"
              >
                <Download size={16} />
                <span className="d-none d-sm-inline">Download</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2"
                onClick={clearFilters}
                disabled={!hasFilters}
                title="Limpar filtros"
              >
                <X size={16} />
                <span className="d-none d-sm-inline">Limpar</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2"
                onClick={() => fetchCampanhas()}
                disabled={loading}
                title="Atualizar"
              >
                <RefreshCw size={16} />
                <span className="d-none d-sm-inline">{loading ? 'Atualizando...' : 'Atualizar'}</span>
              </button>
            </div>
          </div>

          <div className="small opacity-75 mt-2 text-end">Fonte: n8n /campanha-zap</div>
        </div>

        {error && <div className="alert alert-danger py-2 px-3 mb-3 small">{error}</div>}

        {loading && grupos.length === 0 ? (
          <div className="neo-card neo-lg p-4 d-flex align-items-center gap-2">
            <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true" />
            <div className="opacity-75">Carregando campanhas...</div>
          </div>
        ) : grupos.length === 0 ? (
          <div className="neo-card neo-lg p-4">
            <div className="opacity-75">Nenhuma campanha encontrada.</div>
          </div>
        ) : (
          <div className="neo-card p-0 overflow-hidden">
            <div className="table-responsive text-nowrap">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th className="small text-uppercase opacity-75" style={{ width: '45%' }}>Título</th>
                    <th className="small text-uppercase opacity-75" style={{ width: '22%' }}>Data de criação</th>
                    <th className="small text-uppercase opacity-75" style={{ width: '15%' }}>Status</th>
                    <th className="small text-uppercase opacity-75" style={{ width: '10%' }}>Total</th>
                    <th className="small text-uppercase opacity-75 text-end" style={{ width: '8%' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGrupos.map((grupo) => {
                    const head = grupo.head
                    const isOpen = openId === grupo.id
                    const statusTxt = normalizeCampanhaStatus(head)
                    const totalLabel = head?.total ?? grupo.rows.length
                    const toggle = () => setOpenId((curr) => (curr === grupo.id ? null : grupo.id))

                    return (
                      <Fragment key={grupo.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          onClick={toggle}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggle()
                            }
                          }}
                          className={isOpen ? 'table-active' : ''}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="fw-semibold">{grupo.nome}</td>
                          <td className="small">{fmtDateTime(head?.created_at)}</td>
                          <td>
                            <span className={`badge rounded-pill ${badgeForStatus(statusTxt)}`}>{statusTxt}</span>
                          </td>
                          <td className="fw-semibold">{totalLabel ?? '-'}</td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggle()
                              }}
                              aria-label={isOpen ? 'Fechar detalhes' : 'Abrir detalhes'}
                              title={isOpen ? 'Fechar detalhes' : 'Abrir detalhes'}
                            >
                              <ChevronDown size={16} className={isOpen ? 'neo-acc-chevron open' : 'neo-acc-chevron'} />
                            </button>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="p-0">
                              <div className="camp-details p-3">
                                <div className="small opacity-75 mb-2">Acompanhe os envios da sua campanha em tempo real!</div>

                                <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                  <div>
                                    <div className="small opacity-75">Canal</div>
                                    <div className="fw-semibold">{openHead?.departamento || '-'}</div>
                                  </div>
                                  <div className="d-flex flex-wrap gap-4">
                                      <div>
                                        <div className="small opacity-75">Total de contatos</div>
                                        <div className="fw-semibold">{openTotalContatos}</div>
                                      </div>
                                    <div>
                                      <div className="small opacity-75">Último envio</div>
                                      <div className="fw-semibold">{openUltimoEnvio}</div>
                                    </div>
                                  </div>
                                  <div className="text-end">
                                    <div className="small opacity-75">Status</div>
                                    <div className="fw-semibold">{openHead?.mensagem || statusTxt}</div>
                                  </div>
                                </div>

                                <div className="row g-2 mb-3">
                                  <div className="col-6 col-md">
                                    <div className="camp-metric">
                                      <div className="camp-metric-value text-info">{openEnvioStats.entregues}</div>
                                      <div className="camp-metric-label">Entregues</div>
                                    </div>
                                  </div>
                                  <div className="col-6 col-md">
                                    <div className="camp-metric">
                                      <div className="camp-metric-value text-success">{openEnvioStats.lidos}</div>
                                      <div className="camp-metric-label">Lidos</div>
                                    </div>
                                  </div>
                                  <div className="col-6 col-md">
                                    <div className="camp-metric">
                                      <div className="camp-metric-value text-primary">{openEnvioStats.respondidos}</div>
                                      <div className="camp-metric-label">Respondidos</div>
                                    </div>
                                  </div>
                                  <div className="col-6 col-md">
                                    <div className="camp-metric">
                                      <div className="camp-metric-value text-warning">{openEnvioStats.aguardando}</div>
                                      <div className="camp-metric-label">Aguardando</div>
                                    </div>
                                  </div>
                                  <div className="col-6 col-md">
                                    <div className="camp-metric">
                                      <div className="camp-metric-value text-danger">{openEnvioStats.falhados}</div>
                                      <div className="camp-metric-label">Falhados</div>
                                    </div>
                                  </div>
                                </div>

                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                  <div className="input-group input-group-sm" style={{ maxWidth: 340 }}>
                                    <span className="input-group-text bg-transparent text-light border-secondary">Filtrar status</span>
                                    <select
                                      className="form-select bg-transparent text-light border-secondary"
                                      value={contactStatus}
                                      onChange={(e) => setContactStatus(e.target.value)}
                                    >
                                      <option value="">Todos</option>
                                      {contactStatusOptions.map((s) => (
                                        <option key={s} value={s}>
                                          {labelSendStatus(s)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2"
                                    onClick={exportOpenCsv}
                                    disabled={!openGroup || filteredOpenRows.length === 0}
                                  >
                                    <Download size={16} />
                                    Exportar
                                  </button>
                                </div>

                                <div className="table-responsive text-nowrap">
                                  <table className="table table-dark table-hover table-sm align-middle mb-0">
                                    <thead>
                                      <tr>
                                        <th className="small text-uppercase opacity-75" style={{ width: '45%' }}>Telefone</th>
                                        <th className="small text-uppercase opacity-75" style={{ width: '25%' }}>Status</th>
                                        <th className="small text-uppercase opacity-75" style={{ width: '30%' }}>Data de atualização</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {visibleContacts.map((row, idx) => (
                                        <tr key={`${row?.client_phone ?? openId}-${idx}`}>
                                          <td className="small">
                                            <div className="fw-semibold">{fmtPhoneBR(row?.client_phone)}</div>
                                            {row?.name_client ? <div className="opacity-75">{row.name_client}</div> : null}
                                          </td>
                                          <td className="small">
                                            <span className={`badge rounded-pill ${badgeForSendStatus(row?.send_status)}`}>
                                              {labelSendStatus(row?.send_status)}
                                            </span>
                                          </td>
                                          <td className="small">{fmtDateTime(row?.created_at)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
                                  <div className="d-flex align-items-center gap-2 small opacity-75">
                                    <span>itens por página</span>
                                    <select
                                      className="form-select form-select-sm bg-transparent text-light border-secondary"
                                      style={{ width: 90 }}
                                      value={contactPageSize}
                                      onChange={(e) => setContactPageSize(Number(e.target.value) || 10)}
                                    >
                                      {[10, 25, 50, 100].map((n) => (
                                        <option key={n} value={n}>{n}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="small opacity-75">pág. {contactPageSafe} de {contactTotalPages}</span>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-icon"
                                      onClick={() => setContactPage((p) => clamp(p - 1, 1, contactTotalPages))}
                                      disabled={contactPageSafe <= 1}
                                      aria-label="Página anterior"
                                    >
                                      <ChevronLeft size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-icon"
                                      onClick={() => setContactPage((p) => clamp(p + 1, 1, contactTotalPages))}
                                      disabled={contactPageSafe >= contactTotalPages}
                                      aria-label="Próxima página"
                                    >
                                      <ChevronRight size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {!openId && (
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="small opacity-75">{CAMP_PAGE_SIZE} campanhas por página</div>
                <div className="d-flex align-items-center gap-2">
                  <span className="small opacity-75">pág. {campPageSafe} de {campTotalPages}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setCampPage((p) => clamp(p - 1, 1, campTotalPages))}
                    disabled={campPageSafe <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setCampPage((p) => clamp(p + 1, 1, campTotalPages))}
                    disabled={campPageSafe >= campTotalPages}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
