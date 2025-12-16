import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { Roles } from '../utils/roles.js'
import { FiCheckCircle, FiClock, FiXCircle, FiChevronsRight, FiChevronsLeft, FiRefreshCw, FiTrash2 } from 'react-icons/fi'

export default function DisparadorConfigBM() {
  const { user } = useAuth()
  const warned = useRef(false)
  const countersRunId = useRef(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [bmId, setBmId] = useState('')
  const [token, setToken] = useState('')
  const [validating, setValidating] = useState(false)
  const [bmNome, setBmNome] = useState('')
  const [bmStatus, setBmStatus] = useState('')
  const [validationStatus, setValidationStatus] = useState('idle') // idle | success | error
  const [accounts, setAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState('')
  const [phonesByAccount, setPhonesByAccount] = useState({})
  const [phonesLoading, setPhonesLoading] = useState(null)
  const [phonesError, setPhonesError] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState(null)
  const [templatesByPhone, setTemplatesByPhone] = useState({})
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState('')
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false)
  const [selectedPhone, setSelectedPhone] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingBmId, setDeletingBmId] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState(null)
  const [bmRows, setBmRows] = useState([])
  const [bmRowsLoading, setBmRowsLoading] = useState(false)
  const [bmRowsError, setBmRowsError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [bmSearch, setBmSearch] = useState('')
  const [bmStatusFilter, setBmStatusFilter] = useState('')
  const [countersLoading, setCountersLoading] = useState(false)
  const [countersError, setCountersError] = useState('')
  const [countersUpdatedAt, setCountersUpdatedAt] = useState(null)
  const [counters, setCounters] = useState({
    bm: { verified: 0, naoVerificado: 0, total: 0 },
    phones: { connected: 0, banned: 0, total: 0 }
  })

  const isMasterLevel1 = user?.role === Roles.Master && Number(user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia ?? 0) === 1

  useEffect(() => {
    if (!isMasterLevel1 && !warned.current) {
      warned.current = true
      notify.warn('Acesso permitido apenas para Master nível 1.')
    }
  }, [isMasterLevel1])

  useEffect(() => {
    loadSavedBMs()
  }, [])

  const handleValidate = async (idArg, tokenArg, { silent = false, skipReset = false } = {}) => {
    const idClean = String(idArg ?? bmId ?? '').trim()
    const tokenClean = String(tokenArg ?? token ?? '').trim()
    if (!idClean || !tokenClean) {
      if (!silent) notify.warn('Informe ID BM e Token.')
      return false
    }
    setValidating(true)
    if (!skipReset) {
      setBmNome('')
      setBmStatus('')
      setAccounts([])
    }
    setValidationStatus('idle')
    setAccountsError('')
    setPhonesByAccount({})
    setSelectedAccountId(null)
    setPhonesError('')
    try {
      const params = new URLSearchParams({
        fields: 'id,name,primary_page,timezone_id,verification_status,owned_pages{id,name},owned_ad_accounts{id,account_id,name,account_status}',
        access_token: tokenClean
      })
      const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(idClean)}?${params.toString()}`
      const res = await fetch(url, { method: 'GET' })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      const data = JSON.parse(raw)
      setBmNome(data?.name || '')
      setBmStatus(data?.verification_status || '')
      setValidationStatus('success')
      if (!silent) notify.success('BM validado.')
      await fetchWhatsappAccounts(idClean, tokenClean)
      return true
    } catch (e) {
      setValidationStatus('error')
      if (!silent) notify.error(e?.message || 'Falha ao validar BM.')
      return false
    } finally {
      setValidating(false)
    }
  }

  const requestWhatsappAccounts = async (idClean, tokenClean) => {
    const params = new URLSearchParams({
      fields: 'id,name,creation_time',
      access_token: tokenClean
    })
    const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(idClean)}/owned_whatsapp_business_accounts?${params.toString()}`
    const res = await fetch(url, { method: 'GET' })
    const raw = await res.text().catch(() => '')
    if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
    const data = JSON.parse(raw)
    return Array.isArray(data?.data) ? data.data : []
  }

  const requestBmInfo = async (idClean, tokenClean) => {
    const params = new URLSearchParams({
      fields: 'id,name,primary_page,timezone_id,verification_status,owned_pages{id,name},owned_ad_accounts{id,account_id,name,account_status}',
      access_token: tokenClean
    })
    const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(idClean)}?${params.toString()}`
    const res = await fetch(url, { method: 'GET' })
    const raw = await res.text().catch(() => '')
    if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
    const data = JSON.parse(raw)
    return {
      name: data?.name || '',
      verification_status: data?.verification_status || ''
    }
  }

  const fetchWhatsappAccounts = async (idClean, tokenClean) => {
    setAccountsLoading(true)
    setAccountsError('')
    try {
      const arr = await requestWhatsappAccounts(idClean, tokenClean)
      setAccounts(arr)
      return arr
    } catch (e) {
      setAccounts([])
      setAccountsError(e?.message || 'Falha ao buscar canais WhatsApp.')
      notify.error(e?.message || 'Falha ao buscar canais WhatsApp.')
      return []
    } finally {
      setAccountsLoading(false)
    }
  }

  const loadSavedBMs = async () => {
    setBmRowsLoading(true)
    setBmRowsError('')
    try {
      const res = await fetch('https://n8n.apivieiracred.store/webhook/bm-get', { method: 'GET' })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      const data = JSON.parse(raw)
      const arr = Array.isArray(data) ? data : []
      const map = new Map()
      arr.forEach((item) => {
        const key = item?.bm_id || item?.bmId
        if (!key) return
        const current = map.get(key)
        const currentDate = current?.canal_data ? Date.parse(current.canal_data) : -Infinity
        const incomingDate = item?.canal_data ? Date.parse(item.canal_data) : -Infinity
        if (!current || incomingDate > currentDate) {
          map.set(key, {
            bm_id: key,
            bm_nome: item?.bm_nome || '-',
            bm_statusPortifolio: item?.bm_statusPortifolio || '-',
            canal_data: item?.canal_data || null,
            bm_token: item?.bm_token || item?.token || ''
          })
        }
      })
      const rows = Array.from(map.values()).sort((a, b) => (Date.parse(b.canal_data || 0) || 0) - (Date.parse(a.canal_data || 0) || 0))
      setBmRows(rows)
      refreshCounters(rows)
    } catch (e) {
      setBmRows([])
      setBmRowsError(e?.message || 'Falha ao buscar BMs salvas.')
    } finally {
      setBmRowsLoading(false)
    }
  }

  const fetchPhones = async (accountId, tokenClean) => {
    setPhonesError('')
    setPhonesLoading(accountId)
    try {
      const arr = await requestPhones(accountId, tokenClean)
      setSelectedAccountId(accountId)
    } catch (e) {
      setPhonesError(e?.message || 'Falha ao buscar telefones.')
      notify.error(e?.message || 'Falha ao buscar telefones.')
    } finally {
      setPhonesLoading(null)
    }
  }

  const mapStatus = (value) => {
    const v = String(value || '').toLowerCase()
    if (v === 'verified') return { label: 'Verificado', color: '#22c55e' }
    if (v === 'pending_submission' || v === 'pending_need_more_info') return { label: 'N\u00e3o verificado', color: '#D47B04' }
    return { label: value || '-', color: '#6c757d' }
  }

  const mapQuality = (value) => {
    const v = String(value || '').toLowerCase()
    if (v === 'red') return { label: 'Ruim', color: '#ef4444' }
    if (v === 'green') return { label: 'Boa', color: '#22c55e' }
    if (v === 'unknown') return { label: 'Sem status', color: '#6c757d' }
    return { label: value || '-', color: '#6c757d' }
  }

  const mapPhoneStatus = (value) => {
    const v = String(value || '').trim().toUpperCase()
    if (v === 'CONNECTED') return { label: 'Conectado', color: '#22c55e' }
    if (v === 'BANNED') return { label: 'Banido', color: '#ef4444' }
    if (v === 'PENDING') return { label: 'Pendente', color: '#d47b04' }
    if (v === 'DISCONNECTED') return { label: 'Desconectado', color: '#ef4444' }
    if (v === 'CONNECTING') return { label: 'Conectando', color: '#f59e0b' }
    if (!v) return { label: '-', color: '#6c757d' }
    return { label: v, color: '#6c757d' }
  }

  const formatLimit = (value) => {
    const v = String(value || '').toUpperCase()
    if (v === 'TIER_1K') return '1.000'
    if (v === 'TIER_250') return '250'
    return value || '-'
  }

  const fetchPhonesFromGraph = async (accountId, tokenClean) => {
    const params = new URLSearchParams({
      fields:
        'id,verified_name,display_phone_number,status,quality_rating,code_verification_status,account_mode,messaging_limit_tier',
      access_token: tokenClean
    })
    const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(accountId)}/phone_numbers?${params.toString()}`
    const res = await fetch(url, { method: 'GET' })
    const raw = await res.text().catch(() => '')
    if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
    const data = JSON.parse(raw)
    return Array.isArray(data?.data) ? data.data : []
  }

  const requestPhones = async (accountId, tokenClean, { force = false } = {}) => {
    if (!force && phonesByAccount[accountId]) return phonesByAccount[accountId]
    const arr = await fetchPhonesFromGraph(accountId, tokenClean)
    setPhonesByAccount((prev) => ({ ...prev, [accountId]: arr }))
    return arr
  }

  async function pMapLimit(items, limit, mapper) {
    const arr = Array.isArray(items) ? items : []
    const pool = Math.max(1, Number(limit) || 1)
    const results = []
    const executing = new Set()

    for (const item of arr) {
      const p = Promise.resolve().then(() => mapper(item))
      results.push(p)
      executing.add(p)
      const cleanup = () => executing.delete(p)
      p.then(cleanup).catch(cleanup)
      if (executing.size >= pool) await Promise.race(executing)
    }

    return Promise.allSettled(results)
  }

  async function refreshCounters(rowsArg = bmRows) {
    const rows = Array.isArray(rowsArg) ? rowsArg : []
    const runId = ++countersRunId.current
    setCountersLoading(true)
    setCountersError('')
    setCountersUpdatedAt(null)

    const statusByBm = new Map()
    rows.forEach((row) => {
      const id = String(row?.bm_id || row?.bmId || '').trim()
      if (!id) return
      statusByBm.set(id, row?.bm_statusPortifolio || '')
    })

    let bmVerified = 0
    let bmNaoVerificado = 0
    for (const value of statusByBm.values()) {
      const v = String(value || '').toLowerCase()
      if (v === 'verified') bmVerified++
      else if (v === 'pending_submission' || v === 'pending_need_more_info') bmNaoVerificado++
    }

    setCounters((prev) => ({
      ...prev,
      bm: { verified: bmVerified, naoVerificado: bmNaoVerificado, total: rows.length },
      phones: { connected: 0, banned: 0, total: 0 }
    }))

    let connected = 0
    let banned = 0
    let totalPhones = 0
    let hasAnyError = false

    try {
      const rowsWithToken = rows.filter((row) => {
        const id = String(row?.bm_id || row?.bmId || '').trim()
        const tokenClean = String(row?.bm_token || row?.token || '').trim()
        return Boolean(id && tokenClean)
      })

      await pMapLimit(rowsWithToken, 3, async (row) => {
        const idClean = String(row?.bm_id || row?.bmId || '').trim()
        const tokenClean = String(row?.bm_token || row?.token || '').trim()
        if (!idClean || !tokenClean) return

        try {
          const info = await requestBmInfo(idClean, tokenClean)
          if (info?.verification_status) statusByBm.set(idClean, info.verification_status)
        } catch {
          hasAnyError = true
        }

        let accountsList = []
        try {
          accountsList = await requestWhatsappAccounts(idClean, tokenClean)
        } catch {
          hasAnyError = true
          return
        }

        await pMapLimit(accountsList, 4, async (acc) => {
          const accountId = String(acc?.id || '').trim()
          if (!accountId) return
          try {
            const phones = await fetchPhonesFromGraph(accountId, tokenClean)
            totalPhones += phones.length
            phones.forEach((ph) => {
              const st = String(ph?.status || '').trim().toUpperCase()
              if (st === 'CONNECTED') connected++
              else if (st === 'BANNED') banned++
            })
          } catch {
            hasAnyError = true
          }
        })
      })

      if (runId !== countersRunId.current) return

      bmVerified = 0
      bmNaoVerificado = 0
      for (const value of statusByBm.values()) {
        const v = String(value || '').toLowerCase()
        if (v === 'verified') bmVerified++
        else if (v === 'pending_submission' || v === 'pending_need_more_info') bmNaoVerificado++
      }

      setCounters({
        bm: { verified: bmVerified, naoVerificado: bmNaoVerificado, total: rows.length },
        phones: { connected, banned, total: totalPhones }
      })
      setCountersUpdatedAt(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))
      if (hasAnyError) setCountersError('Algumas BMs/canais não puderam ser atualizados (token/permissões).')
    } catch (e) {
      if (runId !== countersRunId.current) return
      setCountersError(e?.message || 'Falha ao atualizar contadores.')
    } finally {
      if (runId === countersRunId.current) setCountersLoading(false)
    }
  }

  const mapTemplateStatus = (value) => {
    const v = String(value || '').toUpperCase()
    if (v === 'APPROVED') return { label: 'Aprovado', color: '#22c55e' }
    if (v === 'PENDING') return { label: 'Pendente', color: '#d47b04' }
    return { label: value || '-', color: '#6c757d' }
  }

  const mapTemplateCategory = (value) => {
    const v = String(value || '').toUpperCase()
    if (v === 'UTILITY') return 'Utilidade'
    if (v === 'MARKETING') return 'Marketing'
    return value || '-'
  }

  const getTemplateBodyText = (tpl) => {
    const body = (tpl?.components || []).find((comp) => String(comp?.type).toUpperCase() === 'BODY')
    return body?.text || '-'
  }

  const requestTemplates = async (accountId, tokenClean, { force = false } = {}) => {
    if (!force && templatesByPhone[accountId]) return templatesByPhone[accountId]
    const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(accountId)}/message_templates?access_token=${encodeURIComponent(tokenClean)}`
    const res = await fetch(url, { method: 'GET' })
    const raw = await res.text().catch(() => '')
    if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
    const data = JSON.parse(raw)
    const arr = Array.isArray(data?.data) ? data.data : []
    setTemplatesByPhone((prev) => ({ ...prev, [accountId]: arr }))
    return arr
  }

  const fetchTemplatesForPhone = async (phone, accountId) => {
    const tokenClean = String(token || '').trim()
    if (!tokenClean) {
      notify.warn('Informe o token para buscar modelos.')
      return
    }
    const targetAccountId = accountId || selectedAccountId
    if (!phone?.id || !targetAccountId) return
    setTemplatesModalOpen(true)
    setSelectedPhone(phone)
    setTemplatesError('')
    if (templatesByPhone[targetAccountId]) return
    setTemplatesLoading(true)
    try {
      await requestTemplates(targetAccountId, tokenClean)
    } catch (e) {
      setTemplatesError(e?.message || 'Falha ao buscar modelos.')
      notify.error(e?.message || 'Falha ao buscar modelos.')
    } finally {
      setTemplatesLoading(false)
    }
  }

  const formatUnixToBR = (value) => {
    if (value === null || value === undefined) return '-'
    const num = Number(value)
    if (Number.isNaN(num)) return '-'
    const d = new Date(num * 1000)
    if (Number.isNaN(d)) return '-'
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }

  const formatIsoToBR = (value) => {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d)) return '-'
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }

  const handleEditRow = async (row) => {
    const nextId = row?.bm_id || ''
    const nextToken = row?.bm_token || ''
    if (!nextId || !nextToken) {
      notify.warn('Registro não possui token para validar.')
      return
    }
    setIsEditing(true)
    setBmId(nextId)
    setToken(nextToken)
    setBmNome(row?.bm_nome || '')
    setBmStatus(row?.bm_statusPortifolio || '')
    setValidationStatus('idle')
    setAccounts([])
    setAccountsError('')
    setPhonesByAccount({})
    setSelectedAccountId(null)
    setPhonesError('')
    setModalOpen(true)
    await handleValidate(nextId, nextToken, { silent: true, skipReset: true })
  }

  const selectedPhones = selectedAccountId ? phonesByAccount[selectedAccountId] || [] : []
  const templatesKey = selectedAccountId || selectedPhone?.id
  const templates = templatesKey ? templatesByPhone[templatesKey] || [] : []
  const tokenColClass = isEditing ? 'col-12 col-md-8' : 'col-12 col-md-6'
  const showSavedBms = !modalOpen && !templatesModalOpen
  const bmSearchClean = String(bmSearch || '').trim().toLowerCase()
  const filteredBmRows = bmRows.filter((row) => {
    if (bmSearchClean && !String(row?.bm_nome || '').toLowerCase().includes(bmSearchClean)) return false
    if (!bmStatusFilter) return true
    const statusValue = String(row?.bm_statusPortifolio || '').toLowerCase()
    if (bmStatusFilter === 'verified') return statusValue === 'verified'
    if (bmStatusFilter === 'nao_verificado') return statusValue === 'pending_submission' || statusValue === 'pending_need_more_info'
    return true
  })

  const handleSave = async (idArg, tokenArg, { silent = false } = {}) => {
    const idClean = String(idArg ?? bmId ?? '').trim()
    const tokenClean = String(tokenArg ?? token ?? '').trim()
    if (!idClean || !tokenClean) {
      if (!silent) notify.warn('Informe ID BM e Token antes de salvar.')
      return false
    }
    if (!accounts || accounts.length === 0) {
      if (!silent) notify.warn('Valide a BM para carregar os canais antes de salvar.')
      return false
    }
    setSaving(true)
    try {
      const body = await buildBmBody({
        idClean,
        tokenClean,
        nomeBmValue: bmNome,
        statusPortfolioValue: bmStatus,
        accountsList: accounts
      })

      const res = await fetch('https://n8n.apivieiracred.store/webhook/bm-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      notify.success('Dados enviados com sucesso.')
      setTimeout(() => window.location.reload(), 600)
      return true
    } catch (e) {
      notify.error(e?.message || 'Falha ao salvar dados.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const buildBmBody = async ({ idClean, tokenClean, nomeBmValue, statusPortfolioValue, accountsList, forceFetch = false }) => {
    const payloadAccounts = []
    for (const acc of accountsList || []) {
      const phones = await requestPhones(acc.id, tokenClean, { force: forceFetch })
      const templatesForAccount = await requestTemplates(acc.id, tokenClean, { force: forceFetch })
      const phonesPayload = phones.map((ph) => ({
        telefone: ph.display_phone_number || '-',
        telefoneId: ph.id || '-',
        qualidade: ph.quality_rating || '-',
        limite: formatLimit(ph.messaging_limit_tier),
        modelos: templatesForAccount.map((tpl) => ({
          nomeModelo: tpl.name || '-',
          linguagem: tpl.language || '-',
          status: tpl.status || '-',
          categoria: tpl.category || '-',
          mensagem: getTemplateBodyText(tpl)
        }))
      }))
      payloadAccounts.push({
        data: formatUnixToBR(acc.creation_time),
        nome: acc.name || '-',
        canalId: acc.id || '-',
        telefones: phonesPayload
      })
    }

    return {
      bmId: idClean,
      token: tokenClean,
      nomeBm: nomeBmValue || '-',
      statusPortfolio: statusPortfolioValue || '-',
      canais: payloadAccounts
    }
  }

  const handleDeleteRow = async (row) => {
    const idClean = String(row?.bm_id || row?.bmId || '').trim()
    const tokenClean = String(row?.bm_token || row?.token || '').trim()
    if (!idClean) {
      notify.warn('ID da BM inv\u00e1lido.')
      return false
    }
    if (!tokenClean) {
      notify.warn('Este registro est\u00e1 sem token. N\u00e3o \u00e9 poss\u00edvel excluir sem chamar as APIs.')
      return false
    }

    setDeletingBmId(idClean)
    try {
      const bmInfo = await requestBmInfo(idClean, tokenClean)
      const accountsList = await requestWhatsappAccounts(idClean, tokenClean)
      const body = await buildBmBody({
        idClean,
        tokenClean,
        nomeBmValue: bmInfo?.name || row?.bm_nome || '-',
        statusPortfolioValue: bmInfo?.verification_status || row?.bm_statusPortifolio || '-',
        accountsList,
        forceFetch: true
      })

      const res = await fetch('https://n8n.apivieiracred.store/webhook/bm-delete-port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      notify.success('Exclus\u00e3o enviada com sucesso.')
      await loadSavedBMs()
      return true
    } catch (e) {
      notify.error(e?.message || 'Falha ao excluir.')
      return false
    } finally {
      setDeletingBmId(null)
    }
  }

  const openDeleteModal = (row) => {
    const idClean = String(row?.bm_id || row?.bmId || '').trim()
    const tokenClean = String(row?.bm_token || row?.token || '').trim()
    if (!idClean) {
      notify.warn('ID da BM inv\u00e1lido.')
      return
    }
    if (!tokenClean) {
      notify.warn('Este registro est\u00e1 sem token. N\u00e3o \u00e9 poss\u00edvel excluir sem chamar as APIs.')
      return
    }
    setDeleteRow(row)
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    if (deletingBmId) return
    setDeleteModalOpen(false)
    setDeleteRow(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteRow) return
    const ok = await handleDeleteRow(deleteRow)
    if (ok) closeDeleteModal()
  }

  if (!isMasterLevel1) return <Navigate to="/dashboard" replace />

  const handleOpenNew = () => {
    setBmId('')
    setToken('')
    setBmNome('')
    setBmStatus('')
    setValidationStatus('idle')
    setAccounts([])
    setAccountsError('')
    setPhonesByAccount({})
    setSelectedAccountId(null)
    setPhonesError('')
    setIsEditing(false)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setIsEditing(false)
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Configuração da BM</h2>
              <div className="opacity-75 small">Gerencie integrações e APIs do BM para organizar disparos com segurança e rastreabilidade.</div>
            </div>
          </div>
        </div>

        <div className="row g-3 mb-4 align-items-stretch">
          <div className="col-12 col-lg-6">
            <div className="neo-card neo-lg p-3 h-100">
              <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-2">
                <div>
                  <div className="fw-semibold">Status BM</div>
                  {countersUpdatedAt && <div className="small opacity-75">Atualizado: {countersUpdatedAt}</div>}
                </div>
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm d-flex align-items-center gap-2"
                  onClick={() => refreshCounters()}
                  disabled={bmRowsLoading || countersLoading}
                >
                  {countersLoading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : <FiRefreshCw />}
                  Atualizar
                </button>
              </div>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: '#22c55e' }} aria-hidden />
                    <span>Verificado</span>
                  </span>
                  <span className="fw-bold fs-5">{counters.bm.verified}</span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: '#D47B04' }} aria-hidden />
                    <span>Não verificado</span>
                  </span>
                  <span className="fw-bold fs-5">{counters.bm.naoVerificado}</span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="opacity-75">Total</span>
                  <span className="fw-bold fs-5">{counters.bm.total}</span>
                </div>
              </div>
              {countersError && <div className="text-danger small mt-2">{countersError}</div>}
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="neo-card neo-lg p-3 h-100">
              <div className="fw-semibold mb-2">Status dos telefones</div>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: '#22c55e' }} aria-hidden />
                    <span>Conectados</span>
                  </span>
                  <span className="fw-bold fs-5">{counters.phones.connected}</span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: '#ef4444' }} aria-hidden />
                    <span>Banidos</span>
                  </span>
                  <span className="fw-bold fs-5">{counters.phones.banned}</span>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="opacity-75">Total</span>
                  <span className="fw-bold fs-5">{counters.phones.total}</span>
                </div>
              </div>
              <div className="small opacity-75 mt-2">Usa o Graph API e considera todos os canais salvos.</div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="mb-1">Configuração BM</h5>
              <div className="small opacity-75">Gerencie credenciais e status das APIs do BM usadas nos disparos.</div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenNew}>
              Adicionar
            </button>
          </div>
          {showSavedBms && (
            <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch align-items-md-center mb-3">
              <div className="input-group input-group-sm" style={{ maxWidth: 520 }}>
                <span className="input-group-text">Pesquisar</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Filtrar por Nome BM..."
                  value={bmSearch}
                  onChange={(e) => setBmSearch(e.target.value)}
                  aria-label="Filtrar por Nome BM"
                />
                {bmSearchClean && (
                  <button type="button" className="btn btn-outline-light" onClick={() => setBmSearch('')}>
                    Limpar
                  </button>
                )}
              </div>
              <div className="input-group input-group-sm" style={{ maxWidth: 300 }}>
                <span className="input-group-text">Status</span>
                <select className="form-select" value={bmStatusFilter} onChange={(e) => setBmStatusFilter(e.target.value)} aria-label="Filtrar por status">
                  <option value="">Todos</option>
                  <option value="verified">Verificado</option>
                  <option value="nao_verificado">Não verificado</option>
                </select>
              </div>
            </div>
          )}
          <p className="mb-0 opacity-75">
            Cadastre uma BM para validar tokens, acompanhar status de verificação e habilitar os fluxos de disparo.
          </p>
        </div>

        {showSavedBms && (
        <div className="neo-card neo-lg p-4 mt-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="mb-1">BMs salvas</h5>
              <div className="small opacity-75">Dados retornados do webhook.</div>
            </div>
            {bmRowsError && <div className="text-danger small text-end">{bmRowsError}</div>}
          </div>
          <div className="table-responsive">
            <table className="table table-dark table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th className="d-none d-lg-table-cell" style={{ width: '25%' }}>Data/Hora</th>
                  <th className="d-none d-lg-table-cell" style={{ width: '20%' }}>ID</th>
                  <th style={{ width: '30%' }}>Nome BM</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '10%' }} aria-label="Ações">Ações</th>
                </tr>
              </thead>
              <tbody>
                {bmRowsLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx}>
                      <td><span className="placeholder col-8" /></td>
                      <td><span className="placeholder col-6" /></td>
                      <td><span className="placeholder col-9" /></td>
                      <td><span className="placeholder col-5" /></td>
                      <td><span className="placeholder col-6" /></td>
                    </tr>
                  ))
                ) : filteredBmRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="small">{bmRows.length === 0 ? 'Nenhuma BM salva.' : 'Nenhuma BM encontrada para a pesquisa.'}</td>
                  </tr>
                ) : (
                  filteredBmRows.map((row) => {
                    const statusInfo = mapStatus(row?.bm_statusPortifolio)
                    return (
                      <tr key={row.bm_id}>
                        <td className="small text-nowrap d-none d-lg-table-cell">{formatIsoToBR(row.canal_data)}</td>
                        <td className="small text-nowrap d-none d-lg-table-cell">{row.bm_id || '-'}</td>
                        <td className="small">
                          <div className="text-break">{row.bm_nome || '-'}</div>
                          <div className="d-lg-none small opacity-75 text-break">ID: {row.bm_id || '-'}</div>
                          <div className="d-lg-none small opacity-75 text-break">Data: {formatIsoToBR(row.canal_data)}</div>
                        </td>
                        <td className="small">
                          <span className="d-inline-flex align-items-center gap-2">
                            <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: statusInfo.color }} aria-hidden />
                            <span>{statusInfo.label}</span>
                          </span>
                        </td>
                        <td className="small">
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-icon btn-outline-light"
                              title={row?.bm_token ? 'Atualizar' : 'Sem token para atualizar'}
                              onClick={() => handleEditRow(row)}
                              disabled={!row?.bm_token}
                            >
                              <FiRefreshCw />
                            </button>
                            <button
                              type="button"
                              className="btn btn-icon btn-outline-danger"
                              title={deletingBmId ? 'Aguarde...' : row?.bm_token ? 'Excluir' : 'Sem token para excluir'}
                              onClick={() => openDeleteModal(row)}
                              disabled={Boolean(deletingBmId) || !row?.bm_token}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {modalOpen && (
          <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1800 }} aria-modal="true" role="dialog">
            <div
              className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-md-down"
              style={{ '--bs-modal-width': 'min(98vw, 2200px)' }}
            >
              <div className="modal-content modal-dark">
                <div className="modal-header">
                  <h5 className="modal-title">{isEditing ? 'Atualizar BM' : 'Adicionar BM'}</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setModalOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3 align-items-end mb-4">
                    <div className="col-12 col-md-4">
                      <label className="form-label">ID BM</label>
                      <input
                        type="text"
                        className="form-control"
                        value={bmId}
                        onChange={(e) => setBmId(e.target.value)}
                        placeholder="Digite o ID da BM"
                      />
                    </div>
                    <div className={tokenColClass}>
                      <label className="form-label">Token</label>
                      <input
                        type="text"
                        className="form-control"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Cole o token"
                      />
                    </div>
                    {!isEditing && (
                      <div className="col-12 col-md-2">
                        <label className="form-label d-block">Validar</label>
                        <button
                          type="button"
                          className={`btn w-100 ${validationStatus === 'success' ? 'btn-success' : validationStatus === 'error' ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleValidate()}
                          disabled={validating}
                          title="Validar BM"
                        >
                          {validationStatus === 'success' && <FiCheckCircle />}
                          {validationStatus === 'error' && <FiXCircle />}
                          {validationStatus === 'idle' && <FiClock />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Nome BM</label>
                      <input type="text" className="form-control" value={bmNome} readOnly placeholder="-" />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Status Portfólio</label>
                      {(() => {
                        const { label, color } = mapStatus(bmStatus)
                        return (
                          <div className="d-flex align-items-center gap-2 form-control bg-transparent text-light" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                            <span
                              className="rounded-circle"
                              style={{ width: 10, height: 10, display: 'inline-block', backgroundColor: color }}
                              aria-hidden
                            />
                            <span>{label}</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="row g-4">
                      <div className={`col-12 ${selectedAccountId ? 'col-lg-7' : 'col-lg-12'}`}>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div>
                            <div className="fw-semibold">Canais vinculados (WhatsApp)</div>
                            <div className="small opacity-75">Carregado após validação da BM.</div>
                          </div>
                          {accountsError && <div className="text-danger small">{accountsError}</div>}
                        </div>
                        <div className="table-responsive">
                          <table className="table table-dark table-sm align-middle mb-0" style={{ tableLayout: 'auto', minWidth: '100%' }}>
                            <thead>
                              <tr>
                                <th className="d-none d-lg-table-cell" style={{ width: '28%' }}>Data</th>
                                <th style={{ width: '42%' }}>Canais</th>
                                <th className="d-none d-lg-table-cell" style={{ width: '20%' }}>Canal ID</th>
                                <th style={{ width: '10%' }} aria-label="Ações" />
                              </tr>
                            </thead>
                            <tbody>
                              {accountsLoading ? (
                                Array.from({ length: 3 }).map((_, idx) => (
                                  <tr key={idx}>
                                    <td><span className="placeholder col-6" /></td>
                                    <td><span className="placeholder col-8" /></td>
                                    <td><span className="placeholder col-6" /></td>
                                    <td><span className="placeholder col-4" /></td>
                                  </tr>
                                ))
                              ) : accounts.length > 0 ? (
                                accounts.map((acc) => (
                                  <tr key={acc.id}>
                                    <td className="small text-nowrap d-none d-lg-table-cell">{formatUnixToBR(acc.creation_time)}</td>
                                    <td className="small">
                                      <div className="text-break">{acc.name || '-'}</div>
                                      <div className="d-lg-none small opacity-75 text-break">ID: {acc.id || '-'}</div>
                                      <div className="d-lg-none small opacity-75 text-break">Data: {formatUnixToBR(acc.creation_time)}</div>
                                    </td>
                                    <td className="small d-none d-lg-table-cell">{acc.id || '-'}</td>
                                    <td className="small text-center">
                                      <button
                                        type="button"
                                        className={`btn btn-icon ${selectedAccountId === acc.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => {
                                          if (selectedAccountId === acc.id) {
                                            setSelectedAccountId(null)
                                            return
                                          }
                                          fetchPhones(acc.id, token)
                                        }}
                                        disabled={phonesLoading === acc.id}
                                        title={selectedAccountId === acc.id ? 'Fechar detalhes' : 'Buscar telefones'}
                                      >
                                        {phonesLoading === acc.id ? (
                                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        ) : (
                                          selectedAccountId === acc.id ? <FiChevronsLeft /> : <FiChevronsRight />
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="small">Nenhum canal encontrado.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {selectedAccountId && (
                        <div className="col-12 col-lg-5">
                          <div className="neo-card p-3 h-100">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <div>
                                <div className="fw-semibold">Telefones do canal</div>
                                <div className="small opacity-75">{'Clique em "<" para fechar.'}</div>
                              </div>
                              {phonesError && <div className="text-danger small text-end">{phonesError}</div>}
                            </div>

                          <div className="table-responsive">
                            <table className="table table-dark table-sm align-middle mb-0" style={{ tableLayout: 'auto', minWidth: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '40%' }}>Telefone</th>
                                  <th style={{ width: '15%' }}>Status</th>
                                  <th className="d-none d-lg-table-cell" style={{ width: '30%' }}>Telefone ID</th>
                                  <th style={{ width: '15%' }}>Qualidade</th>
                                  <th style={{ width: '15%' }}>Limite</th>
                                </tr>
                              </thead>
                                <tbody>
                                  {phonesLoading && (
                                    <tr>
                                      <td colSpan={5} className="text-center">
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                      </td>
                                    </tr>
                                  )}
                                  {!phonesLoading && selectedPhones.length > 0 && selectedPhones.map((ph) => (
                                    <tr key={ph.id}>
                                      <td className="small">
                                        <button
                                          type="button"
                                          className="btn btn-link text-decoration-none p-0 text-light text-nowrap"
                                          onClick={() => fetchTemplatesForPhone(ph, selectedAccountId)}
                                          title="Ver modelos de mensagem deste telefone"
                                        >
                                          {ph.display_phone_number || '-'}
                                        </button>
                                        <div className="d-lg-none small opacity-75 text-break">ID: {ph.id || '-'}</div>
                                      </td>
                                      <td className="small text-nowrap">
                                        {(() => {
                                          const { label, color } = mapPhoneStatus(ph.status)
                                          return (
                                            <span className="d-inline-flex align-items-center gap-2">
                                              <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: color }} aria-hidden />
                                              <span>{label}</span>
                                            </span>
                                          )
                                        })()}
                                      </td>
                                      <td className="small text-nowrap d-none d-lg-table-cell">{ph.id || '-'}</td>
                                      <td className="small text-nowrap">
                                        {(() => {
                                          const { label, color } = mapQuality(ph.quality_rating)
                                          return (
                                            <span className="d-inline-flex align-items-center gap-2">
                                              <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: color }} aria-hidden />
                                              <span>{label}</span>
                                            </span>
                                          )
                                        })()}
                                      </td>
                                      <td className="small text-nowrap">{formatLimit(ph.messaging_limit_tier)}</td>
                                    </tr>
                                  ))}
                                  {!phonesLoading && selectedPhones.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="small">Nenhum telefone carregado.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </div>
                <div className="modal-footer">
                {!isEditing && (
                  <button type="button" className="btn btn-primary me-2" onClick={() => handleSave()} disabled={saving || validating || accountsLoading}>
                    {saving ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
                    Salvar
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={validating}>
                  Fechar
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {templatesModalOpen && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 2000 }} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-md-down" style={{ '--bs-modal-width': 'min(96vw, 820px)' }}>
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title">Modelos de mensagem</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setTemplatesModalOpen(false)}></button>
              </div>
              <div className="modal-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <div className="small opacity-75">Telefone</div>
                    <div className="fw-semibold">{selectedPhone?.display_phone_number || '-'}</div>
                    <div className="small opacity-75">ID: {selectedPhone?.id || '-'}</div>
                  </div>
                  {templatesError && <div className="text-danger small text-end">{templatesError}</div>}
                </div>

                {templatesLoading ? (
                  <div className="text-center py-4">
                    <span className="spinner-border" role="status" aria-hidden="true"></span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="small">Nenhum modelo encontrado para este telefone.</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {templates.map((tpl) => {
                      const body = (tpl.components || []).find((comp) => String(comp?.type).toUpperCase() === 'BODY')
                      return (
                        <div key={tpl.id} className="neo-card p-3">
                          <div className="d-flex flex-wrap gap-3 align-items-center mb-2">
                            <div>
                              <div className="small opacity-75">Nome Modelo</div>
                              <div className="fw-semibold">{tpl.name || '-'}</div>
                            </div>
                            <div>
                              <div className="small opacity-75">Linguagem</div>
                              <div className="fw-semibold">{tpl.language || '-'}</div>
                            </div>
                            <div>
                              <div className="small opacity-75">Status</div>
                              {(() => {
                                const { label, color } = mapTemplateStatus(tpl.status)
                                return (
                                  <span className="d-inline-flex align-items-center gap-2 fw-semibold">
                                    <span className="rounded-circle" style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: color }} aria-hidden />
                                    <span>{label}</span>
                                  </span>
                                )
                              })()}
                            </div>
                            <div>
                              <div className="small opacity-75">Categoria</div>
                              <div className="fw-semibold">{mapTemplateCategory(tpl.category)}</div>
                            </div>
                          </div>
                          <div className="mt-2 pt-1 border-top border-secondary-subtle">
                            <div className="small opacity-75 mb-1">Mensagem</div>
                            <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{body?.text || '-'}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTemplatesModalOpen(false)} disabled={templatesLoading}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.65)', position: 'fixed', inset: 0, zIndex: 1800 }} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-md-down" style={{ '--bs-modal-width': 'min(96vw, 560px)' }}>
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar exclus\u00e3o</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeDeleteModal} disabled={Boolean(deletingBmId)}></button>
              </div>
              <div className="modal-body">
                <div className="small opacity-75 mb-3">
                  Voc\u00ea tem certeza que deseja excluir esta BM? Esta a\u00e7\u00e3o enviar\u00e1 os dados para o webhook.
                </div>
                <div className="neo-card p-3">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <div className="small opacity-75">ID</div>
                      <div className="fw-semibold text-break">{deleteRow?.bm_id || '-'}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="small opacity-75">Status</div>
                      <div className="fw-semibold text-break">{deleteRow?.bm_statusPortifolio || '-'}</div>
                    </div>
                    <div className="col-12">
                      <div className="small opacity-75">Nome BM</div>
                      <div className="fw-semibold text-break">{deleteRow?.bm_nome || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeDeleteModal} disabled={Boolean(deletingBmId)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm} disabled={Boolean(deletingBmId)}>
                  {deletingBmId ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
