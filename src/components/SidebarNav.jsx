import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { Roles } from '../utils/roles.js'

function Icon({ name, size = 20 }) {
  const Comp = Fi[name] || Fi.FiSquare
  return <Comp size={size} />
}

export default function SidebarNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(true)
  const [openMenu, setOpenMenu] = useState(null)
  const role = user?.role
  const level = Number(user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia ?? null)

  const menu = useMemo(() => {
    const isMaster = role === Roles.Master
    const isAdmin = role === Roles.Administrador
    const isSupervisor = role === Roles.Supervisor

    const items = [
      { label: 'Visão Geral', icon: 'FiHome', to: '/dashboard' }
    ]

    if (isMaster) {
      items.push({
        label: 'Disparador',
        icon: 'FiZap',
        children: [
          { label: 'Disparar Whats', to: '/disparador/disparar-whats' },
          { label: 'Campanhas', to: '/disparador/campanhas' },
          { label: 'Configurar BM', to: '/disparador/configurar-bm' }
        ]
      })
    }

    items.push({
      label: 'Consultas',
      icon: 'FiSearch',
      children: [
        { label: 'Consulta Individual (IN100)', to: '/consultas/in100' },
        { label: 'Histórico de Consultas', to: '/consultas/historico' }
      ]
    })

    if (isMaster) {
      items.push({
        label: 'Gestão',
        icon: 'FiBriefcase',
        children: [
          { label: 'Gestão de Recargas', to: '/recargas' },
          { label: 'Controle Planejamento', to: '/admin/controle-planejamento' }
        ]
      })
    }

    if (isMaster || isAdmin || isSupervisor) {
      items.push({
        label: 'Configurações',
        icon: 'FiSettings',
        children: [
          { label: 'Usuários', to: '/usuarios' },
          { label: 'Equipes', to: '/equipes' }
        ]
      })
    }

    return items
  }, [role, level])

  const isActive = (path) => path && location.pathname.startsWith(path)

  const handleEnter = () => setCollapsed(false)
  const handleLeave = () => {
    setCollapsed(true)
    setOpenMenu(null)
  }

  return (
    <aside
      className={`dash-sidebar ${collapsed ? 'collapsed' : ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className="dash-toggle"
        type="button"
        aria-label="Alternar menu"
        onClick={() => setCollapsed((v) => !v)}
      >
        <img src="/neo-logo.svg" alt="Nova Europa" className="dash-toggle-icon" />
      </button>

      <div className="dash-menu">
        {menu.map((item) => {
          const active = isActive(item.to) || item.children?.some((c) => isActive(c.to))
          const isOpen = openMenu === item.label
          return (
            <div key={item.label}>
              {item.children ? (
                <button
                  className={`dash-nav-link ${active ? 'active' : ''}`}
                  type="button"
                  onClick={() => setOpenMenu((curr) => (curr === item.label ? null : item.label))}
                >
                  <Icon name={item.icon} size={18} />
                  <span className="dash-label">{item.label}</span>
                  <span className={`dash-arrow ${isOpen ? 'open' : ''}`} aria-hidden>
                    <Icon name="FiChevronDown" size={14} />
                  </span>
                </button>
              ) : (
                <Link className={`dash-nav-link ${active ? 'active' : ''}`} to={item.to}>
                  <Icon name={item.icon} size={18} />
                  <span className="dash-label">{item.label}</span>
                </Link>
              )}

              {item.children && !collapsed && isOpen && (
                <div className="dash-submenu">
                  {item.children.map((child) => (
                    <Link key={child.label} to={child.to} className="dash-subitem">
                      <span className="dash-sub-bullet" aria-hidden />
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
