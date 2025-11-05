import { useEffect, useState, useMemo } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'
import { Link } from 'react-router-dom'

function StatCard({ title, value, icon: Icon, accent = 'primary' }) {
  return (
    <div className={`neo-card neo-lg p-4 neo-accent-${accent} h-100`}>
      <div className="d-flex align-items-center justify-content-between">
        <div>
          <div className="small opacity-75 mb-1">{title}</div>
          <div className="display-6 fw-bold">{value}</div>
        </div>
        {Icon && (
          <div className="icon-wrap d-inline-flex align-items-center justify-content-center rounded-3" aria-hidden>
            <Icon size={28} />
          </div>
        )}
      </div>
    </div>
  )
}

const ROWS_PER_PAGE = 20

export default function GeradorSites() {
  const { user } = useAuth()
  const isMaster = (user?.role || '').toLowerCase() === 'master'
  
  // Lista de sites
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Modal de criação
  const [showCreate, setShowCreate] = useState(false)
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [endereco, setEndereco] = useState('')
  const [email, setEmail] = useState('')
  const [metaTag, setMetaTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Modal de edição
  const [showEdit, setShowEdit] = useState(false)
  const [selectedSite, setSelectedSite] = useState(null)
  const [editRazaoSocial, setEditRazaoSocial] = useState('')
  const [editCnpj, setEditCnpj] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editMetaTag, setEditMetaTag] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  
  // Modal de confirmação de exclusão
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [siteToDelete, setSiteToDelete] = useState(null)
  
  // Modal de upload em lote
  const [showBatchUpload, setShowBatchUpload] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, errors: [] })
  
  // Busca e filtros
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isPageAnimating, setIsPageAnimating] = useState(false)
  
  // Estado para ações em andamento
  const [deletingId, setDeletingId] = useState(null)
  
  // Formatar CNPJ
  const formatCNPJ = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 14) {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
    return value
  }
  
  // Formatar WhatsApp
  const formatWhatsApp = (value) => {
    if (!value) return '-'
    const numbers = String(value).replace(/\D/g, '')
    
    // Se já tem DDI (55), remove para adicionar depois
    let cleanNumber = numbers.startsWith('55') ? numbers.substring(2) : numbers
    
    // Se tem 11 dígitos (formato correto): (XX) XXXXX-XXXX
    if (cleanNumber.length === 11) {
      return cleanNumber.replace(/(\d{2})(\d{5})(\d{4})/, '+55 ($1) $2-$3')
    }
    
    // Se tem 10 dígitos (telefone fixo): (XX) XXXX-XXXX
    if (cleanNumber.length === 10) {
      return cleanNumber.replace(/(\d{2})(\d{4})(\d{4})/, '+55 ($1) $2-$3')
    }
    
    // Se não conseguir formatar, retorna com +55 no início
    return numbers.startsWith('55') ? `+${numbers}` : `+55${numbers}`
  }
  
  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Carregar sites
  async function loadSites() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/view-site')
      
      // Se a resposta não for OK, considera como lista vazia
      if (!res.ok) {
        console.warn(`API retornou status ${res.status}, exibindo lista vazia`)
        setSites([])
        setIsLoading(false)
        return
      }
      
      // Tentar fazer parse do JSON
      let data
      try {
        data = await res.json()
      } catch (jsonError) {
        console.warn('Erro ao fazer parse do JSON, exibindo lista vazia:', jsonError)
        setSites([])
        setIsLoading(false)
        return
      }
      
      // Verificar se é um array válido
      if (!Array.isArray(data)) {
        console.warn('Resposta da API não é um array, exibindo lista vazia')
        setSites([])
      } else {
        setSites(data)
      }
    } catch (e) {
      console.error('Erro ao carregar sites:', e)
      setSites([])
      // Não mostra notificação de erro, apenas log silencioso
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => { loadSites() }, [])
  
  // Criar novo site
  async function handleCreate(e) {
    e?.preventDefault?.()
    
    if (!razaoSocial.trim()) return notify.error('Informe a razão social')
    if (!cnpj.trim()) return notify.error('Informe o CNPJ')
    if (!whatsapp.trim()) return notify.error('Informe o WhatsApp')
    if (!endereco.trim()) return notify.error('Informe o endereço')
    if (!email.trim()) return notify.error('Informe o e-mail')
    
    // Capturar IP do usuário
    let ipAddress = null
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipRes.json()
      ipAddress = ipData.ip
    } catch (e) {
      console.warn('Não foi possível obter o IP:', e)
    }
    
    const payload = {
      razao_social: razaoSocial,
      cnpj: cnpj.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, ''),
      endereco: endereco,
      email: email,
      meta_tag: metaTag,
      usuario_id: user?.id || null,
      equipe_id: user?.equipe_id || null,
      ip_address: ipAddress
    }
    
    try {
      setIsSubmitting(true)
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/gera-site-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      notify.success('Site gerado com sucesso!')
      setShowCreate(false)
      
      // Limpar formulário
      setRazaoSocial('')
      setCnpj('')
      setWhatsapp('')
      setEndereco('')
      setEmail('')
      setMetaTag('')
      
      await loadSites()
    } catch (e) {
      console.error('Falha ao gerar site:', e)
      notify.error(`Falha ao gerar site: ${e.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Download do HTML
  function handleDownloadHTML(site) {
    if (!site.html_content) {
      notify.error('HTML não disponível para este site')
      return
    }
    
    try {
      // Criar um blob com o conteúdo HTML
      const blob = new Blob([site.html_content], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      
      // Criar elemento <a> temporário para download
      const a = document.createElement('a')
      a.href = url
      a.download = 'index.html'
      document.body.appendChild(a)
      a.click()
      
      // Limpar
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      notify.success('Download iniciado!')
    } catch (e) {
      console.error('Falha ao fazer download:', e)
      notify.error('Falha ao fazer download do HTML')
    }
  }
  
  // Abrir modal de edição
  function handleOpenEdit(site) {
    setSelectedSite(site)
    setEditRazaoSocial(site.razao_social || '')
    setEditCnpj(formatCNPJ(site.cnpj || ''))
    setEditWhatsapp(formatWhatsApp(site.whatsapp || ''))
    setEditEndereco(site.endereco || '')
    setEditEmail(site.email || '')
    setEditMetaTag(site.meta_tag || '')
    setShowEdit(true)
  }
  
  // Fechar modal de edição
  function handleCloseEdit() {
    setShowEdit(false)
    setSelectedSite(null)
    setEditRazaoSocial('')
    setEditCnpj('')
    setEditWhatsapp('')
    setEditEndereco('')
    setEditEmail('')
    setEditMetaTag('')
  }
  
  // Função de alteração
  async function handleEdit(e) {
    e?.preventDefault?.()
    
    if (!editRazaoSocial.trim()) return notify.error('Informe a razão social')
    if (!editCnpj.trim()) return notify.error('Informe o CNPJ')
    if (!editWhatsapp.trim()) return notify.error('Informe o WhatsApp')
    if (!editEndereco.trim()) return notify.error('Informe o endereço')
    if (!editEmail.trim()) return notify.error('Informe o e-mail')
    
    try {
      setIsEditing(true)
      
      // PASSO 1: Buscar o HTML content atualizado do endpoint view-site
      let htmlContent = ''
      try {
        const viewRes = await fetch('https://webhook.sistemavieira.com.br/webhook/view-site')
        if (viewRes.ok) {
          const viewData = await viewRes.json()
          if (Array.isArray(viewData)) {
            const siteData = viewData.find(s => s.id === selectedSite?.id)
            if (siteData && siteData.html_content) {
              htmlContent = siteData.html_content
              console.log('HTML content atualizado obtido do view-site')
            } else {
              console.warn('Site não encontrado ou sem html_content no view-site')
              htmlContent = selectedSite?.html_content || ''
            }
          }
        } else {
          console.warn('Falha ao buscar view-site, usando html_content existente')
          htmlContent = selectedSite?.html_content || ''
        }
      } catch (viewError) {
        console.warn('Erro ao buscar view-site:', viewError)
        htmlContent = selectedSite?.html_content || ''
      }
      
      // PASSO 2: Capturar IP do usuário
      let ipAddress = null
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        ipAddress = ipData.ip
      } catch (e) {
        console.warn('Não foi possível obter o IP:', e)
      }
      
      // PASSO 3: Preparar payload com o HTML content atualizado
      const payload = {
        id: selectedSite?.id,
        razao_social: editRazaoSocial,
        cnpj: editCnpj.replace(/\D/g, ''),
        whatsapp: editWhatsapp.replace(/\D/g, ''),
        endereco: editEndereco,
        email: editEmail,
        meta_tag: editMetaTag,
        html_content: htmlContent,
        usuario_id: user?.id || null,
        equipe_id: user?.equipe_id || null,
        ip_address: ipAddress
      }
      
      console.log('Enviando alteração com html_content de', htmlContent.length, 'caracteres')
      
      // PASSO 4: Enviar alteração para o webhook
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/alterar-cnpj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      notify.success('Site alterado com sucesso!')
      handleCloseEdit()
      await loadSites()
    } catch (e) {
      console.error('Falha ao alterar site:', e)
      notify.error(`Falha ao alterar site: ${e.message}`)
    } finally {
      setIsEditing(false)
    }
  }
  
  // Abrir modal de confirmação de exclusão
  function handleOpenDeleteConfirm(site) {
    setSiteToDelete(site)
    setShowDeleteConfirm(true)
  }
  
  // Fechar modal de confirmação de exclusão
  function handleCloseDeleteConfirm() {
    setShowDeleteConfirm(false)
    setSiteToDelete(null)
  }
  
  // Processar CSV em lote
  async function handleBatchUpload(e) {
    e?.preventDefault()
    
    if (!csvFile) return notify.error('Selecione um arquivo CSV')
    
    try {
      setIsProcessing(true)
      
      // Ler arquivo CSV
      const text = await csvFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        notify.error('Arquivo CSV vazio ou inválido')
        return
      }
      
      // Validar cabeçalho
      const header = lines[0].split(';').map(h => h.trim().toLowerCase())
      const requiredColumns = ['razão social', 'cnpj', 'whatsapp', 'endereço', 'e-mail', 'meta tag']
      const hasAllColumns = requiredColumns.every(col => 
        header.some(h => h.includes(col.toLowerCase().replace(/ã/g, 'a').replace(/ç/g, 'c')))
      )
      
      if (!hasAllColumns) {
        notify.error('CSV deve conter as colunas: Razão Social, CNPJ, Whatsapp, Endereço, E-mail, Meta Tag')
        return
      }
      
      const dataLines = lines.slice(1)
      setBatchProgress({ current: 0, total: dataLines.length, errors: [] })
      
      const errors = []
      
      // Processar linha por linha SEQUENCIALMENTE (envia, aguarda resposta, envia próxima)
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim()
        if (!line) continue
        
        const columns = line.split(';').map(c => c.trim())
        
        if (columns.length < 6) {
          errors.push(`Linha ${i + 2}: Número de colunas insuficiente`)
          setBatchProgress(prev => ({ ...prev, current: i + 1, errors: [...prev.errors, `Linha ${i + 2}: Erro`] }))
          continue
        }
        
        const [razaoSocial, cnpj, whatsapp, endereco, email, metaTag] = columns
        
        // Validar dados obrigatórios
        if (!razaoSocial || !cnpj || !whatsapp || !endereco || !email) {
          errors.push(`Linha ${i + 2}: Dados obrigatórios faltando`)
          setBatchProgress(prev => ({ ...prev, current: i + 1, errors: [...prev.errors, `Linha ${i + 2}: Dados faltando`] }))
          continue
        }
        
        // Capturar IP do usuário
        let ipAddress = null
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json')
          const ipData = await ipRes.json()
          ipAddress = ipData.ip
        } catch (e) {
          console.warn('Não foi possível obter o IP:', e)
        }
        
        const payload = {
          razao_social: razaoSocial,
          cnpj: cnpj.replace(/\D/g, ''),
          whatsapp: whatsapp.replace(/\D/g, ''),
          endereco: endereco,
          email: email,
          meta_tag: metaTag || '',
          usuario_id: user?.id || null,
          equipe_id: user?.equipe_id || null,
          ip_address: ipAddress
        }
        
        try {
          // ENVIA POST E AGUARDA RESPOSTA
          const res = await fetch('https://webhook.sistemavieira.com.br/webhook/gera-site-individual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          
          if (!res.ok) {
            errors.push(`Linha ${i + 2} (${razaoSocial}): Erro HTTP ${res.status}`)
            setBatchProgress(prev => ({ ...prev, current: i + 1, errors: [...prev.errors, `Linha ${i + 2}: Erro HTTP`] }))
          } else {
            setBatchProgress(prev => ({ ...prev, current: i + 1 }))
          }
        } catch (err) {
          errors.push(`Linha ${i + 2} (${razaoSocial}): ${err.message}`)
          setBatchProgress(prev => ({ ...prev, current: i + 1, errors: [...prev.errors, `Linha ${i + 2}: ${err.message}`] }))
        }
        
        // Aguardar 500ms entre requisições para não sobrecarregar
        if (i < dataLines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      // Finalizar
      if (errors.length > 0) {
        notify.warning(`Processamento concluído com ${errors.length} erro(s)`)
      } else {
        notify.success('Todos os sites foram gerados com sucesso!')
      }
      
      await loadSites()
      
      // Aguardar 2 segundos antes de fechar
      setTimeout(() => {
        setShowBatchUpload(false)
        setCsvFile(null)
        setBatchProgress({ current: 0, total: 0, errors: [] })
      }, 2000)
      
    } catch (e) {
      console.error('Erro ao processar CSV:', e)
      notify.error(`Erro ao processar arquivo: ${e.message}`)
    } finally {
      setIsProcessing(false)
    }
  }
  
  // Baixar CSV de exemplo
  function handleDownloadExampleCSV() {
    const exampleData = [
      ['razao social', 'cnpj', 'whatsapp', 'endereco', 'e-mail', 'meta tag'],
      ['Empresa Exemplo LTDA', '12.345.678/0001-90', '(11) 98765-4321', 'Rua das Flores, 123 - Centro', 'contato@exemplo.com', 'Credito consignado rapido e facil'],
      ['Consultoria ABC ME', '98.765.432/0001-12', '(21) 99999-8888', 'Av. Principal, 456 - Sala 10', 'vendas@abc.com', 'Emprestimo consignado com taxas baixas']
    ]
    
    const csvContent = exampleData.map(row => row.join(';')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = 'exemplo-sites.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    notify.success('Arquivo de exemplo baixado!')
  }
  
  // Exportar tabela completa em CSV
  function handleExportTableCSV() {
    if (filtered.length === 0) {
      notify.error('Nenhum dado para exportar')
      return
    }
    
    const headers = ['ID', 'Razao Social', 'CNPJ', 'WhatsApp', 'Endereco', 'E-mail', 'Meta Tag', 'Link Download']
    const rows = filtered.map(site => [
      site.id,
      site.razao_social || '',
      formatCNPJ(site.cnpj) || '',
      formatWhatsApp(site.whatsapp) || '',
      site.endereco || '',
      site.email || '',
      site.meta_tag || '',
      site.html_content ? `${window.location.origin}/sites/${site.id}/index.html` : 'N/A'
    ])
    
    const csvData = [headers, ...rows]
    const csvContent = csvData.map(row => row.join(';')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `sites-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    notify.success(`${filtered.length} registros exportados com sucesso!`)
  }
  async function handleDelete() {
    if (!siteToDelete) return
    
    try {
      setDeletingId(siteToDelete.id)
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/excluiur-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: siteToDelete.id })
      })
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      notify.success('Site excluído com sucesso!')
      handleCloseDeleteConfirm()
      await loadSites()
    } catch (e) {
      console.error('Falha ao excluir site:', e)
      notify.error(`Falha ao excluir: ${e.message}`)
    } finally {
      setDeletingId(null)
    }
  }
  
  // Filtrar sites
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (sites || []).filter(site => {
      if (q) {
        const searchText = `${site.razao_social || ''} ${site.cnpj || ''}`.toLowerCase()
        if (!searchText.includes(q)) return false
      }
      return true
    })
  }, [sites, search])
  
  // Resetar página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [search])
  
  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])
  
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE
    return filtered.slice(start, start + ROWS_PER_PAGE)
  }, [filtered, currentPage])
  
  // Animação de página
  useEffect(() => {
    if (filtered.length === 0) return
    setIsPageAnimating(true)
    const timer = setTimeout(() => setIsPageAnimating(false), 500)
    return () => clearTimeout(timer)
  }, [currentPage, filtered.length])
  
  // Itens de paginação
  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return []
    const candidates = new Set([1, totalPages, currentPage])
    for (let i = currentPage - 2; i <= currentPage + 2; i += 1) {
      if (i > 1 && i < totalPages) candidates.add(i)
    }
    const pages = Array.from(candidates).sort((a, b) => a - b)
    const result = []
    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i]
      if (i > 0) {
        const prev = pages[i - 1]
        if (page - prev > 1) {
          result.push({ type: 'ellipsis', key: `ellipsis-${prev}-${page}` })
        }
      }
      result.push({ type: 'page', key: `page-${page}`, page })
    }
    return result
  }, [totalPages, currentPage])
  
  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: filtered.length,
      hoje: filtered.filter(s => {
        const created = new Date(s.created_at)
        const today = new Date()
        return created.toDateString() === today.toDateString()
      }).length,
      semana: filtered.filter(s => {
        const created = new Date(s.created_at)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return created >= weekAgo
      }).length
    }
  }, [filtered])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        {/* Header */}
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link 
              to="/dashboard" 
              className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" 
              title="Voltar ao Dashboard"
            >
              <Fi.FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <h2 className="fw-bold mb-1">Gerador de Sites</h2>
              <div className="opacity-75 small">
                Gere sites profissionais de forma automatizada
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          <div className="col-lg-4 col-md-6">
            <StatCard title="Total de Sites" value={stats.total} icon={Fi.FiGlobe} accent="primary" />
          </div>
          <div className="col-lg-4 col-md-6">
            <StatCard title="Gerados Hoje" value={stats.hoje} icon={Fi.FiCalendar} accent="success" />
          </div>
          <div className="col-lg-4 col-md-6">
            <StatCard title="Última Semana" value={stats.semana} icon={Fi.FiTrendingUp} accent="info" />
          </div>
        </div>

        {/* Filtros e Ações */}
        <div className="neo-card neo-lg p-4 mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-lg-6">
              <label className="form-label small opacity-75">Buscar</label>
              <input 
                className="form-control" 
                placeholder="Buscar por empresa ou CNPJ..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            <div className="col-12 col-lg-6 d-flex gap-2 justify-content-end align-items-end">
              <button 
                className="btn btn-outline-info d-flex align-items-center gap-2"
                onClick={handleExportTableCSV}
                disabled={isLoading || filtered.length === 0}
                title="Exportar tabela em CSV"
              >
                <Fi.FiDownload size={16} />
                <span>Exportar CSV</span>
              </button>
              <button 
                className="btn btn-outline-primary d-flex align-items-center gap-2" 
                onClick={loadSites} 
                disabled={isLoading}
              >
                <Fi.FiRefreshCcw size={16} />
                <span>Atualizar</span>
              </button>
              <button 
                className="btn btn-outline-success d-flex align-items-center gap-2"
                onClick={() => setShowBatchUpload(true)}
              >
                <Fi.FiUpload size={16} />
                <span>Upload CSV</span>
              </button>
              <button 
                className="btn btn-primary d-flex align-items-center gap-2"
                onClick={() => setShowCreate(true)}
              >
                <Fi.FiPlus size={16} />
                <span className="text-nowrap">Gerar Novo Site</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3 opacity-75">
          <small>Mostrando {filtered.length} de {sites.length} sites</small>
        </div>

        {/* Tabela de Sites */}
        <div className="neo-card neo-lg p-0">
          {isLoading && (
            <div className="p-4 text-center opacity-75">
              <Fi.FiLoader className="spinner-border spinner-border-sm me-2" />
              Carregando...
            </div>
          )}
          
          {error && (
            <div className="p-4 alert alert-danger m-3">
              {String(error)}
            </div>
          )}
          
          {!isLoading && !error && (
            <div className={`table-responsive ${isPageAnimating ? 'page-fade' : ''}`}>
              {/* Paginação Superior */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-end px-3 pt-3">
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      title="Página anterior"
                    >
                      <Fi.FiChevronLeft />
                    </button>
                    {paginationItems.map(item => {
                      if (item.type === 'ellipsis') {
                        return (
                          <span key={item.key} className="btn btn-ghost btn-sm disabled" aria-hidden>
                            ...
                          </span>
                        )
                      }
                      const isActive = item.page === currentPage
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCurrentPage(item.page)}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          {item.page}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      title="Próxima página"
                    >
                      <Fi.FiChevronRight />
                    </button>
                  </div>
                </div>
              )}
              
              <table className="table table-dark table-hover table-bordered align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-center" style={{width:60}}>ID</th>
                    <th className="text-center">Razão Social</th>
                    <th className="text-center">CNPJ</th>
                    <th className="text-center">WhatsApp</th>
                    <th className="text-center">Meta Tag</th>
                    <th className="text-center" style={{width:80}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center opacity-75 p-4">
                        Nenhuma página criada
                      </td>
                    </tr>
                  )}
                  {paginated.map((site) => (
                    <tr key={site.id}>
                      <td className="text-center">{site.id}</td>
                      <td className="text-uppercase">{site.razao_social}</td>
                      <td>{formatCNPJ(site.cnpj)}</td>
                      <td>{formatWhatsApp(site.whatsapp)}</td>
                      <td>
                        <div 
                          className="small" 
                          style={{
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={site.meta_tag}
                        >
                          {site.meta_tag || '-'}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-2 justify-content-center">
                          <button
                            className="btn btn-success btn-sm d-inline-flex align-items-center justify-content-center rounded-circle"
                            style={{width: 32, height: 32, padding: 0}}
                            title="Download HTML"
                            aria-label="Download HTML"
                            onClick={() => handleDownloadHTML(site)}
                            disabled={!site.html_content}
                          >
                            <Fi.FiDownload size={16} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm d-inline-flex align-items-center justify-content-center rounded-circle"
                            style={{width: 32, height: 32, padding: 0}}
                            title="Excluir"
                            aria-label="Excluir"
                            disabled={deletingId === site.id}
                            onClick={() => handleOpenDeleteConfirm(site)}
                          >
                            <Fi.FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Upload em Lote */}
      {showBatchUpload && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
        >
          <div className="modal-dark p-4" style={{maxWidth:600, width:'95%'}}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h4 className="modal-dark-title mb-1">
                  <Fi.FiUpload className="me-2" size={24} />
                  Upload em Lote (CSV)
                </h4>
                <p className="modal-dark-subtitle small mb-0">
                  Gerar múltiplos sites a partir de arquivo CSV
                </p>
              </div>
              <button 
                className="btn btn-ghost btn-icon" 
                onClick={() => {
                  if (!isProcessing) {
                    setShowBatchUpload(false)
                    setCsvFile(null)
                    setBatchProgress({ current: 0, total: 0, errors: [] })
                  }
                }} 
                aria-label="Fechar"
                disabled={isProcessing}
              >
                <Fi.FiX />
              </button>
            </div>
            
            <form onSubmit={handleBatchUpload}>
              <div className="alert alert-info d-flex align-items-start gap-2 mb-3">
                <Fi.FiInfo size={20} className="mt-1" />
                <div className="small w-100">
                  <strong>Formato do CSV:</strong>
                  <p className="mb-1 mt-2">O arquivo deve usar <strong>ponto e vírgula (;)</strong> como separador e conter as colunas:</p>
                  <ul className="mb-2 ps-3">
                    <li>Razão Social</li>
                    <li>CNPJ</li>
                    <li>Whatsapp</li>
                    <li>Endereço</li>
                    <li>E-mail</li>
                    <li>Meta Tag</li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                    onClick={handleDownloadExampleCSV}
                  >
                    <Fi.FiDownload size={14} />
                    Baixar arquivo de exemplo
                  </button>
                </div>
              </div>
              
              {!isProcessing ? (
                <>
                  <div className="mb-3">
                    <label className="form-label">Selecionar Arquivo CSV *</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      required
                    />
                    {csvFile && (
                      <small className="text-success mt-1 d-block">
                        <Fi.FiCheck className="me-1" />
                        Arquivo selecionado: {csvFile.name}
                      </small>
                    )}
                  </div>
                  
                  <div className="d-flex justify-content-end gap-2">
                    <button 
                      type="button" 
                      className="btn btn-ghost" 
                      onClick={() => {
                        setShowBatchUpload(false)
                        setCsvFile(null)
                      }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-success d-flex align-items-center gap-2"
                      disabled={!csvFile}
                    >
                      <Fi.FiUpload />
                      Processar CSV
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}} role="status">
                      <span className="visually-hidden">Processando...</span>
                    </div>
                    <h5 className="mb-2 text-light">Processando sites...</h5>
                    <p className="text-light mb-3">
                      {batchProgress.current} de {batchProgress.total} sites processados
                    </p>
                    
                    <div className="progress" style={{height: '24px'}}>
                      <div 
                        className="progress-bar progress-bar-striped progress-bar-animated" 
                        role="progressbar" 
                        style={{width: `${(batchProgress.current / batchProgress.total) * 100}%`}}
                        aria-valuenow={batchProgress.current} 
                        aria-valuemin="0" 
                        aria-valuemax={batchProgress.total}
                      >
                        {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                      </div>
                    </div>
                    
                    {batchProgress.errors.length > 0 && (
                      <div className="alert alert-warning mt-3 small text-start">
                        <strong>Erros encontrados ({batchProgress.errors.length}):</strong>
                        <ul className="mb-0 mt-2 ps-3">
                          {batchProgress.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                          {batchProgress.errors.length > 5 && (
                            <li>... e mais {batchProgress.errors.length - 5} erro(s)</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && siteToDelete && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
          onClick={handleCloseDeleteConfirm}
        >
          <div 
            className="bg-white rounded-3 p-4" 
            style={{maxWidth:500, width:'95%'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="mb-0 text-dark fw-bold">Confirmar exclusão</h5>
              <button 
                type="button"
                className="btn-close" 
                onClick={handleCloseDeleteConfirm} 
                aria-label="Fechar"
                disabled={deletingId === siteToDelete.id}
              />
            </div>
            
            <p className="text-dark mb-3">
              Tem certeza que deseja excluir <strong className="text-uppercase">{siteToDelete.razao_social}</strong>?
            </p>
            
            <p className="text-muted small mb-4">
              Esta ação não pode ser desfeita.
            </p>
            
            <div className="d-flex justify-content-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCloseDeleteConfirm}
                disabled={deletingId === siteToDelete.id}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleDelete}
                disabled={deletingId === siteToDelete.id}
              >
                {deletingId === siteToDelete.id ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEdit && selectedSite && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
        >
          <div className="modal-dark p-4" style={{maxWidth:680, width:'95%'}}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h4 className="modal-dark-title mb-1">
                  <Fi.FiEdit2 className="me-2" size={24} />
                  Alterar Site #{selectedSite.id}
                </h4>
                <p className="modal-dark-subtitle small mb-0">
                  Edite as informações do site
                </p>
              </div>
              <button 
                className="btn btn-ghost btn-icon" 
                onClick={handleCloseEdit} 
                aria-label="Fechar"
              >
                <Fi.FiX />
              </button>
            </div>
            
            <form onSubmit={handleEdit}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Razão Social *</label>
                  <input
                    className="form-control"
                    value={editRazaoSocial}
                    onChange={e => setEditRazaoSocial(e.target.value)}
                    placeholder="Digite a razão social da empresa"
                    required
                  />
                </div>
                
                <div className="col-12 col-md-6">
                  <label className="form-label">CNPJ *</label>
                  <input
                    className="form-control"
                    value={editCnpj}
                    onChange={e => setEditCnpj(formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    required
                  />
                </div>
                
                <div className="col-12 col-md-6">
                  <label className="form-label">WhatsApp *</label>
                  <input
                    className="form-control"
                    value={editWhatsapp}
                    onChange={e => setEditWhatsapp(formatWhatsApp(e.target.value))}
                    placeholder="+55 (00) 00000-0000"
                    maxLength={20}
                    required
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">Endereço *</label>
                  <input
                    className="form-control"
                    value={editEndereco}
                    onChange={e => setEditEndereco(e.target.value)}
                    placeholder="Digite o endereço completo"
                    required
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">E-mail *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    required
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">Meta Tag (Descrição SEO)</label>
                  <textarea
                    className="form-control"
                    value={editMetaTag}
                    onChange={e => setEditMetaTag(e.target.value)}
                    placeholder="Descrição do site para mecanismos de busca (SEO)"
                    rows={3}
                    maxLength={160}
                    style={{ color: '#f1f5f9', backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
                  />
                  <small className="form-text" style={{ color: 'rgba(226, 232, 240, 0.6)' }}>
                    {editMetaTag.length}/160 caracteres - Opcional, mas recomendado para SEO
                  </small>
                </div>
              </div>
              
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={handleCloseEdit}
                  disabled={isEditing}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary d-flex align-items-center gap-2" 
                  disabled={isEditing}
                >
                  {isEditing ? (
                    <>
                      <Fi.FiLoader className="spinner-border spinner-border-sm" />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <Fi.FiSave />
                      Alterar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {showCreate && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
        >
          <div className="modal-dark p-4" style={{maxWidth:680, width:'95%'}}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h4 className="modal-dark-title mb-1">
                  <Fi.FiGlobe className="me-2" size={24} />
                  Gerar Novo Site
                </h4>
                <p className="modal-dark-subtitle small mb-0">
                  Preencha as informações essenciais do site
                </p>
              </div>
              <button 
                className="btn btn-ghost btn-icon" 
                onClick={() => setShowCreate(false)} 
                aria-label="Fechar"
              >
                <Fi.FiX />
              </button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Razão Social *</label>
                  <input
                    className="form-control"
                    value={razaoSocial}
                    onChange={e => setRazaoSocial(e.target.value)}
                    placeholder="Digite a razão social da empresa"
                    required
                  />
                </div>
                
                <div className="col-12 col-md-6">
                  <label className="form-label">CNPJ *</label>
                  <input
                    className="form-control"
                    value={cnpj}
                    onChange={e => setCnpj(formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    required
                  />
                </div>
                
                <div className="col-12 col-md-6">
                  <label className="form-label">WhatsApp *</label>
                  <input
                    className="form-control"
                    value={whatsapp}
                    onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
                    placeholder="+55 (00) 00000-0000"
                    maxLength={20}
                    required
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">Endereço *</label>
                  <input
                    className="form-control"
                    value={endereco}
                    onChange={e => setEndereco(e.target.value)}
                    placeholder="Digite o endereço completo"
                    required
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">E-mail *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    required
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">Meta Tag (Descrição SEO)</label>
                  <textarea
                    className="form-control"
                    value={metaTag}
                    onChange={e => setMetaTag(e.target.value)}
                    placeholder="Descrição do site para mecanismos de busca (SEO)"
                    rows={3}
                    maxLength={160}
                    style={{ color: '#f1f5f9', backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
                  />
                  <small className="form-text" style={{ color: 'rgba(226, 232, 240, 0.6)' }}>
                    {metaTag.length}/160 caracteres - Opcional, mas recomendado para SEO
                  </small>
                </div>
              </div>
              
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={() => setShowCreate(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary d-flex align-items-center gap-2" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Fi.FiLoader className="spinner-border spinner-border-sm" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Fi.FiZap />
                      Gerar Site
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
