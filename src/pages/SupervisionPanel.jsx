import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'

export default function SupervisionPanel() {
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Link to="/dashboard" className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <FiArrowLeft size={16} />
            <span className="d-none d-sm-inline">Voltar</span>
          </Link>
          <div>
            <h2 className="fw-bold mb-3">Supervisão</h2>
          </div>
        </div>
        <div className="row g-3 mb-4">
          <div className="col-md-6 col-lg-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Usuários</h5>
              <p className="mb-0 opacity-85">Gerencie perfis. Supervisor vê apenas sua própria equipe.</p>
            </div>
          </div>
          <div className="col-md-6 col-lg-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Equipes</h5>
              <p className="mb-0 opacity-85">Estruture e visualize sua equipe.</p>
            </div>
          </div>
          <div className="col-md-6 col-lg-4">
            <Link
              to="/fila-milvus"
              className="neo-card neo-lg p-5 h-100 d-block text-reset text-decoration-none"
            >
              <div className="d-flex align-items-center gap-3 mb-2">
                <img
                  src="https://carreira.inhire.com.br/wp-content/uploads/2025/10/logo_Logo-Milvus-1.png"
                  alt="Milvus"
                  width="40"
                  height="40"
                  className="rounded flex-shrink-0"
                  style={{ objectFit: 'contain' }}
                />
                <h5 className="mb-0">Fila Milvus</h5>
              </div>
              <p className="mb-0 opacity-85">
                Acompanhe o andamento do seu chamado diretamente na fila de atendimento do Milvus e saiba quando sera
                respondido.
              </p>
            </Link>
          </div>
        </div>
        
      </main>
      <Footer />
    </div>
  )
}

