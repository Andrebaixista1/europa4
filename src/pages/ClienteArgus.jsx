import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiArrowLeft, FiCalendar, FiChevronLeft, FiChevronRight, FiCopy, FiDollarSign, FiHash, FiInfo, FiRefreshCw, FiUser } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useLoading } from '../context/LoadingContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
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

const formatTimeOffset = (iso, offsetHours = 0) => {
  if (!iso) return '--:--'
  const raw = String(iso).trim()
  if (!raw) return '--:--'
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '--:--'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '--:--'
  if (offsetHours) d.setHours(d.getHours() + offsetHours)
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

const toTitleCase = (value) => String(value)
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase())

const mapTipoCredito = (value) => {
  if (value == null || value === '') return '-'
  const raw = String(value).trim()
  if (!raw) return '-'
  const numericRaw = raw.replace(',', '.')
  if (/^-?\d+(\.\d+)?$/.test(numericRaw)) {
    return raw
  }
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').trim()
  if (normalized === 'magnetic card' || normalized === 'cartao magnetico' || normalized === 'cartão magnético') {
    return 'Cartão Magnético'
  }
  if (normalized === 'checking account' || normalized === 'conta corrente') {
    return 'Conta Corrente'
  }
  return toTitleCase(raw)
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

const formatPhoneDisplay = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return raw
}

const copyToClipboard = async (text, successMsg = 'Copiado!') => {
  const payload = String(text ?? '').trim()
  if (!payload) return
  try {
    await navigator.clipboard.writeText(payload)
    notify.success(successMsg, { autoClose: 2000 })
  } catch (_) {
    try {
      const el = document.createElement('textarea')
      el.value = payload
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

const formatCep = (value) => {
  if (value == null || value === '') return '-'
  const raw = String(value).trim()
  if (!raw) return '-'
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 8 && digits.endsWith('00')) {
    digits = digits.slice(0, -2)
  }
  if (digits.length > 8) {
    digits = digits.slice(0, 8)
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }
  return raw
}

const hasValue = (value) => value != null && String(value).trim() !== ''

const countFilled = (record, keys) => keys.reduce(
  (total, key) => total + (hasValue(record?.[key]) ? 1 : 0),
  0,
)

const MARGENS_FIELDS = [
  'data_despacho_beneficio',
  'especie',
  'valor_beneficio_margens',
  'valor_beneficio',
  'total_valor_liberado',
  'margem_disponivel',
  'saldo_total_disponivel',
  'margem_rmc',
  'margem_rcc',
  'celular1',
  'celular2',
  'celular3',
]
const PROPOSTA_FIELDS = [
  'contrato_empres',
  'data_update',
  'numero_beneficio',
  'especie',
  'situacao_empres',
  'data_concessao',
  'data_despacho_beneficio',
  'comp_ini_desconto',
  'comp_fim_desconto',
  'dt_averbacao_consig',
  'valor_beneficio',
  'valor_parcela',
  'valor_emprestimo',
  'quant_parcelas',
  'pagas',
  'restantes',
  'banco_desembolso',
  'agencia_desembolso',
  'conta_desembolso',
  'tipo_credito',
]

const hasMargensData = (record) => countFilled(record, MARGENS_FIELDS) > 0
const hasPropostaData = (record) => countFilled(record, PROPOSTA_FIELDS) > 0

const formatBlankValue = (value) => (value == null || value === '' ? '' : String(value))

const formatDateBlank = (value) => {
  const formatted = formatDate(value)
  return formatted === '-' ? '' : formatted
}

const formatTimeBlank = (value) => {
  const formatted = formatTime(value)
  return formatted === '--:--' ? '' : formatted
}

const formatCurrencyBlank = (value) => (
  value == null || value === '' ? '' : brCurrency(value)
)
const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))

const toNumber = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value).trim()
  if (!raw) return null
  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  let normalized = raw.replace(/\s/g, '')
  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = normalized.replace(',', '.')
  }
  const num = Number(normalized)
  return Number.isNaN(num) ? null : num
}

const formatMoneyValue = (value) => {
  const num = toNumber(value)
  return num == null ? '-' : brCurrency(num)
}

const stripZeroCents = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^-?\d+[.,]00$/.test(raw)) return raw.replace(/[.,]00$/, '')
  return raw
}

