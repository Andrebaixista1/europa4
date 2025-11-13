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
    <div
      className={`neo-card neo-lg neo-accent-${accent} p-5 h-100 ${muted ? 'neo-muted position-relative' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {body}
    </div>
  )
}

const allowedCategories = new Set(['Consultas', 'Em Desenvolvimento'])

const toNumberOrNull = (value) => {
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default function Dashboard() {
  const { user } = useAuth()
  const role = user?.role ?? 'Operador'
  const isMaster = role === 'Master'
  const userTeamId = toNumberOrNull(user?.equipe_id)

  const canSeeCard = (card) => {
    if (Array.isArray(card?.teamIds) && card.teamIds.length > 0) {
      const allowMaster = card.allowMaster !== false
      if (allowMaster && isMaster) return true
      if (userTeamId === null) return false
      return card.teamIds.some((teamId) => toNumberOrNull(teamId) === userTeamId)
    }
    return true
  }

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

        {isMaster && (
          <section className="mb-4">
            <h5 className="section-title">Master</h5>
            <div className="row g-3">
              <div className="col-md-6 col-lg-4 col-xl-3">
                <Card title="Gestão de Recargas" icon="FiCreditCard" accent="primary" to="/recargas">
                  Gerencie e acompanhe as recargas da equipe.
                </Card>
              </div>
            </div>
          </section>
        )}

        <Can permission="view:admin">
          <section className="mb-4">
            <h5 className="section-title">Administrador</h5>
            <div className="row g-3">
              <div className="col-md-6 col-lg-4 col-xl-3">
                <Card title="Controle Planejamento" icon="FiClipboard" accent="primary" to="/admin/controle-planejamento">
                  Vanguard - Sistema de controle de usuários.
                </Card>
              </div>
              {canSeeCard({ teamIds: [1014], allowMaster: true }) && (
                <div className="col-md-6 col-lg-4 col-xl-3">
                  <Card title="Status WhatsApp" icon="FiSmartphone" accent="primary" to="/status/whatsapp">
                    Centralize os textos combinados para manter o status oficial atualizado.
                  </Card>
                </div>
              )}
              {canSeeCard({ teamIds: [1, 1014], allowMaster: true }) && (
                <div className="col-md-6 col-lg-4 col-xl-3">
                  <Card title="Múltiplos Disparos" icon="FiSend" accent="primary" to="/disparos/multiplos">
                    Configure e agende múltiplos disparos em massa para diferentes canais.
                  </Card>
                </div>
              )}
              {canSeeCard({ teamIds: [1, 1014], allowMaster: true }) && (
                <div className="col-md-6 col-lg-4 col-xl-3">
                  <Card title="Acompanhamento de Disparos" icon="FiActivity" accent="primary" to="/disparos/acompanhamento">
                    Monitore e acompanhe o status de todos os seus disparos agendados.
                  </Card>
                </div>
              )}
              <div className="col-md-6 col-lg-4 col-xl-3">
                <Card title="Gerador de Sites" icon="FiGlobe" accent="primary" to="/admin/gerador-sites">
                  Gere sites profissionais de forma automatizada com base em templates predefinidos, apenas fornecendo as informações essenciais.
                </Card>
              </div>
              <div className="col-md-6 col-lg-4 col-xl-3">
                <Card title="Status BM's" icon="FiInfo" accent="info" to="/admin/status-bm">
                  Status de BMs e linhas com detalhes por telefone.
                </Card>
              </div>
            </div>
          </section>
        </Can>

        <Can permission="view:supervision">
          <section className="mb-4">
            <h5 className="section-title">Supervisão</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <Card title="Usuários" icon="FiUserCheck" accent="primary" to="/usuarios">
                  Supervisor vê apenas a própria equipe.
                </Card>
              </div>
              <div className="col-md-6">
                <Card title="Equipes" icon="FiGrid" accent="info" to="/equipes">
                  Estruture e visualize sua equipe.
                </Card>
              </div>
            </div>
          </section>
        </Can>

        <Can permission="view:operation">
          {Object.entries(cardsData)
            .filter(([categoria]) => allowedCategories.has(categoria))
            .map(([categoria, itens]) => {
              const visibleItems = itens.filter((card) => canSeeCard(card))
              const hasCatalog = itens.length > 0

              return (
                <section className="mb-4" key={categoria}>
                  <h5 className="section-title">{categoria}</h5>
                  <div className="row g-3">
                    {!hasCatalog ? (
                      <div className="col-12">
                        <div className="neo-card neo-lg p-4 text-center opacity-75">Sem cards cadastrados.</div>
                      </div>
                    ) : visibleItems.length === 0 ? (
                      <div className="col-12">
                        <div className="neo-card neo-lg p-4 text-center opacity-75">Nenhum card disponível para a sua equipe.</div>
                      </div>
                    ) : (
                      visibleItems.map((c) => {
                        const isDev = categoria === 'Em Desenvolvimento'
                        const computedTo = isDev ? (isMaster ? c.route : undefined) : c.route
                        const onClick = !isMaster && isDev ? () => notify.info('Em desenvolvimento') : undefined

                        return (
                          <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={`${categoria}-${c.title}`}>
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
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>
              )
            })}
        </Can>
      </main>
      <Footer />
    </div>
  )
}


