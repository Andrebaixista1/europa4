import { useRef, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { FiSearch, FiArrowLeft, FiCheck, FiUser, FiHash, FiCalendar, FiInfo, FiDollarSign, FiCopy } from 'react-icons/fi'
import { Tooltip as BsTooltip } from 'bootstrap'
import { useLoading } from '../context/LoadingContext.jsx'
import { notify } from '../utils/notify.js'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Link } from 'react-router-dom'

export default function ConsultaIN100() {
  const { user } = useAuth()
  const [cpf, setCpf] = useState('')
  const [beneficio, setBeneficio] = useState('')
  const [online, setOnline] = useState(true)
  const loader = useLoading()
  const [showTip, setShowTip] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [bancoInfo, setBancoInfo] = useState(null)
  const resultRef = useRef(null)
  const formRef = useRef(null)

  // Modal de busca (CPF ou NB)
  const [lookupOpen, setLookupOpen] = useState(false)
  const [lookup, setLookup] = useState({
    type: null,            // 'cpf' | 'nb'
    digits: '',            // nÃºmero enviado
    loading: false,
    error: null,
    response: null,        // texto cru (pretty)
    responseObj: null,     // JSON parseado quando possÃ­vel
    pairs: [],             // pares chave/valor para tabela (fallback)
    curatedList: [],       // lista de linhas curadas para tabela principal
    continueTarget: null,  // 'cpf' | 'nb' que serÃ¡ preenchido ao continuar
    continueDigits: null,  // legado (nÃ£o utilizado nas linhas)
    notFound: false,       // quando nenhuma informaÃ§Ã£o Ãºtil for retornada
  })

  const [metrics, setMetrics] = useState({ totalCarregado: 0, disponivel: 0, realizadas: 0 })

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
  // Carrega saldos do usuÃ¡rio para preencher os cards
  // Carrega saldos do usuÃ¡rio para preencher os cards
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
      // silencia erros para nÃ£o travar a UI
    }
  }

  useEffect(() => {
    fetchSaldoUsuario()
  }, [user])

  // Inicializa tooltips Bootstrap nos elementos que tiverem data-bs-toggle="tooltip"
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    const instances = nodes.map((el) => {
      try {
        return new BsTooltip(el, { placement: 'top', trigger: 'hover focus', delay: { show: 500, hide: 100 }, container: 'body', animation: true })
      } catch {
        return null
      }
    })
    return () => { instances.forEach((t) => t && t.dispose && t.dispose()) }
  }, [])

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

  // FormataÃ§Ã£o de data: usa parsing estrito do componente YYYY-MM-DD (sem efeito de timezone)
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
  const mapPensao = (v) => (v === 'not_payer' ? 'nao pensionista' : v || '-')
  const mapBloqueio = (v) => (v === 'not_blocked' ? 'nao bloqueado' : v || '-')
  const mapTipoCredito = (v) => {
    if (!v) return '-'
    if (v === 'magnetic_card') return 'Cartao magnetico'
    if (v === 'checking_account') return 'Conta Corrente'
    return v
  }
  const mapSituacao = (v) => (v === 'elegible' ? 'Elegivel' : v || '-')

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

  // Abre modal e envia POST para consulta por CPF/NB
  const openLookupModal = async (kind) => {
    const isCpf = kind === 'cpf'
    const raw = isCpf ? cpf : beneficio
    const digits = (raw || '').replace(/\D/g, '')
    // Na lupa, permitir busca parcial para CPF e NB (mÃ­nimo 1 dÃ­gito)
    if (isCpf && digits.length === 0) return notify.warn('Informe pelo menos 1 digito do CPF para pesquisar.')
    // Para NB na lupa, tambÃ©m permitir menos de 10 dÃ­gitos (busca parcial)
    if (!isCpf && digits.length === 0) return notify.warn('Informe pelo menos 1 digito do Beneficio para pesquisar.')

    setLookup({
      type: kind,
      digits,
      loading: true,
      error: null,
      response: null,
      responseObj: null,
      pairs: [],
      curatedList: [],
      continueTarget: kind === 'nb' ? 'cpf' : 'nb',
      continueDigits: null,
      notFound: false,
    })
    setLookupOpen(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const res = await fetch('https://n8n.apivieiracred.store/webhook/consulta-nbcpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: isCpf ? 'cpf' : 'nb', numero: digits }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const text = await res.text().catch(() => '')
      let display = text
      let json = null
      try { json = JSON.parse(text); display = JSON.stringify(json, null, 2) } catch { /* texto simples */ }

      const extractDigitsFromObj = (o, keys) => {
        if (!o) return null
        const lower = keys.map(k => k.toLowerCase())
        const visit = (val) => {
          if (val == null) return null
          if (Array.isArray(val)) { for (const it of val) { const r = visit(it); if (r) return r } return null }
          if (typeof val === 'object') {
            for (const [k, v] of Object.entries(val)) {
              if (lower.includes(String(k).toLowerCase())) {
                const d = String(v ?? '').replace(/\D/g, '')
                if (d) return d
              }
              const nested = visit(v); if (nested) return nested
            }
            return null
          }
          return null
        }
        return visit(o)
      }

      const findDigitsInText = (t, len) => {
        if (!t) return null
        const hint = len === 11 ? /(cpf)[^\d]{0,20}(\d{11})/i : /(beneficio|nb)[^\d]{0,20}(\d{10})/i
        const hintMatch = t.match(hint)
        if (hintMatch) return hintMatch[2]
        const re = new RegExp(`\\b\\d{${len}}\\b`)
        const m = t.match(re)
        return m ? m[0] : null
      }

      // Curadoria: extrai campos principais e monta lista organizada (suporta array)
      const toCuratedList = (obj) => {
        if (!obj) return []
        // funÃ§Ã£o para buscar valor por chaves comuns
        const extractAny = function walk(o, keys) {
          const lower = keys.map(k => k.toLowerCase())
          const visit = (val) => {
            if (val == null) return null
            if (Array.isArray(val)) { for (const it of val) { const r = visit(it); if (r != null) return r } return null }
            if (typeof val === 'object') {
              for (const [k, v] of Object.entries(val)) {
                if (lower.includes(String(k).toLowerCase())) return v
                const nested = visit(v); if (nested != null) return nested
              }
              return null
            }
            return null
          }
          return visit(o)
        }
        const makeRow = (source) => {
          const findVal = (keys) => extractAny(source, keys)
          const nbDigits = String(findVal(['nb', 'numero_beneficio', 'beneficio', 'nr_beneficio', 'num_beneficio']) ?? '').replace(/\D/g, '')
          const cpfDigits = String(findVal(['nu_cpf', 'cpf', 'numero_documento', 'documento', 'nr_cpf', 'num_cpf']) ?? '').replace(/\D/g, '')
          const nome = findVal(['nome_segurado', 'nome', 'nome_beneficiario', 'nome_cliente']) || ''
          const nascimentoRaw = findVal(['dt_nascimento', 'data_nascimento', 'nascimento']) || null
          const parts = parseISODateParts(nascimentoRaw)
          const nascStr = parts ? partsToBR(parts) : (nascimentoRaw ? formatDate(nascimentoRaw) : '')
          const idadeCalc = parts ? idadeFrom(`${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`) : (nascimentoRaw ? idadeFrom(nascimentoRaw) : '')
          return { nbDigits, cpfDigits, nome: String(nome || ''), nascStr, idade: idadeCalc }
        }
        const list = Array.isArray(obj) ? obj.map(makeRow) : [makeRow(obj)]
        return list
      }

      const continueTarget = kind === 'nb' ? 'cpf' : 'nb'
      let curatedList = []
      if (json) curatedList = toCuratedList(json)
      // Fallback: tenta extrair um Ãºnico dÃ­gito quando a estrutura nÃ£o estÃ¡ clara
      let continueDigits = null
      if (!curatedList.length) {
        if (continueTarget === 'cpf') continueDigits = extractDigitsFromObj(json, ['cpf', 'numero_documento', 'documento', 'nr_cpf', 'num_cpf']) || findDigitsInText(text, 11)
        else continueDigits = extractDigitsFromObj(json, ['nb', 'numero_beneficio', 'beneficio', 'nr_beneficio', 'num_beneficio']) || findDigitsInText(text, 10)
      }
      const likelyEmpty = (!json) || (Array.isArray(json) && json.length === 0) || (typeof json === 'object' && !Array.isArray(json) && Object.keys(json || {}).length === 0)
      const hasData = curatedList.some(r => r.nbDigits || r.cpfDigits || r.nome || r.nascStr)
      const notFound = !hasData && (likelyEmpty || (!continueDigits && String(text || '').trim().length > 0))

      if (!res.ok) {
        setLookup((s) => ({ ...s, loading: false, error: `Erro ${res.status}: ${res.statusText || 'Falha ao consultar'}`, response: display, responseObj: json, pairs: (curatedList[0] ? [] : []), curatedList, continueTarget, continueDigits, notFound }))
        return
      }
      setLookup((s) => ({ ...s, loading: false, error: null, response: display, responseObj: json, pairs: [], curatedList, continueTarget, continueDigits, notFound }))
    } catch (err) {
      const msg = err?.name === 'AbortError' ? 'Tempo esgotado aguardando a resposta.' : (err?.message || 'Erro ao consultar')
      setLookup((s) => ({ ...s, loading: false, error: msg }))
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
      notify.success('Beneficio localizado na Macica e preenchido automaticamente.')
    } else {
      notify.info('Nenhum Beneficio localizado na Macica para este CPF (mock).')
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    loader.begin()
    try {
      if (Number(metrics.disponivel) <= 0) {
        notify.warn('Sem saldo disponivel para realizar consultas.')
        return
      }
      const digits = cpf.replace(/\D/g, '')
      const benDigits = beneficio.replace(/\D/g, '')
      if (digits.length !== 11) return notify.warn('Informe um CPF valido (11 digitos).')
      if (benDigits.length !== 10) return notify.warn('Informe um Beneficio valido (10 digitos).')
      loader.begin()
      try {
        if (online) {
          // 1) Dispara consulta online
          const urlConsulta = 'https://n8n.apivieiracred.store/webhook/consulta-online'
          const equipeId = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
          const consultaPayload = {
            id: (typeof user?.id !== 'undefined' ? user.id : user),
            cpf: digits,
            nb: benDigits,
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
              body: JSON.stringify({ id: user?.id, cpf: digits, nb: benDigits })
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
            resposta_api: d.resposta_api || 'Concluido',
            status_api: d.status_api || 'Sucesso',
            tipo: 'online',
          }

          setResultado(mapped)
          if (mapped.banco_desembolso) {
            try { setBancoInfo(await fetchBanco(mapped.banco_desembolso)) } catch { setBancoInfo(null) }
          }

          // 3) ApÃ³s a resposta final, atualiza os saldos agregados (cards)
          await fetchSaldoUsuario()
          loader.end()
          notify.success('Consulta online concluida', { autoClose: 15000 })
          return
        }
        // Fluxo OFFLINE: chamada direta para webhook resposta-api
        const urlRespostaOffline = 'https://n8n.apivieiracred.store/webhook/resposta-api'
        // Aguarda 5s antes de buscar a resposta offline
        await new Promise(r => setTimeout(r, 5000))
        const resOff = await fetch(urlRespostaOffline, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user?.id, cpf: digits, nb: benDigits })
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
        // validar formato mÃ­nimo esperado
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
          resposta_api: o.resposta_api || 'Concluido',
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
        resposta_api: 'Concluido',
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
              <div className="opacity-75 small">Faca buscas individuais por CPF e Beneficio</div>
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
                  <div className="small text-uppercase opacity-75">{'Disponivel'}</div>
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
            <form className="neo-card neo-lg p-4 h-100" onSubmit={onSubmit} ref={formRef}>
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
                  <button
                    type="button"
                    className="btn btn-outline-secondary d-flex align-items-center"
                    title="nao sabe o NB/CPF do cliente? Digite uma das informacoes e tentamos buscar no nosso banco de dados"
                    aria-label="Buscar NB/CPF no nosso banco de dados"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    onClick={() => openLookupModal('cpf')}
                  >
                    <FiSearch />
                  </button>
                  {/* botÃ£o de copiar CPF removido conforme solicitaÃ§Ã£o */}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Beneficio</label>
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
                  <button
                    type="button"
                    className="btn btn-outline-secondary d-flex align-items-center"
                    title="nao sabe o NB/CPF do cliente? Digite uma das informacoes e tentamos buscar no nosso banco de dados"
                    aria-label="Buscar NB/CPF no nosso banco de dados"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    onClick={() => openLookupModal('nb')}
                  >
                    <FiSearch />
                  </button>
                  {/* botÃ£o de copiar NB removido conforme solicitaÃ§Ã£o */}
                </div>
              </div>

              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="chk-online" checked={online} onChange={(e) => setOnline(e.target.checked)} />
                <label className="form-check-label" htmlFor="chk-online">Consultar Online</label>
              </div>

              <div>
                <button type="submit" className="btn btn-primary btn-pesquisar" disabled={Number(metrics.disponivel) <= 0}>Pesquisar</button>
              </div>
            </form>
          </div>
        </div>

        {/* Modal de Acompanhamento da Busca CPF/NB */}
        {lookupOpen && (
          <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 1050 }} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-xl" style={{ maxWidth: 'min(95vw, 1100px)' }}>
              <div className="modal-content modal-dark">
                <div className="modal-header">
                  <h5 className="modal-title">Busca por {lookup.type === 'cpf' ? 'CPF' : 'Beneficio'}</h5>
                  <button type="button" className="btn-close" aria-label="Close" disabled={lookup.loading} onClick={() => setLookupOpen(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <div className="form-label mb-0">numero informado</div>
                    <div className="fw-semibold">{lookup.digits}</div>
                  </div>
                  {lookup.loading && (
                    <div className="d-flex align-items-center gap-2">
                      <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
                      <span>Aguardando resposta do servico...</span>
                    </div>
                  )}
                  {lookup.error && (
                    <div className="text-danger small mt-2">{lookup.error}</div>
                  )}
                  {lookup.response && (
                    <div className="mt-3">
                      <div className="form-label mb-2">Resposta</div>
                      {lookup.notFound ? (
                        <div className="alert alert-warning mb-2" role="alert">
                          Cliente nao encontrado para o {lookup.type === 'cpf' ? 'CPF' : 'NB'} informado.
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm table-lookup align-middle mb-2">
                            <thead>
                              <tr>
                                <th>NB</th>
                                <th>Nome</th>
                                <th>Nascimento</th>
                                <th>CPF</th>
                                <th>Idade</th>
                                <th>Acao</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(lookup.curatedList && lookup.curatedList.length > 0 ? lookup.curatedList : [{ nbDigits: null, nome: null, nascStr: null, cpfDigits: null, idade: null }]).map((row, idx) => (
                                <tr key={idx}>
                                  <td className="small">{row.nbDigits ? formatBeneficio(row.nbDigits) : '-'}</td>
                                  <td className="small" style={{ maxWidth: '28ch', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.nome || ''}>{row.nome || '-'}</td>
                                  <td className="small">{row.nascStr || '-'}</td>
                                  <td className="small">{row.cpfDigits ? formatCpf(row.cpfDigits) : '-'}</td>
                                  <td className="small">{row.idade !== '' && row.idade != null ? String(row.idade) : '-'}</td>
                                  <td className="small">
                                    <button
                                      type="button"
                                      className="btn btn-success btn-sm d-inline-flex align-items-center"
                                      title="Adicionar"
                                      aria-label="Adicionar"
                                      onClick={() => {
                                        if (lookup.continueTarget === 'cpf') {
                                          const cpfNorm = String(row.cpfDigits || '').replace(/\D/g, '')
                                          if (cpfNorm.length !== 11) { notify.warn('CPF invalido para continuar'); return }
                                          const current = cpf.replace(/\D/g, '')
                                          if (current === cpfNorm) { notify.info('CPF ja presente na pesquisa') }
                                          else { setCpf(formatCpf(cpfNorm)); notify.success('CPF adicionado a pesquisa') }
                                        } else {
                                          const nbNorm = String(row.nbDigits || '').replace(/\D/g, '')
                                          if (nbNorm.length !== 10) { notify.warn('NB invalido para continuar'); return }
                                          const current = beneficio.replace(/\D/g, '')
                                          if (current === nbNorm) { notify.info('NB ja presente na pesquisa') }
                                          else { setBeneficio(formatBeneficio(nbNorm)); notify.success('NB adicionado a pesquisa') }
                                        }
                                        setLookupOpen(false)
                                        setLookup({ type: null, digits: '', loading: false, error: null, response: null, responseObj: null, pairs: [], curatedList: [], continueTarget: null, continueDigits: null, notFound: false })
                                      }}
                                    >
                                      <FiCheck />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {/* Detalhes brutos em fallback quando necessÃ¡rio */}
                      {(lookup.pairs?.length ?? 0) > 0 && (
                        <details>
                          <summary className="small mb-1">Ver detalhes brutos</summary>
                          {lookup.pairs && lookup.pairs.length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-lookup align-middle mb-0">
                                <thead>
                                  <tr>
                                    <th style={{ width: '40%' }}>Campo</th>
                                    <th>Valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lookup.pairs.slice(0, 25).map(([k, v], idx) => (
                                    <tr key={idx}>
                                      <td className="text-muted small">{k}</td>
                                      <td className="small" style={{ wordBreak: 'break-word' }}>{String(v)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>{lookup.response}</pre>
                          )}
                        </details>
                      )}
                      <div className="form-text mt-1">
                        {lookup.continueTarget === 'cpf' ? 'Ao continuar, o CPF sera preenchido se identificado.' : 'Ao continuar, o Beneficio sera preenchido se identificado.'}
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={lookup.loading}
                    onClick={() => {
                      setLookupOpen(false)
                      setLookup({ type: null, digits: '', loading: false, error: null, response: null, responseObj: null, pairs: [], curatedList: [], continueTarget: null, continueDigits: null })
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
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
                      <div className="fw-semibold mb-2">Informacoes Basicas</div>
                      <div className="small opacity-75">Beneficio:</div>
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
                      <div className="fw-semibold mb-2">Informacoes Pessoais</div>
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
                      <div className="fw-semibold mb-2">Informacoes do Beneficio</div>
                      <div className="small opacity-75">Data de Concessao:</div>
                      <div className="mb-2">{formatDate(resultado.data_concessao)}</div>
                      <div className="small opacity-75">Termino do Beneficio:</div>
                      <div className="mb-2">{resultado.data_final_beneficio ? formatDate(resultado.data_final_beneficio) : '-'}</div>
                      <div className="small opacity-75">Tipo de Credito:</div>
                      <div className="mb-2">{mapTipoCredito(resultado.tipo_credito)}</div>
                      <div className="small opacity-75">Status do Beneficio:</div>
                      <div>{mapSituacao(resultado.situacao_beneficio)}</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Informacoes Financeiras</div>
                      <div className="small opacity-75">Saldo Cartao Beneficio:</div>
                      <div className="mb-2">{brCurrency(resultado.saldo_cartao_beneficio)}</div>
                      <div className="small opacity-75">Saldo Cartao Consignado:</div>
                      <div className="mb-2">{brCurrency(resultado.saldo_cartao_consignado)}</div>
                      <div className="small opacity-75">{'Margem Disponivel'}:</div>
                      <div className="mb-2">{brCurrency(resultado.saldo_total_disponivel)}</div>
                      <div className="small opacity-75">Emprestimos Ativos:</div>
                      <div>{resultado.numero_portabilidades}</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="neo-card p-3 h-100">
                      <div className="fw-semibold mb-2">Informacoes Bancarias</div>
                      <div className="small opacity-75">Banco de Desembolso:</div>
                      <div className="mb-2">{resultado.banco_desembolso}</div>
                      <div className="small opacity-75">Nome do Banco:</div>
                      <div className="mb-2">{bancoInfo?.name || '-'}</div>
                      <div className="small opacity-75">Agencia:</div>
                      <div className="mb-2">{resultado.agencia_desembolso || '-'}</div>
                      <div className="small opacity-75">Conta:</div>
                      <div className="mb-2">{resultado.conta_desembolso || '-'}</div>
                      <div className="small opacity-75">digito:</div>
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
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Informacoes da Matricula</h6>
              </div>
              <div className="kv-list p-3 p-md-4">
                <div className="kv-line">
                  <div className="kv-label">NB:</div>
                  <div className="kv-value d-flex align-items-center gap-2">
                    <span>{resultado.numero_beneficio ? formatBeneficio(String(resultado.numero_beneficio)) : '-'}</span>
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
                  <div className="kv-label">Especie:</div>
                  <div className="kv-value">-</div>
                  <div className="kv-label">Situacao:</div>
                  <div className="kv-value">{resultado.situacao_beneficio ? mapSituacao(resultado.situacao_beneficio) : '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Data de Concessao:</div>
                  <div className="kv-value">{resultado.data_concessao ? formatDate(resultado.data_concessao) : '-'}</div>
                  <div className="kv-label">UF:</div>
                  <div className="kv-value">{resultado.estado || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Data Despacho Beneficio:</div>
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
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Saldo Cartao Beneficio:</div>
                    <div className="stat-value">{resultado.saldo_cartao_beneficio != null ? brCurrency(resultado.saldo_cartao_beneficio) : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Saldo Cartao Consignado:</div>
                    <div className="stat-value">{resultado.saldo_cartao_consignado != null ? brCurrency(resultado.saldo_cartao_consignado) : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="neo-card stat-card h-100">
                  <div className="p-4">
                    <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Margem Disponivel:</div>
                    <div className="stat-value">{resultado.saldo_total_disponivel != null ? brCurrency(resultado.saldo_total_disponivel) : '-'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-4">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Dados Bancarios</h6>
              </div>
              <div className="kv-list p-3 p-md-4">
                <div className="kv-line">
                  <div className="kv-label">Banco:</div>
                  <div className="kv-value">{resultado.banco_desembolso || '-'}</div>
                  <div className="kv-label">Nome do Banco:</div>
                  <div className="kv-value">{bancoInfo?.name || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">Agencia:</div>
                  <div className="kv-value">{resultado.agencia_desembolso || '-'}</div>
                  <div className="kv-label">Conta:</div>
                  <div className="kv-value">{resultado.conta_desembolso || '-'}</div>
                </div>
                <div className="kv-line">
                  <div className="kv-label">digito:</div>
                  <div className="kv-value">{resultado.digito_desembolso || '-'}</div>
                  <div className="kv-label">Tipo de Credito:</div>
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

