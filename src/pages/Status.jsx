import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { FiArrowLeft } from 'react-icons/fi'
import { Link } from 'react-router-dom'

export default function Status() {
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <FiArrowLeft size={16} />
              <span className="d-none d-sm-inline">Voltar</span>
            </Link>
            <h2 className="fw-bold mb-0">Status</h2>
          </div>
        </div>

        <div className="neo-card neo-lg p-5 text-center opacity-50">
          <p className="mb-0">Página em manutenção.</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}