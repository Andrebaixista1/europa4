import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

export default function SupervisionPanel() {
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <h2 className="fw-bold mb-3">Supervisão</h2>
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Usuários</h5>
              <p className="mb-0 opacity-85">Gerencie perfis. Supervisor vê apenas sua própria equipe.</p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Equipes</h5>
              <p className="mb-0 opacity-85">Estruture e visualize sua equipe.</p>
            </div>
          </div>
        </div>
        
      </main>
      <Footer />
    </div>
  )
}

