import { useEffect, useState, useMemo } from 'react'

import { createPortal } from 'react-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { FaFacebookF } from 'react-icons/fa'
import { notify } from '../utils/notify.js'
import { n8nUrl } from '../services/n8nClient.js'

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
  if (s === 'TIER_10K' || s === '10000' || s === '10K' || s === '10.000') return '10.000'
  return value
}

function renderStatusBM(value) {
  const v = (value ?? '').toString()
  const s = v.trim().toLowerCase()
  if (s === 'pending_need_more_info') {
    return (
      <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74', fontWeight: 600 }}>Não Verificado</span>
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
  if (s === 'expired') {
    return (
      <span className="d-inline-flex align-items-center gap-2">
        <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.25)' }} />
        Conta desabilitada
      </span>
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
    if (s === 'BANNED') {
      return (
        <span className="d-inline-flex align-items-center gap-2">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.25)' }} />
          Banido
        </span>
      )
    }
    if (s === 'EXPIRED') {
      return (
        <span className="d-inline-flex align-items-center gap-2">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.25)' }} />
          Conta desabilitada
        </span>
      )
    }
    if (s.includes('CONNECT') && !s.includes('DISCONNECT')) {
      return (
        <span className="d-inline-flex align-items-center gap-2">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: '#22c55e', boxShadow: '0 0 0 2px rgba(34,197,94,0.25)' }} />
          Conectado
        </span>
      )
    }
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

function StepBullet({ label, state }) {
  const isDone = state === 'done'
  const isActive = state === 'active'
  const color = (isDone || isActive) ? '#60a5fa' : 'rgba(148,163,184,0.5)'
  const bg = isDone ? '#60a5fa' : (isActive ? '#60a5fa' : 'transparent')
  return (
    <div className="d-flex flex-column align-items-center" style={{ minWidth: 80 }} title={label}>
      <div aria-hidden style={{ width: 14, height: 14, borderRadius: 9999, border: `2px solid ${color}`, background: bg, boxShadow: isActive ? '0 0 0 3px rgba(96,165,250,0.25)' : 'none' }} />
      <div className="small mt-1" style={{ opacity: 0.9, color }}>{label}</div>
    </div>
  )
}

function StepLine({ active }) {
  return (
    <div className="__step_line_wrap flex-grow-1 mx-2" aria-hidden style={{ height: 2, background: 'rgba(148,163,184,0.35)' }}>
      <div className="__step_line_fill" style={{ height: 2, background: '#60a5fa', width: active ? '100%' : '0%', transition: 'width 180ms ease' }} />
    </div>
  )
}

function formatCNPJ(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 14)
  const p1 = d.slice(0, 2)
  const p2 = d.slice(2, 5)
  const p3 = d.slice(5, 8)
  const p4 = d.slice(8, 12)
  const p5 = d.slice(12, 14)
  let out = ''
  if (p1) out += p1
  if (p2) out += (out ? '.' : '') + p2
  if (p3) out += (out ? '.' : '') + p3
  if (p4) out += (out ? '/' : '') + p4
  if (p5) out += (out ? '-' : '') + p5
  return out
}

function formatPhoneBR(value) {
  let d = String(value || '').replace(/\D/g, '')
  if (d.startsWith('55')) d = d.slice(2)
  d = d.slice(0, 11)
  if (!d) return ''
  const a = d.slice(0, 2)
  const p1 = d.slice(2, 7)
  const p2 = d.slice(7, 11)
  let out = '+55'
  if (a) out += ' ' + a
  if (p1) out += ' ' + p1
  if (p2) out += '-' + p2
  return out
}

