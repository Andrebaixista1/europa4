import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <TopNav />
      <header className="container-xxl py-5 flex-grow-1 d-flex align-items-center" style={{ minHeight: '82vh' }}>
        <div className="row align-items-center w-100 g-4 g-lg-5">
          <div className="col-lg-6">
            <h1 className="display-3 fw-bold gradient-text mb-3">Consultas e controles com inovação</h1>
            <p className="lead" style={{ opacity: 0.85, fontSize: '1.25rem' }}>
              Europa é uma ferramenta de consultas e controles — tecnologia e inovação para organizar equipes,
              acelerar operações e dar visão clara do trabalho por hierarquias Master, Supervisor e Operador.
            </p>
            <div className="d-flex gap-2 mt-3">
              <Link to="/login" className="btn btn-primary btn-lg px-4">Começar agora</Link>
              <a
                href="https://www.nova-europa-consulta.com.br"
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-light btn-lg"
              >
                Conheça a versão anterior
              </a>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="row g-4">
              <div className="col-12">
                <div className="neo-card neo-lg p-5">
                  <h4 className="mb-2">Visão clara</h4>
                  <p className="mb-0" style={{ opacity: 0.85 }}>Cards fluídos e responsivos inspirados em produtos premium.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="neo-card neo-lg p-5 h-100">
                  <small className="text-uppercase" style={{ opacity: 0.75 }}>Segurança</small>
                  <h5 className="mb-2">Acesso por hierarquia</h5>
                  <p className="mb-0" style={{ opacity: 0.85 }}>Cada papel enxerga apenas o necessário.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="neo-card neo-lg p-5 h-100">
                  <small className="text-uppercase" style={{ opacity: 0.75 }}>Performance</small>
                  <h5 className="mb-2">Rápido e moderno</h5>
                  <p className="mb-0" style={{ opacity: 0.85 }}>Construído com React + Vite + Bootstrap.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Footer />
    </div>
  )
}

