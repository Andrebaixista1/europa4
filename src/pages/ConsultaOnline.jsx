import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowLeft, FiSearch } from 'react-icons/fi'
import TopNav from '../components/TopNav.jsx'
import Footer from '../components/Footer.jsx'

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 11)

const formatCpf = (value) => {
  const digits = onlyDigits(value)
  const p1 = digits.slice(0, 3)
  const p2 = digits.slice(3, 6)
  const p3 = digits.slice(6, 9)
  const p4 = digits.slice(9, 11)
  if (!digits) return ''
  if (digits.length <= 3) return p1
  if (digits.length <= 6) return `${p1}.${p2}`
  if (digits.length <= 9) return `${p1}.${p2}.${p3}`
  return `${p1}.${p2}.${p3}-${p4}`
}

export default function ConsultaOnline() {
  const [cpf, setCpf] = useState('')
  const cpfDigits = useMemo(() => onlyDigits(cpf), [cpf])
  const hasCpf = cpfDigits.length === 11

  return (
    <div className="bg-deep text-light min-vh-100 d-flex flex-column">
      <TopNav />
      <main className="container-xxl py-4 flex-grow-1">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Link to="/dashboard" className="btn btn-ghost btn-sm d-flex align-items-center gap-2" title="Voltar ao Dashboard">
            <FiArrowLeft size={16} />
            <span>Voltar</span>
          </Link>
          <div>
            <h2 className="fw-bold mb-1">Consulta Online</h2>
            <div className="opacity-75 small">
              Página para consultar clientes online em todos os canais e bancos via API.
            </div>
          </div>
        </div>

        <section className="neo-card p-3 mb-3">
          <label className="form-label fw-semibold">CPF do cliente</label>
          <div className="d-flex gap-2 flex-wrap">
            <div className="input-group" style={{ maxWidth: 920 }}>
              <span className="input-group-text bg-transparent border-secondary text-light">
                <FiSearch />
              </span>
              <input
                type="text"
                className="form-control"
                value={formatCpf(cpf)}
                onChange={(event) => setCpf(event.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <button type="button" className="btn btn-primary" disabled={!hasCpf}>
              Consultar
            </button>
          </div>
        </section>

        <section className="neo-card p-3">
          <h5 className="mb-3">0 registro(s) encontrado(s)</h5>
          <p className="mb-0 opacity-75">
            {hasCpf
              ? 'Fluxo da consulta online pronto para integrar no próximo passo.'
              : 'Informe um CPF para consultar.'}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}

