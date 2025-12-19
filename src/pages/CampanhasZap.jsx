import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function CampanhasZap() {
  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2">
              <ArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <img
                  src="https://chat.zapresponder.com.br/assets/logo-fill-707bdf21.svg"
                  alt="Zap Responder"
                  style={{ height: 32, width: 'auto' }}
                />
                <h2 className="fw-bold mb-0">Campanhas Zap</h2>
              </div>
              <div className="opacity-75 small">Crie e acompanhe campanhas do Zapresponder.</div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-4">
          <div className="opacity-75">Em breve.</div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
