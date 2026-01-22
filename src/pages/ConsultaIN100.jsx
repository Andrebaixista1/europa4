import { useRef, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { FiArrowLeft, FiUser, FiHash, FiCalendar, FiInfo, FiDollarSign, FiCopy } from 'react-icons/fi'
import { useLoading } from '../context/LoadingContext.jsx'
import { notify } from '../utils/notify.js'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Link } from 'react-router-dom'

const BMG_LOGIN = import.meta.env.login_bmg || import.meta.env.VITE_LOGIN_BMG || ''
const BMG_PASSWORD = import.meta.env.senha_bmg || import.meta.env.VITE_SENHA_BMG || ''
const BMG_SOAP_URL = import.meta.env.VITE_BMG_SOAP_URL || '/api/bmg'
const BMG_SOAP_ACTION = import.meta.env.VITE_BMG_SOAP_ACTION || 'inserirSolicitacao'
const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export default function ConsultaIN100() {
  const { user } = useAuth()
  const canUseBmg = false
  const [cpf, setCpf] = useState('')
  const [beneficio, setBeneficio] = useState('')
  const online = true
  const loader = useLoading()
  const [resultado, setResultado] = useState(null)
  const [bancoInfo, setBancoInfo] = useState(null)
  const resultRef = useRef(null)
  const formRef = useRef(null)
  const [providerChoice, setProviderChoice] = useState('qualibanking')
  const [bmgModalOpen, setBmgModalOpen] = useState(false)
  const [bmgStep, setBmgStep] = useState('form')
  const [bmgStatus, setBmgStatus] = useState('idle')
  const [bmgResponse, setBmgResponse] = useState('')
  const [bmgError, setBmgError] = useState('')
  const [bmgRawResponse, setBmgRawResponse] = useState('')
  const [bmgRequest, setBmgRequest] = useState(null)
  const [bmgPesquisarStatus, setBmgPesquisarStatus] = useState('idle')
  const [bmgPesquisarError, setBmgPesquisarError] = useState('')
  const [bmgPesquisarRaw, setBmgPesquisarRaw] = useState('')
  const [bmgNumeroSolicitacao, setBmgNumeroSolicitacao] = useState('')
  const [bmgToken, setBmgToken] = useState('')
  const [bmgAvulsaStatus, setBmgAvulsaStatus] = useState('idle')
  const [bmgAvulsaError, setBmgAvulsaError] = useState('')
  const [bmgAvulsaRaw, setBmgAvulsaRaw] = useState('')
  const [bmgResultado, setBmgResultado] = useState(null)
  const bmgLastSentRef = useRef('')
  const [bmgForm, setBmgForm] = useState({
    nomeCompleto: '',
    dataNascimento: '',
    cidade: '',
    estado: '',
    ddd: '',
    telefone: '',
  })

  const [metrics, setMetrics] = useState({ totalCarregado: 0, disponivel: 0, realizadas: 0 })

  useEffect(() => {
    if (!canUseBmg || !bmgResultado) return
    const key = `${bmgResultado.cpf || ''}|${bmgResultado.numeroBeneficio || ''}|${bmgResultado.dataConsulta || ''}`
    if (bmgLastSentRef.current === key) return
    bmgLastSentRef.current = key

    const userInfo = {
      id: user?.id ?? null,
      login: user?.login ?? user?.username ?? null,
      nome: user?.nome ?? user?.name ?? null,
      email: user?.email ?? null,
      role: user?.role ?? user?.Role ?? null,
      nivel: user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia ?? null,
      equipe_id: user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null,
      equipe_nome: user?.equipe_nome ?? user?.team_name ?? user?.teamName ?? user?.equipeNome ?? null,
    }

    const payload = {
      tipo: 'bmg',
      data_envio: new Date().toISOString(),
      usuario: userInfo,
      cliente_informado: { ...bmgForm },
      resultado: bmgResultado,
    }

    fetch('https://n8n.apivieiracred.store/webhook/consulta-bmg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }, [bmgResultado, bmgForm, canUseBmg, user])

  const buildSaldoPayload = () => {
    const equipeId = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
    const equipeNome = user?.equipe_nome ?? user?.team_name ?? user?.teamName ?? user?.equipeNome ?? null
    const payload = {
      id_user: user?.id,
      id: user?.id,
      login: user?.login,
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
  // Carrega saldos do usuário para preencher os cards
  // Carrega saldos do usuário para preencher os cards
  const fetchSaldoUsuario = async () => {
    if (!user || !user.id) return
    try {
      const url = 'https://n8n.apivieiracred.store/webhook/get-saldos'
      const payload = buildSaldoPayload()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (!data) return
      const num = (val) => Number(val ?? 0)
      const asArray = Array.isArray(data) ? data : [data]
      const targetTeamId = payload?.equipe_id ?? payload?.team_id ?? payload?.id_equipe ?? null
      const item = (asArray.find((row) => {
        if (!row) return false
        if (targetTeamId == null) return false
        const eqId = Number(row.equipe_id ?? row.team_id ?? row.id_equipe)
        return Number(targetTeamId) === eqId
      })) || asArray[0] || {}
      setMetrics({
        totalCarregado: num(item.total_carregado ?? item.total ?? item.carregado),
        disponivel: num(item.limite_disponivel ?? item.disponivel ?? item.limite ?? item.limite_total),
        realizadas: num(item.consultas_realizada ?? item.consultas_realizadas ?? item.realizadas ?? item.qtd_consultas),
      })
    } catch (_) {
      // silencia erros para não travar a UI
    }
  }

  useEffect(() => {
    fetchSaldoUsuario()
  }, [user])

  const formatCpf = (value) => {
    const v = value.replace(/\D/g, '').slice(0, 11)
    const parts = []
    if (v.length > 0) parts.push(v.slice(0, 3))
    if (v.length > 3) parts.push(v.slice(3, 6))
    if (v.length > 6) parts.push(v.slice(6, 9))
    let rest = v.slice(9, 11)
    let out = parts[0] || ''
    if (parts[1]) out = `${parts[0]}.${parts[1]}`
    if (parts[2]) out = `${parts[0]}.${parts[1]}.${parts[2]}`
    if (rest.length > 0) out = `${out}-${rest}`
    return out
  }

  const formatBeneficio = (value) => {
    const v = value.replace(/\D/g, '').slice(0, 10)
    const p1 = v.slice(0, 3), p2 = v.slice(3, 6), p3 = v.slice(6, 9), p4 = v.slice(9, 10)
    let out = ''
    if (p1) out = p1
    if (p2) out = `${p1}.${p2}`
    if (p3) out = `${p1}.${p2}.${p3}`
    if (p4) out = `${p1}.${p2}.${p3}-${p4}`
    return out
  }
  const formatBeneficioDisplay = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    const padded = digits.padStart(10, '0').slice(0, 10)
    return formatBeneficio(padded)
  }

  // Formatação de data: usa parsing estrito do componente YYYY-MM-DD (sem efeito de timezone)
  const parseISODateParts = (value) => {
    const m = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})/)
    return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
  }
  const partsToBR = (p) => `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${String(p.y)}`
  const formatDate = (iso) => {
    if (!iso) return '-'
    const p = parseISODateParts(iso)
    if (p) return partsToBR(p)
    const d = new Date(iso)
    if (isNaN(d)) return '-'
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }
  const formatTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }) : '--:--')
  const idadeFrom = (iso) => {
    if (!iso) return '-'
    const parts = parseISODateParts(iso)
    const b = parts ? new Date(parts.y, parts.m - 1, parts.d) : new Date(iso)
    if (isNaN(b)) return '-'
    const t = new Date()
    let age = t.getFullYear() - b.getFullYear()
    const m = t.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--
    return age
  }
  const brCurrency = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
  const mapPensao = (v) => (v === 'not_payer' ? 'Não pensionista' : v || '-')
  const mapBloqueio = (v) => (v === 'not_blocked' ? 'Não bloqueado' : v || '-')
  const mapTipoCredito = (v) => {
    if (!v) return '-'
    if (v === 'magnetic_card') return 'Cartão magnético'
    if (v === 'checking_account') return 'Conta Corrente'
    return v
  }
  const mapSituacao = (v) => (v === 'elegible' ? 'Elegível' : v || '-')

  const parseBmgDateValue = (value) => {
    const raw = String(value || '').trim()
    if (!raw || raw.startsWith('0001-01-01')) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const d = new Date(raw)
      return isNaN(d) ? null : d
    }
    const match = raw.match(/\b([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2}).*?(\d{4})\b/)
    if (match) {
      const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
      }
      const monthIdx = months[match[2]]
      if (monthIdx == null) return null
      const day = Number(match[3])
      const year = Number(match[4])
      const d = new Date(year, monthIdx, day)
      return isNaN(d) ? null : d
    }
    const asDate = new Date(raw)
    return isNaN(asDate) ? null : asDate
  }

  const formatBmgDate = (value) => {
    const raw = String(value || '').trim()
    if (!raw || raw.startsWith('0001-01-01')) return '-'
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return formatDate(raw)
    const match = raw.match(/\b([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2}).*?(\d{4})\b/)
    if (match) {
      const months = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
      }
      const mm = months[match[2]] || '01'
      const dd = String(match[3]).padStart(2, '0')
      return `${dd}/${mm}/${match[4]}`
    }
    const asDate = new Date(raw)
    if (!isNaN(asDate)) return asDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    return raw
  }
  const formatBmgTime = (value) => {
    const d = parseBmgDateValue(value)
    if (!d) return '--:--'
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' })
  }
  const idadeFromDate = (dateObj) => {
    if (!dateObj || isNaN(dateObj)) return null
    const t = new Date()
    let age = t.getFullYear() - dateObj.getFullYear()
    const m = t.getMonth() - dateObj.getMonth()
    if (m < 0 || (m === 0 && t.getDate() < dateObj.getDate())) age--
    return age
  }
  const bmgAgeFrom = (value) => {
    const d = parseBmgDateValue(value)
    return d ? idadeFromDate(d) : null
  }
  const bmgMoney = (value) => {
    if (value == null) return '-'
    const n = Number(String(value).replace(',', '.'))
    if (Number.isNaN(n)) return '-'
    return brCurrency(n)
  }
  const mapBool = (value) => {
    const v = String(value || '').toLowerCase()
    if (v === 'true') return 'Sim'
    if (v === 'false') return 'Não'
    return value || '-'
  }

  const xmlEscape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

  const buildBmgEnvelope = (payload) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservice.econsig.bmg.com">
  <soapenv:Header/>
  <soapenv:Body>
    <web:inserirSolicitacao>
      <solicitacaoIN100>
        <login>${xmlEscape(payload.login)}</login>
        <senha>${xmlEscape(payload.senha)}</senha>
        <cidade>${xmlEscape(payload.cidade)}</cidade>
        <cpf>${xmlEscape(payload.cpf)}</cpf>
        <dataNascimento>${xmlEscape(payload.dataNascimento)}</dataNascimento>
        <ddd>${xmlEscape(payload.ddd)}</ddd>
        <estado>${xmlEscape(payload.estado)}</estado>
        <matricula>${xmlEscape(payload.matricula)}</matricula>
        <nome>${xmlEscape(payload.nome)}</nome>
        <telefone>${xmlEscape(payload.telefone)}</telefone>
      </solicitacaoIN100>
    </web:inserirSolicitacao>
  </soapenv:Body>
