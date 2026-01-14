import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, CircleDot, Download, FileText, X } from 'lucide-react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { notify } from '../utils/notify.js'

const normalizeDepartamentoKey = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

const VIEIRACRED_DEPARTAMENTOS = [
  'API  (JUH) - 0297',
  'API (BGS) - 1594',
  'API (BGS) - 4092',
  'API (BGS) - 4867',
  'API (BGS) - 7081',
  'API (BGS) - 9316',
  'API (CSO) - 4754',
  'API (CSO) - 7929',
  'API (JSS) - 9919',
  'API (JUH)  - 3081',
  'API (JUH)  - 3112',
  'API (JUH)  - 3328',
  'API (JUH) - 3112 2',
  'API (JUH) - 8294',
  'API (MAYARA) - 1738',
  'API (MAYARA) - 3791',
  'API (MAYARA) - 4716',
  'API (PET) - 1398',
  'API (PET) - 2751',
  'API (PET) - 4315',
  'API (PET) - 6081',
  'API (PET) - 9634',
  'API (STYLE) - 1296',
  'API (STYLE) - 1612',
  'API (STYLE) - 2816',
  'API (STYLE) - 8063',
  'API (STYLE) - 9919',
  'API (TAI) - 0011',
  'API (TAI) - 5256',
  'API (TAI) - 7168',
  'API (TAI) - 8375',
  'API (TAI) - 8466',
  'API (TRIXX) - 0349',
  'API (TRIXX) - 1875',
  'API (TUR) - 0259',
  'API (TUR) - 0828',
  'API (TUR) - 4184',
  'API (TUR) - 8720',
  'API (TUR) - 9386',
  'API (VASC) - 6715',
  'API (WRBB) - 0170'
]

const PRADO_DEPARTAMENTOS = [
  'API (GIO) - 4027',
  'API (GIO) - 5252',
  'API (GIO) - 6489',
  'API (GIO) - 8950',
  'API (GIO) -1003',
  'API (HM) - 2093',
  'API (HM) - 2978',
  'API (HM) - 3982',
  'API (HM) - 6650',
  'API (HM) - 7788',
  'API (JJS) - 2882',
  'API (JJS) - 4836',
  'API (JJS) - 7802',
  'API (JVS) - 5740',
  'API (JVS) - 7516',
  'API (JVS) - 8827',
  'API (JVS) - 9059',
  'API (KING) - 1389',
  'API (KING) - 3171',
  'API (KING) - 3291',
  'API (KING) - 3413',
  'API (KING) - 8807',
  'API (MRC) - 1925',
  'API (MRC) - 3863',
  'API (MRC) - 6529',
  'API (MRC) - 7308',
  'API (MRC) - 8366',
  'API (ND) - 1608',
  'API (ND) - 8816',
  'API (SINA) - 0196',
  'API (SINA) - 3190',
  'API (SINA) - 3586',
  'API (SINA) - 4290',
  'API (SINA) - 9708'
]

const VIEIRACRED_DEPARTAMENTO_KEYS = new Set(VIEIRACRED_DEPARTAMENTOS.map(normalizeDepartamentoKey))
const PRADO_DEPARTAMENTO_KEYS = new Set(PRADO_DEPARTAMENTOS.map(normalizeDepartamentoKey))

