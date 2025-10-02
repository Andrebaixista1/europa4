import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import cardsData from '../data/cards.json'

export default function OperationPanel() {
  const consultas = Array.isArray(cardsData['Consultas']) ? cardsData['Consultas'] : []
  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <h2 className="fw-bold mb-3">Consultas</h2>
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

