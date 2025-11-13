import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'

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

export default function GeradorSites() {
  // Tabela Gerador de Sites (via GET externo)
  const [siteRows, setSiteRows] = useState([])
  const [siteLoading, setSiteLoading] = useState(false)
  const [siteError, setSiteError] = useState(null)

  // Modais de ações por linha
  const [isCompanyOpen, setIsCompanyOpen] = useState(false)
  const [companyRow, setCompanyRow] = useState(null)
  // Campos de edição (usados no modal Dados da Empresa)
  const [editRazao, setEditRazao] = useState('')
  const [editCnpj, setEditCnpj] = useState('')
  const [editBusinessId, setEditBusinessId] = useState('')
  const [editEmpresa, setEditEmpresa] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [editSite, setEditSite] = useState('')
  const [editDolphin, setEditDolphin] = useState('')
  const [editHtml, setEditHtml] = useState('')
  const [editMetaTag, setEditMetaTag] = useState('')
  // Empresa (select) no modal Dados da Empresa
  const [compEmpresaId, setCompEmpresaId] = useState('')
  const [compEmpresaName, setCompEmpresaName] = useState('')
  const [compEmpresaManual, setCompEmpresaManual] = useState(false)
  // Dolphin (select) no modal Dados da Empresa
  const [compDolphinManual, setCompDolphinManual] = useState(false)
  // Abas do modal Dados da Empresa
  const [compStep, setCompStep] = useState(1)
  const [compSubmitting, setCompSubmitting] = useState(false)
  // APP BM
  const [compAppEnabled, setCompAppEnabled] = useState(false)
  const [compAppId, setCompAppId] = useState('')
  const [compBmName, setCompBmName] = useState('')
  const [compToken, setCompToken] = useState('')
  // Vínculo BM
  const [compVincEnabled, setCompVincEnabled] = useState(false)
  const [compVincIdBm, setCompVincIdBm] = useState('')
  // Editor de HTML (modal com textarea grande)
  const [isHtmlEditorOpen, setIsHtmlEditorOpen] = useState(false)
  const [htmlEditorValue, setHtmlEditorValue] = useState('')
  // Teste APP BM
  const [appTesting, setAppTesting] = useState(false)
  const [appTestOk, setAppTestOk] = useState(null) // null | true | false
  const [appTestMsg, setAppTestMsg] = useState('')
  // Flag de alterações pendentes no modal Dados da Empresa
  const [compDirty, setCompDirty] = useState(false)

  // Helpers: visualizar/baixar HTML
  const buildCompanyHtml = () => {
    const html = (editHtml || '').toString()
    if (html && html.trim() !== '') return html
    // Fallback: monta um index simples usando a meta tag editável
    const meta = (editMetaTag || '').toString()
    return `<!doctype html><html><head>${meta}</head><body></body></html>`
  }
  const handleViewCompanyHtml = () => {
    try {
      const html = buildCompanyHtml()
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch (_) {}
  }
  const handleDownloadCompanyHtml = () => {
    try {
      const html = buildCompanyHtml()
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'index.html'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 0)
    } catch (_) {}
  }
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Modal Gerar Site
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [genRazao, setGenRazao] = useState('')
  const [genCnpj, setGenCnpj] = useState('')
  const [genEmpresa, setGenEmpresa] = useState('')
  const [genEmpresaId, setGenEmpresaId] = useState('')
  const [genEndereco, setGenEndereco] = useState('')
  const [genWhatsapp, setGenWhatsapp] = useState('')
  const [genMetaTag, setGenMetaTag] = useState('')
  const [genAppId, setGenAppId] = useState('')
  const [genBmName, setGenBmName] = useState('')
  const [genToken, setGenToken] = useState('')
  const [genEmpresaManual, setGenEmpresaManual] = useState(false)
  const [empresaList, setEmpresaList] = useState([]) // [{id, name}]
  const [empresaListLoading, setEmpresaListLoading] = useState(false)
  const [empresaListError, setEmpresaListError] = useState(null)
  // Dolphin (lista + modo manual)
  const [genDolphin, setGenDolphin] = useState('')
  const [genDolphinManual, setGenDolphinManual] = useState(false)
  const [dolphinList, setDolphinList] = useState([]) // [{id: name, name}]
  const [dolphinListLoading, setDolphinListLoading] = useState(false)
  const [dolphinListError, setDolphinListError] = useState(null)
  const [genAppEnabled, setGenAppEnabled] = useState(false)
  const [genVincEnabled, setGenVincEnabled] = useState(false)
  const [genVincIdBm, setGenVincIdBm] = useState('')
  const [genStep, setGenStep] = useState(1)
  const [genSubmitting, setGenSubmitting] = useState(false)

  const canProceed = useMemo(() => {
    if (genStep === 1) {
      const empresaOk = genEmpresaManual ? (String(genEmpresa || '').trim().length > 0) : (String(genEmpresaId || '').trim().length > 0)
      const vals = [genRazao, genCnpj, genEndereco, genWhatsapp]
      return vals.every(v => (String(v || '').trim().length > 0)) && empresaOk
    }
    return true
  }, [genStep, genRazao, genCnpj, genEmpresa, genEmpresaId, genEmpresaManual, genEndereco, genWhatsapp])

  // Carrega lista de empresas ao abrir o modal
  useEffect(() => {
    if (!isGenerateOpen) return
    const controller = new AbortController()
    ;(async () => {
      setEmpresaListLoading(true)
      setEmpresaListError(null)
      try {
        const url = 'https://webhook.sistemavieira.com.br/webhook/get-empresas'
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
        // Ignora erros de abort (ocorrem ao fechar o modal rapidamente)
        const msg = String(e?.message || '').toLowerCase()
        if (e?.name === 'AbortError' || msg.includes('aborted')) {
          // não exibir erro nesse caso
        } else {
          setEmpresaListError(e?.message || 'Erro ao carregar empresas')
        }
      } finally {
        setEmpresaListLoading(false)
      }

      // Carrega lista de Dolphins
      try {
        setDolphinListLoading(true)
        setDolphinListError(null)
        const url = 'https://webhook.sistemavieira.com.br/webhook/get-dolphin'
        const res = await fetch(url, { method: 'GET', signal: controller.signal })
        if (!res.ok) throw new Error(`get-dolphin ${res.status}`)
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
              const name = (first(it.dolphin) ?? first(it.name) ?? first(it.nome) ?? first(it.label) ?? first(it.bm_name) ?? '').toString().trim()
              const id = name
              if (name && !seen.has(id)) { seen.add(id); list.push({ id, name }) }
            }
          }
        }
        list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
        setDolphinList(list)
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase()
        if (e?.name === 'AbortError' || msg.includes('aborted')) {
          // ignore
        } else {
          setDolphinListError(e?.message || 'Erro ao carregar dolphins')
        }
      } finally {
        setDolphinListLoading(false)
      }
    })()
    return () => controller.abort()
  }, [isGenerateOpen])

  // Carrega a tabela "Gerador de Sites" de endpoint externo
  const fetchSites = async (signal) => {
    setSiteLoading(true)
    setSiteError(null)
    try {
      const url = 'https://webhook.sistemavieira.com.br/webhook/get-sites'
      const res = await fetch(url, { method: 'GET', signal })
      if (!res.ok) throw new Error(`get-sites ${res.status}`)
      const data = await res.json().catch(() => [])
      const first = (v) => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
      const rows = Array.isArray(data) ? data.map(o => {
        const createdAt = first(o?.created_at) || first(o?.createdAt) || first(o?.created_at_bm) || null
        const empresa = String(first(o?.name_empresas) || first(o?.name_empresa) || first(o?.empresa) || '').trim()
        const bmName = String(
          first(o?.name) ||
          first(o?.bm_name) ||
          first(o?.name_bm) ||
          first(o?.business_name) ||
          first(o?.nome_bm) ||
          first(o?.nome) ||
          ''
        ).trim() || empresa
        const site = String(first(o?.site) || first(o?.link) || '').trim()
        const html = first(o?.html_content) || first(o?.html) || ''
        const meta_tag = first(o?.meta_tag) || ''
        const endereco = String(first(o?.endereco) || '').trim()
        const idBusinessResolved = first(o?.id_business) || first(o?.business_id) || null
        const id = String(idBusinessResolved || first(o?.id) || '').trim()
        const cnpj = String(first(o?.cnpj) || '').trim()
        const razao_social = String(first(o?.razao_social) || first(o?.razaoSocial) || '').trim()
        const id_bm = first(o?.id_bm) || first(o?.idBusiness) || first(o?.id_business) || first(o?.business_id) || null
        const bmLinked = !!(id_bm != null && String(id_bm).trim() !== '')
        const dolphin = String(first(o?.dolphin) || '').trim()
        const dolphinLinked = !!(dolphin !== '')
        const id_app = first(o?.id_app) || first(o?.app_id) || null
        const nome_app = first(o?.nome_app) || first(o?.name_app) || null
        const token = first(o?.token) || null
        const id_empresa = first(o?.id_empresa) ?? first(o?.group_id) ?? first(o?.grupo_id) ?? null
        const groupRaw = first(o?.group_id) ?? first(o?.grupo_id) ?? null
        const empresaLinked = (empresa !== '') || !!(groupRaw != null && String(groupRaw).trim() !== '')
        return { id, idBusinessResolved, createdAt, site, empresa, bmName, html, meta_tag, endereco, cnpj, razao_social, dolphin, id_app, nome_app, token, id_bm, id_empresa, bmLinked, dolphinLinked, empresaLinked }
      }) : []
      rows.sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))
      setSiteRows(rows)
    } catch (e) {
      // Ignora erros de abort (ex.: atualização enquanto há fetch em andamento)
      const msg = String(e?.message || '').toLowerCase()
      if (e?.name === 'AbortError' || msg.includes('aborted')) {
        // não exibir erro nesse caso
      } else {
        setSiteError(e?.message || 'Erro ao carregar sites')
      }
    } finally {
      setSiteLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchSites(controller.signal)
    return () => controller.abort()
  }, [])

  // Carrega lista de empresas ao abrir modal de Dados da Empresa (se necessário)
  useEffect(() => {
    if (!isCompanyOpen) return
    const controller = new AbortController()
    ;(async () => {
      if (empresaList && empresaList.length > 0 && !empresaListError) return
      setEmpresaListLoading(true)
      setEmpresaListError(null)
      try {
        const url = 'https://webhook.sistemavieira.com.br/webhook/get-empresas'
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
        const msg = String(e?.message || '').toLowerCase()
        if (e?.name === 'AbortError' || msg.includes('aborted')) {
          // ignore
        } else {
          setEmpresaListError(e?.message || 'Erro ao carregar empresas')
        }
      } finally {
        setEmpresaListLoading(false)
      }
    })()
    return () => controller.abort()
  }, [isCompanyOpen])

  // Seleciona automaticamente o ID correspondente ao nome vindo do get-sites
  useEffect(() => {
    if (!isCompanyOpen) return
    if (!compEmpresaId && compEmpresaName && Array.isArray(empresaList) && empresaList.length > 0) {
      const it = empresaList.find(x => String(x.name).trim().toLowerCase() === String(compEmpresaName).trim().toLowerCase())
      if (it) setCompEmpresaId(String(it.id))
    }
  }, [isCompanyOpen, empresaList, compEmpresaId, compEmpresaName])

  // Garante a lista de Dolphins ao abrir o modal Dados da Empresa (se necessário)
  useEffect(() => {
    if (!isCompanyOpen) return
    const controller = new AbortController()
    ;(async () => {
      if (dolphinList && dolphinList.length > 0 && !dolphinListError) return
      try {
        setDolphinListLoading(true)
        setDolphinListError(null)
        const url = 'https://webhook.sistemavieira.com.br/webhook/get-dolphin'
        const res = await fetch(url, { method: 'GET', signal: controller.signal })
        if (!res.ok) throw new Error(`get-dolphin ${res.status}`)
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
              const name = (first(it.dolphin) ?? first(it.name) ?? first(it.nome) ?? first(it.label) ?? first(it.bm_name) ?? '').toString().trim()
              const id = name
              if (name && !seen.has(id)) { seen.add(id); list.push({ id, name }) }
            }
          }
        }
        list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
        setDolphinList(list)
      } catch (e) {
        const msg = String(e?.message || '').toLowerCase()
        if (e?.name === 'AbortError' || msg.includes('aborted')) {
          // ignore
        } else {
          setDolphinListError(e?.message || 'Erro ao carregar dolphins')
        }
      } finally {
        setDolphinListLoading(false)
      }
    })()
    return () => controller.abort()
  }, [isCompanyOpen])

  // Ações
  const openCompanyModal = (row) => {
    setCompanyRow(row)
    setEditBusinessId(String(row?.id || row?.idBusinessResolved || ''))
    setEditRazao(row?.razao_social || '')
    setEditCnpj(formatCNPJ(row?.cnpj || ''))
    setEditEmpresa(row?.bmName || row?.empresa || '')
    setEditEndereco(row?.endereco || '')
    setEditSite(row?.site || '')
    setEditDolphin(row?.dolphin || '')
    setEditHtml(row?.html || '')
    setEditMetaTag(row?.meta_tag || '')
    setCompEmpresaName(row?.empresa || '')
    setCompEmpresaId('')
    setCompEmpresaManual(false)
    setCompStep(1)
    setCompSubmitting(false)
    setCompDirty(false)
    // Preenche APP BM a partir dos dados do get-sites, quando vierem
    const idAppRaw = row?.id_app != null ? String(row.id_app) : ''
    const nomeAppRaw = row?.nome_app != null ? String(row.nome_app) : ''
    const tokenRaw = row?.token != null ? String(row.token) : ''
    const anyApp = [idAppRaw, nomeAppRaw, tokenRaw].some(v => String(v || '').trim() !== '')
    setCompAppEnabled(anyApp)
    // Preenche o campo com o id_business vindo do get-sites (exibição)
    const idBizForApp = row?.idBusinessResolved != null ? String(row.idBusinessResolved) : (row?.id != null ? String(row.id) : '')
    setCompAppId(idBizForApp || '')
    setCompBmName(nomeAppRaw || '')
    setCompToken(tokenRaw || '')
    // Preenche Vínculo BM com id_business quando disponível
    const vincRaw = (row?.idBusinessResolved != null && String(row.idBusinessResolved).trim() !== '')
      ? String(row.idBusinessResolved)
      : ''
    const hasVinc = vincRaw.trim() !== ''
    setCompVincEnabled(hasVinc)
    setCompVincIdBm(vincRaw)
    setIsCompanyOpen(true)
    // limpa status de teste
    setAppTesting(false)
    setAppTestOk(null)
    setAppTestMsg('')
  }

  // Ao alterar ID Business ou Token, limpa o resultado do teste
  useEffect(() => {
    setAppTestOk(null)
    setAppTestMsg('')
  }, [compAppId, compToken])
  const openDeleteModal = (row) => {
    setDeleteRow(row)
    setIsDeleteOpen(true)
  }
  const handleDeleteConfirm = async () => {
    if (!deleteRow) return
    try {
      setDeleteSubmitting(true)
      const toNull = (v) => {
        const t = (v == null) ? '' : String(v)
        return t.trim() === '' ? null : t
      }
      const payload = {
        cnpj: toNull(deleteRow.cnpj),
        dolphin: toNull(deleteRow.dolphin),
        empresa: toNull(deleteRow.empresa),
        endereco: toNull(deleteRow.endereco),
        html_content: toNull(deleteRow.html),
        id_app: toNull(deleteRow.id_app),
        id_bm: toNull(deleteRow.id_bm),
        id_business: toNull(deleteRow.idBusinessResolved || deleteRow.id),
        id_empresa: toNull(deleteRow.id_empresa),
        meta_tag: toNull(deleteRow.meta_tag),
        nome_app: toNull(deleteRow.nome_app),
        razao_social: toNull(deleteRow.razao_social),
        token: toNull(deleteRow.token),
      }
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/delete-site3', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`${res.status} ${txt}`.trim())
      }
      notify.success('Excluído com sucesso')
      setIsDeleteOpen(false)
      setDeleteRow(null)
      fetchSites().catch(() => {})
    } catch (e) {
      notify.error(`Falha ao excluir: ${e?.message || 'erro'}`)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container flex-grow-1 py-3">
        {/* Gerador de Sites */}
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
                  <th style={{minWidth: '200px'}}>Dolphin</th>
                  <th className="text-center" style={{width: '140px'}}>Empresa</th>
                  <th className="text-center" style={{width: '140px'}}>BM Vinculada</th>
                  <th className="text-center" style={{width: '140px'}}>Dolphin</th>
                  <th className="text-center" style={{width: '160px'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {siteError && (
                  <tr>
                    <td colSpan={7} className="text-danger">{String(siteError)}</td>
                  </tr>
                )}
                {(!siteRows || siteRows.length === 0) && !siteLoading && !siteError && (
                  <tr>
                    <td colSpan={7} className="text-center opacity-75 p-4">Nenhum registro</td>
                  </tr>
                )}
                {siteRows.map((row, idx) => (
                  <tr key={`${row.id || 'site'}-${idx}`}>
                    <td className="text-nowrap">{formatCNPJ(row.cnpj)}</td>
                    <td className="text-nowrap">{row.razao_social || '-'}</td>
                    <td className="text-nowrap">{row.dolphin || '-'}</td>
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
                        className="btn btn-sm p-1 border-0 bg-transparent shadow-none me-1"
                        title="Dados da Empresa"
                        aria-label="Dados da Empresa"
                        onClick={() => openCompanyModal(row)}
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                      >
                        <Fi.FiBriefcase size={16} style={{ color: '#60a5fa' }} />
                      </button>
                      {/* Botão Editar removido a pedido */}
                      <button
                        type="button"
                        className="btn btn-sm p-1 border-0 bg-transparent shadow-none"
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => openDeleteModal(row)}
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}
                      >
                        <Fi.FiTrash size={16} style={{ color: '#ef4444' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Modal: Dados da Empresa (com edição + abas) */}
          {isCompanyOpen && companyRow && typeof document !== 'undefined' && createPortal(
            <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 12000 }} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content modal-dark">
                  <div className="modal-header">
                    <h5 className="modal-title">Dados da Empresa</h5>
                    <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => { setIsCompanyOpen(false); setCompanyRow(null) }} style={{ filter: 'invert(1)', opacity: 0.9 }}></button>
                  </div>
                  <div className="modal-body">
                    <style>{`
                      .__fade_slide_in{animation:fadeSlideIn .18s ease-out}
                      @keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
                    `}</style>
                    <div className="mb-3">
                      {(() => {
                        const s1 = compStep > 1 ? 'done' : (compStep === 1 ? 'active' : 'todo')
                        const s2 = compStep > 2 ? 'done' : (compStep === 2 ? 'active' : 'todo')
                        return (
                          <div className="d-flex align-items-center justify-content-between">
                            <StepBullet label="Dados" state={s1} />
                            <StepLine active={compStep >= 2} />
                            <StepBullet label="APP BM" state={s2} />
                          </div>
                        )
                      })()}
                    </div>

                    {compStep === 1 && (
                      <div className="__fade_slide_in">
                        <div className="row g-3">
                          <div className="col-md-4">
                            <label className="form-label">ID Business</label>
                            <input className="form-control" value={editBusinessId} onChange={(e) => setEditBusinessId(e.target.value)} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">BM</label>
                            <input className="form-control" value={editEmpresa} onChange={(e) => setEditEmpresa(e.target.value)} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">Empresa</label>
                            {compEmpresaManual ? (
                              <>
                                <input
                                  className="form-control"
                                  value={compEmpresaName}
                                  onChange={(e) => setCompEmpresaName(e.target.value)}
                                  placeholder="Digite o nome da empresa"
                                />
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm p-0"
                                    onClick={() => { setCompEmpresaManual(false) }}
                                  >Selecionar da lista</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <select
                                  className="form-select"
                                  value={compEmpresaId}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    if (v === '__ADD__') {
                                      setCompEmpresaManual(true)
                                      setCompEmpresaId('')
                                      return
                                    }
                                    setCompEmpresaId(v)
                                    const it = (empresaList || []).find(x => String(x.id) === String(v))
                                    setCompEmpresaName(it?.name || '')
                                  }}
                                  disabled={empresaListLoading}
                                >
                                  <option value="__ADD__">+ Adicionar</option>
                                  <option value="">{compEmpresaName || 'Selecione'}</option>
                                  {(empresaList || []).map((it) => (
                                    <option key={String(it.id)} value={String(it.id)}>{it.name}</option>
                                  ))}
                                </select>
                                <div className="form-text">
                                  {empresaListLoading ? 'Carregando empresas...' : (empresaListError ? `Erro: ${empresaListError}` : `${empresaList.length} empresas`)}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="col-md-8">
                            <label className="form-label">Razão Social</label>
                            <input className="form-control" value={editRazao} onChange={(e) => setEditRazao(e.target.value)} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label">CNPJ</label>
                            <input className="form-control" value={editCnpj} onChange={(e) => setEditCnpj(formatCNPJ(e.target.value))} />
                          </div>
                          <div className="col-12">
                            <label className="form-label">Endereço</label>
                            <input className="form-control" value={editEndereco} onChange={(e) => setEditEndereco(e.target.value)} />
                          </div>
                          {/* Meta Tag oculto neste modal */}
                          <div className="col-md-4">
                            <label className="form-label">Dolphin</label>
                            {compDolphinManual ? (
                              <>
                                <input
                                  className="form-control"
                                  value={editDolphin}
                                  onChange={(e) => setEditDolphin(e.target.value)}
                                  placeholder="Nome do Dolphin (BM)"
                                />
                                <div className="mt-1">
                                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setCompDolphinManual(false)}>Selecionar da lista</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <select
                                  className="form-select"
                                  value={editDolphin || ''}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    if (v === '__ADD__') {
                                      setCompDolphinManual(true)
                                      return
                                    }
                                    setEditDolphin(v)
                                  }}
                                  disabled={dolphinListLoading}
                                >
                                  <option value="">Selecione</option>
                                  <option value="__ADD__">+ Adicionar</option>
                                  {(dolphinList || []).map(it => (
                                    <option key={String(it.id)} value={String(it.name)}>{it.name}</option>
                                  ))}
                                </select>
                                <div className="form-text">
                                  {dolphinListLoading ? 'Carregando dolphins...' : (dolphinListError ? `Erro: ${dolphinListError}` : `${dolphinList.length} dolphins`)}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="col-12">
                            <div className="d-flex align-items-center justify-content-between">
                              <label className="form-label mb-0">Index Gerado</label>
                              <div className="d-flex align-items-center gap-2 position-relative">
                                {compDirty && (
                                  <span
                                    className="warn-save position-relative d-inline-flex align-items-center"
                                    style={{cursor: 'help'}}
                                    title="Alterações pendentes. Para salvar, avance com Próximo até a última aba e clique em Salvar."
                                  >
                                    <Fi.FiAlertTriangle size={16} style={{ color: '#f59e0b' }} />
                                    <span aria-hidden className="__warn_tip" style={{ position: 'absolute', bottom: '100%', right: 0, transform: 'translateY(-8px)', marginBottom: 8, background: 'rgba(17,24,39,0.98)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '6px 8px', fontSize: 12, maxWidth: 300, zIndex: 13050, whiteSpace: 'normal', textAlign: 'left', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', pointerEvents: 'none', opacity: 0 }}>
                                      Para salvar as alterações, avance com Próximo até a última aba e clique em Salvar. Enquanto não salvar, os botões Ver e Download ficam desativados.
                                      <span aria-hidden style={{ position: 'absolute', top: '100%', right: 8, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(17,24,39,0.98)' }} />
                                    </span>
                                  </span>
                                )}
                                <style>{`.warn-save:hover .__warn_tip{opacity:1}`}</style>
                                <button type="button" className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" title="Ver" aria-label="Ver" onClick={handleViewCompanyHtml} disabled={compDirty}>
                                  <Fi.FiExternalLink size={14} />
                                  <span className="d-none d-sm-inline">Ver</span>
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" title="Download" aria-label="Download" onClick={handleDownloadCompanyHtml} disabled={compDirty}>
                                  <Fi.FiDownload size={14} />
                                  <span className="d-none d-sm-inline">Download</span>
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1" title="Editar" aria-label="Editar" onClick={() => { setHtmlEditorValue(editHtml || ''); setIsHtmlEditorOpen(true) }}>
                                  <Fi.FiEdit size={14} />
                                  <span className="d-none d-sm-inline">Editar</span>
                                </button>
                              </div>
                            </div>
                            {/* HTML oculto por padrão; edição apenas via modal Editar HTML */}
                          </div>
                        </div>
                      </div>
                    )}

                    {compStep === 2 && (
                      <div className="__fade_slide_in">
                        <div className="form-check form-switch mb-3">
                          <input className="form-check-input" type="checkbox" id="chkAppComp" checked={compAppEnabled} onChange={(e) => setCompAppEnabled(e.target.checked)} />
                          <label className="form-check-label" htmlFor="chkAppComp">Preencher APP manualmente</label>
                        </div>
                        {compAppEnabled && (
                          <div className="row g-3">
                            <div className="col-md-4">
                              <label className="form-label">ID Business</label>
                              <input className="form-control" value={compAppId} onChange={(e) => setCompAppId(e.target.value)} placeholder="000000000000000" />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Nome BM</label>
                              <input className="form-control" value={compBmName} onChange={(e) => setCompBmName(e.target.value)} placeholder="Meu BM" />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Token</label>
                              <input className="form-control" value={compToken} onChange={(e) => setCompToken(e.target.value)} placeholder="EAAG..." />
                            </div>
                            {(() => {
                              const canTest = [compAppId, compToken].every(v => String(v || '').trim() !== '')
                              if (!canTest) return null
                              const handleTestApp = async () => {
                                const id = String(compAppId || '').trim()
                                const token = String(compToken || '').trim()
                                if (!id || !token) return
                                try {
                                  setAppTesting(true)
                                  setAppTestOk(null)
                                  setAppTestMsg('')
                                  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(id)}?fields=id,name,verification_status,vertical,owned_ad_accounts,owned_pages,owned_whatsapp_business_accounts`
                                  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                                  if (res.ok) {
                                    setAppTestOk(true)
                                    setAppTestMsg('API OK')
                                  } else {
                                    const txt = await res.text().catch(() => '')
                                    setAppTestOk(false)
                                    if (res.status === 401) {
                                      setAppTestMsg('Token inválido (401)')
                                    } else {
                                      const compact = (txt || '').slice(0, 120).replace(/\s+/g, ' ')
                                      setAppTestMsg(`${res.status} ${compact}`.trim())
                                    }
                                  }
                                } catch (e) {
                                  setAppTestOk(false)
                                  setAppTestMsg(e?.message || 'erro')
                                } finally {
                                  setAppTesting(false)
                                }
                              }
                              return (
                                <div className="col-12 d-flex justify-content-end align-items-center" style={{ gap: 12 }}>
                                  {appTestOk === true && (
                                    <span className="small d-inline-flex align-items-center" style={{ color: '#22c55e' }}>
                                      <Fi.FiCheck size={14} style={{ marginRight: 6 }} />
                                      {appTestMsg || 'API OK'}
                                    </span>
                                  )}
                                  {appTestOk === false && (
                                    <span className="small d-inline-flex align-items-center" style={{ color: '#ef4444' }}>
                                      <Fi.FiX size={14} style={{ marginRight: 6 }} />
                                      {appTestMsg || 'Falha'}
                                    </span>
                                  )}
                                  <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); if (!appTesting) handleTestApp() }}
                                    className="small"
                                    aria-busy={appTesting}
                                    style={{ opacity: appTesting ? 0.7 : 1 }}
                                  >
                                    {appTesting ? 'Testando API…' : 'Testar API'}
                                  </a>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Aba Vinculo BM removida a pedido */}
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCompStep(s => (s > 1 ? s - 1 : s))}
                      disabled={compStep === 1}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        if (compStep < 2) { setCompStep(s => s + 1); return }
                        try {
                          setCompSubmitting(true)
                          const toNull = (v) => {
                            const t = (v == null) ? '' : String(v)
                            return t.trim() === '' ? null : t
                          }
                          const payload = {
                            id_business: toNull(editBusinessId),
                            razao_social: toNull(editRazao),
                            cnpj: toNull(editCnpj),
                            empresa: toNull(compEmpresaName),
                            id_empresa: toNull(compEmpresaId),
                            endereco: toNull(editEndereco),
                            meta_tag: toNull(editMetaTag),
                            dolphin: toNull(editDolphin),
                            html_content: toNull(editHtml),
                            id_app: toNull(compAppId),
                            nome_app: toNull(compBmName),
                            token: toNull(compToken),
                            id_bm: toNull(compVincIdBm),
                          }
                          const url = 'https://webhook.sistemavieira.com.br/webhook/atualiza-site3'
                          const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          })
                          if (!res.ok) {
                            const txt = await res.text().catch(() => '')
                            throw new Error(`${res.status} ${txt}`.trim())
                          }
                          notify.success('Atualizado com sucesso')
                          setCompDirty(false)
                          setIsCompanyOpen(false)
                          fetchSites().catch(() => {})
                        } catch (e) {
                          notify.error(`Falha ao atualizar: ${e?.message || 'erro'}`)
                        } finally {
                          setCompSubmitting(false)
                        }
                      }}
                      disabled={compSubmitting}
                    >
                      {compStep < 2 ? 'Próximo' : (compSubmitting ? 'Salvando...' : 'Salvar')}
                    </button>
                  </div>
                </div>
              </div>
            </div>, document.body
          )}

          {/* Modal: Editar HTML */}
          {isHtmlEditorOpen && typeof document !== 'undefined' && createPortal(
            <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 12500 }} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-md modal-dialog-centered">
                <div className="modal-content modal-dark">
                  <div className="modal-header">
                    <h5 className="modal-title">Editar HTML</h5>
                    <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => setIsHtmlEditorOpen(false)} style={{ filter: 'invert(1)', opacity: 0.9 }}></button>
                  </div>
                  <div className="modal-body">
                    <label className="form-label">HTML</label>
                    <textarea className="form-control font-monospace" style={{minHeight: 260}} rows={10} value={htmlEditorValue} onChange={(e) => setHtmlEditorValue(e.target.value)} placeholder="Cole ou edite o HTML completo" />
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setIsHtmlEditorOpen(false)}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={() => { setEditHtml(htmlEditorValue); setIsHtmlEditorOpen(false); setCompDirty(true) }}>Aplicar</button>
                  </div>
                </div>
              </div>
            </div>, document.body
          )}

          {/* Modal: Excluir */}
          {isDeleteOpen && deleteRow && typeof document !== 'undefined' && createPortal(
            <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 12000 }} role="dialog" aria-modal="true">
              <div className="modal-dialog modal-md modal-dialog-centered">
                <div className="modal-content modal-dark">
                  <div className="modal-header">
                    <h5 className="modal-title">Excluir</h5>
                    <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => { setIsDeleteOpen(false); setDeleteRow(null) }} style={{ filter: 'invert(1)', opacity: 0.9 }}></button>
                  </div>
                  <div className="modal-body">
                    <p>Tem certeza que deseja excluir o registro da empresa <strong>{deleteRow?.razao_social || deleteRow?.empresa || '-'}</strong>?</p>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => { setIsDeleteOpen(false); setDeleteRow(null) }}>Cancelar</button>
                    <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleteSubmitting}>Excluir</button>
                  </div>
                </div>
              </div>
            </div>, document.body
          )}
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
                                  if (v === '__ADD__') {
                                    setGenEmpresaManual(true)
                                    setGenEmpresaId('')
                                    setGenEmpresa('')
                                    return
                                  }
                                  setGenEmpresaId(v)
                                  const it = (empresaList || []).find(x => String(x.id) === String(v))
                                  setGenEmpresa(it?.name || '')
                                }}
                                disabled={empresaListLoading}
                              >
                                <option value="">Selecione</option>
                                <option value="__ADD__">+ Adicionar</option>
                                {(empresaList || []).map(it => (
                                  <option key={String(it.id)} value={String(it.id)}>{it.name}</option>
                                ))}
                              </select>
                              <div className="mt-1 small opacity-75">
                                {empresaListLoading ? 'Carregando empresas...' : (empresaListError ? `Erro: ${empresaListError}` : `${empresaList.length} empresas`)}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Endereço</label>
                          <input className="form-control" value={genEndereco} onChange={(e) => setGenEndereco(e.target.value)} placeholder="Rua X, 123 - Cidade - Estado" />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Dolphin</label>
                          {genDolphinManual ? (
                            <>
                              <input className="form-control" value={genDolphin} onChange={(e) => setGenDolphin(e.target.value)} placeholder="Nome do Dolphin (BM)" />
                              <div className="mt-1">
                                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { setGenDolphinManual(false); setGenDolphin('') }}>Selecionar da lista</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <select
                                className="form-select"
                                value={genDolphin || ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === '__ADD__') {
                                    setGenDolphinManual(true)
                                    setGenDolphin('')
                                    return
                                  }
                                  setGenDolphin(v)
                                }}
                                disabled={dolphinListLoading}
                              >
                                <option value="">Selecione</option>
                                <option value="__ADD__">+ Adicionar</option>
                                {(dolphinList || []).map(it => (
                                  <option key={String(it.id)} value={String(it.name)}>{it.name}</option>
                                ))}
                              </select>
                              <div className="mt-1 small opacity-75">
                                {dolphinListLoading ? 'Carregando dolphins...' : (dolphinListError ? `Erro: ${dolphinListError}` : `${dolphinList.length} dolphins`)}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">WhatsApp</label>
                          <input className="form-control" value={genWhatsapp} onChange={(e) => setGenWhatsapp(formatPhoneBR(e.target.value))} placeholder="+55 11 99999-9999" />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Meta Tag</label>
                          <input className="form-control" value={genMetaTag} onChange={(e) => setGenMetaTag(e.target.value)} placeholder="<meta />" />
                        </div>
                      </div>
                      </form></div>
                    )}
                    {genStep === 2 && (
                      <div className="__fade_slide_in">
                        <div className="form-check form-switch mb-3">
                          <input className="form-check-input" type="checkbox" id="chkApp" checked={genAppEnabled} onChange={(e) => setGenAppEnabled(e.target.checked)} />
                          <label className="form-check-label" htmlFor="chkApp">Preencher APP manualmente</label>
                        </div>
                        {genAppEnabled && (
                          <form onSubmit={(e) => e.preventDefault()}>
                            <div className="row g-3">
                              <div className="col-md-4">
                                <label className="form-label">ID App</label>
                                <input className="form-control" value={genAppId} onChange={(e) => setGenAppId(e.target.value)} placeholder="000000000000000" />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label">Nome BM</label>
                                <input className="form-control" value={genBmName} onChange={(e) => setGenBmName(e.target.value)} placeholder="Meu BM" />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label">Token</label>
                                <input className="form-control" value={genToken} onChange={(e) => setGenToken(e.target.value)} placeholder="EAAG..." />
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
                            dolphin: toNull(genDolphin),
                            id_app: toNull(genAppId),
                            nome_bm: toNull(genBmName),
                            token: toNull(genToken),
                            id_bm: toNull(genVincIdBm),
                          }
                          const url = 'https://webhook.sistemavieira.com.br/webhook/gerador-sitev3'
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
      </main>
      <Footer />
    </div>
  )
}
