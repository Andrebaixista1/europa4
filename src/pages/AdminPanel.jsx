import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

export default function AdminPanel() {
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <h2 className="fw-bold mb-3">Administração</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Usuários</h5>
              <p className="mb-0 opacity-85">Gerencie contas e permissões.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Equipes</h5>
              <p className="mb-0 opacity-85">Estruture times e atribuições.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Integrações</h5>
              <p className="mb-0 opacity-85">Conecte sistemas externos.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

