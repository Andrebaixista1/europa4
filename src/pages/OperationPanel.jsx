import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import cardsData from '../data/cards.json'
import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'

export default function OperationPanel() {
  const consultas = Array.isArray(cardsData['Consultas']) ? cardsData['Consultas'] : []
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
            <h2 className="fw-bold mb-1">Consultas</h2>
          </div>
        </div>
        <div className="row g-3">
          {consultas.length === 0 ? (
            <div className="col-12">
              <div className="neo-card neo-lg p-4 text-center opacity-75">Sem Cards Cadastrados</div>
            </div>
          ) : (
            consultas.map((c) => (
              <div className="col-12 col-sm-6 col-md-4" key={`consultas-${c.title}`}>
                <div className="neo-card neo-lg p-5 h-100">
                  <h5 className="mb-2">{c.title}</h5>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

