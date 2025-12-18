import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Activity, Calendar, RefreshCw, Clock, CheckCircle2, XCircle, FileText, Info, Phone, Trash2 } from 'lucide-react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { notify } from '../utils/notify.js'

export default function AcompanhamentoDisparos() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [selectedCampanha, setSelectedCampanha] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState([])
  const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [showDeleteCampanhaModal, setShowDeleteCampanhaModal] = useState(false)
  const [campanhaToDelete, setCampanhaToDelete] = useState(null)

  const toDigits = (v) => String(v ?? '').replace(/\D/g, '')
  
  const formatWhatsapp = (phone) => {
    const digits = toDigits(phone)
    if (!digits) return ''
    let rest = digits
    if (rest.startsWith('55')) rest = rest.slice(2)
    if (rest.length < 10) return `+55 ${digits}`
    const ddd = rest.slice(0, 2)
    const num = rest.slice(2)
    if (num.length === 9) return `+55 (${ddd}) ${num.slice(0,5)}-${num.slice(5)}`
    if (num.length === 8) return `+55 (${ddd}) ${num.slice(0,4)}-${num.slice(4)}`
    const split = num.length > 5 ? 5 : Math.ceil(num.length/2)
    return `+55 (${ddd}) ${num.slice(0, split)}-${num.slice(split)}`
  }

  const parseDateTimeToDate = (value) => {
    if (value === null || value === undefined || value === '') return null
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value

    if (typeof value === 'number') {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const str = String(value).trim()
    if (!str) return null

    const isoWithZone = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i)
    if (isoWithZone) {
      const date = new Date(str)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const isoLocal = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2}))?)?$/)
    if (isoLocal) {
      const [, year, month, day, hour = '00', minute = '00'] = isoLocal
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
    }

    const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2})(?::(\d{2}))?)?$/)
    if (brMatch) {
      const [, day, month, year, hour = '00', minute = '00'] = brMatch
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
    }

    const numericTimestamp = Number(str)
    if (!Number.isNaN(numericTimestamp)) {
      const date = new Date(numericTimestamp)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const fallback = new Date(str)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const formatDateTimeSP = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (isNaN(date.getTime())) return '-'
    const pad = (number) => String(number).padStart(2, '0')
    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  }

  const normalizeStatus = (value) => {
    if (value === null || value === undefined) return null
    const numeric = Number(value)
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) return numeric
    const str = String(value).trim().toLowerCase()
    if (!str || str === 'null') return null

    if (str === 'sem template' || str === 'sem_template' || str === 'no template' || str === 'no_template') return 4

    if (
      str === 'enviado' ||
      str === 'enviada' ||
      str === 'sent' ||
      str === 'success' ||
      str === 'sucesso' ||
      str === 'ok'
    ) {
      return 1
    }

    if (
      str === 'erro' ||
      str === 'error' ||
      str === 'falha' ||
      str === 'failed' ||
      str === 'failure'
    ) {
      return 2
    }

    if (
      str === 'trabalhando' ||
      str === 'processando' ||
      str === 'working' ||
      str === 'enviando' ||
      str === 'em andamento'
    ) {
      return 3
    }

    if (
      str === 'pendente' ||
      str === 'pending' ||
      str === 'aguardando' ||
      str === 'agendado' ||
      str === 'scheduled'
    ) {
      return 0
    }

    if (str.includes('envi')) return 1
    if (str.includes('erro') || str.includes('fail') || str.includes('falha')) return 2
    if (str.includes('trabal') || str.includes('process') || str.includes('andamento') || str.includes('enviando'))
      return 3
    if (str.includes('pend') || str.includes('agend') || str.includes('aguard')) return 0

    return null
  }

  const normalizeTemplate = (value) => {
    if (value === null || value === undefined) return 'Sem template'
    const str = String(value).trim()
    if (!str || str.toLowerCase() === 'null') {
      return 'Sem template'
    }
    return str
  }

  const pickNonEmpty = (...values) => {
    for (const value of values) {
      if (value === null || value === undefined) continue
      const str = String(value).trim()
      if (!str || str.toLowerCase() === 'null') continue
      return value
    }
    return null
  }

  const normalizeTrackingItem = (raw) => {
    const campanha = String(pickNonEmpty(raw?.campanha, raw?.nameBatch, raw?.batchName, raw?.nomeBatch, raw?.campaign) || '').trim()
    const templateRaw = pickNonEmpty(raw?.template, raw?.modelo_nome, raw?.templateName, raw?.nomeTemplate, raw?.template_nome)
    const templateNormalized = normalizeTemplate(templateRaw)

    const statusRaw = pickNonEmpty(raw?.sendStatus, raw?.status, raw?.send_status, raw?.status_envio)
    const statusCode = normalizeStatus(statusRaw)
    const sendStatus = templateNormalized === 'Sem template' ? 4 : statusCode ?? 0

    const phone = pickNonEmpty(raw?.phone_client, raw?.phoneClient, raw?.phone, raw?.telefone, raw?.numero) || ''
    const name = pickNonEmpty(raw?.nomeCliente, raw?.name, raw?.nome, raw?.cliente) || ''
    const scheduledDateTime = pickNonEmpty(raw?.agendamento, raw?.scheduledDateTime, raw?.scheduled_date_time, raw?.dataAgendada, raw?.data_agendada)
    const createdAt = pickNonEmpty(raw?.criado_em, raw?.createdAt, raw?.created_at, raw?.dataCriacao, raw?.data_criacao)

    return {
      ...raw,
      nameBatch: campanha || raw?.nameBatch,
      template: templateRaw ?? raw?.template,
      sendStatus,
      phone: phone ?? raw?.phone,
      name: name ?? raw?.name,
      scheduledDateTime: scheduledDateTime ?? raw?.scheduledDateTime,
      criado_em: createdAt ?? raw?.criado_em
    }
  }

  const buildCampanhasFromItems = (list) => {
    const arr = Array.isArray(list) ? list : []
    const grouped = arr.reduce((acc, item) => {
      const campanha = String(item?.nameBatch || '').trim() || 'Sem nome'
      if (!acc[campanha]) {
        acc[campanha] = {
          nome: campanha,
          total: 0,
          enviados: 0,
          erros: 0,
          pendentes: 0,
          semTemplate: 0,
          items: []
        }
      }

      acc[campanha].total++
      acc[campanha].items.push(item)

      const status = normalizeStatus(item?.sendStatus) ?? 0
      if (status === 1) acc[campanha].enviados++
      else if (status === 2) acc[campanha].erros++
      else if (status === 0 || status === 3) acc[campanha].pendentes++
      else if (status === 4) acc[campanha].semTemplate++

      return acc
    }, {})

    return Object.values(grouped)
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('https://n8n.apivieiracred.store/webhook/tracking')
      if (!resp.ok) {
        const tx = await resp.text()
        throw new Error(`HTTP ${resp.status} - ${tx}`)
      }
      const json = await resp.json()
      const arr = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.body) ? json.body : []
      const normalized = arr.map(normalizeTrackingItem)
      setItems(normalized)
      setCampanhas(buildCampanhasFromItems(normalized))
    } catch (e) {
      // setError('Falha ao carregar acompanhamento. Tente novamente mais tarde.')
      console.error('Erro ao buscar tracking:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const statusBadge = (status) => {
    const s = normalizeStatus(status)
    switch (s) {
      case 1:
        return (
          <span className="badge bg-success d-flex align-items-center gap-1">
            <CheckCircle2 size={12} />
            Enviado
          </span>
        )
      case 2:
        return (
          <span className="badge bg-danger d-flex align-items-center gap-1">
            <XCircle size={12} />
            Erro
          </span>
        )
      case 3:
        return (
          <span className="badge bg-warning d-flex align-items-center gap-1">
            <Clock size={12} />
            Trabalhando
          </span>
        )
      case 0:
        return (
          <span className="badge bg-secondary d-flex align-items-center gap-1">
            <Clock size={12} />
            Pendente
          </span>
        )
      case 4:
        return (
          <span className="badge bg-info d-flex align-items-center gap-1">
            <FileText size={12} />
            Sem template
          </span>
        )
      default:
        return (
          <span className="badge bg-secondary">
            Indefinido
          </span>
        )
    }
  }

  const renderMotivo = (typeError, sendStatus) => {
    if (normalizeStatus(sendStatus) === 4) {
      const handleMouseEnter = (e) => {
        const rect = e.target.getBoundingClientRect()
        setTooltip({
          visible: true,
          content: 'Aguardando Template',
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        })
      }

      const handleMouseLeave = () => {
        setTooltip({ visible: false, content: '', x: 0, y: 0 })
      }

      return (
        <Info
          size={16}
          className="text-info cursor-pointer"
          style={{ cursor: 'pointer' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )
    }

    if (!typeError && normalizeStatus(sendStatus) === 1) {
      const handleMouseEnter = (e) => {
        const rect = e.target.getBoundingClientRect()
        setTooltip({
          visible: true,
          content: 'Enviado com Sucesso',
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        })
      }
      
      const handleMouseLeave = () => {
        setTooltip({ visible: false, content: '', x: 0, y: 0 })
      }
      
      return (
        <Info 
          size={16} 
          className="text-success cursor-pointer"
          style={{ cursor: 'pointer' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )
    }
    
    if (typeError) {
      const handleMouseEnter = (e) => {
        const rect = e.target.getBoundingClientRect()
        setTooltip({
          visible: true,
          content: typeError,
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        })
      }
      
      const handleMouseLeave = () => {
        setTooltip({ visible: false, content: '', x: 0, y: 0 })
      }
      
      return (
        <Info 
          size={16} 
          className="text-danger cursor-pointer"
          style={{ cursor: 'pointer' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )
    }
    
    return '-'
  }

  const openModal = (campanha) => {
    setSelectedCampanha(campanha)
    const sorted = [...campanha.items].sort((a, b) => {
      const dateA = parseDateTimeToDate(a.criado_em || a.scheduledDateTime) || new Date(0)
      const dateB = parseDateTimeToDate(b.criado_em || b.scheduledDateTime) || new Date(0)
      return dateB - dateA
    })
    setModalData(sorted)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedCampanha(null)
    setModalData([])
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    if (!itemToDelete?.id) {
      notify.warn('Não é possível excluir: item sem ID.')
      return
    }
    
    try {
      const resp = await fetch('https://n8n.apivieiracred.store/webhook/tracking-del', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: itemToDelete.id })
      })
      
      if (!resp.ok) throw new Error('Falha ao excluir')
      
      setModalData(prev => prev.filter(item => item.id !== itemToDelete.id))
      setItems(prev => prev.filter(item => item.id !== itemToDelete.id))
      
      const updatedItems = items.filter(item => item.id !== itemToDelete.id)
      setCampanhas(buildCampanhasFromItems(updatedItems))
      setShowDeleteModal(false)
      setItemToDelete(null)
      notify.success('Disparo excluído com sucesso!')
    } catch (e) {
      notify.error('Erro ao excluir disparo')
      console.error(e)
    }
  }

  const handleDeleteCampanha = async () => {
    if (!campanhaToDelete) return
    const itemsWithId = (campanhaToDelete.items || []).filter(item => item?.id)
    if (itemsWithId.length === 0) {
      notify.warn('Não é possível excluir: campanha sem IDs de disparo.')
      return
    }
    
    try {
      const deletePromises = itemsWithId.map(item => 
        fetch('https://n8n.apivieiracred.store/webhook/tracking-del', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id: item.id })
        })
      )
      
      await Promise.all(deletePromises)
      
      setItems(prev => prev.filter(item => item.nameBatch !== campanhaToDelete.nome))
      setCampanhas(prev => prev.filter(c => c.nome !== campanhaToDelete.nome))
      
      setShowDeleteCampanhaModal(false)
      setCampanhaToDelete(null)
      notify.success('Campanha excluída com sucesso!')
    } catch (e) {
      notify.error('Erro ao excluir campanha')
      console.error(e)
    }
  }

  const calcularProgresso = (campanha) => {
    if (campanha.total === 0) return 0
    return Math.round((campanha.enviados / campanha.total) * 100)
  }

  const calcularTotaisGerais = () => {
    return campanhas.reduce((acc, campanha) => {
      acc.total += campanha.total
      acc.enviados += campanha.enviados
      acc.erros += campanha.erros
      acc.pendentes += campanha.pendentes
      acc.semTemplate += campanha.semTemplate
      return acc
    }, {
      total: 0,
      enviados: 0,
      erros: 0,
      pendentes: 0,
      semTemplate: 0
    })
  }

  const totaisGerais = calcularTotaisGerais()

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
              <h2 className="fw-bold mb-1">Acompanhamento de Disparos</h2>
              <div className="opacity-75 small">Monitore o status de todos os seus disparos</div>
            </div>
          </div>
          <button 
            className="btn btn-primary d-flex align-items-center gap-2"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="alert alert-danger mb-4">
            {error}
          </div>
        )}

        {!loading && campanhas.length > 0 && (
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="neo-card p-3">
                <div className="small opacity-75 mb-1">Total de Disparos</div>
                <div className="h3 mb-0 fw-bold">{totaisGerais.total.toLocaleString('pt-BR')}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="neo-card p-3">
                <div className="small opacity-75 mb-1">Enviados</div>
                <div className="h3 mb-0 fw-bold text-success">{totaisGerais.enviados.toLocaleString('pt-BR')}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="neo-card p-3">
                <div className="small opacity-75 mb-1">Erros</div>
                <div className="h3 mb-0 fw-bold text-danger">{totaisGerais.erros.toLocaleString('pt-BR')}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="neo-card p-3">
                <div className="small opacity-75 mb-1">Pendentes</div>
                <div className="h3 mb-0 fw-bold text-warning">{totaisGerais.pendentes.toLocaleString('pt-BR')}</div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="neo-card neo-lg p-5 text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Carregando...</span>
            </div>
            <p className="opacity-75">Carregando campanhas...</p>
          </div>
        ) : campanhas.length === 0 ? (
          <div className="neo-card neo-lg p-5 text-center">
            <Activity size={48} className="mb-3 opacity-50" />
            <p className="opacity-75">Nenhuma campanha encontrada</p>
          </div>
        ) : (
          <div className="row g-3">
            {campanhas.map((campanha, idx) => {
              const progresso = calcularProgresso(campanha)
              
              return (
                <div key={idx} className="col-12">
                  <div 
                    className="neo-card p-4"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openModal(campanha)}
                  >
                    <div className="d-flex align-items-start justify-content-between mb-3">
                      <div className="flex-grow-1">
                        <h5 className="mb-2">{campanha.nome}</h5>
                        <div className="d-flex align-items-center gap-3 small opacity-75">
                          <span>Total de disparos: {campanha.total}</span>
                        </div>
                      </div>
                      <button 
                        className="btn btn-danger btn-sm d-flex align-items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCampanhaToDelete(campanha)
                          setShowDeleteCampanhaModal(true)
                        }}
                        title="Excluir campanha"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Enviados</div>
                        <div className="fw-bold text-success">{campanha.enviados.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Erros</div>
                        <div className="fw-bold text-danger">{campanha.erros.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Pendentes</div>
                        <div className="fw-bold text-warning">{campanha.pendentes.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Sem Template</div>
                        <div className="fw-bold text-info">{campanha.semTemplate.toLocaleString('pt-BR')}</div>
                      </div>
                    </div>

                    <div>
                      <div className="d-flex align-items-center justify-content-between small mb-1">
                        <span className="opacity-75">Progresso</span>
                        <span className="fw-bold">{progresso}%</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar bg-primary" 
                          role="progressbar" 
                          style={{ width: `${progresso}%` }}
                          aria-valuenow={progresso} 
                          aria-valuemin="0" 
                          aria-valuemax="100"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showModal && selectedCampanha && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeModal}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content bg-deep text-light">
                <div className="modal-header border-bottom border-secondary">
                  <h4 className="modal-title fw-bold d-flex align-items-center gap-2">
                    <Activity size={24} />
                    {selectedCampanha.nome}
                  </h4>
                  <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-4">
                    <div className="row g-3">
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Total</div>
                        <div className="h5 mb-0">{selectedCampanha.total.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Enviados</div>
                        <div className="h5 mb-0 text-success">{selectedCampanha.enviados.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Erros</div>
                        <div className="h5 mb-0 text-danger">{selectedCampanha.erros.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="small opacity-75">Pendentes</div>
                        <div className="h5 mb-0 text-warning">{selectedCampanha.pendentes.toLocaleString('pt-BR')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-dark table-hover">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Telefone</th>
                          <th>Template</th>
                          <th>Status</th>
                          <th>Data Agendada</th>
                          <th>Data Criação</th>
                          <th className="text-center">Motivo</th>
                          <th className="text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name || '-'}</td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <Phone size={14} className="opacity-75" />
                                {formatWhatsapp(item.phone)}
                              </div>
                            </td>
                            <td>{normalizeTemplate(item.template)}</td>
                            <td>{statusBadge(item.sendStatus)}</td>
                            <td>{formatDateTimeSP(item.scheduledDateTime)}</td>
                            <td>{formatDateTimeSP(item.criado_em)}</td>
                            <td className="text-center">
                              {renderMotivo(item.typeError, item.sendStatus)}
                            </td>
                            <td className="text-center">
                              <button 
                                className="btn btn-sm btn-danger d-flex align-items-center gap-1 mx-auto"
                                onClick={() => {
                                  setItemToDelete(item)
                                  setShowDeleteModal(true)
                                }}
                                title="Excluir disparo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer border-top border-secondary">
                  <button className="btn btn-secondary" onClick={closeModal}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tooltip.visible && (
          <div
            className="position-fixed bg-dark text-white px-2 py-1 rounded small"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999,
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            {tooltip.content}
          </div>
        )}

        {showDeleteModal && itemToDelete && (
          <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 9999 }} role="dialog" aria-modal="true" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirmar Exclusão</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowDeleteModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">Tem certeza que deseja excluir o disparo para {formatWhatsapp(itemToDelete.phone)}?</div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
                  <button type="button" className="btn btn-danger" onClick={handleDelete}>Excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeleteCampanhaModal && campanhaToDelete && (
          <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 9999 }} role="dialog" aria-modal="true" onClick={() => setShowDeleteCampanhaModal(false)}>
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Confirmar Exclusão</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowDeleteCampanhaModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">Tem certeza que deseja excluir a campanha "{campanhaToDelete.nome}" com todos os seus {campanhaToDelete.total} disparos?</div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteCampanhaModal(false)}>Cancelar</button>
                  <button type="button" className="btn btn-danger" onClick={handleDeleteCampanha}>Excluir</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
      
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