const mapSituacaoBeneficio = (value) => {
  if (!value) return ''
  if (value === 'elegible') return 'Elegível'
  return String(value)
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

const formatCompetencia = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  const compactMatch = raw.match(/^(\d{4})(\d{2})$/)
  if (compactMatch) {
    const year = Number(compactMatch[1])
    const month = Number(compactMatch[2])
    if (Number.isNaN(year) || Number.isNaN(month)) return '-'
    if (year < 1900 || year > 2100) return '-'
    if (month < 1 || month > 12) return '-'
    return `01/${compactMatch[2]}/${compactMatch[1]}`
  }
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
  return `${match[3]}/${match[2]}/${match[1]}`
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

const normalizeIn100Payload = (payload) => {
  if (!payload) return null
  let source = payload
  const keys = ['data', 'resultado', 'result', 'consulta', 'resposta', 'response', 'retorno']
  for (const key of keys) {
    if (source && typeof source === 'object' && key in source) {
      source = source[key]
    }
  }
  const records = toRecordArray(source)
  if (records.length === 0) return []

  const normalized = records
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({
      numero_beneficio: record.numero_beneficio ??
        record.numeroBeneficio ??
        record.nb ??
        record.numero_beneficio_inss ??
        record.numeroBeneficioInss,
      numero_documento: record.numero_documento ??
        record.cpf ??
        record.documento ??
        record.numeroDocumento,
      nome: record.nome ??
        record.nome_beneficiario ??
        record.nomeBeneficiario ??
        record.nome_cliente ??
        record.nomeCliente,
      data_nascimento: record.data_nascimento ??
        record.dataNascimento ??
        record.nascimento ??
        record.dataNascimentoBeneficiario ??
        record.data_nascimento_beneficiario,
      estado: record.estado ?? record.uf ?? record.UF ?? record.estado_pagamento ?? record.ufPagamento,
      data_retorno_consulta: record.data_retorno_consulta ??
        record.data_retorno ??
        record.dataConsulta ??
        record.data_consulta ??
        record.dataRetornoConsulta ??
        record.data_hora_registro,
      situacao_beneficio: record.situacao_beneficio ??
        record.situacao ??
        record.situacaoBeneficio ??
        record.status_beneficio ??
        record.statusBeneficio ??
        record.status,
      data_concessao: record.data_concessao ??
        record.dataConcessao ??
        record.dataConcessaoBeneficio ??
        record.dib,
      data_despacho_beneficio: record.data_despacho_beneficio ??
        record.dataDespachoBeneficio ??
        record.dataDespacho ??
        record.data_despacho,
      nome_representante_legal: record.nome_representante_legal ??
        record.representante_legal ??
        record.nomeRepresentanteLegal ??
        record.nome_procurador ??
        record.nomeProcurador,
      numero_portabilidades: record.numero_portabilidades ??
        record.portabilidades ??
        record.numeroPortabilidades ??
        record.qtd_portabilidades,
      status_api: record.status_api ??
        record.statusApi ??
        record.status ??
        record.status_api_consulta,
      saldo_cartao_beneficio: record.saldo_cartao_beneficio ??
        record.saldoCartaoBeneficio ??
        record.saldo_cartao_beneficio_inss,
      saldo_cartao_consignado: record.saldo_cartao_consignado ??
        record.saldoCartaoConsignado ??
        record.saldo_cartao_consignado_inss,
      saldo_total_disponivel: record.saldo_total_disponivel ??
        record.saldoTotalDisponivel ??
        record.margem_disponivel ??
        record.margemDisponivel,
      banco_desembolso: record.banco_desembolso ??
        record.bancoDesembolso ??
        record.banco ??
        record.codigo_banco ??
        record.codigoBanco ??
        record.banco_pagador,
      banco_nome: record.nome_banco ??
        record.nomeBanco ??
        record.banco_nome ??
        record.bancoNome,
      agencia_desembolso: record.agencia_desembolso ??
        record.agenciaDesembolso ??
        record.agencia ??
        record.agencia_pagadora ??
        record.agenciaPagadora,
      conta_desembolso: record.conta_desembolso ??
        record.contaDesembolso ??
        record.conta ??
        record.conta_corrente ??
        record.contaCorrente,
      digito_desembolso: record.digito_desembolso ??
        record.digitoDesembolso ??
        record.digito ??
        record.digito_conta ??
        record.digitoConta,
      tipo_credito: record.tipo_credito ??
        record.tipoCredito ??
        record.tipo_credito_beneficio ??
        record.tipoCreditoBeneficio,
      especie: record.especie ??
        record.codigo_especie ??
        record.CODIGO_ESPECIE ??
        record.codigoEspecie ??
        record.especieBeneficio,
    }))

  normalized.sort((a, b) => {
    const timeA = parseDateValue(a.data_retorno_consulta)
    const timeB = parseDateValue(b.data_retorno_consulta)
    if (timeA == null && timeB == null) return 0
    if (timeA == null) return 1
    if (timeB == null) return -1
    return timeB - timeA
  })

  return normalized
}

