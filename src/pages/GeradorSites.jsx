import { useEffect, useState, useMemo } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as Fi from 'react-icons/fi'
import { notify } from '../utils/notify.js'
import { Link } from 'react-router-dom'

function StatCard({ title, value, icon: Icon, accent = 'primary' }) {
  return (
    <div className={`neo-card neo-lg neo-accent-${accent} h-100`} style={{padding: '8px 12px'}}>
      <div className="d-flex align-items-center justify-content-between">
        <div>
          <div className="small opacity-75" style={{marginBottom: '2px'}}>{title}</div>
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

const ROWS_PER_PAGE = 50

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
  const [proxy, setProxy] = useState('')
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
  const [editProxy, setEditProxy] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  
  // Limites & Chips
  const [selectedLimit, setSelectedLimit] = useState('')
  const [chip2Whatsapp, setChip2Whatsapp] = useState('')
  const [chip3Whatsapp, setChip3Whatsapp] = useState('')
  const [chip4Whatsapp, setChip4Whatsapp] = useState('')
  const [chip5Whatsapp, setChip5Whatsapp] = useState('')
  const [chip2Status, setChip2Status] = useState('Sem Status')
  const [chip3Status, setChip3Status] = useState('Sem Status')
  const [chip4Status, setChip4Status] = useState('Sem Status')
  const [chip5Status, setChip5Status] = useState('Sem Status')
  const [chip2Id, setChip2Id] = useState(null)
  const [chip3Id, setChip3Id] = useState(null)
  const [chip4Id, setChip4Id] = useState(null)
  const [chip5Id, setChip5Id] = useState(null)
  const [additionalChips, setAdditionalChips] = useState([])
  
  // Modal de confirmação de exclusão
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [siteToDelete, setSiteToDelete] = useState(null)
  
  // Modal de alteração de status
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedSiteForStatus, setSelectedSiteForStatus] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  
  // Modal de alteração de proxy
  const [showProxyModal, setShowProxyModal] = useState(false)
  const [selectedSiteForProxy, setSelectedSiteForProxy] = useState(null)
  const [newProxy, setNewProxy] = useState('')
  const [isSavingProxy, setIsSavingProxy] = useState(false)
  
  // Modal de upload em lote
  const [showBatchUpload, setShowBatchUpload] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, errors: [] })
  
  // Busca e filtros
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isPageAnimating, setIsPageAnimating] = useState(false)
  
  // Aba do modal de edição
  const [editModalTab, setEditModalTab] = useState('cadastro')
  
  // Estado para ações em andamento
  const [deletingId, setDeletingId] = useState(null)
  
  // IP do usuário
  const [ipAddress, setIpAddress] = useState(null)
  
  // Obter IP do usuário ao carregar
  useEffect(() => {
    async function getIP() {
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        setIpAddress(ipData.ip)
      } catch (e) {
        console.warn('Não foi possível obter o IP:', e)
        setIpAddress(null)
      }
    }
    getIP()
  }, [])
  
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
    
    const payload = {
      razao_social: razaoSocial,
      cnpj: cnpj.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, ''),
      endereco: endereco,
      email: email,
      meta_tag: metaTag.trim() || '<meta />',
      proxy: proxy.trim() || 'Não Informado',
      status: 'Aguardando Pagamento',
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
      setProxy('')
      
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
  async function handleOpenEdit(site) {
    setSelectedSite(site)
    setEditRazaoSocial(site.razao_social || '')
    setEditCnpj(formatCNPJ(site.cnpj || ''))
    setEditWhatsapp(formatWhatsApp(site.whatsapp || ''))
    setEditEndereco(site.endereco || '')
    setEditEmail(site.email || '')
    setEditMetaTag(site.meta_tag || '')
    setEditProxy(site.proxy || '')
    setEditStatus(site.status || 'Sem Status')
    
    // Limpar estados de chips
    setSelectedLimit('')
    setChip2Whatsapp('')
    setChip3Whatsapp('')
    setChip4Whatsapp('')
    setChip5Whatsapp('')
    setChip2Status('Sem Status')
    setChip3Status('Sem Status')
    setChip4Status('Sem Status')
    setChip5Status('Sem Status')
    setChip2Id(null)
    setChip3Id(null)
    setChip4Id(null)
    setChip5Id(null)
    setAdditionalChips([])
    
    // Buscar dados de limites e chips do view-site
    try {
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/view-site')
      if (response.ok) {
        const data = await response.json()
        console.log('Dados completos do view-site:', data)
        if (Array.isArray(data)) {
          // Agrupar todos os registros do mesmo ID (cada chip é uma linha separada)
          const sitesData = data.filter(s => s.id === site.id)
          console.log('Registros encontrados para o site:', sitesData)
          
          if (sitesData.length > 0) {
            const firstRecord = sitesData[0]
            
            // Preencher limite (pega do primeiro registro)
            if (firstRecord.limite) {
              const limiteValue = String(firstRecord.limite)
              setSelectedLimit(limiteValue)
              console.log('Limite carregado:', limiteValue)
            }
            
            // Coletar todos os números e status de todos os registros
            const numeros = []
            const statuses = []
            const ids = []
            
            sitesData.forEach(record => {
              if (record.numero && record.status_z) {
                numeros.push(record.numero)
                statuses.push(record.status_z)
                ids.push(record.id_whats || null)
              }
            })
            
            console.log('Números coletados:', numeros)
            console.log('Status coletados:', statuses)
            console.log('IDs coletados:', ids)
            
            // Preencher os chips (pulando o primeiro que é o WhatsApp cadastrado)
            for (let i = 1; i < numeros.length; i++) {
              const numero = formatWhatsApp(numeros[i] || '')
              const status = statuses[i] || 'Sem Status'
              const idWhats = ids[i]
              
              console.log(`Chip ${i + 1}:`, { numero, status, idWhats })
              
              if (i === 1) {
                setChip2Whatsapp(numero)
                setChip2Status(status)
                setChip2Id(idWhats)
              } else if (i === 2) {
                setChip3Whatsapp(numero)
                setChip3Status(status)
                setChip3Id(idWhats)
              } else if (i === 3) {
                setChip4Whatsapp(numero)
                setChip4Status(status)
                setChip4Id(idWhats)
              } else if (i === 4) {
                setChip5Whatsapp(numero)
                setChip5Status(status)
                setChip5Id(idWhats)
              } else {
                // Chips adicionais para limites maiores
                setAdditionalChips(prev => [...prev, { whatsapp: numero, status, id_whats: idWhats }])
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados de limites:', error)
    }
    
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
    setEditProxy('')
    setEditStatus('')
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
        meta_tag: editMetaTag.trim() || '<meta />',
        proxy: editProxy.trim() || 'Não Informado',
        status: editStatus,
        html_content: htmlContent,
        usuario_id: user?.id || null,
        equipe_id: user?.equipe_id || null,
        ip_address: ipAddress
      }
      
      console.log('Enviando alteração com html_content de', htmlContent.length, 'caracteres')
      
      // PASSO 4: Enviar alteração para o webhook
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/alterar-cadastro', {
        method: 'PUT',
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
          meta_tag: metaTag.trim() || '<meta />',
          status: 'Aguardando Pagamento',
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
  // Copiar meta tag para clipboard
  function handleCopyMetaTag(metaTag) {
    if (!metaTag) {
      notify.error('Meta tag vazia')
      return
    }
    
    navigator.clipboard.writeText(metaTag)
      .then(() => {
        notify.success('Meta tag copiada!')
      })
      .catch(() => {
        notify.error('Erro ao copiar')
      })
  }
  
  // Copiar texto para clipboard
  function handleCopyText(text, label) {
    if (!text) {
      notify.error(`${label} vazio`)
      return
    }
    
    navigator.clipboard.writeText(text)
      .then(() => {
        notify.success(`${label} copiado!`)
      })
      .catch(() => {
        notify.error('Erro ao copiar')
      })
  }
  
  // Adicionar novo chip
  function handleAddChip() {
    setAdditionalChips([...additionalChips, { whatsapp: '', status: 'Sem Status' }])
  }
  
  // Remover chip
  function handleRemoveChip(index) {
    setAdditionalChips(additionalChips.filter((_, i) => i !== index))
  }
  
  // Atualizar chip
  function handleUpdateChip(index, value) {
    const updated = [...additionalChips]
    updated[index].whatsapp = formatWhatsApp(value)
    setAdditionalChips(updated)
  }
  
  // Atualizar status do chip
  function handleUpdateChipStatus(index, status) {
    const updated = [...additionalChips]
    updated[index].status = status
    setAdditionalChips(updated)
  }
  
  // Excluir chip específico
  async function handleDeleteChip(idWhats, chipNumero) {
    if (!idWhats) {
      notify.error('ID do telefone não encontrado')
      return
    }
    
    try {
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/excluiur-telefone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: idWhats
        })
      })
      
      if (!response.ok) {
        throw new Error('Erro ao excluir chip')
      }
      
      notify.success('Chip excluído com sucesso!')
      
      // Recarregar dados
      await loadSites()
      
      // Reabrir modal com dados atualizados
      if (selectedSite && selectedSite.id) {
        const updatedSite = sites.find(s => s.id === selectedSite.id)
        if (updatedSite) {
          setTimeout(() => {
            handleOpenEdit(updatedSite)
          }, 500)
        }
      }
    } catch (error) {
      console.error('Erro ao excluir chip:', error)
      notify.error('Erro ao excluir chip')
    }
  }
  
  // Salvar limites e chips
  async function handleSaveLimitesChips() {
    if (!selectedSite || !selectedSite.id) {
      notify.error('Site não selecionado')
      return
    }
    
    setIsEditing(true)
    
    try {
      // Coletar todos os chips preenchidos
      const chips = []
      
      // Chip 1 (sempre existe - WhatsApp cadastrado)
      if (editWhatsapp) {
        chips.push({
          numero: editWhatsapp,
          status: 'Ok' // Chip 1 sempre Ok por padrão
        })
      }
      
      // Chips do limite 250 e 2000
      if (selectedLimit === '250' || selectedLimit === '2000') {
        if (chip2Whatsapp) {
          chips.push({ numero: chip2Whatsapp, status: chip2Status })
        }
      }
      
      if (selectedLimit === '2000') {
        if (chip3Whatsapp) {
          chips.push({ numero: chip3Whatsapp, status: chip3Status })
        }
        if (chip4Whatsapp) {
          chips.push({ numero: chip4Whatsapp, status: chip4Status })
        }
        if (chip5Whatsapp) {
          chips.push({ numero: chip5Whatsapp, status: chip5Status })
        }
      }
      
      // Chips adicionais (limites 10000, 100000, ilimitado)
      if (selectedLimit === '10000' || selectedLimit === '100000' || selectedLimit === 'ilimitado') {
        additionalChips.forEach(chip => {
          if (chip.whatsapp) {
            chips.push({ numero: chip.whatsapp, status: chip.status })
          }
        })
      }
      
      const payload = {
        // ID da empresa
        id: selectedSite.id,
        
        // Dados do Cadastro
        razao_social: editRazaoSocial,
        cnpj: editCnpj,
        whatsapp: editWhatsapp,
        endereco: editEndereco,
        email: editEmail,
        meta_tag: editMetaTag,
        proxy: editProxy,
        status: editStatus,
        
        // Dados de Limites & Contas
        limite: selectedLimit,
        chips: chips
      }
      
      const response = await fetch('https://webhook.sistemavieira.com.br/webhook/save-zap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Erro da API:', errorText)
        throw new Error('Erro ao salvar')
      }
      
      notify.success('Limites e chips salvos com sucesso!')
      
      // Recarregar dados do view-site
      await loadSites()
      
      // Reabrir o modal com dados atualizados
      if (selectedSite && selectedSite.id) {
        // Buscar o site atualizado da lista
        const updatedSite = sites.find(s => s.id === selectedSite.id)
        if (updatedSite) {
          // Pequeno delay para garantir que o loadSites terminou
          setTimeout(() => {
            handleOpenEdit(updatedSite)
          }, 500)
        }
      }
    } catch (error) {
      console.error('Erro ao salvar limites:', error)
      notify.error('Erro ao salvar limites e chips')
    } finally {
      setIsEditing(false)
    }
  }
  
  // Calcular estatísticas dos chips
  function getChipsStats() {
    let total = 0
    let ok = 0
    let banido = 0
    let semStatus = 0
    
    // Chip 1 (WhatsApp cadastrado)
    if (editWhatsapp) {
      total++
      ok++ // Sempre Ok
    }
    
    // Chips do limite 250 e 2000
    if (selectedLimit === '250' || selectedLimit === '2000') {
      if (chip2Whatsapp) {
        total++
        if (chip2Status === 'Ok') ok++
        else if (chip2Status === 'Banido') banido++
        else semStatus++
      }
    }
    
    if (selectedLimit === '2000') {
      if (chip3Whatsapp) {
        total++
        if (chip3Status === 'Ok') ok++
        else if (chip3Status === 'Banido') banido++
        else semStatus++
      }
      if (chip4Whatsapp) {
        total++
        if (chip4Status === 'Ok') ok++
        else if (chip4Status === 'Banido') banido++
        else semStatus++
      }
      if (chip5Whatsapp) {
        total++
        if (chip5Status === 'Ok') ok++
        else if (chip5Status === 'Banido') banido++
        else semStatus++
      }
    }
    
    // Chips adicionais
    if (selectedLimit === '10000' || selectedLimit === '100000' || selectedLimit === 'ilimitado') {
      additionalChips.forEach(chip => {
        if (chip.whatsapp) {
          total++
          if (chip.status === 'Ok') ok++
          else if (chip.status === 'Banido') banido++
          else semStatus++
        }
      })
    }
    
    return { total, ok, banido, semStatus }
  }
  
  // Formatar data e hora
  function formatDateTime(dateString) {
    if (!dateString) return '-'
    
    try {
      const date = new Date(dateString)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${day}/${month}/${year} ${hours}:${minutes}`
    } catch (e) {
      return '-'
    }
  }
  
  // Obter contagem de telefones de um site específico baseado no limite
  function getTelefonesDisplay(site) {
    // Se não for verificado, não mostra nada
    if (site.status !== 'Verificado') {
      return '-'
    }
    
    // Buscar o limite do site
    const limite = site.limite || ''
    
    // Buscar quantos registros existem para este ID (contagem real)
    const siteRecords = sites.filter(s => s.id === site.id)
    const totalReal = siteRecords.length
    
    // Definir total máximo baseado no limite
    let totalMax = 0
    if (limite === '250') {
      totalMax = 2
    } else if (limite === '2000') {
      totalMax = 5
    } else if (limite === '10000' || limite === '100000' || limite === 'ilimitado') {
      return `${totalReal}/∞`
    } else {
      return '-'
    }
    
    // Retornar contagem real / máximo
    return `${totalReal}/${totalMax}`
  }
  
  // Abrir modal de status
  function handleOpenStatusModal(site) {
    setSelectedSiteForStatus(site)
    setNewStatus(site.status || 'Sem Status')
    setShowStatusModal(true)
  }
  
  // Fechar modal de status
  function handleCloseStatusModal() {
    setShowStatusModal(false)
    setSelectedSiteForStatus(null)
    setNewStatus('')
  }
  
  // Salvar novo status
  async function handleSaveStatus() {
    if (!selectedSiteForStatus) return
    
    try {
      setIsSavingStatus(true)
      
      const payload = {
        id: selectedSiteForStatus.id,
        status: newStatus,
        usuario_id: user?.id || null,
        equipe_id: user?.equipe_id || null,
        ip_address: ipAddress
      }
      
      console.log('Enviando payload:', payload)
      
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/mudar-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      console.log('Resposta:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Erro da API:', errorText)
        throw new Error(`Erro ao atualizar status: ${res.status}`)
      }
      
      // Atualiza localmente
      const updatedSites = sites.map(site => 
        site.id === selectedSiteForStatus.id 
          ? { ...site, status: newStatus }
          : site
      )
      setSites(updatedSites)
      
      notify.success('Status atualizado com sucesso!')
      handleCloseStatusModal()
    } catch (e) {
      console.error('Erro ao atualizar status:', e)
      notify.error('Falha ao atualizar status')
    } finally {
      setIsSavingStatus(false)
    }
  }
  
  // Obter cor do badge de status
  function getStatusBadgeClass(status) {
    const statusMap = {
      'Sem Status': 'bg-secondary',
      'Aguardando Pagamento': 'bg-warning text-dark',
      'Aguardando BM': 'bg-warning text-dark',
      'Aguardando Criação BM': 'bg-warning text-dark',
      'Aguardando Criação Site': 'bg-warning text-dark',
      'Em Analise': 'bg-warning text-dark',
      'Verificado': 'bg-success',
      'Não Verificado': 'bg-danger',
      'Banido': 'bg-danger'
    }
    return statusMap[status] || 'bg-secondary'
  }
  
  // Abrir modal de proxy
  function handleOpenProxyModal(site) {
    setSelectedSiteForProxy(site)
    setNewProxy(site.proxy && site.proxy !== 'Não Informado' ? site.proxy : '')
    setShowProxyModal(true)
  }
  
  // Fechar modal de proxy
  function handleCloseProxyModal() {
    setShowProxyModal(false)
    setSelectedSiteForProxy(null)
    setNewProxy('')
  }
  
  // Salvar novo proxy
  async function handleSaveProxy() {
    if (!selectedSiteForProxy) return
    
    try {
      setIsSavingProxy(true)
      
      const proxyValue = newProxy.trim() || 'Não Informado'
      
      const payload = {
        id: selectedSiteForProxy.id,
        proxy: proxyValue,
        usuario_id: user?.id || null,
        equipe_id: user?.equipe_id || null,
        ip_address: ipAddress
      }
      
      console.log('Enviando payload de proxy:', payload)
      
      const res = await fetch('https://webhook.sistemavieira.com.br/webhook/mudar-proxy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      console.log('Resposta:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Erro da API:', errorText)
        throw new Error(`Erro ao atualizar proxy: ${res.status}`)
      }
      
      // Atualiza localmente
      const updatedSites = sites.map(site => 
        site.id === selectedSiteForProxy.id 
          ? { ...site, proxy: proxyValue }
          : site
      )
      setSites(updatedSites)
      
      notify.success('Proxy atualizado com sucesso!')
      handleCloseProxyModal()
    } catch (e) {
      console.error('Erro ao atualizar proxy:', e)
      notify.error('Falha ao atualizar proxy')
    } finally {
      setIsSavingProxy(false)
    }
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
    const filteredSites = (sites || []).filter(site => {
      if (q) {
        const searchText = `${site.razao_social || ''} ${site.cnpj || ''}`.toLowerCase()
        if (!searchText.includes(q)) return false
      }
      return true
    })
    
    // Remover duplicados por CNPJ (mantém o mais recente)
    const uniqueSites = []
    const seenCNPJs = new Set()
    
    // Ordenar primeiro por data de criação (mais recente primeiro)
    const sortedByDate = filteredSites.sort((a, b) => {
      const dateA = new Date(a.created_at || 0)
      const dateB = new Date(b.created_at || 0)
      return dateB - dateA // Ordem decrescente (mais recente primeiro)
    })
    
    // Filtrar duplicados mantendo apenas o primeiro (mais recente) de cada CNPJ
    for (const site of sortedByDate) {
      if (!seenCNPJs.has(site.cnpj)) {
        seenCNPJs.add(site.cnpj)
        uniqueSites.push(site)
      }
    }
    
    return uniqueSites
  }, [sites, search])
  
  // Total de sites únicos (sem filtro de busca, apenas sem duplicados)
  const totalUniqueSites = useMemo(() => {
    const allSites = sites || []
    const uniqueSites = []
    const seenCNPJs = new Set()
    
    // Ordenar por data de criação (mais recente primeiro)
    const sortedByDate = allSites.sort((a, b) => {
      const dateA = new Date(a.created_at || 0)
      const dateB = new Date(b.created_at || 0)
      return dateB - dateA
    })
    
    // Filtrar duplicados
    for (const site of sortedByDate) {
      if (!seenCNPJs.has(site.cnpj)) {
        seenCNPJs.add(site.cnpj)
        uniqueSites.push(site)
      }
    }
    
    return uniqueSites.length
  }, [sites])
  
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
    const aguardando = filtered.filter(s => !s.status || s.status === 'Sem Status').length
    const pendentes = filtered.filter(s => [
      'Aguardando Pagamento',
      'Aguardando BM',
      'Aguardando Criação BM',
      'Aguardando Criação Site',
      'Em Analise'
    ].includes(s.status)).length
    const concluidos = filtered.filter(s => s.status === 'Verificado').length
    const encerrados = filtered.filter(s => ['Não Verificado', 'Banido'].includes(s.status)).length
    
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
      }).length,
      aguardando,
      pendentes,
      concluidos,
      encerrados
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
              className="btn btn-outline-light btn-sm d-flex align-items-cgap-2" 
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
        <div className="row g-2 mb-2">
          <div className="col-lg-4 col-md-4">
            <StatCard title="Total de Sites" value={stats.total} icon={Fi.FiGlobe} accent="primary" />
          </div>
          <div className="col-lg-4 col-md-4">
            <StatCard title="Gerados Hoje" value={stats.hoje} icon={Fi.FiCalendar} accent="success" />
          </div>
          <div className="col-lg-4 col-md-4">
            <StatCard title="Última Semana" value={stats.semana} icon={Fi.FiTrendingUp} accent="info" />
          </div>
        </div>
        
        {/* Status Cards */}
        <div className="row g-2 mb-3">
          <div className="col-lg-3 col-md-3">
            <StatCard title="Aguardando" value={stats.aguardando} icon={Fi.FiClock} accent="secondary" />
          </div>
          <div className="col-lg-3 col-md-3">
            <StatCard title="Pendentes" value={stats.pendentes} icon={Fi.FiAlertCircle} accent="warning" />
          </div>
          <div className="col-lg-3 col-md-3">
            <StatCard title="Concluídos" value={stats.concluidos} icon={Fi.FiCheckCircle} accent="success" />
          </div>
          <div className="col-lg-3 col-md-3">
            <StatCard title="Encerrados" value={stats.encerrados} icon={Fi.FiXCircle} accent="danger" />
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
          <small>Mostrando {filtered.length} de {totalUniqueSites} sites</small>
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
            <div className={`table-responsive ${isPageAnimating ? 'page-fade' : ''}`} style={{overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch'}}>
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
                    <th className="text-center" style={{width:150}}>Criado em</th>
                    <th className="text-center">Razão Social</th>
                    <th className="text-center" style={{width:120}}>Status</th>
                    <th className="text-center" style={{width:90}}>Telefones</th>
                    <th className="text-center" style={{width:120}}>Proxy Name</th>
                    <th className="text-center">Meta Tag</th>
                    <th className="text-center" style={{width:120}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center opacity-75 p-4">
                        Nenhuma página criada
                      </td>
                    </tr>
                  )}
                  {paginated.map((site) => {
                    const telefonesDisplay = getTelefonesDisplay(site)
                    return (
                    <tr key={site.id}>
                      <td className="text-center">
                        <small className="text-light">{formatDateTime(site.created_at)}</small>
                      </td>
                      <td className="text-uppercase">{site.razao_social}</td>
                      <td className="text-center">
                        <button
                          className={`badge ${getStatusBadgeClass(site.status || 'Sem Status')} border-0`}
                          style={{cursor: 'pointer'}}
                          onClick={() => handleOpenStatusModal(site)}
                        >
                          {site.status || 'Sem Status'}
                        </button>
                      </td>
                      <td className="text-center">
                        <span className="fw-bold text-light">
                          {telefonesDisplay}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-link text-decoration-none p-0"
                          style={{cursor: 'pointer'}}
                          onClick={() => handleOpenProxyModal(site)}
                        >
                          {site.proxy && site.proxy !== 'Não Informado' ? (
                            <span className="small text-light">{site.proxy}</span>
                          ) : (
                            <span className="small text-warning d-inline-flex align-items-center gap-1 px-2 py-1">
                              <Fi.FiAlertCircle size={14} />
                              Não Informado
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                          onClick={() => handleCopyMetaTag(site.meta_tag)}
                          disabled={!site.meta_tag}
                          title={site.meta_tag || 'Sem meta tag'}
                        >
                          <Fi.FiCopy size={14} />
                          Copiar
                        </button>
                      </td>
                      <td>
                        <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                          <button
                            className="btn btn-primary btn-sm d-inline-flex align-items-center justify-content-center rounded-circle"
                            style={{width: 32, height: 32, padding: 0, minWidth: 32}}
                            title="Alterar"
                            aria-label="Alterar"
                            onClick={() => handleOpenEdit(site)}
                          >
                            <Fi.FiEdit2 size={16} />
                          </button>
                          <button
                            className="btn btn-success btn-sm d-inline-flex align-items-center justify-content-center rounded-circle"
                            style={{width: 32, height: 32, padding: 0, minWidth: 32}}
                            title="Download HTML"
                            aria-label="Download HTML"
                            onClick={() => handleDownloadHTML(site)}
                            disabled={!site.html_content}
                          >
                            <Fi.FiDownload size={16} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm d-inline-flex align-items-center justify-content-center rounded-circle"
                            style={{width: 32, height: 32, padding: 0, minWidth: 32}}
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Upload em Lote */}
      {showBatchUpload && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2 p-md-3" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
        >
          <div className="modal-dark p-3 p-md-4" style={{maxWidth:600, width:'100%', maxHeight:'90vh', overflowY:'auto'}}>
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
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2 p-md-3" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
          onClick={handleCloseDeleteConfirm}
        >
          <div 
            className="bg-white rounded-3 p-3 p-md-4" 
            style={{maxWidth:500, width:'100%'}}
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

      {/* Modal de Alteração de Status */}
      {showStatusModal && selectedSiteForStatus && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2 p-md-3" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
          onClick={handleCloseStatusModal}
        >
          <div 
            className="bg-white rounded-3 p-3 p-md-4" 
            style={{maxWidth:500, width:'100%'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="mb-0 text-dark fw-bold">Alterar Status</h5>
              <button 
                type="button"
                className="btn-close" 
                onClick={handleCloseStatusModal} 
                aria-label="Fechar"
              />
            </div>
            
            <p className="text-dark mb-3">
              Alterar status de <strong className="text-uppercase">{selectedSiteForStatus.razao_social}</strong>
            </p>
            
            <div className="mb-4">
              <label className="form-label text-dark fw-semibold">Selecione o novo status:</label>
              <select 
                className="form-select" 
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="Sem Status">Sem Status</option>
                <option value="Aguardando Pagamento">Aguardando Pagamento</option>
                <option value="Aguardando BM">Aguardando BM</option>
                <option value="Aguardando Criação BM">Aguardando Criação BM</option>
                <option value="Aguardando Criação Site">Aguardando Criação Site</option>
                <option value="Em Analise">Em Analise</option>
                <option value="Verificado">Verificado</option>
                <option value="Não Verificado">Não Verificado</option>
                <option value="Banido">Banido</option>
              </select>
            </div>
            
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2">
                <span className="text-dark small">Preview:</span>
                <span className={`badge ${getStatusBadgeClass(newStatus)}`}>
                  {newStatus}
                </span>
              </div>
            </div>
            
            <div className="d-flex justify-content-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCloseStatusModal}
                disabled={isSavingStatus}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveStatus}
                disabled={isSavingStatus}
              >
                {isSavingStatus ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alteração de Proxy */}
      {showProxyModal && selectedSiteForProxy && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2 p-md-3" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050}}
          onClick={handleCloseProxyModal}
        >
          <div 
            className="bg-white rounded-3 p-3 p-md-4" 
            style={{maxWidth:500, width:'100%'}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="mb-0 text-dark fw-bold">Alterar Proxy</h5>
              <button 
                type="button"
                className="btn-close" 
                onClick={handleCloseProxyModal} 
                aria-label="Fechar"
              />
            </div>
            
            <p className="text-dark mb-3">
              Alterar proxy de <strong className="text-uppercase">{selectedSiteForProxy.razao_social}</strong>
            </p>
            
            <div className="mb-4">
              <label className="form-label text-dark fw-semibold">Digite o nome do proxy:</label>
              <input
                type="text"
                className="form-control"
                value={newProxy}
                onChange={(e) => setNewProxy(e.target.value)}
                placeholder="Digite o nome do proxy no Dolphin"
                autoFocus
              />
              <small className="text-muted">Deixe em branco para marcar como \"Não Informado\"</small>
            </div>
            
            <div className="d-flex justify-content-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCloseProxyModal}
                disabled={isSavingProxy}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveProxy}
                disabled={isSavingProxy}
              >
                {isSavingProxy ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEdit && selectedSite && (
        <div 
          className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2 p-md-3" 
          style={{background:'rgba(0,0,0,0.7)', zIndex:1050, overflowY:'auto'}}
        >
          <div className="modal-dark p-3 p-md-4 my-3" style={{maxWidth:680, width:'100%', maxHeight:'95vh', overflowY:'auto'}}>
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
            
            {/* Abas do Modal */}
            <div className="d-flex border-bottom mb-3" style={{borderColor: 'rgba(255,255,255,0.15)'}}>
              <button
                type="button"
                className={`btn btn-link text-decoration-none px-2 px-md-4 py-2 flex-grow-1 ${
                  editModalTab === 'cadastro' ? 'text-primary border-bottom border-primary border-3' : 'text-light opacity-75'
                }`}
                onClick={() => setEditModalTab('cadastro')}
                style={{borderRadius: 0, fontSize: 'clamp(0.85rem, 2vw, 1rem)'}}
              >
                <Fi.FiDatabase size={16} className="me-1 me-md-2" />
                <span className="d-none d-sm-inline">Cadastro</span>
                <span className="d-inline d-sm-none">Info</span>
              </button>
              <button
                type="button"
                className={`btn btn-link text-decoration-none px-2 px-md-4 py-2 flex-grow-1 ${
                  editModalTab === 'limites' ? 'text-primary border-bottom border-primary border-3' : 'text-light opacity-75'
                }`}
                onClick={() => setEditModalTab('limites')}
                style={{borderRadius: 0, fontSize: 'clamp(0.85rem, 2vw, 1rem)'}}
              >
                <Fi.FiCreditCard size={16} className="me-1 me-md-2" />
                <span className="d-none d-sm-inline">Limites & Contas</span>
                <span className="d-inline d-sm-none">Limites</span>
              </button>
            </div>
            
            <form onSubmit={handleEdit}>
              {/* Aba Cadastro */}
              {editModalTab === 'cadastro' && (
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Razão Social *</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      value={editRazaoSocial}
                      onChange={e => setEditRazaoSocial(e.target.value)}
                      placeholder="Digite a razão social da empresa"
                      required
                      readOnly
                      style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed'}}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleCopyText(editRazaoSocial, 'Razão Social')}
                      title="Copiar Razão Social"
                    >
                      <Fi.FiCopy size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="col-12 col-md-6">
                  <label className="form-label">CNPJ *</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      value={editCnpj}
                      onChange={e => setEditCnpj(formatCNPJ(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      required
                      readOnly
                      style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed'}}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleCopyText(editCnpj.replace(/\D/g, ''), 'CNPJ')}
                      title="Copiar CNPJ"
                    >
                      <Fi.FiCopy size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="col-12 col-md-6">
                  <label className="form-label">WhatsApp *</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      value={editWhatsapp}
                      onChange={e => setEditWhatsapp(formatWhatsApp(e.target.value))}
                      placeholder="+55 (00) 00000-0000"
                      maxLength={20}
                      required
                      readOnly
                      style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed'}}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleCopyText(editWhatsapp.replace(/\D/g, ''), 'WhatsApp')}
                      title="Copiar WhatsApp"
                    >
                      <Fi.FiCopy size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="col-12">
                  <label className="form-label">Endereço *</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      value={editEndereco}
                      onChange={e => setEditEndereco(e.target.value)}
                      placeholder="Digite o endereço completo"
                      required
                      readOnly
                      style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed'}}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleCopyText(editEndereco, 'Endereço')}
                      title="Copiar Endereço"
                    >
                      <Fi.FiCopy size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="col-12">
                  <label className="form-label">E-mail *</label>
                  <div className="input-group">
                    <input
                      type="email"
                      className="form-control"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      placeholder="contato@empresa.com.br"
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => handleCopyText(editEmail, 'E-mail')}
                      title="Copiar E-mail"
                    >
                      <Fi.FiCopy size={16} />
                    </button>
                  </div>
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
                
                <div className="col-12 col-md-6">
                  <label className="form-label">Proxy (nome no Dolphin)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editProxy}
                    onChange={e => setEditProxy(e.target.value)}
                    placeholder="Digite o nome do proxy no Dolphin"
                  />
                </div>
                
                <div className="col-12 col-md-6">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                  >
                    <option value="Sem Status">Sem Status</option>
                    <option value="Aguardando Pagamento">Aguardando Pagamento</option>
                    <option value="Aguardando BM">Aguardando BM</option>
                    <option value="Aguardando Criação BM">Aguardando Criação BM</option>
                    <option value="Aguardando Criação Site">Aguardando Criação Site</option>
                    <option value="Em Analise">Em Analise</option>
                    <option value="Verificado">Verificado</option>
                    <option value="Não Verificado">Não Verificado</option>
                    <option value="Banido">Banido</option>
                  </select>
                </div>
              </div>
              )}
              
              {/* Aba Limites & Contas */}
              {editModalTab === 'limites' && (
              <div className="row g-3">
                {/* Contador de Chips */}
                <div className="col-12">
                  <div className="row g-2">
                    <div className="col-6 col-md-3">
                      <div className="neo-card p-2" style={{backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)'}}>
                        <div className="small opacity-75 mb-1">Números</div>
                        <div className="h5 mb-0 fw-bold text-primary">{getChipsStats().total}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="neo-card p-2" style={{backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)'}}>
                        <div className="small opacity-75 mb-1">Status OK</div>
                        <div className="h5 mb-0 fw-bold text-success">{getChipsStats().ok}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="neo-card p-2" style={{backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)'}}>
                        <div className="small opacity-75 mb-1">Status Banido</div>
                        <div className="h5 mb-0 fw-bold text-danger">{getChipsStats().banido}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="neo-card p-2" style={{backgroundColor: 'rgba(148, 163, 184, 0.1)', borderColor: 'rgba(148, 163, 184, 0.3)'}}>
                        <div className="small opacity-75 mb-1">Sem Status</div>
                        <div className="h5 mb-0 fw-bold" style={{color: 'rgba(148, 163, 184, 0.9)'}}>{getChipsStats().semStatus}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="col-12">
                  <h6 className="mb-3">Limites & Chips</h6>
                </div>
                
                <div className="col-12">
                  <label className="form-label">Selecionar Limite</label>
                  <select 
                    className="form-select"
                    value={selectedLimit}
                    onChange={e => setSelectedLimit(e.target.value)}
                  >
                    <option value="">Escolha um limite...</option>
                    <option value="250">250</option>
                    <option value="2000">2.000</option>
                    <option value="10000">10.000</option>
                    <option value="100000">100.000</option>
                    <option value="ilimitado">Ilimitado</option>
                  </select>
                </div>
                
                {selectedLimit === '250' && (
                  <>
                    <div className="col-12">
                      <div className="alert alert-info d-flex align-items-center gap-2">
                        <Fi.FiInfo size={18} />
                        <span>Até 2 Chips</span>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 1 (WhatsApp Cadastrado)</label>
                      <div className="row g-2">
                        <div className="col-md-8">
                          <input
                            type="text"
                            className="form-control"
                            value={editWhatsapp}
                            readOnly
                            style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed'}}
                          />
                        </div>
                        <div className="col-md-4">
                          <select className="form-select" defaultValue="Ok">
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 2 (Novo WhatsApp)</label>
                      <div className="row g-2">
                        <div className="col-md-7">
                          <input
                            type="text"
                            className="form-control"
                            value={chip2Whatsapp}
                            onChange={e => setChip2Whatsapp(formatWhatsApp(e.target.value))}
                            placeholder="+55 (00) 00000-0000"
                            maxLength={20}
                          />
                        </div>
                        <div className="col-md-3">
                          <select 
                            className="form-select"
                            value={chip2Status}
                            onChange={e => setChip2Status(e.target.value)}
                          >
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                        <div className="col-md-2">
                          <button
                            type="button"
                            className="btn btn-outline-danger w-100"
                            onClick={() => handleDeleteChip(chip2Id, chip2Whatsapp)}
                            disabled={!chip2Whatsapp || !chip2Id}
                            title="Excluir chip"
                          >
                            <Fi.FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {selectedLimit === '2000' && (
                  <>
                    <div className="col-12">
                      <div className="alert alert-info d-flex align-items-center gap-2">
                        <Fi.FiInfo size={18} />
                        <span>Até 5 Chips</span>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 1 (WhatsApp Cadastrado)</label>
                      <div className="row g-2">
                        <div className="col-md-8">
                          <input
                            type="text"
                            className="form-control"
                            value={editWhatsapp}
                            readOnly
                            style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed'}}
                          />
                        </div>
                        <div className="col-md-4">
                          <select className="form-select" defaultValue="Ok">
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 2 (Novo WhatsApp)</label>
                      <div className="row g-2">
                        <div className="col-md-7">
                          <input
                            type="text"
                            className="form-control"
                            value={chip2Whatsapp}
                            onChange={e => setChip2Whatsapp(formatWhatsApp(e.target.value))}
                            placeholder="+55 (00) 00000-0000"
                            maxLength={20}
                          />
                        </div>
                        <div className="col-md-3">
                          <select 
                            className="form-select"
                            value={chip2Status}
                            onChange={e => setChip2Status(e.target.value)}
                          >
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                        <div className="col-md-2">
                          <button
                            type="button"
                            className="btn btn-outline-danger w-100"
                            onClick={() => handleDeleteChip(chip2Id, chip2Whatsapp)}
                            disabled={!chip2Whatsapp || !chip2Id}
                            title="Excluir chip"
                          >
                            <Fi.FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 3 (Novo WhatsApp)</label>
                      <div className="row g-2">
                        <div className="col-md-7">
                          <input
                            type="text"
                            className="form-control"
                            value={chip3Whatsapp}
                            onChange={e => setChip3Whatsapp(formatWhatsApp(e.target.value))}
                            placeholder="+55 (00) 00000-0000"
                            maxLength={20}
                          />
                        </div>
                        <div className="col-md-3">
                          <select 
                            className="form-select"
                            value={chip3Status}
                            onChange={e => setChip3Status(e.target.value)}
                          >
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                        <div className="col-md-2">
                          <button
                            type="button"
                            className="btn btn-outline-danger w-100"
                            onClick={() => handleDeleteChip(chip3Id, chip3Whatsapp)}
                            disabled={!chip3Whatsapp || !chip3Id}
                            title="Excluir chip"
                          >
                            <Fi.FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 4 (Novo WhatsApp)</label>
                      <div className="row g-2">
                        <div className="col-md-7">
                          <input
                            type="text"
                            className="form-control"
                            value={chip4Whatsapp}
                            onChange={e => setChip4Whatsapp(formatWhatsApp(e.target.value))}
                            placeholder="+55 (00) 00000-0000"
                            maxLength={20}
                          />
                        </div>
                        <div className="col-md-3">
                          <select 
                            className="form-select"
                            value={chip4Status}
                            onChange={e => setChip4Status(e.target.value)}
                          >
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                        <div className="col-md-2">
                          <button
                            type="button"
                            className="btn btn-outline-danger w-100"
                            onClick={() => handleDeleteChip(chip4Id, chip4Whatsapp)}
                            disabled={!chip4Whatsapp || !chip4Id}
                            title="Excluir chip"
                          >
                            <Fi.FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 5 (Novo WhatsApp)</label>
                      <div className="row g-2">
                        <div className="col-md-7">
                          <input
                            type="text"
                            className="form-control"
                            value={chip5Whatsapp}
                            onChange={e => setChip5Whatsapp(formatWhatsApp(e.target.value))}
                            placeholder="+55 (00) 00000-0000"
                            maxLength={20}
                          />
                        </div>
                        <div className="col-md-3">
                          <select 
                            className="form-select"
                            value={chip5Status}
                            onChange={e => setChip5Status(e.target.value)}
                          >
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                        <div className="col-md-2">
                          <button
                            type="button"
                            className="btn btn-outline-danger w-100"
                            onClick={() => handleDeleteChip(chip5Id, chip5Whatsapp)}
                            disabled={!chip5Whatsapp || !chip5Id}
                            title="Excluir chip"
                          >
                            <Fi.FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {(selectedLimit === '10000' || selectedLimit === '100000' || selectedLimit === 'ilimitado') && (
                  <>
                    <div className="col-12">
                      <div className="alert alert-info d-flex align-items-center gap-2">
                        <Fi.FiInfo size={18} />
                        <span>Adicione quantos chips quiser</span>
                      </div>
                    </div>
                    
                    <div className="col-12">
                      <label className="form-label">Chip 1 (WhatsApp Cadastrado)</label>
                      <div className="row g-2">
                        <div className="col-md-8">
                          <input
                            type="text"
                            className="form-control"
                            value={editWhatsapp}
                            readOnly
                            style={{backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed'}}
                          />
                        </div>
                        <div className="col-md-4">
                          <select className="form-select" defaultValue="Ok">
                            <option value="Ok">Ok</option>
                            <option value="Banido">Banido</option>
                            <option value="Sem Status">Sem Status</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    {additionalChips.map((chip, index) => (
                      <div key={index} className="col-12">
                        <label className="form-label">Chip {index + 2} (Novo WhatsApp)</label>
                        <div className="row g-2">
                          <div className="col-md-8">
                            <div className="input-group">
                              <input
                                type="text"
                                className="form-control"
                                value={chip.whatsapp}
                                onChange={e => handleUpdateChip(index, e.target.value)}
                                placeholder="+55 (00) 00000-0000"
                                maxLength={20}
                              />
                              <button
                                type="button"
                                className="btn btn-outline-danger"
                                onClick={() => handleRemoveChip(index)}
                                title="Remover chip"
                              >
                                <Fi.FiTrash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <select 
                              className="form-select"
                              value={chip.status}
                              onChange={e => handleUpdateChipStatus(index, e.target.value)}
                            >
                              <option value="Ok">Ok</option>
                              <option value="Banido">Banido</option>
                              <option value="Sem Status">Sem Status</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="col-12">
                      <button
                        type="button"
                        className="btn btn-outline-success d-flex align-items-center gap-2"
                        onClick={handleAddChip}
                      >
                        <Fi.FiPlus size={16} />
                        Adicionar Chip
                      </button>
                    </div>
                  </>
                )}
              </div>
              )}
              
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={handleCloseEdit}
                  disabled={isEditing}
                >
                  Cancelar
                </button>
                
                {editModalTab === 'cadastro' && (
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
                )}
                
                {editModalTab === 'limites' && (
                  <button 
                    type="button" 
                    className="btn btn-success d-flex align-items-center gap-2" 
                    onClick={handleSaveLimitesChips}
                    disabled={isEditing}
                  >
                    {isEditing ? (
                      <>
                        <Fi.FiLoader className="spinner-border spinner-border-sm" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Fi.FiSave />
                        Salvar
                      </>
                    )}
                  </button>
                )}
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
                  <label className="form-label">WhatsApp</label>
                  <input
                    className="form-control"
                    value={whatsapp}
                    onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
                    placeholder="+55 (00) 00000-0000"
                    maxLength={20}
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">Endereço</label>
                  <input
                    className="form-control"
                    value={endereco}
                    onChange={e => setEndereco(e.target.value)}
                    placeholder="Digite o endereço completo"
                  />
                </div>
                
                <div className="col-12">
                  <label className="form-label">E-mail</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
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
                
                <div className="col-12">
                  <label className="form-label">Proxy (nome no Dolphin)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={proxy}
                    onChange={e => setProxy(e.target.value)}
                    placeholder="Digite o nome do proxy no Dolphin"
                  />
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
