import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { FaFacebookF } from 'react-icons/fa'

function formatDateTimeBR(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  const dPart = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const tPart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dPart} ${tPart}`
}

function parseResponseToArray(raw) {
  if (!raw) return []
  // Tenta JSON padrão
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
  } catch (_) {}

  // Extrai objetos JSON completos via profundidade de chaves
  const items = []
  let depth = 0
  let start = -1
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        const objStr = raw.slice(start, i + 1)
        try { items.push(JSON.parse(objStr)) } catch (_) {}
      }
    }
  }

  // Fallback: NDJSON (um JSON por linha)
  if (items.length === 0) {
    raw.split(/\r?\n/).forEach(line => {
      const t = line.trim().replace(/,+$/, '')
      if (t.startsWith('{') && t.endsWith('}')) {
        try { items.push(JSON.parse(t)) } catch (_) {}
      }
    })
  }

  return items
}

function normalizeRows(objs) {
  const first = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  return objs.map(o => ({
    id: ((first(o.id) ?? '') + '').trim(),
    name: (o.name ?? '').toString().trim(),
    verification_status: o.verification_status ?? '',
    whatsapp_limit: o.whatsapp_limit ?? null,
    created_at: first(o.created_at) ?? null,
    updated_at: first(o.updated_at) ?? null,
  }))
}

function sortByCreatedAtDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(a?.created_at || '') || 0
    const tb = Date.parse(b?.created_at || '') || 0
    return tb - ta
  })
}

function AccordionItem({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="neo-card mb-2" style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.25)' }}>
      <button
        type="button"
        className="btn btn-ghost w-100 d-flex align-items-center justify-content-between"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="d-inline-flex align-items-center gap-2">
          <Fi.FiChevronRight style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
          <strong>{title}</strong>
        </span>
        <span className="small opacity-75">{open ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      <div style={{ display: open ? 'block' : 'none' }} className="p-3">
        {children}
      </div>
    </div>
  )
}

function dedupeById(rows) {
  const seen = new Set()
  const out = []
  for (const r of rows) {
    const key = (r.id ?? '').toString().trim()
    if (key) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(r)
  }
  return out
}

function mapWhatsappLimit(value) {
  if (value === null || value === undefined || value === '') return '-'
  const s = String(value).toUpperCase()
  if (s === 'TIER_2K') return '2.000'
  if (s === 'TIER_250') return '250'
  return value
}

function renderStatusBM(value) {
  const v = (value ?? '').toString()
  const s = v.trim().toLowerCase()
  if (s === 'pending_need_more_info') {
    return (
      <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74', fontWeight: 600 }}>Nao Verificado</span>
    )
  }
  if (s === 'pending_submission') {
    return (
      <span className="badge" style={{ backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', fontWeight: 600 }}>
        Em andamento
      </span>
    )
  }
  if (s === 'verified') {
    return (
      <span className="badge" style={{ backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #34d399', fontWeight: 600 }}>Verificado</span>
    )
  }
  // Sem traducao: manter o texto original, sem cor
  return <span>{v || '-'}</span>
}

function formatPhoneTitle(phone) {
  const str = (phone ?? '').toString().trim()
  const digits = str.replace(/\D/g, '')
  if (/^1\d{10}$/.test(digits)) {
    return `+1 ${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`
  }
  if (/^\d{10}$/.test(digits)) {
    return `+1 ${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
  }
  return str || 'Sem Telefone'
}

function translateKey(key) {
  const map = {
    id: 'ID',
    name: 'BM',
    verification_status: 'Status BM',
    whatsapp_limit: 'Limite Disparos',
    created_at: 'Criado em',
    updated_at: 'Atualizado em',
    link: 'Link',
    id_business: 'ID Business',
    display_phone_number: 'Telefone',
    quality_rating: 'Qualidade',
    verified_name: 'Nome Verificado',
    code_verification_status: 'Status',
    created_at_bm: 'Criado no BM',
    updated_at_bm: 'Atualizado no BM',
  }
  return map[key] || key
}