export default function GeradorSitesV3() {
  const SUMMARY_MIN_HEIGHT = 220
  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rawById, setRawById] = useState({})
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [detailsId, setDetailsId] = useState(null)
  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const [companyId, setCompanyId] = useState(null)
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyError, setCompanyError] = useState(null)
  const [companyMap, setCompanyMap] = useState({})
  const [empresaRazao, setEmpresaRazao] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [empresaEndereco, setEmpresaEndereco] = useState('')
  const [empresaSite, setEmpresaSite] = useState('')
  const [empresaDolphin, setEmpresaDolphin] = useState('')
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaHtml, setEmpresaHtml] = useState('')
  const [showHtmlEditor, setShowHtmlEditor] = useState(false)
  // Filtros
  const [filterEmpresa, setFilterEmpresa] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterLimit, setFilterLimit] = useState('')
  // Modal Gerar Site
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [genRazao, setGenRazao] = useState('')
  const [genCnpj, setGenCnpj] = useState('')
  const [genEmpresa, setGenEmpresa] = useState('')
  const [genEndereco, setGenEndereco] = useState('')
  const [genWhatsapp, setGenWhatsapp] = useState('')
  const [genMetaTag, setGenMetaTag] = useState('')
  const [genEmpresaId, setGenEmpresaId] = useState('')
  const [genAppId, setGenAppId] = useState('')
  const [genBmName, setGenBmName] = useState('')
  const [genToken, setGenToken] = useState('')
  const [genEmpresaManual, setGenEmpresaManual] = useState(false)
  const [empresaList, setEmpresaList] = useState([]) // [{id, name}]
  const [empresaListLoading, setEmpresaListLoading] = useState(false)
  const [empresaListError, setEmpresaListError] = useState(null)
  const [genAppEnabled, setGenAppEnabled] = useState(false)
  const [genVincEnabled, setGenVincEnabled] = useState(false)
  const [genVincIdBm, setGenVincIdBm] = useState('')
  const [genVincNotes, setGenVincNotes] = useState('')
  const [genStep, setGenStep] = useState(1)
  const [genSubmitting, setGenSubmitting] = useState(false)
  // Tabela Gerador de Sites (via GET externo)
  const [siteRows, setSiteRows] = useState([])
  const [siteLoading, setSiteLoading] = useState(false)
  const [siteError, setSiteError] = useState(null)
  const canProceed = useMemo(() => {
    if (genStep === 1) {
      const empresaOk = genEmpresaManual ? (String(genEmpresa || '').trim().length > 0) : (String(genEmpresaId || '').trim().length > 0)
      const vals = [genRazao, genCnpj, genEndereco, genWhatsapp]
      return vals.every(v => (String(v || '').trim().length > 0))
        && empresaOk
    }
    // Passos 2 e 3 são opcionais: botão Próximo sempre liberado
    return true
  }, [genStep, genRazao, genCnpj, genEmpresa, genEmpresaId, genEmpresaManual, genEndereco, genWhatsapp])

  // Carrega lista de empresas quando abrir o modal de geração
  useEffect(() => {
    if (!isGenerateOpen) return
    const controller = new AbortController()
    ;(async () => {
      setEmpresaListLoading(true)
      setEmpresaListError(null)
      try {
        const url = n8nUrl('/webhook/get-empresas')
        const res = await fetch(url, { method: 'GET', signal: controller.signal })
        if (!res.ok) throw new Error(`get-empresas ${res.status}`)
        const data = await res.json().catch(() => [])
        const list = []
        const seen = new Set()
        const first = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
        if (Array.isArray(data)) {
          for (const it of data) {
            if (it == null) continue
            if (typeof it === 'string') {
              const name = it.trim()
              const id = name
              if (name && !seen.has(id)) { seen.add(id); list.push({ id, name }) }
            } else if (typeof it === 'object') {
              const idRaw = first(it.id) ?? first(it.id_empresa) ?? first(it.group_id) ?? first(it.grupo_id) ?? first(it.value) ?? null
              const id = (idRaw == null ? '' : String(idRaw)).trim()
              const name = (first(it.empresa) ?? first(it.name) ?? first(it.nome) ?? first(it.company) ?? first(it.label) ?? '').toString().trim()
              const key = id || name
              if (key && !seen.has(key)) { seen.add(key); list.push({ id: id || name, name }) }
            }
          }
        }
        list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
        setEmpresaList(list)
      } catch (e) {
        setEmpresaListError(e?.message || 'Erro ao carregar empresas')
      } finally {
        setEmpresaListLoading(false)
      }
    })()
    return () => controller.abort()
  }, [isGenerateOpen])

  const endpoint = n8nUrl('/webhook/get-bms-faces')

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

  // Removido o GET para /webhook/view-site nesta página conforme solicitado.
  // Mantemos estados de empresa para preencher manualmente quando necessário.
  const ensureCompaniesLoaded = async () => {
    return companyMap
  }

  const openCompanyModal = async (bmId) => {
    setIsCompanyOpen(true)
    setShowHtmlEditor(false)
    const firstVal = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
    const safe = (v) => {
      const t = (v == null) ? '' : String(v).trim()
      return t || '-'
    }

    // 1) Tenta preencher a partir da tabela "Gerador de Sites" (get-sites)
    const siteItem = siteRows.find(r => (r.id || '') === (bmId || ''))
    if (siteItem) {
      setCompanyId(siteItem.id || bmId) // garante que o ID exibido é o id_business
      setEmpresaNome(safe(siteItem.empresa))
      setEmpresaRazao(safe(siteItem.razao_social))
      setEmpresaCnpj(safe(siteItem.cnpj))
      setEmpresaEndereco(safe(siteItem.endereco))
      setEmpresaSite(safe(siteItem.site))
      setEmpresaDolphin(safe(siteItem.dolphin))
      { // prefira html_content do get-bms-faces; fallback para html do get-sites
      const idBiz = String(siteItem.id || bmId || '').trim()
      const allFaces = []
      for (const key of Object.keys(rawById || {})) {
        const arr = rawById[key] || []
        for (const o of arr) allFaces.push(o)
      }
      const tsOf2 = (o) => {
        const c1 = Date.parse(firstVal(o?.updated_at)) || 0
        const c2 = Date.parse(firstVal(o?.created_at)) || 0
        const c3 = Date.parse(firstVal(o?.updated_at_bm)) || 0
        const c4 = Date.parse(firstVal(o?.created_at_bm)) || 0
        return Math.max(c1, c2, c3, c4)
      }
      let bestFace = null
      for (const o of allFaces) {
        const biz = firstVal(o?.id_business) || firstVal(o?.business_id) || null
        if (biz != null && String(biz).trim() === idBiz) {
          if (!bestFace || tsOf2(o) > tsOf2(bestFace)) bestFace = o
        }
      }
      const htmlFromFaces = firstVal(bestFace?.html_content) || ''
        setEmpresaHtml(htmlFromFaces || (firstVal(siteItem.html) || ''))
      }
      return
    }

    // 2) Fallback: Seleciona o melhor registro desta BM a partir do retorno do get-bms-faces
    const list = rawById[bmId] || []
    const tsOf = (o) => {
      const c1 = Date.parse(firstVal(o?.updated_at)) || 0
      const c2 = Date.parse(firstVal(o?.created_at)) || 0
      const c3 = Date.parse(firstVal(o?.updated_at_bm)) || 0
      const c4 = Date.parse(firstVal(o?.created_at_bm)) || 0
      return Math.max(c1, c2, c3, c4)
    }
    const hasCompanyData = (o) => !!(firstVal(o?.razao_social) || firstVal(o?.cnpj) || firstVal(o?.endereco) || firstVal(o?.site) || firstVal(o?.dolphin) || firstVal(o?.empresa) || firstVal(o?.html_content))
    let best = null
    for (const o of list) {
      if (!best) { best = o; continue }
      const candScore = (hasCompanyData(o) ? 1 : 0) * 1e15 + tsOf(o)
      const bestScore = (hasCompanyData(best) ? 1 : 0) * 1e15 + tsOf(best)
      if (candScore > bestScore) best = o
    }
    // Prefira exibir o id_business quando disponível; caso contrário, use o bmId recebido
    const resolvedIdBusiness = firstVal(best?.id_business) || firstVal(best?.business_id) || firstVal(best?.id) || null
    setCompanyId(bmId)
    setEmpresaNome(safe(firstVal(best?.empresa)))
    setEmpresaRazao(safe(firstVal(best?.razao_social)))
    setEmpresaCnpj(safe(firstVal(best?.cnpj)))
    setEmpresaEndereco(safe(firstVal(best?.endereco)))
    setEmpresaSite(safe(firstVal(best?.site)))
    setEmpresaDolphin(safe(firstVal(best?.dolphin)))
    setEmpresaHtml(firstVal(best?.html_content) || '')
  }

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
    if (s === 'TIER_10K' || s === '10000' || s === '10K' || s === '10.000') return 5
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
        <span className="d-inline-flex align-items-center con-cell" style={{gap: 6, position: 'relative'}}>
          {warnIcon}
          {overflow && (
            <>
              <span
                role="tooltip"
                className="__warn_tip"
                style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, background: 'rgba(17,24,39,0.98)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '6px 8px', fontSize: 12, maxWidth: 260, zIndex: 13000, whiteSpace: 'normal', textAlign: 'left', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', pointerEvents: 'none', opacity: 0 }}
              >
                Nao e nenhum problema, porem vi que ha mais numeros conectados alem do aconselhado para esta BM
                <span aria-hidden style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(17,24,39,0.98)' }} />
              </span>
              <style>{`.con-cell:hover .__warn_tip{opacity:1}`}</style>
            </>
          )}
          <span>{connected} /</span>
          <span style={{fontWeight: 600}}>∞</span>
        </span>
      )
    }
    return (
      <span className="d-inline-flex align-items-center con-cell" style={{gap: 6, position: 'relative'}}>
        {warnIcon}
        {overflow && (
          <>
            <span
              role="tooltip"
              className="__warn_tip"
              style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, background: 'rgba(17,24,39,0.98)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '6px 8px', fontSize: 12, maxWidth: 260, zIndex: 13000, whiteSpace: 'normal', textAlign: 'left', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', pointerEvents: 'none', opacity: 0 }}
            >
              Nao e nenhum problema, porem vi que ha mais numeros conectados alem do aconselhado para esta BM
              <span aria-hidden style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(17,24,39,0.98)' }} />
            </span>
            <style>{`.con-cell:hover .__warn_tip{opacity:1}`}</style>
          </>
        )}
        <span>{connected} / {cap}</span>
      </span>
    )
  }

  // Resumos: contagem de status e total de conexões
  const statusCounts = useMemo(() => {
    const out = { naoVerificado: 0, emAndamento: 0, verificado: 0 }
    for (const r of records) {
      const s = (r?.verification_status ?? '').toString().trim().toLowerCase()
      if (s === 'pending_need_more_info') out.naoVerificado++
      else if (s === 'pending_submission') out.emAndamento++
      else if (s === 'verified') out.verificado++
    }
    return out
  }, [records])

  const totalConexoes = useMemo(() => {
    let connected = 0
    let capacity = 0
    for (const r of records) {
      const c = countConexoes(r.id)
      const cap = connectionCapacity(r.whatsapp_limit)
      connected += c
      capacity += (cap === Infinity ? c : cap)
    }
    return { connected, capacity }
  }, [records, rawById])

  // Map empresa por BM e opções distintas
  const empresaByBmId = useMemo(() => {
    const map = {}
    const first = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
    const tsOf = (o) => {
      const c1 = Date.parse(first(o?.updated_at)) || 0
      const c2 = Date.parse(first(o?.created_at)) || 0
      const c3 = Date.parse(first(o?.updated_at_bm)) || 0
      const c4 = Date.parse(first(o?.created_at_bm)) || 0
      return Math.max(c1, c2, c3, c4)
    }
    const hasCompany = (o) => !!first(o?.empresa)
    for (const r of records) {
      const list = rawById[r.id] || []
      let best = null
      for (const o of list) {
        if (!best) { best = o; continue }
        const candScore = (hasCompany(o) ? 1 : 0) * 1e15 + tsOf(o)
        const bestScore = (hasCompany(best) ? 1 : 0) * 1e15 + tsOf(best)
        if (candScore > bestScore) best = o
      }
      const emp = first(best?.empresa)
      map[r.id] = emp ? String(emp).trim() : ''
    }
    return map
  }, [records, rawById])

  const empresaOptions = useMemo(() => {
    const set = new Set()
    Object.keys(empresaByBmId).forEach(id => {
      const v = (empresaByBmId[id] || '').trim()
      if (v) set.add(v)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [empresaByBmId])

  const statusOptions = useMemo(() => {
    const arr = []
    if (statusCounts.naoVerificado > 0) arr.push({ value: 'pending_need_more_info', label: 'Não Verificado' })
    if (statusCounts.emAndamento > 0) arr.push({ value: 'pending_submission', label: 'Em andamento' })
    if (statusCounts.verificado > 0) arr.push({ value: 'verified', label: 'Verificado' })
    return arr
  }, [statusCounts])

  const limitOptions = useMemo(() => {
    const seen = new Map()
    for (const r of records) {
      const raw = (r?.whatsapp_limit ?? '').toString().trim().toUpperCase()
      if (!raw) continue
      if (!seen.has(raw)) seen.set(raw, mapWhatsappLimit(raw))
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }))
  }, [records])

  const filteredRecords = useMemo(() => {
    let arr = records
    if (filterEmpresa) arr = arr.filter(r => (empresaByBmId[r.id] || '') === filterEmpresa)
    if (filterStatus) arr = arr.filter(r => ((r?.verification_status ?? '').toString().trim().toLowerCase()) === filterStatus)
    if (filterLimit) arr = arr.filter(r => ((r?.whatsapp_limit ?? '').toString().trim().toUpperCase()) === filterLimit)
    return arr
  }, [records, filterEmpresa, filterStatus, filterLimit, empresaByBmId])

  // ID exibido no modal de "Dados da Empresa": prioriza id_business
  // Se não houver, exibe "-" (nunca exibe o id de BM por engano)
  const displayCompanyId = useMemo(() => {
    if (!companyId) return '-'
    const idStr = String(companyId)
    const firstVal = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

    // 1) Tente resolver a partir do get-bms-faces (rawById)
    const list = rawById[idStr] || rawById[companyId] || []
    for (const o of list) {
      const cand = firstVal(o?.id_business) || firstVal(o?.business_id) || null
      const s = (cand == null ? '' : String(cand)).trim().toLowerCase()
      if (s && s !== 'null' && s !== 'undefined') return String(cand).trim()
    }

    // 2) Tente resolver pela tabela de sites, mas somente se houver um id_business real nela
    const row = (siteRows || []).find(r => String(r.id || '') === idStr)
    if (row) {
      const cand = row.idBusinessResolved
      const s = (cand == null ? '' : String(cand)).trim().toLowerCase()
      if (s && s !== 'null' && s !== 'undefined') return String(cand).trim()
    }

    // 3) Nenhum id_business: retorna '-'
    return '-'
  }, [companyId, rawById, siteRows])

  // Carrega a tabela "Gerador de Sites" de endpoint externo
  const fetchSites = async (signal) => {
    setSiteLoading(true)
    setSiteError(null)
    try {
      const url = n8nUrl('/webhook/get-sites')
      const res = await fetch(url, { method: 'GET', signal })
      if (!res.ok) throw new Error(`get-sites ${res.status}`)
      const data = await res.json().catch(() => [])
      const first = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
      const rows = Array.isArray(data) ? data.map(o => {
        const createdAt = first(o?.created_at) || first(o?.createdAt) || first(o?.created_at_bm) || null
        const empresa = String(first(o?.name_empresas) || first(o?.name_empresa) || first(o?.empresa) || '').trim()
        const site = String(first(o?.site) || first(o?.link) || '').trim()
        const html = first(o?.html_content) || first(o?.html) || ''
        const endereco = String(first(o?.endereco) || '').trim()
        const idBusinessResolved = first(o?.id_business) || first(o?.business_id) || null
        const id = String(idBusinessResolved || first(o?.id) || '').trim()
        const cnpj = String(first(o?.cnpj) || '').trim()
        const razao_social = String(first(o?.razao_social) || first(o?.razaoSocial) || '').trim()
        const id_bm = first(o?.id_bm) || first(o?.idBusiness) || first(o?.id_business) || first(o?.business_id) || null
        const bmLinked = !!(id_bm != null && String(id_bm).trim() !== '')
        const dolphin = String(first(o?.dolphin) || '').trim()
        const dolphinLinked = !!(dolphin !== '')
        const groupRaw = first(o?.group_id) ?? first(o?.grupo_id) ?? null
        const empresaLinked = (empresa !== '') || !!(groupRaw != null && String(groupRaw).trim() !== '')
        return { id, idBusinessResolved, createdAt, site, empresa, html, endereco, cnpj, razao_social, dolphin, bmLinked, dolphinLinked, empresaLinked }
      }) : []
      rows.sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))
      setSiteRows(rows)
    } catch (e) {
      setSiteError(e?.message || 'Erro ao carregar sites')
    } finally {
      setSiteLoading(false)
    }
  }
  // Desativado nesta página: tabela de "Gerador de Sites" foi movida.
  // useEffect(() => {
  //   const controller = new AbortController()
  //   fetchSites(controller.signal)
  //   return () => controller.abort()
  // }, [])

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

        {/* Resumos fora do card da tabela */}
        <div className="row g-3 mb-3 align-items-stretch">
          <div className="col-lg-4 col-md-6">
            <div className="neo-card neo-lg p-3 h-100" style={{ minHeight: SUMMARY_MIN_HEIGHT }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <Fi.FiInfo size={16} />
                <strong>Status BM</strong>
              </div>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="fs-5">Não Verificado</span>
                  <span className="fw-bold fs-5">{statusCounts.naoVerificado}</span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="fs-5">Em andamento</span>
                  <span className="fw-bold fs-5">{statusCounts.emAndamento}</span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="fs-5">Verificado</span>
                  <span className="fw-bold fs-5">{statusCounts.verificado}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-4 col-md-6">
            <div className="neo-card neo-lg p-3 d-flex align-items-start justify-content-between h-100" style={{ minHeight: SUMMARY_MIN_HEIGHT }}>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiActivity size={16} />
                <strong>Conexões</strong>
              </div>
              <div className="display-4 fw-bold d-flex align-items-center gap-2">
                <span>{totalConexoes.connected}</span>
                <span>/</span>
                <span>{totalConexoes.capacity}</span>
              </div>
            </div>
          </div>
          <div className="col-lg-4 col-md-12">
            <div className="neo-card neo-lg p-3 h-100" style={{ minHeight: SUMMARY_MIN_HEIGHT }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <Fi.FiFilter size={16} />
                <strong>Filtros</strong>
              </div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label mb-1">Empresa</label>
                  <select className="form-select form-select-sm" value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)}>
                    <option value="">Todas</option>
                    {empresaOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label mb-1">Status BM</label>
                  <select className="form-select form-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Todos</option>
                    {statusOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label mb-1">Limite Disparos</label>
                  <select className="form-select form-select-sm" value={filterLimit} onChange={(e) => setFilterLimit(e.target.value)}>
                    <option value="">Todos</option>
                    {limitOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {(filterEmpresa || filterStatus || filterLimit) && (
                  <div className="col-12 d-flex justify-content-end">
                    <button type="button" className="btn btn-sm btn-outline-light" onClick={() => { setFilterEmpresa(''); setFilterStatus(''); setFilterLimit('') }}>
                      Limpar Filtros
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <Fi.FiLayers size={18} />
              <strong>Meta Business Manager</strong>
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
                  <th style={{width: '120px'}} className="text-center">Conexões</th>
                  <th className="text-center" style={{width: '120px'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(!filteredRecords || filteredRecords.length === 0) && !isLoading && !error && (
                  <tr>
                    <td colSpan={8} className="text-center opacity-75 p-4">
                      Nenhum registro
                    </td>
                  </tr>
                )}
                {filteredRecords.map((r, idx) => (
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
                        className="btn btn-sm p-1 border-0 bg-transparent shadow-none me-1"
                        title="Dados da Empresa"
                        onClick={() => openCompanyModal(r.id)}
                        disabled={!r.id}
                        aria-label="Dados da Empresa"
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                      >
                        <Fi.FiBriefcase size={16} style={{ color: '#60a5fa' }} />
                      </button>
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
          {isCompanyOpen && typeof document !== 'undefined' && createPortal(
            <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 12000 }} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content modal-dark">
                  <div className="modal-header">
                    <h5 className="modal-title">Dados da Empresa</h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      aria-label="Close"
                      onClick={() => { setIsCompanyOpen(false); setCompanyId(null) }}
                      style={{ filter: 'invert(1)', opacity: 0.9 }}
                    ></button>
                  </div>
                  <div className="modal-body">
                          <div className="row g-2 mb-3">
                      <div className="col-md-4">
                        <div className="neo-card p-2">
                          <div className="small opacity-75">ID Business</div>
                          <div className="font-monospace">{displayCompanyId || '-'}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="neo-card p-2">
                          <div className="small opacity-75">BM</div>
                          <div>{(records.find(x => x.id === companyId)?.name) || '-'}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="neo-card p-2">
                          <div className="small opacity-75">Status BM</div>
                          <div>{renderStatusBM(records.find(x => x.id === companyId)?.verification_status)}</div>
                        </div>
                      </div>
                    </div>
                    <form onSubmit={(e) => e.preventDefault()}>
                      <div className="row g-3">
                        <div className="col-md-8">
                          <label className="form-label">Razao Social</label>
                          <input className="form-control" value={empresaRazao} readOnly placeholder="GIOMED ATENDIMENTO MEDICO LTDA" />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">CNPJ</label>
                          <input className="form-control" value={empresaCnpj} readOnly placeholder="45.864.127/0001-97" />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Empresa</label>
                          <input className="form-control" value={empresaNome} readOnly placeholder="Vieiracred" />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Endereco</label>
                          <textarea className="form-control" rows={3} value={empresaEndereco} readOnly placeholder={'R BOGOS TAVITIAN, 50\nOSASCO, SP 06030-320\nBrasil'} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Dolphin</label>
                          <input className="form-control" value={empresaDolphin} readOnly placeholder="Vieira - Mayara" />
                        </div>

                      </div>
                    </form>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => { setIsCompanyOpen(false); setCompanyId(null) }}>Fechar</button>
                    <button type="button" className="btn btn-primary" disabled>Salvar</button>
                  </div>
                </div>
              </div>
            </div>, document.body
          )}
        </div>

        {/* Gerador de Sites (removido desta página) */}
        {false && (
        <div className="neo-card neo-lg p-4 mt-3">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <Fi.FiGlobe size={18} />
              <strong>Gerador de Sites</strong>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-light btn-sm d-inline-flex align-items-center gap-2"
                onClick={() => fetchSites()}
                disabled={siteLoading}
              >
                {siteLoading ? (
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
              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
              onClick={() => { setIsGenerateOpen(true); setGenRazao(''); setGenCnpj(''); setGenEmpresa(''); setGenEmpresaId(''); setGenEndereco(''); setGenWhatsapp(''); setGenMetaTag(''); setGenAppId(''); setGenBmName(''); setGenToken(''); setGenAppEnabled(false); setGenVincEnabled(false); setGenVincIdBm(''); setGenVincNotes(''); setGenEmpresaManual(false); setEmpresaList([]); setEmpresaListError(null); setGenStep(1) }}
              >
                <Fi.FiZap size={14} />
                Gerar
              </button>
            </div>
          </div>
          <div className="table-responsive text-nowrap">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{width: '220px'}}>CNPJ</th>
                  <th>Razão Social</th>
                  <th className="text-center" style={{width: '140px'}}>Empresa</th>
                  <th className="text-center" style={{width: '140px'}}>BM Vinculada</th>
                  <th className="text-center" style={{width: '140px'}}>Dolphin</th>
                  <th className="text-center" style={{width: '120px'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {siteError && (
                  <tr>
                    <td colSpan={6} className="text-danger">{String(siteError)}</td>
                  </tr>
                )}
                {(!siteRows || siteRows.length === 0) && !siteLoading && !siteError && (
                  <tr>
                    <td colSpan={6} className="text-center opacity-75 p-4">Nenhum registro</td>
                  </tr>
                )}
                {siteRows.map((row, idx) => (
                  <tr key={`${row.id || 'site'}-${idx}`}>
                    <td className="text-nowrap">{formatCNPJ(row.cnpj)}</td>
                    <td className="text-nowrap">{row.razao_social || '-'}</td>
                    <td className="text-center">
                      {row.empresaLinked ? (
                        <Fi.FiCheck size={16} style={{ color: '#22c55e' }} title="Com Empresa" />
                      ) : (
                        <Fi.FiX size={16} style={{ color: '#ef4444' }} title="Sem Empresa" />
                      )}
                    </td>
                    <td className="text-center">
                      {row.bmLinked ? (
                        <Fi.FiCheck size={16} style={{ color: '#22c55e' }} title="Vinculada" />
                      ) : (
                        <Fi.FiX size={16} style={{ color: '#ef4444' }} title="Não vinculada" />
                      )}
                    </td>
                    <td className="text-center">
                      {row.dolphinLinked ? (
                        <Fi.FiCheck size={16} style={{ color: '#22c55e' }} title="Com Dolphin" />
                      ) : (
                        <Fi.FiX size={16} style={{ color: '#ef4444' }} title="Sem Dolphin" />
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-sm p-1 border-0 bg-transparent shadow-none"
                        title="Dados da Empresa"
                        onClick={() => openCompanyModal(row.id)}
                        disabled={!row.id}
                        aria-label="Dados da Empresa"
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                      >
                        <Fi.FiBriefcase size={16} style={{ color: '#60a5fa' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isGenerateOpen && typeof document !== 'undefined' && createPortal(
            <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 12000 }} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content modal-dark">
                  <div className="modal-header">
                    <h5 className="modal-title">Gerar Site</h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      aria-label="Close"
                      onClick={() => setIsGenerateOpen(false)}
                      style={{ filter: 'invert(1)', opacity: 0.9 }}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <style>{`
                      .__fade_slide_in{animation:fadeSlideIn .18s ease-out}
                      @keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
                    `}</style>
                    <div className="mb-3">
                      {(() => {
                        const s1 = genStep > 1 ? 'done' : (genStep === 1 ? 'active' : 'todo')
                        const s2 = genStep > 2 ? 'done' : (genStep === 2 ? 'active' : 'todo')
                        const s3 = genStep > 3 ? 'done' : (genStep === 3 ? 'active' : 'todo')
                        return (
                          <div className="d-flex align-items-center justify-content-between">
                            <StepBullet label="Dados" state={s1} />
                            <StepLine active={genStep >= 2} />
                            <StepBullet label="APP BM" state={s2} />
                            <StepLine active={genStep >= 3} />
                            <StepBullet label="Vínculo BM" state={s3} />
                          </div>
                        )
                      })()}
                    </div>
                    {genStep === 1 && (
                      <div className="__fade_slide_in"><form onSubmit={(e) => e.preventDefault()}>
                      <div className="row g-3">
                        <div className="col-md-8">
                          <label className="form-label">Razao Social</label>
                          <input className="form-control" value={genRazao} onChange={(e) => setGenRazao(e.target.value)} placeholder="RAZAO SOCIAL LTDA" />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">CNPJ</label>
                          <input className="form-control" value={genCnpj} onChange={(e) => setGenCnpj(formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Empresa</label>
                          {genEmpresaManual ? (
                            <>
                              <input className="form-control" value={genEmpresa} onChange={(e) => setGenEmpresa(e.target.value)} placeholder="Digite o nome da empresa" />
                              <div className="mt-1">
                                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { setGenEmpresaManual(false); setGenEmpresa(''); setGenEmpresaId('') }}>Selecionar da lista</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <select
                                className="form-select"
                                value={genEmpresaId}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === '__ADD__') { setGenEmpresaManual(true); setGenEmpresa(''); setGenEmpresaId('') }
                                  else {
                                    setGenEmpresaId(v)
                                    const item = empresaList.find(it => it.id === v)
                                    setGenEmpresa(item?.name || '')
                                  }
                                }}
                              >
                                <option value="">Selecione...</option>
                                <option value="__ADD__">+ Adicionar...</option>
                                {empresaList.map((it) => (
                                  <option key={it.id} value={it.id}>{it.name}</option>
                                ))}
                              </select>
                              {empresaListLoading && (<div className="small opacity-75 mt-1">Carregando empresas...</div>)}
                              {empresaListError && (<div className="small text-danger mt-1">{empresaListError}</div>)}
                            </>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Meta Tag</label>
                          <input className="form-control" value={genMetaTag} onChange={(e) => setGenMetaTag(e.target.value)} placeholder="META_TAG" />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Whatsapp</label>
                          <input className="form-control" value={genWhatsapp} onChange={(e) => setGenWhatsapp(formatPhoneBR(e.target.value))} placeholder="+55 11 99999-9999" />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Endereco</label>
                          <textarea className="form-control" rows={3} value={genEndereco} onChange={(e) => setGenEndereco(e.target.value)} placeholder={'Rua X, 123\nCidade, UF 00000-000\nBrasil'} />
                        </div>
                      </div>
                      </form></div>
                    )}
                    {genStep === 2 && (
                      <div className="__fade_slide_in">
                        <div className="form-check form-switch mb-3">
                          <input className="form-check-input" type="checkbox" id="chkAppBm" checked={genAppEnabled} onChange={(e) => setGenAppEnabled(e.target.checked)} />
                          <label className="form-check-label" htmlFor="chkAppBm">Preencher dados do APP BM</label>
                        </div>
                        {genAppEnabled && (
                          <form onSubmit={(e) => e.preventDefault()}>
                            <div className="row g-3">
                              <div className="col-md-4">
                                <label className="form-label">ID APP</label>
                                <input className="form-control" value={genAppId} onChange={(e) => setGenAppId(e.target.value)} placeholder="1234567890" />
                              </div>
                              <div className="col-md-8">
                                <label className="form-label">Nome BM</label>
                                <input className="form-control" value={genBmName} onChange={(e) => setGenBmName(e.target.value)} placeholder="Nome do Business Manager" />
                              </div>
                              <div className="col-12">
                                <label className="form-label">Token</label>
                                <input className="form-control font-monospace" value={genToken} onChange={(e) => setGenToken(e.target.value)} placeholder="EAAB..." />
                              </div>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                    {genStep === 3 && (
                      <div className="__fade_slide_in">
                        <div className="form-check form-switch mb-3">
                          <input className="form-check-input" type="checkbox" id="chkVincBm" checked={genVincEnabled} onChange={(e) => setGenVincEnabled(e.target.checked)} />
                          <label className="form-check-label" htmlFor="chkVincBm">Preencher vínculo manualmente</label>
                        </div>
                        {genVincEnabled && (
                          <form onSubmit={(e) => e.preventDefault()}>
                            <div className="row g-3">
                              <div className="col-md-6">
                                <label className="form-label">ID BM</label>
                                <input className="form-control" value={genVincIdBm} onChange={(e) => setGenVincIdBm(e.target.value)} placeholder="0000000000000000" />
                              </div>
                              <div className="col-12">
                                <label className="form-label">Observações</label>
                                <textarea className="form-control" rows={3} value={genVincNotes} onChange={(e) => setGenVincNotes(e.target.value)} placeholder="Notas sobre o vínculo" />
                              </div>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setGenStep(s => (s > 1 ? s - 1 : s))}
                      disabled={genStep === 1}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        if (genStep < 3) {
                          setGenStep(s => s + 1)
                          return
                        }
                        // Finalizar: enviar POST com todos os dados (strings vazias -> null)
                        try {
                          setGenSubmitting(true)
                          const toNull = (v) => {
                            const t = (v == null) ? '' : String(v)
                            return t.trim() === '' ? null : t
                          }
                          const metaVal = (() => {
                            const v = toNull(genMetaTag)
                            return v == null ? '<meta tag/>' : v
                          })()
                          const payload = {
                            razao_social: toNull(genRazao),
                            cnpj: toNull(genCnpj),
                            empresa: toNull(genEmpresa),
                            id_empresa: toNull(genEmpresaId),
                            endereco: toNull(genEndereco),
                            whatsapp: toNull(genWhatsapp),
                            meta_tag: metaVal,
                            id_app: toNull(genAppId),
                            nome_bm: toNull(genBmName),
                            token: toNull(genToken),
                            id_bm: toNull(genVincIdBm),
                            observacoes: toNull(genVincNotes),
                          }
                          const url = n8nUrl('/webhook/gerador-sitev3')
                          const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          })
                          if (!res.ok) {
                            const txt = await res.text().catch(() => '')
                            throw new Error(`${res.status} ${txt}`.trim())
                          }
                          notify.success('Solicitação enviada com sucesso')
                          setIsGenerateOpen(false)
                          // Atualiza a lista de sites após finalizar
                          fetchSites().catch(() => {})
                        } catch (e) {
                          notify.error(`Falha ao enviar: ${e?.message || 'erro'}`)
                        } finally {
                          setGenSubmitting(false)
                        }
                      }}
                      disabled={!canProceed || genSubmitting}
                    >
                      {genStep < 3 ? 'Próximo' : (genSubmitting ? 'Enviando...' : 'Finalizar')}
                    </button>
                  </div>
                </div>
              </div>
            </div>, document.body
          )}
        </div>
        )}
      </main>
      <Footer />
    </div>
  )
}


