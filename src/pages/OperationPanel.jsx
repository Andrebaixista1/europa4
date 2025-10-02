import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

export default function OperationPanel() {
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <h2 className="fw-bold mb-3">Operação</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Minhas tarefas</h5>
              <p className="mb-0 opacity-85">Atendimentos atribuídos.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Clientes</h5>
              <p className="mb-0 opacity-85">Lista e histórico.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="neo-card neo-lg p-5 h-100">
              <h5 className="mb-2">Agenda</h5>
              <p className="mb-0 opacity-85">Follow-ups e compromissos.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

