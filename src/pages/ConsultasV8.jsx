import { useCallback, useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi'

const API_URL = 'https://n8n.apivieiracred.store/webhook/api/consulta-v8'

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

const formatCpf = (value) => {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return cpf || '-'
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

const formatPhone = (value) => {
  const phone = onlyDigits(value)
  if (phone.length === 11) return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
  if (phone.length === 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  return phone || '-'
}

const formatDate = (value, opts = {}) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR', opts.dateOnly ? {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  } : {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const statusClassName = (status) => {
  const token = String(status ?? '').trim().toUpperCase()
  if (!token) return 'text-bg-secondary'
  if (token.includes('APROV')) return 'text-bg-success'
  if (token.includes('WAITING') || token.includes('CONSENT')) return 'text-bg-warning'
  if (token.includes('REPROV') || token.includes('RECUS') || token.includes('ERROR')) return 'text-bg-danger'
  return 'text-bg-secondary'
}

export default function ConsultasV8() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastSyncAt, setLastSyncAt] = useState(null)

  const fetchConsultas = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_URL, { method: 'GET', signal })
      const raw = await response.text()
      if (!response.ok) {
        throw new Error(raw || `HTTP ${response.status}`)
      }
      let payload = null
      try {
        payload = raw ? JSON.parse(raw) : []
      } catch {
        throw new Error('Resposta da API invalida')
      }
      setRows(normalizeRows(payload))
      setLastSyncAt(new Date())
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRows([])
      setError(err?.message || 'Falha ao carregar consultas V8')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchConsultas(controller.signal)
    return () => controller.abort()
  }, [fetchConsultas])

  const sortedRows = useMemo(() => {
    const list = Array.isArray(rows) ? [...rows] : []
    return list.sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime()
      const tb = new Date(b?.created_at || 0).getTime()
      return tb - ta
    })
  }, [rows])

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column text-light">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Consultas V8</h2>
              <div className="small opacity-75">
                {lastSyncAt ? `Ultima atualizacao: ${formatDate(lastSyncAt)}` : 'Carregando dados...'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline-info btn-sm d-flex align-items-center gap-2"
            onClick={() => fetchConsultas()}
            disabled={loading}
          >
            <FiRefreshCw size={14} />
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>

        <section className="neo-card neo-lg p-3 p-md-4">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>CPF</th>
                  <th>Sexo</th>
                  <th>Nascimento</th>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Telefone</th>
                  <th>Criado em</th>
                  <th>Status Consulta V8</th>
                  <th>Valor Liberado</th>
                  <th>Descricao</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={11} className="py-4 text-center">
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Carregando consultas...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={11} className="py-4 text-center text-danger">
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-4 text-center opacity-75">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}

                {!loading && !error && sortedRows.map((row, idx) => (
                  <tr key={String(row?.id ?? `${row?.cliente_cpf ?? 'sem-cpf'}-${row?.created_at ?? idx}`)}>
                    <td>{row?.id ?? '-'}</td>
                    <td>{formatCpf(row?.cliente_cpf)}</td>
                    <td>{row?.cliente_sexo || '-'}</td>
                    <td>{formatDate(row?.nascimento, { dateOnly: true })}</td>
                    <td className="text-nowrap">{row?.cliente_nome || '-'}</td>
                    <td>{row?.email || '-'}</td>
                    <td>{formatPhone(row?.telefone)}</td>
                    <td>{formatDate(row?.created_at)}</td>
                    <td>
                      <span className={`badge ${statusClassName(row?.status_consulta_v8)}`}>
                        {row?.status_consulta_v8 || '-'}
                      </span>
                    </td>
                    <td>{formatCurrency(row?.valor_liberado)}</td>
                    <td>{row?.descricao || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
