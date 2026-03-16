import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login2.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ConsultaClientes from './pages/ConsultaClientes.jsx'
import ConsultaOnline from './pages/ConsultaOnline.jsx'
import ClienteArgus from './pages/ClienteArgus.jsx'
import Equipes from './pages/Equipes.jsx'
import Usuarios from './pages/Usuarios.jsx'
import AdminControlePlanejamento from './pages/AdminControlePlanejamento.jsx'
import Recargas from './pages/Recargas.jsx'
import Relatorios from './pages/Relatorios.jsx'
import Backups from './pages/Backups.jsx'
import CadastrosApis from './pages/CadastrosApis.jsx'
import Permissoes from './pages/Permissoes.jsx'
import Teste from './pages/Teste.jsx'
import Perfil from './pages/Perfil.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import SidebarNav from './components/SidebarNav.jsx'
import { SidebarProvider } from './context/SidebarContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { getAccessibleHomeRoute } from './utils/pageAccess.js'
import {
  canAccessConsultaClientes,
  canAccessConsultaOnline
} from './utils/access.js'

function ConsultaClientesRoute() {
  const { user } = useAuth()
  if (!canAccessConsultaClientes(user)) {
    return <Navigate to="/dashboard" replace />
  }
  return <ConsultaClientes />
}

function ConsultaOnlineRoute() {
  const { user } = useAuth()
  if (!canAccessConsultaOnline(user)) {
    return <Navigate to="/dashboard" replace />
  }
  return <ConsultaOnline />
}

function CadastrosApisRoute() {
  return <CadastrosApis />
}

function App() {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  const hideSidebar = location.pathname === '/' || location.pathname.startsWith('/login')
  const authenticatedHomeRoute = getAccessibleHomeRoute(user) || '/dashboard'
  const defaultRedirect = isAuthenticated ? authenticatedHomeRoute : '/login'

  return (
    <SidebarProvider>
      <div className="app-shell">
        {!hideSidebar && <SidebarNav />}
        <div className={`app-main ${hideSidebar ? '' : 'with-sidebar'}`}>
          <Routes>
          <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        <Route
          path="/recargas"
          element={
            <ProtectedRoute roles={['Master']}>
              <Recargas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/controle-planejamento"
          element={
            <ProtectedRoute roles={['Master']}>
              <AdminControlePlanejamento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/relatorios"
          element={
            <ProtectedRoute roles={['Master']}>
              <Relatorios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/backups"
          element={
            <ProtectedRoute roles={['Master']}>
              <Backups />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cadastros-apis"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor']}>
              <CadastrosApisRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor']}>
              <Usuarios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/equipes"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor']}>
              <Equipes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/permissoes"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor']}>
              <Permissoes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/teste"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor']}>
              <Teste />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute pageKey="perfil">
              <Perfil />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consultas/clientes"
          element={
            <ProtectedRoute>
              <ConsultaClientesRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consultas/online"
          element={
            <ProtectedRoute>
              <ConsultaOnlineRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consulta/cliente-argus/*"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor', 'Operador']}>
              <ClienteArgus />
            </ProtectedRoute>
          }
        />
            <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
          </Routes>
        </div>
      </div>
    </SidebarProvider>
  )
}

export default App
