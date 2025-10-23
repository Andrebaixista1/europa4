import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Calendar, Rocket } from 'lucide-react'
import '../styles/novidades-modal.css'

export const novidadesList = [
  {
    data: '23/10/2025',
    titulo: 'Gestão de usuários expandida',
    descricao:
      'Supervisores e Administradores agora podem adicionar novos usuários diretamente em suas equipes, facilitando o gerenciamento de membros.',
  },
  {
    data: '23/10/2025',
    titulo: 'Fim do Nova Europa 3.8',
    descricao:
      'O Europa 3.8 será descontinuado. Todas as equipes devem migrar para o Europa 4.0 o quanto antes para continuar usufruindo dos benefícios do sistema. Essa migração será feita a partir de Janeiro de 2026.',
  },
  {
    data: '21/10/2025',
    titulo: 'Correção no acompanhamento de disparos',
    descricao: 'Removido erro que aparecia quando não havia campanhas disponíveis.',
  },
  {
    data: '14/10/2025',
    titulo: 'Gestão de saldos e recargas',
    descricao: 'Adicionado novo card para gestão de saldos e recargas.',
  },
  {
    data: '14/10/2025',
    titulo: 'Cards inteligentes',
    descricao: 'Cards alinhados com a sua hierarquia para exibir apenas o que é relevante.',
  },
  {
    data: '14/10/2025',
    titulo: 'Sistema de hierarquias',
    descricao: 'Cada usuário conta com níveis de acesso personalizados.',
  },
  {
    data: '06/10/2025',
    titulo: 'Estrutura de autenticação renovada',
    descricao: 'Login redesenhado com foco em segurança e performance.',
  },
  {
    data: '06/10/2025',
    titulo: 'Dashboard Master atualizado',
    descricao: 'Interface aprimorada com novos controles e funções.',
  },
  {
    data: '06/10/2025',
    titulo: 'Correções de bugs',
    descricao: 'Diversos ajustes para manter o sistema estável.',
  },
]

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
