import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login2.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SupervisionPanel from './pages/SupervisionPanel.jsx'
import OperationPanel from './pages/OperationPanel.jsx'
import ConsultaIN100 from './pages/ConsultaIN100.jsx'
import Equipes from './pages/Equipes.jsx'
import Usuarios from './pages/Usuarios.jsx'
import AdminControlePlanejamento from './pages/AdminControlePlanejamento.jsx'
import Recargas from './pages/Recargas.jsx'
import GeradorSites from './pages/GeradorSites.jsx'
import GeradorSitesV3 from './pages/GeradorSitesV3.jsx'
import StatusWhatsapp from './pages/StatusWhatsapp.jsx'
import FilaMilvus from './pages/FilaMilvus.jsx'
import Status from './pages/Status.jsx'
import MultiploDisparos from './pages/MultiploDisparos.jsx'
import AcompanhamentoDisparos from './pages/AcompanhamentoDisparos.jsx'
import HistoricoConsultas from './pages/HistoricoConsultas.jsx'
import UsuariosZapresponder from './pages/UsuariosZapresponder.jsx'
import UsuariosBmControles from './pages/UsuariosBmControles.jsx'
import DisparadorConfigBM from './pages/DisparadorConfigBM.jsx'
import CampanhasZap from './pages/CampanhasZap.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import SidebarNav from './components/SidebarNav.jsx'

function App() {
  const location = useLocation()
  const hideSidebar = location.pathname === '/' || location.pathname.startsWith('/login')

  return (
    <div className="app-shell">
      {!hideSidebar && <SidebarNav />}
      <div className={`app-main ${hideSidebar ? '' : 'with-sidebar'}`}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        {/* <Route
        path="/status/whatsapp"
        element={
          <ProtectedRoute teamIds={[1014]}>
            <StatusWhatsapp />
          </ProtectedRoute>
        }
      /> */}
        {/* <Route path="/status" element={<Status />} /> */}
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
            <ProtectedRoute roles={['Master', 'Administrador']}>
              <AdminControlePlanejamento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/gerador-sites"
          element={
            <ProtectedRoute roles={['Master', 'Administrador']}>
              <GeradorSites />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/status-bm"
          element={
            <ProtectedRoute roles={['Master', 'Administrador']}>
              <GeradorSitesV3 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/usuarios-zapresponder"
          element={
            <ProtectedRoute roles={['Master', 'Administrador']}>
              <UsuariosZapresponder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bm-controles"
          element={
            <ProtectedRoute roles={['Master', 'Administrador']}>
              <UsuariosBmControles />
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
          path="/supervisao"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor']}>
              <SupervisionPanel />
            </ProtectedRoute>
          }
        />
        {/* <Route
        path="/fila-milvus"
        element={
          <ProtectedRoute roles={["Master", "Administrador", "Supervisor"]}>
            <FilaMilvus />
          </ProtectedRoute>
        }
      /> */}
        <Route
          path="/operacao"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor', 'Operador']}>
              <OperationPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consultas/in100"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor', 'Operador']}>
              <ConsultaIN100 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consultas/historico"
          element={
            <ProtectedRoute roles={['Master', 'Administrador', 'Supervisor', 'Operador']}>
              <HistoricoConsultas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/disparador/disparar-whats"
          element={
            <ProtectedRoute roles={['Master']}>
              <MultiploDisparos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/disparador/campanhas"
          element={
            <ProtectedRoute roles={['Master']}>
              <AcompanhamentoDisparos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/disparador/campanhas-zap"
          element={
            <ProtectedRoute roles={['Master']}>
              <CampanhasZap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/disparador/configurar-bm"
          element={
            <ProtectedRoute roles={['Master']}>
              <DisparadorConfigBM />
            </ProtectedRoute>
          }
        />
        {/* <Route
        path="/disparos/multiplos"
        element={
          <ProtectedRoute teamIds={[1, 1014]}>
            <MultiploDisparos />
          </ProtectedRoute>
        }
      /> */}
        {/* <Route
        path="/disparos/acompanhamento"
        element={
          <ProtectedRoute teamIds={[1, 1014]}>
            <AcompanhamentoDisparos />
          </ProtectedRoute>
        }
      /> */}
        <Route path="/disparos/multiplos" element={<Navigate to="/disparador/disparar-whats" replace />} />
        <Route path="/disparos/acompanhamento" element={<Navigate to="/disparador/campanhas" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
