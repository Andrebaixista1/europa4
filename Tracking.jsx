import React, { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Table, Button, Badge, Spinner, Alert, Form, InputGroup, Pagination } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Clock, CheckCircle2, XCircle, Activity, Phone, Info, Search, Filter, Download, FileText } from 'lucide-react'

function Tracking() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 })
  
  // Estados da paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [paginatedItems, setPaginatedItems] = useState([])
  
  // Estados dos filtros
  const [filters, setFilters] = useState({
    campanha: '',
    status: '',
    dataAgendada: '', // datetime-local format
    dataCriacao: '',  // datetime-local format
    template: '',
    busca: ''
  })

  const toDigits = (v) => String(v ?? '').replace(/\D/g, '')
  const formatWhatsapp = (phone) => {
    const digits = toDigits(phone)
    if (!digits) return ''
    let rest = digits
    if (rest.startsWith('55')) rest = rest.slice(2)
    if (rest.length < 10) return `+55 ${digits}` // fallback
    const ddd = rest.slice(0, 2)
    const num = rest.slice(2)
    if (num.length === 9) return `+55 (${ddd}) ${num.slice(0,5)}-${num.slice(5)}`
    if (num.length === 8) return `+55 (${ddd}) ${num.slice(0,4)}-${num.slice(4)}`
    // Outros comprimentos, tenta 5-4 por padrão
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
    const date = parseDateTimeToDate(value)
    if (!date) return '-'
    const pad = (number) => String(number).padStart(2, '0')
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const TEMPLATE_EMPTY_LABEL = 'Sem template'

  const normalizeStatus = (value) => {
    if (value === null || value === undefined) return 4
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase()
      if (!trimmed || trimmed === 'null' || trimmed === 'sem template') {
        return 4
      }
    }
    const numeric = Number(value)
    return Number.isNaN(numeric) ? value : numeric
  }

  const normalizeTemplate = (value) => {
    if (value === null || value === undefined) return TEMPLATE_EMPTY_LABEL
    const str = String(value).trim()
    if (!str || str.toLowerCase() === 'null') {
      return TEMPLATE_EMPTY_LABEL
    }
    return str
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('https://webhook.sistemavieira.com.br/webhook/tracking')
      if (!resp.ok) {
        const tx = await resp.text()
        throw new Error(`HTTP ${resp.status} - ${tx}`)
      }
      const json = await resp.json()
      const arr = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.body) ? json.body : []
      setItems(arr)
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
          <span className="status-badge status-success">
            <CheckCircle2 size={12} className="me-1"/> 
            Enviado
          </span>
        )
      case 2:
        return (
          <span className="status-badge status-error">
            <XCircle size={12} className="me-1"/> 
            Erro
          </span>
        )
      case 3:
        return (
          <span className="status-badge status-working">
            <Clock size={12} className="me-1"/> 
            Trabalhando dados
          </span>
        )
      case 0:
        return (
          <span className="status-badge status-pending">
            <Clock size={12} className="me-1"/> 
            Pendente
          </span>
        )
      case 4:
        return (
          <span className="status-badge status-awaiting-template">
            <FileText size={12} className="me-1"/> 
            Sem template
          </span>
        )
      default:
        return (
          <span className="status-badge status-undefined">
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
          className="text-template cursor-pointer motivo-icon-simple"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )
    }
    // Se não há erro e foi enviado com sucesso
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
          className="text-success cursor-pointer motivo-icon-simple" 
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )
    }
    
    // Se há erro, mostra o erro
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
          className="text-danger cursor-pointer motivo-icon-simple" 
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )
    }
    
    // Casos onde não há informação
    return '-'
  }

  // Função para obter opções únicas dos filtros (apenas para campos que ainda usam select)
  const getUniqueOptions = (field) => {
    const values = items.map(item => {
      switch(field) {
        case 'campanha': return item.nameBatch
        case 'status': {
          const normalized = normalizeStatus(item.sendStatus)
          return normalized === undefined ? '' : String(normalized)
        }
        case 'template': return normalizeTemplate(item.template)
        default: return ''
      }
    })

    if (field === 'status') {
      return [...new Set(values.filter(v => v !== ''))].sort((a, b) => Number(a) - Number(b))
    }

    if (field === 'template') {
      return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
    }

    return [...new Set(values.filter(Boolean))].sort()
  }

  // Função para converter datetime-local para Date
  const parseLocalDateTime = (datetimeLocal) => {
    return parseDateTimeToDate(datetimeLocal)
  }

  // Função para obter Date do timestamp da API
  const getDateFromTimestamp = (timestamp) => {
    return parseDateTimeToDate(timestamp)
  }

  // Função para filtrar os itens
  const applyFilters = () => {
    let filtered = [...items]
    
    // Filtro por campanha
    if (filters.campanha) {
      filtered = filtered.filter(item => item.nameBatch === filters.campanha)
    }
    
    // Filtro por status
    if (filters.status) {
      filtered = filtered.filter(item => String(normalizeStatus(item.sendStatus)) === filters.status)
    }
    
    // Filtro por data agendada (>= data digitada)
    if (filters.dataAgendada) {
      const filterDate = parseLocalDateTime(filters.dataAgendada)
      if (filterDate) {
        filtered = filtered.filter(item => {
          const itemDate = getDateFromTimestamp(item.scheduledDateTime)
          return itemDate && itemDate >= filterDate
        })
      }
    }
    
    // Filtro por data criação (>= data digitada)
    if (filters.dataCriacao) {
      const filterDate = parseLocalDateTime(filters.dataCriacao)
      if (filterDate) {
        filtered = filtered.filter(item => {
          const itemDate = getDateFromTimestamp(item.criado_em)
          return itemDate && itemDate >= filterDate
        })
      }
    }
    
    // Filtro por template
    if (filters.template) {
      filtered = filtered.filter(item => normalizeTemplate(item.template) === filters.template)
    }
    
    // Filtro por busca (cliente, whatsapp, telefone disparado)
    if (filters.busca) {
      const searchTerm = filters.busca.toLowerCase()
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(searchTerm) ||
        formatWhatsapp(item.phone)?.toLowerCase().includes(searchTerm) ||
        formatWhatsapp(item.display_phone_number)?.toLowerCase().includes(searchTerm)
      )
    }
    
    setFilteredItems(filtered)
  }

  // Aplicar filtros sempre que items ou filters mudarem
  useEffect(() => {
    applyFilters()
  }, [items, filters])

  // Função para limpar filtros
  const clearFilters = () => {
    setFilters({
      campanha: '',
      status: '',
      dataAgendada: '',
      dataCriacao: '',
      template: '',
      busca: ''
    })
  }

  // Função para atualizar filtros
  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Função para obter texto do status
  const getStatusText = (status) => {
    const s = normalizeStatus(status)
    switch (s) {
      case 1: return 'Enviado'
      case 2: return 'Erro'
      case 3: return 'Trabalhando dados'
      case 4: return 'Sem template'
      case 0: return 'Pendente'
      default: return 'Indefinido'
    }
  }

  // Funções de paginação
  const applyPagination = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginated = filteredItems.slice(startIndex, endIndex)
    setPaginatedItems(paginated)
  }

  // Aplicar paginação sempre que filteredItems, currentPage ou itemsPerPage mudarem
  useEffect(() => {
    applyPagination()
  }, [filteredItems, currentPage, itemsPerPage])

  // Resetar para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // Calcular total de páginas
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)

  // Função para mudar página
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
  }

  // Função para mudar quantidade de itens por página
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // Função para obter range de páginas a mostrar
  const getPaginationRange = () => {
    const delta = 2 // Número de páginas antes e depois da atual
    const range = []
    const rangeWithDots = []
    let l

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  // Função para gerar e baixar CSV
  const downloadCSV = () => {
    // Cabeçalhos da tabela
    const headers = [
      'ID',
      'Cliente',
      'WhatsApp',
      'Campanha Enviada',
      'Telefone Disparado',
      'Data e Hora Agendado',
      'Criação',
      'Status',
      'Motivo',
      'Template Enviado'
    ]

    // Converter dados filtrados para CSV
    const csvData = filteredItems.map(item => {
      const motivo = item.typeError || (normalizeStatus(item.sendStatus) === 1 ? 'Enviado com Sucesso' : '')
      
      return [
        item.id || '',
        item.name || '',
        formatWhatsapp(item.phone) || '',
        item.nameBatch || '',
        formatWhatsapp(item.display_phone_number) || '',
        formatDateTimeSP(item.scheduledDateTime) || '',
        formatDateTimeSP(item.criado_em) || '',
        getStatusText(item.sendStatus),
        motivo,
        normalizeTemplate(item.template)
      ]
    })

    // Combinar cabeçalhos e dados
    const allData = [headers, ...csvData]

    // Converter para string CSV com separador ;
    const csvContent = allData.map(row => 
      row.map(field => {
        // Escapar aspas duplas e envolver campos que contêm ; ou quebras de linha
        const fieldStr = String(field).replace(/"/g, '""')
        return fieldStr.includes(';') || fieldStr.includes('\n') || fieldStr.includes('"') 
          ? `"${fieldStr}"` 
          : fieldStr
      }).join(';')
    ).join('\n')

    // Adicionar BOM para UTF-8
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csvContent

    // Criar e baixar arquivo
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      
      // Nome do arquivo com data/hora atual
      const now = new Date()
      const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '-')
      link.setAttribute('download', `tracking-disparos-${timestamp}.csv`)
      
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Liberar URL object
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="dispatch-page">
      <Container fluid className="py-4">
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
              <div className="d-flex align-items-center">
                <Activity size={24} className="text-primary me-2" />
                <div>
                  <h1 className="h3 fw-bold mb-1">Acompanhamento de Disparos</h1>
                  <p className="text-muted mb-0">Consulte o progresso e resultados das campanhas</p>
                </div>
              </div>
              <Button 
                variant="outline-primary" 
                size="sm" 
                className="ms-auto"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw size={16} className="me-1" />
                {loading ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>
          </Col>
        </Row>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Seção de Filtros */}
        <Card className="shadow-sm mb-4">
          <Card.Header>
            <div className="d-flex align-items-center">
              <Filter size={20} className="text-primary me-2" />
              <h6 className="mb-0">Filtros</h6>
              <div className="ms-auto d-flex gap-2">
                <Button 
                  variant="outline-success" 
                  size="sm"
                  onClick={downloadCSV}
                  disabled={filteredItems.length === 0}
                >
                  <Download size={16} className="me-1" />
                  Baixar CSV
                </Button>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={clearFilters}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              {/* Busca Geral */}
              <Col md={6} lg={4}>
                <Form.Label>Buscar Cliente/WhatsApp/Telefone</Form.Label>
                <InputGroup>
                  <InputGroup.Text><Search size={16} /></InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Digite para buscar..."
                    value={filters.busca}
                    onChange={(e) => updateFilter('busca', e.target.value)}
                  />
                </InputGroup>
              </Col>
              
              {/* Filtro por Campanha */}
              <Col md={6} lg={4}>
                <Form.Label>Campanha Enviada</Form.Label>
                <Form.Select 
                  value={filters.campanha}
                  onChange={(e) => updateFilter('campanha', e.target.value)}
                >
                  <option value="">Todas as campanhas</option>
                  {getUniqueOptions('campanha').map(campanha => (
                    <option key={campanha} value={campanha}>{campanha}</option>
                  ))}
                </Form.Select>
              </Col>
              
              {/* Filtro por Status */}
              <Col md={6} lg={4}>
                <Form.Label>Status</Form.Label>
                <Form.Select 
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                >
                  <option value="">Todos os status</option>
                  {getUniqueOptions('status').map(status => (
                    <option key={status} value={status}>{getStatusText(status)}</option>
                  ))}
                </Form.Select>
              </Col>
              
              {/* Filtro por Data Agendada */}
              <Col md={6} lg={4}>
                <Form.Label>Data e Hora Agendada (&gt;=)</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={filters.dataAgendada}
                  onChange={(e) => updateFilter('dataAgendada', e.target.value)}
                  placeholder="Selecione data e hora..."
                />
                <small className="text-muted">Mostra registros agendados a partir desta data/hora</small>
              </Col>
              
              {/* Filtro por Data Criação */}
              <Col md={6} lg={4}>
                <Form.Label>Data e Hora de Criação (&gt;=)</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={filters.dataCriacao}
                  onChange={(e) => updateFilter('dataCriacao', e.target.value)}
                  placeholder="Selecione data e hora..."
                />
                <small className="text-muted">Mostra registros criados a partir desta data/hora</small>
              </Col>
              
              {/* Filtro por Template */}
              <Col md={6} lg={4}>
                <Form.Label>Template</Form.Label>
                <Form.Select 
                  value={filters.template}
                  onChange={(e) => updateFilter('template', e.target.value)}
                >
                  <option value="">Todos os templates</option>
                  {getUniqueOptions('template').map(template => (
                    <option key={template} value={template}>{template}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
            
            {/* Contador de resultados */}
            <div className="mt-3 pt-3 border-top">
              <small className="text-muted">
                Exibindo {paginatedItems.length} de {filteredItems.length} registros
                {filteredItems.length !== items.length && ` (${items.length} total, filtrados)`}
              </small>
            </div>
          </Card.Body>
        </Card>

        {/* Controles de Paginação Acima da Tabela */}
        {totalPages > 1 && (
          <Card className="shadow-sm mb-3">
            <Card.Body className="py-3">
              {/* Aviso para muitos registros */}
              {filteredItems.length > 500 && (
                <Alert variant="warning" className="mb-3 small">
                  ⚠️ <strong>Muitos registros encontrados ({filteredItems.length})</strong> - 
                  Para melhor performance, considere usar filtros para reduzir os resultados.
                </Alert>
              )}
              
              <div className="d-flex justify-content-between align-items-center">
                {/* Info de registros e seletor de itens por página */}
                <div className="d-flex align-items-center gap-3">
                  <small className="text-muted">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredItems.length)} de {filteredItems.length} registros
                  </small>
                  
                  <div className="d-flex align-items-center">
                    <label className="form-label mb-0 me-2 small">Itens:</label>
                    <select 
                      className="form-select form-select-sm" 
                      style={{width: 'auto', minWidth: '70px'}}
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>
                </div>
                
                {/* Navegação por páginas estilo imagem */}
                <div className="pagination-custom d-flex align-items-center gap-1">
                  {/* Seta anterior */}
                  <button 
                    className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                    onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    title="Página anterior"
                  >
                    ❮
                  </button>
                  
                  {/* Números das páginas */}
                  {getPaginationRange().map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                          ...
                        </span>
                      )
                    }
                    
                    return (
                      <button
                        key={page}
                        className={`pagination-btn ${
                          page === currentPage ? 'active' : ''
                        }`}
                        onClick={() => handlePageChange(page)}
                        title={`Página ${page}`}
                      >
                        {page}
                      </button>
                    )
                  })}
                  
                  {/* Seta próxima */}
                  <button 
                    className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                    onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title="Próxima página"
                  >
                    ❯
                  </button>
                </div>
              </div>
            </Card.Body>
          </Card>
        )}

        <Card className="shadow-sm">
          <Card.Header>
            <h5 className="mb-0">Registros ({filteredItems.length})</h5>
          </Card.Header>
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center p-5">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
                <p className="text-muted mb-0">Carregando acompanhamento...</p>
              </div>
            ) : (
              <div className="tracking-table-container">
                <Table className="mb-0 tracking-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Whatsapp</th>
                      <th>Campanha Enviada</th>
                      <th>Telefone Disparado</th>
                      <th>Agendamento</th>
                      <th>Criação</th>
                      <th>Status</th>
                      <th>Motivo</th>
                      <th>Template enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((it, idx) => (
                      <tr key={`${it.id}-${idx}`}>
                        <td className="text-muted">{it.id}</td>
                        <td>{it.name}</td>
                        <td><Phone size={14} className="me-1 text-muted"/>{formatWhatsapp(it.phone)}</td>
                        <td>{it.nameBatch}</td>
                        <td>{formatWhatsapp(it.display_phone_number)}</td>
                        <td>{formatDateTimeSP(it.scheduledDateTime)}</td>
                        <td>{formatDateTimeSP(it.criado_em)}</td>
                        <td>{statusBadge(it.sendStatus)}</td>
                        <td className="text-center">{renderMotivo(it.typeError, it.sendStatus)}</td>
                        <td className="text-muted">{it.template}</td>
                      </tr>
                    ))}
                    {paginatedItems.length === 0 && filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center text-muted py-4">
                          {items.length === 0 ? 'Nenhum disparo encontrado.' : 'Nenhum registro corresponde aos filtros aplicados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Container>
      
      {/* Tooltip Global */}
      {tooltip.visible && (
        <div 
          className="global-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 99999,
            background: '#333',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            maxWidth: '300px',
            minWidth: '150px',
            wordWrap: 'break-word',
            whiteSpace: 'normal',
            lineHeight: '1.4',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none'
          }}
        >
          {tooltip.content}
          <div 
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #333'
            }}
          />
        </div>
      )}
    </div>
  )
}

export default Tracking
