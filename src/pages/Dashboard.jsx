import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { novidadesList } from '../components/NovidadesModal.jsx'
import { Roles } from '../utils/roles.js'
import { notify } from '../utils/notify.js'

export default function Dashboard() {
  const { user } = useAuth()
  const role = user?.role ?? 'Operador'
  const news = useMemo(() => novidadesList.slice(0, 3), [])
  const [current, setCurrent] = useState(0)
  const [saldo, setSaldo] = useState({ carregado: 0, disponivel: 0, realizadas: 0 })
  const [loadingSaldo, setLoadingSaldo] = useState(false)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logsError, setLogsError] = useState('')
  const copyToClipboard = async (text, successMsg = 'Copiado!') => {
    try {
      await navigator.clipboard.writeText(String(text ?? ''))
      notify.success(successMsg, { autoClose: 2000 })
    } catch (_) {
      try {
        const el = document.createElement('textarea')
        el.value = String(text ?? '')
        el.setAttribute('readonly', '')
        el.style.position = 'absolute'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        notify.success(successMsg, { autoClose: 2000 })
      } catch { /* ignore */ }
    }
  }

  const buildSaldoPayload = () => {
    const equipeId = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
    const equipeNome = user?.equipe_nome ?? user?.team_name ?? user?.teamName ?? user?.equipeNome ?? null
    const payload = {
      id_user: user?.id,
      id: user?.id,
      login: user?.login
    }
    if (equipeId != null) {
      payload.equipe_id = equipeId
      payload.team_id = equipeId
      payload.id_equipe = equipeId
    }
    if (equipeNome) {
      payload.equipe_nome = equipeNome
      payload.team_name = equipeNome
      payload.nome_equipe = equipeNome
    }
    return payload
  }

  const fetchSaldo = async () => {
    if (!user?.id) return
    setLoadingSaldo(true)
    try {
      const payload = buildSaldoPayload()
      const res = await fetch('https://n8n.apivieiracred.store/webhook/get-saldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (!data) return
      const num = (val) => Number(val ?? 0)
      const arr = Array.isArray(data) ? data : [data]
      const targetTeamId = payload?.equipe_id ?? payload?.team_id ?? payload?.id_equipe ?? null
      const item =
        arr.find((row) => {
          if (!row) return false
          if (targetTeamId == null) return false
          const eqId = Number(row.equipe_id ?? row.team_id ?? row.id_equipe)
          return Number(targetTeamId) === eqId
        }) || arr[0] || {}
      setSaldo({
        carregado: num(item.total_carregado ?? item.total ?? item.carregado),
        disponivel: num(item.limite_disponivel ?? item.disponivel ?? item.limite ?? item.limite_total),
        realizadas: num(item.consultas_realizada ?? item.consultas_realizadas ?? item.realizadas ?? item.qtd_consultas)
      })
    } catch (_) {
      /* silencioso */
    } finally {
      setLoadingSaldo(false)
    }
  }

  const mapNivel = (r) => {
    if (r === Roles.Master) return 'master'
    if (r === Roles.Administrador) return 'adm'
    if (r === Roles.Supervisor) return 'super'
    return 'operador'
  }

  const parseLogs = (raw) => {
    try {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.data)) return data.data
      if (Array.isArray(data?.rows)) return data.rows
      if (data && typeof data === 'object') return [data]
      return []
    } catch (_) {
      return []
    }
  }

  const dedupeLogs = (list) => {
    const arr = Array.isArray(list) ? list : []
    const seen = new Set()
    const out = []
    for (const item of arr) {
      if (!item) continue
      const cpf = String(item?.numero_documento ?? '').replace(/\D/g, '')
      const nb = String(item?.numero_beneficio ?? '').replace(/\D/g, '')
      const key = [
        String(item?.data_hora_registro ?? ''),
        String(item?.status_api ?? '').trim(),
        String(item?.resposta_api ?? '').trim(),
        cpf,
        nb
      ].join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }

  const fetchLogs = async () => {
    if (!user?.id) return
    setLoadingLogs(true)
    setLogsError('')
    try {
      const equipeId = user?.equipe_id ?? null
      const payload = { id: user.id, equipe_id: equipeId, nivel: mapNivel(user?.role) }
      const res = await fetch('https://n8n.apivieiracred.store/webhook/consulta-logs-in100', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload)
      })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      const arr = parseLogs(raw)
      setLogs(dedupeLogs(arr).slice(0, 10))
    } catch (e) {
      setLogs([])
      setLogsError(e?.message || 'Erro ao carregar')
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (news.length === 0) return undefined
    const id = setInterval(() => setCurrent((i) => (i + 1) % news.length), 15000)
    return () => clearInterval(id)
  }, [news.length])

  useEffect(() => {
    fetchSaldo()
    fetchLogs()
  }, [user])

  const fmtCpf = (v) => {
    const d = String(v ?? '').replace(/\D/g, '')
    if (d.length !== 11) return d || '-'
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  const fmtNb = (v) => {
    const d = String(v ?? '').replace(/\D/g, '')
    if (d.length !== 10) return d || '-'
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  const fmtHoraSP = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    if (Number.isNaN(d)) return '-'
    d.setHours(d.getHours() + 3)
    return d.toLocaleTimeString('pt-BR', { hour12: false })
  }

  const card = news[current]
  const bgStyle = card?.image
    ? {
        backgroundImage: `url(${card.image})`
      }
    : {}

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div>
            <h2 className="fw-bold mb-1">Dashboard</h2>
            <div className="opacity-75 small">Bem-vindo(a), {user?.name} - Perfil: {role}</div>
          </div>
        </div>

        {news.length > 0 && (
          <section className="news-carousel">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div>
                <div className="small opacity-75 text-uppercase">Últimas novidades</div>
                <h5 className="mb-0">O que mudou na plataforma</h5>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrent((i) => (i - 1 + news.length) % news.length)}
                  aria-label="Anterior"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCurrent((i) => (i + 1) % news.length)}
                  aria-label="Próximo"
                >
                  ›
                </button>
              </div>
            </div>
            <div className="news-card">
              <div className="news-thumb" style={bgStyle} />
              <div className="news-card-body">
                <div className="small opacity-85">{card.data}</div>
                <h5 className="fw-bold mb-2">{card.titulo}</h5>
                <p className="mb-0 opacity-85">{card.descricao}</p>
              </div>
            </div>
            <div className="news-dots mt-3">
              {news.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`news-dot ${idx === current ? 'active' : ''}`}
                  onClick={() => setCurrent(idx)}
                  aria-label={`Ir para novidade ${idx + 1}`}
                />
              ))}
            </div>
          </section>
        )}

        <section className="row g-3 mt-4 align-items-start">
          <div className="col-12 col-lg-4">
            <div className="neo-card neo-lg p-4">
              <div className="small text-uppercase opacity-75">Saldo IN100 (equipe/usuário)</div>
              <div className="d-flex align-items-center gap-2">
                <div className="display-5 fw-bold mb-0">{Number(saldo.disponivel ?? 0)}</div>
                {loadingSaldo && <div className="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>}
              </div>
              <div className="small opacity-75">Disponível para consultas IN100.</div>
              <div className="mt-2 d-flex gap-3 flex-wrap">
                <div>
                  <div className="small text-uppercase opacity-75">Realizadas</div>
                  <div className="fw-semibold">{saldo.realizadas}</div>
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={fetchSaldo} disabled={loadingSaldo}>
                Atualizar saldo
              </button>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="small text-uppercase opacity-75">Últimas consultas IN100</div>
                  <div className="fw-semibold">Exibindo até 10 mais recentes</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={fetchLogs} disabled={loadingLogs}>
                  {loadingLogs ? 'Atualizando...' : 'Atualizar lista'}
                </button>
              </div>
              {logsError && <div className="alert alert-danger py-2 px-3 mb-3 small">{logsError}</div>}
              <div className="table-responsive">
                <table className="table table-dark table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>Hora</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '30%' }}>Pesquisa</th>
                      <th style={{ width: '23%' }}>CPF</th>
                      <th style={{ width: '23%' }}>NB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs && logs.length > 0 ? logs : loadingLogs ? Array.from({ length: 3 }) : []).map((log, idx) => (
                      <tr key={idx}>
                        <td className="small">
                          {log ? fmtHoraSP(log.data_hora_registro) : <span className="placeholder col-8" />}
                        </td>
                        <td className="small">
                          {log ? (
                            (() => {
                              const status = log?.status_api
                              const resp = String(log?.resposta_api || '').toLowerCase()
                              const cls = status === 'Sucesso' ? 'text-bg-success' : (status == null || resp === 'pendente' ? 'text-bg-warning' : 'text-bg-danger')
                              const titleTxt = String(status ?? '')
                              return <span className={`badge rounded-pill px-2 status-badge ${cls}`} title={titleTxt} aria-label={titleTxt}>i</span>
                            })()
                          ) : (
                            <span className="placeholder col-6" />
                          )}
                        </td>
                        <td className="small">{log ? (log.resposta_api || '-') : <span className="placeholder col-10" />}</td>
                        <td className="small">
                          {log ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 text-reset"
                              onClick={() => copyToClipboard(log.numero_documento, 'CPF copiado!')}
                              title="Copiar CPF"
                            >
                              {fmtCpf(log.numero_documento)}
                            </button>
                          ) : (
                            <span className="placeholder col-6" />
                          )}
                        </td>
                        <td className="small">
                          {log ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 text-reset"
                              onClick={() => copyToClipboard(log.numero_beneficio, 'NB copiado!')}
                              title="Copiar NB"
                            >
                              {fmtNb(log.numero_beneficio)}
                            </button>
                          ) : (
                            <span className="placeholder col-6" />
                          )}
                        </td>
                      </tr>
                    ))}
                    {!loadingLogs && (!logs || logs.length === 0) && (
                      <tr>
                        <td className="small" colSpan={4}>Nenhuma consulta encontrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  )
}
