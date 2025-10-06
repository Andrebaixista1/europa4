import { useRef, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { FiSearch } from 'react-icons/fi'
import { useLoading } from '../context/LoadingContext.jsx'
import { notify } from '../utils/notify.js'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

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

  const [metrics, setMetrics] = useState({ totalCarregado: 0, disponivel: 0, realizadas: 0 })
  // Carrega saldos do usuário para preencher os cards
  useEffect(() => {
    const fetchSaldoUsuario = async () => {
      if (!user || !user.id) return
      try {
        const url = 'https://webhook.sistemavieira.com.br/webhook/saldo'
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_user: user.id, id: user.id, login: user.login }),
        })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (!data) return
        const item = Array.isArray(data) ? (data[0] || {}) : data
        setMetrics({
          totalCarregado: Number(item.total_carregado ?? 0),
          disponivel: Number(item.limite_disponivel ?? 0),
          realizadas: Number(item.consultas_realizada ?? 0),
        })
      } catch (_) {
        // silencia erros para não travar a UI
      }
    }
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

  const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-')
  const formatTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }) : '--:--')
  const idadeFrom = (iso) => {
    if (!iso) return '-'
    const b = new Date(iso), t = new Date()
    let age = t.getFullYear() - b.getFullYear()
    const m = t.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--
    return age
  }
  const brCurrency = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
  const mapPensao = (v) => (v === 'not_payer' ? 'Não pensionista' : v || '-')
  const mapBloqueio = (v) => (v === 'not_blocked' ? 'Não bloqueado' : v || '-')
  const mapTipoCredito = (v) => (v === 'magnetic_card' ? 'Cartão magnético' : v || '-')
  const mapSituacao = (v) => (v === 'elegible' ? 'Elegível' : v || '-')

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

  const onSearchMacica = () => {
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) {
      notify.warn('Informe um CPF válido (11 dígitos) para pesquisar na Maciça.')
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

  const onSubmit = async (e) => {
    e.preventDefault()
    loader.begin()
    try {
    if (Number(metrics.disponivel) <= 0) {
      notify.warn('Sem saldo dispon\u00edvel para realizar consultas.')
      return
    }
    const digits = cpf.replace(/\D/g, '')
    const benDigits = beneficio.replace(/\D/g, '')
    if (digits.length !== 11) return notify.warn('Informe um CPF válido (11 dígitos).')
    if (benDigits.length !== 10) return notify.warn('Informe um Benefício válido (10 dígitos).')
    loader.begin()
    try {
      if (online) {
        // 1) Dispara consulta online
        const urlConsulta = 'https://webhook.sistemavieira.com.br/webhook/consulta-online'
        const resConsulta = await fetch(urlConsulta, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: (typeof user?.id !== 'undefined' ? user.id : user), cpf: digits, nb: benDigits })
        })
        if (!resConsulta.ok) throw new Error('Falha na consulta online')

        // 2) Buscar resposta final no n8n com os dados completos para o front
        const urlResposta = 'https://n8n.sistemavieira.com.br/webhook/resposta-api'
        // Aguarda 5s antes da primeira consulta de resposta
        await new Promise(r => setTimeout(r, 5000))
        const isValidResposta = (d) => {
          if (!Array.isArray(d) || d.length === 0) return false
          const o = d[0] || {}
          return (
            typeof o.id !== 'undefined' &&
            !!o.numero_beneficio &&
            !!o.numero_documento &&
            !!o.nome &&
            o.status_api === 'Sucesso' &&
            o.resposta_api === 'Concluido'
          )
        }
        let arr = null
        while (true) {
          const resResposta = await fetch(urlResposta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: user?.id, cpf: digits, nb: benDigits })
          })
          if (resResposta.ok) {
            const dataTry = await resResposta.json().catch(() => null)
            if (Array.isArray(dataTry) && dataTry.length > 0) {
              const o = dataTry[0] || {}
              // Caso especial: resposta_api = 'Concluida' e nome = null => erro com status_api
              if (o.resposta_api === 'Concluida' && (o.nome === null || o.nome === undefined || o.nome === '')) {
                loader.end()
                notify.error(o.status_api || 'Erro na consulta online')
                return
              }
              if (isValidResposta(dataTry)) { arr = dataTry; break }
            }
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

        // 3) Após a resposta final, atualiza os saldos agregados (cards)
        try {
          const urlSaldo = 'https://webhook.sistemavieira.com.br/webhook/saldo'
          const resSaldo = await fetch(urlSaldo, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_user: user?.id, id: user?.id, login: user?.login })
          })
          if (resSaldo.ok) {
            const dataSaldo = await resSaldo.json().catch(() => null)
            const item = Array.isArray(dataSaldo) ? (dataSaldo?.[0] || {}) : (dataSaldo || {})
            setMetrics({
              totalCarregado: Number(item.total_carregado ?? 0),
              disponivel: Number(item.limite_disponivel ?? 0),
              realizadas: Number(item.consultas_realizada ?? 0),
            })
          }
        } catch { /* silencioso */ }
        loader.end()
        notify.success('Consulta online concluída')
        return
      }
      // Fluxo OFFLINE: chamada direta para webhook resposta-api
      const urlRespostaOffline = 'https://webhook.sistemavieira.com.br/webhook/resposta-api'
      // Aguarda 5s antes de buscar a resposta offline
      await new Promise(r => setTimeout(r, 5000))
      const resOff = await fetch(urlRespostaOffline, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user?.id, cpf: digits, nb: benDigits })
      })
      if (!resOff.ok) throw new Error('Falha na consulta (offline)')
      const dataOff = await resOff.json().catch(() => null)
      if (!Array.isArray(dataOff) || dataOff.length === 0) throw new Error('Resposta inválida (offline)')
      const o = dataOff[0] || {}
      if (o.resposta_api === 'Concluida' && (o.nome === null || o.nome === undefined || o.nome === '')) {
        loader.end()
        notify.error(o.status_api || 'Erro na consulta (offline)')
        return
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
        resposta_api: o.resposta_api || 'Concluido',
        status_api: o.status_api || 'Sucesso',
        tipo: 'offline',
      }
      setResultado(mappedOff)
      if (mappedOff.banco_desembolso) {
        try { setBancoInfo(await fetchBanco(mappedOff.banco_desembolso)) } catch { setBancoInfo(null) }
      }
      loader.end()
      notify.success('Consulta concluída')
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
    notify.success('Consulta concluída')
  } finally {
    loader.end()
  }
  
  }

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div>
            <h2 className="fw-bold mb-1">Consulta Individual (IN100)</h2>
            <div className="opacity-75 small">Faça buscas individuais por CPF e Benefício</div>
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
                  <div className="small text-uppercase opacity-75">{'Dispon\u00edvel'}</div>
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
            <form className="neo-card neo-lg p-4 h-100" onSubmit={onSubmit}>
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

        {resultado && (
          <section className="mt-4 result-section" ref={resultRef} id="result-print">
            <div className="neo-card neo-lg p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0">Resultados da Consulta</h5>
                <div className="small opacity-75">Última Atualização: {formatDate(resultado.data_retorno_consulta)} às {formatTime(resultado.data_retorno_consulta)}</div>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="neo-card p-3 h-100">
                    <div className="fw-semibold mb-2">Informações Básicas</div>
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
                    <div className="fw-semibold mb-2">Informações Pessoais</div>
                    <div className="small opacity-75">Pensão:</div>
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
                    <div className="fw-semibold mb-2">Informações do Benefício</div>
                    <div className="small opacity-75">Data de Concessão:</div>
                    <div className="mb-2">{formatDate(resultado.data_concessao)}</div>
                    <div className="small opacity-75">Término do Benefício:</div>
                    <div className="mb-2">{resultado.data_final_beneficio ? formatDate(resultado.data_final_beneficio) : '-'}</div>
                    <div className="small opacity-75">Tipo de Crédito:</div>
                    <div className="mb-2">{mapTipoCredito(resultado.tipo_credito)}</div>
                    <div className="small opacity-75">Status do Benefício:</div>
                    <div>{mapSituacao(resultado.situacao_beneficio)}</div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="neo-card p-3 h-100">
                    <div className="fw-semibold mb-2">Informações Financeiras</div>
                    <div className="small opacity-75">Saldo Cartão Benefício:</div>
                    <div className="mb-2">{brCurrency(resultado.saldo_cartao_beneficio)}</div>
                    <div className="small opacity-75">Saldo Cartão Consignado:</div>
                    <div className="mb-2">{brCurrency(resultado.saldo_cartao_consignado)}</div>
                    <div className="small opacity-75">{'Margem Dispon\u00edvel'}:</div>
                    <div className="mb-2">{brCurrency(resultado.saldo_total_disponivel)}</div>
                    <div className="small opacity-75">Empréstimos Ativos:</div>
                    <div>{resultado.numero_portabilidades}</div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="neo-card p-3 h-100">
                    <div className="fw-semibold mb-2">Informações Bancárias</div>
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
        )}
      </main>
      <Footer />
    </div>
  )
}
