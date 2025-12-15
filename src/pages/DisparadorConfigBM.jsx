import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { notify } from '../utils/notify.js'
import { Roles } from '../utils/roles.js'
import { FiCheckCircle, FiClock, FiXCircle, FiChevronsRight, FiChevronsLeft } from 'react-icons/fi'

export default function DisparadorConfigBM() {
  const { user } = useAuth()
  const warned = useRef(false)
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

  const isMasterLevel1 = user?.role === Roles.Master && Number(user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia ?? 0) === 1

  useEffect(() => {
    if (!isMasterLevel1 && !warned.current) {
      warned.current = true
      notify.warn('Acesso permitido apenas para Master nível 1.')
    }
  }, [isMasterLevel1])

  const handleValidate = async () => {
    const idClean = String(bmId || '').trim()
    const tokenClean = String(token || '').trim()
    if (!idClean || !tokenClean) {
      notify.warn('Informe ID BM e Token.')
      return
    }
    setValidating(true)
    setBmNome('')
    setBmStatus('')
    setValidationStatus('idle')
    setAccounts([])
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
      notify.success('BM validado.')
      await fetchWhatsappAccounts(idClean, tokenClean)
    } catch (e) {
      setValidationStatus('error')
      notify.error(e?.message || 'Falha ao validar BM.')
    } finally {
      setValidating(false)
    }
  }

  const fetchWhatsappAccounts = async (idClean, tokenClean) => {
    setAccountsLoading(true)
    setAccountsError('')
    try {
      const params = new URLSearchParams({
        fields: 'id,name,creation_time',
        access_token: tokenClean
      })
      const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(idClean)}/owned_whatsapp_business_accounts?${params.toString()}`
      const res = await fetch(url, { method: 'GET' })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      const data = JSON.parse(raw)
      const arr = Array.isArray(data?.data) ? data.data : []
      setAccounts(arr)
    } catch (e) {
      setAccounts([])
      setAccountsError(e?.message || 'Falha ao buscar canais WhatsApp.')
      notify.error(e?.message || 'Falha ao buscar canais WhatsApp.')
    } finally {
      setAccountsLoading(false)
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
    return { label: value || '-', color: '#6c757d' }
  }

  const mapQuality = (value) => {
    const v = String(value || '').toLowerCase()
    if (v === 'red') return { label: 'Ruim', color: '#ef4444' }
    if (v === 'green') return { label: 'Boa', color: '#22c55e' }
    return { label: value || '-', color: '#6c757d' }
  }

  const formatLimit = (value) => {
    const v = String(value || '').toUpperCase()
    if (v === 'TIER_1K') return '1.000'
    return value || '-'
  }

  const requestPhones = async (accountId, tokenClean) => {
    if (phonesByAccount[accountId]) return phonesByAccount[accountId]
    const params = new URLSearchParams({
      fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,is_official_business_account,name_status,new_name_status,platform_type,throughput,account_mode,certificate,messaging_limit_tier',
      access_token: tokenClean
    })
    const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(accountId)}/phone_numbers?${params.toString()}`
    const res = await fetch(url, { method: 'GET' })
    const raw = await res.text().catch(() => '')
    if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
    const data = JSON.parse(raw)
    const arr = Array.isArray(data?.data) ? data.data : []
    setPhonesByAccount((prev) => ({ ...prev, [accountId]: arr }))
    return arr
  }

  const mapTemplateStatus = (value) => {
    const v = String(value || '').toUpperCase()
    if (v === 'APPROVED') return { label: 'Aprovado', color: '#22c55e' }
    return { label: value || '-', color: '#6c757d' }
  }

  const mapTemplateCategory = (value) => {
    const v = String(value || '').toUpperCase()
    if (v === 'UTILITY') return 'Utilidade'
    return value || '-'
  }

  const getTemplateBodyText = (tpl) => {
    const body = (tpl?.components || []).find((comp) => String(comp?.type).toUpperCase() === 'BODY')
    return body?.text || '-'
  }

  const requestTemplates = async (accountId, tokenClean) => {
    if (templatesByPhone[accountId]) return templatesByPhone[accountId]
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

  const selectedPhones = selectedAccountId ? phonesByAccount[selectedAccountId] || [] : []
  const templatesKey = selectedAccountId || selectedPhone?.id
  const templates = templatesKey ? templatesByPhone[templatesKey] || [] : []

  const handleSave = async () => {
    const idClean = String(bmId || '').trim()
    const tokenClean = String(token || '').trim()
    if (!idClean || !tokenClean) {
      notify.warn('Informe ID BM e Token antes de salvar.')
      return
    }
    if (!accounts || accounts.length === 0) {
      notify.warn('Valide a BM para carregar os canais antes de salvar.')
      return
    }
    setSaving(true)
    try {
      const payloadAccounts = []
      for (const acc of accounts) {
        const phones = await requestPhones(acc.id, tokenClean)
        const templatesForAccount = await requestTemplates(acc.id, tokenClean)
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

      const body = {
        bmId: idClean,
        token: tokenClean,
        nomeBm: bmNome || '-',
        statusPortfolio: bmStatus || '-',
        canais: payloadAccounts
      }

      const res = await fetch('https://n8n.apivieiracred.store/webhook/bm-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const raw = await res.text().catch(() => '')
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`)
      notify.success('Dados enviados com sucesso.')
    } catch (e) {
      notify.error(e?.message || 'Falha ao salvar dados.')
    } finally {
      setSaving(false)
    }
  }

  if (!isMasterLevel1) return <Navigate to="/dashboard" replace />

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

        <div className="neo-card neo-lg p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="mb-1">Configuração BM</h5>
              <div className="small opacity-75">Gerencie credenciais e status das APIs do BM usadas nos disparos.</div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
              Adicionar
            </button>
          </div>
          <p className="mb-0 opacity-75">
            Cadastre uma BM para validar tokens, acompanhar status de verificação e habilitar os fluxos de disparo. Em breve os formulários completos serão adicionados.
          </p>
        </div>

        {modalOpen && (
          <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1050 }} aria-modal="true" role="dialog">
            <div
              className="modal-dialog modal-dialog-centered"
              style={{ maxWidth: '1500px', width: 'min(98vw, 1500px)' }}
            >
              <div className="modal-content modal-dark">
                <div className="modal-header">
                  <h5 className="modal-title">Adicionar BM</h5>
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
                    <div className="col-12 col-md-6">
                      <label className="form-label">Token</label>
                      <input
                        type="text"
                        className="form-control"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Cole o token"
                      />
                    </div>
                    <div className="col-12 col-md-2">
                      <label className="form-label d-block">Validar</label>
                      <button
                        type="button"
                        className={`btn w-100 ${validationStatus === 'success' ? 'btn-success' : validationStatus === 'error' ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={handleValidate}
                        disabled={validating}
                        title="Validar BM"
                      >
                        {validationStatus === 'success' && <FiCheckCircle />}
                        {validationStatus === 'error' && <FiXCircle />}
                        {validationStatus === 'idle' && <FiClock />}
                      </button>
                    </div>
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
                                <th style={{ width: '28%' }}>Data</th>
                                <th style={{ width: '42%' }}>Canais</th>
                                <th style={{ width: '20%' }}>Canal ID</th>
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
                                    <td className="small text-nowrap">{formatUnixToBR(acc.creation_time)}</td>
                                    <td className="small">{acc.name || '-'}</td>
                                    <td className="small">{acc.id || '-'}</td>
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
                                  <th style={{ width: '30%' }}>Telefone</th>
                                  <th style={{ width: '30%' }}>Telefone ID</th>
                                  <th style={{ width: '20%' }}>Qualidade</th>
                                  <th style={{ width: '20%' }}>Limite</th>
                                </tr>
                              </thead>
                                <tbody>
                                  {phonesLoading && (
                                    <tr>
                                      <td colSpan={4} className="text-center">
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                      </td>
                                    </tr>
                                  )}
                                  {!phonesLoading && selectedPhones.length > 0 && selectedPhones.map((ph) => (
                                    <tr key={ph.id}>
                                      <td className="small text-nowrap">
                                        <button
                                          type="button"
                                          className="btn btn-link text-decoration-none p-0 text-light"
                                          onClick={() => fetchTemplatesForPhone(ph, selectedAccountId)}
                                          title="Ver modelos de mensagem deste telefone"
                                        >
                                          {ph.display_phone_number || '-'}
                                        </button>
                                      </td>
                                      <td className="small text-nowrap">{ph.id || '-'}</td>
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
                                      <td colSpan={4} className="small">Nenhum telefone carregado.</td>
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
                  <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || validating || accountsLoading}>
                    {saving ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
                    Salvar
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={validating}>
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
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '900px', width: 'min(96vw, 900px)' }}>
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
      <Footer />
    </div>
  )
}
