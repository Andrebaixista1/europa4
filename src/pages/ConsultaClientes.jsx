import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheck,
  FiChevronRight,
  FiCircle,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiHome,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiUser,
} from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { notify } from '../utils/notify.js'
import { useAuth } from '../context/AuthContext.jsx'

const API_URL = 'https://n8n.apivieiracred.store/webhook/api/consultacliente'

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')
const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== ''

const firstFilled = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value
  }
  return ''
}

const formatCpf = (value) => {
  const cpf = digitsOnly(value).slice(0, 11)
  if (!cpf) return ''
  if (cpf.length < 11) return cpf
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const txt = String(value).trim()
  if (!txt) return null
  const normalized = txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const formatMoney = (value) => {
  const n = parseNumber(value)
  if (n === null) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

const parseDateAny = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (/^\d{8}$/.test(raw)) {
    const y = Number(raw.slice(0, 4))
    const m = Number(raw.slice(4, 6))
    const d = Number(raw.slice(6, 8))
    const date = new Date(y, m - 1, d)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value) => {
  const date = parseDateAny(value)
  return date ? date.toLocaleDateString('pt-BR') : '-'
}

const formatAge = (idadeValue, nascimentoValue) => {
  const idadeNum = parseNumber(idadeValue)
  if (idadeNum !== null) return `${Math.trunc(idadeNum)} anos`
  const nascimento = parseDateAny(nascimentoValue)
  if (!nascimento) return '-'
  const today = new Date()
  let age = today.getFullYear() - nascimento.getFullYear()
  const monthDiff = today.getMonth() - nascimento.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < nascimento.getDate())) age -= 1
  return age >= 0 ? `${age} anos` : '-'
}

const mapSituacao = (value) => {
  if (!hasValue(value)) return '-'
  const n = parseNumber(value)
  if (n === 1) return 'Ativo'
  if (n === 0) return 'Inativo'
  return String(value)
}

const formatPhone = (value) => {
  const d = digitsOnly(value)
  if (!d) return '-'
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return String(value)
}

const tryParseJson = (value) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const unwrapRows = (payload, depth = 0) => {
  if (depth > 6 || payload === null || payload === undefined) return []
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'string') {
    const parsed = tryParseJson(payload)
    return parsed ? unwrapRows(parsed, depth + 1) : []
  }
  if (typeof payload !== 'object') return []

  const candidates = [payload.data, payload.rows, payload.result, payload.results, payload.items, payload.body, payload.payload, payload.output, payload.response]
  for (const candidate of candidates) {
    const rows = unwrapRows(candidate, depth + 1)
    if (rows.length > 0) return rows
  }
  return [payload]
}

const normalizeRows = (payload) => unwrapRows(payload).map((row) => (row && typeof row === 'object' ? row : { value: row }))

const parseResponseBody = async (response) => {
  const raw = await response.text()
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    payload = { raw }
  }

  if (!response.ok) {
    if (payload?.message) throw new Error(payload.message)
    if (payload?.error) throw new Error(payload.error)
    throw new Error(raw || `HTTP ${response.status}`)
  }
  if (payload?.ok === false) {
    throw new Error(payload?.message || payload?.error || 'Falha na API')
  }
  return payload
}

const getParamValue = (params, key) => params.get(key) || params.get(key.toUpperCase()) || params.get(key.toLowerCase()) || ''

const parseCpfFromUrl = (pathname, search) => {
  const searchParams = new URLSearchParams(search)
  const queryCpf = getParamValue(searchParams, 'cpf')
  if (queryCpf) return queryCpf

  const base = '/consultas/clientes'
  if (!pathname.startsWith(base)) return ''
  let tail = pathname.slice(base.length)
  if (tail.startsWith('/')) tail = tail.slice(1)
  tail = tail.replace(/\/+$/, '')
  if (!tail) return ''

  const pathParams = new URLSearchParams(tail.replace(/^\?/, ''))
  return getParamValue(pathParams, 'cpf')
}

const toIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

const isClienteRow = (row) => (
  hasValue(row?.NOME)
  || hasValue(row?.CPF)
  || hasValue(row?.CPF_LIMPO)
  || hasValue(row?.Beneficio)
  || hasValue(row?.nome_segurado)
  || hasValue(row?.nu_cpf)
  || hasValue(row?.nu_cpf_tratado)
  || hasValue(row?.nb)
)

