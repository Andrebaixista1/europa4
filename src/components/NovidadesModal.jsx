import React from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiStar, FiCheckCircle } from 'react-icons/fi';

const NovidadesModal = ({ isOpen, onClose }) => {
  const novidades = [
    {
      titulo: "Cards Inteligentes",
      descricao: "Cards que pertencem a sua hierarquia, você só vê o que é relevante.",
      data: "14/10/2025",
      tipo: "novo"
    },
    {
      titulo: "Sistema de hierarquias de usuarios",
      descricao: "Cada usuario tem sua própria hierarquia de acesso.",
      data: "14/10/2025",
      tipo: "melhoria"
    },
    {
      titulo: "🎉 Nova Estrutura de Autenticação",
      descricao: "Sistema de login completamente renovado com melhor segurança e performance.",
      data: "06/10/2025",
      tipo: "novo"
    },
    {
      titulo: "🚀 Dashboard Master Atualizado", 
      descricao: "Interface aprimorada para usuários Master com novos controles e funcionalidades.",
      data: "06/10/2025",
      tipo: "melhoria"
    },
    {
      titulo: "🔧 Correção de Bugs",
      descricao: "Diversos problemas corrigidos para melhor estabilidade do sistema.",
      data: "06/10/2025", 
      tipo: "correcao"
    }
  ];

  return (
    <>
      {isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4"
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.6)', 
              zIndex: 2147483647,
              backdropFilter: 'blur(2px)'
            }}
            onClick={onClose}
          >
            {/* Modal */}
            <div
              className="bg-white rounded-3 shadow-lg position-relative"
              style={{ 
                maxWidth: '600px', 
                width: '100%', 
                maxHeight: '80vh', 
                overflow: 'hidden',
                zIndex: 10000,
                animation: 'modalFadeIn 0.3s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-primary text-white p-4">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <FiStar size={24} />
                    <h2 className="h4 mb-0 fw-bold">Novidades do Sistema</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="btn btn-link text-white p-2"
                    style={{ textDecoration: 'none' }}
                  >
                    <FiX size={20} />
                  </button>
                </div>
                <p className="text-white-50 mt-2 mb-0">Confira as últimas atualizações e melhorias</p>
              </div>

              {/* Content */}
              <div className="p-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <div className="d-flex flex-column gap-3">
                  {novidades.map((novidade, index) => (
                    <div
                      key={index}
                      className="border rounded p-3"
                      style={{ 
                        transition: 'box-shadow 0.2s',
                        cursor: 'default'
                      }}
                      onMouseEnter={(e) => e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                      onMouseLeave={(e) => e.target.style.boxShadow = 'none'}
                    >
                      <div className="d-flex align-items-start gap-3">
                        <div className={`mt-1 p-1 rounded-circle ${
                          novidade.tipo === 'novo' ? 'bg-success-subtle text-success' :
                          novidade.tipo === 'melhoria' ? 'bg-primary-subtle text-primary' :
                          'bg-warning-subtle text-warning'
                        }`}>
                          <FiCheckCircle size={16} />
                        </div>
                        <div className="flex-grow-1">
                          <h3 className="h6 fw-semibold text-dark mb-1">
                            {novidade.titulo}
                          </h3>
                          <p className="text-muted small mb-2">
                            {novidade.descricao}
                          </p>
                          <span className="badge bg-light text-dark">
                            {novidade.data}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-light p-3 text-center">
                <p className="text-muted small mb-0">
                  © 2025 Nova Europa 4 - Desenvolvido por André Felipe
                </p>
              </div>
            </div>
          </div>
          
          {/* CSS para animação */}
          <style>{`
            @keyframes modalFadeIn {
              from {
                opacity: 0;
                transform: scale(0.9) translateY(-20px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>
        </>,
        document.body
      )}
    </>
  );
};

export default NovidadesModal;
