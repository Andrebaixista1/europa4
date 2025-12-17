import React, { useState, useEffect } from 'react'
import { Upload, MessageSquare, FileText, Send, Download, ArrowLeft, Settings, ChevronDown, ChevronRight, Plus, Check, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

const DEFAULT_BATCH_SIZE = 100

const getDefaultDateTime = () => {
  const now = new Date()
  const saoPauloTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const year = saoPauloTime.getFullYear()
  const month = String(saoPauloTime.getMonth() + 1).padStart(2, '0')
  const day = String(saoPauloTime.getDate()).padStart(2, '0')
  const hours = String(saoPauloTime.getHours()).padStart(2, '0')
  const minutes = String(saoPauloTime.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function MultiploDisparos() {
  const [csvFile, setCsvFile] = useState(null)
  const [csvData, setCsvData] = useState([])
  const [csvError, setCsvError] = useState('')
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [channels, setChannels] = useState([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState([])
  const [channelTemplates, setChannelTemplates] = useState({})
  const [selectedTemplates, setSelectedTemplates] = useState({})
  const [expandedChannels, setExpandedChannels] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    scheduledDateTime: '',
    intervalMin: 15,
    intervalMax: 30
  })
  const [toast, setToast] = useState({ show: false, message: '', bg: 'success' })
  const [channelBatchSizes, setChannelBatchSizes] = useState({})
  const [filterBmNome, setFilterBmNome] = useState('')
  const [filterStatusApi, setFilterStatusApi] = useState('')
  const [filterQualidadeApi, setFilterQualidadeApi] = useState('')

  const notify = (message, type = 'success') => {
    const bg = type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'danger'
    setToast({ show: true, message, bg })
  }

  const formatDateTimeForSaoPaulo = (value) => {
    if (!value) return ''
    const d = new Date(value)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d)
    const get = (t) => parts.find(p => p.type === t)?.value || ''
    const y = get('year')
    const m = get('month')
    const day = get('day')
    const hh = get('hour')
    const mm = get('minute')
    return `${y}-${m}-${day} ${hh}:${mm}`
  }

  const formatPhoneNumberBR = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''

    if (digits.startsWith('55') && digits.length >= 12) {
      const rest = digits.slice(2)
      const ddd = rest.slice(0, 2)
      const number = rest.slice(2)
      if (number.length === 9) return `+55 ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`
      if (number.length === 8) return `+55 ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`
      return `+55 ${ddd} ${number}`.trim()
    }

    if (digits.length === 11) return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`
    if (digits.length === 10) return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`

    return digits.startsWith('+') ? digits : `+${digits}`
  }

  const getLast4Digits = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    return digits.length >= 4 ? digits.slice(-4) : ''
  }

  const derivePhoneStatus = (row) => {
    const explicit = row?.telefone_status || row?.telefoneStatus || row?.status || ''
    if (explicit) return String(explicit)

    const limitRaw = row?.telefone_limite
    const limit = Number.parseInt(String(limitRaw ?? ''), 10)
    if (Number.isFinite(limit) && limit > 0) return 'CONNECTED'
    return 'PENDING'
  }

  const computePhoneLabel = (rawPhone, fallbackId) => {
    const digits = String(rawPhone || '').replace(/\D/g, '')
    const last4 = digits ? digits.slice(-4) : String(fallbackId || '').slice(-4)
    return last4 ? `Final Fone ${last4}` : 'Final Fone'
  }

  const getQualityRank = (rating) => {
    switch (String(rating || '').trim().toLowerCase()) {
      case 'green':
      case 'high':
        return 0
      case 'yellow':
      case 'orange':
      case 'medium':
        return 1
      case 'red':
      case 'low':
        return 2
      default:
        return 3
    }
  }

  const mapPhoneStatusApi = (value) => {
    const v = String(value || '').trim().toUpperCase()
    if (v === 'CONNECTED') return { label: 'Conectado', color: '#22c55e' }
    if (v === 'BANNED') return { label: 'Banido', color: '#ef4444' }
    if (v === 'PENDING') return { label: 'Não verificado', color: '#ffc107' }
    if (v === 'DISCONNECTED') return { label: 'Desconectado', color: '#ef4444' }
    if (v === 'CONNECTING') return { label: 'Conectando', color: '#f59e0b' }
    if (!v) return { label: '-', color: '#6c757d' }
    return { label: v, color: '#6c757d' }
  }

  const mapQualityApi = (value) => {
    const v = String(value || '').trim().toUpperCase()
    if (v === 'GREEN' || v === 'HIGH') return { label: 'Boa', color: '#22c55e' }
    if (v === 'RED' || v === 'LOW') return { label: 'Ruim', color: '#ef4444' }
    if (v === 'YELLOW' || v === 'ORANGE' || v === 'MEDIUM') return { label: 'Média', color: '#ffc107' }
    if (v === 'UNKNOWN') return { label: 'Sem status', color: '#6c757d' }
    if (!v) return { label: '-', color: '#6c757d' }
    return { label: v, color: '#6c757d' }
  }

  const normalizeApiCode = (value) => String(value || '').trim().toUpperCase()

  const channelMatchesFilters = (channel) => {
    const bmNome = String(channel?.graph_verified_name || '').trim()
    const status = normalizeApiCode(channel?.graph_status || channel?.status)
    const quality = normalizeApiCode(channel?.graph_quality_rating || channel?.quality_rating)
    if (filterBmNome && bmNome !== filterBmNome) return false
    if (filterStatusApi && status !== filterStatusApi) return false
    if (filterQualidadeApi && quality !== filterQualidadeApi) return false
    return true
  }

  const fetchGraphPhoneInfoByToken = async (phoneIdsByToken) => {
    const entries = Array.from(phoneIdsByToken.entries())
    if (entries.length === 0) return new Map()

    const out = new Map()
    const chunkIds = (ids, size) => {
      const arr = Array.isArray(ids) ? ids : []
      const chunkSize = Math.max(1, Number(size) || 1)
      const chunks = []
      for (let i = 0; i < arr.length; i += chunkSize) chunks.push(arr.slice(i, i + chunkSize))
      return chunks
    }

    const concurrency = 3
    for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency)
      const results = await Promise.allSettled(
        batch.map(async ([token, idsSet]) => {
          const tokenClean = String(token || '').trim()
          if (!tokenClean || tokenClean === '-') return

          const ids = Array.from(idsSet || []).filter(Boolean)
          for (const chunk of chunkIds(ids, 50)) {
            const params = new URLSearchParams({
              ids: chunk.join(','),
              fields:
                'id,display_phone_number,verified_name,status,quality_rating,health_status,code_verification_status,account_mode',
              access_token: tokenClean
            })
            const url = `https://graph.facebook.com/v24.0/?${params.toString()}`
            const res = await fetch(url, { method: 'GET' })
            const raw = await res.text().catch(() => '')
            if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)

            const parsed = raw ? JSON.parse(raw) : {}
            if (parsed?.error) throw new Error(parsed.error?.message || 'Erro ao buscar status do Graph API.')

            chunk.forEach((id) => {
              const row = parsed?.[id]
              if (row) out.set(String(id), row)
            })
          }
        })
      )

      results.forEach((r) => {
        if (r.status === 'rejected') console.warn('Falha ao buscar status no Graph API:', r.reason)
      })
    }

    return out
  }

  const fetchChannels = async () => {
    setLoadingChannels(true)
    try {
      const response = await fetch('https://n8n.apivieiracred.store/webhook/bm-get', { method: 'GET' })
      const raw = await response.text().catch(() => '')
      if (!response.ok) throw new Error(raw || response.statusText || `HTTP ${response.status}`)

      const parsed = raw ? JSON.parse(raw) : []
      const rows = Array.isArray(parsed) ? parsed : []

      const phoneMap = new Map()
      const templatesByPhone = new Map()
      const phoneIdsByToken = new Map()

      rows.forEach((item) => {
        const phoneId = item?.telefone_id
        if (!phoneId) return
        const token = String(item?.bm_token || item?.token || '').trim()
        if (token && token !== '-') {
          const currentSet = phoneIdsByToken.get(token) || new Set()
          currentSet.add(String(phoneId))
          phoneIdsByToken.set(token, currentSet)
        }

        const phoneDigits = String(item?.telefone_numero || '').replace(/\D/g, '')
        const displayPhone = formatPhoneNumberBR(phoneDigits) || formatPhoneNumberBR(String(item?.display_phone_number || ''))
        const label = computePhoneLabel(phoneDigits, phoneId)
        const status = derivePhoneStatus(item)
        const quality = item?.telefone_qualidade || item?.quality_rating || 'UNKNOWN'

        if (!phoneMap.has(String(phoneId))) {
          phoneMap.set(String(phoneId), {
            record_id: String(phoneId),
            phone_id: String(phoneId),
            label,
            display_phone_number: displayPhone || (phoneDigits ? `+${phoneDigits}` : ''),
            phone_number_raw: phoneDigits,
            status: String(status || ''),
            quality_rating: String(quality || 'UNKNOWN'),
          })
        }

        const templateName = item?.modelo_nome
        if (!templateName) return

        const templateLanguage = item?.modelo_linguagem || ''
        const templateKey = `${String(templateName)}::${String(templateLanguage)}`
        const current = templatesByPhone.get(String(phoneId)) || new Map()
        if (!current.has(templateKey)) {
          current.set(templateKey, {
            record_id: `${String(phoneId)}::${templateKey}`,
            name: String(templateName),
            language: String(templateLanguage),
            status: String(item?.modelo_status || ''),
            category: String(item?.modelo_categoria || ''),
            message: String(item?.modelo_mensagem || item?.modelo_menssagem || ''),
          })
        }
        templatesByPhone.set(String(phoneId), current)
      })

      let list = Array.from(phoneMap.values())

      try {
        const graphInfoByPhoneId = await fetchGraphPhoneInfoByToken(phoneIdsByToken)
        if (graphInfoByPhoneId.size > 0) {
          list = list.map((row) => {
            const info = graphInfoByPhoneId.get(String(row?.record_id || row?.phone_id || ''))
            if (!info) return row
            return {
              ...row,
              graph_verified_name: info.verified_name,
              graph_status: info.status,
              graph_quality_rating: info.quality_rating
            }
          })
        }
      } catch (err) {
        console.warn('Falha ao buscar status/qualidade no Graph API:', err)
      }

      list.sort((a, b) => {
        const qualityDiff =
          getQualityRank(a.graph_quality_rating || a.quality_rating) -
          getQualityRank(b.graph_quality_rating || b.quality_rating)
        if (qualityDiff !== 0) return qualityDiff

        const aKey = a.phone_number_raw || a.display_phone_number || ''
        const bKey = b.phone_number_raw || b.display_phone_number || ''
        return String(aKey).localeCompare(String(bKey))
      })

      const templatesObj = {}
      templatesByPhone.forEach((map, phoneId) => {
        templatesObj[phoneId] = Array.from(map.values())
      })

      const selectedIds = new Set(selectedChannels.map((c) => String(c?.record_id)))
      const refreshedSelected = selectedIds.size > 0 ? list.filter((c) => selectedIds.has(String(c.record_id))) : []

      setChannels(list)
      setChannelTemplates(templatesObj)
      if (selectedIds.size > 0) setSelectedChannels(refreshedSelected)
    } catch (error) {
      console.error('Erro ao carregar dados do bm-get:', error)
      setChannels(mockChannels)
      setChannelTemplates({})
    } finally {
      setLoadingChannels(false)
    }
  }

  const toggleSelectAllChannels = (checked) => {
    if (checked) {
      const channelsToSelect = channels.filter(channelMatchesFilters)
      if (channelsToSelect.length === 0) return

      const selectedMap = new Map(selectedChannels.map((c) => [String(c?.record_id), c]))
      channelsToSelect.forEach((channel) => selectedMap.set(String(channel.record_id), channel))
      setSelectedChannels(Array.from(selectedMap.values()))
      setChannelBatchSizes(prev => {
        const updated = { ...prev }
        channelsToSelect.forEach(channel => {
          if (updated[channel.record_id] === undefined) {
            updated[channel.record_id] = String(DEFAULT_BATCH_SIZE)
          }
        })
        return updated
      })
    } else {
      const hasFilters = Boolean(filterBmNome || filterStatusApi || filterQualidadeApi)
      if (!hasFilters) {
        setSelectedChannels([])
        setSelectedTemplates({})
        setExpandedChannels(new Set())
        setChannelBatchSizes({})
        return
      }

      const channelsToClear = channels.filter(channelMatchesFilters)
      if (channelsToClear.length === 0) return
      const idsToClear = new Set(channelsToClear.map((channel) => String(channel.record_id)))

      setSelectedChannels((prev) => prev.filter((channel) => !idsToClear.has(String(channel.record_id))))
      setSelectedTemplates((prev) => {
        const next = { ...prev }
        idsToClear.forEach((id) => {
          delete next[id]
        })
        return next
      })
      setExpandedChannels((prev) => {
        const next = new Set(prev)
        idsToClear.forEach((id) => next.delete(id))
        return next
      })
      setChannelBatchSizes((prev) => {
        const next = { ...prev }
        idsToClear.forEach((id) => {
          delete next[id]
        })
        return next
      })
    }
  }

  const toggleChannelSelection = async (channel) => {
    const channelId = channel.record_id
    const isSelected = selectedChannels.find(c => c.record_id === channelId)
    
    if (isSelected) {
      setSelectedChannels(prev => prev.filter(c => c.record_id !== channelId))
      setSelectedTemplates(prev => {
        const newSelected = { ...prev }
        delete newSelected[channelId]
        return newSelected
      })
      setExpandedChannels(prev => {
        const newExpanded = new Set(prev)
        newExpanded.delete(channelId)
        return newExpanded
      })
      setChannelBatchSizes(prev => {
        const updated = { ...prev }
        delete updated[channelId]
        return updated
      })
    } else {
      setSelectedChannels(prev => [...prev, channel])
      setChannelBatchSizes(prev => {
        if (prev[channelId] !== undefined) {
          return prev
        }
        return { ...prev, [channelId]: String(DEFAULT_BATCH_SIZE) }
      })
    }
  }

  const toggleChannelExpansion = async (channelId) => {
    setExpandedChannels(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(channelId)) {
        newExpanded.delete(channelId)
      } else {
        newExpanded.add(channelId)
      }
      return newExpanded
    })
  }

  const selectTemplate = (channelId, template) => {
    setSelectedTemplates(prev => ({
      ...prev,
      [channelId]: template
    }))
  }

  const openChannelModal = () => {
    setShowChannelModal(true)
    if (channels.length === 0) {
      fetchChannels()
    }
  }

  const closeChannelModal = () => {
    setShowChannelModal(false)
  }

  const getStatusText = (status) => {
    const normalized = String(status || '').trim().toLowerCase()
    switch (normalized) {
      case 'connected':
        return 'Conectado'
      case 'pending':
        return 'Pendente'
      case 'flagged':
        return 'Sinalizado'
      case 'disconnected':
        return 'Desconectado'
      case 'connecting':
        return 'Conectando'
      case 'failed':
        return 'Falha'
      default:
        return status ? String(status) : 'Indefinido'
    }
  }

  const getStatusBadgeClass = (status) => {
    switch (String(status || '').trim().toLowerCase()) {
      case 'connected':
        return 'status-badge status-connected'
      case 'pending':
      case 'connecting':
        return 'status-badge status-pending'
      case 'flagged':
        return 'status-badge status-flagged'
      case 'disconnected':
      case 'failed':
        return 'status-badge status-error'
      default:
        return 'status-badge status-undefined'
    }
  }

  const getTemplateStatusText = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved':
        return 'Aprovado'
      case 'pending':
        return 'Pendente'
      case 'rejected':
        return 'Rejeitado'
      case 'disabled':
        return 'Desabilitado'
      default:
        return 'Indefinido'
    }
  }

  const getTemplateStatusBadgeClass = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved':
        return 'status-badge status-success'
      case 'pending':
        return 'status-badge status-pending'
      case 'rejected':
        return 'status-badge status-error'
      case 'disabled':
        return 'status-badge status-undefined'
      default:
        return 'status-badge status-undefined'
    }
  }

  const getTemplateCategoryText = (category) => {
    switch(category?.toLowerCase()) {
      case 'marketing':
        return 'Marketing'
      case 'utility':
        return 'Utilidade'
      case 'authentication':
        return 'Autenticação'
      case 'transactional':
        return 'Transacional'
      case 'promotional':
        return 'Promocional'
      case 'informational':
        return 'Informativo'
      default:
        return category || 'Indefinido'
    }
  }

  const getTemplateCategoryBadgeClass = (category) => {
    switch(category?.toLowerCase()) {
      case 'marketing':
      case 'promotional':
        return 'status-badge status-pending'
      case 'utility':
      case 'transactional':
        return 'status-badge status-success'
      case 'authentication':
        return 'status-badge status-error'
      case 'informational':
        return 'status-badge status-connected'
      default:
        return 'status-badge status-undefined'
    }
  }

  const getQualityText = (rating) => {
    switch(rating?.toLowerCase()) {
      case 'green': return 'Alta'
      case 'yellow':
      case 'orange': return 'Média'
      case 'red': return 'Baixa'
      default: return 'Média'
    }
  }

  const getQualityColor = (rating) => {
    switch(rating?.toLowerCase()) {
      case 'green': return '#28a745'
      case 'yellow':
      case 'orange': return '#ffc107'
      case 'red': return '#dc3545'
      default: return '#ffc107'
    }
  }

  const mockChannels = [
    { 
      record_id: 1, 
      account_name: 'Consai Atendimentos', 
      display_phone_number: '+55 11 95174-8813',
      status: 'Connected',
      quality_rating: 'green',
      id_account: 'consai123'
    },
    { 
      record_id: 2, 
      account_name: 'Marketing Digital', 
      display_phone_number: '+55 11 94832-7651',
      status: 'Connected', 
      quality_rating: 'yellow',
      id_account: 'marketing456'
    },
    { 
      record_id: 3, 
      account_name: 'Suporte Técnico', 
      display_phone_number: '+55 11 93721-9504',
      status: 'Flagged',
      quality_rating: 'red',
      id_account: 'suporte789'
    }
  ]

  const mockTemplates = [
    { record_id: 1, name: 'Template Marketing', category: 'Marketing', status: 'approved' },
    { record_id: 2, name: 'Template Suporte', category: 'Utility', status: 'approved' }
  ]

  useEffect(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 10)
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const defaultDateTime = `${year}-${month}-${day}T${hours}:${minutes}`
    
    setFormData(prev => ({
      ...prev,
      scheduledDateTime: defaultDateTime
    }))
  }, [])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setCsvError('')
    setCsvData([])
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Por favor, selecione um arquivo CSV válido')
      return
    }
    
    setCsvFile(file)
    
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        throw new Error('Arquivo CSV vazio')
      }
      
      const data = lines.slice(1).map(line => {
        const values = line.split(';')
        return {
          name: values[0]?.trim() || '',
          phone: values[1]?.trim() || '',
          email: values[2]?.trim() || ''
        }
      }).filter(row => row.phone)
      
      setCsvData(data)
      notify(`${data.length} contatos válidos carregados`, 'success')
    } catch (error) {
      setCsvError(error.message || 'Erro ao processar arquivo CSV')
      setCsvFile(null)
      setCsvData([])
    }
  }

  const generateSampleCsv = () => {
    const csvContent = 'name;phone;email\nJoão Silva;5511999999999;joao@email.com\nMaria Santos;5511888888888;maria@email.com'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'exemplo_multiplos_disparos.csv'
    link.click()
    notify('Arquivo de exemplo baixado', 'success')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const handleChannelBatchSizeChange = (channelId, rawValue) => {
    const digitsOnly = rawValue.replace(/[^0-9]/g, '')
    if (!digitsOnly) {
      setChannelBatchSizes(prev => ({ ...prev, [channelId]: '' }))
      return
    }

    const numeric = Math.min(Math.max(parseInt(digitsOnly, 10), 1), 1000)
    setChannelBatchSizes(prev => ({ ...prev, [channelId]: String(numeric) }))
  }

  const handleChannelBatchSizeBlur = (channelId) => {
    setChannelBatchSizes(prev => {
      const current = prev[channelId]
      if (current === undefined || current === '') {
        return { ...prev, [channelId]: String(DEFAULT_BATCH_SIZE) }
      }
      return prev
    })
  }

  const getChannelBatchSize = (channelId) => {
    const raw = channelBatchSizes[channelId]
    const parsed = parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('=== INICIANDO ENVIO DE MÚLTIPLOS DISPAROS EM ARRAY ===')
    setLoading(true)
    
    try {
      console.log('1. Preparando dados dos canais...')
      
      const channelsWithoutTemplate = selectedChannels.filter(channel => 
        !selectedTemplates[channel.record_id]
      )
      if (channelsWithoutTemplate.length > 0) {
        console.log('2. ERRO: Canais sem template:', channelsWithoutTemplate)
        notify(`Selecione templates para todos os canais. ${channelsWithoutTemplate.length} canal(is) sem template.`, 'error')
        setLoading(false)
        return
      }
      
      console.log('2. Preparando CSV reutilizável...')
      let csvFileToSend = csvFile
      try {
        if (csvData && csvData.length > 0) {
          const escape = (str) => String(str || '').replace(/"/g, '""')
          const header = 'name;phone;email'
          const rows = [header].concat(
            csvData.map(c => `${escape(c.name)};${escape(c.phone)};${escape(c.email ?? '')}`)
          )
          const BOM = '\uFEFF'
          const content = BOM + rows.join('\n')
          const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
          csvFileToSend = new File([blob], (csvFile?.name ? csvFile.name.replace(/\.csv$/i, '') : 'contatos') + '-utf8.csv', { type: 'text/csv' })
        }
      } catch (e) {
        console.warn('Falha ao reencodar CSV no cliente, usando arquivo original.', e)
      }
      
      console.log('3. Preparando array de canais...')
      
      const channels = selectedChannels.map(channel => {
        const template = selectedTemplates[channel.record_id]
        const batchSize = getChannelBatchSize(channel.record_id)
        
        return {
          channel: `${channel.label || channel.account_name || 'Final Fone'} - ${channel.display_phone_number || ''}`.trim(),
          phone_id: channel.phone_id || channel.record_id,
          display_phone_number: channel.display_phone_number,
          template: template.name,
          batchSize
        }
      })
      
      console.log('4. Array de canais preparado:', channels)
      
      const formData_upload = new FormData()
      formData_upload.append('name', formData.name)
      formData_upload.append('channels', JSON.stringify(channels))
      formData_upload.append('scheduledDateTime', formatDateTimeForSaoPaulo(formData.scheduledDateTime))
      formData_upload.append('intMin', String(formData.intervalMin))
      formData_upload.append('intMax', String(formData.intervalMax))
      formData_upload.append('mode', 'csv')
      formData_upload.append('contactCount', String(csvData.length))
      formData_upload.append('csvFile', csvFileToSend)
      
      console.log('5. FormData sendo enviado:')
      console.log('   - name:', formData.name)
      console.log('   - channels:', JSON.stringify(channels, null, 2))
      console.log('   - scheduledDateTime:', formatDateTimeForSaoPaulo(formData.scheduledDateTime))
      console.log('   - intervalos:', formData.intervalMin, 'a', formData.intervalMax)
      console.log('   - contactCount:', csvData.length)
      
      const response = await fetch('https://n8n.apivieiracred.store/webhook/multi-disparos', {
        method: 'POST',
        body: formData_upload
      })
      
      console.log('6. Resposta da API:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
      
      if (response.ok) {
        console.log('7. Status 200 - Processando resposta de sucesso...')
        let result
        try {
          const responseText = await response.text()
          console.log('8. Texto da resposta:', responseText)
          
          if (responseText.trim()) {
            result = JSON.parse(responseText)
            console.log('9. SUCCESS - Resposta da API (JSON):', result)
          } else {
            result = { success: true, message: 'Sucesso' }
            console.log('9. SUCCESS - Resposta vazia, assumindo sucesso')
          }
        } catch (parseError) {
          console.log('9. SUCCESS - Resposta não é JSON válido, mas status é 200:', parseError.message)
          result = { success: true, message: 'Sucesso' }
        }
        
        console.log('10. Definindo estados de sucesso...')
        setLoading(false)
        setShowSuccess(true)
        
        console.log('11. Exibindo toast de sucesso...')
        notify(`Múltiplos disparos criados com sucesso! ${channels.length} canal(is) processado(s).`, 'success')
        
        console.log('12. Resetando formulário...')
        setFormData({
          name: '',
          scheduledDateTime: '',
          intervalMin: 15,
          intervalMax: 30
        })
        setCsvFile(null)
        setCsvData([])
        setSelectedChannels([])
        setSelectedTemplates({})
        setChannelBatchSizes({})
        setShowChannelModal(false)
        
        console.log('13. Agendando refresh da página...')
        setTimeout(() => {
          console.log('14. Executando refresh da página...')
          window.location.href = window.location.href
        }, 2000)
        
        console.log('15. SUCESSO COMPLETO - FIM DO PROCESSAMENTO')
        return
        
      } else {
        console.log('16. Status não é 200 - Processando erro...')
        const errorText = await response.text()
        console.error('17. ERROR - Falha na API:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        })
        setLoading(false)
        notify('Erro ao enviar múltiplos disparos. Verifique os logs.', 'error')
      }
      
    } catch (error) {
      console.error('18. EXCEPTION GERAL:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      setLoading(false)
      
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        notify('Erro de conexão com a API. Verifique sua internet e tente novamente.', 'error')
      } else {
        notify('Erro inesperado durante o envio. Verifique os logs do console.', 'error')
      }
    } finally {
      console.log('19. FINALLY - Finalizando processo...')
      console.log('=== FIM DO PROCESSO DE ENVIO ===')
    }
  }

  const isFormValid = () => {
    const baseValid = formData.name && 
           formData.scheduledDateTime &&
           selectedChannels.length > 0 &&
           csvData.length > 0
           
    const hasAllTemplates = selectedChannels.every(channel => 
      selectedTemplates[channel.record_id]
    )
    
    return baseValid && hasAllTemplates
  }

  const filteredChannels = channels.filter(channelMatchesFilters)
  const selectedChannelIds = new Set(selectedChannels.map((c) => String(c?.record_id)))
  const selectedVisibleCount = filteredChannels.reduce(
    (acc, channel) => acc + (selectedChannelIds.has(String(channel.record_id)) ? 1 : 0),
    0
  )
  const allVisibleSelected = filteredChannels.length > 0 && selectedVisibleCount === filteredChannels.length

  const bmNomeOptions = Array.from(
    new Set(channels.map((c) => String(c?.graph_verified_name || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const statusApiOrder = ['CONNECTED', 'PENDING', 'BANNED', 'DISCONNECTED', 'CONNECTING']
  const statusApiOptions = Array.from(
    new Set(channels.map((c) => normalizeApiCode(c?.graph_status || c?.status)).filter(Boolean))
  ).sort((a, b) => {
    const ia = statusApiOrder.indexOf(a)
    const ib = statusApiOrder.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const qualidadeApiOptions = Array.from(
    new Set(channels.map((c) => normalizeApiCode(c?.graph_quality_rating || c?.quality_rating)).filter(Boolean))
  ).sort((a, b) => getQualityRank(a) - getQualityRank(b))

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2">
              <ArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Múltiplos Disparos</h2>
              <div className="opacity-75 small">Configure e agende múltiplos disparos em massa</div>
            </div>
          </div>
        </div>

        {showSuccess && (
          <div className="alert alert-success mb-4 d-flex align-items-center gap-2">
            <MessageSquare size={20} />
            Múltiplos disparos criados com sucesso! Eles serão executados na data e hora agendadas.
          </div>
        )}

        {toast.show && (
          <div 
            className={`position-fixed top-0 end-0 m-3 alert alert-${toast.bg} alert-dismissible fade show`}
            style={{ zIndex: 2000 }}
            role="alert"
          >
            {toast.message}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
            ></button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="neo-card neo-lg p-4 mb-3">
                <h5 className="mb-3 d-flex align-items-center gap-2">
                  <FileText size={20} />
                  Configuração do Disparo
                </h5>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small opacity-75">Nome da Campanha</label>
                    <input
                      type="text"
                      className="form-control"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Ex: Promoção Black Friday"
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small opacity-75">Canais e Templates</label>
                    <button
                      type="button"
                      className="form-control text-start d-flex align-items-center justify-content-between"
                      style={{ cursor: 'pointer' }}
                      onClick={openChannelModal}
                    >
                      <span>
                        {selectedChannels.length === 0 ? (
                          'Selecionar Canais e Templates'
                        ) : (
                          `${selectedChannels.length} canal(is) e ${Object.keys(selectedTemplates).length} template(s) selecionado(s)`
                        )}
                      </span>
                      <Settings size={18} />
                    </button>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small opacity-75">Data e Hora do Envio</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      name="scheduledDateTime"
                      value={formData.scheduledDateTime}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small opacity-75">Intervalo de Disparos (aleatório)</label>
                    <div className="mb-2">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span className="small" style={{ minWidth: '35px' }}>Mín:</span>
                        <input
                          type="range"
                          className="form-range flex-grow-1"
                          min="1"
                          max="60"
                          value={formData.intervalMin}
                          onChange={(e) => {
                            const newMin = parseInt(e.target.value)
                            setFormData(prev => ({
                              ...prev,
                              intervalMin: newMin,
                              intervalMax: Math.max(newMin, prev.intervalMax)
                            }))
                          }}
                        />
                        <span className="small fw-bold" style={{ minWidth: '35px' }}>{formData.intervalMin}s</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small" style={{ minWidth: '35px' }}>Máx:</span>
                        <input
                          type="range"
                          className="form-range flex-grow-1"
                          min="1"
                          max="60"
                          value={formData.intervalMax}
                          onChange={(e) => {
                            const newMax = parseInt(e.target.value)
                            setFormData(prev => ({
                              ...prev,
                              intervalMax: newMax,
                              intervalMin: Math.min(prev.intervalMin, newMax)
                            }))
                          }}
                        />
                        <span className="small fw-bold" style={{ minWidth: '35px' }}>{formData.intervalMax}s</span>
                      </div>
                    </div>
                    <div className="form-text small">
                      Faixa de tempo para enviar para o próximo contato (aleatório)
                    </div>
                  </div>
                </div>
              </div>

              <div className="neo-card neo-lg p-4 mb-3">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="mb-0 d-flex align-items-center gap-2">
                    <Upload size={20} />
                    Upload de Contatos (CSV)
                  </h5>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                    onClick={generateSampleCsv}
                  >
                    <Download size={14} />
                    Baixar Exemplo
                  </button>
                </div>

                <div className="alert alert-info mb-3">
                  <strong>Formato do arquivo CSV</strong>
                  <p className="mb-1 mt-2">O arquivo CSV deve conter as seguintes colunas (separadas por ponto e vírgula):</p>
                  <ul className="mb-0">
                    <li><strong>name</strong>: Nome do contato</li>
                    <li><strong>phone</strong>: Número do WhatsApp com DDD (ex: 5511999999999)</li>
                    <li><strong>email</strong>: Email do contato (opcional)</li>
                  </ul>
                </div>

                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label small opacity-75">Arquivo CSV</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".csv"
                      onChange={handleFileUpload}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small opacity-75">Quantidade por disparo</label>
                    <div className="p-3 border rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="small opacity-75">
                        Configure um valor por canal no resumo ao lado.
                      </div>
                    </div>
                  </div>
                </div>

                {csvError && (
                  <div className="alert alert-danger mt-3">
                    {csvError}
                  </div>
                )}

                {csvData.length > 0 && (
                  <>
                    {csvData.length > 10000 && (
                      <div className="alert alert-warning mt-3">
                        ⚠️ <strong>Arquivo muito grande!</strong><br />
                        Seu arquivo contém <strong>{csvData.length.toLocaleString('pt-BR')} contatos</strong>. 
                        Não é aconselhado usar arquivos tão grandes, pois o processamento pode levar 
                        <strong>mais tempo do que esperado</strong>. Considere dividir em arquivos menores.
                      </div>
                    )}
                    
                    <div className="alert alert-success mt-3">
                      <strong>Processamento concluído!</strong>
                      <div className="mt-2 small">
                        <div>{csvData.length} contatos válidos carregados</div>
                        {selectedChannels.length > 0 ? (
                          <div className="mt-2 p-2 bg-info bg-opacity-10 rounded">
                            <strong>Quantidades por canal:</strong>
                            <ul className="mb-0 ps-3">
                              {selectedChannels.map(channel => {
                                const channelId = channel.record_id
                                const configuredQuantity = getChannelBatchSize(channelId)
                                const availableContacts = csvData.length
                                const displayQuantity = configuredQuantity > availableContacts && availableContacts > 0
                                  ? `${availableContacts} contato(s) (limitado ao arquivo)`
                                  : `${configuredQuantity} contato(s)`
                                return (
                                  <li key={channelId}>
                                    {channel.label || channel.account_name || channel.name}: {displayQuantity}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-2 p-2 bg-info bg-opacity-10 rounded">
                            <strong>Selecione canais para configurar as quantidades.</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="neo-card neo-lg p-4 position-sticky" style={{ top: '1rem' }}>
                <h5 className="mb-3 d-flex align-items-center gap-2">
                  <MessageSquare size={20} />
                  Resumo do Disparo
                </h5>

                <div className="mb-3">
                  <div className="small opacity-75 mb-1">Campanha:</div>
                  <div className="fw-medium">{formData.name || 'Não informado'}</div>
                </div>
                
                <div className="mb-3">
                  {selectedChannels.length > 0 ? (
                    <div>
                      <div className="small opacity-75 mb-2">Canais Selecionados ({selectedChannels.length}):</div>
                      <div className="d-flex flex-column gap-2">
                        {selectedChannels.map(channel => {
                          const channelId = channel.record_id
                          const template = selectedTemplates[channelId]
                          const currentValue = channelBatchSizes[channelId]
                          const configuredQuantity = getChannelBatchSize(channelId)
                          const availableContacts = csvData.length
                          const clampedQuantity = availableContacts > 0 ? Math.min(configuredQuantity, availableContacts) : configuredQuantity
                          const clampNote = availableContacts > 0 && configuredQuantity > availableContacts ? ' (limitado ao arquivo)' : ''

                            return (
                              <div key={channelId} className="p-2 border rounded small" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                              <strong>{channel.label || channel.account_name || channel.name}</strong><br />
                              <small className="opacity-75">{channel.display_phone_number}</small>
                              {template && (
                                <div className="mt-1">
                                  Template: {template.name}
                                </div>
                              )}
                              <div className="mt-2">
                                <label className="form-label mb-1 small fw-semibold">Quantidade por disparo</label>
                                <input
                                  className="form-control form-control-sm"
                                  type="number"
                                  min="1"
                                  max="1000"
                                  placeholder={String(DEFAULT_BATCH_SIZE)}
                                  value={currentValue ?? String(DEFAULT_BATCH_SIZE)}
                                  onChange={(e) => handleChannelBatchSizeChange(channelId, e.target.value)}
                                  onBlur={() => handleChannelBatchSizeBlur(channelId)}
                                />
                              </div>
                              <small className="text-muted d-block mt-1">
                                Previsto disparar até {clampedQuantity} contato(s){clampNote}
                              </small>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="small opacity-75 mb-1">Canais e Templates:</div>
                      <div className="fw-medium">Nenhum canal selecionado</div>
                    </div>
                  )}
                </div>
                
                <div className="mb-3">
                  <div className="small opacity-75 mb-1">Contatos:</div>
                  <div className="fw-medium">
                    {csvData.length > 0 ? (
                      <>
                        {csvData.length} contato(s) carregado(s)<br />
                        <small className="opacity-75">Confira as quantidades configuradas por canal acima</small>
                      </>
                    ) : 'Nenhum arquivo carregado'}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="small opacity-75 mb-1">Intervalo:</div>
                  <div className="fw-medium">
                    {formData.intervalMin}s - {formData.intervalMax}s (aleatório)
                    <div className="small opacity-75">Tempo de espera entre envios</div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
                  disabled={!isFormValid() || loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner-border spinner-border-sm" role="status">
                        <span className="visually-hidden">Carregando...</span>
                      </div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Agendar Múltiplos Disparos
                    </>
                  )}
                </button>

                {!isFormValid() && (
                  <div className="alert alert-warning p-3 mt-3 small d-flex align-items-start gap-2">
                    <AlertTriangle size={16} className="mt-1 flex-shrink-0" />
                    <div>
                      {!formData.name && 'Preencha o nome da campanha. '}
                      {!formData.scheduledDateTime && 'Defina data e hora do envio. '}
                      {selectedChannels.length === 0 && 'Selecione pelo menos um canal. '}
                      {selectedChannels.length > 0 && !selectedChannels.every(ch => selectedTemplates[ch.record_id]) && 'Selecione templates para todos os canais. '}
                      {csvData.length === 0 && 'Carregue o arquivo CSV. '}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
        
        {showChannelModal && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeChannelModal}>
            <div className="modal-dialog modal-xl modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header bg-light">
                  <h4 className="modal-title fw-bold d-flex align-items-center gap-2">
                    <Settings size={24} />
                    Selecionar Canais e Templates
                  </h4>
                  <button type="button" className="btn-close" onClick={closeChannelModal}></button>
                </div>
                <div className="modal-body p-4" style={{ minHeight: '60vh', maxHeight: '75vh', overflowY: 'auto' }}>
                  <div className="mb-4">
                    <h6 className="text-muted mb-3">Selecione os canais desejados para seus disparos múltiplos</h6>
                    
                    {loadingChannels ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Carregando...</span>
                        </div>
                        <p className="mt-3 text-muted">Carregando canais da API...</p>
                      </div>
                    ) : (
                      <>
                        <div className="row g-2 mb-3">
                          <div className="col-12 col-md-4">
                            <label className="form-label small text-muted mb-1">BM Nome</label>
                            <select
                              className="form-select form-select-sm"
                              value={filterBmNome}
                              onChange={(e) => setFilterBmNome(e.target.value)}
                              disabled={channels.length === 0}
                              aria-label="Filtrar por BM Nome"
                            >
                              <option value="">Todos</option>
                              {bmNomeOptions.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-md-4">
                            <label className="form-label small text-muted mb-1">Status (API)</label>
                            <select
                              className="form-select form-select-sm"
                              value={filterStatusApi}
                              onChange={(e) => setFilterStatusApi(e.target.value)}
                              disabled={channels.length === 0}
                              aria-label="Filtrar por Status (API)"
                            >
                              <option value="">Todos</option>
                              {statusApiOptions.map((code) => (
                                <option key={code} value={code}>
                                  {mapPhoneStatusApi(code).label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-md-4">
                            <label className="form-label small text-muted mb-1">Qualidade (API)</label>
                            <select
                              className="form-select form-select-sm"
                              value={filterQualidadeApi}
                              onChange={(e) => setFilterQualidadeApi(e.target.value)}
                              disabled={channels.length === 0}
                              aria-label="Filtrar por Qualidade (API)"
                            >
                              <option value="">Todos</option>
                              {qualidadeApiOptions.map((code) => (
                                <option key={code} value={code}>
                                  {mapQualityApi(code).label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="table-responsive">
                        <table className="table table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th width="60" className="text-center">
                                <div className="d-flex flex-column align-items-center">
                                  <input
                                    className="form-check-input" 
                                    type="checkbox" 
                                    onChange={(e) => toggleSelectAllChannels(e.target.checked)}
                                    checked={allVisibleSelected}
                                    style={{ cursor: 'pointer' }}
                                    title={
                                      selectedVisibleCount === 0 ? "Selecionar todos" :
                                      allVisibleSelected ? "Deselecionar todos" :
                                      "Alguns selecionados - clique para selecionar todos"
                                    }
                                  />
                                  {selectedChannels.length > 0 && (
                                    <small className="text-muted mt-1">
                                      {selectedVisibleCount}/{filteredChannels.length}
                                      {filteredChannels.length !== channels.length && (
                                        <span className="ms-1 opacity-75">({selectedChannels.length}/{channels.length})</span>
                                      )}
                                    </small>
                                  )}
                                </div>
                              </th>
                              <th className="fw-bold">BM Nome</th>
                              <th className="fw-bold">Final (4 dígitos)</th>
                              <th className="fw-bold">Número</th>
                              <th className="fw-bold text-center">Status (API)</th>
                              <th className="fw-bold text-center">Qualidade (API)</th>
                              <th width="80" className="text-center">Templates</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredChannels.map((channel) => {
                              const isSelected = selectedChannels.find(c => c.record_id === channel.record_id)
                              const isExpanded = expandedChannels.has(channel.record_id)
                              const templates = channelTemplates[channel.record_id] || []
                              const channelLast4 = getLast4Digits(channel.phone_number_raw || channel.display_phone_number || channel.phone)
                              const bmNomeRaw = String(channel.graph_verified_name || '').trim()
                              const statusRaw = String(channel.graph_status || channel.status || '').trim()
                              const qualityRaw = String(channel.graph_quality_rating || channel.quality_rating || '').trim()
                              
                              return (
                                <React.Fragment key={channel.record_id}>
                                  <tr className={isSelected ? 'table-primary bg-opacity-10' : ''} style={{ cursor: 'pointer' }}>
                                    <td className="text-center">
                                      <input
                                        className="form-check-input" 
                                        type="checkbox" 
                                        checked={!!isSelected} 
                                        onChange={() => toggleChannelSelection(channel)} 
                                        style={{ cursor: 'pointer' }} 
                                      />
                                    </td>
                                    <td onClick={() => toggleChannelSelection(channel)} className="fw-medium text-truncate" title={bmNomeRaw || ''}>
                                      {bmNomeRaw || '-'}
                                    </td>
                                    <td onClick={() => toggleChannelSelection(channel)} className="fw-medium">
                                      {channelLast4 || channel.label || channel.account_name || channel.name}
                                    </td>
                                    <td onClick={() => toggleChannelSelection(channel)} className="font-monospace">
                                      {channel.display_phone_number || channel.phone}
                                    </td>
                                    <td className="text-center">
                                      {(() => {
                                        const { label, color } = mapPhoneStatusApi(statusRaw)
                                        return (
                                          <span className="d-inline-flex align-items-center justify-content-center gap-2">
                                            <span
                                              className="rounded-circle"
                                              style={{ width: 8, height: 8, display: 'inline-block', backgroundColor: color }}
                                              aria-hidden
                                            />
                                            <span className="fw-medium">{label}</span>
                                          </span>
                                        )
                                      })()}
                                    </td>
                                    <td className="text-center">
                                      {(() => {
                                        const { label, color } = mapQualityApi(qualityRaw)
                                        return (
                                          <span className="d-inline-flex align-items-center justify-content-center gap-2">
                                            <span
                                              className="rounded-circle"
                                              style={{
                                                width: 8,
                                                height: 8,
                                                display: 'inline-block',
                                                backgroundColor: color,
                                                border: '2px solid rgba(0,0,0,0.1)',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                              }}
                                              aria-hidden
                                            />
                                            <span className="fw-medium text-muted">{label}</span>
                                          </span>
                                        )
                                      })()}
                                    </td>
                                    <td className="text-center">
                                      {isSelected && (
                                        <button 
                                          className={`btn btn-sm ${isExpanded ? 'btn-info' : 'btn-outline-info'}`}
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            toggleChannelExpansion(channel.record_id); 
                                          }}
                                          title={isExpanded ? "Ocultar templates" : "Ver templates"}
                                        >
                                          {isExpanded ? <ChevronDown size={14} /> : <Plus size={14} />}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                  
                                  {isSelected && isExpanded && (
                                    <tr>
                                      <td colSpan="7" className="p-0">
                                        <div className="bg-light p-3">
                                          <h6 className="mb-3">Templates disponíveis para {channel.label || channel.account_name || channel.name}:</h6>
                                          {templates.length === 0 ? (
                                            <p className="text-muted mb-0">Nenhum template encontrado para este canal.</p>
                                          ) : (
                                            <div className="row g-3">
                                              <div className="col-12 col-md-4">
                                                {templates.map((template) => (
                                                  <div key={template.record_id} className="mb-2">
                                                    <div className="form-check">
                                                      <input
                                                        className="form-check-input"
                                                        type="radio"
                                                        name={`template_${channel.record_id}`}
                                                        id={`template_${channel.record_id}_${template.record_id}`}
                                                        checked={selectedTemplates[channel.record_id]?.record_id === template.record_id}
                                                        onChange={() => selectTemplate(channel.record_id, template)}
                                                        style={{ cursor: 'pointer' }}
                                                      />
                                                      <label
                                                        className="form-check-label d-flex align-items-center justify-content-between w-100"
                                                        htmlFor={`template_${channel.record_id}_${template.record_id}`}
                                                        style={{ cursor: 'pointer' }}
                                                      >
                                                        <div>
                                                          <strong>{template.name}</strong>
                                                          <div className="small text-muted mt-1">
                                                            <span className={getTemplateStatusBadgeClass(template.status)}>
                                                              {getTemplateStatusText(template.status)}
                                                            </span>
                                                            <span className={`${getTemplateCategoryBadgeClass(template.category)} ms-2`}>
                                                              {getTemplateCategoryText(template.category)}
                                                            </span>
                                                          </div>
                                                        </div>
                                                      </label>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="col-12 col-md-8">
                                                <div className="bg-white border rounded p-3 h-100">
                                                  <div className="d-flex align-items-center justify-content-between mb-2">
                                                    <div className="fw-semibold">Mensagem do template</div>
                                                    {selectedTemplates[channel.record_id]?.name && (
                                                      <span className="badge text-bg-secondary">{selectedTemplates[channel.record_id].name}</span>
                                                    )}
                                                  </div>
                                                  {selectedTemplates[channel.record_id] ? (
                                                    selectedTemplates[channel.record_id]?.message ? (
                                                      <div
                                                        className="small"
                                                        style={{ whiteSpace: 'pre-wrap', maxHeight: '260px', overflowY: 'auto' }}
                                                      >
                                                        {selectedTemplates[channel.record_id].message}
                                                      </div>
                                                    ) : (
                                                      <div className="text-muted small">Este template não possui mensagem.</div>
                                                    )
                                                  ) : (
                                                    <div className="text-muted small">Clique em um template para visualizar a mensagem.</div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                        
                        {filteredChannels.length === 0 && (
                          <div className="text-center py-4">
                            <p className="text-muted">
                              {channels.length === 0 ? 'Nenhum canal encontrado na API.' : 'Nenhum canal encontrado para os filtros.'}
                            </p>
                          </div>
                        )}
                      </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="modal-footer bg-light d-flex justify-content-between align-items-center">
                  <div className="text-muted small">
                    {selectedChannels.length > 0 ? (
                      `${selectedChannels.length} de ${channels.length} canais selecionados`
                    ) : (
                      'Nenhum canal selecionado'
                    )}
                  </div>
                  <div>
                    <button 
                      className="btn btn-outline-secondary me-2" 
                      onClick={closeChannelModal}
                    >
                      Cancelar
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={closeChannelModal}
                      disabled={selectedChannels.length === 0}
                    >
                      Concluir Seleção ({selectedChannels.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
