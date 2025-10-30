import { useEffect, useState, useMemo } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { FiCheckCircle, FiAlertTriangle, FiXCircle, FiRefreshCw, FiArrowLeft } from 'react-icons/fi'
import { Link } from 'react-router-dom'

// Limiares para classificação de latência
const SLOW_THRESHOLD_MS = 500

function formatMs(ms) {
  if (ms == null || !isFinite(ms)) return '-'
  return `${Number(ms).toFixed(1)}ms`
}

function formatMMSS(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function formatDateDDMMYYYYHHMM(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '-'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  const HH = String(date.getHours()).padStart(2, '0')
  const MM = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}, ${HH}:${MM}`
}

function parseLatencyMs(item) {
  if (typeof item?.latencyMs === 'number') return item.latencyMs
  if (typeof item?.latency === 'string') {
    const n = parseFloat(item.latency.replace(',', '.'))
    return isFinite(n) ? n : null
  }
  if (typeof item?.ms === 'number') return item.ms
  if (typeof item?.timeMs === 'number') return item.timeMs
  return null
}

function classifyLatency(ms) {
  if (ms == null || !isFinite(ms) || ms === Infinity) return 'falha'
  if (ms > SLOW_THRESHOLD_MS) return 'lenta'
  return 'ok'
}

function statusBadge(state) {
  switch (state) {
    case 'ok':
      return <span className="text-success d-inline-flex align-items-center gap-1"><FiCheckCircle /> Normal</span>
    case 'lenta':
      return <span className="text-warning d-inline-flex align-items-center gap-1"><FiAlertTriangle /> Lenta</span>
    default:
      return <span className="text-danger d-inline-flex align-items-center gap-1"><FiXCircle /> Falha</span>
  }
}

export default function Status() {
  const [checks, setChecks] = useState([])
  const [running, setRunning] = useState(false)
  const TOTAL_SEC = 180
  const [remaining, setRemaining] = useState(TOTAL_SEC)
  const totals = useMemo(() => {
    let normal = 0, lenta = 0, erros = 0;
    for (const c of (checks || [])) {
      if (c?.state === 'ok') normal += 1;
      else if (c?.state === 'lenta') lenta += 1;
      else erros += 1;
    }
    return { normal, lenta, erros };
  }, [checks]);

  const inactiveRows = useMemo(() => (checks || []).filter(c => c.active === false), [checks]);

  // Chama o endpoint do n8n ao abrir a página e no botão Atualizar
  const runN8nStatus = async () => {
    if (running) return
    setRunning(true)
    setRemaining(TOTAL_SEC)
    const started = performance.now()
    let ok = false
    let statusText = ''
    let rows = []
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/status-workflows', { method: 'GET', signal: controller.signal })
      clearTimeout(timeout)
      ok = res.ok
      statusText = String(res.status)
      let data = null
      try { data = await res.json() } catch (_) { data = null }
      if (data) {
        if (Array.isArray(data)) {
          rows = data.map((item, idx) => {
            const ms = parseLatencyMs(item)
            const state = classifyLatency(ms)
            const stoppedAt = item?.stoppedAt ? new Date(item.stoppedAt) : null
            return {
              key: item.workflow_uid || item.workflowId || item.id || `wf-${idx}`,
              workflowId: item.workflowId ?? item.workflow_id ?? item.workflow_uid ?? item.workflowUid ?? null,
              name: item.workflow_name || item.name || item.workflow || item.service || 'Workflow',
              active: item.active === true,
              state,
              statusText: item.status || item.detail || '',
              ms,
              latencyText: typeof item.latency === 'string' ? item.latency : null,
              at: stoppedAt,
            }
          })
        } else if (typeof data === 'object') {
          rows = Object.entries(data).map(([k, v], idx) => {
            const ms = parseLatencyMs(v)
            return {
              key: k || `wf-${idx}`,
              workflowId: v?.workflowId ?? v?.workflow_id ?? v?.workflow_uid ?? v?.workflowUid ?? k,
              name: v?.workflow_name || k || 'Workflow',
              active: v?.active === true,
              state: classifyLatency(ms),
              statusText: typeof v === 'string' ? v : (v?.status || JSON.stringify(v)),
              ms,
              latencyText: typeof v?.latency === 'string' ? v.latency : null,
              at: v?.stoppedAt ? new Date(v.stoppedAt) : new Date(),
            }
          })
        }
      }
    } catch (err) {
      ok = false
      statusText = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'erro')
    }
    const ended = performance.now()
    if (!rows.length) {
      rows = [{ key: 'n8n', name: 'N8N status-workflows', state: ok ? 'ok' : 'falha', statusText, ms: ended - started, latencyText: null, at: new Date(), workflowId: null, active: null }]
    }
    setChecks(rows)
    setRunning(false)
  }

  useEffect(() => { runN8nStatus() }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          // dispara atualização quando zera
          if (!running) runN8nStatus()
          return TOTAL_SEC
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <h2 className="fw-bold mb-0">Status</h2>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="small opacity-85">Próxima atualização em {formatMMSS(remaining)}</div>
            <div className="progress" style={{ width: '220px', height: '6px' }}>
              <div className="progress-bar bg-info" role="progressbar" style={{ width: `${(TOTAL_SEC - remaining) / TOTAL_SEC * 100}%` }} aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <button
              type="button"
              className="btn btn-outline-light btn-sm d-inline-flex align-items-center"
              onClick={runN8nStatus}
              disabled={running}
              title="Atualizar agora"
              aria-label="Atualizar agora"
            >
              <FiRefreshCw className={running ? 'spin' : ''} />
            </button>
          </div>
        </div>

        
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-3 text-center" style={{ minHeight: "110px" }}>
              <div className="label" style={{ fontSize: "25px" }}>Normal</div>
              <div className="display-6 fw-bold text-success d-inline-flex align-items-center gap-2">
                <FiCheckCircle size={28} /> {totals.normal}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-3 text-center" style={{ minHeight: "110px" }}>
              <div className="label" style={{ fontSize: "25px" }}>Lenta</div>
              <div className="display-6 fw-bold text-warning d-inline-flex align-items-center gap-2">
                <FiAlertTriangle size={28} /> {totals.lenta}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-3 text-center" style={{ minHeight: "110px" }}>
              <div className="label" style={{ fontSize: "25px" }}>Erros</div>
              <div className="display-6 fw-bold text-danger d-inline-flex align-items-center gap-2">
                <FiXCircle size={28} /> {totals.erros}
              </div>
            </div>
          </div>
        </div>        <div className="neo-card p-0">
          <div className="section-bar px-4 py-3 d-flex align-items-center gap-2">
            <FiAlertTriangle />
            <div className="fw-semibold">APIs N8N</div>
          </div>
          <div className="table-responsive">
            <table className="table table-dark table-striped table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{minWidth: '220px'}}>Serviço</th>
                  <th style={{minWidth: '120px'}}>Status</th>
                  <th style={{minWidth: '120px'}}>Latência</th>
                  <th style={{minWidth: '220px'}}>Última Execução</th>
                  <th style={{minWidth: '110px'}}>Ativo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(checks.length ? checks : [{ key: 'n8n', name: 'N8N status-workflows' }]).map((c) => (
                  <tr key={c.key}>
                    <td>{c.name}</td>
                    <td>{statusBadge(c.state)}</td>
                    <td>{c.latencyText ? c.latencyText : formatMs(c.ms)}</td>
                    <td>{c.at ? formatDateDDMMYYYYHHMM(c.at) : '-'}</td>
                    <td>{c.active === true ? (
                      <span className="text-success d-inline-flex align-items-center gap-1"><FiCheckCircle /> Ativo</span>
                    ) : (c.active === false ? (
                      <span className="text-danger d-inline-flex align-items-center gap-1"><FiXCircle /> Inativo</span>
                    ) : '-' )}</td>
                    <td>
                      {c.workflowId
                        ? <a className="btn btn-outline-light btn-sm" title="Somente o administrador do VPS tem acesso" href={'https://n8n.sistemavieira.com.br/workflow/' + encodeURIComponent(c.workflowId) + '/executions'} target="_blank" rel="noopener noreferrer">Abrir</a>
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="neo-card p-0 mt-3">
          <div className="section-bar px-4 py-3 d-flex align-items-center gap-2">
            <FiXCircle />
            <div className="fw-semibold">APIs N8N — Inativos</div>
          </div>
          <div className="table-responsive">
            <table className="table table-dark table-striped table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{minWidth: '220px'}}>Serviço</th>
                  <th style={{minWidth: '120px'}}>Status</th>
                  <th style={{minWidth: '120px'}}>Latência</th>
                  <th style={{minWidth: '220px'}}>Última Execução</th>
                  <th style={{minWidth: '110px'}}>Ativo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {inactiveRows.length ? inactiveRows.map((c) => (
                  <tr key={c.key}>
                    <td>{c.name}</td>
                    <td>{statusBadge(c.state)}</td>
                    <td>{c.latencyText ? c.latencyText : formatMs(c.ms)}</td>
                    <td>{c.at ? formatDateDDMMYYYYHHMM(c.at) : '-'}</td>
                    <td><span className="text-danger d-inline-flex align-items-center gap-1"><FiXCircle /> Inativo</span></td>
                    <td>
                      {c.workflowId
                        ? <a className="btn btn-outline-light btn-sm" title="Somente o administrador do VPS tem acesso" href={'https://n8n.sistemavieira.com.br/workflow/' + encodeURIComponent(c.workflowId) + '/executions'} target="_blank" rel="noopener noreferrer">Abrir</a>
                        : '-'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="text-center text-muted small py-3">Nenhum workflow inativo</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>      </main>
      <Footer />
    </div>
  )
}

// simple spin css hook
// the project theme.css will style the rest
const style = document.createElement('style')
style.innerHTML = `.spin{ animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`
document.head && document.head.appendChild(style)