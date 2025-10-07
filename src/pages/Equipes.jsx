import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import * as Fi from 'react-icons/fi'

// Página Equipes: estrutura pronta para integrar API em seguida.
export default function Equipes() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [equipes, setEquipes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoSupervisor, setNovoSupervisor] = useState('')
  const [novoDepartamento, setNovoDepartamento] = useState('')
  const [editNome, setEditNome] = useState('')

  // MOCK até a API ficar pronta
  useEffect(() => {
    let aborted = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('https://webhook.sistemavieira.com.br/webhook/user-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user?.id }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        // Desembrulha resposta do MSSQL no n8n: array com chave JSON_*
        const unwrap = (d) => {
          if (Array.isArray(d) && d.length > 0 && d[0] && typeof d[0] === 'object') {
            const key = Object.keys(d[0]).find(k => k.toUpperCase().startsWith('JSON_'))
            if (key && typeof d[0][key] === 'string') {
              try { return JSON.parse(d[0][key]) } catch (_) { /* ignore */ }
            }
          }
          return d
        }

        const payload = unwrap(data)

        const toTeam = (t) => ({
          id: t?.id ?? t?.team_id ?? t?.equipe_id ?? null,
          nome: t?.nome ?? t?.name ?? t?.team_name ?? 'Equipe',
          descricao: t?.descricao ?? t?.description ?? '',
          ativo: (t?.ativo ?? t?.active ?? true) ? true : false,
          supervisor: (() => {
            const raw = t?.supervisor ?? t?.lead ?? null
            if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return { nome: raw } } }
            return raw
          })(),
          departamento: t?.departamento ?? t?.department ?? '-',
          membros: t?.membros ?? t?.users ?? t?.usuarios ?? [],
        })

        let eq = []
        if (Array.isArray(payload?.equipes)) {
          eq = payload.equipes.map(toTeam)
        } else if (payload?.equipe || payload?.usuarios || payload?.users) {
          const base = toTeam(payload?.equipe || {})
          const members = base.membros?.length ? base.membros : (payload?.usuarios || payload?.users || [])
          base.membros = members
          if (!base.id && Array.isArray(members) && members[0]?.equipe_id) base.id = members[0].equipe_id
          eq = [base]
        } else if (Array.isArray(payload)) {
          eq = [{ id: null, nome: 'Equipe', descricao: '', ativo: true, supervisor: null, departamento: '-', membros: payload }]
        }

        if (!eq.length) throw new Error('Resposta vazia da API')
        if (!aborted) {
          setEquipes(eq)
          setSelectedId(eq[0]?.id ?? null)
        }
      } catch (e) {
        console.error('Falha API Equipes:', e)
        if (!aborted) {
          setError(e)
          setEquipes([])
          setSelectedId(null)
        }
      } finally {
        if (!aborted) setIsLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [user?.id])

  const isMasterRole = user?.role === 'Master'
  const isMasterTeam = (user?.equipe_nome || '').toLowerCase() === 'master'
  const isMaster = isMasterRole || isMasterTeam
  const isSupervisor = user?.role === 'Supervisor'
  const canCreateTeam = isMaster
  const canEditTeamName = isMaster || isSupervisor
  const canManageMembers = isMaster || isSupervisor

  const baseEquipes = useMemo(() => {
    if (isMaster) {
      return equipes
    }
    if (user?.equipe_id != null) {
      return equipes.filter(e => e.id === user.equipe_id)
    }
    return equipes
  }, [equipes, user, isMaster])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return baseEquipes
    return baseEquipes.filter(e =>
      e.nome.toLowerCase().includes(term) ||
      (e.descricao || '').toLowerCase().includes(term)
    )
  }, [baseEquipes, search])

  const selected = useMemo(() => filtered.find(e => e.id === selectedId) || null, [filtered, selectedId])

  useEffect(() => {
    // Garante seleção válida quando a lista visível muda (ex.: Supervisor)
    if (!filtered.some(e => e.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId])

  useEffect(() => {
    setEditNome(selected?.nome || '')
  }, [selected?.id])

  function handleAddEquipe() {
    const nome = novoNome.trim()
    const sup = novoSupervisor.trim()
    const dep = novoDepartamento.trim()
    if (!nome || !sup || !dep) return
    const nextId = Math.max(0, ...equipes.map(e => e.id)) + 1
    const nova = {
      id: nextId,
      nome,
      descricao: '',
      ativo: true,
      supervisor: { id: null, nome: sup },
      departamento: dep,
      membros: [],
    }
    setEquipes(prev => [nova, ...prev])
    setSelectedId(nextId)
    setNovoNome('')
    setNovoSupervisor('')
    setNovoDepartamento('')
  }

  function handleSaveNomeEquipe() {
    if (!selected) return
    const name = (editNome || '').trim()
    if (!name) return
    setEquipes(prev => prev.map(e => e.id === selected.id ? { ...e, nome: name } : e))
  }

  return (
    <div className="bg-deep min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div>
            <h2 className="fw-bold mb-1">Equipes</h2>
            <div className="opacity-75 small">Estruture times, supervisor e operadores</div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="neo-card neo-lg p-4 h-100">
              <div className="d-flex gap-2 mb-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-control"
                  placeholder="Buscar equipe..."
                />
                <button className="btn btn-outline-secondary" onClick={() => setSearch('')} aria-label="Limpar busca" title="Limpar">
                  <Fi.FiX />
                </button>
              </div>

              {canCreateTeam && (
              <div className="border rounded-3 p-3 mb-3" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                <div className="small text-uppercase opacity-75 mb-2">Nova equipe</div>
                <div className="d-flex flex-column gap-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Nome da equipe"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                  />
                  <input
                    className="form-control form-control-sm"
                    placeholder="Nome do supervisor"
                    value={novoSupervisor}
                    onChange={(e) => setNovoSupervisor(e.target.value)}
                  />
                  <input
                    className="form-control form-control-sm"
                    placeholder="Departamento"
                    value={novoDepartamento}
                    onChange={(e) => setNovoDepartamento(e.target.value)}
                  />
                  <div className="d-flex justify-content-end">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleAddEquipe}
                      aria-label="Adicionar equipe"
                      title="Adicionar equipe"
                      disabled={!novoNome.trim() || !novoSupervisor.trim() || !novoDepartamento.trim()}
                    >
                      <Fi.FiPlus />
                    </button>
                  </div>
                </div>
              </div>
              )}

              {isLoading && (
                <div className="text-center py-4 opacity-75">Carregando...</div>
              )}
              {error && (
                <div className="alert alert-danger py-2">{String(error)}</div>
              )}
              {!isLoading && !error && (
                <ul className="list-group">
                  {filtered.length === 0 && (
                    <li className="list-group-item text-center opacity-75">Nenhuma equipe encontrada</li>
                  )}
                  {filtered.map((e) => (
                    <li
                      key={e.id}
                      className={`list-group-item d-flex justify-content-between align-items-center ${selectedId === e.id ? 'active' : ''}`}
                      role="button"
                      onClick={() => setSelectedId(e.id)}
                    >
                      <div className="me-3">
                        <div className="fw-semibold">{e.nome}</div>
                        <div className="small opacity-75">{e.descricao || 'Sem descrição'}</div>
                      </div>
                      <div className="text-end small">
                        <div className="opacity-85">Sup.: {e.supervisor?.nome || '—'}</div>
                        <div className="opacity-75">Operadores: {e.membros?.length ?? 0}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!error && (
                <div className="small mt-3 opacity-50">Dados carregados da API.</div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="neo-card neo-lg p-4 h-100">
              {!selected ? (
                <div className="opacity-75">Selecione uma equipe para ver os detalhes.</div>
              ) : (
                <>
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div>
                      <h5 className="mb-1">{selected.nome}</h5>
                      <div className="small opacity-75">{selected.descricao || 'Sem descrição'}</div>
                      
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-primary btn-sm" disabled title="Editar" aria-label="Editar">
                        <Fi.FiEdit />
                      </button>
                      <button className="btn btn-outline-danger btn-sm" disabled title="Excluir" aria-label="Excluir">
                        <Fi.FiTrash2 />
                      </button>
                    </div>
                  </div>

                  {(user?.role === 'Master' || user?.role === 'Supervisor' || (user?.equipe_nome || '').toLowerCase() === 'master') && (
                    <div className="mb-3 d-flex align-items-center gap-2">
                      <input className="form-control form-control-sm" value={editNome} onChange={(e) => setEditNome(e.target.value)} aria-label="Nome da equipe" />
                      <button className="btn btn-outline-primary btn-sm" onClick={handleSaveNomeEquipe} title="Salvar nome" aria-label="Salvar nome">
                        <Fi.FiSave />
                      </button>
                    </div>
                  )}

                  <div className="mb-3 p-3 rounded-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="small text-uppercase opacity-75 mb-1">Supervisor</div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>{selected.supervisor?.nome || '—'}</div>
                      <button className="btn btn-outline-secondary btn-sm" disabled title="Trocar supervisor" aria-label="Trocar supervisor">
                        <Fi.FiRefreshCcw />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="mb-0">Membros ({selected.membros?.length ?? 0})</h6>
                      <button className="btn btn-primary btn-sm" title="Adicionar membro" aria-label="Adicionar membro"
                        onClick={() => {
                          const can = (user?.role === 'Master') || (user?.role === 'Supervisor') || ((user?.equipe_nome || '').toLowerCase() === 'master')
                          if (!can) return
                          const nome = prompt('Nome do operador:')
                          if (!nome) return
                          const login = prompt('Login do operador:') || ''
                          const nextId = Math.max(0, ...((selected.membros || []).map(m => m.id))) + 1
                          const novo = { id: nextId, nome, login }
                          setEquipes(prev => prev.map(e => e.id === selected.id ? { ...e, membros: [ ...(e.membros || []), novo ] } : e))
                        }}
                        disabled={!((user?.role === 'Master') || (user?.role === 'Supervisor') || ((user?.equipe_nome || '').toLowerCase() === 'master'))}
                      >
                        <Fi.FiPlus />
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-dark table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th style={{ width: 80 }}>ID</th>
                            <th>Nome</th>
                            <th>Login</th>
                            <th style={{ width: 100 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selected.membros || []).map(m => (
                            <tr key={m.id}>
                              <td>{m.id}</td>
                              <td>{m.nome}</td>
                              <td>{m.login}</td>
                              <td className="text-end">
                                <button className="btn btn-outline-secondary btn-sm me-2" disabled title="Mover" aria-label="Mover">
                                  <Fi.FiArrowRight />
                                </button>
                                <button className="btn btn-outline-danger btn-sm" title="Remover" aria-label="Remover"
                                  onClick={() => {
                                    const can = (user?.role === 'Master') || (user?.role === 'Supervisor') || ((user?.equipe_nome || '').toLowerCase() === 'master')
                                    if (!can) return
                                    setEquipes(prev => prev.map(e => e.id === selected.id ? { ...e, membros: (e.membros || []).filter(x => x.id !== m.id) } : e))
                                  }}
                                  disabled={!((user?.role === 'Master') || (user?.role === 'Supervisor') || ((user?.equipe_nome || '').toLowerCase() === 'master'))}
                                >
                                  <Fi.FiTrash2 />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(!selected.membros || selected.membros.length === 0) && (
                            <tr>
                              <td colSpan="4" className="opacity-75">Nenhum membro.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
              <div className="small mt-3 opacity-75">Integração prevista: GET/POST/PUT em /equipes e /usuarios</div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
