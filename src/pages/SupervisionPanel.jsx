import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

export default function SupervisionPanel() {
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <h2 className="fw-bold mb-3">Supervisão</h2>
        <div className="row g-3">
          <div className="col-md-3">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Fila</h5>
              <p className="mb-0 opacity-85">Acompanhe SLAs e prioridades.</p>
            </div>
          </div>
          <div className="col-md-3">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Produtividade</h5>
              <p className="mb-0 opacity-85">TMA, volume, conclusão.</p>
            </div>
          </div>
          <div className="col-md-3">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Qualidade</h5>
              <p className="mb-0 opacity-85">Auditorias e avaliações.</p>
            </div>
          </div>
          <div className="col-md-3">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Alertas</h5>
              <p className="mb-0 opacity-85">Sinais de risco.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