</soapenv:Envelope>`

  const buildPesquisarEnvelope = (payload) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservice.econsig.bmg.com">
  <soapenv:Header/>
  <soapenv:Body>
    <web:pesquisar>
      <FiltroConsultaIN100>
        <login>${xmlEscape(payload.login)}</login>
        <senha>${xmlEscape(payload.senha)}</senha>
        <cpf>${xmlEscape(payload.cpf)}</cpf>
        <periodoInicial>${xmlEscape(payload.periodoInicial)}</periodoInicial>
        <periodoFinal>${xmlEscape(payload.periodoFinal)}</periodoFinal>
        <numeroSolicitacao></numeroSolicitacao>
      </FiltroConsultaIN100>
    </web:pesquisar>
  </soapenv:Body>
</soapenv:Envelope>`

  const buildAvulsaEnvelope = (payload) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservice.econsig.bmg.com">
  <soapenv:Header/>
  <soapenv:Body>
    <web:realizarConsultaAvulsa>
      <FiltroConsultaAvulsaIN100>
        <login>${xmlEscape(payload.login)}</login>
        <senha>${xmlEscape(payload.senha)}</senha>
        <numeroSolicitacao>${xmlEscape(payload.numeroSolicitacao)}</numeroSolicitacao>
        <token>${xmlEscape(payload.token)}</token>
      </FiltroConsultaAvulsaIN100>
    </web:realizarConsultaAvulsa>
  </soapenv:Body>
