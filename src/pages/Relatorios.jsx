import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDate = (value) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildMonthRange = () => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { startDate: formatDate(start), finalDate: formatDate(end) }
}

const formatDateDisplay = (value) => {
  if (!value) return '-'
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const normalizeNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const cleaned = raw.replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
  if (!cleaned) return 0
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0
    }
    return Number(cleaned.replace(/,/g, '')) || 0
  }
  if (hasComma) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0
  }
  return Number(cleaned) || 0
}

const formatCurrency = (value) => {
  const num = Number(value ?? 0)
  return currencyFormatter.format(Number.isFinite(num) ? num : 0)
}

const normalizeEmpresaValue = (value) => String(value ?? '').trim().toLowerCase()
const getEmpresaName = (row) => row?.franquia_nome_tratada ?? row?.franquia_nome ?? ''

const CSV_DELIMITER = ';'

const escapeCsvValue = (value) => {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

const buildCsv = (rows) => {
  const headers = []
  const seen = new Set()
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return
    Object.keys(row).forEach((key) => {
      if (seen.has(key)) return
      seen.add(key)
      headers.push(key)
    })
  })
  if (!headers.length) return ''
  const lines = [headers.map(escapeCsvValue).join(CSV_DELIMITER)]
  rows.forEach((row) => {
    const line = headers.map((key) => escapeCsvValue(row?.[key])).join(CSV_DELIMITER)
    lines.push(line)
  })
  return lines.join('\r\n')
}

const sanitizeFilePart = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw.replace(/[^\w.-]+/g, '_')
}

const buildDownloadFileName = (range, empresa) => {
  const start = sanitizeFilePart(range?.startDate || 'inicio')
  const end = sanitizeFilePart(range?.finalDate || 'fim')
  const empresaPart = empresa && empresa !== DEFAULT_EMPRESA_OPTION ? `_empresa-${sanitizeFilePart(empresa)}` : ''
  return `andamento_${start}_${end}${empresaPart}.csv`
}