function valueForKey(key, value) {
  const first = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  const v = first(value)
  if (key === 'verification_status') return renderStatusBM(v)
  if (key === 'whatsapp_limit') return mapWhatsappLimit(v)
  if (key === 'code_verification_status') {
    const s = (v ?? '').toString().trim().toUpperCase()
    if (!s) return '-'
    if (s === 'VERIFIED') {
      return (
        <span className="d-inline-flex align-items-center gap-2">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.25)' }} />
          Verificado
        </span>
      )
    }
    if (s === 'NOT_VERIFIED') {
      return (
        <span className="d-inline-flex align-items-center gap-2">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.25)' }} />
          Nao verificado
        </span>
      )
    }
    if (s.includes('CONNECT') && !s.includes('DISCONNECT')) return 'Conectado'
    if (s.includes('DISCONNECT') || s === 'NOT_CONNECTED') return 'Desconectado'
    return s
  }
  if (key === 'quality_rating') {
    const s = (v ?? '').toString().trim().toUpperCase()
    if (!s || s === 'UNKNOWN') return '-'
    if (s === 'GREEN') {
      return (
        <span className="d-inline-flex align-items-center gap-2">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.25)' }} />
          Alta
        </span>
      )
    }
    return s
  }
  if (key === 'created_at' || key === 'updated_at' || key === 'created_at_bm' || key === 'updated_at_bm') return formatDateTimeBR(v)
  // Fallback: se vier o texto 'VERIFIED', renderiza como badge verde
  if ((v ?? '').toString().trim().toUpperCase() === 'VERIFIED') return renderStatusBM('verified')
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function GeradorSitesV3() {
  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rawById, setRawById] = useState({})
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [detailsId, setDetailsId] = useState(null)

  const endpoint = 'https://webhook.sistemavieira.com.br/webhook/get-bms-faces'

  const fetchFaces = async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'GET', signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Falha ao buscar dados (${res.status}) ${text}`.trim())
      }
      const txt = await res.text()
      const objs = parseResponseToArray(txt)
      const rows = sortByCreatedAtDesc(dedupeById(normalizeRows(objs)))
      // Build raw map by normalized id: keep array of entries per id
      const map = {}
      for (const o of objs) {
        const keyRaw = Array.isArray(o?.id) ? (o.id?.[0] ?? null) : (o?.id ?? null)
        const key = keyRaw != null ? String(keyRaw).trim() : ''
        if (!key) continue
        if (!map[key]) map[key] = []
        map[key].push(o)
      }
      setRawById(map)
      setRecords(rows)
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Erro ao buscar dados')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchFaces(controller.signal)
    return () => controller.abort()
  }, [])

  const countConexoes = (bmId) => {
    const list = rawById[bmId] || []
    if (!Array.isArray(list) || list.length === 0) return 0
    const uniq = new Set()
    for (const o of list) {
      const rawPhone = Array.isArray(o?.display_phone_number) ? (o.display_phone_number?.[0] ?? null) : o?.display_phone_number
      if (!rawPhone) continue // Sem Telefone nao conta
      // Usa id[1] como identificador unico do telefone quando existir; senao, usa apenas digitos
      const secId = Array.isArray(o?.id) && o.id.length > 1 ? (o.id[1] ?? null) : null
      const key = secId != null && String(secId).trim() !== ''
        ? String(secId).trim()
        : String(rawPhone).replace(/\D/g, '')
      if (key) uniq.add(key)
    }
    return uniq.size
  }

  const connectionCapacity = (limitRaw) => {
    const s = (limitRaw ?? '').toString().trim().toUpperCase()
    if (s === 'TIER_250' || s === '250') return 2
    if (s === 'TIER_2K' || s === '2000' || s === '2K' || s === '2.000') return 5
    return Infinity
  }

  const renderConexoesCell = (bmId, limitRaw) => {
    const connected = countConexoes(bmId)
    const cap = connectionCapacity(limitRaw)
    const overflow = (cap !== Infinity && connected > cap)
    const warnIcon = overflow ? (
      <Fi.FiAlertTriangle
        size={14}
        style={{ color: '#f59e0b' }}
        title={"Não e nenhum problema, porem vi que ha mais numeros conectados alem do aconselhado para esta BM"}
        aria-label="Acima do recomendado"
      />
    ) : null

    if (cap === Infinity) {
      return (
        <span className="d-inline-flex align-items-center" style={{gap: 6}}>
          {warnIcon}
          <span>{connected} /</span>
          <Fi.FiInfinity size={14} />
        </span>
      )
    }
    return (
      <span className="d-inline-flex align-items-center" style={{gap: 6}}>
        {warnIcon}
        <span>{connected} / {cap}</span>
      </span>
    )
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        {/* Header (mesmo do Gerador de Sites atual) */}
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link
              to="/dashboard"
              className="btn btn-outline-light btn-sm d-flex align-items-cgap-2"
              title="Voltar ao Dashboard"
            >
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Status BM's</h2>
              <div className="opacity-75 small">Status e detalhes por BM</div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <Fi.FiLayers size={18} />
              <strong>Versão v3</strong>
            </div>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => fetchFaces()}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="d-inline-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Carregando
                </span>
              ) : (
                <span className="d-inline-flex align-items-center gap-2">
                  <Fi.FiRefreshCw size={14} /> Atualizar
                </span>
              )}
            </button>
          </div>

          {/* endpoint hidden from UI */}

          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {String(error)}
            </div>
          )}

          <div className="table-responsive text-nowrap">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{width: '220px'}}>ID</th>
                  <th>BM</th>
                  <th style={{width: '220px'}}>Status BM</th>
                  <th style={{width: '140px'}}>Limite Disparos</th>
                  <th style={{width: '190px'}}>Criado em</th>
                  <th style={{width: '190px'}}>Atualizado em</th>
                  <th style={{width: '120px'}} className="text-center">Conexoes</th>
                  <th className="text-center" style={{width: '120px'}}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(!records || records.length === 0) && !isLoading && !error && (
                  <tr>
                    <td colSpan={8} className="text-center opacity-75 p-4">
                      Nenhum registro
                    </td>
                  </tr>
                )}
                {records.map((r, idx) => (
                  <tr key={`${r.id || 'row'}-${idx}`}>
                    <td className="font-monospace">{r.id || '-'}</td>
                    <td className="text-nowrap">{r.name || '-'}</td>
                    <td>{renderStatusBM(r.verification_status)}</td>
                    <td className="text-center">{mapWhatsappLimit(r.whatsapp_limit)}</td>
                    <td className="text-center"><small className="text-light">{formatDateTimeBR(r.created_at)}</small></td>
                    <td className="text-center"><small className="text-light">{formatDateTimeBR(r.updated_at)}</small></td>
                    <td className="text-center">{renderConexoesCell(r.id, r.whatsapp_limit)}</td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-sm p-1 border-0 bg-transparent shadow-none"
                        title="Detalhes"
                        onClick={() => { setDetailsId(r.id); setIsDetailsOpen(true) }}
                        disabled={!r.id || !rawById[r.id] || (rawById[r.id]?.length ?? 0) === 0}
                        aria-label="Ver detalhes"
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                      >
                        <Fi.FiInfo size={16} style={{ color: '#06b6d4' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isDetailsOpen && typeof document !== 'undefined' && createPortal(
            <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 12000 }} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content modal-dark">
                  <div className="modal-header">
                    <h5 className="modal-title">Detalhes</h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      aria-label="Close"
                      onClick={() => { setIsDetailsOpen(false); setDetailsId(null) }}
                      style={{ filter: 'invert(1)', opacity: 0.9 }}
                    ></button>
                  </div>
                  <div className="modal-body">
                    {(() => {
                      const list = rawById[detailsId] || []
                      if (list.length === 0) return <div className="opacity-75">Sem dados</div>
                      const pick = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
                      const main = list[0] || {}
                      const name = main?.name || ''
                      const status = pick(main?.verification_status)
                      const link = pick(main?.link)
                      const limit = pick(main?.whatsapp_limit)
                      const hiddenKeys = new Set(['id','name','verification_status','whatsapp_limit','link','display_phone_number'])

                      return (
                        <>
                          <div className="row g-2 mb-3">
                            <div className="col-md-3">
                              <div className="neo-card p-2">
                                <div className="small opacity-75">ID</div>
                                <div className="font-monospace">{detailsId || '-'}</div>
                              </div>
                            </div>
                            <div className="col-md-3">
                              <div className="neo-card p-2">
                                <div className="small opacity-75">BM</div>
                                <div>{name || '-'}</div>
                              </div>
                            </div>
                            <div className="col-md-3">
                              <div className="neo-card p-2">
                                <div className="small opacity-75">Status BM</div>
                                <div>{renderStatusBM(status)}</div>
                              </div>
                            </div>
                            <div className="col-md-3">
                              <div className="neo-card p-2">
                                <div className="small opacity-75">Limite Disparos</div>
                                <div>{mapWhatsappLimit(limit)}</div>
                              </div>
                            </div>
                            {/* Link oculto conforme solicitado */}
                          </div>

                          <div>
                            {(() => {
                              // Agrupa por telefone (string exata) e escolhe o melhor registro daquele telefone
                              const phoneGroups = new Map()
                              const getSecondId = (o) => {
                                if (!o || !Array.isArray(o.id)) return null
                                return o.id.length > 1 ? (o.id[1] ?? null) : null
                              }
                              for (const o of list) {
                                const rawPhone = Array.isArray(o.display_phone_number) ? (o.display_phone_number[0] ?? null) : o.display_phone_number
                                const fallbackKey = (rawPhone == null ? 'Sem Telefone' : String(rawPhone).trim())
                                const secId = getSecondId(o)
                                const key = (secId != null && String(secId).trim() !== '') ? String(secId).trim() : fallbackKey
                                const display = formatPhoneTitle(rawPhone || 'Sem Telefone')
                                if (!phoneGroups.has(key)) phoneGroups.set(key, [])
                                phoneGroups.get(key).push({ obj: o, display })
                              }
                              const firstVal = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
                              const score = (entry) => {
                                const o = entry.obj
                                const t = new Date(firstVal(o.updated_at) || firstVal(o.created_at) || firstVal(o.updated_at_bm) || firstVal(o.created_at_bm) || 0).getTime() || 0
                                const hasName = !!firstVal(o.verified_name)
                                return (hasName ? 1e15 : 0) + t
                              }
                              const items = Array.from(phoneGroups.entries()).map(([key, arr]) => {
                                let best = arr[0]
                                for (const cand of arr) { if (score(cand) > score(best)) best = cand }
                                return { key, display: best.display, obj: best.obj }
                              })

                              return items.map((entry, index) => {
                                const { key, obj, display } = entry
                                const fields = [
                                  'created_at_bm',
                                  'updated_at_bm',
                                  'created_at',
                                  'updated_at',
                                  'id_business',
                                  'quality_rating',
                                  'verified_name',
                                  'code_verification_status',
                                ]
                                return (
                                  <AccordionItem key={`${key}-${index}`} title={`Telefone: ${display}`}>
                                    <div className="table-responsive">
                                      <table className="table table-dark table-hover table-lookup align-middle mb-0">
                                        <tbody>
                                          {fields.map((k) => (
                                            <tr key={k}>
                                              <td style={{width: 220}}>
                                                <strong className="d-inline-flex align-items-center gap-2">
                                                  {(k === 'created_at_bm' || k === 'updated_at_bm') && (
                                                    <FaFacebookF size={12} style={{ color: '#1877F2' }} />
                                                  )}
                                                  {translateKey(k)}
                                                </strong>
                                              </td>
                                              <td>{valueForKey(k, obj[k])}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </AccordionItem>
                                )
                              })
                            })()}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => { setIsDetailsOpen(false); setDetailsId(null) }}>Fechar</button>
                  </div>
                </div>
              </div>
            </div>, document.body
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

