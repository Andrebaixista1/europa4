import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Calendar } from 'lucide-react';

interface NovidadesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NovidadesModal: React.FC<NovidadesModalProps> = ({ isOpen, onClose }) => {
  const novidades = [
    {
      data: "06/10",
      titulo: "Nova versão do Europa chegando!",
      descricao: "Uma nova versão do Europa vem por aí, a versão 4.0 vem com um novo design, novas funções, sistema hierárquico e muito mais!"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Sparkles size={24} className="animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold">Novidades</h2>
                </div>
                <p className="text-blue-100 text-sm">
                  Fique por dentro das últimas atualizações do Europa
                </p>
                
                {/* Botão Fechar */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Conteúdo */}
              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  {novidades.map((novidade, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={16} className="text-blue-600" />
                        <span className="text-sm font-semibold text-blue-700">
                          {novidade.data}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-2">
                        {novidade.titulo}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {novidade.descricao}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Rodapé */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 text-center">
                    Mais novidades em breve! 🚀
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NovidadesModal;