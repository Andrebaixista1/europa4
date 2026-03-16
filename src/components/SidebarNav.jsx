import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as Fi from 'react-icons/fi'
import { useAuth } from '../context/AuthContext.jsx'
import { useSidebar } from '../context/SidebarContext.jsx'
import { canAccessPage } from '../utils/pageAccess.js'

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

const buildMenu = (user) => {
  const isAllowed = (pageKey) => canAccessPage(user, pageKey)
  const filterAllowed = (items) => items.filter((item) => isAllowed(item.pageKey))
  const items = []

  if (isAllowed('dashboard')) {
    items.push({ label: 'Vis\u00e3o Geral', icon: 'FiHome', to: '/dashboard' })
  }

  const consultaChildren = filterAllowed([
    { pageKey: 'consultas_clientes', label: 'Consulta Offline', to: '/consultas/clientes' },
    { pageKey: 'consultas_online', label: 'Consulta Online', to: '/consultas/online' },
    { pageKey: 'cliente_argus', label: 'Cliente Argus', to: '/consulta/cliente-argus' },
  ])
  if (consultaChildren.length > 0) {
    items.push({ label: 'Consultas', icon: 'FiSearch', children: consultaChildren })
  }

  const gestaoChildren = filterAllowed([
    { pageKey: 'recargas', label: 'Gest\u00e3o de Recargas', to: '/recargas' },
    { pageKey: 'controle_planejamento', label: 'Controle Planejamento', to: '/admin/controle-planejamento' },
    { pageKey: 'extracoes', label: 'Extra\u00e7\u00f5es', to: '/admin/relatorios' },
  ])
  if (gestaoChildren.length > 0) {
    items.push({ label: 'Gest\u00e3o', icon: 'FiBriefcase', children: gestaoChildren })
  }

  return items
}

export default function SidebarNav() {
  const { user } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(true)
  const [openMenu, setOpenMenu] = useState(null)
  const [hoveredMenu, setHoveredMenu] = useState(null)
  const [showToggleHint, setShowToggleHint] = useState(false)
  const { isOpen: mobileOpen, close: closeSidebar } = useSidebar()
  const prevPath = useRef(location.pathname)
  const hoverCloseTimerRef = useRef(null)
  const hintTimerRef = useRef(null)

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current)
      hoverCloseTimerRef.current = null
    }
  }

  const clearHintTimer = () => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
  }

  const menu = useMemo(() => buildMenu(user), [user])

  const isActive = (path) => {
    if (!path) return false
    const current = location.pathname
    if (path === '/') return current === '/'
    const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
    return current === normalizedPath || current.startsWith(`${normalizedPath}/`)
  }

  const handleNavClick = () => {
    if (mobileOpen) closeSidebar()
  }

  const handleToggle = () => {
    if (mobileOpen) {
      closeSidebar()
      return
    }
    setCollapsed((prev) => {
      const next = !prev
      if (next) setOpenMenu(null)
      if (next) {
        clearHintTimer()
        setShowToggleHint(true)
        hintTimerRef.current = setTimeout(() => {
          setShowToggleHint(false)
        }, 5000)
      }
      return next
    })
  }

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname
      clearHoverCloseTimer()
      setHoveredMenu(null)
      if (mobileOpen) closeSidebar()
    }
  }, [location.pathname, mobileOpen, closeSidebar])

  useEffect(() => {
    clearHintTimer()
    setShowToggleHint(true)
    hintTimerRef.current = setTimeout(() => {
      setShowToggleHint(false)
    }, 5000)
    return () => {
      clearHintTimer()
    }
  }, [location.pathname])

  useEffect(() => {
    return () => {
      clearHoverCloseTimer()
      clearHintTimer()
    }
  }, [])

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
      >
        <div className="dash-toggle-wrap">
          <button
            className="dash-toggle"
            type="button"
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={handleToggle}
          >
            <img src="/neo-logo.svg" alt="Nova Europa" className="dash-toggle-icon" />
          </button>
          {isCollapsed && !mobileOpen && showToggleHint && (
            <div className="dash-toggle-bubble" aria-hidden="true">
              Expandir menu
            </div>
          )}
        </div>

        <div className="dash-menu">
          {menu.map((item) => {
            const active = isActive(item.to) || item.children?.some((child) => isActive(child.to))
            const isOpen = openMenu === item.label
            const showInlineSubmenu = Boolean(item.children && !isCollapsed && isOpen)
            const showFlyoutSubmenu = Boolean(item.children && isCollapsed && !mobileOpen && hoveredMenu === item.label)

            return (
              <div
                key={item.label}
                className="dash-nav-item-wrap"
                onMouseEnter={() => {
                  if (isCollapsed && !mobileOpen && item.children) {
                    clearHoverCloseTimer()
                    setHoveredMenu(item.label)
                  }
                }}
                onMouseLeave={() => {
                  if (isCollapsed && !mobileOpen && item.children) {
                    clearHoverCloseTimer()
                    hoverCloseTimerRef.current = setTimeout(() => {
                      setHoveredMenu((prev) => (prev === item.label ? null : prev))
                    }, 220)
                  }
                }}
              >
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

                {showInlineSubmenu && (
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

                {showFlyoutSubmenu && (
                  <div className="dash-flyout-submenu">
                    <div className="dash-flyout-title">{item.label}</div>
                    <div className="dash-flyout-list">
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
