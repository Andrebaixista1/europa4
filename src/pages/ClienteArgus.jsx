import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiArrowLeft, FiCalendar, FiChevronLeft, FiChevronRight, FiDollarSign, FiHash, FiInfo, FiUser } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import { notify } from '../utils/notify.js'

const formatCpf = (value) => {
  const v = String(value || '').replace(/\D/g, '').slice(0, 11)
  const parts = []
  if (v.length > 0) parts.push(v.slice(0, 3))
  if (v.length > 3) parts.push(v.slice(3, 6))
  if (v.length > 6) parts.push(v.slice(6, 9))
  const rest = v.slice(9, 11)
  let out = parts[0] || ''
  if (parts[1]) out = `${parts[0]}.${parts[1]}`
  if (parts[2]) out = `${parts[0]}.${parts[1]}.${parts[2]}`
  if (rest.length > 0) out = `${out}-${rest}`
  return out
}

const formatBeneficio = (value) => {
  const v = String(value || '').replace(/\D/g, '').slice(0, 10)
  const p1 = v.slice(0, 3)
  const p2 = v.slice(3, 6)
  const p3 = v.slice(6, 9)
  const p4 = v.slice(9, 10)
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

const formatDate = (iso) => {
  if (!iso) return '-'
  const raw = String(iso).trim()
  if (!raw) return '-'
  if (/^\d{8}$/.test(raw)) {
    if (/^0+$/.test(raw)) return '-'
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`
  }
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const formatTime = (iso) => {
  if (!iso) return '--:--'
  const raw = String(iso).trim()
  if (!raw) return '--:--'
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '--:--'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' })
}

const idadeFrom = (iso) => {
  if (!iso) return '-'
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/)
  const birth = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  if (Number.isNaN(birth.getTime())) return '-'
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const month = today.getMonth() - birth.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

const brCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))

const mapTipoCredito = (value) => {
  if (!value) return '-'
  if (value === 'magnetic_card') return 'Cartao magnetico'
  if (value === 'checking_account') return 'Conta Corrente'
  return value
}

const mapSituacaoEmpres = (value) => {
  const num = Number(value)
  if (!Number.isNaN(num)) return num === 1 ? 'Ativa' : 'Inativa'
  const raw = String(value ?? '').trim()
  return raw === '1' || raw === '1.0' ? 'Ativa' : 'Inativa'
}

const digitsOnly = (value) => String(value || '').replace(/\D/g, '')

const normalizeDateInput = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  }
  return raw
}

const parseDateValue = (value) => {
  const normalized = normalizeDateInput(value)
  if (!normalized) return null
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return null
  return d.getTime()
}

const toRecordArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return [value]
}

const formatAgeLabel = (idadeValue, dataNascimento) => {
  const raw = idadeValue == null ? '' : String(idadeValue).trim()
  if (raw) return /^\d+$/.test(raw) ? `${raw} anos` : raw
  const computed = idadeFrom(dataNascimento)
  if (computed === '-' || computed == null) return '-'
  return `${computed} anos`
}

const formatMetaValue = (value) => (value == null || value === '' ? '-' : String(value))

const formatCompetencia = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return '-'
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return '-'
  if (year < 1900 || year > 2100) return '-'
  if (month < 1 || month > 12) return '-'
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > maxDay) return '-'
  return `${match[1]}-${match[2]}-${match[3]}`
}

const extractErrorMessage = (payload) => {
  if (!payload) return ''
  if (typeof payload === 'string') return payload
  return (
    payload.error ||
    payload.erro ||
    payload.message ||
    payload.mensagem ||
    payload.detail ||
    payload?.response?.message ||
    ''
  )
}

const normalizeClientePayload = (payload) => {
  if (!payload) return null
  let source = payload
  const keys = ['data', 'resultado', 'result', 'cliente', 'consulta']
  for (const key of keys) {
    if (source && typeof source === 'object' && key in source) {
      source = source[key]
    }
  }
  const records = toRecordArray(source)
  if (records.length === 0) return null

  const portabilidadeCount = records.length
  const normalizedRecords = records.map((selected) => {
    if (!selected || typeof selected !== 'object') return null
    const dataUpdate = normalizeDateInput(
      selected.data_update ??
      selected.dataUpdate ??
      selected.data_atualizacao ??
      selected.updated_at ??
      selected.updatedAt,
    )
    const dataRetorno = normalizeDateInput(
      selected.data_retorno_consulta ??
      selected.data_retorno ??
      selected.dataConsulta ??
      selected.data_consulta ??
      selected.dataRetornoConsulta,
    )

    const normalized = {
      nome: selected.nome ??
        selected.nome_beneficiario ??
        selected.nomeBeneficiario ??
        selected.nome_cliente ??
        selected.nomeCliente ??
        selected.nome_segurado,
      numero_documento: selected.numero_documento ??
        selected.cpf ??
        selected.documento ??
        selected.numeroDocumento ??
        selected.nu_cpf ??
        selected.nu_cpf_ix ??
        selected.nu_cpf_tratado,
      numero_beneficio: selected.numero_beneficio ??
        selected.nb ??
        selected.numeroBeneficio ??
        selected.numero_beneficio_inss ??
        selected.numeroBeneficioInss ??
        selected.nb_ix ??
        selected.nb_tratado,
      data_nascimento: normalizeDateInput(
        selected.data_nascimento ??
        selected.dataNascimento ??
        selected.nascimento ??
        selected.dataNascimentoBeneficiario ??
        selected.dt_nascimento_tratado ??
        selected.dt_nascimento,
      ),
      idade: selected.idade ?? selected.age ?? selected.idade_beneficiario,
      estado: selected.estado ?? selected.uf ?? selected.UF ?? selected.estado_pagamento ?? selected.ufPagamento,
      data_retorno_consulta: dataUpdate || dataRetorno,
      situacao_beneficio: selected.situacao_beneficio ??
        selected.situacao ??
        selected.situacaoBeneficio ??
        selected.status_beneficio ??
        selected.statusBeneficio,
      situacao_empres: selected.situacao_empres ?? selected.situacaoEmpres ?? selected.status_empres ?? selected.statusEmpres,
      data_concessao: normalizeDateInput(
        selected.data_concessao ??
        selected.dataConcessao ??
        selected.dataConcessaoBeneficio ??
        selected.dib,
      ),
      data_despacho_beneficio: normalizeDateInput(
        selected.data_despacho_beneficio ??
        selected.dataDespachoBeneficio ??
        selected.dataDespacho ??
        selected.ddb,
      ),
      comp_ini_desconto: selected.comp_ini_desconto_tratado ??
        selected.comp_ini_desconto ??
        selected.compIniDesconto ??
        selected.comp_ini ??
        selected.competencia_inicio ??
        selected.competenciaInicio,
      comp_fim_desconto: selected.comp_fim_desconto_tratado ??
        selected.comp_fim_desconto ??
        selected.compFimDesconto ??
        selected.comp_fim ??
        selected.competencia_fim ??
        selected.competenciaFim,
      dt_averbacao_consig: normalizeDateInput(
        selected.dt_averbacao_consig ??
        selected.data_averbacao_consig ??
        selected.data_averbacao_consignado ??
        selected.dt_averbacao ??
        selected.data_averbacao,
      ),
      endereco: selected.endereco ??
        selected.endereco_completo ??
        selected.logradouro ??
        selected.rua ??
        selected.enderecoResidencial ??
        selected.endereco_residencial,
      bairro: selected.bairro ?? selected.bairro_residencial ?? selected.bairroResidencial,
      municipio: selected.municipio ?? selected.cidade ?? selected.municipio_residencial ?? selected.cidade_residencial,
      cep: selected.cep ?? selected.cep_residencial ?? selected.cepResidencial,
      uf_endereco: selected.uf ?? selected.UF ?? selected.estado ?? selected.estado_residencial ?? selected.uf_residencial,
      nome_representante_legal: selected.nome_representante_legal ??
        selected.representante_legal ??
        selected.nomeRepresentanteLegal ??
        selected.nome_procurador ??
        selected.nomeProcurador,
      numero_portabilidades: portabilidadeCount,
      valor_beneficio: selected.vl_beneficio_tratado ??
        selected.vl_beneficio ??
        selected.valor_beneficio ??
        selected.valorBeneficio,
      valor_parcela: selected.vl_parcela_tratado ??
        selected.vl_parcela ??
        selected.valor_parcela ??
        selected.valorParcela,
      valor_emprestimo: selected.vl_empres_tratado ??
        selected.vl_empres ??
        selected.valor_emprestimo ??
        selected.valorEmprestimo,
      quant_parcelas: selected.quant_parcelas_tratado ??
        selected.quant_parcelas ??
        selected.qtd_parcelas ??
        selected.quantidade_parcelas,
      pagas: selected.pagas ?? selected.parcelas_pagas ?? selected.qtd_pagas,
      restantes: selected.restantes ?? selected.parcelas_restantes ?? selected.qtd_restantes,
      saldo_cartao_beneficio: selected.saldo_cartao_beneficio ??
        selected.saldoCartaoBeneficio ??
        selected.saldo_cartao_beneficio_inss,
      saldo_cartao_consignado: selected.saldo_cartao_consignado ??
        selected.saldoCartaoConsignado ??
        selected.saldo_cartao_consignado_inss,
      saldo_total_disponivel: selected.saldo_total_disponivel ??
        selected.saldoTotalDisponivel ??
        selected.margem_disponivel ??
        selected.margemDisponivel,
      banco_desembolso: selected.banco_desembolso ??
        selected.bancoDesembolso ??
        selected.banco ??
        selected.codigo_banco ??
        selected.codigoBanco ??
        selected.id_banco_pagto ??
        selected.id_banco_empres,
      agencia_desembolso: selected.agencia_desembolso ??
        selected.agenciaDesembolso ??
        selected.agencia ??
        selected.agencia_pagadora ??
        selected.agenciaPagadora ??
        selected.id_agencia_banco,
      contrato_empres: selected.id_contrato_empres ??
        selected.idContratoEmpres ??
        selected.contrato_empres ??
        selected.contratoEmpres ??
        selected.contrato ??
        selected.id_contrato,
      conta_desembolso: selected.conta_desembolso ??
        selected.contaDesembolso ??
        selected.conta ??
        selected.conta_corrente ??
        selected.contaCorrente ??
        selected.nu_conta_corrente,
      digito_desembolso: selected.digito_desembolso ??
        selected.digitoDesembolso ??
        selected.digito ??
        selected.digito_conta ??
        selected.digitoConta,
      tipo_credito: selected.tipo_credito ??
        selected.tipoCredito ??
        selected.tipo_credito_beneficio ??
        selected.tipoCreditoBeneficio ??
        selected.cs_meio_pagto ??
        selected.tipo_empres,
      especie: selected.especie ??
        selected.codigo_especie ??
        selected.codigoEspecie ??
        selected.especieBeneficio ??
        selected.esp,
      data_update: dataUpdate,
    }
    const hasAny = Object.values(normalized).some((value) => value !== undefined && value !== null && value !== '')
    return hasAny ? normalized : null
  }).filter(Boolean)

  if (normalizedRecords.length === 0) return null

  normalizedRecords.sort((a, b) => {
    const timeA = parseDateValue(a.data_update || a.data_retorno_consulta)
    const timeB = parseDateValue(b.data_update || b.data_retorno_consulta)
    if (timeA == null && timeB == null) return 0
    if (timeA == null) return 1
    if (timeB == null) return -1
    return timeB - timeA
  })

  return normalizedRecords
}

const getParamValue = (params, key) => (
  params.get(key) || params.get(key.toUpperCase()) || params.get(key.toLowerCase()) || ''
)

const parseClienteQuery = (pathname, search) => {
  const searchParams = new URLSearchParams(search)
  const cpf = getParamValue(searchParams, 'cpf')
  const nb = getParamValue(searchParams, 'nb')
  if (cpf || nb) {
    return { cpf: cpf || '', nb: nb || '' }
  }

  const base = '/consulta/cliente-argus'
  if (!pathname.startsWith(base)) return { cpf: '', nb: '' }

  let tail = pathname.slice(base.length)
  if (tail.startsWith('/')) tail = tail.slice(1)
  tail = tail.replace(/\/+$/, '')
  if (!tail) return { cpf: '', nb: '' }

  const pathParams = new URLSearchParams(tail.replace(/^\?/, ''))
  return { cpf: getParamValue(pathParams, 'cpf'), nb: getParamValue(pathParams, 'nb') }
}

const fetchBanco = async (code) => {
  const safeCode = String(code ?? '').trim()
  if (!safeCode) return null
  try {
    const res = await fetch(`https://brasilapi.com.br/api/banks/v1/${safeCode}`)
    if (!res.ok) throw new Error('fail')
    const data = await res.json()
    return { code: data.code || safeCode, name: data.name || data.fullName || String(safeCode) }
  } catch (_) {
    return { code: safeCode, name: String(safeCode) }
  }
}

export default function ClienteArgus() {
  const location = useLocation()
  const loader = useLoading()
  const [cpf, setCpf] = useState('')
  const [beneficio, setBeneficio] = useState('')
  const [clientes, setClientes] = useState([])
  const [clienteIndex, setClienteIndex] = useState(0)
  const [bancoInfo, setBancoInfo] = useState(null)
  const lastQueryRef = useRef('')

  const urlParams = useMemo(
    () => parseClienteQuery(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const hasUrlParams = useMemo(() => {
    const cpfDigits = digitsOnly(urlParams.cpf)
    const nbDigits = digitsOnly(urlParams.nb)
    return Boolean(cpfDigits || nbDigits)
  }, [urlParams.cpf, urlParams.nb])

  const cliente = useMemo(() => {
    if (!clientes.length) return null
    const safeIndex = Math.min(clienteIndex, clientes.length - 1)
    return clientes[safeIndex]
  }, [clienteIndex, clientes])

  const handleLookup = async (cpfDigits, nbDigits, { resetOnFail = false } = {}) => {
    if (!cpfDigits || !nbDigits) return
    loader.begin()
    setClientes([])
    setClienteIndex(0)
    setBancoInfo(null)

    try {
      const url = new URL('https://n8n.apivieiracred.store/webhook/api/cliente-argus/')
      url.searchParams.set('CPF', cpfDigits)
      url.searchParams.set('NB', nbDigits)

      const res = await fetch(url.toString(), { method: 'GET' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = extractErrorMessage(payload) || 'Erro ao consultar Cliente Argus.'
        throw new Error(msg)
      }

      const normalized = normalizeClientePayload(payload)
      if (!normalized || normalized.length === 0) {
        const msg = extractErrorMessage(payload)
        if (msg) {
          notify.error(msg)
        } else {
          notify.warn('Nenhum dado encontrado para CPF/NB informados.')
        }
        if (resetOnFail) {
          setCpf('')
          setBeneficio('')
        }
        return
      }

      setClientes(normalized)
      setClienteIndex(0)
    } catch (error) {
      notify.error(error?.message || 'Erro ao consultar Cliente Argus.')
      if (resetOnFail) {
        setCpf('')
        setBeneficio('')
      }
    } finally {
      loader.end()
    }
  }

  useEffect(() => {
    const cpfDigits = digitsOnly(urlParams.cpf)
    const nbDigits = digitsOnly(urlParams.nb)
    if (!cpfDigits && !nbDigits) return

    const key = `${cpfDigits}|${nbDigits}`
    if (lastQueryRef.current === key) return
    lastQueryRef.current = key

    if (!cpfDigits || !nbDigits) {
      setClientes([])
      setClienteIndex(0)
      setBancoInfo(null)
      setCpf('')
      setBeneficio('')
      notify.warn('URL sem CPF/NB validos.')
      return
    }
    if (cpfDigits.length !== 11 || nbDigits.length !== 10) {
      setClientes([])
      setClienteIndex(0)
      setBancoInfo(null)
      setCpf('')
      setBeneficio('')
      notify.warn('URL com CPF/NB invalidos.')
      return
    }

    setCpf(formatCpf(cpfDigits))
    setBeneficio(formatBeneficio(nbDigits))
    handleLookup(cpfDigits, nbDigits, { resetOnFail: true })
  }, [urlParams.cpf, urlParams.nb])

  useEffect(() => {
    if (!cliente?.banco_desembolso) {
      setBancoInfo(null)
      return
    }
    let active = true
    fetchBanco(cliente.banco_desembolso).then((info) => {
      if (active) setBancoInfo(info)
    })
    return () => {
      active = false
    }
  }, [cliente?.banco_desembolso])

  const handleSearch = (event) => {
    event.preventDefault()
    const cpfDigits = digitsOnly(cpf)
    const nbDigits = digitsOnly(beneficio)
    if (cpfDigits.length !== 11) {
      notify.warn('CPF invalido.')
      return
    }
    if (nbDigits.length !== 10) {
      notify.warn('NB invalido.')
      return
    }
    handleLookup(cpfDigits, nbDigits, { resetOnFail: true })
  }

  const hasResult = Boolean(cliente)
  const updatedLabel = cliente?.data_retorno_consulta
    ? (() => {
        const dateLabel = formatDate(cliente.data_retorno_consulta)
        const timeLabel = formatTime(cliente.data_retorno_consulta)
        return timeLabel === '--:--' ? dateLabel : `${dateLabel} as ${timeLabel}`
      })()
    : '-'
  const idadeLabel = formatAgeLabel(cliente?.idade, cliente?.data_nascimento)
  const parcelaMeta = {
    parcelas: formatMetaValue(cliente?.quant_parcelas),
    pagas: formatMetaValue(cliente?.pagas),
    restantes: formatMetaValue(cliente?.restantes),
  }
  const propostaLabel = cliente?.data_update
    ? formatDate(cliente.data_update)
    : (cliente?.data_retorno_consulta ? formatDate(cliente.data_retorno_consulta) : '-')
  const propostaIdLabel = cliente?.contrato_empres != null && String(cliente.contrato_empres).trim() !== ''
    ? String(cliente.contrato_empres)
    : '-'
  const totalPropostas = clientes.length
  const paginaLabel = totalPropostas ? `${clienteIndex + 1} de ${totalPropostas}` : '-'
  const enderecoRows = useMemo(() => {
    const seen = new Set()
    const rows = []
    clientes.forEach((item, index) => {
      const row = {
        key: `endereco-${index}`,
        endereco: item?.endereco,
        bairro: item?.bairro,
        municipio: item?.municipio,
        uf: item?.uf_endereco || item?.estado,
        cep: item?.cep,
      }
      const values = [row.endereco, row.bairro, row.municipio, row.uf, row.cep]
      if (!values.some((value) => String(value ?? '').trim() !== '')) return
      const key = values.map((value) => String(value ?? '').trim().toLowerCase()).join('|')
      if (seen.has(key)) return
      seen.add(key)
      rows.push(row)
    })
    return rows
  }, [clientes])
  const handlePrevProposta = () => {
    setClienteIndex((current) => {
      const total = clientes.length
      if (total <= 1) return current
      return Math.max(current - 1, 0)
    })
  }
  const handleNextProposta = () => {
    setClienteIndex((current) => {
      const total = clientes.length
      if (total <= 1) return current
      return Math.min(current + 1, total - 1)
    })
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
              <h2 className="fw-bold mb-1">Cliente Argus</h2>
              <div className="opacity-75 small">
                {hasResult ? 'Dados carregados da consulta.' : 'Informe CPF e NB para buscar o cliente.'}
              </div>
            </div>
          </div>
        </div>

        {!hasUrlParams && (
          <form className="neo-card neo-lg p-4 mb-4" onSubmit={handleSearch}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label">CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-control"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  required
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">NB (Benefício)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-control"
                  placeholder="000.000.000-0"
                  value={beneficio}
                  onChange={(e) => setBeneficio(formatBeneficio(e.target.value))}
                  required
                />
              </div>
            </div>
            <div className="mt-3">
              <button type="submit" className="btn btn-primary">
                Pesquisar
              </button>
            </div>
          </form>
        )}

        {hasResult && (
          <section className="result-section">
            <div className="neo-card result-hero p-4 mb-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0 d-flex align-items-center gap-2"><FiUser /> Dados pessoais</h5>
                <div className="small opacity-75">Atualizado: {updatedLabel}</div>
              </div>
              <div className="row g-3">
                <div className="col-12 col-lg-4">
                  <div className="label">Nome</div>
                  <div className="value fw-semibold">{cliente?.nome || '-'}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label d-flex align-items-center gap-1"><FiHash /> CPF</div>
                  <div className="value">{cliente?.numero_documento ? formatCpf(cliente.numero_documento) : '-'}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label d-flex align-items-center gap-1"><FiCalendar /> Idade</div>
                  <div className="value">{idadeLabel}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label">UF</div>
                  <div className="value">{cliente?.estado || '-'}</div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-4">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Proposta - {propostaIdLabel}</h6>
                  <div className="small proposta-date">Data da proposta: {propostaLabel}</div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm d-inline-flex align-items-center justify-content-center"
                    onClick={handlePrevProposta}
                    disabled={totalPropostas <= 1 || clienteIndex === 0}
                    title="Proposta anterior"
                    aria-label="Proposta anterior"
                  >
                    <FiChevronLeft />
                  </button>
                  <div className="small opacity-75">{paginaLabel}</div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm d-inline-flex align-items-center justify-content-center"
                    onClick={handleNextProposta}
                    disabled={totalPropostas <= 1 || clienteIndex >= totalPropostas - 1}
                    title="Próxima proposta"
                    aria-label="Próxima proposta"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              </div>
              <div className="p-3 p-md-4 fade-swap" key={clienteIndex}>
                <div className="row g-3 mb-3">
                  <div className="col-12 col-lg-7">
                    <div className="neo-card p-0 h-100">
                      <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                        <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Informações da matrícula</h6>
                      </div>
                      <div className="kv-list p-3 p-md-4">
                        <div className="kv-line">
                          <div className="kv-label">NB:</div>
                          <div className="kv-value">{cliente?.numero_beneficio ? formatBeneficioDisplay(cliente.numero_beneficio) : '-'}</div>
                          <div className="kv-label">Espécie:</div>
                          <div className="kv-value">{cliente?.especie || '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Situação:</div>
                          <div className="kv-value">{mapSituacaoEmpres(cliente?.situacao_empres)}</div>
                          <div className="kv-label">Data de concessão:</div>
                          <div className="kv-value">{cliente?.data_concessao ? formatDate(cliente.data_concessao) : '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">UF:</div>
                          <div className="kv-value">{cliente?.estado || '-'}</div>
                          <div className="kv-label">Data do despacho do benefício:</div>
                          <div className="kv-value">{cliente?.data_despacho_beneficio ? formatDate(cliente.data_despacho_beneficio) : '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Comp. ini. desconto:</div>
                          <div className="kv-value">{formatCompetencia(cliente?.comp_ini_desconto)}</div>
                          <div className="kv-label">Comp. fim desconto:</div>
                          <div className="kv-value">{formatCompetencia(cliente?.comp_fim_desconto)}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">QTDE. Portabilidades:</div>
                          <div className="kv-value">{cliente?.numero_portabilidades != null ? String(cliente.numero_portabilidades) : '-'}</div>
                          <div className="kv-label">Data Averbação Consig.:</div>
                          <div className="kv-value">{cliente?.dt_averbacao_consig ? formatDate(cliente.dt_averbacao_consig) : '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-5">
                    <div className="neo-card p-0 h-100">
                      <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                        <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Dados bancários - Empréstimo</h6>
                      </div>
                      <div className="kv-list p-3 p-md-4">
                        <div className="kv-line">
                          <div className="kv-label">Banco:</div>
                          <div className="kv-value">{cliente?.banco_desembolso || '-'}</div>
                          <div className="kv-label">Nome do Banco:</div>
                          <div className="kv-value">{bancoInfo?.name || '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Agência:</div>
                          <div className="kv-value">{cliente?.agencia_desembolso || '-'}</div>
                          <div className="kv-label">Conta:</div>
                          <div className="kv-value">{cliente?.conta_desembolso || '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Tipo de crédito:</div>
                          <div className="kv-value">{cliente?.tipo_credito ? mapTipoCredito(cliente.tipo_credito) : '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-lg-4">
                    <div className="neo-card stat-card h-100">
                      <div className="p-4">
                        <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Valor Benefício:</div>
                        <div className="stat-value">{cliente?.valor_beneficio != null ? brCurrency(cliente.valor_beneficio) : '-'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-4">
                    <div className="neo-card stat-card h-100">
                      <div className="p-4">
                        <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Valor Parcela:</div>
                        <div className="stat-value">{cliente?.valor_parcela != null ? brCurrency(cliente.valor_parcela) : '-'}</div>
                      </div>
                      <div className="stat-footer small px-4 pb-3 pt-2 d-flex flex-wrap gap-3">
                        <span>Parcelas: {parcelaMeta.parcelas}</span>
                        <span>Pagas: {parcelaMeta.pagas}</span>
                        <span>Restantes: {parcelaMeta.restantes}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-4">
                    <div className="neo-card stat-card h-100">
                      <div className="p-4">
                        <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Valor Empréstimo:</div>
                        <div className="stat-value">{cliente?.valor_emprestimo != null ? brCurrency(cliente.valor_emprestimo) : '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card p-0 mb-4">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Endereços</h6>
              </div>
              <div className="table-responsive">
                <table className="table table-dark table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: '38%' }}>Endereço</th>
                      <th style={{ width: '18%' }}>Bairro</th>
                      <th style={{ width: '18%' }}>Município</th>
                      <th style={{ width: '8%' }}>UF</th>
                      <th style={{ width: '18%' }}>CEP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enderecoRows.length > 0 ? (
                      enderecoRows.map((row) => (
                        <tr key={row.key}>
                          <td>{formatMetaValue(row.endereco)}</td>
                          <td>{formatMetaValue(row.bairro)}</td>
                          <td>{formatMetaValue(row.municipio)}</td>
                          <td>{formatMetaValue(row.uf)}</td>
                          <td>{formatMetaValue(row.cep)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center small opacity-75 py-4">
                          Nenhum endereço encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
