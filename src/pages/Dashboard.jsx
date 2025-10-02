import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import cardsData from '../data/cards.json'
import * as Fi from 'react-icons/fi'
import Can from '../components/Can.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function Icon({ name, size = 24 }) {
  const Comp = Fi[name] || Fi.FiSquare
  return <Comp size={size} />
}

function Card({ title, icon, children, accent = 'primary', muted = false }) {
  return (
    <div className={`neo-card neo-lg neo-accent-${accent} p-5 h-100 ${muted ? 'neo-muted position-relative' : ''}`}>
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
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const role = user?.role ?? 'Operador'

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-4">
          <div>
            <h2 className="fw-bold mb-1">Dashboard</h2>
            <div className="opacity-75 small">Bem-vindo(a), {user?.name} — Perfil: {role}</div>
          </div>
        </div>

        <Can permission="view:master">
          <section className="mb-4">
            <h5 className="section-title">Visão Master</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <Card title="Configurações gerais" icon="FiSliders" accent="primary">
                  Gerencie parâmetros globais do sistema.
                </Card>
              </div>
              <div className="col-md-3">
                <Card title="Planos e billing" icon="FiDollarSign" accent="info">
                  Acompanhe assinaturas e faturas.
                </Card>
              </div>
              <div className="col-md-3">
                <Card title="Relatórios executivos" icon="FiTrendingUp" accent="success">
                  KPIs de alto nível e trends.
                </Card>
              </div>
              <div className="col-md-3">
                <Card title="Segurança e papéis" icon="FiShield" accent="warning">
                  Defina papéis e permissões.
                </Card>
              </div>
            </div>
          </section>
        </Can>

        <Can permission="view:admin">
          <section className="mb-4">
            <h5 className="section-title">Administração</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <Card title="Usuários" icon="FiUserCheck" accent="primary">Criar, editar e desativar usuários.</Card>
              </div>
              <div className="col-md-4">
                <Card title="Equipes" icon="FiGrid" accent="info">Organize equipes e atribuições.</Card>
              </div>
              <div className="col-md-4">
                <Card title="Integrações" icon="FiLink" accent="success">Ative integrações externas.</Card>
              </div>
            </div>
          </section>
        </Can>

        <Can permission="view:supervision">
          <section className="mb-4">
            <h5 className="section-title">Supervisão</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <Card title="Fila de atendimentos" icon="FiInbox" accent="warning">Monitore SLAs e prioridades.</Card>
              </div>
              <div className="col-md-3">
                <Card title="Produtividade" icon="FiActivity" accent="primary">Volume, TMA e taxa de conclusão.</Card>
              </div>
              <div className="col-md-3">
                <Card title="Qualidade" icon="FiStar" accent="info">Avaliações e auditorias.</Card>
              </div>
              <div className="col-md-3">
                <Card title="Alertas" icon="FiAlertTriangle" accent="danger">Sinais de risco em tempo real.</Card>
              </div>
            </div>
          </section>
        </Can>

        {/* Seções de cards copiadas/configuradas via JSON */}
        <Can permission="view:operation">
        {Object.entries(cardsData).map(([categoria, itens]) => (
          <section className="mb-4" key={categoria}>
            <h5 className="section-title">{categoria}</h5>
            <div className="row g-3">
              {itens.map((c) => (
                <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={`${categoria}-${c.title}`}>
                  <Card
                    title={c.title}
                    icon={c.icon}
                    accent={categoria === 'Em Desenvolvimento' ? 'info' : 'primary'}
                    muted={c.status === 'development' || categoria === 'Em Desenvolvimento'}
                  >
                  </Card>
                </div>
              ))}
            </div>
          </section>
        ))}
        </Can>
      </main>
      <Footer />
    </div>
  )
}