const getRowNome = (row) => firstFilled(row?.NOME, row?.nome_segurado, row?.nome)
const getRowCpfDigits = (row) => digitsOnly(firstFilled(row?.CPF_LIMPO, row?.CPF, row?.nu_cpf_tratado, row?.nu_cpf))
const getRowBeneficio = (row) => String(firstFilled(row?.Beneficio, row?.BENEFICIO_LIMPO, row?.nb, row?.nb_tratado, row?.nb_ix)).trim()

const panelStyle = {
  background: 'rgba(20, 24, 36, 0.92)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10,
}

const bubbleIconStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: '#1ea7ff',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
}

const miniLabelStyle = {
  fontSize: '0.8rem',
  opacity: 0.8,
}

function CopyButton({ value, label }) {
  const handleCopy = useCallback(async () => {
    if (!hasValue(value)) return
    try {
      await navigator.clipboard.writeText(String(value))
      notify.success(`${label} copiado.`)
    } catch {
      notify.error('Nao foi possivel copiar.')
    }
  }, [label, value])

  return (
    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={handleCopy} disabled={!hasValue(value)} title={`Copiar ${label.toLowerCase()}`}>
      <FiCopy size={14} />
    </button>
  )
}

function SectionTitle({ icon: IconComp, title, right }) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
      <div className="d-flex align-items-center gap-2">
        <span style={bubbleIconStyle}><IconComp size={14} /></span>
        <div className="fw-semibold text-uppercase" style={{ fontSize: '0.86rem' }}>{title}</div>
      </div>
      {right}
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <div style={miniLabelStyle}>{label}</div>
      <div className="fw-semibold">{hasValue(value) ? String(value) : '-'}</div>
    </div>
  )
}

function MatriculaLine({ leftLabel, leftValue, rightLabel, rightValue }) {
  return (
    <div className="row g-2 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="col-12 col-lg-6 d-flex justify-content-between gap-3">
        <span style={miniLabelStyle}>{leftLabel}:</span>
        <span className="fw-semibold text-end">{hasValue(leftValue) ? leftValue : '-'}</span>
      </div>
      <div className="col-12 col-lg-6 d-flex justify-content-between gap-3">
        <span style={miniLabelStyle}>{rightLabel}:</span>
        <span className="fw-semibold text-end">{hasValue(rightValue) ? rightValue : '-'}</span>
      </div>
    </div>
  )
}

function EmptyCell({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="opacity-75">{text}</td>
    </tr>
  )
}

