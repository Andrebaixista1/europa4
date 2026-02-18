import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { Roles } from '../utils/roles.js'
import { useSidebar } from '../context/SidebarContext.jsx'
import { canAccessConsultaPresenca, canAccessConsultasV8 } from '../utils/access.js'

function Icon({ name, size = 20 }) {
  const Comp = Fi[name] || Fi.FiSquare
  return <Comp size={size} />
}

function SubItemIcon({ child }) {
  if (child?.iconSrc) {
    return <img src={child.iconSrc} alt="" className="dash-sub-icon-img" aria-hidden="true" />
  }
  if (child?.icon) {
    return <Icon name={child.icon} size={16} />
  }
  return null
}

export default function SidebarNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(true)
  const [openMenu, setOpenMenu] = useState(null)
  const { isOpen: mobileOpen, close: closeSidebar } = useSidebar()
  const role = user?.role
  const level = Number(user?.level ?? user?.nivel_hierarquia ?? user?.NivelHierarquia ?? null)
  const allowConsultasV8 = canAccessConsultasV8(user)
  const allowConsultaPresenca = canAccessConsultaPresenca(user)
  const prevPath = useRef(location.pathname)

  const menu = useMemo(() => {
    const isMaster = role === Roles.Master
    const isAdmin = role === Roles.Administrador
    const isSupervisor = role === Roles.Supervisor

    const items = [
      { label: 'Visão Geral', icon: 'FiHome', to: '/dashboard' }
    ]

    items.push({
      label: 'Consultas',
      icon: 'FiSearch',
      children: [
        { label: 'Consulta Individual (IN100)', to: '/consultas/in100' },
        { label: 'Cliente Argus', to: '/consulta/cliente-argus' },
        { label: 'Histórico de Consultas', to: '/consultas/historico' },
        ...(allowConsultaPresenca ? [{ label: 'Consulta Presença', to: '/consultas/presenca' }] : []),
        ...(allowConsultasV8 ? [{ label: 'Consultas V8', to: '/consultas/v8' }] : [])
      ]
    })

    if (isMaster) {
      items.push({
        label: 'Gestão',
        icon: 'FiBriefcase',
        children: [
          { label: 'Gestão de Recargas', to: '/recargas' },
          { label: 'Controle Planejamento', to: '/admin/controle-planejamento' },
          { label: 'Relatórios', to: '/admin/relatorios' }
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
  }, [role, level, allowConsultasV8, allowConsultaPresenca])

  const isActive = (path) => {
    if (!path) return false
    const current = location.pathname
    if (path === '/') return current === '/'
    const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
    return current === normalizedPath || current.startsWith(`${normalizedPath}/`)
  }

  const handleEnter = () => {
    if (!mobileOpen) setCollapsed(false)
  }

  const handleLeave = () => {
    if (!mobileOpen) {
      setCollapsed(true)
      setOpenMenu(null)
    }
  }

  const handleNavClick = () => {
    if (mobileOpen) closeSidebar()
  }

  const handleToggle = () => {
    if (mobileOpen) {
      closeSidebar()
      return
    }
    setCollapsed((v) => !v)
  }

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname
      if (mobileOpen) closeSidebar()
    }
  }, [location.pathname, mobileOpen, closeSidebar])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const media = window.matchMedia('(max-width: 992px)')
    const sync = () => {
      if (!media.matches && mobileOpen) closeSidebar()
    }
    sync()
    if (media.addEventListener) {
      media.addEventListener('change', sync)
    } else {
      media.addListener(sync)
    }
    return () => {
      if (media.addEventListener) {
        media.removeEventListener('change', sync)
      } else {
        media.removeListener(sync)
      }
    }
  }, [mobileOpen, closeSidebar])

  const isCollapsed = mobileOpen ? false : collapsed

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="dash-backdrop active"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      )}
      <aside
        id="sidebar-nav"
        className={`dash-sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <button
          className="dash-toggle"
          type="button"
          aria-label="Toggle menu"
          onClick={handleToggle}
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
                  <Link className={`dash-nav-link ${active ? 'active' : ''}`} to={item.to} onClick={handleNavClick}>
                    <Icon name={item.icon} size={18} />
                    <span className="dash-label">{item.label}</span>
                  </Link>
                )}

                {item.children && !isCollapsed && isOpen && (
                  <div className="dash-submenu">
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        to={child.to}
                        className={`dash-subitem ${isActive(child.to) ? 'active' : ''}`}
                        onClick={handleNavClick}
                      >
                        <SubItemIcon child={child} />
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
    </>
  )
}
