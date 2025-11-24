import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { FiArrowLeft, FiDownload } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Roles } from '../utils/roles.js'
import '../styles/historico.css'

function fmtDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR')
}

function fmtCPF(v) {
  const d = String(v ?? '').replace(/\D/g, '')
  if (!d) return 'xxx.xxx.xxx-xx'
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
  return d
}
function fmtNB(v) {
  const d = String(v ?? '').replace(/\D/g, '')
  if (!d) return 'xxx.xxx.xxx-x'
  if (d.length === 10) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 10)}`
  return d
}

function parseLooseList(text) {
  const t = String(text || '').trim()
  if (!t) return []
  try { return JSON.parse(t) } catch { }
  const wrapped = '[' + t
    .replace(/}\s*,\s*{/g, '},{')
    .replace(/}\s*[\r\n]+\s*{/g, '},{')
    .replace(/,\s*$/, '') + ']'
  try { return JSON.parse(wrapped) } catch { }
  return []
}

export default function HistoricoConsultas() {
  const { user } = useAuth()
  const [rows, setRows] = useState(null) // null = carregando
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  useEffect(() => {
    if (!user?.id) return
    const controller = new AbortController()
    const signal = controller.signal

      ; (async () => {
        try {
          setError('')
          const equipeId = (user?.equipe_id ?? null)
          const role = user?.role
          const nivel = role === Roles.Master ? 'master' : role === Roles.Administrador ? 'adm' : role === Roles.Supervisor ? 'super' : 'operador'
          const payload = { id: user.id, equipe_id: equipeId, nivel }
          const res = await fetch('https://webhook.sistemavieira.com.br/webhook/consulta-logs-in100', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(payload),
            signal
          })
          const raw = await res.text().catch(() => '')
          if (!res.ok) throw new Error(raw || ('HTTP ' + res.status))
          let data
          try { data = JSON.parse(raw) } catch { data = parseLooseList(raw) }
          let arr = []
          if (Array.isArray(data)) arr = data
          else if (Array.isArray(data?.data)) arr = data.data
          else if (Array.isArray(data?.rows)) arr = data.rows
          else if (data && typeof data === 'object') arr = [data]
          if (!signal.aborted) setRows(arr)
        } catch (e) {
          if (signal.aborted) return
          setRows([])
          setError(e?.message || 'Erro ao carregar')
        }
      })()

    return () => controller.abort()
  }, [user?.id])

  const items = Array.isArray(rows) ? rows : []
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, pages)
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage])
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, items.length)

  // Sempre volta para a primeira página ao recarregar os dados
  useEffect(() => { setPage(1) }, [items.length])

  const stats = useMemo(() => {
    const total = items.length
    let sucesso = 0
    let pendentes = 0
    for (const r of items) {
      const status = r?.status_api
      const resp = String(r?.resposta_api || '').toLowerCase()
      if (status === 'Sucesso') sucesso += 1
      else if (status == null || resp === 'pendente') pendentes += 1
    }
    const falhas = Math.max(0, total - sucesso - pendentes)
    return { total, sucesso, falhas, pendentes }
  }, [items])

  const exportCSV = () => {
    const headers = ['Data/Hora', 'Status', 'Pesquisa', 'Nome', 'CPF', 'NB', 'Data Nascimento', 'UF', 'Login']
    const out = items.map(r => {
      const login = String(r?.login || r?.usuario_nome || '')
      let nome = String(r?.nome || '')
      if (login && nome.endsWith(login)) {
        nome = nome.slice(0, -login.length)
      }
      // Remove trailing commas and whitespace
      nome = nome.replace(/[, ]+$/, '')
      if (!nome) nome = '-'
      return [
        fmtDateTime(r?.data_hora_registro),
        r?.status_api ?? '',
        r?.resposta_api ?? '',
        nome,
        r?.numero_documento ?? '',
        r?.numero_beneficio ?? '',
        fmtDate(r?.data_nascimento),
        r?.estado ?? '',
        login,
      ]
    })
    const csv = [headers, ...out]
      .map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';'))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'historico_consultas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="hc-page bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="mb-2">
          <Link to="/dashboard" className="btn btn-outline-light d-inline-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <FiArrowLeft size={16} />
            <span className="d-none d-sm-inline">Voltar</span>
          </Link>
        </div>
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div>
            <h2 className="fw-bold mb-1">Histórico de Consultas</h2>
            <div className="opacity-75 small">Acompanhe e filtre os resultados das consultas (IN100).</div>
          </div>
          <button type="button" className="btn btn-outline-light d-inline-flex align-items-center gap-2" onClick={exportCSV}>
            <FiDownload />
            <span>Exportar CSV</span>
          </button>
        </div>

        <section className="mb-4">
          <div className="row g-3">
            <div className="col-12 col-md-6 col-lg-3">
              <div className="neo-card neo-lg p-4 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Total</div>
                <div className="display-6 fw-bold mb-0">{stats.total}</div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <div className="neo-card neo-lg p-4 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Sucesso</div>
                <div className="display-6 fw-bold mb-0">{stats.sucesso}</div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <div className="neo-card neo-lg p-4 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Falhas</div>
                <div className="display-6 fw-bold mb-0">{stats.falhas}</div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <div className="neo-card neo-lg p-4 text-center hc-stat-card">
                <div className="opacity-75 small mb-1">Pendentes</div>
                <div className="display-6 fw-bold mb-0">{stats.pendentes}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="neo-card neo-lg p-0">
          {items.length > 0 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
              <div className="small opacity-75">Exibindo {startIndex}-{endIndex} de {items.length}</div>
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                <button type="button" className={`btn btn-sm ${currentPage === 1 ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setPage(1)}>1</button>
                {currentPage > 3 && <span className="opacity-50">...</span>}
                {Array.from({ length: 5 }, (_, i) => currentPage - 2 + i)
                  .filter(p => p > 1 && p < pages)
                  .map(p => (
                    <button key={p} type="button" className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                {currentPage < pages - 2 && <span className="opacity-50">...</span>}
                {pages > 1 && (
                  <button type="button" className={`btn btn-sm ${currentPage === pages ? 'btn-primary' : 'btn-outline-light'}`} onClick={() => setPage(pages)}>{pages}</button>
                )}
                <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={currentPage === pages}>›</button>
              </div>
            </div>
          )}
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Data/Hora</th>
                  <th style={{ minWidth: '110px' }}>Status</th>
                  <th style={{ minWidth: '160px' }}>Pesquisa</th>
                  <th style={{ minWidth: '200px' }}>Nome</th>
                  <th style={{ minWidth: '140px' }}>CPF</th>
                  <th style={{ minWidth: '140px' }}>NB</th>
                  <th style={{ minWidth: '140px' }}>Data Nasc.</th>
                  <th style={{ minWidth: '80px' }}>UF</th>
                  <th style={{ minWidth: '160px' }}>Login</th>
                </tr>
              </thead>
              <tbody>
                {rows === null ? (
                  <tr>
                    <td colSpan={9} className="text-center opacity-75 py-4">Carregando...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="text-center text-danger py-4">Erro ao carregar: {error}</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center opacity-75 py-4">Nenhuma consulta encontrada.</td>
                  </tr>
                ) : (
                  pageItems.map((r, idx) => {
                    const login = String(r?.login || r?.usuario_nome || '')
                    let nome = String(r?.nome || '')
                    if (login && nome.endsWith(login)) {
                      nome = nome.slice(0, -login.length)
                    }
                    // Remove trailing commas and whitespace
                    nome = nome.replace(/[, ]+$/, '')
                    if (!nome) nome = '-'
                    return (
                      <tr key={(r?.id_usuario ?? idx) + '-' + (r?.numero_beneficio ?? '') + '-' + idx}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r?.data_hora_registro)}</td>
                        <td>
                          {(() => {
                            const status = r?.status_api
                            const cls = status === 'Sucesso' ? 'text-bg-success' : (status == null ? 'text-bg-warning' : 'text-bg-danger')
                            const titleTxt = String(status ?? '')
                            return (
                              <span className={`badge rounded-pill px-2 status-badge ${cls}`} title={titleTxt} aria-label={titleTxt}>i</span>
                            )
                          })()}
                        </td>
                        <td>{r?.resposta_api || ''}</td>
                        <td className="text-nowrap">{nome || '-'}</td>
                        <td>{fmtCPF(r?.numero_documento)}</td>
                        <td>{fmtNB(r?.numero_beneficio)}</td>
                        <td>{fmtDate(r?.data_nascimento)}</td>
                        <td>{r?.estado || '-'}</td>
                        <td className="text-nowrap">{login}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