export default function CampanhasZap() {
  const buildDefaultRange = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 15)
    const formatDate = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return { startDate: formatDate(start), endDate: formatDate(end) }
  }

  const [dateRange, setDateRange] = useState(() => buildDefaultRange())
  const [isLoading, setIsLoading] = useState(false)
  const [showRangeWarning, setShowRangeWarning] = useState(false)
  const [campanhas, setCampanhas] = useState([])
  const [loadError, setLoadError] = useState('')
  const [openCampanha, setOpenCampanha] = useState(null)
  const [groupPage, setGroupPage] = useState(0)
  const [detailPage, setDetailPage] = useState(0)
  const [selectedCampanha, setSelectedCampanha] = useState('all')
  const [selectedEmpresa, setSelectedEmpresa] = useState('all')
  const [selectedDepartamento, setSelectedDepartamento] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showResumoDownload, setShowResumoDownload] = useState(false)
  const [showDownloadSelecionadas, setShowDownloadSelecionadas] = useState(false)
  const [selectedDownloadKeys, setSelectedDownloadKeys] = useState([])
  const { startDate, endDate } = dateRange
  const groupPageSize = 10
  const detailPageSize = 20

  const toUtc = (value) => {
    if (!value) return null
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return null
    return Date.UTC(year, month - 1, day)
  }

  const rangeDays = (() => {
    const startUtc = toUtc(startDate)
    const endUtc = toUtc(endDate)
    if (startUtc == null || endUtc == null) return null
    return Math.round((endUtc - startUtc) / 86400000)
  })()

  const isRangeLong = typeof rangeDays === 'number' && rangeDays > 15

  const formatUltimoDisparo = (value) => {
    if (!value) return '-'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return String(value)
    const day = String(parsed.getDate()).padStart(2, '0')
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const year = parsed.getFullYear()
    return `${day}/${month}/${year}`
  }

  const formatDestino = (value) => {
    if (value == null || value === '') {
      return { text: '-', invalid: true }
    }
    const raw = String(value)
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 11) {
      return { text: `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`, invalid: false }
    }
    if (digits.length === 10) {
      return { text: `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`, invalid: false }
    }
    return { text: raw, invalid: true }
  }

  const statusTranslations = {
    USER_NUMBER_IS_PART_OF_AN_EXPERIMENT: 'Experimento Meta',
    USER_NUMBER_IS_PART_OF_AN_EXPE: 'Experimento Meta',
    UNSUPPORTED_POST_REQUEST: 'Erro ZapResponder',
    SUCCESS: 'Entregue',
    READ: 'Lido',
    PAYMENT_ISSUE: 'Falha no pagamento',
    ACCOUNT_BLOCKED: 'Conta bloqueada',
    FAIL: 'Falha',
    TEMPLATE_DOES_NOT_EXIST: 'Sem template',
    HEALTHY_ECOSYSTEM_ENGAGEMENT: 'Número duplicado',
    GENERIC_USER_ERROR: 'Erro genérico',
    DONT_EXISTS: 'Não existe',
    ANSWERED: 'Respondido',
    AN_ERROR_OCCURRED: 'Erro desconhecido',
    'A ENVIAR': 'Não enviado'
  }

  const translateStatus = (value) => {
    if (!value) return '-'
    const raw = String(value).trim()
    if (!raw) return '-'
    const key = raw.toUpperCase()
    const mapped = statusTranslations[key] || statusTranslations[key.replace(/_/g, ' ')]
    return mapped || raw
  }

  const buildDestinoKey = (value) => {
    if (value == null) return ''
    const raw = String(value).trim()
    if (!raw) return ''
    const digits = raw.replace(/\D/g, '')
    return digits.length >= 10 ? digits : raw.toLowerCase()
  }

  const dedupeDestinos = (items) => {
    const list = Array.isArray(items) ? items : []
    const seen = new Set()
    const out = []
    list.forEach((item, index) => {
      const key = buildDestinoKey(item?.destino)
      const uniqueKey = key || `__empty__${index}`
      if (seen.has(uniqueKey)) return
      seen.add(uniqueKey)
      out.push(item)
    })
    return out
  }

  const normalizeLabel = (value, fallback) => {
    if (value == null) return fallback
    const text = String(value).trim()
    return text ? text : fallback
  }

  const normalizeStatusValue = (value, fallback) => {
    if (value == null) return fallback
    const text = String(value).trim()
    return text ? text.toUpperCase() : fallback
  }

  const getEmpresaFromDepartamento = (value) => {
    const key = normalizeDepartamentoKey(value)
    if (!key) return 'Sem empresa definida'
    if (VIEIRACRED_DEPARTAMENTO_KEYS.has(key)) return 'Vieiracred'
    if (PRADO_DEPARTAMENTO_KEYS.has(key)) return 'Prado'
    return 'Sem empresa definida'
  }

  const slugify = (value, fallback) => {
    const raw = String(value ?? '').trim()
    if (!raw) return fallback
    const cleaned = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
    return cleaned || fallback
  }

  const buildFileStamp = () => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}${mm}${dd}`
  }

  const buildCsvContent = (rows) => {
    if (!rows.length) return ''
    const excludedKeys = new Set(['pendentes', 'total'])
    const keySet = new Set()
    rows.forEach((item) => {
      if (!item || typeof item !== 'object') return
      Object.keys(item).forEach((key) => {
        if (excludedKeys.has(key)) return
        keySet.add(key)
      })
    })

    const preferred = ['campanha', 'departamento', 'contact_name', 'destino', 'status', 'ultimo_disparo']
    const headers = [
      ...preferred.filter((key) => keySet.has(key)),
      ...Array.from(keySet)
        .filter((key) => !preferred.includes(key))
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    ]

    if (headers.length === 0) return ''

    const lines = [headers, ...rows.map((item) => headers.map((key) => {
      if (key === 'status') return translateStatus(item?.[key])
      return item?.[key] ?? ''
    }))]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
    return '\ufeff' + lines.join('\r\n')
  }

  const exportCampanhaCsv = (group) => {
    const rows = dedupeDestinos(group?.items)
    const csv = buildCsvContent(rows)
    if (!csv) return

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const campanhaLabel = normalizeLabel(group?.campanha, 'campanha')
    const departamentoLabel = normalizeLabel(group?.departamento, 'departamento')
    a.href = url
    a.download = `${slugify(campanhaLabel, 'campanha')}-${slugify(departamentoLabel, 'departamento')}-${rows.length}-${buildFileStamp()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCampanhasCsv = (groups, baseName) => {
    const rows = []
    groups.forEach((group) => {
      const items = dedupeDestinos(group?.items)
      items.forEach((item) => {
        if (!item || typeof item !== 'object') return
        const campanhaValue = (typeof item.campanha === 'string' && item.campanha.trim())
          ? item.campanha
          : (group?.campanha || '')
        const departamentoValue = (typeof item.departamento === 'string' && item.departamento.trim())
          ? item.departamento
          : (group?.departamento || '')
        const ultimoDisparoValue = (typeof item.ultimo_disparo === 'string' && item.ultimo_disparo.trim())
          ? item.ultimo_disparo
          : (group?.ultimo_disparo || '')
        rows.push({
          ...item,
          campanha: campanhaValue,
          departamento: departamentoValue,
          ultimo_disparo: ultimoDisparoValue
        })
      })
    })
    const csv = buildCsvContent(rows)
    if (!csv) return

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(baseName, 'campanhas')}-${rows.length}-${buildFileStamp()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const campanhaOptions = useMemo(() => {
    const list = Array.isArray(campanhas) ? campanhas : []
    const options = new Set()
    list.forEach((item) => {
      options.add(normalizeLabel(item?.campanha, 'Sem campanha'))
    })
    return Array.from(options).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [campanhas])

  const departamentoOptions = useMemo(() => {
    if (selectedEmpresa === 'Vieiracred') return VIEIRACRED_DEPARTAMENTOS.slice()
    if (selectedEmpresa === 'Prado') return PRADO_DEPARTAMENTOS.slice()
    const list = Array.isArray(campanhas) ? campanhas : []
    const options = new Set()
    list.forEach((item) => {
      options.add(normalizeLabel(item?.departamento, 'Sem departamento'))
    })
    return Array.from(options).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [campanhas, selectedEmpresa])

  const statusOptions = useMemo(() => {
    const list = Array.isArray(campanhas) ? campanhas : []
    const options = new Set()
    list.forEach((item) => {
      options.add(normalizeStatusValue(item?.status, 'SEM STATUS'))
    })
    return Array.from(options).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [campanhas])

  const statusKeyList = useMemo(() => {
    const keys = new Set()
    const list = Array.isArray(campanhas) ? campanhas : []
    list.forEach((item) => {
      keys.add(normalizeStatusValue(item?.status, 'SEM STATUS'))
    })
    return Array.from(keys).filter(Boolean)
  }, [campanhas])

  const buildStatusSummary = (items) => {
    const counts = new Map()
    const list = Array.isArray(items) ? items : []
    list.forEach((item) => {
      const key = normalizeStatusValue(item?.status, 'SEM STATUS')
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const sortedKeys = statusKeyList.slice().sort((a, b) => {
      const aLabel = a === 'SEM STATUS' ? 'Sem status' : translateStatus(a)
      const bLabel = b === 'SEM STATUS' ? 'Sem status' : translateStatus(b)
      return aLabel.localeCompare(bLabel, 'pt-BR', { sensitivity: 'base' })
    })
    return sortedKeys.map((key) => ({
      key,
      label: key === 'SEM STATUS' ? 'Sem status' : translateStatus(key),
      count: counts.get(key) || 0
    }))
  }

  const filteredCampanhas = useMemo(() => {
    const list = Array.isArray(campanhas) ? campanhas : []
    return list.filter((item) => {
      const campanha = normalizeLabel(item?.campanha, 'Sem campanha')
      const departamento = normalizeLabel(item?.departamento, 'Sem departamento')
      const status = normalizeStatusValue(item?.status, 'SEM STATUS')
      const empresa = getEmpresaFromDepartamento(departamento)
      const departamentoKey = normalizeDepartamentoKey(departamento)
      const selectedDepartamentoKey = normalizeDepartamentoKey(selectedDepartamento)
      if (selectedCampanha !== 'all' && campanha !== selectedCampanha) return false
      if (selectedEmpresa !== 'all' && empresa !== selectedEmpresa) return false
      if (selectedDepartamento !== 'all' && departamentoKey !== selectedDepartamentoKey) return false
      if (selectedStatus !== 'all' && status !== selectedStatus) return false
      return true
    })
  }, [campanhas, selectedCampanha, selectedDepartamento, selectedStatus, selectedEmpresa])

  const groupedCampanhas = useMemo(() => {
    const list = Array.isArray(filteredCampanhas) ? filteredCampanhas : []
    const map = new Map()
    const parseDate = (value) => {
      if (!value) return null
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return null
      return parsed
    }

    list.forEach((item, index) => {
      const key = normalizeLabel(item?.campanha, 'Sem campanha')
      const current = map.get(key)
      const itemDate = parseDate(item?.ultimo_disparo)
      const destinoKey = buildDestinoKey(item?.destino)
      const uniqueDestino = destinoKey || `__empty__${index}`
      if (!current) {
        const destinoSet = new Set([uniqueDestino])
        map.set(key, {
          key,
          campanha: key,
          departamento: normalizeLabel(item?.departamento, 'Sem departamento'),
          total: destinoSet.size,
          pendentes: item?.pendentes ?? '-',
          ultimo_disparo: item?.ultimo_disparo || null,
          ultimo_disparo_date: itemDate,
          items: [item],
          destinoSet
        })
        return
      }
      current.items.push(item)
      if (!current.destinoSet) current.destinoSet = new Set()
      current.destinoSet.add(destinoKey || `__empty__${current.items.length - 1}`)
      current.total = current.destinoSet.size
      if ((current.departamento === 'Sem departamento' || current.departamento == null) && item?.departamento) {
        current.departamento = normalizeLabel(item?.departamento, 'Sem departamento')
      }
      if ((current.pendentes === '-' || current.pendentes == null) && item?.pendentes != null) {
        current.pendentes = item.pendentes
      }
      if (itemDate && (!current.ultimo_disparo_date || itemDate > current.ultimo_disparo_date)) {
        current.ultimo_disparo = item?.ultimo_disparo
        current.ultimo_disparo_date = itemDate
      }
    })
    return Array.from(map.values())
  }, [filteredCampanhas])

  const groupPageCount = Math.max(1, Math.ceil(groupedCampanhas.length / groupPageSize))
  const safeGroupPage = Math.min(groupPage, groupPageCount - 1)
  const groupStart = safeGroupPage * groupPageSize
  const groupEnd = groupStart + groupPageSize
  const pagedGroups = groupedCampanhas.slice(groupStart, groupEnd)

  const openGroup = openCampanha
    ? groupedCampanhas.find((group) => group.key === openCampanha)
    : null
  const uniqueOpenItems = useMemo(() => dedupeDestinos(openGroup?.items), [openGroup])
  const detailTotal = uniqueOpenItems.length
  const detailPageCount = Math.max(1, Math.ceil(detailTotal / detailPageSize))
  const safeDetailPage = Math.min(detailPage, detailPageCount - 1)
  const detailStart = safeDetailPage * detailPageSize
  const detailEnd = detailStart + detailPageSize
  const detailItems = uniqueOpenItems.slice(detailStart, detailEnd)
  const isFilterActive = selectedCampanha !== 'all' || selectedDepartamento !== 'all' || selectedStatus !== 'all' || selectedEmpresa !== 'all'

  const openResumoDownloadModal = () => {
    setShowResumoDownload(true)
    setShowDownloadSelecionadas(false)
  }

  const closeResumoDownloadModal = () => {
    setShowResumoDownload(false)
    setShowDownloadSelecionadas(false)
  }

  const toggleDownloadSelection = (key) => {
    setSelectedDownloadKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ))
  }

  const handleDownloadAll = () => {
    if (!groupedCampanhas.length) return
    exportCampanhasCsv(groupedCampanhas, 'campanhas-periodo')
  }

  const handleDownloadSelected = () => {
    const selectedGroups = groupedCampanhas.filter((group) => selectedDownloadKeys.includes(group.key))
    if (!selectedGroups.length) return
    exportCampanhasCsv(selectedGroups, 'campanhas-selecionadas')
  }

  const toggleCampanha = (key) => {
    setOpenCampanha((prev) => (prev === key ? null : key))
    setDetailPage(0)
  }

  const handleResetFilters = () => {
    const defaults = buildDefaultRange()
    setDateRange({ startDate: defaults.startDate, endDate: defaults.endDate })
    setSelectedCampanha('all')
    setSelectedEmpresa('all')
    setSelectedDepartamento('all')
    setSelectedStatus('all')
    setOpenCampanha(null)
    setGroupPage(0)
    setDetailPage(0)
    setShowResumoDownload(false)
    setShowDownloadSelecionadas(false)
    setSelectedDownloadKeys([])
  }

  useEffect(() => {
    if (!startDate || !endDate) return
    const controller = new AbortController()
    let active = true
    setIsLoading(true)
    setLoadError('')
    const params = new URLSearchParams({ startDate, endDate })
    fetch(`https://n8n.apivieiracred.store/webhook/campanha-zap?${params.toString()}`, {
      signal: controller.signal
    })
      .then(async (res) => {
        const raw = await res.text().catch(() => '')
        if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
        if (!raw) return []
        try {
          const data = JSON.parse(raw)
          if (Array.isArray(data)) return data
          if (Array.isArray(data?.data)) return data.data
          if (Array.isArray(data?.rows)) return data.rows
          return []
        } catch (err) {
          throw new Error('Resposta invalida da API')
        }
      })
      .then((list) => {
        if (!active) return
        setCampanhas(Array.isArray(list) ? list : [])
        setOpenCampanha(null)
        setGroupPage(0)
        setDetailPage(0)
        setShowDownloadSelecionadas(false)
        setSelectedDownloadKeys([])
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        if (!active) return
        setLoadError(err?.message || 'Erro ao carregar campanhas.')
        console.error('Campanhas Zap fetch failed', err)
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [startDate, endDate])

  useEffect(() => {
    if (!startDate || !endDate) return
    if (isRangeLong) {
      notify.warn('Periodo maior que 15 dias pode causar lentidao para carregar os dados.', {
        toastId: 'campanhas-zap-range',
        autoClose: 10000
      })
      return
    }
    notify.dismiss('campanhas-zap-range')
  }, [startDate, endDate, isRangeLong])

  useEffect(() => {
    if (!startDate || !endDate || !isRangeLong) {
      setShowRangeWarning(false)
      return
    }
    setShowRangeWarning(true)
    const timer = setTimeout(() => setShowRangeWarning(false), 10000)
    return () => clearTimeout(timer)
  }, [startDate, endDate, isRangeLong])

  useEffect(() => {
    if (selectedCampanha !== 'all' && campanhaOptions.length > 0 && !campanhaOptions.includes(selectedCampanha)) {
      setSelectedCampanha('all')
    }
  }, [campanhaOptions, selectedCampanha])

  useEffect(() => {
    if (selectedDepartamento !== 'all' && departamentoOptions.length > 0 && !departamentoOptions.includes(selectedDepartamento)) {
      setSelectedDepartamento('all')
    }
  }, [departamentoOptions, selectedDepartamento])

  useEffect(() => {
    if (selectedStatus !== 'all' && statusOptions.length > 0 && !statusOptions.includes(selectedStatus)) {
      setSelectedStatus('all')
    }
  }, [statusOptions, selectedStatus])

  useEffect(() => {
    setOpenCampanha(null)
    setGroupPage(0)
    setDetailPage(0)
    setShowDownloadSelecionadas(false)
    setSelectedDownloadKeys([])
  }, [selectedCampanha, selectedDepartamento, selectedStatus, selectedEmpresa])

  useEffect(() => {
    if (groupPage > groupPageCount - 1) {
      setGroupPage(Math.max(groupPageCount - 1, 0))
    }
  }, [groupPage, groupPageCount])

  useEffect(() => {
    if (!openCampanha) return
    const onPage = pagedGroups.some((group) => group.key === openCampanha)
    if (!onPage) setOpenCampanha(null)
  }, [openCampanha, pagedGroups])

  useEffect(() => {
    if (!openCampanha) return
    if (detailPage > detailPageCount - 1) {
      setDetailPage(Math.max(detailPageCount - 1, 0))
    }
  }, [detailPage, detailPageCount, openCampanha])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3 flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2">
              <ArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <img
                  src="https://chat.zapresponder.com.br/assets/logo-fill-707bdf21.svg"
                  alt="Zap Responder"
                  style={{ height: 32, width: 'auto' }}
                />
                <h2 className="fw-bold mb-0">Campanhas Zap</h2>
              </div>
              <div className="opacity-75 small">Acompanhe as campanhas que foram criadas e enviadas no ZapResponder</div>
            </div>
          </div>
        </div>
        <div className="row g-3 mb-4">
          <div className="col-12 col-lg-8">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <div className="fw-semibold">Filtros de periodo</div>
              <div className="small opacity-75">Atualize o intervalo para recarregar as campanhas.</div>
            </div>
            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={handleResetFilters}
            >
              Limpar filtros
            </button>
          </div>
              <div className="row g-3">
                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label small opacity-75">Data Inicio</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={startDate}
                    onChange={(event) => setDateRange((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </div>
                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label small opacity-75">Data Fim</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={endDate}
                    onChange={(event) => setDateRange((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </div>
                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label small opacity-75">Empresa</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedEmpresa}
                    onChange={(event) => setSelectedEmpresa(event.target.value)}
                  >
                    <option value="all">Todas</option>
                    <option value="Vieiracred">Vieiracred</option>
                    <option value="Prado">Prado</option>
                  </select>
                </div>
                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label small opacity-75">Campanha</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedCampanha}
                    onChange={(event) => setSelectedCampanha(event.target.value)}
                  >
                    <option value="all">Todas</option>
                    {campanhaOptions.map((campanha) => (
                      <option key={campanha} value={campanha}>{campanha}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label small opacity-75">Departamento</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedDepartamento}
                    onChange={(event) => setSelectedDepartamento(event.target.value)}
                  >
                    <option value="all">Todos</option>
                    {departamentoOptions.map((departamento) => (
                      <option key={departamento} value={departamento}>{departamento}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label small opacity-75">Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value)}
                  >
                    <option value="all">Todos</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status === 'SEM STATUS' || status === 'Sem status' ? 'Sem status' : translateStatus(status)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {isLoading && (
                <div className="d-flex align-items-center gap-2 small mt-3">
                  <div className="spinner-border spinner-border-sm text-warning" role="status" aria-hidden="true" />
                  <span>Carregando campanhas...</span>
                </div>
              )}
              {showRangeWarning && (
                <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">
                  Periodo maior que 15 dias pode ocasionar lentidao para carregar os dados.
                </div>
              )}
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="fw-semibold mb-3">Resumo do periodo</div>
              <div className="row g-3">
                <div className="col-6">
                  <div className="camp-metric">
                    <div className="camp-metric-value">{groupedCampanhas.length}</div>
                    <div className="camp-metric-label">Total de campanhas</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="camp-metric">
                    <div className="camp-metric-value">{filteredCampanhas.length}</div>
                    <div className="camp-metric-label">Total de Disparos</div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm d-inline-flex align-items-center gap-2"
                  onClick={openResumoDownloadModal}
                >
                  <Download size={16} />
                  <span>Download</span>
                </button>
              </div>
              <div className="small opacity-75 mt-3">Contagem baseada nos filtros selecionados.</div>
            </div>
          </div>
        </div>
        <div className="neo-card neo-lg p-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <div className="fw-semibold">Resultados</div>
              <div className="small opacity-75">Campanhas do periodo selecionado.</div>
              <div className="d-flex align-items-center gap-2 small opacity-75 mt-1">
                <CircleDot size={14} className={isFilterActive ? 'text-success' : 'text-secondary'} />
                <span>{isFilterActive ? 'Filtro ativo' : 'Filtro inativo'}</span>
              </div>
            </div>
            {pagedGroups.length > 0 && (
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="small opacity-75">
                  Campanhas {groupStart + 1} - {Math.min(groupEnd, groupedCampanhas.length)} de {groupedCampanhas.length}
                </div>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    disabled={safeGroupPage === 0}
                    onClick={() => setGroupPage((prev) => Math.max(prev - 1, 0))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    disabled={safeGroupPage >= groupPageCount - 1}
                    onClick={() => setGroupPage((prev) => Math.min(prev + 1, groupPageCount - 1))}
                  >
                    Proxima
                  </button>
                </div>
              </div>
            )}
          </div>
          {loadError && (
            <div className="alert alert-danger py-2 px-3 small mb-3">
              {loadError}
            </div>
          )}
          {isLoading ? (
            <div className="d-flex align-items-center gap-2 small">
              <div className="spinner-border spinner-border-sm text-warning" role="status" aria-hidden="true" />
              <span>Carregando...</span>
            </div>
          ) : pagedGroups.length > 0 ? (
            <div className="d-grid gap-3">
              {pagedGroups.map((group, index) => {
                const isOpen = openCampanha === group.key
                const detailId = `camp-details-${String(group.key)
                  .replace(/[^a-z0-9]+/gi, '-')
                  .toLowerCase()}-${index}`
                return (
                  <div key={group.key} className="camp-acc-card">
                    <button
                      type="button"
                      className={`camp-acc-toggle ${isOpen ? 'neo-acc-open' : ''}`}
                      aria-expanded={isOpen}
                      aria-controls={detailId}
                      onClick={() => toggleCampanha(group.key)}
                    >
                      <div className="camp-acc-grid">
                        <div>
                          <div className="camp-acc-label">Ultimo disparo</div>
                          <div className="camp-acc-value">{formatUltimoDisparo(group.ultimo_disparo)}</div>
                        </div>
                        <div>
                          <div className="camp-acc-label">Campanha</div>
                          <div className="camp-acc-value camp-acc-value-wrap">{group.campanha || '-'}</div>
                        </div>
                        <div>
                          <div className="camp-acc-label">Departamento</div>
                          <div className="camp-acc-value">{group.departamento || '-'}</div>
                        </div>
                        <div>
                          <div className="camp-acc-label">Total</div>
                          <div className="camp-acc-value">{group.total ?? '-'}</div>
                        </div>
                        <div>
                          <div className="camp-acc-label">Pendentes</div>
                          <div className="camp-acc-value">{group.pendentes ?? '-'}</div>
                        </div>
                      </div>
                      <ChevronDown className={`neo-acc-chevron ${isOpen ? 'open' : ''}`} size={18} />
                    </button>
                    {isOpen && (
                      <div id={detailId} className="camp-details pt-2 pb-3 px-3">
                        <div className="camp-status-grid mb-3">
                          {buildStatusSummary(uniqueOpenItems).map((statusItem) => (
                            <div
                              key={`${group.key}-${statusItem.key}`}
                              className={`camp-status-chip ${statusItem.count === 0 ? 'muted' : ''}`}
                            >
                              <div className="camp-status-count">{statusItem.count}</div>
                              <div className="camp-status-label">{statusItem.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                          <div className="small opacity-75">
                            {detailTotal > 0
                              ? `Linhas ${detailStart + 1} - ${Math.min(detailEnd, detailTotal)} de ${detailTotal}`
                              : 'Nenhuma linha para exportar.'}
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            {detailPageCount > 1 && (
                              <div className="btn-group btn-group-sm">
                                <button
                                  type="button"
                                  className="btn btn-outline-light"
                                  disabled={safeDetailPage === 0}
                                  onClick={() => setDetailPage((prev) => Math.max(prev - 1, 0))}
                                >
                                  Anterior
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-light"
                                  disabled={safeDetailPage >= detailPageCount - 1}
                                  onClick={() => setDetailPage((prev) => Math.min(prev + 1, detailPageCount - 1))}
                                >
                                  Proxima
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline-light btn-sm d-inline-flex align-items-center gap-2"
                              onClick={() => exportCampanhaCsv(group)}
                              disabled={!group?.items?.length}
                              title="Baixar CSV"
                              aria-label="Baixar CSV"
                            >
                              <Download size={16} />
                              <span className="d-none d-sm-inline">Baixar CSV</span>
                            </button>
                          </div>
                        </div>
                        <div className="table-responsive">
                          <table className="table table-dark table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th>Nome Cliente</th>
                                <th>Telefone</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailItems.length > 0 ? (
                                detailItems.map((item, detailIndex) => {
                                  const destino = formatDestino(item?.destino)
                                  return (
                                    <tr key={`${group.key}-${detailIndex}`}>
                                      <td className="small">{item?.contact_name || '-'}</td>
                                      <td className="small">
                                        <div className="d-flex align-items-center gap-2">
                                          <span>{destino.text}</span>
                                          {destino.invalid && (
                                            <AlertTriangle
                                              size={14}
                                              className="text-warning"
                                              aria-label="Telefone fora do padrao"
                                              title="Telefone fora do padrao esperado"
                                            />
                                          )}
                                        </div>
                                      </td>
                                      <td className="small">{translateStatus(item?.status)}</td>
                                    </tr>
                                  )
                                })
                              ) : (
                                <tr>
                                  <td colSpan={3} className="small text-center">
                                    Nenhum registro encontrado.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="small text-center opacity-75 py-3">
              Nenhuma campanha encontrada.
            </div>
          )}
        </div>
      </main>
      {showResumoDownload && (
        <div
          className="camp-download-overlay"
          onClick={closeResumoDownloadModal}
        >
          <div
            className="camp-download-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Downloads de campanhas"
          >
            <div className="camp-download-header">
              <div>
                <h5 className="camp-download-title">Downloads</h5>
                <div className="camp-download-subtitle">Baixe campanhas com base no periodo selecionado.</div>
              </div>
              <button
                type="button"
                className="camp-download-close"
                aria-label="Fechar"
                onClick={closeResumoDownloadModal}
              >
                <X size={18} />
              </button>
            </div>
            <div className="camp-download-options">
              <div className="camp-download-option-wrap">
                <button
                  type="button"
                  className="camp-download-option camp-download-option--green"
                  onClick={handleDownloadAll}
                  disabled={groupedCampanhas.length === 0}
                >
                  <span className="camp-download-icon">
                    <Download size={28} />
                  </span>
                  <span className="camp-download-option-label">Download Todas as Campanhas</span>
                </button>
                <div className="camp-download-help">
                  Campanhas dentro do periodo do filtro selecionado.
                </div>
              </div>
              <div className="camp-download-option-wrap">
                <button
                  type="button"
                  className={`camp-download-option camp-download-option--blue ${showDownloadSelecionadas ? 'is-open' : ''}`}
                  onClick={() => setShowDownloadSelecionadas((prev) => !prev)}
                  disabled={groupedCampanhas.length === 0}
                  aria-expanded={showDownloadSelecionadas}
                  aria-controls="campanhas-selecionadas-panel"
                >
                  <span className="camp-download-icon">
                    <FileText size={28} />
                  </span>
                  <span className="camp-download-option-label">Download Campanhas Selecionadas</span>
                </button>
              </div>
            </div>
            {showDownloadSelecionadas && (
              <div id="campanhas-selecionadas-panel" className="camp-download-selection">
                {groupedCampanhas.length > 0 ? (
                  <>
                    <div className="table-responsive" style={{ maxHeight: 260, overflowY: 'auto' }}>
                      <table className="table table-sm align-middle mb-0 camp-download-table">
                        <thead>
                          <tr>
                            <th aria-label="Selecionar" />
                            <th>Ultimo disparo</th>
                            <th>Campanha</th>
                            <th>Departamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedCampanhas.map((group) => (
                            <tr key={`download-${group.key}`}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selectedDownloadKeys.includes(group.key)}
                                  onChange={() => toggleDownloadSelection(group.key)}
                                  aria-label={`Selecionar campanha ${group.campanha || '-'}`}
                                />
                              </td>
                              <td className="small">{formatUltimoDisparo(group.ultimo_disparo)}</td>
                              <td className="small">{group.campanha || '-'}</td>
                              <td className="small">{group.departamento || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="camp-download-selection-footer">
                      <div className="camp-download-selection-count">Selecionadas: {selectedDownloadKeys.length}</div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
                        onClick={handleDownloadSelected}
                        disabled={selectedDownloadKeys.length === 0}
                      >
                        <Download size={14} />
                        <span>Baixar selecionadas</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="camp-download-empty">Nenhuma campanha encontrada.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
