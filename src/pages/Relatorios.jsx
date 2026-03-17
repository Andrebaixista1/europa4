import { Link } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

export default function Relatorios() {
  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />

      <main className="container-xxl py-4 flex-grow-1">
        <section className="neo-card p-3 p-lg-4">
          <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3">
            <Link to="/dashboard" className="btn btn-ghost d-flex align-items-center gap-2" title="Voltar ao Dashboard">
              <Fi.FiArrowLeft size={16} />
              <span>Voltar</span>
            </Link>

            <div>
              <h1 className="h2 mb-1 fw-bold">Extrações</h1>
              <p className="text-light-2 mb-0">Acompanhe as extrações e relatórios da equipe.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