const downloadCsv = (rows, filename) => {
  const csvContent = buildCsv(rows)
  if (!csvContent) return
  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const resolveAndamentoBaseUrl = () => {
  const envBase = String(import.meta.env.VITE_ANDAMENTO_BASE_URL ?? '').trim()
  if (envBase) return envBase
  if (typeof window === 'undefined') return 'http://localhost:7171'
  const protocol = window.location.protocol || 'http:'
  const host = window.location.hostname || 'localhost'
  const resolvedHost = host === '0.0.0.0' ? 'localhost' : host
  return `${protocol}//${resolvedHost}:7171`
}

const ensureTrailingSlash = (value = '') => (value.endsWith('/') ? value : `${value}/`)

const buildAndamentoUrl = (params) => {
  const base = ensureTrailingSlash(resolveAndamentoBaseUrl())
  const url = new URL('get-andamento', base)
  url.search = params.toString()
  return url.toString()
}

const getAndamentoAuthToken = () => String(import.meta.env.VITE_ANDAMENTO_TOKEN ?? '').trim()

const LoadingDots = () => (
  <span className="loading-dots" role="status" aria-label="Carregando">
    <span aria-hidden="true">.</span>
    <span aria-hidden="true">.</span>
    <span aria-hidden="true">.</span>
  </span>
)

const DEFAULT_EMPRESA_OPTION = 'all'
const DEFAULT_EMPRESA_LIST = ['PARCEIRO ADAPTA', 'Matriz', 'Dias Cred', 'Inpacto']

export default function Relatorios() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [rangeDraft, setRangeDraft] = useState(() => buildMonthRange())
  const [empresaOption, setEmpresaOption] = useState(DEFAULT_EMPRESA_OPTION)
  const [appliedRange, setAppliedRange] = useState(() => buildMonthRange())
  const [appliedEmpresa, setAppliedEmpresa] = useState(DEFAULT_EMPRESA_OPTION)

  const empresaOptions = useMemo(() => {
    const baseList = DEFAULT_EMPRESA_LIST
    const baseNormalized = new Set(baseList.map(normalizeEmpresaValue))
    const extraMap = new Map()
    rows.forEach((row) => {
      const name = String(getEmpresaName(row)).trim()
      if (!name) return
      const normalized = normalizeEmpresaValue(name)
      if (!baseNormalized.has(normalized) && !extraMap.has(normalized)) {
        extraMap.set(normalized, name)
      }
    })
    if (empresaOption !== DEFAULT_EMPRESA_OPTION) {
      const normalizedSelected = normalizeEmpresaValue(empresaOption)
      if (!baseNormalized.has(normalizedSelected) && !extraMap.has(normalizedSelected)) {
        extraMap.set(normalizedSelected, empresaOption)
      }
    }
    const extraList = Array.from(extraMap.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [...baseList, ...extraList]
  }, [rows, empresaOption])

  const filteredRows = useMemo(() => {
    if (appliedEmpresa === DEFAULT_EMPRESA_OPTION) return rows
    const normalizedTarget = normalizeEmpresaValue(appliedEmpresa)
    return rows.filter((row) => normalizeEmpresaValue(getEmpresaName(row)) === normalizedTarget)
  }, [rows, appliedEmpresa])

  const stats = useMemo(() => {
    const rowsWithCpf = filteredRows.filter((row) => row && String(row?.cliente_cpf ?? '').trim() !== '')
    const propostas = rowsWithCpf.length > 0 ? rowsWithCpf.length : filteredRows.length
    const valorReferencia = filteredRows.reduce((sum, row) => sum + normalizeNumber(row?.valor_referencia), 0)
    return { propostas, valorReferencia }
  }, [filteredRows])

  const isDateRangeReady = Boolean(rangeDraft?.startDate && rangeDraft?.finalDate)
  const canDownload = !loading && filteredRows.length > 0

  const handleApply = () => {
    setAppliedRange(rangeDraft)
    setAppliedEmpresa(empresaOption)
  }

  const handleClear = () => {
    const defaultRange = buildMonthRange()
    setRangeDraft(defaultRange)
    setEmpresaOption(DEFAULT_EMPRESA_OPTION)
    setAppliedRange(defaultRange)
    setAppliedEmpresa(DEFAULT_EMPRESA_OPTION)
  }

  const handleDownload = () => {
    if (!filteredRows.length) return
    downloadCsv(filteredRows, buildDownloadFileName(appliedRange, appliedEmpresa))
  }

  useEffect(() => {
    const controller = new AbortController()
    const fetchResumo = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const authToken = getAndamentoAuthToken()
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined
        const params = new URLSearchParams({
          startDate: appliedRange?.startDate || '',
          finalDate: appliedRange?.finalDate || ''
        })
        const res = await fetch(buildAndamentoUrl(params), {
          headers,
          signal: controller.signal
        })
        if (!res.ok) {
          const raw = await res.text().catch(() => '')
          throw new Error(raw || `HTTP ${res.status}`)
        }
        const payload = await res.json().catch(() => null)
        const list = normalizeRows(payload)
        setRows(list)
      } catch (err) {
        if (err?.name === 'AbortError') return
        setRows([])
        setLoadError('Erro ao carregar indicadores.')
      } finally {
        setLoading(false)
      }
    }
    fetchResumo()
    return () => controller.abort()
  }, [appliedRange])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <Fi.FiArrowLeft size={16} />
            <span className="d-none d-sm-inline">Voltar</span>
          </Link>
          <div>
            <h2 className="fw-bold mb-1">Relatórios</h2>
            <div className="opacity-75 small">Central de indicadores e exportações</div>
          </div>
        </div>

        {loadError && <div className="alert alert-danger py-2 px-3 mb-3 small">{loadError}</div>}

        <div className="row g-3 align-items-start">
          <div className="col-12">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <Fi.FiCheckCircle className="opacity-75" />
                <h5 className="mb-0">Andamento</h5>
                <div className="ms-auto d-flex align-items-center gap-2">
                  {loading && <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>}
                  <button type="button" className="btn btn-outline-light btn-sm" onClick={handleDownload} disabled={!canDownload}>
                    <Fi.FiDownload size={14} className="me-1" />
                    Baixar Excel
                  </button>
                </div>
              </div>
              <div className="row g-4 align-items-start">
                <div className="col-12 col-lg-5">
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <div className="small text-uppercase opacity-75">Quantidade de Propostas</div>
                      <div className="display-6 fw-bold mb-0">{loading ? <LoadingDots /> : stats.propostas.toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <div className="small text-uppercase opacity-75">Valor Referência</div>
                      <div className="display-6 fw-bold mb-0">{loading ? <LoadingDots /> : formatCurrency(stats.valorReferencia)}</div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-lg-7">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <Fi.FiFilter className="opacity-75" />
                    <h5 className="mb-0">Filtros</h5>
                  </div>
                  <div className="row g-3">
                    <div className="col-12">
                      <div className="small text-uppercase opacity-75 mb-2">Período</div>
                      <div className="row g-2">
                        <div className="col-12 col-md-6">
                          <label className="form-label small">Data inicial</label>
                          <input
                            type="date"
                            className="form-control"
                            value={rangeDraft?.startDate || ''}
                            onChange={(e) => setRangeDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small">Data final</label>
                          <input
                            type="date"
                            className="form-control"
                            value={rangeDraft?.finalDate || ''}
                            onChange={(e) => setRangeDraft((prev) => ({ ...prev, finalDate: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small">Empresa</label>
                      <select className="form-select" value={empresaOption} onChange={(e) => setEmpresaOption(e.target.value)}>
                        <option value={DEFAULT_EMPRESA_OPTION}>Todas as empresas</option>
                        {empresaOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleApply} disabled={loading || !isDateRangeReady}>
                        Filtrar
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={handleClear} disabled={loading}>
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="small opacity-75 mt-2">
                    Aplicado: {formatDateDisplay(appliedRange?.startDate)} até {formatDateDisplay(appliedRange?.finalDate)}
                    {appliedEmpresa !== DEFAULT_EMPRESA_OPTION ? ` - Empresa: ${appliedEmpresa}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
