import { useMemo } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import * as Fi from 'react-icons/fi'
import { Link } from 'react-router-dom'

// Dados fictícios para visualização do layout
const mockZapUsers = [
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'Planejamento' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (TAI) - 8375' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (TUR) - 0259' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (PET) - 2751' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (BGS) - 1594' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (ZEF) - 7783' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (MAYARA) - 4798' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (MAYARA) - 2046' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (JUH) - 8294' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (JULIANA) - 9738' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (VASC) - 9188' },
  { usuario_nome: 'William Sanches Fernandes Belo', email: 'william@vieiracred.com.br', atualizado_em: '2025-12-03T09:03:01.603Z', departamento_nome: 'API (VASC) - 7333' },
]

const formatDateTime = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export default function UsuariosZapresponder() {
  const grouped = useMemo(() => {
    const map = new Map()
    mockZapUsers.forEach((row) => {
      if (!row) return
      const key = row.email || row.usuario_nome || Math.random().toString(36).slice(2)
      const current = map.get(key) || {
        nome: row.usuario_nome || 'Usuário',
        email: row.email || '-',
        atualizadoEm: row.atualizado_em || null,
        departamentos: [],
      }
      current.departamentos.push(row.departamento_nome || '-')
      if (row.atualizado_em) {
        const prev = current.atualizadoEm ? new Date(current.atualizadoEm).getTime() : 0
        const next = new Date(row.atualizado_em).getTime()
        if (next > prev) current.atualizadoEm = row.atualizado_em
      }
      map.set(key, current)
    })
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [])

  const totals = useMemo(() => {
    const depSet = new Set()
    grouped.forEach((g) => g.departamentos.forEach((d) => depSet.add(d)))
    const lastUpdated = grouped.reduce((acc, g) => {
      const ts = g.atualizadoEm ? new Date(g.atualizadoEm).getTime() : 0
      return ts > acc ? ts : acc
    }, 0)
    return {
      usuarios: grouped.length,
      departamentos: depSet.size,
      atualizadoEm: lastUpdated ? new Date(lastUpdated) : null,
    }
  }, [grouped])

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <Link to="/dashboard" className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-2">
                <Fi.FiArrowLeft />
                <span className="d-none d-sm-inline">Voltar</span>
              </Link>
            </div>
            <h2 className="fw-bold mb-1">Usuários Zapresponder</h2>
            <div className="opacity-75">Visão dos usuários e seus departamentos no Zapresponder.</div>
          </div>
          <div className="d-none d-md-flex gap-2">
            <span className="badge text-bg-success d-flex align-items-center gap-1">
              <Fi.FiZap />
              Zapresponder
            </span>
            <span className="badge text-bg-secondary">Pré-visualização</span>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="text-uppercase small opacity-75 mb-1">Usuários</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiUsers />
                <span className="display-6 fw-bold">{totals.usuarios}</span>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="text-uppercase small opacity-75 mb-1">Departamentos únicos</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiGrid />
                <span className="display-6 fw-bold">{totals.departamentos}</span>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="text-uppercase small opacity-75 mb-1">Atualizado em</div>
              <div className="d-flex align-items-center gap-2">
                <Fi.FiClock />
                <span className="fw-semibold">
                  {totals.atualizadoEm ? totals.atualizadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="neo-card neo-lg p-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h5 className="mb-1 d-flex align-items-center gap-2">
                <Fi.FiUsers />
                Usuários e departamentos
              </h5>
              <div className="small opacity-75">Dados de demonstração até receber a API real.</div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0 text-light">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Email</th>
                  <th style={{ minWidth: '260px' }}>Departamentos</th>
                  <th style={{ width: '180px' }}>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((user) => (
                  <tr key={user.email}>
                    <td className="fw-semibold">{user.nome}</td>
                    <td>{user.email}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {user.departamentos.map((dep, idx) => (
                          <span key={`${user.email}-${idx}`} className="badge text-bg-dark">
                            {dep}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-nowrap">{formatDateTime(user.atualizadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