export default function ConsultaClientes() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [selectedBenefitKey, setSelectedBenefitKey] = useState('')
  const [rawPayload, setRawPayload] = useState(null)
  const lastUrlCpfRef = useRef('')
  const hideSearchByInitialUrlRef = useRef(
    digitsOnly(parseCpfFromUrl(location.pathname, location.search)).length === 11
  )

  const userContext = useMemo(() => {
    const idUser = toIntegerOrNull(user?.id ?? user?.id_user ?? user?.idUser)
    const equipeId = toIntegerOrNull(user?.equipe_id ?? user?.team_id ?? user?.id_equipe ?? user?.equipeId)
    const hierarquia = String(user?.hierarquia ?? user?.role ?? user?.nivel_hierarquia ?? '').trim()
    return {
      idUser,
      equipeId,
      hierarquia,
      ready: idUser !== null && equipeId !== null && hierarquia.length > 0,
    }
  }, [user])

  const visibleRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows])
  const hasCpfInUrl = hideSearchByInitialUrlRef.current

  const columns = useMemo(() => {
    if (visibleRows.length === 0) return []
    const keys = new Set()
    for (const row of visibleRows) {
      if (!row || typeof row !== 'object') continue
      Object.keys(row).forEach((k) => keys.add(k))
    }
    return Array.from(keys)
  }, [visibleRows])

  const profile = useMemo(() => {
    try {
      const mappedRows = visibleRows.filter((row) => row && typeof row === 'object' && isClienteRow(row))
      if (mappedRows.length === 0) return null

      const benefitMap = new Map()
      mappedRows.forEach((row, index) => {
        const beneficio = getRowBeneficio(row)
        const cpfDigits = getRowCpfDigits(row)
        const nome = getRowNome(row)
        if (!beneficio && !cpfDigits && !nome) return
        const key = `${beneficio || `sem-beneficio-${index}`}|${cpfDigits || 'sem-cpf'}|${nome || 'sem-nome'}`
        if (benefitMap.has(key)) return
        benefitMap.set(key, {
          key,
          beneficio,
          cpfDigits,
          cpf: cpfDigits ? formatCpf(cpfDigits) : '-',
          nome: nome || '-',
          row,
        })
      })

      const benefitOptions = Array.from(benefitMap.values())
      if (benefitOptions.length === 0) {
        benefitOptions.push({
          key: 'default-beneficio',
          beneficio: '',
          cpfDigits: getRowCpfDigits(mappedRows[0]),
          cpf: formatCpf(getRowCpfDigits(mappedRows[0])),
          nome: getRowNome(mappedRows[0]) || '-',
          row: mappedRows[0],
        })
      }

      const uniqueNomes = new Set(benefitOptions.map((item) => item.nome).filter(hasValue))
      const uniqueCpfs = new Set(benefitOptions.map((item) => item.cpfDigits).filter(hasValue))
      const uniqueBeneficios = new Set(benefitOptions.map((item) => item.beneficio).filter(hasValue))
      const shouldShowBenefitSelect = uniqueNomes.size > 1 || uniqueCpfs.size > 1 || uniqueBeneficios.size > 1

      const selectedOption = benefitOptions.find((item) => item.key === selectedBenefitKey) || benefitOptions[0]
      const selectedBeneficio = selectedOption?.beneficio || ''
      const selectedCpfDigits = selectedOption?.cpfDigits || ''

      const relatedRows = mappedRows.filter((row) => {
        const sameBeneficio = hasValue(selectedBeneficio) && getRowBeneficio(row) === selectedBeneficio
        const sameCpf = hasValue(selectedCpfDigits) && getRowCpfDigits(row) === selectedCpfDigits
        return sameBeneficio || sameCpf
      })
      const poolRows = relatedRows.length > 0 ? relatedRows : mappedRows

      const selectedRow = selectedOption?.row || poolRows[0] || {}
      const rowA = poolRows.find((row) => row === selectedRow && (hasValue(row?.NOME) || hasValue(row?.CPF) || hasValue(row?.Beneficio)))
        || poolRows.find((row) => hasValue(row?.NOME) || hasValue(row?.CPF) || hasValue(row?.Beneficio))
        || {}
      const rowB = poolRows.find((row) => row === selectedRow && (hasValue(row?.nb) || hasValue(row?.nome_segurado) || hasValue(row?.nu_cpf)))
        || poolRows.find((row) => hasValue(row?.nb) || hasValue(row?.nome_segurado) || hasValue(row?.nu_cpf))
        || {}

      const cpfValue = firstFilled(
        selectedOption?.cpfDigits,
        rowA?.CPF_LIMPO,
        rowA?.CPF,
        rowB?.nu_cpf_tratado,
        rowB?.nu_cpf,
      )
      const nascimentoValue = firstFilled(rowA?.Data_Nascimento, rowB?.dt_nascimento_tratado, rowB?.dt_nascimento)

      const enderecos = [{
        cep: firstFilled(rowB?.cep, rowA?.CEP),
        rua: firstFilled(rowB?.endereco, rowA?.endereco),
        bairro: firstFilled(rowB?.bairro, rowA?.bairro),
        cidade: firstFilled(rowB?.municipio, rowA?.Municipio, rowA?.cidade),
        uf: firstFilled(rowB?.uf, rowA?.UF),
      }].filter((item) => hasValue(item.cep) || hasValue(item.rua) || hasValue(item.cidade))

      const phones = [
        rowA?.CELULAR1,
        rowA?.CELULAR2,
        rowA?.CELULAR3,
        rowA?.CELULAR4,
        rowA?.telefone,
        rowB?.telefone,
      ]
        .map((item) => digitsOnly(item))
        .filter((item) => item.length >= 10)
        .filter((item, idx, arr) => arr.indexOf(item) === idx)

      const bankRows = [{
        tipoLiberacao: firstFilled(rowA?.Meio_Pagamento, rowB?.cs_meio_pagto),
        banco: firstFilled(rowA?.Banco, rowB?.id_banco_pagto),
        agencia: firstFilled(rowA?.Agencia, rowB?.id_agencia_banco),
        conta: firstFilled(rowA?.Conta, rowB?.nu_conta_corrente),
        chavePix: firstFilled(rowA?.chave_pix, rowB?.chave_pix),
      }].filter((item) => hasValue(item.tipoLiberacao) || hasValue(item.banco) || hasValue(item.agencia) || hasValue(item.conta))

      const contratos = poolRows
        .filter((row) => hasValue(row?.id_contrato_empres) || hasValue(row?.vl_empres) || hasValue(row?.nb))
        .map((row, index) => ({
          key: `${index}-${firstFilled(row?.id_contrato_empres, row?.nb, 'contrato')}`,
          banco: firstFilled(row?.id_banco_empres, row?.id_banco_pagto),
          contrato: firstFilled(row?.id_contrato_empres),
          parcelas: firstFilled(row?.quant_parcelas_tratado, row?.quant_parcelas),
          taxa: firstFilled(row?.tipo_empres),
          valorParcela: firstFilled(row?.vl_parcela_tratado, row?.vl_parcela),
          saldo: hasValue(row?.restantes) && hasValue(row?.vl_parcela)
            ? formatMoney((parseNumber(row?.restantes) || 0) * (parseNumber(row?.vl_parcela) || 0))
            : '-',
          emprestado: firstFilled(row?.vl_empres_tratado, row?.vl_empres),
        }))

      return {
        nome: firstFilled(rowA?.NOME, rowB?.nome_segurado),
        cpfRaw: cpfValue,
        cpf: hasValue(cpfValue) ? formatCpf(cpfValue) : '-',
        idade: formatAge(firstFilled(rowA?.IDADE, rowB?.idade), nascimentoValue),
        nascimento: formatDate(nascimentoValue),
        nb: firstFilled(selectedBeneficio, rowA?.Beneficio, rowB?.nb, rowB?.nb_tratado, '-'),
        especie: firstFilled(rowB?.esp, rowA?.CODIGO_ESPECIE, '-'),
        dib: formatDate(firstFilled(rowB?.dib, rowA?.Data_Lemit)),
        ddb: formatDate(firstFilled(rowA?.DDB, rowB?.ddb)),
        consignavel: (parseNumber(rowA?.MARGEM_RMC) || 0) > 0 || (parseNumber(rowA?.MARGEM_DISPONIVEL) || 0) > 0 ? 'Sim' : '-',
        situacao: mapSituacao(firstFilled(rowB?.situacao_empres, rowA?.situacao)),
        uf: firstFilled(rowA?.UF, rowB?.uf, '-'),
        margemRmc: formatMoney(rowA?.MARGEM_RMC),
        margemRcc: formatMoney(firstFilled(rowA?.Margem_RCC, rowA?.MARGEM_RCC)),
        margemLivre: formatMoney(rowA?.MARGEM_DISPONIVEL),
        renda: formatMoney(firstFilled(rowA?.VALOR_BENEFICIO, rowB?.vl_beneficio)),
        enderecos,
        phones,
        bankRows,
        contratos,
        benefitOptions: benefitOptions.map((item) => ({
          key: item.key,
          beneficio: item.beneficio || '-',
          cpf: item.cpf || '-',
          nome: item.nome || '-',
          label: item.beneficio || '-',
        })),
        selectedBenefitKey: selectedOption?.key || '',
        shouldShowBenefitSelect,
      }
    } catch (profileError) {
      console.error('ConsultaClientes profile parse error', profileError)
      return null
    }
  }, [visibleRows, selectedBenefitKey])

  useEffect(() => {
    if (!profile?.benefitOptions?.length) {
      if (selectedBenefitKey) setSelectedBenefitKey('')
      return
    }
    const exists = profile.benefitOptions.some((item) => item.key === selectedBenefitKey)
    if (!exists) {
      setSelectedBenefitKey(profile.benefitOptions[0].key)
    }
  }, [profile, selectedBenefitKey])

  const executeConsulta = useCallback(async (cpfInput, { syncUrl = true } = {}) => {
    const cpfDigits = digitsOnly(cpfInput)
    if (cpfDigits.length !== 11) {
      setError('Informe um CPF valido com 11 digitos.')
      setRows([])
      setRawPayload(null)
      return
    }

    setLoading(true)
    setError('')

    try {
      const url = new URL(API_URL)
      url.searchParams.set('cpf', cpfDigits)
      if (userContext.idUser !== null) url.searchParams.set('id_user', String(userContext.idUser))
      if (userContext.equipeId !== null) url.searchParams.set('equipe_id', String(userContext.equipeId))
      if (userContext.hierarquia) url.searchParams.set('hierarquia', userContext.hierarquia)

      const response = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } })
      const payload = await parseResponseBody(response)
      const normalized = normalizeRows(payload)

      setSelectedBenefitKey('')
      setRows(normalized)
      setRawPayload(payload)
      if (normalized.length === 0) notify.info('Nenhum dado encontrado para este CPF.')
      if (syncUrl) navigate(`/consultas/clientes?cpf=${cpfDigits}`, { replace: true })
    } catch (e) {
      setRows([])
      setRawPayload(null)
      setError(e?.message || 'Falha ao consultar cliente.')
    } finally {
      setLoading(false)
    }
  }, [navigate, userContext])

  useEffect(() => {
    const urlCpf = digitsOnly(parseCpfFromUrl(location.pathname, location.search))
    if (urlCpf.length !== 11) return
    if (!userContext.ready) {
      setError('Aguardando dados da sessao para consultar...')
      return
    }

    const requestKey = `${urlCpf}|${userContext.idUser}|${userContext.equipeId}|${userContext.hierarquia}`
    if (lastUrlCpfRef.current === requestKey) return

    lastUrlCpfRef.current = requestKey
    setCpf(formatCpf(urlCpf))
    executeConsulta(urlCpf, { syncUrl: false })
  }, [location.pathname, location.search, executeConsulta, userContext])

  const handleSubmit = useCallback((event) => {
    event.preventDefault()
    executeConsulta(cpf, { syncUrl: false })
  }, [cpf, executeConsulta])

  const selectedAddress = profile?.enderecos?.[0] || null
  const selectedPhone = profile?.phones?.[0] || ''
  const selectedBank = profile?.bankRows?.[0] || null

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column text-light">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-start gap-3 mb-3 flex-wrap">
          <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <FiArrowLeft size={16} />
            <span className="d-none d-sm-inline">Voltar</span>
          </Link>
          <div>
            <h2 className="fw-bold mb-1">Consulta Clientes</h2>
            <div className="small opacity-75">Pagina para consultar clientes em todos os canais, bancos de dados, IN100 e bancos via API.</div>
          </div>
        </div>

        {!hasCpfInUrl && (
          <section className="neo-card p-3 p-md-4 mb-3" style={panelStyle}>
            <form className="row g-2 align-items-end" onSubmit={handleSubmit}>
              <div className="col-12 col-md-8 col-lg-6">
                <label className="form-label small opacity-75 mb-1" htmlFor="consulta-clientes-cpf">CPF do cliente</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text"><FiSearch size={14} /></span>
                  <input id="consulta-clientes-cpf" className="form-control" placeholder="000.000.000-00" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} maxLength={14} autoComplete="off" />
                </div>
              </div>
              <div className="col-12 col-md-auto d-flex gap-2">
                <button type="submit" className="btn btn-info btn-sm d-flex align-items-center gap-2" disabled={loading}><FiSearch size={14} /><span>{loading ? 'Consultando...' : 'Consultar'}</span></button>
                <button type="button" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" onClick={() => executeConsulta(cpf, { syncUrl: false })} disabled={loading}><FiRefreshCw size={14} /><span>Atualizar</span></button>
              </div>
            </form>
            {error && <div className="small text-danger mt-2">{error}</div>}
          </section>
        )}

        <section className="neo-card p-3 p-md-4" style={panelStyle}>
          <div className="small opacity-75 mb-3">{loading ? 'Consultando API...' : `${visibleRows.length} registro(s) encontrado(s)`}</div>
          {error && <div className="small text-danger mb-3">{error}</div>}

          {visibleRows.length === 0 ? (
            <div className="small opacity-75">Informe um CPF para consultar. Tambem funciona por URL: <code>/consultas/clientes?cpf=00000000000</code></div>
          ) : profile ? (
            <div className="d-flex flex-column gap-3">
              <section className="neo-card p-3" style={panelStyle}>
                <SectionTitle icon={FiUser} title="Dados Pessoais" />
                <div className="row g-3">
                  <div className="col-12 col-md-4 col-xl-4"><InfoField label="Nome" value={profile.nome} /></div>
                  <div className="col-12 col-md-4 col-xl-4">
                    <div style={miniLabelStyle}>CPF</div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-semibold">{profile.cpf}</span>
                      <CopyButton value={profile.cpfRaw} label="CPF" />
                    </div>
                  </div>
                  <div className="col-12 col-md-4 col-xl-4"><InfoField label="Idade" value={`${profile.nascimento} (${profile.idade})`} /></div>
                </div>
              </section>

              <section className="row g-3">
                <div className="col-12 col-xl-7">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle icon={FiBriefcase} title="Informacoes da Matricula" right={<div className="d-flex align-items-center gap-2"><span className="badge text-bg-dark">Matricula</span><span className="fw-semibold">{profile.nb}</span><CopyButton value={profile.nb} label="Matricula" /></div>} />
                    {profile.shouldShowBenefitSelect && (
                      <div className="row g-2 mb-3">
                        <div className="col-12">
                          <label className="form-label small opacity-75 mb-1">Selecionar beneficio</label>
                          <select
                            className="form-select form-select-sm"
                            value={profile.selectedBenefitKey}
                            onChange={(event) => setSelectedBenefitKey(event.target.value)}
                          >
                            {profile.benefitOptions.map((item) => (
                              <option key={item.key} value={item.key}>{item.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    <MatriculaLine leftLabel="NB" leftValue={profile.nb} rightLabel="Consignavel" rightValue={profile.consignavel} />
                    <MatriculaLine leftLabel="Especie" leftValue={profile.especie} rightLabel="Situacao" rightValue={profile.situacao} />
                    <MatriculaLine leftLabel="Data Inicio Beneficio" leftValue={profile.dib} rightLabel="UF" rightValue={profile.uf} />
                    <div className="row g-2 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="col-12 col-lg-6 d-flex justify-content-between gap-3">
                        <span style={miniLabelStyle}>Data Despacho Beneficio:</span>
                        <span className="fw-semibold text-end">{hasValue(profile.ddb) ? profile.ddb : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-xl-5">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle icon={FiPhone} title={`Telefones (${profile.phones.length})`} />
                    <div className="small d-flex align-items-center gap-2 mb-2"><FiCheck size={13} className="text-info" /><span className="fw-semibold">Numero selecionado</span></div>
                    <div className="small opacity-85 mb-3">{selectedPhone ? formatPhone(selectedPhone) : 'Nenhum numero selecionado'}</div>
                    <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr><th style={{ width: 30 }}></th><th>Numero</th><th>Inclusao</th></tr></thead><tbody>{profile.phones.length === 0 ? <EmptyCell colSpan={3} text="Nenhum telefone disponivel." /> : profile.phones.map((phone) => <tr key={phone}><td><FiCircle size={12} /></td><td>{formatPhone(phone)}</td><td>-</td></tr>)}</tbody></table></div>
                  </div>
                </div>
              </section>

              <section className="row g-3">
                {[
                  { label: 'Margem RMC', value: profile.margemRmc, footer: 'Cliente sem cartao' },
                  { label: 'Margem RCC', value: profile.margemRcc, footer: 'Cliente sem cartao' },
                  { label: 'Margem Livre', value: profile.margemLivre, footer: `Renda: ${profile.renda}` },
                ].map((item) => (
                  <div key={item.label} className="col-12 col-lg-4">
                    <div className="neo-card p-3 h-100" style={panelStyle}>
                      <div className="d-flex align-items-center gap-2 mb-2"><span style={bubbleIconStyle}><FiDollarSign size={13} /></span><div className="small opacity-75">{item.label}</div></div>
                      <div className="h3 fw-bold mb-0">{item.value}</div>
                      <div className="small fw-semibold mt-3 px-2 py-1 rounded" style={{ background: 'rgba(0, 199, 255, 0.25)' }}>{item.footer}</div>
                    </div>
                  </div>
                ))}
              </section>

              <section className="row g-3">
                <div className="col-12">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle icon={FiHome} title={`Enderecos (${profile.enderecos.length})`} />
                    <div className="small d-flex align-items-center gap-2 mb-2"><FiCheck size={13} className="text-info" /><span className="fw-semibold">Endereco selecionado</span></div>
                    <div className="small opacity-85 mb-3">{selectedAddress ? `${selectedAddress.cep || '-'} - ${selectedAddress.rua || '-'} - ${selectedAddress.bairro || '-'} - ${selectedAddress.cidade || '-'} /${selectedAddress.uf || '-'}` : 'Nenhum endereco selecionado'}</div>
                    <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr><th style={{ width: 30 }}></th><th>CEP</th><th>Rua</th><th>Bairro</th><th>Cidade</th></tr></thead><tbody>{profile.enderecos.length === 0 ? <EmptyCell colSpan={5} text="Nenhum endereco disponivel." /> : profile.enderecos.map((item) => <tr key={`${item.cep}-${item.rua}-${item.cidade}`}><td><FiCircle size={12} /></td><td>{item.cep || '-'}</td><td>{item.rua || '-'}</td><td>{item.bairro || '-'}</td><td>{item.cidade ? `${item.cidade} /${item.uf || '-'}` : '-'}</td></tr>)}</tbody></table></div>
                  </div>
                </div>
              </section>

              <section className="row g-3">
                <div className="col-12 col-xl-6">
                  <div className="neo-card p-3 h-100" style={panelStyle}>
                    <SectionTitle icon={FiCreditCard} title={`Dados Bancarios (${profile.bankRows.length})`} />
                    <div className="small d-flex align-items-center gap-2 mb-2"><FiCheck size={13} className="text-info" /><span className="fw-semibold">Banco selecionado</span></div>
                    <div className="small opacity-85 mb-3">{selectedBank ? `${selectedBank.banco || '-'} / Ag ${selectedBank.agencia || '-'} / Conta ${selectedBank.conta || '-'}` : 'Nenhum banco selecionado'}</div>
                    <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr><th>Tipo de Liberacao</th><th>Banco</th><th>Agencia</th><th>Conta</th><th>Chave PIX</th></tr></thead><tbody>{profile.bankRows.length === 0 ? <EmptyCell colSpan={5} text="Nenhum dado bancario disponivel." /> : profile.bankRows.map((item) => <tr key={`${item.tipoLiberacao}-${item.banco}-${item.conta}`}><td>{item.tipoLiberacao || '-'}</td><td>{item.banco || '-'}</td><td>{item.agencia || '-'}</td><td>{item.conta || '-'}</td><td>{item.chavePix || '-'}</td></tr>)}</tbody></table></div>
                  </div>
                </div>
              </section>

              <section>
                <div className="fw-semibold mb-2">Contratos e Simuladores</div>
                <div className="neo-card p-3" style={panelStyle}>
                  <div className="d-flex align-items-center gap-2 mb-4"><span style={bubbleIconStyle}><FiDollarSign size={13} /></span><div className="fw-semibold text-uppercase" style={{ fontSize: '0.86rem' }}>Contratos</div></div>
                  <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr><th>Banco</th><th>N do Contrato</th><th>Parcelas</th><th>Taxa</th><th>Valor Parcela</th><th>Saldo</th><th>Emprestado</th></tr></thead><tbody>{profile.contratos.length === 0 ? <EmptyCell colSpan={7} text="Nenhum contrato encontrado." /> : profile.contratos.map((item) => <tr key={item.key}><td>{item.banco || '-'}</td><td>{item.contrato || '-'}</td><td>{item.parcelas || '-'}</td><td>{item.taxa || '-'}</td><td>{hasValue(item.valorParcela) ? formatMoney(item.valorParcela) : '-'}</td><td>{item.saldo || '-'}</td><td>{hasValue(item.emprestado) ? formatMoney(item.emprestado) : '-'}</td></tr>)}</tbody></table></div>
                </div>
              </section>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <div className="small text-warning">A API respondeu em formato nao mapeado para o layout detalhado.</div>
              {columns.length > 0 && <div className="table-responsive"><table className="table table-dark table-sm align-middle mb-0"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`row-${index}`}>{columns.map((column) => <td key={`${index}-${column}`}>{hasValue(row?.[column]) ? String(row[column]) : '-'}</td>)}</tr>)}</tbody></table></div>}
            </div>
          )}

        </section>
      </main>
      <Footer />
    </div>
  )
}
