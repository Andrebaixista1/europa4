import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiDownload, FiRefreshCw, FiSearch } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'

const CRED_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank/'
const HIST_API_URL = 'https://n8n.apivieiracred.store/webhook/api/presencabank-historico/'
const PROCESS_URL = '/api/presenca/api/process/individual'

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '')

const formatCpf = (value) => {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return cpf || '-'
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const dateMinuteKey = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).trim()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const toCsvCell = (value) => {
  const s = String(value ?? '')
  if (/[\";\r\n]/.test(s)) return `"${s.replace(/\"/g, '""')}"`
  return s
}

const formatDateOnly = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

const formatPhone = (value) => {
  const phone = onlyDigits(value)
  if (phone.length === 11) return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
  if (phone.length === 10) return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  return phone || '-'
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

const formatCurrency = (value) => {
  const num = toNumberOrNull(value)
  if (num === null) return '-'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const generateRandomPhone = () => {
  // Keeps number in the 119XXXXXXXX range and guarantees 3rd digit = 9.
  const suffix = String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
  return `119${suffix}`
}

const maskLogin = (value) => {
  const txt = String(value ?? '')
  if (!txt) return '-'
  if (txt.length <= 3) return '*'.repeat(txt.length)
  return `${txt.slice(0, 3)}${'*'.repeat(txt.length - 3)}`
}

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

const statusClassName = (status) => {
  const token = String(status ?? '').trim().toLowerCase()
  if (token === 'presente') return 'text-bg-success'
  if (token === 'ausente') return 'text-bg-danger'
  return 'text-bg-secondary'
}

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.rows)) return payload.rows
  if (payload && typeof payload === 'object') return [payload]
  return []
}

const pick = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

const mapRow = (row, idx) => ({
  id: pick(row, ['id', 'ID', 'id_presenca', 'presenca_id'], idx + 1),
  nome: pick(row, ['nome', 'name', 'cliente_nome', 'usuario_nome', 'nome_cliente', 'nome_cliente_consulta', 'loginP'], '-'),
  cpf: pick(row, ['cpf', 'cliente_cpf', 'numero_documento', 'documento'], ''),
  equipe: pick(row, ['equipe', 'equipe_nome', 'team_name', 'nome_equipe', 'id_user', 'loginP'], '-'),
  data: pick(row, ['updated_at', 'data', 'created_at', 'data_hora', 'data_hora_registro', 'timestamp', 'createdAt'], ''),
  dataNascimento: pick(row, ['dataNascimento', 'data_nascimento', 'nascimento'], ''),
  elegivel: parseBoolean(pick(row, ['elegivel', 'isElegivel'], false)),
  status: pick(row, ['status', 'presenca_status', 'situacao', 'status_presenca'], 'Ativo'),
  origem: pick(row, ['origem', 'fonte', 'source', 'origem_dado'], 'PresencaBank'),
  raw: row
})

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value
  const token = String(value ?? '').trim().toLowerCase()
  if (token === 'true' || token === '1' || token === 'sim') return true
  if (token === 'false' || token === '0' || token === 'nao' || token === 'não') return false
  return false
}

const mapTabelaFromFlat = (row) => {
  const src = row || {}
  const nome = pick(src, ['nomeTipo', 'nome', 'tipo_nome'], '')
  const prazo = pick(src, ['prazo'], '')
  const valorLiberado = pick(src, ['valorLiberado'], '')
  const valorParcela = pick(src, ['valorParcela'], '')
  const taxaJuros = pick(src, ['taxaJuros'], '')
  const taxaSeguro = pick(src, ['taxaSeguro'], '')
  const valorSeguro = pick(src, ['valorSeguro'], '')
  const id = pick(src, ['idTipo', 'id'], null)

  if (!nome && !prazo && !valorLiberado && !valorParcela && !taxaJuros && !taxaSeguro && !valorSeguro) return null
  return {
    id,
    nome,
    prazo: toNumberOrNull(prazo) ?? prazo,
    taxaJuros: toNumberOrNull(taxaJuros) ?? taxaJuros,
    valorLiberado: toNumberOrNull(valorLiberado) ?? valorLiberado,
    valorParcela: toNumberOrNull(valorParcela) ?? valorParcela,
    tipoCredito: { name: pick(src, ['tipoCreditoNome'], 'Novo') },
    taxaSeguro: toNumberOrNull(taxaSeguro) ?? taxaSeguro,
    valorSeguro: toNumberOrNull(valorSeguro) ?? valorSeguro
  }
}

export default function ConsultaPresenca() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('') // yyyy-mm-dd
  const [dateTo, setDateTo] = useState('') // yyyy-mm-dd
  const [page, setPage] = useState(1)
  const [lastSyncAt, setLastSyncAt] = useState(null)
  const [summaryRows, setSummaryRows] = useState([])
  const [selectedLoginIndex, setSelectedLoginIndex] = useState(0)
  const [cpfConsulta, setCpfConsulta] = useState('')
  const [telefoneConsulta, setTelefoneConsulta] = useState('')
  const [nomeConsulta, setNomeConsulta] = useState('')
  const [consultaMsg, setConsultaMsg] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [consultaResultModal, setConsultaResultModal] = useState(null)

  const fetchHistoricoRows = useCallback(async (loginP, signal) => {
    const userId = user?.id
    if (!userId || !loginP) {
      setRows([])
      return
    }

    setLoading(true)
    setError('')
    try {
      const url = `${HIST_API_URL}?loginP=${encodeURIComponent(loginP)}&id_user=${encodeURIComponent(userId)}`
      const response = await fetch(url, { method: 'GET', signal })
      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      let payload = null
      try {
        payload = rawText ? JSON.parse(rawText) : []
      } catch {
        throw new Error('Resposta da API de histórico inválida.')
      }

      const sourceRows = normalizeRows(payload)
      const normalized = sourceRows.map(mapRow)
      setRows(normalized)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRows([])
      setError(err?.message || 'Falha ao carregar histórico de consultas.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [user?.id])

  const fetchSummary = useCallback(async (signal) => {
    const userId = user?.id
    if (!userId) {
      setRows([])
      setSummaryRows([])
      setSelectedLoginIndex(0)
      setError('Usuário sem ID para consulta.')
      return
    }

    setError('')
    try {
      const url = `${CRED_API_URL}?login_id=${encodeURIComponent(userId)}`
      const response = await fetch(url, { method: 'GET', signal })
      const rawText = await response.text()
      if (!response.ok) throw new Error(rawText || `HTTP ${response.status}`)

      let payload = null
      try {
        payload = rawText ? JSON.parse(rawText) : []
      } catch {
        throw new Error('Resposta da API inválida.')
      }

      const sourceRows = normalizeRows(payload)
      const summaries = sourceRows.map((row) => ({
        loginP: pick(row, ['loginP', 'login', 'usuario_login'], '-'),
        senhaP: pick(row, ['senhaP', 'senha', 'password'], ''),
        total: pick(row, ['total'], '-'),
        usado: pick(row, ['usado'], '-'),
        restantes: pick(row, ['restantes'], '-')
      }))
      setSummaryRows(summaries)
      setSelectedLoginIndex(0)

      const updatedCandidates = sourceRows
        .map((row) => pick(row, ['updated_at', 'updatedAt', 'data_update', 'updated'], ''))
        .filter(Boolean)
      const latestUpdated = updatedCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
      setLastSyncAt(latestUpdated)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setRows([])
      setSummaryRows([])
      setSelectedLoginIndex(0)
      setError(err?.message || 'Falha ao carregar consulta de presença.')
    }
  }, [user?.id])

  useEffect(() => {
    const controller = new AbortController()
    fetchSummary(controller.signal)
    return () => controller.abort()
  }, [fetchSummary])

  useEffect(() => {
    const loginP = summaryRows[selectedLoginIndex]?.loginP
    if (!loginP || loginP === '-') {
      setRows([])
      return undefined
    }
    const controller = new AbortController()
    fetchHistoricoRows(loginP, controller.signal)
    return () => controller.abort()
  }, [summaryRows, selectedLoginIndex, fetchHistoricoRows])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null
    const base = rows.filter((row) => {
      if (fromTs !== null || toTs !== null) {
        const t = new Date(row?.data || '').getTime()
        if (!Number.isFinite(t)) return false
        if (fromTs !== null && t < fromTs) return false
        if (toTs !== null && t > toTs) return false
      }
      if (!term) return true
      return (
        String(row.nome ?? '').toLowerCase().includes(term) ||
        onlyDigits(row.cpf).includes(onlyDigits(term)) ||
        String(row.equipe ?? '').toLowerCase().includes(term)
      )
    })

    const sorted = [...base].sort((a, b) => {
      const ta = new Date(a?.data || 0).getTime()
      const tb = new Date(b?.data || 0).getTime()
      return tb - ta
    })

    const seenComposite = new Set()
    return sorted.filter((row) => {
      const nameKey = String(row?.nome ?? '').trim().toLowerCase()
      const dateKey = dateMinuteKey(row?.data)
      if (!nameKey || !dateKey) return true
      // Remove duplicados por Nome + Data de atualização (no minuto).
      // Inclui CPF no key para evitar colisões entre homônimos.
      const cpfKey = onlyDigits(row?.cpf) || '-'
      const key = `${nameKey}__${dateKey}__${cpfKey}`
      if (seenComposite.has(key)) return false
      seenComposite.add(key)
      return true
    })
  }, [rows, search, dateFrom, dateTo])

  const currentSummary = summaryRows[selectedLoginIndex] || { loginP: '-', senhaP: '', total: '-', usado: '-', restantes: '-' }
  const pageSize = 50
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pages)
  const startIndex = filteredRows.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1
  const endIndex = Math.min(filteredRows.length, currentPage * pageSize)
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage])
  const sortedTabelasBody = useMemo(() => {
    const list = Array.isArray(consultaResultModal?.tabelasBody) ? [...consultaResultModal.tabelasBody] : []
    const sorted = list.sort((a, b) => {
      const av = toNumberOrNull(a?.valorLiberado) ?? -Infinity
      const bv = toNumberOrNull(b?.valorLiberado) ?? -Infinity
      return bv - av
    })
    const seen = new Set()
    return sorted.filter((item) => {
      const key = [
        String(item?.nome ?? '').trim().toLowerCase(),
        String(item?.prazo ?? '').trim(),
        String(item?.taxaJuros ?? '').trim(),
        String(item?.valorLiberado ?? '').trim(),
        String(item?.valorParcela ?? '').trim(),
        String(item?.taxaSeguro ?? '').trim(),
        String(item?.valorSeguro ?? '').trim()
      ].join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [consultaResultModal])

  useEffect(() => {
    setPage(1)
  }, [search, dateFrom, dateTo, rows, selectedLoginIndex])

  const refresh = () => {
    fetchSummary()
  }

  const downloadFilteredCsv = useCallback(() => {
    if (!filteredRows.length) {
      notify.info('Nenhum registro para baixar.', { autoClose: 2000 })
      return
    }

    const header = ['CPF', 'Nome', 'Data de atualização', 'Elegível', 'Data de nascimento']
    const lines = [header.join(';')]

    for (const row of filteredRows) {
      lines.push([
        toCsvCell(formatCpf(row.cpf)),
        toCsvCell(row.nome || ''),
        toCsvCell(formatDate(row.data)),
        toCsvCell(row.elegivel ? 'Sim' : 'Não'),
        toCsvCell(formatDateOnly(row.dataNascimento))
      ].join(';'))
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `consulta-presenca_${stamp}.csv`

    // BOM para Excel manter acentuação em UTF-8.
    const content = `\ufeff${lines.join('\r\n')}\r\n`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  }, [filteredRows])

  const openConsultaResultModalFromSource = useCallback((source, phoneOriginFallback = 'Registro do histórico') => {
    const payload = source && typeof source === 'object' ? source : {}
    const resultData = payload?.result && typeof payload.result === 'object' ? payload.result : payload
    const fallbackOriginal = resultData?.original || {}

    const cpfBase = pick(resultData, ['cpf'], pick(fallbackOriginal, ['cpf'], pick(payload, ['cpf'], '')))
    const nomeBase = pick(resultData, ['nome'], pick(fallbackOriginal, ['nome'], pick(payload, ['nome'], '')))
    const telefoneBase = pick(resultData, ['telefone'], pick(fallbackOriginal, ['telefone'], pick(payload, ['telefone'], '')))
    const loginBase = pick(resultData, ['loginP'], pick(payload, ['loginP'], ''))
    const createdBase = pick(resultData, ['created_at'], pick(payload, ['created_at'], ''))

    let tabelasBody = Array.isArray(resultData?.tabelas_body)
      ? resultData.tabelas_body
      : (Array.isArray(payload?.tabelas_body) ? payload.tabelas_body : [])

    if (tabelasBody.length === 0) {
      const sourceRows = rows.map((r) => r?.raw || r)
      const related = sourceRows.filter((item) => {
        const cpfItem = pick(item, ['cpf'], '')
        if (cpfBase && cpfItem && cpfItem !== cpfBase) return false
        const nomeItem = pick(item, ['nome'], '')
        if (nomeBase && nomeItem && String(nomeItem).trim().toLowerCase() !== String(nomeBase).trim().toLowerCase()) return false
        const telItem = pick(item, ['telefone'], '')
        if (telefoneBase && telItem && telItem !== telefoneBase) return false
        const loginItem = pick(item, ['loginP'], '')
        if (loginBase && loginItem && loginItem !== loginBase) return false
        if (createdBase) {
          const tBase = new Date(createdBase).getTime()
          const tItem = new Date(pick(item, ['created_at'], createdBase)).getTime()
          if (Number.isFinite(tBase) && Number.isFinite(tItem) && Math.abs(tBase - tItem) > (1000 * 60 * 10)) return false
        }
        return true
      })
      tabelasBody = related
        .map(mapTabelaFromFlat)
        .filter(Boolean)
        .filter((item, idx, arr) => arr.findIndex((x) => `${x.id}-${x.nome}-${x.prazo}` === `${item.id}-${item.nome}-${item.prazo}`) === idx)
    }

    setConsultaResultModal({
      cpf: cpfBase,
      nome: nomeBase,
      telefone: telefoneBase,
      phoneOrigin: pick(resultData, ['phoneOrigin', 'phone_origin'], phoneOriginFallback),
      vinculo: resultData?.vinculo || payload?.vinculo || {
        matricula: pick(payload, ['matricula'], ''),
        numeroInscricaoEmpregador: pick(payload, ['numeroInscricaoEmpregador'], ''),
        elegivel: parseBoolean(pick(payload, ['elegivel'], false))
      },
      margemData: resultData?.margem_data || payload?.margem_data || {
        valorMargemDisponivel: pick(payload, ['valorMargemDisponivel'], ''),
        valorMargemBase: pick(payload, ['valorMargemBase'], ''),
        valorTotalDevido: pick(payload, ['valorTotalDevido'], ''),
        registroEmpregaticio: pick(payload, ['matricula', 'registroEmpregaticio'], ''),
        cnpjEmpregador: pick(payload, ['numeroInscricaoEmpregador', 'cnpjEmpregador'], ''),
        dataAdmissao: pick(payload, ['dataAdmissao'], ''),
        dataNascimento: pick(payload, ['dataNascimento'], ''),
        nomeMae: pick(payload, ['nomeMae'], ''),
        sexo: pick(payload, ['sexo'], '')
      },
      tabelasBody,
      finalStatus: pick(resultData, ['final_status'], pick(payload, ['final_status'], payload?.ok ? 'OK' : 'ERRO')),
      finalMessage: pick(resultData, ['final_message'], pick(payload, ['error', 'message'], ''))
    })
  }, [rows])

  const handleConsultarIndividual = useCallback(async (event) => {
    event.preventDefault()
    const cpfDigits = onlyDigits(cpfConsulta)
    const phoneDigitsRaw = onlyDigits(telefoneConsulta)
    const nome = String(nomeConsulta ?? '').trim()

    if (cpfDigits.length !== 11) {
      setConsultaMsg('Informe um CPF válido com 11 dígitos.')
      return
    }
    if (!nome) {
      setConsultaMsg('Informe o nome para consultar.')
      return
    }

    let phoneDigits = phoneDigitsRaw
    let phoneOrigin = 'Digitado manualmente'
    if (!phoneDigits) {
      phoneDigits = generateRandomPhone()
      setTelefoneConsulta(phoneDigits)
      phoneOrigin = 'Gerado automaticamente'
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setConsultaMsg('Telefone inválido. Use 10 ou 11 dígitos.')
      return
    }
    if (phoneDigits[2] !== '9') {
      setConsultaMsg('O 3º dígito do telefone precisa ser 9.')
      return
    }

    if (!currentSummary?.loginP || currentSummary.loginP === '-') {
      setConsultaMsg('Selecione um login válido no card Resumo.')
      return
    }
    if (!currentSummary?.senhaP) {
      setConsultaMsg('Senha do login não encontrada na API de credenciais.')
      return
    }

    const payload = {
      cpf: cpfDigits,
      nome,
      telefone: phoneDigits,
      produtoId: 28,
      autoAcceptHeadless: true,
      stepDelayMs: 2000,
      login: currentSummary.loginP,
      senha: currentSummary.senhaP
    }

    setConsultando(true)
    setConsultaMsg('Enviando consulta individual...')
    try {
      const response = await fetch(PROCESS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const raw = await response.text()
      let parsed = raw
      try {
        parsed = raw ? JSON.parse(raw) : {}
      } catch {
        parsed = raw || ''
      }
      const parsedObj = (parsed && typeof parsed === 'object') ? parsed : {}
      openConsultaResultModalFromSource(parsedObj, phoneOrigin)

      if (!response.ok) {
        throw new Error(typeof parsed === 'string' ? parsed : JSON.stringify(parsedObj))
      }

      setConsultaMsg(`Consulta enviada com sucesso | CPF ${formatCpf(cpfDigits)} | Telefone ${formatPhone(phoneDigits)}.`)
      await fetchSummary()
    } catch (err) {
      setConsultaMsg(err?.message || 'Falha ao chamar API de consulta individual.')
    } finally {
      setConsultando(false)
    }
  }, [cpfConsulta, telefoneConsulta, nomeConsulta, currentSummary, fetchSummary, openConsultaResultModalFromSource])

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
              <div className="d-flex align-items-center gap-2 mb-1">
                <img
                  src="https://portal.presencabank.com.br/assets/images/presencabank/logo.svg"
                  alt="Presença"
                  width="56"
                  height="56"
                  style={{
                    objectFit: 'contain',
                    background: 'transparent',
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.28))'
                  }}
                />
                <h2 className="fw-bold mb-0">Consulta Presença</h2>
              </div>
              <div className="small opacity-75">Última atualização: {formatDate(lastSyncAt)}</div>
            </div>
          </div>
          <button type="button" className="btn btn-outline-info btn-sm d-flex align-items-center gap-2" onClick={refresh} disabled={loading}>
            <FiRefreshCw size={14} />
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>

        <section className="mb-3">
          <div className="row g-3">
            <div className="col-12 col-lg-3">
              <div className="neo-card neo-lg p-3 p-md-4 h-100">
                <div className="opacity-75 small text-uppercase mb-2">Resumo</div>
                <div className="mb-3">
                  <label className="form-label small opacity-75 mb-1">Login</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedLoginIndex}
                    onChange={(e) => setSelectedLoginIndex(Number(e.target.value))}
                    disabled={summaryRows.length === 0}
                  >
                    {summaryRows.length === 0 ? (
                      <option value={0}>Sem login</option>
                    ) : (
                      summaryRows.map((item, idx) => (
                        <option key={`${item.loginP}-${idx}`} value={idx}>
                          {maskLogin(item.loginP)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="d-flex flex-column gap-3">
                  <div>
                    <div className="small opacity-75">Total</div>
                    <div className="h4 fw-bold mb-0">{currentSummary.total}</div>
                  </div>
                  <div>
                    <div className="small opacity-75">Usado</div>
                    <div className="h4 fw-bold mb-0">{currentSummary.usado}</div>
                  </div>
                  <div>
                    <div className="small opacity-75">Restantes</div>
                    <div className="h4 fw-bold mb-0">{currentSummary.restantes}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-9">
              <div className="neo-card neo-lg p-3 p-md-4">
                <div className="opacity-75 small mb-2 text-uppercase">Filtros</div>
                <div className="d-flex flex-wrap gap-2 align-items-end">
                  <div style={{ minWidth: 260, flex: '1 1 320px' }}>
                    <label className="form-label small opacity-75 mb-1">Buscar</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text"><FiSearch size={14} /></span>
                      <input
                        className="form-control"
                        placeholder="Nome, CPF ou equipe"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <label className="form-label small opacity-75 mb-1">De</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <label className="form-label small opacity-75 mb-1">Até</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="ms-auto d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-info btn-sm d-flex align-items-center gap-2"
                      onClick={downloadFilteredCsv}
                      disabled={loading || filteredRows.length === 0}
                      title="Baixar CSV do que estiver filtrado"
                    >
                      <FiDownload size={14} />
                      <span>CSV</span>
                    </button>
                    <button type="button" className="btn btn-outline-light btn-sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}>
                      Limpar filtros
                    </button>
                  </div>
                </div>
              </div>
              <div className="neo-card neo-lg p-3 p-md-4 mt-3">
                <div className="opacity-75 small mb-2 text-uppercase">Consulta Individual</div>
                <form onSubmit={handleConsultarIndividual}>
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-3">
                      <label className="form-label small opacity-75 mb-1">CPF</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Somente números"
                        value={cpfConsulta}
                        onChange={(e) => setCpfConsulta(onlyDigits(e.target.value))}
                        maxLength={11}
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label small opacity-75 mb-1">Telefone</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Opcional (gera automático)"
                        value={telefoneConsulta}
                        onChange={(e) => setTelefoneConsulta(onlyDigits(e.target.value))}
                        maxLength={11}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small opacity-75 mb-1">Nome</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Nome completo"
                        value={nomeConsulta}
                        onChange={(e) => setNomeConsulta(e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-2 d-grid">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={consultando}>
                        {consultando ? 'Consultando...' : 'Consultar'}
                      </button>
                    </div>
                  </div>
                </form>
                {consultaMsg && (
                  <div className="small mt-2 opacity-75">{consultaMsg}</div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="neo-card neo-lg p-0">
          {!loading && !error && filteredRows.length > 0 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
              <div className="small opacity-75">Exibindo {startIndex}-{endIndex} de {filteredRows.length}</div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {'\u2039'}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${currentPage === 1 ? 'btn-primary' : 'btn-outline-light'}`}
                  onClick={() => setPage(1)}
                >
                  1
                </button>
                {currentPage > 3 && <span className="opacity-50">...</span>}
                {Array.from({ length: 5 }, (_, i) => currentPage - 2 + i)
                  .filter((p) => p > 1 && p < pages)
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-outline-light'}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                {currentPage < pages - 2 && <span className="opacity-50">...</span>}
                {pages > 1 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${currentPage === pages ? 'btn-primary' : 'btn-outline-light'}`}
                    onClick={() => setPage(pages)}
                  >
                    {pages}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={currentPage === pages}
                >
                  {'\u203A'}
                </button>
              </div>
            </div>
          )}
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 text-nowrap">
              <thead>
                <tr>
                  <th>CPF</th>
                  <th>Nome</th>
                  <th>Data de atualização</th>
                  <th>Elegível</th>
                  <th>Data de nascimento</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Carregando registros...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-danger">{error}</td>
                  </tr>
                )}
                {!loading && !error && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 opacity-75">Nenhum registro encontrado.</td>
                  </tr>
                ) : (
                   !loading && !error && pagedRows.map((row) => (
                     <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openConsultaResultModalFromSource(row?.raw || row)}>
                      <td>
                        {(() => {
                          const cpfDigits = onlyDigits(row.cpf)
                          return cpfDigits ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 text-reset"
                              title="Copiar CPF"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(cpfDigits, 'CPF copiado!')
                              }}
                            >
                              {formatCpf(cpfDigits)}
                            </button>
                          ) : (
                            formatCpf(row.cpf)
                          )
                        })()}
                      </td>
                      <td>
                        {row?.nome ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 text-reset text-start"
                            title="Copiar Nome"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyToClipboard(row.nome, 'Nome copiado!')
                            }}
                          >
                            {row.nome}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{formatDate(row.data)}</td>
                      <td>
                        <span className={`badge ${row.elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                          {row.elegivel ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td>{formatDateOnly(row.dataNascimento)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {consultaResultModal && (
        <div
          className="modal fade show"
          style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1065 }}
          role="dialog"
          aria-modal="true"
          onClick={() => setConsultaResultModal(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            style={{ maxWidth: 'min(96vw, 1200px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content modal-dark">
              <div className="modal-header">
                <h5 className="modal-title">Resultado da Consulta Individual</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setConsultaResultModal(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-4">
                    <div className="small opacity-75">CPF</div>
                    <div className="fw-semibold">{formatCpf(consultaResultModal.cpf)}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small opacity-75">Nome</div>
                    <div className="fw-semibold text-break">{consultaResultModal.nome || '-'}</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="small opacity-75">Telefone</div>
                    <div className="fw-semibold">{formatPhone(consultaResultModal.telefone)}</div>
                    <div className="small opacity-75">{consultaResultModal.phoneOrigin}</div>
                  </div>
                  <div className="col-12">
                    {consultaResultModal.finalMessage && (
                      <>
                        <div className="small opacity-75">Mensagem</div>
                        <div className="fw-semibold small">{consultaResultModal.finalMessage}</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="neo-card p-3 mb-3">
                  <div className="small opacity-75 mb-2">Vínculo</div>
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">Matrícula</div>
                      <div className="fw-semibold">{consultaResultModal?.vinculo?.matricula || '-'}</div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">Número Inscrição Empregador</div>
                      <div className="fw-semibold">{consultaResultModal?.vinculo?.numeroInscricaoEmpregador || '-'}</div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="small opacity-75">Elegível</div>
                      <div className="fw-semibold">
                        <span className={`badge ${consultaResultModal?.vinculo?.elegivel ? 'text-bg-success' : 'text-bg-danger'}`}>
                          {consultaResultModal?.vinculo?.elegivel ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="neo-card p-3 mb-3">
                  <div className="small opacity-75 mb-2">Margem</div>
                  <div className="row g-2">
                    <div className="col-12 col-md-3"><div className="small opacity-75">Valor Margem Disponível</div><div className="fw-semibold">{formatCurrency(consultaResultModal?.margemData?.valorMargemDisponivel)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Valor Margem Base</div><div className="fw-semibold">{formatCurrency(consultaResultModal?.margemData?.valorMargemBase)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Valor Total Devido</div><div className="fw-semibold">{formatCurrency(consultaResultModal?.margemData?.valorTotalDevido)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Registro Empregatício</div><div className="fw-semibold">{consultaResultModal?.margemData?.registroEmpregaticio || '-'}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">CNPJ Empregador</div><div className="fw-semibold">{consultaResultModal?.margemData?.cnpjEmpregador || '-'}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Data Admissão</div><div className="fw-semibold">{formatDate(consultaResultModal?.margemData?.dataAdmissao)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Data Nascimento</div><div className="fw-semibold">{formatDate(consultaResultModal?.margemData?.dataNascimento)}</div></div>
                    <div className="col-12 col-md-3"><div className="small opacity-75">Sexo</div><div className="fw-semibold">{consultaResultModal?.margemData?.sexo || '-'}</div></div>
                    <div className="col-12"><div className="small opacity-75">Nome Mãe</div><div className="fw-semibold text-break">{consultaResultModal?.margemData?.nomeMae || '-'}</div></div>
                  </div>
                </div>

                <div className="neo-card p-3">
                  <div className="small opacity-75 mb-2">Tabelas Disponíveis</div>
                  <div className="table-responsive">
                    <table className="table table-dark table-hover align-middle mb-0 table-lookup">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nome</th>
                          <th>Prazo</th>
                          <th>Taxa Juros</th>
                          <th>Valor Liberado</th>
                          <th>Valor Parcela</th>
                          <th>Tipo Crédito</th>
                          <th>Taxa Seguro</th>
                          <th>Valor Seguro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTabelasBody.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-3 opacity-75">Nenhuma tabela retornada.</td>
                          </tr>
                        ) : (
                          sortedTabelasBody.map((item, idx) => (
                            <tr key={item?.id ?? idx}>
                              <td>{item?.id ?? '-'}</td>
                              <td className="text-wrap">{item?.nome || '-'}</td>
                              <td>{item?.prazo ?? '-'}</td>
                              <td>{item?.taxaJuros ?? '-'}</td>
                              <td>{formatCurrency(item?.valorLiberado)}</td>
                              <td>{formatCurrency(item?.valorParcela)}</td>
                              <td>{item?.tipoCredito?.name || '-'}</td>
                              <td>{item?.taxaSeguro ?? '-'}</td>
                              <td>{formatCurrency(item?.valorSeguro)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {consultando && (
        <div className="global-loader-overlay" role="status" aria-live="polite">
          <div className="d-flex flex-column align-items-center gap-2 text-light">
            <div className="spinner-border" role="status" aria-hidden="true"></div>
            <div className="small">Aguardando consulta...</div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

