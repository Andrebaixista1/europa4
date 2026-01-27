import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Calendar, Rocket } from 'lucide-react'
import '../styles/novidades-modal.css'

const novidadesListRaw = [
  {
    data: '27/01/2026',
    titulo: 'Abas na Consulta Macica',
    descricao:
      'Os cards principais da Consulta Macica agora viraram abas: Margens do Cliente, Emprestimos Macica e Historico IN100, com transicao suave entre os paines.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
  },
  {
    data: '26/01/2026',
    titulo: 'Consulta Maciça disponível',
    descricao:
      'Nova página de Consulta Maciça para visualizar dados do cliente, propostas, endereços e histórico IN100 com paginação e atualização rápida.',
    image: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=1600&q=80',
  },
  {
    data: '19/01/2026',
    titulo: 'Consulta IN100 BMG liberada',
    descricao:
      'Agora ja e possivel consultar IN100 pelo BMG com informacoes adicionais do cliente. Para receber o token com mais facilidade, use um telefone proximo de voce.',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS97AcZMfvJCYV7XD9jPurcnuo_xYVK6IElXA&s',
    disabled: true,
  },
  {
    data: '17/01/2026',
    titulo: 'Historico IN100 com Verificar',
    descricao:
      'Mesmo que voce saia da pagina ou atualize, acesse Consultas > Historico e clique no icone de Verificar para ver a consulta do cliente em tempo real.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '14/01/2026',
    titulo: 'Downloads de campanhas em CSV',
    descricao:
      'Novo modal de downloads com exportacao unica para todas as campanhas do periodo ou apenas as selecionadas.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '14/01/2026',
    titulo: 'Filtro de empresa nas campanhas',
    descricao:
      'Adicionamos o filtro de Empresa (Vieiracred, Prado e Sem empresa definida) para refinar campanhas por departamento.',
    image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '14/01/2026',
    titulo: 'Campanhas Zap com periodo automatico',
    descricao:
      'Ao abrir Campanhas Zap, o sistema busca automaticamente campanhas dos ultimos 15 dias (startDate e endDate).',
    image: 'https://images.unsplash.com/photo-1556740714-a8395b3bf30f?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '14/01/2026',
    titulo: 'Menu Business Manager simplificado',
    descricao:
      'Renomeamos o menu para Business Manager e deixamos somente o acesso a Campanhas Zap no dropdown.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '05/12/2025',
    titulo: 'Sidebar global e menus agrupados',
    descricao:
      'Nova barra lateral fixa com dropdowns para Consultas, Operações, Gestão e Configurações. Adicionamos “Gestão” com recargas e controle de planejamento e simplificamos o acesso a Usuários/Equipes.',
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '13/11/2025',
    titulo: 'Cards no Gerador de Sites e Status BM',
    descricao:
      'Adicionamos cards de contagem no Gerador de Sites (Empresa ok/x, BM Vinculada e Dolphin) e deixamos o modal de Dados da Empresa no Status BM apenas para visualização, simplificando a checagem rápida.',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '06/11/2025',
    titulo: 'Gerador e Controle de Sites',
    descricao:
      'Sistema completo de geração de sites com modais de status e proxy, cards de estatísticas (Aguardando, Pendentes, Concluídos, Encerrados), botões de copiar campos, upload em lote via CSV e controle total de cadastros.',
    image: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1600&q=80'
  },
  {
    data: '28/10/2025',
    titulo: 'Histórico de Consultas (IN100)',
    descricao:
      'Novo card para visualizar o histórico de consultas IN100 da equipe, com paginação, status (badge com tooltip), máscaras em CPF/NB e exportação CSV.',
  },
  {
    data: '27/10/2025',
    titulo: 'Consulta clientes IN100',
    descricao:
      'Em consulta IN100 você consegue descobrir o CPF e/ou NB do cliente sem precisar informar os dois campos.',
  },
  {
    data: '27/10/2025',
    titulo: 'Usuários Vanguard Real-Time',
    descricao:
      'Agora o controle de usuários no Vanguard é real-time conectado e 100% atualizado.',
  },
]

export const novidadesList = novidadesListRaw.filter((novidade) => !novidade.disabled)

const overlayTransition = { duration: 0.2 }
const modalTransition = { type: 'spring', stiffness: 280, damping: 24 }

function NovidadesModal({ isOpen, onClose }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="novidades-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={overlayTransition}
          onClick={onClose}
        >
          <motion.div
            className="novidades-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={modalTransition}
            onClick={event => event.stopPropagation()}
          >
            <header className="novidades-header">
              <div className="novidades-header-icon sparkle-pulse">
                <Sparkles size={24} />
              </div>
              <h2>Novidades</h2>
              <p>Fique por dentro das últimas atualizações da plataforma.</p>
              <button
                type="button"
                className="novidades-close"
                aria-label="Fechar modal de novidades"
                onClick={onClose}
              >
                <X size={20} />
              </button>
            </header>

            <div className="novidades-body">
              <div>
                {novidadesList.map((novidade, index) => (
                  <motion.div
                    key={`${novidade.titulo}-${novidade.data}-${index}`}
                    className="novidades-item"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 + 0.05 }}
                  >
                    <div className="novidades-item-meta">
                      <Calendar size={16} />
                      <span>{novidade.data}</span>
                    </div>
                    <h3 className="novidades-item-title">{novidade.titulo}</h3>
                    <p className="novidades-item-description">{novidade.descricao}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <footer className="novidades-footer">
              Mais novidades em breve! <Rocket size={14} className="icon-rocket" />
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default NovidadesModal