const pickNestedValue = (source, keys) => {
  if (!source || typeof source !== 'object') return undefined
  const candidates = [
    source,
    source.dados,
    source.data,
    source.resultado,
    source.result,
    source.cliente,
    source.consulta,
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    for (const key of keys) {
      const value = candidate[key]
      if (value != null && value !== '') return value
    }
  }
  return undefined
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
        selected.NOME ??
        selected.Nome ??
        selected.nome_beneficiario ??
        selected.nomeBeneficiario ??
        selected.nome_cliente ??
        selected.nomeCliente ??
        selected.nome_segurado,
      numero_documento: selected.numero_documento ??
        selected.cpf ??
        selected.CPF ??
        selected.documento ??
        selected.numeroDocumento ??
        selected.nu_cpf ??
        selected.nu_cpf_ix ??
        selected.nu_cpf_tratado,
      numero_beneficio: selected.numero_beneficio ??
        selected.nb ??
        selected.beneficio ??
        selected.Beneficio ??
        selected.BENEFICIO ??
        selected.numeroBeneficio ??
        selected.numero_beneficio_inss ??
        selected.numeroBeneficioInss ??
        selected.nb_ix ??
        selected.nb_tratado,
      data_nascimento: normalizeDateInput(
        selected.data_nascimento ??
        selected.Data_Nascimento ??
        selected.DATA_NASCIMENTO ??
        selected.dataNascimento ??
        selected.nascimento ??
        selected.dataNascimentoBeneficiario ??
        selected.dt_nascimento_tratado ??
        selected.dt_nascimento,
      ),
      idade: selected.idade ??
        selected.Idade ??
        selected.IDADE ??
        selected.age ??
        selected.idade_beneficiario,
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
        selected.ddb ??
        selected.DDB ??
        selected['DDB'],
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
      municipio: selected.municipio ??
        selected.Municipio ??
        selected.MUNICIPIO ??
        selected.cidade ??
        selected.municipio_residencial ??
        selected.cidade_residencial,
      cep: selected.cep ?? selected.cep_residencial ?? selected.cepResidencial,
      uf_endereco: selected.uf ?? selected.UF ?? selected.estado ?? selected.estado_residencial ?? selected.uf_residencial,
      celular1: pickNestedValue(selected, [
        'celular1', 'celular_1', 'CELULAR1', 'CELULAR_1', 'CELULAR 1',
        'telefone1', 'telefone_1', 'TELEFONE1', 'TELEFONE_1', 'TELEFONE 1',
        'fone1', 'FONE1',
      ]),
      celular2: pickNestedValue(selected, [
        'celular2', 'celular_2', 'CELULAR2', 'CELULAR_2', 'CELULAR 2',
        'telefone2', 'telefone_2', 'TELEFONE2', 'TELEFONE_2', 'TELEFONE 2',
        'fone2', 'FONE2',
      ]),
      celular3: pickNestedValue(selected, [
        'celular3', 'celular_3', 'CELULAR3', 'CELULAR_3', 'CELULAR 3',
        'telefone3', 'telefone_3', 'TELEFONE3', 'TELEFONE_3', 'TELEFONE 3',
        'fone3', 'FONE3',
      ]),
      nome_representante_legal: selected.nome_representante_legal ??
        selected.representante_legal ??
        selected.nomeRepresentanteLegal ??
        selected.nome_procurador ??
        selected.nomeProcurador,
      numero_portabilidades: portabilidadeCount,
      valor_beneficio: selected.vl_beneficio_tratado ??
        selected.vl_beneficio ??
        selected.valor_beneficio ??
        selected.valorBeneficio ??
        selected.VALOR_BENEFICIO ??
        selected['VALOR_BENEFICIO'],
      valor_beneficio_margens: selected.VALOR_BENEFICIO ??
        selected['VALOR_BENEFICIO'] ??
        selected.valor_beneficio ??
        selected.valorBeneficio ??
        selected.vl_beneficio_tratado ??
        selected.vl_beneficio,
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
      margem_disponivel: selected.margem_disponivel ??
        selected.margemDisponivel ??
        selected.saldo_total_disponivel ??
        selected.saldoTotalDisponivel ??
        selected.MARGEM_DISPONIVEL ??
        selected['MARGEM_DISPONIVEL'],
      margem_rmc: selected.margem_rmc ??
        selected.margemRmc ??
        selected.margem_disponivel_cartao ??
        selected.margemDisponivelCartao ??
        selected.margem_cartao ??
        selected.margemCartao ??
        selected.margem_disponivel_rmc ??
        selected.margemDisponivelRmc ??
        selected.MARGEM_RMC ??
        selected['MARGEM_RMC'],
      margem_rcc: selected.margem_rcc ??
        selected.margemRcc ??
        selected.margem_disponivel_rcc ??
        selected.margemDisponivelRcc ??
        selected.margem_rcc_disponivel ??
        selected.margemRccDisponivel ??
        selected.MARGEM_RCC ??
        selected['MARGEM_RCC'] ??
        selected['Margem RCC'],
      total_valor_liberado: selected.total_valor_liberado ??
        selected.totalValorLiberado ??
        selected.valor_total_liberado ??
        selected.valorTotalLiberado ??
        selected.total_valor ??
        selected.totalValor ??
        selected.Total_Valor_Liberado_02801 ??
        selected['Total_Valor_Liberado_02801'] ??
        selected['Total_Valor_Liberado(0.02801)'] ??
        selected['Total_Valor_Liberado_0.02801'],
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
        selected.CODIGO_ESPECIE ??
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
  const { user } = useAuth()
  const [cpf, setCpf] = useState('')
  const [beneficio, setBeneficio] = useState('')
  const [clientes, setClientes] = useState([])
  const [clienteIndex, setClienteIndex] = useState(0)
  const [bancoInfo, setBancoInfo] = useState(null)
  const [in100List, setIn100List] = useState([])
  const [in100Index, setIn100Index] = useState(0)
  const [in100Loading, setIn100Loading] = useState(false)
  const [in100BancoInfo, setIn100BancoInfo] = useState(null)
  const [metrics, setMetrics] = useState({ totalCarregado: 0, disponivel: 0, realizadas: 0 })
  const [showIn100Confirm, setShowIn100Confirm] = useState(false)
  const [activeTab, setActiveTab] = useState('margens')
  const lastQueryRef = useRef('')
  const in100RequestRef = useRef(0)

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

  const margensIndexList = useMemo(
    () => clientes
      .map((item, index) => ({
        index,
        score: countFilled(item, MARGENS_FIELDS),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.index),
    [clientes],
  )
  const propostaIndexList = useMemo(
    () => clientes
      .map((item, index) => ({
        index,
        score: countFilled(item, PROPOSTA_FIELDS),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.index),
    [clientes],
  )
  const activeIndexList = activeTab === 'proposta' ? propostaIndexList : margensIndexList
  const activePageIndex = activeIndexList.indexOf(clienteIndex)
  const activeTotal = activeIndexList.length
  const lastActiveListRef = useRef('')

  const bumpIn100Request = () => {
    in100RequestRef.current += 1
    return in100RequestRef.current
  }

  const fetchIn100List = async (cpfDigits, nbDigits) => {
    if (!cpfDigits || !nbDigits) return
    try {
      const url = new URL('https://n8n.apivieiracred.store/webhook/resposta-macica')
      url.searchParams.set('cpf', cpfDigits)
      url.searchParams.set('nb', nbDigits)
      const res = await fetch(url.toString(), { method: 'GET' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) return
      const normalized = normalizeIn100Payload(payload)
      if (!normalized || normalized.length === 0) return []
      return normalized.slice(0, 5)
    } catch (_) {
      // Mantem os campos vazios se falhar.
    }
    return []
  }

  const fetchIn100 = async (cpfDigits, nbDigits, requestId = bumpIn100Request()) => {
    const list = await fetchIn100List(cpfDigits, nbDigits)
    if (requestId !== in100RequestRef.current) return
    if (!list || list.length === 0) return
    setIn100List(list)
    setIn100Index(0)
  }

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
      // Silencia erros para nao travar a UI.
    }
  }

  const handleLookup = async (cpfDigits, nbDigits, { resetOnFail = false } = {}) => {
    if (!cpfDigits || !nbDigits) return
    loader.begin()
    setClientes([])
    setClienteIndex(0)
    setBancoInfo(null)
    setIn100List([])
    setIn100Index(0)
    setIn100Loading(false)
    setIn100BancoInfo(null)
    setActiveTab('margens')

    const in100RequestId = bumpIn100Request()
    void fetchIn100(cpfDigits, nbDigits, in100RequestId)

    try {
      const url = new URL('https://n8n.apivieiracred.store/webhook/api/cliente-argus/')
      url.searchParams.set('CPF', cpfDigits)
      url.searchParams.set('NB', nbDigits)

      const res = await fetch(url.toString(), { method: 'GET' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = extractErrorMessage(payload) || 'Erro ao consultar Maciça.'
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
      setActiveTab('margens')
    } catch (error) {
      notify.error(error?.message || 'Erro ao consultar Maciça.')
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
      setIn100List([])
      setIn100Index(0)
      setIn100Loading(false)
      setIn100BancoInfo(null)
      setCpf('')
      setBeneficio('')
      notify.warn('URL sem CPF/NB validos.')
      return
    }
    setCpf(formatCpf(cpfDigits))
    setBeneficio(formatBeneficio(nbDigits))
    handleLookup(cpfDigits, nbDigits, { resetOnFail: true })
  }, [urlParams.cpf, urlParams.nb])

  useEffect(() => {
    fetchSaldoUsuario()
  }, [user])

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

  const in100 = useMemo(() => {
    if (!in100List.length) return null
    const safeIndex = Math.min(in100Index, in100List.length - 1)
    return in100List[safeIndex]
  }, [in100Index, in100List])

  useEffect(() => {
    if (!in100?.banco_desembolso) {
      setIn100BancoInfo(null)
      return
    }
    let active = true
    fetchBanco(in100.banco_desembolso).then((info) => {
      if (active) setIn100BancoInfo(info)
    })
    return () => {
      active = false
    }
  }, [in100?.banco_desembolso])

  const handleSearch = (event) => {
    event.preventDefault()
    const cpfDigits = digitsOnly(cpf)
    const nbDigits = digitsOnly(beneficio)
    if (!cpfDigits || !nbDigits) {
      notify.warn('Informe CPF e NB para continuar.')
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
  const dataNascimentoLabel = formatDate(cliente?.data_nascimento)
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
  const margemRmcValue = cliente?.margem_rmc
  const margemDisponivelValue = cliente?.margem_disponivel ?? cliente?.saldo_total_disponivel
  const margemRccValue = cliente?.margem_rcc
  const totalValorLiberadoValue = (() => {
    const base = toNumber(cliente?.total_valor_liberado)
    if (base != null) return base
    const margem = toNumber(margemDisponivelValue)
    if (margem == null) return null
    return margem / 0.02801
  })()
  const paginaLabel = activeTotal && activePageIndex >= 0 ? `${activePageIndex + 1} de ${activeTotal}` : '-'
  const in100BancoNome = formatBlankValue(
    in100?.nome_banco ?? in100?.banco_nome ?? in100?.bancoNome ?? in100?.banco_desembolso_nome,
  ) || formatBlankValue(in100BancoInfo?.name)
  const in100StatusValue = formatBlankValue(
    in100?.status_api ?? in100?.statusApi ?? in100?.status,
  )
  const in100StatusClass = in100StatusValue
    ? (String(in100StatusValue).trim().toLowerCase() === 'sucesso' ? 'text-success' : 'text-danger')
    : ''
  const in100UpdatedLabel = (() => {
    if (!in100?.data_retorno_consulta && !in100?.data_consulta) return ''
    const raw = in100?.data_retorno_consulta || in100?.data_consulta
    const dateLabel = formatDateBlank(raw)
    const timeLabel = (() => {
      const formatted = formatTimeOffset(raw, 3)
      return formatted === '--:--' ? '' : formatted
    })()
    if (!dateLabel) return ''
    return timeLabel ? `${dateLabel} as ${timeLabel}` : dateLabel
  })()
  const totalIn100 = in100List.length
  const in100PageLabel = totalIn100 ? `${in100Index + 1} de ${totalIn100}` : '-'
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

  useEffect(() => {
    if (activeTab !== 'margens' && activeTab !== 'proposta') return
    const key = `${activeTab}|${activeIndexList.join(',')}`
    if (lastActiveListRef.current === key) return
    lastActiveListRef.current = key
    if (activeIndexList.length) {
      setClienteIndex(activeIndexList[0])
    }
  }, [activeIndexList, activeTab])

  const beneficiosList = useMemo(() => {
    const seen = new Set()
    return clientes
      .map((item) => digitsOnly(item?.numero_beneficio))
      .filter((digits) => {
        if (!digits) return false
        if (seen.has(digits)) return false
        seen.add(digits)
        return true
      })
      .map((digits) => formatBeneficioDisplay(digits))
  }, [clientes])
  const handlePrevProposta = () => {
    setClienteIndex((current) => {
      const list = activeIndexList
      if (list.length <= 1) return current
      const pos = list.indexOf(current)
      if (pos === -1) return list[0]
      return list[Math.max(pos - 1, 0)]
    })
  }
  const handleNextProposta = () => {
    setClienteIndex((current) => {
      const list = activeIndexList
      if (list.length <= 1) return current
      const pos = list.indexOf(current)
      if (pos === -1) return list[0]
      return list[Math.min(pos + 1, list.length - 1)]
    })
  }
  const handleOpenIn100Confirm = () => {
    if (in100Loading) return
    setShowIn100Confirm(true)
  }
  const handleConfirmIn100 = () => {
    setShowIn100Confirm(false)
    void handleConsultarIn100()
  }
  const handleConsultarIn100 = async () => {
    if (in100Loading) return
    const cpfDigits = digitsOnly(cpf) || digitsOnly(cliente?.numero_documento)
    const nbDigits = digitsOnly(beneficio) || digitsOnly(cliente?.numero_beneficio)
    if (!cpfDigits || !nbDigits) {
      notify.warn('Informe CPF e NB para consultar IN100.')
      return
    }
    const requestId = bumpIn100Request()
    setIn100List([])
    setIn100Index(0)
    setIn100Loading(true)
    try {
      const equipeId = user?.equipe_id ?? user?.team_id ?? user?.equipeId ?? user?.teamId ?? null
      const limiteDisponivel = Number(metrics.disponivel ?? 0)
      const payload = {
        id: (typeof user?.id !== 'undefined' ? user.id : user),
        cpf: cpfDigits,
        nb: nbDigits,
        limite_disponivel: limiteDisponivel,
      }
      if (equipeId != null) {
        payload.equipe_id = equipeId
        payload.team_id = equipeId
        payload.id_equipe = equipeId
      }
      const res = await fetch('https://n8n.apivieiracred.store/webhook/consulta-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Falha ao consultar IN100.')

      // Aguarda resposta API finalizar (similar ao fluxo IN100).
      await new Promise((resolve) => setTimeout(resolve, 5000))
      while (requestId === in100RequestRef.current) {
        const resResposta = await fetch('https://n8n.apivieiracred.store/webhook/resposta-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user?.id,
            cpf: cpfDigits,
            nb: nbDigits,
            limite_disponivel: limiteDisponivel,
          }),
        })
        if (resResposta.ok) {
          const dataTry = await resResposta.json().catch(() => null)
          const first = Array.isArray(dataTry) ? (dataTry[0] || {}) : (dataTry || {})
          if (first && isResponseFinished(first.resposta_api)) {
            notify.success('Consulta IN100 concluída.', { autoClose: 6000 })
            const normalized = normalizeIn100Payload(dataTry)
            if (normalized && normalized.length > 0) {
              setIn100List(normalized.slice(0, 5))
              setIn100Index(0)
            }
            if (!isStatusSuccess(first.status_api)) {
              notify.error((first.status_api || '').trim() || 'Erro ao consultar IN100.')
            }
            break
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    } catch (error) {
      notify.error(error?.message || 'Erro ao consultar IN100.')
    } finally {
      if (requestId === in100RequestRef.current) {
        setIn100Loading(false)
      }
    }
  }
  const handlePrevIn100 = () => {
    setIn100Index((current) => {
      if (in100List.length <= 1) return current
      return Math.max(current - 1, 0)
    })
  }
  const handleNextIn100 = () => {
    setIn100Index((current) => {
      if (in100List.length <= 1) return current
      return Math.min(current + 1, in100List.length - 1)
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
                {hasResult ? 'Dados carregados da consulta.' : 'Consultas direto do nosso banco de dados da Maciça.'}
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
                <div className="col-12 col-lg-3">
                  <div className="label">Nome</div>
                  <div className="value fw-semibold">{cliente?.nome || '-'}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label d-flex align-items-center gap-1"><FiHash /> CPF</div>
                  <div className="value value-with-action">
                    <span className="value-text">{cliente?.numero_documento ? formatCpf(cliente.numero_documento) : '-'}</span>
                    {!!digitsOnly(cliente?.numero_documento) && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => copyToClipboard(digitsOnly(cliente?.numero_documento), 'CPF copiado!')}
                        title="Copiar CPF"
                        aria-label="Copiar CPF"
                      >
                        <FiCopy />
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="label d-flex align-items-center gap-1"><FiCalendar /> Data Nascimento</div>
                  <div className="value">{dataNascimentoLabel}</div>
                </div>
                <div className="col-6 col-lg-1">
                  <div className="label d-flex align-items-center gap-1"><FiCalendar /> Idade</div>
                  <div className="value">{idadeLabel}</div>
                </div>
                <div className="col-6 col-lg-1">
                  <div className="label">UF</div>
                  <div className="value">{cliente?.estado || '-'}</div>
                </div>
                <div className="col-12 col-lg-3">
                  <div className="label">Benefícios (NB)</div>
                  <div className="value d-flex flex-column gap-1">
                    {beneficiosList.length > 0 ? (
                      beneficiosList.map((nb) => (
                        <div key={nb} className="value-with-action">
                          <span className="value-text">{nb}</span>
                          {!!digitsOnly(nb) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon"
                              onClick={() => copyToClipboard(digitsOnly(nb), 'NB copiado!')}
                              title="Copiar NB"
                              aria-label="Copiar NB"
                            >
                              <FiCopy />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <span>-</span>
                    )}
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
                          <td>{formatCep(row.cep)}</td>
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


            <div className="tab-switcher d-flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Abas principais">
              <button
                type="button"
                role="tab"
                id="tab-margens"
                aria-selected={activeTab === 'margens'}
                aria-controls="tab-panel-margens"
                className={`btn btn-sm tab-btn ${activeTab === 'margens' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('margens')}
              >
                Margens Disponiveis
              </button>
              <button
                type="button"
                role="tab"
                id="tab-proposta"
                aria-selected={activeTab === 'proposta'}
                aria-controls="tab-panel-proposta"
                className={`btn btn-sm tab-btn ${activeTab === 'proposta' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('proposta')}
              >
                Contratos
              </button>
              <button
                type="button"
                role="tab"
                id="tab-in100"
                aria-selected={activeTab === 'in100'}
                aria-controls="tab-panel-in100"
                className={`btn btn-sm tab-btn ${activeTab === 'in100' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('in100')}
              >
                IN100
              </button>
            </div>

            {activeTab === 'margens' && (
            <div className="neo-card p-0 mb-4 tab-panel" role="tabpanel" id="tab-panel-margens" aria-labelledby="tab-margens">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Margens do Cliente</h6>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm d-inline-flex align-items-center justify-content-center"
                    onClick={handlePrevProposta}
                    disabled={activeTotal <= 1 || activePageIndex <= 0}
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
                    disabled={activeTotal <= 1 || activePageIndex >= activeTotal - 1}
                    title="Próxima proposta"
                    aria-label="Próxima proposta"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              </div>
              <div className="p-3 p-md-4 fade-swap" key={`margens-${clienteIndex}`}>
                <div className="row g-3 mb-3">
                  <div className="col-12 col-xl-5">
                    <div className="neo-card p-0 h-100 d-flex flex-column">
                      <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                        <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Detalhes do Benefício</h6>
                      </div>
                      <div className="kv-list kv-single p-3 p-md-4 flex-grow-1">
                        <div className="kv-line">
                          <div className="kv-label">DDB:</div>
                          <div className="kv-value">{cliente?.data_despacho_beneficio ? formatDate(cliente.data_despacho_beneficio) : '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Espécie:</div>
                          <div className="kv-value">{cliente?.especie || '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Valor benefício:</div>
                          <div className="kv-value">{formatMoneyValue(cliente?.valor_beneficio_margens ?? cliente?.valor_beneficio)}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Valor Liberado:</div>
                          <div className="kv-value">{formatMoneyValue(totalValorLiberadoValue)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-xl-7">
                    <div className="d-grid gap-3">
                      <div className="neo-card p-0">
                        <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                          <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Margens Disponíveis</h6>
                        </div>
                        <div className="kv-list p-3 p-md-4">
                          <div className="kv-line">
                            <div className="kv-label">Margem RMC:</div>
                            <div className="kv-value">{formatMoneyValue(margemRmcValue)}</div>
                            <div className="kv-label">Margem RCC:</div>
                            <div className="kv-value">{formatMoneyValue(margemRccValue)}</div>
                          </div>
                          <div className="kv-line">
                            <div className="kv-label">Margem disponível:</div>
                            <div className="kv-value">{formatMoneyValue(margemDisponivelValue)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="neo-card p-0">
                        <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                          <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Contatos</h6>
                        </div>
                        <div className="kv-list p-3 p-md-4">
                          <div className="kv-line">
                            <div className="kv-label">Celular 1:</div>
                            <div className="kv-value value-with-action">
                              <span className="value-text">{formatPhoneDisplay(cliente?.celular1)}</span>
                              {!!digitsOnly(cliente?.celular1) && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm btn-icon"
                                  onClick={() => copyToClipboard(digitsOnly(cliente?.celular1), 'Celular 1 copiado!')}
                                  title="Copiar Celular 1"
                                  aria-label="Copiar Celular 1"
                                >
                                  <FiCopy />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="kv-line">
                            <div className="kv-label">Celular 2:</div>
                            <div className="kv-value value-with-action">
                              <span className="value-text">{formatPhoneDisplay(cliente?.celular2)}</span>
                              {!!digitsOnly(cliente?.celular2) && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm btn-icon"
                                  onClick={() => copyToClipboard(digitsOnly(cliente?.celular2), 'Celular 2 copiado!')}
                                  title="Copiar Celular 2"
                                  aria-label="Copiar Celular 2"
                                >
                                  <FiCopy />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="kv-line">
                            <div className="kv-label">Celular 3:</div>
                            <div className="kv-value value-with-action">
                              <span className="value-text">{formatPhoneDisplay(cliente?.celular3)}</span>
                              {!!digitsOnly(cliente?.celular3) && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm btn-icon"
                                  onClick={() => copyToClipboard(digitsOnly(cliente?.celular3), 'Celular 3 copiado!')}
                                  title="Copiar Celular 3"
                                  aria-label="Copiar Celular 3"
                                >
                                  <FiCopy />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {activeTab === 'proposta' && (
            <div className="neo-card p-0 mb-4 tab-panel" role="tabpanel" id="tab-panel-proposta" aria-labelledby="tab-proposta">
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
                    disabled={activeTotal <= 1 || activePageIndex <= 0}
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
                    disabled={activeTotal <= 1 || activePageIndex >= activeTotal - 1}
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
                          <div className="kv-value">{cliente?.banco_desembolso ? stripZeroCents(cliente.banco_desembolso) : '-'}</div>
                          <div className="kv-label">Nome do Banco:</div>
                          <div className="kv-value">{bancoInfo?.name || '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Agência:</div>
                          <div className="kv-value">{cliente?.agencia_desembolso ? stripZeroCents(cliente.agencia_desembolso) : '-'}</div>
                          <div className="kv-label">Conta:</div>
                          <div className="kv-value">{cliente?.conta_desembolso ? stripZeroCents(cliente.conta_desembolso) : '-'}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Tipo de crédito:</div>
                          <div className="kv-value">{cliente?.tipo_credito ? stripZeroCents(mapTipoCredito(cliente.tipo_credito)) : '-'}</div>
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
            )}

            {activeTab === 'in100' && (
            <div className="neo-card p-0 mb-4 tab-panel" role="tabpanel" id="tab-panel-in100" aria-labelledby="tab-in100">
              <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Últimas consultas IN100</h6>
                  <div className="small proposta-date">{in100UpdatedLabel ? `Atualizado: ${in100UpdatedLabel}` : ''}</div>
                  {in100StatusValue && (
                    <div className="small">
                      <span className="opacity-75">Status: </span>
                      <span className={in100StatusClass}>{in100StatusValue}</span>
                    </div>
                  )}
                </div>
                <div className="d-flex align-items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-pesquisar"
                    onClick={handleOpenIn100Confirm}
                    disabled={in100Loading}
                  >
                    {in100Loading ? 'Carregando...' : (
                      <span className="d-inline-flex align-items-center gap-2">
                        <FiRefreshCw />
                        Atualizar Consulta
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm d-inline-flex align-items-center justify-content-center"
                    onClick={handlePrevIn100}
                    disabled={totalIn100 <= 1 || in100Index === 0}
                    title="Consulta anterior"
                    aria-label="Consulta anterior"
                  >
                    <FiChevronLeft />
                  </button>
                  <div className="small opacity-75">{in100PageLabel}</div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm d-inline-flex align-items-center justify-content-center"
                    onClick={handleNextIn100}
                    disabled={totalIn100 <= 1 || in100Index >= totalIn100 - 1}
                    title="Próxima consulta"
                    aria-label="Próxima consulta"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              </div>
              <div className="p-3 p-md-4 fade-swap" key={`in100-${in100Index}`}>
                <div className="row g-3 mb-3">
                  <div className="col-12 col-lg-7">
                    <div className="neo-card p-0 h-100">
                      <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                        <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Informações da matrícula</h6>
                      </div>
                      <div className="kv-list p-3 p-md-4">
                        <div className="kv-line">
                          <div className="kv-label">NB:</div>
                          <div className="kv-value">{in100?.numero_beneficio ? formatBeneficioDisplay(String(in100.numero_beneficio)) : ''}</div>
                          <div className="kv-label">Espécie:</div>
                          <div className="kv-value">{formatBlankValue(in100?.especie)}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Situação:</div>
                          <div className="kv-value">{mapSituacaoBeneficio(in100?.situacao_beneficio)}</div>
                          <div className="kv-label">Data de concessão:</div>
                          <div className="kv-value">{formatDateBlank(in100?.data_concessao)}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">UF:</div>
                          <div className="kv-value">{formatBlankValue(in100?.estado)}</div>
                          <div className="kv-label">Data do despacho do benefício:</div>
                          <div className="kv-value">{formatDateBlank(in100?.data_despacho_beneficio)}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Representante / Procurador:</div>
                          <div className="kv-value">{formatBlankValue(in100?.nome_representante_legal)}</div>
                          <div className="kv-label">Portabilidades:</div>
                          <div className="kv-value">{formatBlankValue(in100?.numero_portabilidades)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-5">
                    <div className="neo-card p-0 h-100">
                      <div className="section-bar px-4 py-3 d-flex align-items-center justify-content-between">
                        <h6 className="mb-0 d-flex align-items-center gap-2"><FiInfo /> Dados bancários</h6>
                      </div>
                      <div className="kv-list p-3 p-md-4">
                        <div className="kv-line">
                          <div className="kv-label">Banco:</div>
                          <div className="kv-value">{formatBlankValue(in100?.banco_desembolso)}</div>
                          <div className="kv-label">Nome do Banco:</div>
                          <div className="kv-value">{in100BancoNome}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Agência:</div>
                          <div className="kv-value">{formatBlankValue(in100?.agencia_desembolso)}</div>
                          <div className="kv-label">Conta:</div>
                          <div className="kv-value">{formatBlankValue(in100?.conta_desembolso)}</div>
                        </div>
                        <div className="kv-line">
                          <div className="kv-label">Dígito:</div>
                          <div className="kv-value">{formatBlankValue(in100?.digito_desembolso)}</div>
                          <div className="kv-label">Tipo de crédito:</div>
                          <div className="kv-value">{in100?.tipo_credito ? mapTipoCredito(in100.tipo_credito) : ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-lg-4">
                    <div className="neo-card stat-card h-100">
                      <div className="p-4">
                        <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Saldo Cartão Benefício:</div>
                        <div className="stat-value">{formatCurrencyBlank(in100?.saldo_cartao_beneficio)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-4">
                    <div className="neo-card stat-card h-100">
                      <div className="p-4">
                        <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Saldo Cartão Consignado:</div>
                        <div className="stat-value">{formatCurrencyBlank(in100?.saldo_cartao_consignado)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-4">
                    <div className="neo-card stat-card h-100">
                      <div className="p-4">
                        <div className="stat-title d-flex align-items-center gap-2"><FiDollarSign /> Margem disponível:</div>
                        <div className="stat-value">{formatCurrencyBlank(in100?.saldo_total_disponivel)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

          </section>
        )}

        {showIn100Confirm && (
          <div
            className="modal fade show"
            style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1050 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 'min(92vw, 720px)' }}>
              <div
                className="modal-content modal-dark"
                style={{
                  background:
                    'radial-gradient(260px 260px at 0% 0%, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0.12) 35%, rgba(20,20,20,0) 60%), linear-gradient(180deg, #0b0b0b 0%, #141414 100%)',
                }}
              >
                <div className="modal-header">
                  <h5 className="modal-title">Confirmar consulta IN100</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowIn100Confirm(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="mb-3">
                    Esta consulta irá consumir 1 crédito do seu saldo disponível. Deseja continuar?
                  </p>
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <div className="neo-card p-3 h-100">
                        <div className="small opacity-75">Total Carregado</div>
                        <div className="fs-4 fw-semibold">{formatNumber(metrics.totalCarregado)}</div>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="neo-card p-3 h-100">
                        <div className="small opacity-75">Disponível</div>
                        <div className="fs-4 fw-semibold">{formatNumber(metrics.disponivel)}</div>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="neo-card p-3 h-100">
                        <div className="small opacity-75">Consultas Realizadas</div>
                        <div className="fs-4 fw-semibold">{formatNumber(metrics.realizadas)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowIn100Confirm(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-pesquisar"
                    onClick={handleConfirmIn100}
                    disabled={in100Loading}
                  >
                    Confirmar consulta
                  </button>
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