</soapenv:Envelope>`

  const parseBmgSoapResponse = (xmlText) => {
    if (!xmlText) return { message: '', fault: 'Resposta vazia do BMG.' }
    try {
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
      if (doc.getElementsByTagName('parsererror').length) {
        return { message: '', fault: 'Nao foi possivel interpretar a resposta do BMG.' }
      }
      const getText = (tag) => doc.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
      const message = getText('inserirSolicitacaoReturn')
      const fault = getText('faultstring') || getText('Fault')
      return { message, fault }
    } catch {
      const match = xmlText.match(/<inserirSolicitacaoReturn[^>]*>([\s\S]*?)<\/inserirSolicitacaoReturn>/i)
      if (match) {
        return { message: match[1].replace(/<[^>]+>/g, '').trim(), fault: '' }
      }
      return { message: '', fault: 'Resposta invalida do BMG.' }
    }
  }

  const parseNumeroSolicitacao = (xmlText) => {
    if (!xmlText) return ''
    try {
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
      const nodes = Array.from(doc.getElementsByTagName('numeroSolicitacao'))
      for (const node of nodes) {
        const value = (node?.textContent || '').trim()
        if (value) return value
      }
    } catch { /* ignore */ }
    const match = xmlText.match(/<numeroSolicitacao[^>]*>([^<]+)<\/numeroSolicitacao>/i)
    return match ? match[1].trim() : ''
  }

  const parseAvulsaResponse = (xmlText) => {
    if (!xmlText) return null
    try {
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
      const consulta = doc.getElementsByTagName('consulta')[0]
      const getChild = (node, tag) => node?.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
      const getText = (tag) => doc.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
      return {
        cpf: getChild(consulta, 'cpf') || getText('cpf'),
        numeroBeneficio: getChild(consulta, 'numeroBeneficio') || getText('numeroBeneficio'),
        nome: getChild(consulta, 'nomeBeneficiario') || getText('nome'),
        dataNascimento: getChild(consulta, 'dataNascimento') || getText('dataNascimento'),
        dataConsulta: getChild(consulta, 'dataConsulta') || getText('dataConsulta'),
        especie: getChild(consulta, 'especie'),
        qtdEmprestimos: getChild(consulta, 'qtdEmprestimosAtivosSuspesnsos'),
        contaCorrente: getChild(consulta, 'contaCorrente'),
        agenciaPagadora: getChild(consulta, 'agenciaPagadora'),
        cidade: getChild(consulta, 'cidade') || getText('cidade'),
        estado:
          getChild(consulta, 'ufPagamento') ||
          getChild(consulta, 'uf') ||
          getText('uf') ||
          getText('UF') ||
          getChild(consulta, 'estado') ||
          getText('estado'),
        dataDespachoBeneficio: getChild(consulta, 'dataDespachoBeneficio'),
        elegivelEmprestimo: getChild(consulta, 'elegivelEmprestimo'),
        margemDisponivel: getChild(consulta, 'margemDisponivel'),
        margemDisponivelCartao: getChild(consulta, 'margemDisponivelCartao'),
        margemDisponivelRcc: getChild(consulta, 'margemDisponivelRcc'),
        valorComprometido: getChild(consulta, 'valorComprometido'),
        valorLimiteCartao: getChild(consulta, 'valorLimiteCartao'),
        valorLimiteRcc: getChild(consulta, 'valorLimiteRcc'),
        valorMaximoComprometimento: getChild(consulta, 'valorMaximoComprometimento'),
      }
    } catch {
      return null
    }
  }

  const buildDateWithOffset = (daysFromToday) => {
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday)
    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, '0')
    const d = String(target.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}T00:00:00`
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

  const normalizeStatus = (value) => (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
  const isResponseFinished = (value) => {
    const normalized = normalizeStatus(value)
    return normalized === 'concluido' || normalized === 'concluida'
  }
  const isStatusSuccess = (value) => normalizeStatus(value) === 'sucesso'
  const hasValidName = (value) => typeof value === 'string' && value.trim().length > 0

  async function fetchBanco(code) {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/banks/v1/${code}`)
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      return { code: data.code || code, name: data.name || data.fullName || String(code) }
    } catch (_) {
      return { code, name: String(code) }
    }
  }

  const getConsultaInput = () => {
    if (Number(metrics.disponivel) <= 0) {
      notify.warn('Sem saldo disponivel para realizar consultas.')
      return null
    }
    const digits = cpf.replace(/\D/g, '')
    let benDigits = beneficio.replace(/\D/g, '')
    if (digits.length !== 11) {
      notify.warn('Informe um CPF valido (11 digitos).')
      return null
    }
    if (benDigits.length > 10) {
      notify.warn('Informe um beneficio valido (10 digitos).')
      return null
    }
    if (benDigits.length < 10) {
      benDigits = benDigits.padStart(10, '0')
    }
    return { digits, benDigits }
  }

  const getBmgInput = () => {
    const digitsOnly = (value) => String(value || '').replace(/\D/g, '')
    const nomeCompleto = bmgForm.nomeCompleto.trim()
    const dataNascimento = bmgForm.dataNascimento
    const cidade = bmgForm.cidade.trim()
    const estado = bmgForm.estado.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
    const ddd = digitsOnly(bmgForm.ddd).slice(0, 2)
    const telefone = digitsOnly(bmgForm.telefone)
    if (!nomeCompleto) {
      notify.warn('Informe o nome completo.')
      return null
    }
    if (!dataNascimento) {
      notify.warn('Informe a data de nascimento.')
      return null
    }
    if (!cidade) {
      notify.warn('Informe a cidade.')
      return null
    }
    if (estado.length !== 2) {
      notify.warn('Informe o estado com 2 letras.')
      return null
    }
    if (ddd.length !== 2) {
      notify.warn('Informe o DDD.')
      return null
    }
    if (telefone.length < 8) {
      notify.warn('Informe o telefone.')
      return null
    }
    return {
      nomeCompleto,
      dataNascimento: `${dataNascimento}T00:00:00`,
      cidade,
      estado,
      ddd,
      telefone,
    }
  }

  const onSearchMacica = () => {
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) {
      notify.warn('Informe um CPF valido (11 digitos) para pesquisar na Macica.')
      return
    }
    const MOCK_CPF = '70576084700'
    const MOCK_BEN = '2128805508'
    if (digits === MOCK_CPF) {
      setBeneficio(formatBeneficio(MOCK_BEN))
      notify.success('Benefício localizado na Maciça e preenchido automaticamente.')
    } else {
      notify.info('Nenhum benefício localizado na Maciça para este CPF (mock).')
    }
  }

  const openBmgModal = () => {
    setBmgModalOpen(true)
    setBmgStep('form')
    setBmgStatus('idle')
    setBmgResponse('')
    setBmgError('')
    setBmgRawResponse('')
    setBmgRequest(null)
    setBmgPesquisarStatus('idle')
    setBmgPesquisarError('')
    setBmgPesquisarRaw('')
    setBmgNumeroSolicitacao('')
    setBmgToken('')
    setBmgAvulsaStatus('idle')
    setBmgAvulsaError('')
    setBmgAvulsaRaw('')
    setBmgResultado(null)
  }

  const handleSearch = (event) => {
    event?.preventDefault?.()
    const input = getConsultaInput()
    if (!input) return
    setResultado(null)
    setBancoInfo(null)
    setBmgResultado(null)
    if (providerChoice === 'bmg') {
      if (!canUseBmg) {
        notify.warn('Consulta BMG desativada.')
        return
      }
      openBmgModal()
      return
    }
    onSubmit(null, 'qualibanking', null, input)
  }

  const handleBmgSubmit = (event) => {
    event?.preventDefault?.()
    if (!canUseBmg) {
      notify.warn('Apenas Master pode consultar no BMG.')
      return
    }
    const input = getConsultaInput()
    if (!input) return
    const bmgData = getBmgInput()
    if (!bmgData) return
    setBmgStep('response')
    onSubmit(null, 'bmg', bmgData, input)
  }

  const submitBmg = async (input, bmgData) => {
    if (!canUseBmg) {
      notify.warn('Apenas Master pode consultar no BMG.')
      return
    }
    if (!BMG_SOAP_URL) {
      setBmgStatus('error')
      setBmgError('URL do BMG nao configurada. Defina VITE_BMG_SOAP_URL no .env.')
      notify.error('URL do BMG nao configurada. Defina VITE_BMG_SOAP_URL no .env.')
      return
    }
    if (!BMG_LOGIN || !BMG_PASSWORD) {
      setBmgStatus('error')
      setBmgError('Credenciais do BMG nao configuradas.')
      notify.error('Credenciais do BMG nao configuradas.')
      return
    }
    const payload = {
      login: BMG_LOGIN,
      senha: BMG_PASSWORD,
      cidade: bmgData.cidade.toUpperCase(),
      cpf: input.digits,
      dataNascimento: bmgData.dataNascimento,
      ddd: bmgData.ddd,
      estado: bmgData.estado.toUpperCase(),
      matricula: input.benDigits,
      nome: bmgData.nomeCompleto.toUpperCase(),
      telefone: bmgData.telefone,
    }
    setBmgStatus('loading')
    setBmgResponse('')
    setBmgError('')
    setBmgRawResponse('')
    setBmgRequest(payload)
    try {
      loader.begin()
      const headers = { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: BMG_SOAP_ACTION }
      const res = await fetch(BMG_SOAP_URL, {
        method: 'POST',
        headers,
        body: buildBmgEnvelope(payload),
      })
      const text = await res.text()
      if (!text || !text.trim()) {
        const msg = `Resposta vazia do BMG (HTTP ${res.status}).`
        throw new Error(msg)
      }
      setBmgRawResponse(text)
      const parsed = parseBmgSoapResponse(text)
      if (!res.ok) {
        const reason = parsed.fault || `Erro HTTP ${res.status}`
        throw new Error(reason)
      }
      if (parsed.fault) {
        setBmgStatus('error')
        setBmgError(parsed.fault)
        notify.error(parsed.fault)
        return
      }
      setBmgStatus('success')
      setBmgResponse(parsed.message || 'Resposta recebida do BMG.')
      notify.success('Solicitacao enviada ao BMG.', { autoClose: 6000 })
    } catch (err) {
      setBmgStatus('error')
      setBmgError(err?.message || 'Erro ao consultar BMG.')
      notify.error(err?.message || 'Erro ao consultar BMG.')
    } finally {
      loader.end()
    }
  }

  const pesquisarBmg = async (cpfDigits) => {
    if (!canUseBmg) {
      setBmgPesquisarStatus('error')
      setBmgPesquisarError('Apenas Master pode consultar no BMG.')
      return
    }
    if (!BMG_SOAP_URL) {
      setBmgPesquisarStatus('error')
      setBmgPesquisarError('URL do BMG nao configurada.')
      return
    }
    if (!BMG_LOGIN || !BMG_PASSWORD) {
      setBmgPesquisarStatus('error')
      setBmgPesquisarError('Credenciais do BMG nao configuradas.')
      return
    }
    const payload = {
      login: BMG_LOGIN,
      senha: BMG_PASSWORD,
      cpf: cpfDigits,
      periodoInicial: buildDateWithOffset(-89), // 90 dias atras a partir de amanha
      periodoFinal: buildDateWithOffset(1),
    }
    setBmgPesquisarStatus('loading')
    setBmgPesquisarError('')
    setBmgPesquisarRaw('')
    setBmgNumeroSolicitacao('')
    try {
      loader.begin()
      const res = await fetch(BMG_SOAP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: 'pesquisar' },
        body: buildPesquisarEnvelope(payload),
      })
      const text = await res.text()
      if (!text || !text.trim()) {
        throw new Error(`Resposta vazia do BMG (HTTP ${res.status}).`)
      }
      setBmgPesquisarRaw(text)
      if (!res.ok) {
        const parsed = parseBmgSoapResponse(text)
        throw new Error(parsed.fault || `Erro HTTP ${res.status}`)
      }
      const numeroSolicitacao = parseNumeroSolicitacao(text)
      if (!numeroSolicitacao) {
        throw new Error('Numero da solicitacao nao encontrado.')
      }
      setBmgNumeroSolicitacao(numeroSolicitacao)
      setBmgPesquisarStatus('success')
      return numeroSolicitacao
    } catch (err) {
      setBmgPesquisarStatus('error')
      setBmgPesquisarError(err?.message || 'Erro ao pesquisar solicitacao.')
      throw err
    } finally {
      loader.end()
    }
  }

  const enviarTokenBmg = async () => {
    if (!canUseBmg) {
      notify.warn('Apenas Master pode consultar no BMG.')
      return
    }
    if (!bmgNumeroSolicitacao || !bmgToken) {
      notify.warn('Informe o token recebido via SMS.')
      return
    }
    if (!BMG_SOAP_URL) {
      setBmgAvulsaStatus('error')
      setBmgAvulsaError('URL do BMG nao configurada.')
      return
    }
    setBmgAvulsaStatus('loading')
    setBmgAvulsaError('')
    setBmgAvulsaRaw('')
    try {
      loader.begin()
      const payload = {
        login: BMG_LOGIN,
        senha: BMG_PASSWORD,
        numeroSolicitacao: bmgNumeroSolicitacao,
        token: bmgToken,
      }
      const res = await fetch(BMG_SOAP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: 'realizarConsultaAvulsa' },
        body: buildAvulsaEnvelope(payload),
      })
      const text = await res.text()
      if (!text || !text.trim()) {
        throw new Error(`Resposta vazia do BMG (HTTP ${res.status}).`)
      }
      setBmgAvulsaRaw(text)
      if (!res.ok) {
        const parsed = parseBmgSoapResponse(text)
        throw new Error(parsed.fault || `Erro HTTP ${res.status}`)
      }
      const parsedResult = parseAvulsaResponse(text)
      if (parsedResult) {
        if (!parsedResult.estado) parsedResult.estado = bmgForm.estado
        if (!parsedResult.cidade) parsedResult.cidade = bmgForm.cidade
        setBmgResultado(parsedResult)
      }
      setBmgAvulsaStatus('success')
      notify.success('Token validado. Consulta BMG concluida.', { autoClose: 6000 })
      setResultado(null)
      setBancoInfo(null)
      setBmgModalOpen(false)
    } catch (err) {
      setBmgAvulsaStatus('error')
      setBmgAvulsaError(err?.message || 'Erro ao validar token.')
      notify.error(err?.message || 'Erro ao validar token.')
    } finally {
      loader.end()
    }
  }

  const onSubmit = async (e, provider = 'qualibanking', bmgOverride = null, inputOverride = null) => {
    e?.preventDefault?.()
    const input = inputOverride || getConsultaInput()
    if (!input) return
    if (provider === 'bmg') {
      const bmgData = bmgOverride || getBmgInput()
      if (!bmgData) return
      await submitBmg(input, bmgData)
      return
    }
    setBmgResultado(null)
    const { digits, benDigits } = input
    try {
      loader.begin()
      try {
        if (online) {
          // 1) Dispara consulta online
          const urlConsulta = 'https://n8n.apivieiracred.store/webhook/consulta-online'
          const equipeId = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
          const limiteDisponivel = Number(metrics.disponivel ?? 0)
          const consultaPayload = {
            id: (typeof user?.id !== 'undefined' ? user.id : user),
            cpf: digits,
            nb: benDigits,
            limite_disponivel: limiteDisponivel,
          }
          if (equipeId != null) {
            consultaPayload.equipe_id = equipeId
            consultaPayload.team_id = equipeId
            consultaPayload.id_equipe = equipeId
          }
          const resConsulta = await fetch(urlConsulta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(consultaPayload)
          })
          if (!resConsulta.ok) throw new Error('Falha na consulta online')

          // 2) Buscar resposta final no n8n com os dados completos para o front
          const urlResposta = 'https://n8n.apivieiracred.store/webhook/resposta-api'
          // Aguarda 5s antes da primeira consulta de resposta
          await new Promise(r => setTimeout(r, 5000))
          const isValidResposta = (d) => {
            if (!Array.isArray(d) || d.length === 0) return false
            const o = d[0] || {}
            return (
              typeof o.id !== 'undefined' &&
              !!o.numero_beneficio &&
              !!o.numero_documento &&
              hasValidName(o.nome) &&
              isStatusSuccess(o.status_api) &&
              isResponseFinished(o.resposta_api)
            )
          }
          let arr = null
          let respostaTries = 0
          while (true) {
            respostaTries++
            const resResposta = await fetch(urlResposta, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: user?.id, cpf: digits, nb: benDigits, limite_disponivel: limiteDisponivel })
            })
            if (resResposta.ok) {
              const dataTry = await resResposta.json().catch(() => null)
              if (Array.isArray(dataTry) && dataTry.length > 0) {
                const o = dataTry[0] || {}
                if (isResponseFinished(o.resposta_api)) {
                  if (!hasValidName(o.nome)) {
                    setResultado(null)
                    setBancoInfo(null)
                    loader.end()
                    notify.warn((o.status_api || '').trim() || 'A consulta foi concluída, mas os dados do beneficiário não foram retornados.')
                    return
                  }
                  if (!isStatusSuccess(o.status_api)) {
                    loader.end()
                    notify.error((o.status_api || '').trim() || 'Erro na consulta online')
                    return
                  }
                }
                if (isValidResposta(dataTry)) { arr = dataTry; break }
              }
            }
            if (respostaTries >= 5 && (respostaTries % 5) === 0) {
              notify.warn(
                'Devido a instabilidade na AWS o tempo de consultas pode levar mais de 5min para trazer o resultado. Qualibanking API',
                { autoClose: 15000, toastId: 'aws-qualibanking-delay' }
              )
            }
            await new Promise(r => setTimeout(r, 30000))
          }
          const d = Array.isArray(arr) ? (arr[0] || {}) : (arr || {})

          const mapped = {
            id: d.id || null,
            id_usuario: d.id_usuario || d.usuarioId || user?.id || null,
            numero_beneficio: d.numero_beneficio || benDigits,
            numero_documento: d.numero_documento || digits,
            nome: d.nome || '',
            estado: d.estado || '',
            pensao: d.pensao || 'not_payer',
            data_nascimento: d.data_nascimento || null,
            tipo_bloqueio: d.tipo_bloqueio || 'not_blocked',
            data_concessao: d.data_concessao || null,
            data_final_beneficio: d.data_final_beneficio || null,
            tipo_credito: d.tipo_credito || 'magnetic_card',
            situacao_beneficio: d.situacao_beneficio || 'elegible',
            limite_cartao_beneficio: d.limite_cartao_beneficio ?? null,
            saldo_cartao_beneficio: d.saldo_cartao_beneficio ?? 0,
            limite_cartao_consignado: d.limite_cartao_consignado ?? null,
            saldo_cartao_consignado: d.saldo_cartao_consignado ?? 0,
            saldo_credito_consignado: d.saldo_credito_consignado ?? 0,
            saldo_total_maximo: d.saldo_total_maximo ?? 0,
            saldo_total_utilizado: d.saldo_total_utilizado ?? 0,
            saldo_total_disponivel: d.saldo_total_disponivel ?? 0,
            data_consulta: d.data_consulta || new Date().toISOString(),
            data_retorno_consulta: d.data_retorno_consulta || new Date().toISOString(),
            nome_representante_legal: d.nome_representante_legal || null,
            banco_desembolso: d.banco_desembolso || null,
            agencia_desembolso: d.agencia_desembolso || null,
            conta_desembolso: d.conta_desembolso || null,
            digito_desembolso: d.digito_desembolso || null,
            numero_portabilidades: d.numero_portabilidades ?? 0,
            resposta_api: d.resposta_api || 'Concluído',
            status_api: d.status_api || 'Sucesso',
            tipo: 'online',
          }

          setResultado(mapped)
          if (mapped.banco_desembolso) {
            try { setBancoInfo(await fetchBanco(mapped.banco_desembolso)) } catch { setBancoInfo(null) }
          }

          // 3) Após a resposta final, atualiza os saldos agregados (cards)
          await fetchSaldoUsuario()
          loader.end()
          notify.success('Consulta online concluida', { autoClose: 15000 })
          return
        }
        // Fluxo OFFLINE: chamada direta para webhook resposta-api
        const urlRespostaOffline = 'https://n8n.apivieiracred.store/webhook/resposta-api'
        // Aguarda 5s antes de buscar a resposta offline
        await new Promise(r => setTimeout(r, 5000))
        const limiteDisponivel = Number(metrics.disponivel ?? 0)
        const resOff = await fetch(urlRespostaOffline, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user?.id, cpf: digits, nb: benDigits, limite_disponivel: limiteDisponivel })
        })
        if (!resOff.ok) throw new Error('Falha na consulta (offline)')
        const dataOff = await resOff.json().catch(() => null)
        if (!Array.isArray(dataOff) || dataOff.length === 0) throw new Error('Resposta invalida (offline)')
        const o = dataOff[0] || {}
        if (isResponseFinished(o.resposta_api)) {
          if (!hasValidName(o.nome)) {
            setResultado(null)
            setBancoInfo(null)
            loader.end()
            notify.warn((o.status_api || '').trim() || 'A consulta foi concluída, mas os dados do beneficiário não foram retornados.')
            return
          }
          if (!isStatusSuccess(o.status_api)) {
            loader.end()
            notify.error((o.status_api || '').trim() || 'Erro na consulta (offline)')
            return
          }
        }
        // validar formato mínimo esperado
        if (!(typeof o.id !== 'undefined' && o.numero_beneficio && o.numero_documento && o.nome)) {
          throw new Error('Resposta incompleta (offline)')
        }
        const mappedOff = {
          id: o.id || null,
          id_usuario: o.id_usuario || o.usuarioId || user?.id || null,
          numero_beneficio: o.numero_beneficio || benDigits,
          numero_documento: o.numero_documento || digits,
          nome: o.nome || '',
          estado: o.estado || '',
          pensao: o.pensao || 'not_payer',
          data_nascimento: o.data_nascimento || null,
          tipo_bloqueio: o.tipo_bloqueio || 'not_blocked',
          data_concessao: o.data_concessao || null,
          data_final_beneficio: o.data_final_beneficio || null,
          tipo_credito: o.tipo_credito || 'magnetic_card',
          situacao_beneficio: o.situacao_beneficio || 'elegible',
          limite_cartao_beneficio: o.limite_cartao_beneficio ?? null,
          saldo_cartao_beneficio: o.saldo_cartao_beneficio ?? 0,
          limite_cartao_consignado: o.limite_cartao_consignado ?? null,
          saldo_cartao_consignado: o.saldo_cartao_consignado ?? 0,
          saldo_credito_consignado: o.saldo_credito_consignado ?? 0,
          saldo_total_maximo: o.saldo_total_maximo ?? 0,
          saldo_total_utilizado: o.saldo_total_utilizado ?? 0,
          saldo_total_disponivel: o.saldo_total_disponivel ?? 0,
          data_consulta: o.data_consulta || new Date().toISOString(),
          data_retorno_consulta: o.data_retorno_consulta || new Date().toISOString(),
          nome_representante_legal: o.nome_representante_legal || null,
          banco_desembolso: o.banco_desembolso || null,
          agencia_desembolso: o.agencia_desembolso || null,
          conta_desembolso: o.conta_desembolso || null,
          digito_desembolso: o.digito_desembolso || null,
          numero_portabilidades: o.numero_portabilidades ?? 0,
          resposta_api: o.resposta_api || 'Concluído',
          status_api: o.status_api || 'Sucesso',
          tipo: 'offline',
        }
        setResultado(mappedOff)
        if (mappedOff.banco_desembolso) {
          try { setBancoInfo(await fetchBanco(mappedOff.banco_desembolso)) } catch { setBancoInfo(null) }
        }
        await fetchSaldoUsuario()
        loader.end()
        notify.success('Consulta concluida', { autoClose: 15000 })
        return
      } catch (err) {
        loader.end()
        notify.error(err?.message || 'Erro na consulta online')
        return
      }
      const mock = {
        id: 3054,
        id_usuario: 1,
        numero_beneficio: benDigits,
        numero_documento: digits,
        nome: 'MARTA ANDRADE DA SILVA',
        estado: 'RJ',
        pensao: 'not_payer',
        data_nascimento: '1962-08-21T00:00:00.000Z',
        tipo_bloqueio: 'not_blocked',
        data_concessao: '2025-04-01T00:00:00.000Z',
        data_final_beneficio: null,
        tipo_credito: 'magnetic_card',
        situacao_beneficio: 'elegible',
        saldo_cartao_beneficio: 0,
        saldo_cartao_consignado: 0,
        saldo_credito_consignado: 0.01,
        saldo_total_disponivel: 0.01,
        saldo_total_maximo: 807.92,
        saldo_total_utilizado: 807.91,
        numero_portabilidades: 5,
        banco_desembolso: '069',
        agencia_desembolso: '0001',
        conta_desembolso: null,
        digito_desembolso: null,
        status_api: 'Sucesso',
        resposta_api: 'Concluído',
        data_consulta: '2025-09-22T11:20:00.000Z',
        data_retorno_consulta: '2025-09-22T11:20:00.000Z',
        nome_representante_legal: null,
        tipo: online ? 'online' : 'offline',
      }
      setResultado(mock)
      try { setBancoInfo(await fetchBanco(mock.banco_desembolso)) } catch { setBancoInfo(null) }
      loader.end()
      notify.success('Consulta concluida', { autoClose: 15000 })
    } finally {
      loader.end()
    }

  }

  const bmgSteps = ['form', 'response', 'token']
  const bmgStepLabels = { form: 'Dados', response: 'Validação', token: 'Token SMS' }
  const bmgStepIndex = bmgSteps.indexOf(bmgStep)
  const bmgProgressValue = bmgStepIndex >= 0 ? Math.round(((bmgStepIndex + 1) / bmgSteps.length) * 100) : 0
  const bmgProgress = (
    <div className="mb-3">
      <div className="d-flex align-items-center justify-content-between small mb-2">
        {bmgSteps.map((step) => (
          <span key={step} className={bmgStep === step ? 'fw-semibold' : 'opacity-75'}>
            {bmgStepLabels[step]}
          </span>
        ))}
      </div>
      <div className="progress" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="progress-bar"
          role="progressbar"
          style={{ width: `${bmgProgressValue}%`, backgroundColor: '#f36c21' }}
          aria-valuenow={bmgProgressValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )

  const normalizeBmgMessage = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const BMG_TOKEN_SUCCESS_MSG = 'Foi enviado um TOKEN de validação no celular indicado. Gentileza coletá-lo com o cliente e informá-lo no serviço realizarConsultaAvulsa.'
  const isBmgTokenSuccess = normalizeBmgMessage(bmgResponse) === normalizeBmgMessage(BMG_TOKEN_SUCCESS_MSG)

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Consulta Individual (IN100)</h2>
              <div className="opacity-75 small">Faça buscas individuais por CPF e benefício</div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-5">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex flex-column gap-3">
                <div>
                  <div className="small text-uppercase opacity-75">Total Carregado</div>
                  <div className="display-6 fw-bold">{metrics.totalCarregado}</div>
                </div>
                <div>
                    <div className="small text-uppercase opacity-75">{'Disponível'}</div>
                  <div className="display-6 fw-bold">{metrics.disponivel}</div>
                </div>
                <div>
                  <div className="small text-uppercase opacity-75">Consultas Realizadas</div>
                  <div className="display-6 fw-bold">{metrics.realizadas}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <form className="neo-card neo-lg p-4 h-100" onSubmit={handleSearch} ref={formRef}>
              <div className="mb-3">
                <label className="form-label">CPF</label>
                <div className="input-group align-items-stretch">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    required
                  />
                  {/* botão de copiar CPF removido conforme solicitação */}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Benefício</label>
                <div className="input-group align-items-stretch">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-control"
                    placeholder="000.000.000-0"
                    value={beneficio}
                    onChange={(e) => setBeneficio(formatBeneficio(e.target.value))}
                    required
                  />
                  {/* botão de copiar NB removido conforme solicitação */}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Consulta</label>
                <div className="d-flex flex-wrap gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="provider"
                      id="provider-qualibanking"
                      value="qualibanking"
                      checked={providerChoice === 'qualibanking'}
                      onChange={() => setProviderChoice('qualibanking')}
                    />
                    <label className="form-check-label" htmlFor="provider-qualibanking">Consulta Qualibanking</label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="provider"
                      id="provider-bmg"
                      value="bmg"
                      checked={providerChoice === 'bmg'}
                      onChange={() => setProviderChoice('bmg')}
                    />
                    <label className="form-check-label" htmlFor="provider-bmg">Consulta BMG</label>
                  </div>
                </div>
              </div>

              <div>
                <button type="submit" className="btn btn-primary btn-pesquisar" disabled={Number(metrics.disponivel) <= 0}>Pesquisar</button>
              </div>
            </form>
          </div>
        </div>

        {canUseBmg && bmgModalOpen && (
          <div
            className="modal fade show"
            style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 'min(92vw, 760px)' }}>
              <div
                className="modal-content modal-dark"
                style={{
                  background:
                    'radial-gradient(260px 260px at 0% 0%, rgba(243,108,33,0.6) 0%, rgba(243,108,33,0.25) 35%, rgba(20,20,20,0) 60%), linear-gradient(180deg, #0b0b0b 0%, #141414 100%)',
                }}
              >
                <div className="modal-header">
                  <h5 className="modal-title">
                    {bmgStep === 'form' && 'Dados adicionais para consulta BMG'}
                    {bmgStep === 'response' && 'Validação'}
                    {bmgStep === 'token' && 'Token SMS'}
                  </h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setBmgModalOpen(false)}></button>
                </div>
                {bmgStep === 'form' && (
                  <form onSubmit={handleBmgSubmit}>
                    <div className="modal-body">
                      {bmgProgress}
                      <div className="row g-3 mb-2">
                        <div className="col-12 col-md-6">
                          <label className="form-label">CPF</label>
                          <input type="text" className="form-control" value={formatCpf(cpf)} readOnly />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">NB</label>
                        <input type="text" className="form-control" value={formatBeneficioDisplay(beneficio)} readOnly />
                        </div>
                      </div>
                      <div className="row g-3">
                        <div className="col-12">
                          <label className="form-label">Nome Completo</label>
                          <input
                            type="text"
                            className="form-control"
                            value={bmgForm.nomeCompleto}
                            onChange={(e) => setBmgForm((prev) => ({ ...prev, nomeCompleto: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label">Data de Nascimento</label>
                          <input
                            type="date"
                            className="form-control"
                            value={bmgForm.dataNascimento}
                            onChange={(e) => setBmgForm((prev) => ({ ...prev, dataNascimento: e.target.value }))}
                            required
                          />
                        </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label">Cidade</label>
                        <input
                          type="text"
                          className="form-control text-uppercase"
                          value={bmgForm.cidade}
                          onChange={(e) =>
                            setBmgForm((prev) => ({
                              ...prev,
                              cidade: e.target.value.toUpperCase(),
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label">Estado</label>
                        <select
                          className="form-select text-uppercase"
                          value={bmgForm.estado}
                          onChange={(e) =>
                            setBmgForm((prev) => ({
                              ...prev,
                              estado: e.target.value.toUpperCase(),
                            }))
                          }
                          required
                        >
                          <option value="">Selecione</option>
                          {UF_OPTIONS.map((uf) => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                        <div className="col-12">
                          <div className="form-text" style={{ color: '#f36c21' }}>
                            Para receber o token, por favor coloque o proprio numero do telefone para isso.
                          </div>
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label">DDD</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="form-control"
                            value={bmgForm.ddd}
                            onChange={(e) =>
                              setBmgForm((prev) => ({
                                ...prev,
                                ddd: e.target.value.replace(/\D/g, '').slice(0, 2),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label">Telefone</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="form-control"
                            value={bmgForm.telefone}
                            onChange={(e) =>
                              setBmgForm((prev) => ({
                                ...prev,
                                telefone: e.target.value.replace(/\D/g, '').slice(0, 11),
                              }))
                            }
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setBmgModalOpen(false)}>
                        Cancelar
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Enviar Token
                      </button>
                    </div>
                  </form>
                )}
                {bmgStep === 'response' && (
                  <>
                    <div className="modal-body">
                      {bmgProgress}
                      <div className="d-flex flex-column gap-3">
                        {bmgRequest && (
                          <div className="small opacity-75">
                            CPF: {formatCpf(String(bmgRequest.cpf))} • NB: {formatBeneficioDisplay(String(bmgRequest.matricula))}
                          </div>
                        )}
                        {bmgPesquisarStatus === 'loading' && (
                          <div className="small text-warning">Buscando numero da solicitacao...</div>
                        )}
                        {bmgPesquisarStatus === 'error' && (
                          <div className="text-danger">{bmgPesquisarError || 'Erro ao buscar numero da solicitacao.'}</div>
                        )}
                        {bmgStatus === 'loading' && (
                          <div className="opacity-75">Enviando solicitacao ao BMG e aguardando retorno...</div>
                        )}
                        {bmgStatus === 'error' && (
                          <div className="text-danger">{bmgError || 'Erro ao consultar BMG.'}</div>
                        )}
                        {bmgStatus === 'success' && (
                          <div className={`fw-semibold ${isBmgTokenSuccess ? 'text-success' : ''}`}>
                            {bmgResponse || 'Resposta recebida do BMG.'}
                          </div>
                        )}
                        {bmgStatus === 'idle' && (
                          <div className="opacity-75">Aguardando envio.</div>
                        )}
                        {bmgRawResponse && (
                          <details>
                            <summary className="small">Ver resposta bruta</summary>
                            <pre className="mt-2 small">{bmgRawResponse}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setBmgStep('form')}>
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!isBmgTokenSuccess || bmgPesquisarStatus === 'loading'}
                        onClick={async () => {
                          try {
                            const digits = cpf.replace(/\D/g, '')
                            await pesquisarBmg(digits)
                            setBmgStep('token')
                          } catch {
                            // erro exibido no estado
                          }
                        }}
                      >
                        {bmgPesquisarStatus === 'loading' ? 'Buscando...' : 'Continuar'}
                      </button>
                    </div>
                  </>
                )}
                {bmgStep === 'token' && (
                  <>
                    <div className="modal-body">
                      {bmgProgress}
                      <div className="d-flex flex-column gap-3">
                        <div className="small opacity-75">
                          Informe o token recebido via SMS para continuar.
                        </div>
                        <div className="row g-3">
                          <div className="col-12 col-md-6">
                            <label className="form-label">Número da solicitação</label>
                            <input type="text" className="form-control" value={bmgNumeroSolicitacao} readOnly />
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label">Token</label>
                            <input
                              type="text"
                              className="form-control text-uppercase"
                              maxLength={6}
                              value={bmgToken}
                              onChange={(e) => setBmgToken(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                              placeholder="Ex: ABCD"
                            />
                          </div>
                        </div>
                        {bmgAvulsaStatus === 'error' && (
                          <div className="text-danger">{bmgAvulsaError || 'Erro ao validar token.'}</div>
                        )}
                        {bmgAvulsaStatus === 'success' && (
                          <div className="text-success">Token enviado. Resposta recebida (sem processamento).</div>
                        )}
                        {bmgAvulsaRaw && (
                          <details>
                            <summary className="small">Ver resposta bruta</summary>
                            <pre className="mt-2 small">{bmgAvulsaRaw}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setBmgStep('response')}>
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!bmgToken || bmgAvulsaStatus === 'loading'}
                        onClick={enviarTokenBmg}
                      >
                        {bmgAvulsaStatus === 'loading' ? 'Enviando...' : 'Validar Token'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {canUseBmg && bmgResultado && (
          <section className="mt-4 result-section">
            <div className="neo-card result-hero bmg-hero p-4 mb-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0 d-flex align-items-center gap-2"><FiUser /> Dados Pessoais</h5>
                <div className="small opacity-75">
                  Atualizado: {formatBmgDate(bmgResultado.dataConsulta)} as {formatBmgTime(bmgResultado.dataConsulta)}
                </div>
              </div>
              <div className="row g-3">
                <div className="col-12 col-lg-4">
                  <div className="label">Nome</div>
                  <div className="value fw-semibold">{bmgResultado.nome || '-'}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label d-flex align-items-center gap-1"><FiHash /> CPF</div>
                  <div className="value d-flex align-items-center gap-2">
                    <span>{bmgResultado.cpf ? formatCpf(String(bmgResultado.cpf)) : '-'}</span>
                  </div>
                </div>
                <div className="col-6 col-lg-3">
                  <div className="label d-flex align-items-center gap-1"><FiCalendar /> Idade</div>
                  <div className="value">
                    {formatBmgDate(bmgResultado.dataNascimento)}
                    {bmgAgeFrom(bmgResultado.dataNascimento) != null && (
                      <span className="ms-1">({bmgAgeFrom(bmgResultado.dataNascimento)} anos)</span>
                    )}
                  </div>
                </div>
                <div className="col-6 col-lg-1">
                  <div className="label">Espécie</div>
                  <div className="value">{bmgResultado.especie || '-'}</div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-3 bmg-outline">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Informações da matrícula</h6>
              </div>
              <div className="kv-list p-3 p-md-4">
                <div className="kv-line">
                  <div className="kv-label">NB:</div>
                  <div className="kv-value">{bmgResultado.numeroBeneficio ? formatBeneficioDisplay(String(bmgResultado.numeroBeneficio)) : '-'}</div>
                  <div className="kv-label">Espécie:</div>
                  <div className="kv-value">{bmgResultado.especie || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Data Despacho do Benefício:</div>
                  <div className="kv-value">{formatBmgDate(bmgResultado.dataDespachoBeneficio)}</div>
                  <div className="kv-label">Elegível Empréstimo:</div>
                  <div className="kv-value">{mapBool(bmgResultado.elegivelEmprestimo)}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Quantidade de Empréstimos:</div>
                  <div className="kv-value">{bmgResultado.qtdEmprestimos || '-'}</div>
                  <div className="kv-label"></div>
                  <div className="kv-value"></div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-3 bmg-outline">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Endereço</h6>
              </div>
              <div className="kv-list p-3 p-md-4">
                <div className="kv-line">
                  <div className="kv-label">Cidade:</div>
                  <div className="kv-value">{bmgResultado.cidade || '-'}</div>
                  <div className="kv-label">UF:</div>
                  <div className="kv-value">{bmgResultado.estado || '-'}</div>
                </div>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card bmg-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Margem disponível:</div>
                    <div className="stat-value">{bmgMoney(bmgResultado.margemDisponivel)}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card bmg-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Margem disp. Cartão:</div>
                    <div className="stat-value">{bmgMoney(bmgResultado.margemDisponivelCartao)}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card bmg-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Margem disp. RCC:</div>
                    <div className="stat-value">{bmgMoney(bmgResultado.margemDisponivelRcc)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-4 bmg-outline">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Dados bancários</h6>
              </div>
              <div className="kv-list p-3 p-md-4">
                <div className="kv-line">
                  <div className="kv-label">Conta Corrente:</div>
                  <div className="kv-value">{bmgResultado.contaCorrente || '-'}</div>
                  <div className="kv-label">Agência Pagadora:</div>
                  <div className="kv-value">{bmgResultado.agenciaPagadora || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Valor Comprometido:</div>
                  <div className="kv-value">{bmgMoney(bmgResultado.valorComprometido)}</div>
                  <div className="kv-label">Valor Limite Cartão:</div>
                  <div className="kv-value">{bmgMoney(bmgResultado.valorLimiteCartao)}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Valor Limite RCC:</div>
                  <div className="kv-value">{bmgMoney(bmgResultado.valorLimiteRcc)}</div>
                  <div className="kv-label">Valor Máximo Comprometimento:</div>
                  <div className="kv-value">{bmgMoney(bmgResultado.valorMaximoComprometimento)}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {resultado && (
          <>
            <section className="mt-4 result-section" ref={resultRef} id="result-print">
              <div className="neo-card neo-lg p-4 d-none">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="mb-0">Resultados da Consulta</h5>
                  <div className="small opacity-75">Ultima Atualizacao: {formatDate(resultado.data_retorno_consulta)} as {formatTime(resultado.data_retorno_consulta)}</div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Informações básicas</div>
                      <div className="small opacity-75">Benefício:</div>
                      <div className="mb-2">{resultado.numero_beneficio}</div>
                      <div className="small opacity-75">CPF:</div>
                      <div className="mb-2">{resultado.numero_documento}</div>
                      <div className="small opacity-75">Nome:</div>
                      <div className="mb-2">{resultado.nome}</div>
                      <div className="small opacity-75">Estado:</div>
                      <div>{resultado.estado}</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Informações pessoais</div>
                      <div className="small opacity-75">Pensao:</div>
                      <div className="mb-2">{mapPensao(resultado.pensao)}</div>
                      <div className="small opacity-75">Data de Nascimento:</div>
                      <div className="mb-2">{formatDate(resultado.data_nascimento)}</div>
                      <div className="small opacity-75">Idade:</div>
                      <div className="mb-2">{idadeFrom(resultado.data_nascimento)}</div>
                      <div className="small opacity-75">Tipo de Bloqueio:</div>
                      <div>{mapBloqueio(resultado.tipo_bloqueio)}</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Informações do benefício</div>
                      <div className="small opacity-75">Data de concessão:</div>
                      <div className="mb-2">{formatDate(resultado.data_concessao)}</div>
                      <div className="small opacity-75">Término do benefício:</div>
                      <div className="mb-2">{resultado.data_final_beneficio ? formatDate(resultado.data_final_beneficio) : '-'}</div>
                      <div className="small opacity-75">Tipo de crédito:</div>
                      <div className="mb-2">{mapTipoCredito(resultado.tipo_credito)}</div>
                      <div className="small opacity-75">Status do benefício:</div>
                      <div>{mapSituacao(resultado.situacao_beneficio)}</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Informações financeiras</div>
                      <div className="small opacity-75">Saldo Cartão Benefício:</div>
                      <div className="mb-2">{brCurrency(resultado.saldo_cartao_beneficio)}</div>
                      <div className="small opacity-75">Saldo Cartão Consignado:</div>
                      <div className="mb-2">{brCurrency(resultado.saldo_cartao_consignado)}</div>
                      <div className="small opacity-75">{'Margem disponível'}:</div>
                      <div className="mb-2">{brCurrency(resultado.saldo_total_disponivel)}</div>
                      <div className="small opacity-75">Empréstimos ativos:</div>
                      <div>{resultado.numero_portabilidades}</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Informações bancárias</div>
                      <div className="small opacity-75">Banco de Desembolso:</div>
                      <div className="mb-2">{resultado.banco_desembolso}</div>
                      <div className="small opacity-75">Nome do Banco:</div>
                      <div className="mb-2">{bancoInfo?.name || '-'}</div>
                      <div className="small opacity-75">Agência:</div>
                      <div className="mb-2">{resultado.agencia_desembolso || '-'}</div>
                      <div className="small opacity-75">Conta:</div>
                      <div className="mb-2">{resultado.conta_desembolso || '-'}</div>
                      <div className="small opacity-75">Dígito:</div>
                      <div>{resultado.digito_desembolso || '-'}</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Representante Legal</div>
                      <div className="small opacity-75">Nome:</div>
                      <div>{resultado.nome_representante_legal || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            {/* Novo layout de resposta */}
            <div className="neo-card result-hero p-4 mb-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0 d-flex align-items-center gap-2"><FiUser /> Dados Pessoais</h5>
                <div className="small opacity-75">Atualizado: {formatDate(resultado.data_retorno_consulta)} as {formatTime(resultado.data_retorno_consulta)}</div>
              </div>
              <div className="row g-3">
                <div className="col-12 col-lg-4">
                  <div className="label">Nome</div>
                  <div className="value fw-semibold">{resultado.nome || '-'}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label d-flex align-items-center gap-1"><FiHash /> CPF</div>
                  <div className="value d-flex align-items-center gap-2">
                    <span>{resultado.numero_documento ? formatCpf(String(resultado.numero_documento)) : '-'}</span>
                    {resultado.numero_documento && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        title="Copiar CPF"
                        onClick={() => copyToClipboard(String(resultado.numero_documento).replace(/\D/g, ''), 'CPF copiado!')}
                      >
                        <FiCopy />
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label d-flex align-items-center gap-1"><FiCalendar /> Idade</div>
                  <div className="value">{resultado.data_nascimento ? `${formatDate(resultado.data_nascimento)} (${idadeFrom(resultado.data_nascimento)} anos)` : '-'}</div>
                </div>

                <div className="col-6 col-lg-2">
                  <div className="label">UF</div>
                  <div className="value">{resultado.estado || '-'}</div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-3">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Informações da matrícula</h6>
              </div>
              <div className="kv-list p-3 p-md-4">
                <div className="kv-line">
                  <div className="kv-label">NB:</div>
                  <div className="kv-value d-flex align-items-center gap-2">
                    <span>{resultado.numero_beneficio ? formatBeneficioDisplay(String(resultado.numero_beneficio)) : '-'}</span>
                    {resultado.numero_beneficio && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        title="Copiar NB"
                        onClick={() => copyToClipboard(String(resultado.numero_beneficio).replace(/\D/g, ''), 'NB copiado!')}
                      >
                        <FiCopy />
                      </button>
                    )}
                  </div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Espécie:</div>
                  <div className="kv-value">-</div>
                  <div className="kv-label">Situação:</div>
                  <div className="kv-value">{resultado.situacao_beneficio ? mapSituacao(resultado.situacao_beneficio) : '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Data de concessão:</div>
                  <div className="kv-value">{resultado.data_concessao ? formatDate(resultado.data_concessao) : '-'}</div>
                  <div className="kv-label">UF:</div>
                  <div className="kv-value">{resultado.estado || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Data do despacho do benefício:</div>
                  <div className="kv-value">-</div>
                  <div className="kv-label">Representante / Procurador:</div>
                  <div className="kv-value">{resultado.nome_representante_legal || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Portabilidades:</div>
                  <div className="kv-value">{resultado?.numero_portabilidades != null ? String(resultado.numero_portabilidades) : '-'}</div>
                </div>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Saldo Cartão Benefício:</div>
                    <div className="stat-value">{resultado.saldo_cartao_beneficio != null ? brCurrency(resultado.saldo_cartao_beneficio) : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Saldo Cartão Consignado:</div>
                    <div className="stat-value">{resultado.saldo_cartao_consignado != null ? brCurrency(resultado.saldo_cartao_consignado) : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Margem disponível:</div>
                    <div className="stat-value">{resultado.saldo_total_disponivel != null ? brCurrency(resultado.saldo_total_disponivel) : '-'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-4">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Dados bancários</h6>
              </div>
              <div className="kv-list p-3 p-md-4">
                <div className="kv-line">
                  <div className="kv-label">Banco:</div>
                  <div className="kv-value">{resultado.banco_desembolso || '-'}</div>
                  <div className="kv-label">Nome do Banco:</div>
                  <div className="kv-value">{bancoInfo?.name || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Agência:</div>
                  <div className="kv-value">{resultado.agencia_desembolso || '-'}</div>
                  <div className="kv-label">Conta:</div>
                  <div className="kv-value">{resultado.conta_desembolso || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Dígito:</div>
                  <div className="kv-value">{resultado.digito_desembolso || '-'}</div>
                  <div className="kv-label">Tipo de crédito:</div>
                  <div className="kv-value">{resultado.tipo_credito ? mapTipoCredito(resultado.tipo_credito) : '-'}</div>
                </div>
              </div>
            </div>

          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

