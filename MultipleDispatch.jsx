import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Form, Button, Alert, Table, Toast, ToastContainer, Modal } from 'react-bootstrap'
import { Upload, MessageSquare, FileText, Send, Download, ArrowLeft, Settings, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { processCsvFile, validateCsvStructure, generateSampleCsv } from '../utils/csvUtils'
import CsvFormatInfo from '../components/CsvFormatInfo'

const DEFAULT_BATCH_SIZE = 100

function MultipleDispatch() {
  const [csvFile, setCsvFile] = useState(null)
  const [csvData, setCsvData] = useState([])
  const [csvError, setCsvError] = useState('')
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [channels, setChannels] = useState([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState([])
  const [channelTemplates, setChannelTemplates] = useState({})
  const [selectedTemplates, setSelectedTemplates] = useState({})
  const [expandedChannels, setExpandedChannels] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    scheduledDateTime: '',
    intervalMin: 15,
    intervalMax: 30
  })
  const [toast, setToast] = useState({ show: false, message: '', bg: 'success' })
  const [channelBatchSizes, setChannelBatchSizes] = useState({})

  const notify = (message, type = 'success') => {
    const bg = type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'danger'
    setToast({ show: true, message, bg })
  }

  // Função para formatar data e hora para São Paulo
  const formatDateTimeForSaoPaulo = (value) => {
    if (!value) return ''
    const d = new Date(value)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d)
    const get = (t) => parts.find(p => p.type === t)?.value || ''
    const y = get('year')
    const m = get('month')
    const day = get('day')
    const hh = get('hour')
    const mm = get('minute')
    return `${y}-${m}-${day} ${hh}:${mm}`
  }

  // Função para buscar canais da API
  const fetchChannels = async () => {
    setLoadingChannels(true)
    try {
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/canais')
      if (response.ok) {
        const data = await response.json()
        setChannels(data)
      } else {
        console.error('Erro ao buscar canais:', response.statusText)
        setChannels(mockChannels)
      }
    } catch (error) {
      console.error('Erro ao conectar com a API:', error)
      setChannels(mockChannels)
    } finally {
      setLoadingChannels(false)
    }
  }

  // Função para buscar templates por canal
  const fetchTemplatesByChannel = async (accountId) => {
    if (!accountId) return []
    
    try {
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ id_account: accountId })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          return data
        } else if (data && Array.isArray(data.data)) {
          return data.data
        } else if (data && data.body && Array.isArray(data.body)) {
          return data.body
        } else {
          return []
        }
      } else {
        return mockTemplates
      }
    } catch (error) {
      console.error('Erro ao buscar templates:', error)
      return mockTemplates
    }
  }

  // Função para selecionar/deselecionar todos os canais
  const toggleSelectAllChannels = (checked) => {
    if (checked) {
      setSelectedChannels([...channels])
      setChannelBatchSizes(prev => {
        const updated = { ...prev }
        channels.forEach(channel => {
          if (updated[channel.record_id] === undefined) {
            updated[channel.record_id] = String(DEFAULT_BATCH_SIZE)
          }
        })
        return updated
      })
    } else {
      setSelectedChannels([])
      setChannelTemplates({})
      setSelectedTemplates({})
      setExpandedChannels(new Set())
      setChannelBatchSizes({})
    }
  }

  // Função para alternar seleção de canal
  const toggleChannelSelection = async (channel) => {
    const channelId = channel.record_id
    const isSelected = selectedChannels.find(c => c.record_id === channelId)
    
    if (isSelected) {
      setSelectedChannels(prev => prev.filter(c => c.record_id !== channelId))
      setChannelTemplates(prev => {
        const newTemplates = { ...prev }
        delete newTemplates[channelId]
        return newTemplates
      })
      setSelectedTemplates(prev => {
        const newSelected = { ...prev }
        delete newSelected[channelId]
        return newSelected
      })
      setExpandedChannels(prev => {
        const newExpanded = new Set(prev)
        newExpanded.delete(channelId)
        return newExpanded
      })
      setChannelBatchSizes(prev => {
        const updated = { ...prev }
        delete updated[channelId]
        return updated
      })
    } else {
      setSelectedChannels(prev => [...prev, channel])
      setChannelBatchSizes(prev => {
        if (prev[channelId] !== undefined) {
          return prev
        }
        return { ...prev, [channelId]: String(DEFAULT_BATCH_SIZE) }
      })
      // Não carregar templates automaticamente - apenas quando expandir
    }
  }

  // Função para alternar expansão de canal
  const toggleChannelExpansion = async (channelId) => {
    const isCurrentlyExpanded = expandedChannels.has(channelId)
    
    setExpandedChannels(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(channelId)) {
        newExpanded.delete(channelId)
      } else {
        newExpanded.add(channelId)
      }
      return newExpanded
    })
    
    // Se está expandindo (não estava expandido antes) e não tem templates carregados
    if (!isCurrentlyExpanded && !channelTemplates[channelId]) {
      const channel = selectedChannels.find(c => c.record_id === channelId)
      if (channel && channel.id_account) {
        console.log('Carregando templates para canal:', channel.account_name, 'ID:', channel.id_account)
        const templates = await fetchTemplatesByChannel(channel.id_account)
        console.log('Templates encontrados:', templates)
        setChannelTemplates(prev => ({
          ...prev,
          [channelId]: templates
        }))
      } else {
        console.log('Canal sem id_account:', channel)
      }
    }
  }

  // Função para selecionar template
  const selectTemplate = (channelId, template) => {
    setSelectedTemplates(prev => ({
      ...prev,
      [channelId]: template
    }))
  }

  // Função para abrir modal
  const openChannelModal = () => {
    setShowChannelModal(true)
    if (channels.length === 0) {
      fetchChannels()
    }
  }

  // Função para fechar modal
  const closeChannelModal = () => {
    setShowChannelModal(false)
  }

  // Função para traduzir status
  const getStatusText = (status) => {
    if (!status) return 'Indefinido'
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  }

  // Função para classe do badge de status (CORRIGIDA)
  const getStatusBadgeClass = (status) => {
    switch(status?.toLowerCase()) {
      case 'connected': return 'status-badge status-connected'
      case 'flagged': return 'status-badge status-flagged'
      default: return 'status-badge status-undefined'
    }
  }

  // Função para traduzir status do template
  const getTemplateStatusText = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved':
        return 'Aprovado'
      case 'pending':
        return 'Pendente'
      case 'rejected':
        return 'Rejeitado'
      case 'disabled':
        return 'Desabilitado'
      default:
        return 'Indefinido'
    }
  }

  // Função para determinar a classe do badge do template
  const getTemplateStatusBadgeClass = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved':
        return 'status-badge status-success'
      case 'pending':
        return 'status-badge status-pending'
      case 'rejected':
        return 'status-badge status-error'
      case 'disabled':
        return 'status-badge status-undefined'
      default:
        return 'status-badge status-undefined'
    }
  }

  // Função para traduzir category do template
  const getTemplateCategoryText = (category) => {
    switch(category?.toLowerCase()) {
      case 'marketing':
        return 'Marketing'
      case 'utility':
        return 'Utilidade'
      case 'authentication':
        return 'Autenticação'
      case 'transactional':
        return 'Transacional'
      case 'promotional':
        return 'Promocional'
      case 'informational':
        return 'Informativo'
      default:
        return category || 'Indefinido'
    }
  }

  // Função para determinar a classe do badge de categoria
  const getTemplateCategoryBadgeClass = (category) => {
    switch(category?.toLowerCase()) {
      case 'marketing':
      case 'promotional':
        return 'status-badge status-pending' // Laranja para marketing
      case 'utility':
      case 'transactional':
        return 'status-badge status-success' // Verde para utilitário
      case 'authentication':
        return 'status-badge status-error' // Vermelho para autenticação
      case 'informational':
        return 'status-badge status-connected' // Verde claro para informativo
      default:
        return 'status-badge status-undefined' // Cinza para indefinido
    }
  }

  // Função para traduzir quality rating
  const getQualityText = (rating) => {
    switch(rating?.toLowerCase()) {
      case 'green': return 'High'
      case 'yellow':
      case 'orange': return 'Medium'
      case 'red': return 'Low'
      default: return 'Medium'
    }
  }

  // Função para cor do quality rating
  const getQualityColor = (rating) => {
    switch(rating?.toLowerCase()) {
      case 'green': return '#28a745'
      case 'yellow':
      case 'orange': return '#ffc107'
      case 'red': return '#dc3545'
      default: return '#ffc107'
    }
  }

  // Dados mockados
  const mockChannels = [
    { 
      record_id: 1, 
      account_name: 'Consai Atendimentos', 
      display_phone_number: '+55 11 95174-8813',
      status: 'Connected',
      quality_rating: 'green',
      id_account: 'consai123'
    },
    { 
      record_id: 2, 
      account_name: 'Marketing Digital', 
      display_phone_number: '+55 11 94832-7651',
      status: 'Connected', 
      quality_rating: 'yellow',
      id_account: 'marketing456'
    },
    { 
      record_id: 3, 
      account_name: 'Suporte Técnico', 
      display_phone_number: '+55 11 93721-9504',
      status: 'Flagged',
      quality_rating: 'red',
      id_account: 'suporte789'
    }
  ]

  const mockTemplates = [
    { record_id: 1, name: 'Template Marketing', category: 'Marketing', status: 'approved' },
    { record_id: 2, name: 'Template Suporte', category: 'Utility', status: 'approved' }
  ]

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setCsvError('')
    setCsvData([])
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Por favor, selecione um arquivo CSV válido')
      return
    }
    
    setCsvFile(file)
    
    try {
      await validateCsvStructure(file)
      const result = await processCsvFile(file)
      setCsvData(result.data)
    } catch (error) {
      setCsvError(error.message)
      setCsvFile(null)
      setCsvData([])
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const handleChannelBatchSizeChange = (channelId, rawValue) => {
    const digitsOnly = rawValue.replace(/[^0-9]/g, '')
    if (!digitsOnly) {
      setChannelBatchSizes(prev => ({ ...prev, [channelId]: '' }))
      return
    }

    const numeric = Math.min(Math.max(parseInt(digitsOnly, 10), 1), 1000)
    setChannelBatchSizes(prev => ({ ...prev, [channelId]: String(numeric) }))
  }

  const handleChannelBatchSizeBlur = (channelId) => {
    setChannelBatchSizes(prev => {
      const current = prev[channelId]
      if (current === undefined || current === '') {
        return { ...prev, [channelId]: String(DEFAULT_BATCH_SIZE) }
      }
      return prev
    })
  }

  const getChannelBatchSize = (channelId) => {
    const raw = channelBatchSizes[channelId]
    const parsed = parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE
  }

  // Função para testar a API
  const testAPI = async () => {
    console.log('=== TESTANDO API DE MÚTIPLOS DISPAROS ===')
    try {
      const testData = new FormData()
      testData.append('test', 'true')
      testData.append('message', 'Teste de conexão')
      
      console.log('Fazendo POST para:', 'https://webhook.sistemavieira.com.br/webhook/multi-disparos')
      
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/multi-disparos', {
        method: 'POST',
        body: testData
      })
      
      console.log('Resposta:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
      
      const responseText = await response.text()
      console.log('Corpo da resposta:', responseText)
      
    } catch (error) {
      console.error('Erro no teste:', error)
    }
    console.log('=== FIM DO TESTE ===')
  }

  // Função para enviar disparo para API
  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('=== INICIANDO ENVIO DE MÚLTIPLOS DISPAROS EM ARRAY ===')
    setLoading(true)
    
    try {
      console.log('1. Preparando dados dos canais...')
      
      // Validar se todos os canais têm template selecionado
      const channelsWithoutTemplate = selectedChannels.filter(channel => 
        !selectedTemplates[channel.record_id]
      )
      if (channelsWithoutTemplate.length > 0) {
        console.log('2. ERRO: Canais sem template:', channelsWithoutTemplate)
        notify(`Selecione templates para todos os canais. ${channelsWithoutTemplate.length} canal(is) sem template.`, 'error')
        setLoading(false)
        return
      }
      
      console.log('2. Preparando CSV reutilizável...')
      // Recodificar CSV em UTF-8 para preservar acentuação (uma vez só)
      let csvFileToSend = csvFile
      try {
        if (csvData && csvData.length > 0) {
          const escape = (str) => String(str || '').replace(/"/g, '""')
          const header = 'name;phone;email'
          const rows = [header].concat(
            csvData.map(c => `${escape(c.name)};${escape(c.phone)};${escape(c.email ?? '')}`)
          )
          const BOM = '\uFEFF'
          const content = BOM + rows.join('\n')
          const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
          csvFileToSend = new File([blob], (csvFile?.name ? csvFile.name.replace(/\.csv$/i, '') : 'contatos') + '-utf8.csv', { type: 'text/csv' })
        }
      } catch (e) {
        console.warn('Falha ao reencodar CSV no cliente, usando arquivo original.', e)
      }
      
      console.log('3. Preparando array de canais...')
      
      // MONTAR ARRAY DE CANAIS
      const channels = selectedChannels.map(channel => {
        const template = selectedTemplates[channel.record_id]
        const batchSize = getChannelBatchSize(channel.record_id)
        
        return {
          channel: `${channel.account_name} - ${channel.display_phone_number}`,
          phone_id: channel.phone_id || channel.record_id,
          display_phone_number: channel.display_phone_number,
          template: template.name,
          batchSize
        }
      })
      
      console.log('4. Array de canais preparado:', channels)
      
      // ENVIAR TUDO EM UM ÚNICO POST
      const formData_upload = new FormData()
      formData_upload.append('name', formData.name)
      formData_upload.append('channels', JSON.stringify(channels))
      formData_upload.append('scheduledDateTime', formatDateTimeForSaoPaulo(formData.scheduledDateTime))
      formData_upload.append('intMin', String(formData.intervalMin))
      formData_upload.append('intMax', String(formData.intervalMax))
      formData_upload.append('mode', 'csv')
      formData_upload.append('contactCount', String(csvData.length))
      formData_upload.append('csvFile', csvFileToSend)
      
      console.log('5. FormData sendo enviado:')
      console.log('   - name:', formData.name)
      console.log('   - channels:', JSON.stringify(channels, null, 2))
      console.log('   - scheduledDateTime:', formatDateTimeForSaoPaulo(formData.scheduledDateTime))
      console.log('   - intervalos:', formData.intervalMin, 'a', formData.intervalMax)
      console.log('   - contactCount:', csvData.length)
      
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/multi-disparos', {
        method: 'POST',
        body: formData_upload
      })
      
      console.log('6. Resposta da API:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
      
      if (response.ok) {
        console.log('7. Status 200 - Processando resposta de sucesso...')
        let result
        try {
          const responseText = await response.text()
          console.log('8. Texto da resposta:', responseText)
          
          // Tentar fazer parse do JSON apenas se a resposta não estiver vazia
          if (responseText.trim()) {
            result = JSON.parse(responseText)
            console.log('9. SUCCESS - Resposta da API (JSON):', result)
          } else {
            result = { success: true, message: 'Sucesso' }
            console.log('9. SUCCESS - Resposta vazia, assumindo sucesso')
          }
        } catch (parseError) {
          console.log('9. SUCCESS - Resposta não é JSON válido, mas status é 200:', parseError.message)
          result = { success: true, message: 'Sucesso' }
        }
        
        console.log('10. Definindo estados de sucesso...')
        setLoading(false)
        setShowSuccess(true)
        
        console.log('11. Exibindo toast de sucesso...')
        notify(`Múltiplos disparos criados com sucesso! ${channels.length} canal(is) processado(s).`, 'success')
        
        console.log('12. Resetando formulário...')
        // Reset form após sucesso
        setFormData({
          name: '',
          scheduledDateTime: '',
          intervalMin: 15,
          intervalMax: 30
        })
        setCsvFile(null)
        setCsvData([])
        setSelectedChannels([])
        setSelectedTemplates({})
        setChannelBatchSizes({})
        setShowChannelModal(false)
        
        console.log('13. Agendando refresh da página...')
        // Refresh da página após sucesso (mais confiável)
        setTimeout(() => {
          console.log('14. Executando refresh da página...')
          window.location.href = window.location.href // Força refresh completo
        }, 2000) // Reduzido para 2 segundos
        
        console.log('15. SUCESSO COMPLETO - FIM DO PROCESSAMENTO')
        return // IMPORTANTE: return aqui para não executar o else
        
      } else {
        console.log('16. Status não é 200 - Processando erro...')
        const errorText = await response.text()
        console.error('17. ERROR - Falha na API:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        })
        setLoading(false)
        notify('Erro ao enviar múltiplos disparos. Verifique os logs.', 'error')
      }
      
    } catch (error) {
      console.error('18. EXCEPTION GERAL:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      setLoading(false)
      
      // Verificar se o erro é de rede ou de processamento
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        notify('Erro de conexão com a API. Verifique sua internet e tente novamente.', 'error')
      } else {
        notify('Erro inesperado durante o envio. Verifique os logs do console.', 'error')
      }
    } finally {
      console.log('19. FINALLY - Finalizando processo...')
      // Não fazer nada aqui que possa interferir com o sucesso
      console.log('=== FIM DO PROCESSO DE ENVIO ===')
    }
  }

  const isFormValid = () => {
    const baseValid = formData.name && 
           formData.scheduledDateTime &&
           selectedChannels.length > 0 &&
           csvData.length > 0
           
    // Verificar se todos os canais selecionados têm templates
    const hasAllTemplates = selectedChannels.every(channel => 
      selectedTemplates[channel.record_id]
    )
    
    return baseValid && hasAllTemplates
  }

  useEffect(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 10)
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const defaultDateTime = `${year}-${month}-${day}T${hours}:${minutes}`
    
    setFormData(prev => ({
      ...prev,
      scheduledDateTime: defaultDateTime
    }))
  }, [])

  return (
    <div className="dispatch-page">
      <Container fluid className="py-4">
        <ToastContainer position="top-end" className="p-3" style={{ zIndex: 2000 }}>
          <Toast bg={toast.bg} onClose={() => setToast(prev => ({ ...prev, show: false }))} show={toast.show} delay={3000} autohide>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
        
        <Row className="mb-4">
          <Col>
            <div className="d-flex align-items-center mb-3">
              <Button 
                as={Link} 
                to="/dashboard" 
                variant="outline-secondary" 
                size="sm" 
                className="me-3"
              >
                <ArrowLeft size={16} className="me-1" />
                Voltar
              </Button>
              <div>
                <h1 className="h3 fw-bold mb-1">Multiplos Disparos</h1>
                <p className="text-muted mb-0">Configure e agende múltiplos disparos em massa</p>
              </div>
            </div>
          </Col>
        </Row>

        {showSuccess && (
          <Alert variant="success" className="mb-4">
            <MessageSquare size={20} className="me-2" />
            Múltiplos disparos criados com sucesso! Eles serão executados na data e hora agendadas.
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Row>
            <Col lg={8}>
              <Card className="mb-4">
                <Card.Header>
                  <h5 className="fw-bold mb-0">
                    <FileText size={20} className="me-2" />
                    Configuração do Disparo
                  </h5>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6} className="mb-3">
                      <Form.Group>
                        <Form.Label>Nome da Campanha</Form.Label>
                        <Form.Control
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Ex: Promoção Black Friday"
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                      <Form.Group>
                        <Form.Label>Canais e Templates</Form.Label>
                        <Button 
                          variant="outline-primary" 
                          className="w-100 d-flex align-items-center justify-content-between"
                          style={{ cursor: 'pointer' }}
                          onClick={openChannelModal}
                        >
                          <div>
                            {selectedChannels.length === 0 ? (
                              'Selecionar Canais e Templates'
                            ) : (
                              `${selectedChannels.length} canal(is) e ${Object.keys(selectedTemplates).length} template(s) selecionado(s)`
                            )}
                          </div>
                          <Settings size={18} />
                        </Button>
                      </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                      <Form.Group>
                        <Form.Label>Data e Hora do Envio</Form.Label>
                        <Form.Control
                          type="datetime-local"
                          name="scheduledDateTime"
                          value={formData.scheduledDateTime}
                          onChange={handleInputChange}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                      <Form.Group>
                        <Form.Label>Intervalo de Disparos (aleatório)</Form.Label>
                        <div className="range-slider-container">
                          <input
                            type="range"
                            min="1"
                            max="60"
                            value={formData.intervalMin}
                            onChange={(e) => {
                              const newMin = parseInt(e.target.value)
                              setFormData(prev => ({
                                ...prev,
                                intervalMin: newMin,
                                intervalMax: Math.max(newMin, prev.intervalMax)
                              }))
                            }}
                            className="range-slider range-min"
                            id="range-min"
                          />
                          <input
                            type="range"
                            min="1"
                            max="60"
                            value={formData.intervalMax}
                            onChange={(e) => {
                              const newMax = parseInt(e.target.value)
                              setFormData(prev => ({
                                ...prev,
                                intervalMax: newMax,
                                intervalMin: Math.min(prev.intervalMin, newMax)
                              }))
                            }}
                            className="range-slider range-max"
                            id="range-max"
                          />
                          <div 
                            className="range-fill"
                            style={{
                              position: 'absolute',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              left: `${((formData.intervalMin - 1) / 59) * 100}%`,
                              width: `${((formData.intervalMax - formData.intervalMin) / 59) * 100}%`,
                              height: '6px',
                              background: '#007bff',
                              borderRadius: '3px',
                              zIndex: 2
                            }}
                          />
                          <div className="range-values">
                            <span className="range-value-min">{formData.intervalMin}s</span>
                            <span className="range-value-max">{formData.intervalMax}s</span>
                          </div>
                        </div>
                        <Form.Text className="text-muted">
                          Faixa de tempo para enviar para o próximo contato (aleatório)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="mb-4">
                <Card.Header>
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="fw-bold mb-0">
                      <Upload size={20} className="me-2" />
                      Upload de Contatos (CSV)
                    </h5>
                    <Button 
                      variant="outline-info" 
                      size="sm" 
                      onClick={generateSampleCsv}
                      className="d-flex align-items-center"
                    >
                      <Download size={16} className="me-1" />
                      Baixar Exemplo
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  <CsvFormatInfo />

                  <Row>
                    <Col md={8} className="mb-3">
                      <Form.Group>
                        <Form.Label>Arquivo CSV</Form.Label>
                        <Form.Control
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4} className="mb-3">
                      <div className="p-3 border rounded bg-light">
                        <strong>Quantidade por disparo</strong>
                        <p className="text-muted mb-0 small">
                          Configure um valor por canal no resumo ao lado.
                        </p>
                      </div>

                    </Col>
                  </Row>

                  {csvError && (
                    <Alert variant="danger" className="mb-3">
                      {csvError}
                    </Alert>
                  )}

                  {csvData.length > 0 && (
                    <>
                      {/* Aviso para arquivos muito grandes */}
                      {csvData.length > 10000 && (
                        <Alert variant="warning" className="mb-3">
                          ⚠️ <strong>Arquivo muito grande!</strong><br />
                          Seu arquivo contém <strong>{csvData.length.toLocaleString('pt-BR')} contatos</strong>. 
                          Não é aconselhado usar arquivos tão grandes, pois o processamento pode levar 
                          <strong>mais tempo do que esperado</strong>. Considere dividir em arquivos menores.
                        </Alert>
                      )}
                      
                      <Alert variant="success">
                        <strong>Processamento concluido!</strong>
                        <div className="mt-2 small">
                          <div>{csvData.length} contatos validos carregados</div>
                          {selectedChannels.length > 0 ? (
                            <div className="mt-2 p-2 bg-info bg-opacity-10 rounded">
                              <strong>Quantidades por canal:</strong>
                              <ul className="mb-0 ps-3">
                                {selectedChannels.map(channel => {
                                  const channelId = channel.record_id
                                  const configuredQuantity = getChannelBatchSize(channelId)
                                  const availableContacts = csvData.length
                                  const displayQuantity = configuredQuantity > availableContacts && availableContacts > 0
                                    ? `${availableContacts} contato(s) (limitado ao arquivo)`
                                    : `${configuredQuantity} contato(s)`
                                  return (
                                    <li key={channelId}>
                                      {channel.account_name}: {displayQuantity}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          ) : (
                            <div className="mt-2 p-2 bg-info bg-opacity-10 rounded">
                              <strong>Selecione canais para configurar as quantidades.</strong>
                            </div>
                          )}
                        </div>
                      </Alert>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="sticky-top">
                <Card.Header>
                  <h5 className="fw-bold mb-0">
                    <MessageSquare size={20} className="me-2" />
                    Resumo do Disparo
                  </h5>
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <strong>Campanha:</strong>
                    <p className="text-muted mb-0">
                      {formData.name || 'Não informado'}
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    {selectedChannels.length > 0 ? (
                      <div>
                        <strong>Canais Selecionados ({selectedChannels.length}):</strong>
                        <div className="mt-2 d-flex flex-column gap-2">
                          {selectedChannels.map(channel => {
                            const channelId = channel.record_id
                            const template = selectedTemplates[channelId]
                            const currentValue = channelBatchSizes[channelId]
                            const configuredQuantity = getChannelBatchSize(channelId)
                            const availableContacts = csvData.length
                            const clampedQuantity = availableContacts > 0 ? Math.min(configuredQuantity, availableContacts) : configuredQuantity
                            const clampNote = availableContacts > 0 && configuredQuantity > availableContacts ? ' (limitado ao arquivo)' : ''

                            return (
                              <div key={channelId} className="p-2 border rounded bg-light small">
                                <strong>{channel.account_name}</strong><br />
                                <small>{channel.display_phone_number}</small>
                                {template && (
                                  <div className="mt-1">
                                    Template: {template.name}
                                  </div>
                                )}
                                <Form.Group className="mt-2">
                                  <Form.Label className="mb-1 small fw-semibold">Quantidade por disparo</Form.Label>
                                  <Form.Control
                                    size="sm"
                                    type="number"
                                    min="1"
                                    max="1000"
                                    placeholder={String(DEFAULT_BATCH_SIZE)}
                                    value={currentValue ?? String(DEFAULT_BATCH_SIZE)}
                                    onChange={(e) => handleChannelBatchSizeChange(channelId, e.target.value)}
                                    onBlur={() => handleChannelBatchSizeBlur(channelId)}
                                  />
                                </Form.Group>
                                <small className="text-muted d-block mt-1">
                                  Previsto disparar ate {clampedQuantity} contato(s){clampNote}
                                </small>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 border rounded bg-light">
                        <strong>Canais e Templates:</strong>
                        <p className="text-muted mb-0 mt-1">
                          Nenhum canal selecionado
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <strong>Contatos:</strong>
                    <p className="text-muted mb-0">
                      {csvData.length > 0 ? (
                        <>
                          {csvData.length} contatos<br />
                          <small>Confira as quantidades configuradas por canal no resumo ao lado.</small>
                        </>
                      ) : 'Nenhum arquivo carregado'}
                    </p>
                  </div>

                  <div className="mb-4">
                    <strong>Intervalo:</strong>
                    <p className="text-muted mb-0">
                      {formData.intervalMin}s - {formData.intervalMax}s (aleatório)<br />
                      <small>Tempo de espera entre envios</small>
                    </p>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-100"
                    disabled={!isFormValid() || loading}
                  >
                    {loading ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-2" role="status">
                          <span className="visually-hidden">Carregando...</span>
                        </div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send size={16} className="me-2" />
                        Agendar Múltiplos Disparos
                      </>
                    )}
                  </Button>

                  {!isFormValid() && (
                    <div className="mt-3">
                      <small className="text-muted">
                        {!formData.name && 'Preencha o nome da campanha. '}
                        {!formData.scheduledDateTime && 'Defina data e hora do envio. '}
                        {selectedChannels.length === 0 && 'Selecione pelo menos um canal. '}
                        {selectedChannels.length > 0 && !selectedChannels.every(ch => selectedTemplates[ch.record_id]) && 'Selecione templates para todos os canais. '}
                        {csvData.length === 0 && 'Carregue o arquivo CSV. '}
                      </small>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
        
        {/* Modal de Seleção de Canais e Templates */}
        <Modal 
          show={showChannelModal} 
          onHide={closeChannelModal}
          size="xl"
          centered
        >
          <Modal.Header closeButton className="bg-light">
            <Modal.Title className="h4 fw-bold">
              <Settings size={24} className="me-2" />Selecionar Canais e Templates
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4" style={{ minHeight: '60vh', maxHeight: '75vh', overflowY: 'auto' }}>
            <div className="mb-4">
              <h6 className="text-muted mb-3">Selecione os canais desejados para seus disparos múltiplos</h6>
              
              {loadingChannels ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                  </div>
                  <p className="mt-3 text-muted">Carregando canais da API...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th width="60" className="text-center">
                          <div className="d-flex flex-column align-items-center">
                            <Form.Check 
                              type="checkbox" 
                              onChange={(e) => toggleSelectAllChannels(e.target.checked)}
                              checked={selectedChannels.length === channels.length && channels.length > 0}
                              style={{ cursor: 'pointer' }}
                              title={
                                selectedChannels.length === 0 ? "Selecionar todos" :
                                selectedChannels.length === channels.length ? "Deselecionar todos" :
                                "Alguns selecionados - clique para selecionar todos"
                              }
                            />
                            {selectedChannels.length > 0 && (
                              <small className="text-muted mt-1">
                                {selectedChannels.length}/{channels.length}
                              </small>
                            )}
                          </div>
                        </th>
                        <th className="fw-bold">Nome Canal</th>
                        <th className="fw-bold">Número</th>
                        <th className="fw-bold text-center">Status</th>
                        <th className="fw-bold text-center">Quality Rating</th>
                        <th width="80" className="text-center">Templates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((channel) => {
                        const isSelected = selectedChannels.find(c => c.record_id === channel.record_id)
                        const isExpanded = expandedChannels.has(channel.record_id)
                        const templates = channelTemplates[channel.record_id] || []
                        
                        return (
                          <React.Fragment key={channel.record_id}>
                            <tr className={isSelected ? 'table-primary bg-opacity-10' : ''} style={{ cursor: 'pointer' }}>
                              <td className="text-center">
                                <Form.Check 
                                  type="checkbox" 
                                  checked={!!isSelected} 
                                  onChange={() => toggleChannelSelection(channel)} 
                                  style={{ cursor: 'pointer' }} 
                                />
                              </td>
                              <td onClick={() => toggleChannelSelection(channel)} className="fw-medium">
                                {channel.account_name || channel.name}
                              </td>
                              <td onClick={() => toggleChannelSelection(channel)} className="font-monospace">
                                {channel.display_phone_number || channel.phone}
                              </td>
                              <td className="text-center">
                                <span className={getStatusBadgeClass(channel.status)}>
                                  {getStatusText(channel.status)}
                                </span>
                              </td>
                              <td className="text-center">
                                <div className="d-flex align-items-center justify-content-center">
                                  <div 
                                    className="me-2" 
                                    style={{
                                      width: '12px', 
                                      height: '12px', 
                                      borderRadius: '50%',
                                      backgroundColor: getQualityColor(channel.quality_rating),
                                      border: '2px solid rgba(0,0,0,0.1)', 
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} 
                                  />
                                  <small className="text-muted fw-medium">
                                    {getQualityText(channel.quality_rating)}
                                  </small>
                                </div>
                              </td>
                              <td className="text-center">
                                {isSelected && (
                                  <Button 
                                    variant={isExpanded ? "info" : "outline-info"}
                                    size="sm" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      toggleChannelExpansion(channel.record_id); 
                                    }}
                                    title={isExpanded ? "Ocultar templates" : "Ver templates"}
                                  >
                                    {isExpanded ? <ChevronDown size={14} /> : <Plus size={14} />}
                                  </Button>
                                )}
                              </td>
                            </tr>
                            
                            {/* Linha expandida com templates */}
                            {isSelected && isExpanded && (
                              <tr>
                                <td colSpan="6" className="p-0">
                                  <div className="bg-light p-3">
                                    <h6 className="mb-3">Templates disponíveis para {channel.account_name}:</h6>
                                    {templates.length === 0 ? (
                                      <p className="text-muted mb-0">Nenhum template encontrado para este canal.</p>
                                    ) : (
                                      <div className="row">
                                        {templates.map((template) => (
                                          <div key={template.record_id} className="col-12 mb-2">
                                            <div className="form-check">
                                              <input 
                                                className="form-check-input" 
                                                type="radio" 
                                                name={`template_${channel.record_id}`} 
                                                id={`template_${channel.record_id}_${template.record_id}`} 
                                                checked={selectedTemplates[channel.record_id]?.record_id === template.record_id} 
                                                onChange={() => selectTemplate(channel.record_id, template)} 
                                                style={{ cursor: 'pointer' }} 
                                              />
                                              <label 
                                                className="form-check-label d-flex align-items-center justify-content-between w-100" 
                                                htmlFor={`template_${channel.record_id}_${template.record_id}`} 
                                                style={{ cursor: 'pointer' }}
                                              >
                                                <div>
                                                  <strong>{template.name}</strong>
                                                  <div className="small text-muted mt-1">
                                                    <span className={getTemplateStatusBadgeClass(template.status)}>
                                                      {getTemplateStatusText(template.status)}
                                                    </span>
                                                    <span className={`${getTemplateCategoryBadgeClass(template.category)} ms-2`}>
                                                      {getTemplateCategoryText(template.category)}
                                                    </span>
                                                  </div>
                                                </div>
                                              </label>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </Table>
                  
                  {channels.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-muted">Nenhum canal encontrado na API.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer className="bg-light d-flex justify-content-between align-items-center">
            <div className="text-muted small">
              {selectedChannels.length > 0 ? (
                `${selectedChannels.length} de ${channels.length} canais selecionados`
              ) : (
                'Nenhum canal selecionado'
              )}
            </div>
            <div>
              <Button 
                variant="outline-secondary" 
                onClick={closeChannelModal}
                className="me-2"
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                onClick={closeChannelModal}
                disabled={selectedChannels.length === 0}
              >
                Concluir Seleção ({selectedChannels.length})
              </Button>
            </div>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  )
}

export default MultipleDispatch