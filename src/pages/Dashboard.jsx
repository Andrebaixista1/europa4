import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import cardsData from '../data/cards.json'
import * as Fi from 'react-icons/fi'
import Can from '../components/Can.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Link } from 'react-router-dom'
import { notify } from '../utils/notify.js'

function Icon({ name, size = 24 }) {
  const Comp = Fi[name] || Fi.FiSquare
  return <Comp size={size} />
}

function Card({ title, icon, children, accent = 'primary', muted = false, to, onClick }) {
  const body = (
    <>
      {muted && (
        <span className="badge text-bg-secondary position-absolute" style={{ top: 12, right: 12 }}>
          Em Desenvolvimento
        </span>
      )}
      <div className="d-flex align-items-center gap-3 mb-2">
        {icon && (
          <div className="icon-wrap d-inline-flex align-items-center justify-content-center rounded-3" aria-hidden>
            <Icon name={icon} size={22} />
          </div>
        )}
        <h5 className="mb-0">{title}</h5>
      </div>
      {children && (
        <div className="opacity-85" style={{ fontSize: '0.975rem' }}>{children}</div>
      )}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={`neo-card neo-lg neo-accent-${accent} p-5 h-100 text-reset text-decoration-none d-block ${muted ? 'neo-muted position-relative' : ''}`}
      >
        {body}
      </Link>
    )
  }

  return (
    <div className={`neo-card neo-lg neo-accent-${accent} p-5 h-100 ${muted ? 'neo-muted position-relative' : ''}`}
         onClick={onClick}
         role={onClick ? 'button' : undefined}
         style={onClick ? { cursor: 'pointer' } : undefined}>
      {body}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const role = user?.role ?? 'Operador'
  const isMaster = role === 'Master'

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div>
            <h2 className="fw-bold mb-1">Dashboard</h2>
            <div className="opacity-75 small">Bem-vindo(a), {user?.name} - Perfil: {role}</div>
          </div>
        </div>

        <Can permission="view:admin">
          <section className="mb-4">
            <h5 className="section-title">Administrador</h5>
            <div className="row g-3">
              <div className="col-md-6 col-lg-4 col-xl-3">
                <Card title="Controle Planejamento" icon="FiClipboard" accent="primary" to="/admin/controle-planejamento">
                  Vanguard - Sistema de controle de usuarios.
                </Card>
              </div>
            </div>
          </section>
        </Can>

        <Can permission="view:supervision">
          <section className="mb-4">
            <h5 className="section-title">Supervisao</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <Card title="Usuarios" icon="FiUserCheck" accent="primary" to="/usuarios">Supervisor ve apenas sua propria equipe.</Card>
              </div>
              <div className="col-md-6">
                <Card title="Equipes" icon="FiGrid" accent="info" to="/equipes">Estruture e visualize sua equipe.</Card>
              </div>
            </div>
          </section>
        </Can>

        <Can permission="view:operation">
          {Object.entries(cardsData)
            .filter(([categoria]) => categoria === 'Consultas' || categoria === 'Em Desenvolvimento')
            .map(([categoria, itens]) => (
              <section className="mb-4" key={categoria}>
                <h5 className="section-title">{categoria}</h5>
                <div className="row g-3">
                  {itens.length === 0 ? (
                    <div className="col-12">
                      <div className="neo-card neo-lg p-4 text-center opacity-75">Sem Cards Cadastrados</div>
                    </div>
                  ) : (
                    itens.map((c) => (
                      <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={`${categoria}-${c.title}`}>
                        {(() => {
                          const isDev = (categoria === 'Em Desenvolvimento')
                          const computedTo = isDev ? (isMaster ? c.route : undefined) : c.route
                          const onClick = (!isMaster && isDev) ? () => notify.info('Em desenvolvimento') : undefined
                          return (
                            <Card
                              title={c.title}
                              icon={c.icon}
                              accent={isDev ? 'info' : 'primary'}
                              muted={isDev && !isMaster}
                              to={computedTo}
                              onClick={onClick}
                            >
                              {c.description || null}
                            </Card>
                          )
                        })()}
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))}
        </Can>
      </main>
      <Footer />
    </div>
  )
}
